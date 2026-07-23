# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Zedd Weather — multi-stage Dockerfile supporting all Raspberry Pi models
# and compatible platforms.
#
# Supported platforms:
#   - Pi 5 (BCM2712 / ARM64)
#   - Pi 4 (BCM2711 / ARM64)
#   - Pi 3 (BCM2837 / ARM64)
#   - Pi 2 (BCM2836 / ARM32) — use linux/arm/v7
#   - Pi 1 / Zero / Zero W (BCM2835 / ARM32) — use linux/arm/v6
#   - Compute Module 3/4
#   - Generic x86_64 for CI/testing (no Sense HAT, simulated data)
#
# Build:
#   docker buildx build --platform linux/arm64 -t zedd-weather:latest .
#   docker buildx build --platform linux/arm/v7 -t zedd-weather:armv7 .
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build / dependency resolution ───────────────────────────────────
FROM --platform=$BUILDPLATFORM python:3.11-slim-bookworm AS builder

ARG TARGETPLATFORM
ARG BUILDPLATFORM

WORKDIR /build

# Install build tools required by native Python packages.
# sense-hat uses RPi.GPIO which needs gcc/linux-headers at wheel-build time
# on ARM; on x86_64 the stub is used instead.
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
        gcc \
        python3-dev \
        libffi-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip wheel --no-cache-dir --wheel-dir /build/wheels -r requirements.txt


# ── Stage 2: minimal runtime image ───────────────────────────────────────────
FROM --platform=$BUILDPLATFORM python:3.11-slim-bookworm AS runtime

LABEL org.opencontainers.image.title="Zedd Weather Edge Sensor"
LABEL org.opencontainers.image.description="Reads Sense HAT telemetry and pushes to InfluxDB v2. Supports all Raspberry Pi models."
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/WilliamMajanja/Minima-PiNet-Os"

# Non-root user for security
RUN useradd --create-home --shell /bin/false --uid 1001 sensor

WORKDIR /app

# Install pre-built wheels from Stage 1 — no compiler needed at runtime
COPY --from=builder /build/wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels /wheels/*.whl && \
    rm -rf /wheels

COPY app.py .

# Run as non-root; I2C device access is granted via the K8s securityContext
# supplementalGroups (group 998 = i2c on Pi OS Bookworm, group 108 on some distros).
USER sensor

ENV PYTHONUNBUFFERED=1

CMD ["python", "-u", "app.py"]