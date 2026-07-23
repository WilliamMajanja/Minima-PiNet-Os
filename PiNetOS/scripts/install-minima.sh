#!/bin/bash
set -e
MINIMA_VERSION="${MINIMA_VERSION:-1.0.49-cpip}"
MINIMA_JAR_URL="https://github.com/WilliamMajanja/Minima-private/releases/download/v1.0.49/minima-v1.0.49-cpip.jar"
MINIMA_JAR_FALLBACK_URL="https://github.com/WilliamMajanja/minima-core/releases/download/v1.0.49/minima-v1.0.49-cpip.jar"
echo "Installing Minima v${MINIMA_VERSION}..."
mkdir -p /opt/minima
mkdir -p /home/pi/.pinet/bin
mkdir -p /home/pi/.pinet/minima-data

if command -v wget >/dev/null 2>&1; then
    wget -O /opt/minima/minima.jar "${MINIMA_JAR_URL}" || wget -O /opt/minima/minima.jar "${MINIMA_JAR_FALLBACK_URL}"
elif command -v curl >/dev/null 2>&1; then
    curl -fsSL -o /opt/minima/minima.jar "${MINIMA_JAR_URL}" || curl -fsSL -o /opt/minima/minima.jar "${MINIMA_JAR_FALLBACK_URL}"
else
    echo "ERROR: Neither wget nor curl found. Cannot download Minima."
    exit 1
fi

ln -sf /opt/minima/minima.jar /home/pi/.pinet/bin/minima.jar
chown -R pi:pi /home/pi/.pinet

cp services/minima.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable minima
echo "Minima v${MINIMA_VERSION} installed."