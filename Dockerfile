FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN pip install --no-cache-dir flask flask-cors requests yt-dlp curl_cffi gunicorn
COPY backend.py airplay.py sonos.py mediaserver.py index.html app.js offline.js settings.js \
     style.css offline.css settings.css sw.js manifest.webmanifest logo.svg ./
COPY icons ./icons
ENV STREAMIFY_HOST=0.0.0.0 STREAMIFY_PORT=5000 STREAMIFY_PROXY=1 STREAMIFY_DATA=/data
VOLUME ["/data", "/app/cache"]
EXPOSE 5000
# one process: caches and the Sonos/AirPlay state live in memory; threads handle concurrency
CMD ["gunicorn", "-b", "0.0.0.0:5000", "-w", "1", "--threads", "16", "--timeout", "180", "backend:app"]
