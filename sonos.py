"""
Native Sonos output for Streamify (UPnP/SOAP on port 1400).

AirPlay 2 via pyatv is accepted by Sonos speakers but stays silent, so Sonos
is driven natively: mediaserver.MediaServer serves the track from this PC and
the speaker is told to play that URL (AVTransport SetAVTransportURI + Play),
with volume/mute via RenderingControl.

Everything here is synchronous; the backend calls it from Flask threads.
SonosOutput serialises its public methods with an RLock (status() only waits
briefly and otherwise returns the last snapshot, so polling never queues
behind an 8 s track load).
"""

import re
import sys
import threading
import time
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

import requests

import mediaserver

PORT = 1400
_SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/"


class SonosError(RuntimeError):
    def __init__(self, message, kind="sonos_fault", code=None):
        super().__init__(message)
        self.kind = kind
        self.code = code


def _local(tag):
    return tag.rsplit("}", 1)[-1]


def _find(root, name):
    for el in root.iter():
        if _local(el.tag) == name:
            return el
    return None


def _secs(text):
    """'H:MM:SS' or 'H:MM:SS.mmm' -> float seconds; NOT_IMPLEMENTED/empty -> None."""
    if not text or not re.match(r"^\d+:\d{1,2}:\d{1,2}(\.\d+)?$", text.strip()):
        return None
    h, m, s = text.strip().split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def _hms(sec):
    sec = max(0, int(round(sec)))
    return f"{sec // 3600}:{sec // 60 % 60:02d}:{sec % 60:02d}"


# ── discovery ──────────────────────────────────────────────────
def probe(ip, timeout=1.0):
    """{model, room, sw_gen, uuid} when ip is a Sonos player, else None. Never raises."""
    try:
        r = requests.get(f"http://{ip}:{PORT}/xml/device_description.xml",
                         timeout=(timeout, timeout), allow_redirects=False)
        if r.status_code != 200 or len(r.content) > 512 * 1024:
            return None
        root = ET.fromstring(r.content)
        dev = _find(root, "device")
        if dev is None:
            return None

        def txt(name):
            for el in dev:
                if _local(el.tag) == name:
                    return (el.text or "").strip()
            return ""

        if "sonos" not in txt("manufacturer").lower():
            return None
        udn = txt("UDN")
        gen = txt("swGen")
        return {
            "model": txt("modelName") or txt("modelDescription") or txt("modelNumber"),
            "room": txt("roomName") or None,
            "sw_gen": int(gen) if gen.isdigit() else None,
            "uuid": udn[5:] if udn.startswith("uuid:") else (udn or None),
        }
    except Exception:
        return None


# ── low-level SOAP ─────────────────────────────────────────────
_FAULT_TEXT = {
    401: "invalid action", 402: "invalid arguments", 701: "transition not available",
    711: "illegal seek target", 714: "illegal MIME type", 716: "resource not found",
    718: "invalid instance id", 800: "command not supported (not the group coordinator?)",
}


class SonosClient:
    def __init__(self, ip, timeout=3):
        self.ip = ip
        self.timeout = timeout
        self.session = requests.Session()

    def _soap(self, service, action, _timeout=None, **args):
        urn = f"urn:schemas-upnp-org:service:{service}:1"
        body = "".join(f"<{k}>{escape(str(v))}</{k}>" for k, v in args.items())
        envelope = (
            '<?xml version="1.0" encoding="utf-8"?>'
            f'<s:Envelope xmlns:s="{_SOAP_NS}" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
            f'<s:Body><u:{action} xmlns:u="{urn}"><InstanceID>0</InstanceID>{body}</u:{action}>'
            "</s:Body></s:Envelope>"
        )
        t = self.timeout if _timeout is None else _timeout
        try:
            r = self.session.post(
                f"http://{self.ip}:{PORT}/MediaRenderer/{service}/Control",
                data=envelope.encode("utf-8"),
                headers={"Content-Type": 'text/xml; charset="utf-8"', "SOAPACTION": f'"{urn}#{action}"'},
                timeout=(min(t, 2), t),
            )
        except requests.RequestException as ex:
            raise SonosError(f"Speaker at {self.ip} unreachable ({type(ex).__name__})", "unreachable") from ex
        try:
            root = ET.fromstring(r.content)
        except ET.ParseError:
            root = None
        if r.status_code != 200:
            code_el = _find(root, "errorCode") if root is not None else None
            code = int(code_el.text) if code_el is not None and (code_el.text or "").strip().isdigit() else None
            what = _FAULT_TEXT.get(code, "error")
            raise SonosError(f"Sonos {action} failed: UPnP {code or r.status_code} ({what})",
                             "sonos_fault", code)
        if root is None:
            raise SonosError(f"Sonos {action}: unparseable response", "sonos_fault")
        resp = _find(root, f"{action}Response")
        out = {}
        if resp is not None:
            for el in resp:
                out[_local(el.tag)] = el.text or ""
        return out

    # transport
    def set_uri(self, url):
        self._soap("AVTransport", "SetAVTransportURI", CurrentURI=url, CurrentURIMetaData="")

    def play(self):
        self._soap("AVTransport", "Play", Speed=1)

    def pause(self, _timeout=None):
        self._soap("AVTransport", "Pause", _timeout=_timeout)

    def stop(self):
        self._soap("AVTransport", "Stop")

    def seek(self, sec):
        self._soap("AVTransport", "Seek", Unit="REL_TIME", Target=_hms(sec))

    def transport_info(self, _timeout=None):
        r = self._soap("AVTransport", "GetTransportInfo", _timeout=_timeout)
        return {"state": r.get("CurrentTransportState", ""), "status": r.get("CurrentTransportStatus", "")}

    def position_info(self, _timeout=None):
        r = self._soap("AVTransport", "GetPositionInfo", _timeout=_timeout)
        return {"uri": r.get("TrackURI", ""), "rel": _secs(r.get("RelTime")), "dur": _secs(r.get("TrackDuration"))}

    def media_info(self, _timeout=None):
        r = self._soap("AVTransport", "GetMediaInfo", _timeout=_timeout)
        return {"uri": r.get("CurrentURI", "")}

    # rendering
    def get_volume(self, _timeout=None):
        return int(self._soap("RenderingControl", "GetVolume", _timeout=_timeout, Channel="Master")["CurrentVolume"])

    def set_volume(self, n, _timeout=None):
        n = max(0, min(100, int(round(n))))
        self._soap("RenderingControl", "SetVolume", _timeout=_timeout, Channel="Master", DesiredVolume=n)

    def get_mute(self, _timeout=None):
        return self._soap("RenderingControl", "GetMute", _timeout=_timeout, Channel="Master")["CurrentMute"] == "1"

    def set_mute(self, b, _timeout=None):
        self._soap("RenderingControl", "SetMute", _timeout=_timeout, Channel="Master", DesiredMute=1 if b else 0)


# ── output ─────────────────────────────────────────────────────
_STATES = {"PLAYING": "playing", "PAUSED_PLAYBACK": "paused", "STOPPED": "stopped",
           "TRANSITIONING": "loading", "NO_MEDIA_PRESENT": "idle"}


class _Fade:
    def __init__(self, restore):
        self.restore = restore  # volume to put back
        self.cancelled = False
        self.done = False


class SonosOutput:
    # injectable for tests
    client_factory = SonosClient
    server_factory = mediaserver.MediaServer
    local_ip = staticmethod(mediaserver.local_ip_for)
    LOAD_TIMEOUT = 8.0
    POLL = 0.15
    SEEK_SLACK = 1.5
    STOPPED_GRACE = 1.0
    LATENCY = 0.3

    def __init__(self, device, resolve, prepare):
        self.device = {**device, "kind": "sonos"}
        self.resolve = resolve
        self.prepare = prepare
        self.client = self.client_factory(device["address"])
        self.server = None
        self.lock = threading.RLock()
        self.connected = False
        self.found_volume = None
        self.found_mute = None
        self.track_id = None
        self.last_error = None
        self.error_seq = 0
        self._poll_err = None  # message of the current status-poll error (dedupe)
        self._fade = None
        self._snapshot = None
        self._loading = False

    # -- errors --
    def _record(self, ex):
        self.last_error = str(ex) or type(ex).__name__
        self.error_seq += 1

    def _grouped_or(self, ex):
        """Turn a transport fault into kind 'grouped' when the speaker follows another one."""
        if isinstance(ex, SonosError) and ex.kind == "sonos_fault":
            try:
                if self.client.media_info().get("uri", "").startswith("x-rincon:"):
                    return SonosError(
                        f"{self.device.get('name') or 'This speaker'} is grouped with another Sonos speaker; "
                        "ungroup it in the Sonos app or pick the group's main speaker", "grouped", ex.code)
            except Exception:
                pass
        return ex

    def _prefix(self):
        return self.server.prefix() if self.server is not None else None

    def _ours(self, uri):
        p = self._prefix()
        return bool(p and uri and uri.startswith(p))

    # -- lifecycle --
    def connect(self):
        with self.lock:
            if self.connected:
                return
            ip = self.local_ip(self.device["address"])
            if not ip:
                ex = SonosError(f"No LAN address of this PC reaches {self.device['address']}", "no_lan_ip")
                self._record(ex)
                raise ex
            # read before starting anything, so an unreachable speaker leaves nothing running
            try:
                vol = self.client.get_volume()
                mute = self.client.get_mute()
            except SonosError as ex:
                self._record(ex)
                raise
            try:
                server = self.server_factory(ip, self.device["address"])
                server.start()
            except Exception as ex:
                err = SonosError(f"Couldn't start the media server: {ex}", "media_server")
                self._record(err)
                raise err from ex
            self.server = server
            self.found_volume, self.found_mute = vol, mute
            self.connected = True

    def disconnect(self):
        with self.lock:
            if not self.connected and self.server is None:
                return
            self.connected = False
            self._cancel_fade(restore=False)
            c, t = self.client, 2
            try:
                try:
                    st = c.transport_info(_timeout=t)["state"]
                    if st in ("PLAYING", "TRANSITIONING") and self._ours(c.position_info(_timeout=t)["uri"]):
                        c.pause(_timeout=t)
                except Exception as ex:
                    print(f"[sonos] pause on disconnect failed: {ex}", file=sys.stderr)
                try:
                    if self.found_volume is not None and c.get_volume(_timeout=t) != self.found_volume:
                        c.set_volume(self.found_volume, _timeout=t)
                    if self.found_mute is not None and c.get_mute(_timeout=t) != self.found_mute:
                        c.set_mute(self.found_mute, _timeout=t)
                except Exception as ex:
                    print(f"[sonos] restoring volume failed: {ex}", file=sys.stderr)
            finally:
                server, self.server = self.server, None
                if server is not None:
                    server.stop()
                self.track_id = None
                self._snapshot = None

    shutdown = disconnect

    def _require(self):
        if not self.connected or self.server is None:
            raise SonosError("Sonos speaker not connected", "not_found")

    # -- playback --
    def play(self, tid, position=0.0):
        tid = str(tid)
        position = max(0.0, float(position or 0))
        with self.lock:
            self._require()
            self._cancel_fade(restore=True)
            self._loading = True
            try:
                self._play(tid, position)
                self._poll_err = None
            except Exception as ex:
                ex = self._grouped_or(ex)
                self._record(ex)
                raise ex
            finally:
                self._loading = False

    def _play(self, tid, position):
        c = self.client
        if self.track_id == tid:
            pos = c.position_info()
            if self._ours(pos["uri"]):
                info = c.transport_info()
                rel = pos["rel"] or 0.0
                need_seek = abs(rel - position) > self.SEEK_SLACK
                if info["state"] == "PLAYING" and not need_seek:
                    return
                self._start(tid, position, need_seek, fresh=False)
                return
        if c.media_info()["uri"].startswith("x-rincon:"):
            # a group member follows its coordinator; setting a URI would pull it out of the group
            raise SonosError(
                f"{self.device.get('name') or 'This speaker'} is grouped with another Sonos speaker; "
                "ungroup it in the Sonos app or pick the group's main speaker", "grouped")
        try:
            src = self.resolve(tid)
        except Exception as ex:
            # fetching the audio from YouTube failed; say so instead of a bare 'no data'
            raise SonosError(f"Couldn't get the audio for this track: {ex}", "no_audio") from ex
        try:
            f = self.prepare(tid, src)
        except Exception as ex:
            raise SonosError(f"Couldn't prepare the audio for Sonos: {ex}", "media_server") from ex
        url = self.server.url_for(tid, f)
        self.track_id = None
        c.set_uri(url)
        self.track_id = tid
        self._start(tid, position, position > self.SEEK_SLACK, fresh=True)

    def _start(self, tid, position, need_seek, fresh):
        c = self.client
        early_ok = False
        if need_seek:
            try:
                c.seek(position)
                early_ok = True
            except SonosError as ex:
                if ex.kind != "sonos_fault":
                    raise
                # 701: transport doesn't allow seeking before playback; seek once PLAYING
        c.play()
        state = self._await_playing(tid, fresh)
        if state != "PLAYING":
            return
        if need_seek:
            off = True
            if early_ok:
                try:
                    rel = c.position_info()["rel"]
                    off = rel is None or abs(rel - position) > 3
                except SonosError:
                    off = False
            if off:
                try:
                    c.seek(position)
                except SonosError as ex:
                    # playback is running from the wrong spot: tell, but don't fail the play
                    self._record(SonosError(f"Seek to {_hms(position)} failed: {ex}", "sonos_fault", ex.code))

    def _await_playing(self, tid, fresh):
        c = self.client
        start = time.monotonic()
        seen_moving = False
        while True:
            info = c.transport_info()
            st = info["state"]
            if st == "PLAYING":
                return st
            if st == "TRANSITIONING":
                seen_moving = True
            bad_status = info["status"] not in ("", "OK")
            stopped = st in ("STOPPED", "NO_MEDIA_PRESENT") and (
                seen_moving or time.monotonic() - start > self.STOPPED_GRACE)
            timed_out = time.monotonic() - start > self.LOAD_TIMEOUT
            if bad_status or stopped or timed_out:
                break
            time.sleep(self.POLL)
        # url_for() cleared the fetch time, so any request counts for this load
        if fresh and self.server.fetched(tid) is None:
            raise SonosError(
                f"Speaker never requested the audio — is port {self.server.port} reachable from the speaker?",
                "not_fetched")
        why = f"state {st}" + (f", status {info['status']}" if info["status"] not in ("", "OK") else "")
        if timed_out:
            why += f" after {self.LOAD_TIMEOUT:g} s"
        raise SonosError(f"Sonos couldn't play the track ({why})", "load_failed")

    def stop(self, fade=0):
        with self.lock:
            self._require()
            c = self.client
            try:
                info = c.transport_info()
                if info["state"] not in ("PLAYING", "TRANSITIONING"):
                    return
                if not self._ours(c.position_info()["uri"]):
                    return  # someone else's playback: leave it alone
                if self._fade is not None and not self._fade.done:
                    return  # already fading out
                if fade and fade > 0:
                    vol = c.get_volume()
                    f = self._fade = _Fade(vol)
                    threading.Thread(target=self._fade_run, args=(f, float(fade)),
                                     daemon=True, name="sonos-fade").start()
                    return
                c.pause()
            except Exception as ex:
                ex = self._grouped_or(ex)
                self._record(ex)
                raise ex

    def _fade_run(self, f, fade):
        c = self.client
        try:
            steps = max(1, min(int(fade / 0.1), f.restore or 1))
            for i in range(1, steps + 1):
                time.sleep(fade / steps)
                with self.lock:
                    if f.cancelled:
                        return
                    c.set_volume(f.restore * (1 - i / steps))
            with self.lock:
                if not f.cancelled:
                    c.pause()
        except Exception as ex:
            with self.lock:
                self._record(self._grouped_or(ex))
        finally:
            with self.lock:
                if not f.done:
                    f.done = True
                    if not f.cancelled:
                        try:
                            c.set_volume(f.restore)
                        except Exception as ex:
                            self._record(ex)
                if self._fade is f:
                    self._fade = None

    def _cancel_fade(self, restore):
        """Stop a running fade-out; restore=True puts its volume back right away."""
        f = self._fade
        if f is None or f.done:
            return
        f.cancelled = True
        f.done = True
        self._fade = None
        if restore:
            try:
                self.client.set_volume(f.restore)
            except Exception as ex:
                self._record(ex)

    def set_volume(self, value=None, muted=None):
        with self.lock:
            self._require()
            try:
                if value is not None:
                    f = self._fade
                    if f is not None and not f.done:
                        f.restore = int(round(value))  # the fade puts this back when it ends
                    else:
                        self.client.set_volume(value)
                if muted is not None:
                    self.client.set_mute(bool(muted))
            except Exception as ex:
                self._record(ex)
                raise

    # -- status --
    def _base(self):
        return {
            "connected": self.connected, "kind": "sonos",
            "device": dict(self.device) if self.connected else None,
            "state": "idle", "playing": False, "track_id": None, "position": None,
            "duration": None, "volume": None, "volume_known": True, "muted": None,
            "latency": self.LATENCY, "owner": False,
            "last_error": self.last_error, "error_seq": self.error_seq,
        }

    def status(self):
        if not self.lock.acquire(timeout=0.3):
            # a load or command is running: don't queue polls behind it
            s = dict(self._snapshot or self._base())
            if self._loading:
                s.update(state="loading", playing=False)
            s.update(last_error=self.last_error, error_seq=self.error_seq)
            return s
        try:
            s = self._base()
            if not self.connected:
                return s
            c = self.client
            try:
                info = c.transport_info()
                pos = c.position_info()
                vol = c.get_volume()
                mute = c.get_mute()
            except SonosError as ex:
                if self._poll_err != str(ex):
                    self._poll_err = str(ex)
                    self._record(ex)
                s.update(state="error", last_error=self.last_error, error_seq=self.error_seq)
                self._snapshot = s
                return s
            self._poll_err = None
            f = self._fade
            s["volume"] = f.restore if f is not None and not f.done else vol
            s["muted"] = mute
            owner = self._ours(pos["uri"])
            s["owner"] = owner
            if owner:
                state = _STATES.get(info["state"], "stopped")
                if info["status"] not in ("", "OK") and self._poll_err is None:
                    msg = f"Sonos playback error: {info['status']}"
                    if self.last_error != msg:
                        self._record(SonosError(msg, "stream_failed"))
                    state = "error"
                s.update(state=state, playing=state == "playing", track_id=self.track_id,
                         position=pos["rel"], duration=pos["dur"])
            s.update(last_error=self.last_error, error_seq=self.error_seq)
            self._snapshot = s
            return s
        finally:
            self.lock.release()
