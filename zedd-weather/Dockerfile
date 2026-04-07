# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Zedd Weather — multi-stage Dockerfile for arm64 (Raspberry Pi 5 / Pi OS
# Bookworm).  Build on an arm64 host or with `docker buildx build
# --platform linux/arm64`.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build / dependency resolution ───────────────────────────────────
FROM --platform=linux/arm64 python:3.11-slim-bookworm AS builder

WORKDIR /build

# Install build tools required by some native Python packages (sense-hat uses
# RPi.GPIO which needs gcc/linux-headers at wheel-build time).
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
        gcc \
        python3-dev \
        libffi-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Build wheels into a local directory so the runtime stage can install them
# without requiring build tools.
RUN pip install --no-cache-dir --upgrade pip && \
    pip wheel --no-cache-dir --wheel-dir /build/wheels -r requirements.txt


# ── Stage 2: minimal runtime image ───────────────────────────────────────────
FROM --platform=linux/arm64 python:3.11-slim-bookworm AS runtime

LABEL org.opencontainers.image.title="Zedd Weather Edge Sensor"
LABEL org.opencontainers.image.description="Reads Sense HAT telemetry and pushes to InfluxDB v2"
LABEL org.opencontainers.image.licenses="MIT"

# Non-root user for security
RUN useradd --create-home --shell /bin/false --uid 1001 sensor

WORKDIR /app

# Install pre-built wheels from Stage 1 — no compiler needed at runtime
COPY --from=builder /build/wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels /wheels/*.whl && \
    rm -rf /wheels

COPY app.py .

# Run as non-root; I2C device access is granted via the K8s securityContext
# supplementalGroups (group 998 = i2c on Pi OS Bookworm).
USER sensor

ENV PYTHONUNBUFFERED=1

CMD ["python", "-u", "app.py"]
