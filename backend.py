#!/usr/bin/env python3
"""
Streamify backend.

Metadata (search, artists, albums, covers) comes from Deezer's public API,
original release years from MusicBrainz, and lyrics from LRCLIB — no keys
needed. (Deezer's release_date is per *edition*: a 2009 remaster or 2019
deluxe reissue carries that date, not the album's original year.) Audio is resolved on demand: the best
matching YouTube upload for a catalog track is fetched into ./cache and served
from disk with Range support.

Fetching: yt-dlp's default web clients hand back URLs that 403 outside its own
downloader, and the downloader only succeeds after several client attempts
(7-9s). The "android" client returns a directly fetchable URL in ~1s, so that
is tried first, with the slow yt-dlp download kept as a fallback.

Run with: python backend.py
"""

import atexit
import json
import os
import re
import secrets
import signal
import socket
import subprocess
import sys
import threading
import time
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path

import requests
import yt_dlp
from urllib.parse import urlencode, urlsplit

from flask import Flask, jsonify, redirect, request, send_file, send_from_directory
from flask_cors import CORS
from werkzeug.exceptions import NotFound

app = Flask(__name__)

# ── Host / port / LAN mode ──────────────────────────────────────
# Default: loopback only, no auth (page may be opened from file://, hence CORS).
# Opt-in LAN exposure: `--lan` or STREAMIFY_HOST (an IP is bound verbatim;
# "1"/"lan"/"true"/... means 0.0.0.0). LAN mode requires a token cookie.
PORT = int(os.environ.get("STREAMIFY_PORT", "5000"))


def _resolve_host():
    env = os.environ.get("STREAMIFY_HOST", "").strip()
    if env.lower() in ("", "0", "false", "no", "off"):
        env = ""
    if env:
        try:
            socket.inet_aton(env)
            return env
        except OSError:
            pass
        return "0.0.0.0"
    return "0.0.0.0" if "--lan" in sys.argv[1:] else "127.0.0.1"


HOST = _resolve_host()
LAN = HOST not in ("127.0.0.1", "localhost", "::1")
TOKEN = (os.environ.get("STREAMIFY_TOKEN") or secrets.token_urlsafe(8)) if LAN else None
COOKIE = "streamify_token"
# Open to everyone (no token). Hosted-instance hardening: AirPlay/Sonos control is
# refused (it drives devices on the host's network) and /audio is rate limited.
PUBLIC = bool(os.environ.get("STREAMIFY_PUBLIC"))


def _opt(flag, env):
    """CLI flag (`--flag PATH` or `--flag=PATH`) wins over the env var."""
    argv = sys.argv[1:]
    for i, a in enumerate(argv):
        if a == flag and i + 1 < len(argv):
            return argv[i + 1]
        if a.startswith(flag + "="):
            return a.split("=", 1)[1]
    return os.environ.get(env, "").strip() or None


# Opt-in HTTPS (service worker / install need https or localhost). Never
# generates or trusts certificates; validated in the __main__ block.
CERT = _opt("--cert", "STREAMIFY_CERT")
KEY = _opt("--key", "STREAMIFY_KEY")
SCHEME = "https" if (CERT and KEY) else "http"

if os.environ.get("STREAMIFY_PROXY"):
    # behind a TLS-terminating reverse proxy (Docker/Caddy): trust its forwarded scheme/host
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

if not LAN:
    CORS(app)  # file:// pages have a null origin and need it; LAN is same-origin


def _lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def _token_ok(value):
    return bool(value) and secrets.compare_digest(
        value.encode("utf-8", "replace"), TOKEN.encode("utf-8")
    )


@app.before_request
def _gate():
    if not LAN:
        return None
    if PUBLIC:
        if request.path == "/airplay/status":
            # nothing can ever be connected here; "hosted" tells the page to cast from the browser instead
            return jsonify({**_idle_status(), "hosted": True})
        if request.path.startswith("/airplay/"):
            return jsonify({"error": "not available on the hosted server"}), 403
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            origin = request.headers.get("Origin")
            if origin is not None and origin != request.host_url.rstrip("/"):
                return jsonify({"error": "bad origin"}), 403
        return None
    t = request.args.get("t")
    if t is not None and _token_ok(t):
        args = [(k, v) for k, v in request.args.items(multi=True) if k != "t"]
        url = request.path + ("?" + urlencode(args) if args else "")
        resp = redirect(url, 302)
        # Trust X-Forwarded-Proto only here (LAN mode), where a proxy is expected.
        secure = (SCHEME == "https" or request.is_secure
                  or request.headers.get("X-Forwarded-Proto") == "https")
        resp.set_cookie(COOKIE, TOKEN, max_age=30 * 86400, path="/",
                        httponly=True, samesite="Lax", secure=secure)
        return resp
    if not _token_ok(request.cookies.get(COOKIE, "")):
        return jsonify({"error": "unauthorized"}), 401
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("Origin")
        if origin is not None and origin != request.host_url.rstrip("/"):
            return jsonify({"error": "bad origin"}), 403
    return None


@app.after_request
def _security_headers(resp):
    if LAN:
        resp.headers["Cache-Control"] = resp.headers.get("Cache-Control", "no-store")
    return resp

DEEZER = "https://api.deezer.com"
CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)
ID_RE = re.compile(r"^\d{1,15}$")

YDL_BASE = {
    "quiet": True,
    "no_warnings": True,
    "noplaylist": True,
    "socket_timeout": 10,
    "retries": 2,
}

_pool = ThreadPoolExecutor(max_workers=8)
_locks = {}
_locks_guard = threading.Lock()


# ── Deezer metadata ─────────────────────────────────────────────
def dz(path, **params):
    r = requests.get(DEEZER + path, params=params, timeout=8)
    r.raise_for_status()
    j = r.json()
    if isinstance(j, dict) and j.get("error"):
        raise RuntimeError(j["error"].get("message", "Deezer error"))
    return j


def _cover(obj):
    for k in ("cover_big", "cover_medium", "cover", "picture_big", "picture_medium"):
        if obj.get(k):
            return obj[k]
    return ""


def norm_track(t, album=None):
    alb = t.get("album") or album or {}
    art = t.get("artist") or {}
    return {
        "id": str(t["id"]),
        "title": t.get("title") or "Unknown",
        "artist": art.get("name", ""),
        "artistId": str(art["id"]) if art.get("id") else "",
        "album": alb.get("title", ""),
        "albumId": str(alb["id"]) if alb.get("id") else "",
        "thumb": _cover(alb),
        "duration": t.get("duration", 0),
    }


def _artist_pic(a):
    """Deezer serves a grey placeholder (empty hash in the URL) for artists with no photo."""
    for k in ("picture_xl", "picture_big", "picture_medium"):
        u = a.get(k) or ""
        if u and "/artist//" not in u:
            return u
    return ""


def norm_artist(a):
    return {
        "id": str(a["id"]),
        "name": a.get("name", ""),
        "thumb": _artist_pic(a),
        "fans": a.get("nb_fan", 0),
    }


_album_meta = {}  # album id -> what /years needs to look it up


def norm_album(a, artist=None):
    art = a.get("artist") or artist or {}
    aid = str(a["id"])
    album = {
        "id": aid,
        "title": a.get("title", ""),
        "artist": art.get("name", ""),
        "artistId": str(art["id"]) if art.get("id") else "",
        "thumb": _cover(a),
        "year": _years.get(aid) or (a.get("release_date") or "")[:4],
        "type": a.get("record_type", "album"),
    }
    _album_meta[aid] = {**album, "deezer_year": (a.get("release_date") or "")[:4]}
    return album


# ── Original release years (MusicBrainz) ────────────────────────
MB = "https://musicbrainz.org/ws/2"
MB_HEADERS = {"User-Agent": "Streamify/1.0 (local music player)"}
YEARS_FILE = Path(os.environ.get("STREAMIFY_DATA") or Path(__file__).parent) / "years.json"
try:
    _years = json.loads(YEARS_FILE.read_text())
except Exception:
    _years = {}  # deezer album id -> corrected year, persisted across restarts
_mb_lock = threading.Lock()
_mb_last = [0.0]
_tables = {}  # artist name -> {normalised title: [release groups]} (or None)

# Parentheticals like "(Remastered 2009)" / "[Deluxe Edition]" are the same work
# as the original; "(Live at Wembley)" or "(Acoustic)" are not.
_EDITION = re.compile(
    r"remaster|deluxe|edition|anniversary|expanded|\bmix\b|version|bonus|\bmono\b|stereo|reissue|"
    r"collector|special|super|explicit|clean|digital|original|international|standard|complete|"
    r"legacy|platinum|exclusive"
)


def norm_title(t):
    t = re.sub(r"['\u2018\u2019`]", "", t)  # "Pepper's" == "Pepper’s"
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"\([^)]*\)|\[[^\]]*\]", lambda m: " " if _EDITION.search(m[0]) else m[0], t)
    t = re.sub(r"\s[-:]\s[^-:]*(remaster|edition|deluxe|version|mix|anniversary)[^-:]*$", " ", t)
    t = " ".join(re.sub(r"[^a-z0-9]+", " ", t).split())
    return t[4:] if t.startswith("the ") else t


def _mb(path, **params):
    """MusicBrainz allows ~1 request/second."""
    with _mb_lock:
        for attempt in range(4):
            wait = 1.1 - (time.time() - _mb_last[0])
            if wait > 0:
                time.sleep(wait)
            try:
                r = requests.get(MB + path, params={**params, "fmt": "json"}, headers=MB_HEADERS, timeout=12)
            finally:
                _mb_last[0] = time.time()
            if r.status_code != 503:  # rate-limited: back off and retry
                break
            time.sleep(2 * (attempt + 1))
    r.raise_for_status()
    return r.json()


def _lucene(s):
    return s.replace("\\", " ").replace('"', " ")


def _pick_year(groups, dz_type):
    """Earliest first-release among the best-fitting release groups."""
    want = dz_type if dz_type in ("single", "ep") else "album"

    def rank(g):
        prim = (g.get("primary-type") or "").lower()
        sec = g.get("secondary-types") or []
        return (prim != want, bool(sec) and dz_type != "compile", g.get("first-release-date") or "9999")

    if not groups:
        return None
    d = min(groups, key=rank).get("first-release-date") or ""
    return d[:4] if d[:4].isdigit() else None


_table_locks = defaultdict(threading.Lock)


def _artist_table(name):
    """An artist's MusicBrainz release groups, by normalised title."""
    with _table_locks[name]:  # the page prewarms this while /years may ask for it
        return _artist_table_locked(name)


def _artist_table_locked(name):
    if name in _tables:
        return _tables[name]
    found = _mb("/artist", query=f'artist:"{_lucene(name)}"', limit=5)["artists"]
    cands = [a for a in found if norm_title(a["name"]) == norm_title(name)]
    table = None
    if cands:
        mbid = max(cands, key=lambda a: a.get("score", 0))["id"]
        groups = []
        for off in range(0, 800, 100):
            j = _mb("/release-group", artist=mbid, type="album|ep|single", limit=100, offset=off)
            groups += j["release-groups"]
            if off + 100 >= j["release-group-count"]:
                break
        table = defaultdict(list)
        for g in groups:
            table[norm_title(g["title"])].append(g)
    _tables[name] = table
    return table


def _lookup_one(artist, title, dz_type):
    q = f'releasegroup:"{_lucene(title)}" AND artist:"{_lucene(artist)}"'
    groups = _mb("/release-group", query=q, limit=10)["release-groups"]
    key, who = norm_title(title), norm_title(artist)
    hits = [
        g for g in groups
        if norm_title(g["title"]) == key
        and any(norm_title(c.get("name", "")) == who for c in g.get("artist-credit", []))
    ]
    return _pick_year(hits, dz_type)


@app.route("/years")
def years():
    """Original release years for album ids. Slow (rate-limited), so the page
    asks after rendering and patches the years in as they arrive."""
    ids = [i for i in request.args.get("ids", "").split(",") if i.isdigit()][:40]
    by_artist = defaultdict(list)
    for i in ids:
        if i not in _years and i in _album_meta:
            by_artist[_album_meta[i]["artist"]].append(i)
    changed = False
    for artist, group in by_artist.items():
        try:
            # one artist-wide fetch beats several single lookups
            table = _artist_table(artist) if len(group) >= 3 or artist in _tables else None
            if table is not None:
                # the table is already in hand, so settle every album we know for this artist
                group = [i for i, m in _album_meta.items() if m["artist"] == artist and i not in _years]
            for i in group:
                m = _album_meta[i]
                if table is not None:
                    y = _pick_year(table.get(norm_title(m["title"]), []), m["type"])
                else:
                    y = _lookup_one(artist, m["title"], m["type"])
                _years[i] = y or m["deezer_year"]
                changed = True
        except Exception:
            continue  # transient (rate limit, timeout): retry on a later request
    if changed:
        YEARS_FILE.write_text(json.dumps(_years))
    return jsonify({i: _years[i] for i in ids if i in _years})


def _data(j):
    return j.get("data", []) if isinstance(j, dict) else []


def _n(x):
    return re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFKD", x or "").encode("ascii", "ignore").decode().lower()).strip()


def _match(name, q):
    """0..3 — how well a name matches the query."""
    name, q = _n(name), _n(q)
    if not q or not name:
        return 0
    if name == q:
        return 3
    if name.startswith(q) or q.startswith(name):
        return 2
    return 1 if q in name or all(w in name.split() for w in q.split()) else 0


@lru_cache(maxsize=256)
def _search(q):
    jobs = {
        "tracks": _pool.submit(dz, "/search", q=q, limit=50),
        "artists": _pool.submit(dz, "/search/artist", q=q, limit=20),
        "albums": _pool.submit(dz, "/search/album", q=q, limit=24),
    }
    r = {k: _data(f.result()) for k, f in jobs.items()}
    tracks = [norm_track(t) for t in r["tracks"]]
    # artists: name match first, then popularity; ones without a photo sink
    artists = sorted(
        (norm_artist(a) for a in r["artists"]),
        key=lambda a: (-_match(a["name"], q), not a["thumb"], -a["fans"]),
    )
    seen = set()  # same-name namesakes with a tiny following are noise
    artists = [a for a in artists if not ((k := _n(a["name"])) in seen and a["fans"] < 10000) and not seen.add(k)]
    albums = [norm_album(a) for a in r["albums"]]
    albums.sort(key=lambda a: -max(_match(a["title"], q), _match(a["artist"], q) - 1))

    top = None
    a0 = artists[0] if artists else None
    al0 = albums[0] if albums else None
    t0 = tracks[0] if tracks else None
    if a0 and _match(a0["name"], q) >= 2 and (a0["fans"] >= 20000 or _match(a0["name"], q) == 3):
        if not (t0 and _match(t0["title"], q) == 3 and a0["fans"] < 50000):
            top = {"type": "artist", "id": a0["id"]}
    if not top and al0 and _match(al0["title"], q) == 3 and not (t0 and _match(t0["title"], q) == 3):
        top = {"type": "album", "id": al0["id"]}
    if not top and t0:
        top = {"type": "track", "id": t0["id"]}
    elif not top and a0:
        top = {"type": "artist", "id": a0["id"]}

    # when an artist leads, the songs list is theirs (as in Spotify)
    if top and top["type"] == "artist":
        mine = [t for t in tracks if t["artistId"] == top["id"]]
        tracks = mine + [t for t in tracks if t["artistId"] != top["id"]]
    return {"tracks": tracks, "artists": artists, "albums": albums, "top": top}


@lru_cache(maxsize=16)
def _home():
    jobs = {k: _pool.submit(dz, f"/chart/0/{k}", limit=20) for k in ("tracks", "albums", "artists")}
    r = {k: _data(f.result()) for k, f in jobs.items()}
    return {
        "tracks": [norm_track(t) for t in r["tracks"]],
        "artists": [norm_artist(a) for a in r["artists"]],
        "albums": [norm_album(a) for a in r["albums"]],
    }


def _all_albums(aid):
    """Every release for an artist — Deezer pages this endpoint at 100."""
    out = []
    for _ in range(8):
        j = dz(f"/artist/{aid}/albums", limit=100, index=len(out))
        page = _data(j)
        out += page
        if not page or not j.get("next"):
            break
    return out


def _prewarm_table(name):
    try:
        _artist_table(name)
    except Exception:
        pass  # /years retries


@lru_cache(maxsize=128)
def _artist(aid):
    info = _pool.submit(dz, f"/artist/{aid}")
    top = _pool.submit(dz, f"/artist/{aid}/top", limit=20)
    albums = _pool.submit(_all_albums, aid)
    a = info.result()
    _pool.submit(_prewarm_table, a.get("name", ""))
    seen, discography = set(), []
    for al in sorted(albums.result(), key=lambda x: x.get("release_date", ""), reverse=True):
        key = al.get("title", "").lower()
        if key not in seen:
            seen.add(key)
            discography.append(norm_album(al, a))
    return {
        "artist": norm_artist(a),
        "tracks": [norm_track(t) for t in _data(top.result())],
        "albums": discography,
    }


@lru_cache(maxsize=64)
def _mix(aid):
    """Deezer's artist radio: the artist blended with similar artists."""
    seen, tracks = set(), []
    for t in _data(dz(f"/artist/{aid}/radio", limit=40)):
        if t["id"] not in seen:
            seen.add(t["id"])
            tracks.append(norm_track(t))
    return {"tracks": tracks}


@lru_cache(maxsize=256)
def _album(alid):
    a = dz(f"/album/{alid}")
    tracks = [norm_track(t, album=a) for t in a.get("tracks", {}).get("data", [])]
    return {"album": norm_album(a), "tracks": tracks}


def _apply_years(obj):
    """Swap in corrected years at response time; cached payloads stay as built."""
    if isinstance(obj, dict):
        if "year" in obj and obj.get("id") in _years:
            obj = {**obj, "year": _years[obj["id"]]}
        return {k: _apply_years(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_apply_years(v) for v in obj]
    return obj


def _json(fn, *args):
    try:
        return jsonify(_apply_years(fn(*args)))
    except Exception as ex:
        return jsonify({"error": str(ex)}), 502


@app.route("/search")
def search():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"error": "Missing query"}), 400
    return _json(_search, q)


@app.route("/home")
def home():
    return _json(_home)


@app.route("/artist/<int:aid>")
def artist(aid):
    return _json(_artist, aid)


@app.route("/mix/<int:aid>")
def mix(aid):
    return _json(_mix, aid)


@app.route("/album/<int:alid>")
def album(alid):
    return _json(_album, alid)


# ── Lyrics (LRCLIB) ─────────────────────────────────────────────
_LRC_LINE = re.compile(r"^\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$")


def parse_lrc(text):
    lines = []
    for raw in (text or "").splitlines():
        m = _LRC_LINE.match(raw.strip())
        if m:
            lines.append({"t": round(int(m[1]) * 60 + float(m[2]), 2), "text": m[3]})
    return lines


@lru_cache(maxsize=256)
def _lyrics(tid):
    track = norm_track(dz(f"/track/{tid}"))
    headers = {"User-Agent": "Streamify (local music player)"}
    params = {"artist_name": track["artist"], "track_name": track["title"], "duration": track["duration"]}
    if track["album"]:
        params["album_name"] = track["album"]
    r = requests.get("https://lrclib.net/api/get", params=params, headers=headers, timeout=8)
    hit = r.json() if r.status_code == 200 else None
    if not hit:  # exact lookup missed: fall back to fuzzy search, closest length wins
        r = requests.get(
            "https://lrclib.net/api/search",
            params={"artist_name": track["artist"], "track_name": track["title"]},
            headers=headers,
            timeout=8,
        )
        r.raise_for_status()
        cands = [c for c in r.json() if abs((c.get("duration") or 0) - track["duration"]) <= 8]
        hit = min(cands, key=lambda c: abs(c["duration"] - track["duration"]), default=None)
    if not hit:
        return {"synced": [], "plain": "", "instrumental": False}
    return {
        "synced": parse_lrc(hit.get("syncedLyrics")),
        "plain": hit.get("plainLyrics") or "",
        "instrumental": bool(hit.get("instrumental")),
    }


@app.route("/lyrics")
def lyrics():
    tid = request.args.get("id", "").strip()
    if not ID_RE.match(tid):
        return jsonify({"error": "Missing or invalid id"}), 400
    return _json(_lyrics, tid)


# ── Audio: catalog track -> best YouTube match -> cached file ───
_VARIANT = re.compile(r"\b(live|cover|remix|karaoke|instrumental|reaction|tutorial|slowed|sped up|nightcore|8d)\b", re.I)


def pick_youtube(track):
    """Pick the YouTube video whose length and title best fit the catalog track."""
    query = f"{track['artist']} - {track['title']}"
    opts = {**YDL_BASE, "extract_flat": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        entries = ydl.extract_info(f"ytsearch8:{query}", download=False).get("entries") or []
    want = track["duration"]
    best, best_score = None, None
    for e in entries:
        if not e or not e.get("id") or not e.get("duration"):
            continue
        title = e.get("title") or ""
        score = abs(e["duration"] - want) if want else 0
        if (e.get("channel") or e.get("uploader") or "").endswith("- Topic"):
            score -= 4  # YouTube's auto-generated "official audio" uploads
        if _VARIANT.search(title) and not _VARIANT.search(track["title"]):
            score += 30
        if best_score is None or score < best_score:
            best, best_score = e, score
    return best["id"] if best else None


def _fetch_direct(vid, tid):
    """Fast path: android-client URL, plain HTTP download, strip video with ffmpeg."""
    url = f"https://www.youtube.com/watch?v={vid}"
    last = None
    for client in ("android", "tv_simply"):
        tmp = CACHE_DIR / f"{tid}.tmp"
        try:
            opts = {**YDL_BASE, "extractor_args": {"youtube": {"player_client": [client]}}}
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
            fmts = [
                f for f in info["formats"]
                if f.get("url") and f.get("protocol") == "https" and f.get("acodec") not in (None, "none")
            ]
            # audio-only first, otherwise the smallest muxed file
            fmts.sort(key=lambda f: (f.get("vcodec") != "none", f.get("filesize") or f.get("filesize_approx") or 1e12))
            f = fmts[0]
            with requests.get(f["url"], headers=f.get("http_headers") or {}, stream=True, timeout=15) as r:
                r.raise_for_status()
                expected = int(r.headers.get("Content-Length", 0))
                with open(tmp, "wb") as fh:
                    for chunk in r.iter_content(1 << 18):
                        fh.write(chunk)
            if expected and tmp.stat().st_size != expected:
                raise IOError("truncated download")
            if f.get("vcodec") != "none":
                out = CACHE_DIR / f"{tid}.m4a"
                done = subprocess.run(
                    ["ffmpeg", "-y", "-v", "error", "-i", str(tmp), "-vn", "-c:a", "copy", "-f", "ipod", str(out)],
                    capture_output=True,
                )
                if done.returncode == 0 and out.exists():
                    tmp.unlink(missing_ok=True)
                    return out
                out.unlink(missing_ok=True)
                final = CACHE_DIR / f"{tid}.mp4"
            else:
                final = CACHE_DIR / f"{tid}.{f.get('ext', 'webm')}"
            tmp.replace(final)
            return final
        except Exception as ex:
            last = ex
            tmp.unlink(missing_ok=True)
    raise last or RuntimeError("no playable format")


def _fetch_ytdlp(vid, tid):
    """Slow but robust fallback: let yt-dlp's own downloader sort out clients."""
    opts = {
        **YDL_BASE,
        "format": "ba[protocol=https]/ba/b",
        "outtmpl": str(CACHE_DIR / f"{tid}.%(ext)s"),
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([f"https://www.youtube.com/watch?v={vid}"])
    return _cached_file(tid)


def _lock_for(key):
    with _locks_guard:
        return _locks.setdefault(key, threading.Lock())


def _cached_file(tid):
    for p in CACHE_DIR.glob(f"{tid}.*"):
        if p.suffix not in (".part", ".ytdl", ".tmp"):
            return p
    return None


def _prune(keep=100, spare=None):
    """Keep the cache bounded: drop the least recently served tracks."""
    files = sorted(
        (p for p in CACHE_DIR.iterdir() if p.is_file()),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for p in files[keep:]:
        if p != spare:
            p.unlink(missing_ok=True)


def _ensure_audio(tid):
    """Path of the cached audio for a catalog track, fetching it if needed."""
    with _lock_for(tid):
        path = _cached_file(tid)
        if not path:
            track = norm_track(dz(f"/track/{tid}"))
            vid = pick_youtube(track)
            if not vid:
                raise FileNotFoundError("No audio found")
            try:
                path = _fetch_direct(vid, tid)
            except Exception:
                path = _fetch_ytdlp(vid, tid)
            if path:
                _prune(spare=path)
    if not path:
        raise RuntimeError("Download failed")
    path.touch()
    return path


# ── Static front end (explicit allowlist, never generic) ────────
ROOT = Path(__file__).parent
STATIC_FILES = {"style.css", "app.js", "logo.svg", "offline.js", "offline.css", "settings.js", "settings.css"}


ICON_FILES = {"icon-192.png", "icon-512.png", "maskable-512.png", "apple-touch-icon.png"}


def _static(name, mimetype=None, directory=ROOT, cache="no-cache"):
    try:
        resp = send_from_directory(directory, name, mimetype=mimetype)
    except NotFound:
        return jsonify({"error": "not found"}), 404
    resp.headers["Cache-Control"] = cache
    return resp


@app.route("/")
def index():
    return _static("index.html")


for _name in sorted(STATIC_FILES):
    app.add_url_rule("/" + _name, "static_" + _name.replace(".", "_"),
                     lambda _n=_name: _static(_n))


@app.route("/sw.js")
def service_worker():
    resp = _static("sw.js", "text/javascript")
    resp.headers["Service-Worker-Allowed"] = "/"
    return resp


@app.route("/manifest.webmanifest")
def manifest():
    return _static("manifest.webmanifest", "application/manifest+json")


for _icon in sorted(ICON_FILES):
    app.add_url_rule("/icons/" + _icon, "icon_" + _icon.replace(".", "_").replace("-", "_"),
                     lambda _n=_icon: _static(_n, "image/png", ROOT / "icons",
                                              "public, max-age=86400"))


_audio_seen = defaultdict(dict)  # ip -> {track id: first seen}
_audio_lock = threading.Lock()


def _audio_budget(ip, tid, limit=30, window=60):
    """At most `limit` distinct tracks per IP per `window` s (Range requests for one song are free)."""
    now = time.monotonic()
    with _audio_lock:
        seen = _audio_seen[ip]
        for k in [k for k, t in seen.items() if now - t > window]:
            del seen[k]
        if tid not in seen and len(seen) >= limit:
            return False
        seen.setdefault(tid, now)
        return True


@app.route("/audio")
def audio():
    """Download (once) and serve a catalog track's audio. Supports Range."""
    tid = request.args.get("id", "").strip()
    if not ID_RE.match(tid):
        return jsonify({"error": "Missing or invalid id"}), 400
    if PUBLIC and not _audio_budget(request.remote_addr, tid):
        return jsonify({"error": "Too many new songs, slow down"}), 429
    try:
        return send_file(_ensure_audio(tid), mimetype="audio/mp4", conditional=True, max_age=3600)
    except FileNotFoundError as ex:
        return jsonify({"error": str(ex)}), 404
    except Exception as ex:
        return jsonify({"error": str(ex)}), 500


# ── AirPlay / Sonos output (pyatv optional, see airplay.py; Sonos: sonos.py) ──
_airplay = None
_airplay_lock = threading.Lock()
_sonos_out = None  # active sonos.SonosOutput, if any
_cmd_lock = threading.RLock()  # serialises connect/play/stop/volume across Flask threads
_scan_devices = {}  # id -> Device from the last /airplay/devices
_probe_cache = {}  # address -> (expiry monotonic, probe result or None)
_status_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="status")
_last_sonos_status = None
LATENCY_IDLE = 2.3


class BadRequest(Exception):
    pass


def _ap():
    global _airplay
    with _airplay_lock:
        if _airplay is None:
            from airplay import AirPlay  # lazy: backend runs fine without pyatv
            _airplay = AirPlay()
        return _airplay


def _idle_status():
    return {
        "connected": False, "kind": None, "device": None, "state": "idle",
        "playing": False, "track_id": None, "position": None, "duration": None,
        "volume": None, "volume_known": False, "muted": None,
        "latency": LATENCY_IDLE, "owner": True, "last_error": None, "error_seq": 0,
    }


def _out():
    """The active output object (SonosOutput or pyatv AirPlay), or None."""
    if _sonos_out is not None:
        return _sonos_out
    if _airplay is not None and _airplay.atv:
        return _airplay
    return None


def _status():
    global _last_sonos_status
    out = _out()
    if out is None:
        return _idle_status()
    if out is _sonos_out:
        # polled often: never let a slow speaker hold the request for long
        fut = _status_pool.submit(out.status)
        try:
            _last_sonos_status = fut.result(timeout=3)
        except Exception:
            if _last_sonos_status is None:
                raise
        return dict(_last_sonos_status)
    return out.status()


def _probe_one(addr):
    now = time.monotonic()
    hit = _probe_cache.get(addr)
    if hit and hit[0] > now:
        return hit[1]
    try:
        import sonos  # lazy: optional until sonos.py exists
    except Exception:
        return None  # not cached: the module may appear later
    try:
        res = sonos.probe(addr, timeout=1.0)
    except Exception:
        res = None
    _probe_cache[addr] = (now + (600 if res else 60), res)
    return res


def _classify(devices):
    """Add kind 'sonos'/'airplay' to scanned devices, probing in parallel."""
    if not devices:
        return devices
    with ThreadPoolExecutor(max_workers=min(8, len(devices))) as pool:
        probes = list(pool.map(lambda d: _probe_one(d["address"]), devices))
    out = []
    for d, p in zip(devices, probes):
        d = {**d, "kind": "sonos" if p else "airplay"}
        if p and not d.get("model") and p.get("model"):
            d["model"] = p["model"]
        out.append(d)
    return out


def _scan():
    ap = _ap()
    devs = _classify(ap.call(ap.scan()))
    _scan_devices.clear()
    _scan_devices.update({d["id"]: d for d in devs})
    return devs


def _disconnect_sonos():
    global _sonos_out, _last_sonos_status
    out, _sonos_out, _last_sonos_status = _sonos_out, None, None
    if out is not None:
        try:
            out.disconnect()
        except Exception as ex:
            print(f"[sonos] disconnect failed: {ex}", file=sys.stderr)


def _disconnect_airplay():
    if _airplay is not None and _airplay.atv:
        _airplay.call(_airplay.disconnect())


def _error(ex):
    """Map an exception to the (json, http status) error contract."""
    if isinstance(ex, BadRequest):
        return jsonify({"error": str(ex), "code": "bad_request"}), 400
    if isinstance(ex, ImportError):
        return jsonify({
            "error": "AirPlay needs pyatv", "code": "pyatv_missing",
            "hint": "python -m venv --system-site-packages .venv && .venv/bin/pip install pyatv 'srptools<2' && .venv/bin/python backend.py",
        }), 501
    code = getattr(ex, "kind", None) or getattr(ex, "code", None)
    if not isinstance(code, str) or code not in _CODES:
        if isinstance(ex, (TimeoutError, requests.Timeout)) or type(ex).__name__ == "TimeoutError":
            code = "unreachable"
        else:
            code = "stream_failed"
    return jsonify({"error": str(ex) or type(ex).__name__, "code": code}), 502


_CODES = {"not_found", "unreachable", "no_lan_ip", "media_server", "not_fetched",
          "load_failed", "grouped", "sonos_fault", "stream_failed", "no_audio"}


def _airplay_route(fn):
    try:
        return jsonify(fn())
    except Exception as ex:
        if not isinstance(ex, (BadRequest, ImportError)):
            print(f"[airplay] {type(ex).__name__}: {ex}", file=sys.stderr)
        return _error(ex)


def _body():
    b = request.get_json(silent=True)
    return b if isinstance(b, dict) else {}


def _require_out():
    out = _out()
    if out is None:
        raise BadRequest("No output connected")
    return out


@app.route("/airplay/devices")
def airplay_devices():
    return _airplay_route(lambda: {"devices": _scan(), **_status()})


@app.route("/airplay/status")
def airplay_status():
    return _airplay_route(_status)


def _connect(dev_id):
    if not isinstance(dev_id, str) or not dev_id:
        raise BadRequest("Missing device id")
    with _cmd_lock:
        cur = _out()
        if cur is not None and (getattr(cur, "device", None) or {}).get("id") == dev_id:
            return _status()
        dev = _scan_devices.get(dev_id)
        if dev is None:
            _scan()
            dev = _scan_devices.get(dev_id)
        if dev is None:
            e = RuntimeError("Device not found on the network")
            e.kind = "not_found"
            raise e
        global _sonos_out
        if dev["kind"] == "sonos":
            import sonos
            import mediaserver
            _disconnect_airplay()
            _disconnect_sonos()
            out = sonos.SonosOutput(
                dev,
                resolve=_ensure_audio,
                prepare=lambda tid, src: mediaserver.prepare_for_sonos(
                    src, tid, lock=_lock_for("sonos:" + tid)),
            )
            out.connect()
            _sonos_out = out
            return _status()
        _disconnect_sonos()
        ap = _ap()
        ap.call(ap.connect(dev_id, dev))
        return ap.status()


@app.route("/airplay/connect", methods=["POST"])
def airplay_connect():
    return _airplay_route(lambda: _connect(_body().get("id")))


@app.route("/airplay/disconnect", methods=["POST"])
def airplay_disconnect():
    def go():
        with _cmd_lock:
            _disconnect_sonos()
            _disconnect_airplay()
        return _status()
    return _airplay_route(go)


@app.route("/airplay/play", methods=["POST"])
def airplay_play():
    body = _body()
    tid = str(body.get("id", ""))
    if not ID_RE.match(tid):
        return jsonify({"error": "Missing or invalid id", "code": "bad_request"}), 400
    try:
        pos = float(body.get("position", 0) or 0)
        if pos != pos or pos < 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid position", "code": "bad_request"}), 400

    def go():
        with _cmd_lock:
            out = _require_out()
            if out is _sonos_out:
                out.play(tid, pos)  # resolves the audio itself
            else:
                try:
                    src = _ensure_audio(tid)
                except Exception as ex:
                    ex.kind = "not_fetched"
                    raise
                out.call(out.play(src, tid, pos), timeout=90)
            return _status()
    return _airplay_route(go)


@app.route("/airplay/stop", methods=["POST"])
def airplay_stop():
    fade = _body().get("fade", 0)
    try:
        fade = float(fade or 0)
        if fade != fade or fade < 0 or fade > 60:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid fade", "code": "bad_request"}), 400

    def go():
        with _cmd_lock:
            out = _require_out()
            if out is _sonos_out:
                out.stop(fade=fade)
            else:
                out.call(out.stop())  # fade ignored for pyatv
            return _status()
    return _airplay_route(go)


@app.route("/airplay/volume", methods=["POST"])
def airplay_volume():
    body = _body()
    value, muted = body.get("value"), body.get("muted")
    if value is None and muted is None:
        return jsonify({"error": "Need value and/or muted", "code": "bad_request"}), 400
    if value is not None:
        try:
            value = float(value)
            if isinstance(body.get("value"), bool) or not 0 <= value <= 100:
                raise ValueError
            value = int(round(value))
        except (TypeError, ValueError):
            return jsonify({"error": "value must be 0-100", "code": "bad_request"}), 400
    if muted is not None and not isinstance(muted, bool):
        return jsonify({"error": "muted must be a boolean", "code": "bad_request"}), 400

    def go():
        with _cmd_lock:
            out = _require_out()
            if out is _sonos_out:
                out.set_volume(value=value, muted=muted)
            else:
                out.call(out.set_volume(value, muted))
            return _status()
    return _airplay_route(go)


def _shutdown_outputs():
    """Stop the speaker, restore its volume and close the media server on exit."""
    global _sonos_out
    out, _sonos_out = _sonos_out, None
    if out is not None:
        try:
            out.shutdown()
        except Exception as ex:
            print(f"[sonos] shutdown failed: {ex}", file=sys.stderr)
    if _airplay is not None and _airplay.atv:
        try:
            _airplay.call(_airplay.disconnect(), timeout=5)
        except Exception:
            pass


def _fail(msg):
    print("Error: " + msg, file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    ssl_ctx = None
    if CERT or KEY:
        if not (CERT and KEY):
            _fail("HTTPS needs both --cert and --key (or STREAMIFY_CERT and STREAMIFY_KEY); only one was given.")
        for _label, _p in (("certificate", CERT), ("key", KEY)):
            if not os.path.isfile(_p):
                _fail(f"TLS {_label} file not found: {_p}")
        ssl_ctx = (CERT, KEY)
    print("=" * 50)
    print("  Streamify Backend")
    print(f"  Local:  {SCHEME}://localhost:{PORT}/" + ("?t=" + TOKEN if LAN else ""))
    if LAN:
        print(f"  Phone:  {SCHEME}://{_lan_ip()}:{PORT}/?t={TOKEN}")
        print("  WARNING: anyone with this link on your network can use the app.")
        if SCHEME == "http":
            print("  Note: browsers only install the app / run the service worker over https or localhost.")
            print("        For a phone use --cert/--key (mkcert) or an https proxy such as Tailscale Serve.")
    else:
        print("  Open the URL above in your browser (or index.html directly)")
        print("  Phone/LAN access: python backend.py --lan  (add --cert/--key for https)")
    print("=" * 50)
    atexit.register(_shutdown_outputs)
    # atexit doesn't run on SIGTERM unless the signal becomes a normal exit
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    app.run(host=HOST, port=PORT, debug=False, threaded=True, ssl_context=ssl_ctx)
