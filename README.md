# Streamify

A Spotify-style music web app. Metadata (search, covers, albums, artists) comes from public APIs
(Deezer, MusicBrainz, LRCLIB for lyrics); the audio itself is streamed from YouTube via yt-dlp.
Vanilla HTML/CSS/JS front end, Flask back end, installable as a PWA, with offline downloads.

## Run locally

```sh
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python backend.py          # http://localhost:5000 (this computer only)
.venv/bin/python backend.py --lan    # reachable from your LAN, protected by a token link
```

ffmpeg must be installed. Optional: `pyatv` for AirPlay, Sonos works over the LAN with no extra packages.

## Docker (hosted)

```sh
docker compose up -d --build
```

Environment: `STREAMIFY_PUBLIC=1` opens it to everyone (AirPlay/Sonos control is disabled and `/audio`
is rate limited); without it, set `STREAMIFY_TOKEN` and open `/?t=<token>` once per device.
The container listens on port 5000, put a TLS reverse proxy (e.g. Caddy) in front of it.

## Notes

- Streaming YouTube audio may violate YouTube's terms of service; this is a personal/educational project.
- Playlists, likes and downloads are stored per browser (localStorage / IndexedDB).
