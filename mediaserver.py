"""
Tiny LAN media server for Sonos playback.

A Sonos speaker plays a URL it fetches itself, so Streamify serves the track
from this PC: a separate Flask app on a separate werkzeug server, bound only
to the LAN address the speaker can reach, answering only that speaker and
only for files registered with url_for() under an unguessable per-start
token.

    srv = MediaServer("192.168.68.130", "192.168.68.100", port=None)
    srv.start()
    url = srv.url_for("123", prepare_for_sonos(src, "123"))
    ...
    srv.stop()

prepare_for_sonos() rewraps the cached audio as a faststart AAC .m4a that
Sonos plays and seeks reliably (cache/sonos/<id>.m4a: a subfolder, so the
main cache's "<id>.*" lookup never sees it).
"""

import contextlib
import ipaddress
import os
import re
import secrets
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

from flask import Flask, abort, request, send_file
from werkzeug.serving import WSGIRequestHandler, make_server

CACHE_DIR = Path(__file__).parent / "cache"
SONOS_DIR = CACHE_DIR / "sonos"
KEEP = 6
DEFAULT_PORT = 5055
ID_RE = re.compile(r"^\d{1,15}$")
_NAME_RE = re.compile(r"^(\d{1,15})\.m4a$")

# files registered with any running MediaServer: never pruned
_live = set()
_live_lock = threading.Lock()


# ── network ────────────────────────────────────────────────────
def _usable(ip):
    try:
        a = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (a.is_loopback or a.is_unspecified or a.is_multicast)


def local_ip_for(peer_ip):
    """This PC's address on the route toward peer_ip (no packet is sent)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect((peer_ip, 1400))
            ip = s.getsockname()[0]
    except OSError:
        return None
    return ip if _usable(ip) else None


# ── transcoding ────────────────────────────────────────────────
def _codec(src):
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a:0",
             "-show_entries", "stream=codec_name", "-of", "csv=p=0", str(src)],
            capture_output=True, text=True, timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return r.stdout.strip().splitlines()[0].strip() if r.returncode == 0 and r.stdout.strip() else None


def _prune_sonos(keep_path):
    files = sorted(SONOS_DIR.glob("*.m4a"), key=lambda p: p.stat().st_mtime, reverse=True)
    with _live_lock:
        live = {p.resolve() for p in _live}
    for p in files[KEEP:]:
        if p.resolve() in live or p == keep_path:
            continue
        p.unlink(missing_ok=True)
    # leftovers of interrupted conversions
    cutoff = time.time() - 600
    for p in SONOS_DIR.glob("*.tmp"):
        with contextlib.suppress(OSError):
            if p.stat().st_mtime < cutoff:
                p.unlink()


def prepare_for_sonos(src, tid, lock=None):
    """cache/sonos/<tid>.m4a: AAC in a faststart MP4 (copied when the source is AAC)."""
    tid = str(tid)
    if not ID_RE.match(tid):
        raise ValueError("invalid track id")
    src = Path(src)
    SONOS_DIR.mkdir(parents=True, exist_ok=True)
    out = SONOS_DIR / f"{tid}.m4a"
    with lock if lock is not None else contextlib.nullcontext():
        # the backend touches the source on every use, so mtimes can't tell
        # staleness; a track id always maps to the same cached audio
        if out.is_file() and out.stat().st_size > 0:
            out.touch()
            return out
        if not src.is_file():
            raise FileNotFoundError(f"source audio missing: {src}")
        codec = _codec(src)
        tmp = SONOS_DIR / f"{tid}.{os.getpid()}-{time.time_ns()}.tmp"
        audio = ["-c:a", "copy"] if codec == "aac" else ["-c:a", "aac", "-b:a", "256k"]
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vn", *audio,
               "-movflags", "+faststart", "-f", "ipod", str(tmp)]
        try:
            done = subprocess.run(cmd, capture_output=True, timeout=300)
            if done.returncode != 0 or not tmp.is_file() or tmp.stat().st_size == 0:
                msg = done.stderr.decode(errors="replace").strip()[:200]
                raise RuntimeError(f"ffmpeg failed ({codec or 'unknown codec'}): {msg}")
            tmp.replace(out)
        except subprocess.TimeoutExpired:
            raise RuntimeError("ffmpeg timed out preparing audio for Sonos")
        finally:
            tmp.unlink(missing_ok=True)
        _prune_sonos(out)
        return out


# ── server ─────────────────────────────────────────────────────
def _bind(ip, port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((ip, port))
        s.listen(64)
    except OSError:
        s.close()
        raise
    return s


class MediaServer:
    KEEP_REGISTERED = 2
    def __init__(self, bind_ip, peer_ip, port=None):
        if not _usable(bind_ip):
            raise ValueError(f"refusing to bind media server to {bind_ip!r}")
        self.bind_ip = bind_ip
        self.peer_ip = peer_ip
        if port is None:
            port = int(os.environ.get("STREAMIFY_MEDIA_PORT") or DEFAULT_PORT)
        self.want_port = int(port)
        self.port = None
        self.token = None
        self._files = {}  # tid -> Path
        self._fetched = {}  # tid -> time.time() of the last request for it
        self._lock = threading.Lock()
        self._server = None
        self._thread = None
        self.app = self._make_app()

    # -- lifecycle --
    @property
    def running(self):
        return self._server is not None

    def start(self):
        if self._server is not None:
            return self
        try:
            sock = _bind(self.bind_ip, self.want_port)
        except OSError as ex:
            if self.want_port == 0:
                raise
            print(f"[media] port {self.want_port} unavailable ({ex.strerror}); using a free port",
                  file=sys.stderr)
            sock = _bind(self.bind_ip, 0)
        try:
            # werkzeug dups the fd; binding ourselves avoids its sys.exit() on EADDRINUSE
            server = make_server(self.bind_ip, sock.getsockname()[1], self.app,
                                 threaded=True, request_handler=_QuietHandler, fd=sock.fileno())
        finally:
            sock.close()
        server.daemon_threads = True
        self.token = secrets.token_urlsafe(16)
        self.port = server.server_address[1]
        self._server = server
        self._thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.2},
                                        daemon=True, name="sonos-media")
        self._thread.start()
        print(f"[media] serving on http://{self.bind_ip}:{self.port}/ for {self.peer_ip}", file=sys.stderr)
        return self

    def stop(self):
        server, thread = self._server, self._thread
        self._server = self._thread = None
        if server is not None:
            if thread is not None and thread.is_alive():
                server.shutdown()
                thread.join(2)
            server.server_close()
        with self._lock:
            files = list(self._files.values())
            self._files.clear()
        with _live_lock:
            for p in files:
                _live.discard(p)
        self.token = None

    # -- registry --
    def url_for(self, tid, path):
        tid = str(tid)
        if not ID_RE.match(tid):
            raise ValueError("invalid track id")
        if self._server is None:
            raise RuntimeError("media server not running")
        path = Path(path).resolve()
        with self._lock:
            dropped = [self._files.pop(tid)] if tid in self._files else []
            self._files[tid] = path  # newest last
            self._fetched.pop(tid, None)  # each load must be fetched anew
            # only the current and the previous track stay servable (and unprunable)
            while len(self._files) > self.KEEP_REGISTERED:
                old_tid = next(iter(self._files))
                dropped.append(self._files.pop(old_tid))
                self._fetched.pop(old_tid, None)
        with _live_lock:
            for p in dropped:
                _live.discard(p)
            _live.add(path)
        return f"{self.prefix()}{tid}.m4a"

    def prefix(self):
        """URL prefix every URL handed out by this server run starts with."""
        if self._server is None:
            return None
        return f"http://{self.bind_ip}:{self.port}/m/{self.token}/"

    def fetched(self, tid):
        with self._lock:
            return self._fetched.get(str(tid))

    # -- http --
    def _make_app(self):
        app = Flask("streamify-media")
        app.url_map.strict_slashes = False

        @app.route("/m/<token>/<name>", methods=["GET", "HEAD"])
        def media(token, name):
            if request.remote_addr != self.peer_ip:
                abort(403)
            cur = self.token
            if not cur or not secrets.compare_digest(token.encode(), cur.encode()):
                abort(403)
            m = _NAME_RE.match(name)
            if not m:
                abort(404)
            tid = m.group(1)
            with self._lock:
                path = self._files.get(tid)
                if path is not None:
                    self._fetched[tid] = time.time()
            if path is None or not path.is_file():
                abort(404)
            resp = send_file(path, conditional=True, mimetype="audio/mp4", max_age=0)
            resp.headers["Cache-Control"] = "no-store"
            return resp

        @app.after_request
        def log(resp):
            path = re.sub(r"^/m/[^/]+/", "/m/***/", request.path)
            rng = request.headers.get("Range")
            print(f"[media] {request.remote_addr} {request.method} {path}"
                  f"{' ' + rng if rng else ''} -> {resp.status_code}", file=sys.stderr)
            return resp

        return app


class _QuietHandler(WSGIRequestHandler):
    """werkzeug's access log would print the token; the app logs a masked line instead."""

    def log_request(self, *args, **kwargs):
        pass

    def log(self, type, message, *args):
        if type == "error":
            msg = re.sub(r"/m/[^/ ]+/", "/m/***/", message % args)
            print(f"[media] {self.address_string()} error: {msg}", file=sys.stderr)
