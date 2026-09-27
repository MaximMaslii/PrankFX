# PrankFX backend — production image
# Build context: the backend/ folder (on Railway: Root Directory = backend)

FROM python:3.11-slim

# ffmpeg + ffprobe are required for Snap clips (/api/snap/jobs answers 503 without them)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    # Finished clips live on a persistent volume mounted at /data.
    # Without a volume they are lost on every redeploy/restart.
    SNAP_MEDIA_DIR=/data/snaps

WORKDIR /app

COPY requirements-prod.txt .
RUN pip install -r requirements-prod.txt

COPY . .

RUN mkdir -p /data/snaps

EXPOSE 8000

# Railway (and most hosts) pass the port in $PORT. One worker on purpose:
# Snap jobs run inside the process, several workers would not share them.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
