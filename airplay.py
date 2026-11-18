"""
AirPlay output for Streamify, via pyatv (RAOP audio streaming).

pyatv is optional: import this module lazily and fall back gracefully when it
is missing (see backend.py). Install into a project venv:

    python -m venv --system-site-packages .venv
    .venv/bin/pip install pyatv "srptools<2"
    .venv/bin/python backend.py

(srptools 2.x made an argument keyword-only that pyatv 0.18 passes
positionally, which breaks streaming.)

What the devices allow: they can stream a file, set the volume and stop, but
not pause or seek. So pause/seek are "stop, then restart from an offset" —
ffmpeg cuts the cached track at that offset into a WAV (pyatv decodes WAV,
MP3, FLAC and OGG but not the AAC/Opus files in the cache).

Everything runs on one persistent asyncio loop in a background thread, which
owns the device connection; Flask threads submit work with call().
"""

import asyncio
import subprocess
import sys
import threading
import time
import wave
from pathlib import Path

import pyatv
from pyatv.const import Protocol

WAV_DIR = Path(__file__).parent / "cache" / "airplay"
WAV_DIR.mkdir(parents=True, exist_ok=True)


class APError(Exception):
    """A failure with a machine-readable code from the /airplay error contract."""

    def __init__(self, msg, code="stream_failed"):
        super().__init__(msg)
        self.code = code


IDLE_LATENCY = 2.3


class AirPlay:
    kind = "airplay"

    def __init__(self):
        self.loop = asyncio.new_event_loop()
        threading.Thread(target=self.loop.run_forever, daemon=True, name="airplay-loop").start()
        self.devices = {}  # identifier -> pyatv config from the last scan
        self.atv = None
        self.device = None  # {"id", "name", ...} of the connected device
        self.task = None  # the running stream_file task
        self.wav = None
        self.started = None  # (track id, start offset, monotonic start time)
        self.track_duration = None  # full track length when known (start + WAV length)
        self.wav_len = None
        self._lock = threading.Lock()  # guards the fields below (read from Flask threads)
        self.state = "idle"
        self.last_error = None
        self.error_seq = 0
        self.volume = None  # last level WE set (None = unknown; pyatv's own value is invented)
        self.muted = False
        self._pre_mute = None

    def call(self, coro, timeout=40):
        return asyncio.run_coroutine_threadsafe(coro, self.loop).result(timeout)

    def _record_error(self, msg):
        with self._lock:
            self.last_error = msg
            self.error_seq += 1
            self.state = "error"
        print("[airplay] " + msg, file=sys.stderr)

    # ── discovery ────────────────────────────────────────────
    async def scan(self):
        confs = await pyatv.scan(self.loop, timeout=4)
        self.devices = {c.identifier: c for c in confs if c.get_service(Protocol.RAOP)}
        return [self._describe(c) for c in self.devices.values()]

    @staticmethod
    def _describe(c):
        info = c.device_info
        return {
            "id": c.identifier,
            "name": c.name,
            "address": str(c.address),
            "model": info.model.name if info and info.model.name != "Unknown" else "",
        }

    # ── connection ───────────────────────────────────────────
    async def connect(self, dev_id, device=None):
        if self.device and self.device["id"] == dev_id and self.atv:
            return self.status()
        await self.disconnect()
        conf = self.devices.get(dev_id)
        if conf is None:
            found = await pyatv.scan(self.loop, identifier=dev_id, timeout=4)
            conf = found[0] if found else None
        if conf is None:
            raise APError("Device not found on the network", "not_found")
        try:
            self.atv = await pyatv.connect(conf, self.loop)
        except Exception as ex:
            raise APError(f"Couldn't connect: {str(ex) or type(ex).__name__}", "unreachable")
        self.device = {**self._describe(conf), **(device or {}), "kind": "airplay"}
        # deliberately no set_volume / volume read: pyatv's value is an invented default
        with self._lock:
            self.state, self.last_error = "idle", None
        return self.status()

    async def disconnect(self):
        await self.stop()
        if self.atv:
            self.atv.close()
        self.atv = self.device = None
        with self._lock:
            self.state = "idle"
            self.volume = self._pre_mute = None
            self.muted = False

    # ── playback ─────────────────────────────────────────────
    def _on_done(self, task, track_id, start, expected):
        """Surface a stream that died: exception, or ended well before the audio did."""
        if task.cancelled() or self.task is not task:
            return  # stopped/replaced on purpose
        exc = task.exception()
        if exc is not None:
            self._record_error(f"Stream failed: {str(exc) or type(exc).__name__}")
        elif expected is not None and time.monotonic() - start < expected - 3.0:
            self._record_error("Stream ended early")
        else:
            with self._lock:
                self.state = "stopped"

    async def play(self, src, track_id, position):
        if not self.atv:
            raise APError("No AirPlay device connected", "not_found")
        wav = WAV_DIR / f"{track_id}-{time.time_ns()}.wav"
        done = await asyncio.to_thread(
            subprocess.run,
            ["ffmpeg", "-y", "-v", "error", "-ss", f"{max(position, 0):.2f}", "-i", str(src),
             "-vn", "-ar", "44100", "-ac", "2", "-sample_fmt", "s16", str(wav)],
            capture_output=True,
        )
        if done.returncode != 0 or not wav.exists():
            wav.unlink(missing_ok=True)
            raise APError("Couldn't prepare audio: " + done.stderr.decode()[:120], "load_failed")
        wav_len = None
        try:
            with wave.open(str(wav)) as w:
                wav_len = w.getnframes() / w.getframerate()
        except Exception:
            pass
        with self._lock:
            self.state = "loading"
            self.last_error = None
        await self.stop()
        position = max(position, 0.0)
        start = time.monotonic()
        task = self.loop.create_task(self.atv.stream.stream_file(str(wav)))
        self.task, self.wav = task, wav
        self.started = (track_id, position, start)
        self.wav_len = wav_len
        self.track_duration = position + wav_len if wav_len else None
        task.add_done_callback(lambda t: self._on_done(t, track_id, start, wav_len))
        with self._lock:
            self.state = "playing"
        # stream_file only returns when playback ends, so a quick failure
        # (device asleep, refused) shows up as the task finishing early
        await asyncio.sleep(0.8)
        if task.done() and not task.cancelled():
            exc = task.exception()
            raise APError(f"Stream failed: {str(exc) or type(exc).__name__}" if exc else "Stream ended immediately")

    async def stop(self, fade=0):  # fade is ignored for AirPlay
        task, self.task = self.task, None
        self.started = None
        if task and not task.done():
            try:
                await self.atv.remote_control.stop()
            except Exception:
                pass
            task.cancel()
            try:
                await task
            except BaseException:
                pass
        if self.wav:
            self.wav.unlink(missing_ok=True)
            self.wav = None
        with self._lock:
            if self.state != "error":
                self.state = "idle" if not self.atv else "stopped"

    async def set_volume(self, value=None, muted=None):
        if not self.atv:
            raise APError("No AirPlay device connected", "not_found")
        if value is not None:
            level = int(max(0.0, min(100.0, float(value))))
            if self.muted and muted is not True:
                self.muted = False
            if self.muted:
                self._pre_mute = level
            else:
                await self.atv.audio.set_volume(float(level))
            self.volume = level
        if muted is True and not self.muted:
            if self.volume is None:
                try:
                    self.volume = int(self.atv.audio.volume)
                except Exception:
                    self.volume = 50
            self._pre_mute = self.volume
            await self.atv.audio.set_volume(0.0)
            self.muted = True
        elif muted is False and self.muted:
            self.muted = False
            await self.atv.audio.set_volume(float(self._pre_mute or 0))
            self.volume = self._pre_mute

    def status(self):
        with self._lock:
            state, err, seq = self.state, self.last_error, self.error_seq
            vol, muted = self.volume, self.muted
        task, started = self.task, self.started
        connected = bool(self.atv)
        playing = bool(task and not task.done())
        if connected and not playing and state == "playing":
            state = "stopped"
        pos = dur = tid = None
        if started and connected:
            tid, off, t0 = started
            dur = self.track_duration
            pos = off + (time.monotonic() - t0) if playing else off + (self.wav_len or 0) if state == "stopped" else off
            if dur is not None:
                pos = min(pos, dur)
            pos = round(pos, 2)
        return {
            "connected": connected,
            "kind": "airplay" if connected else None,
            "device": self.device if connected else None,
            "state": state if connected else "idle",
            "playing": playing,
            "track_id": tid,
            "position": pos,
            "duration": round(dur, 2) if dur is not None else None,
            "volume": vol if connected else None,
            "volume_known": connected and vol is not None,
            "muted": muted if connected and vol is not None else None,
            "latency": IDLE_LATENCY,
            "owner": True,
            "last_error": err,
            "error_seq": seq,
        }
