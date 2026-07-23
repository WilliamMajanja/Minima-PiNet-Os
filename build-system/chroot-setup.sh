#!/bin/bash
set -e

echo "Running chroot setup..."

MINIMA_VERSION="${MINIMA_VERSION:-1.0.49}"

# Set hostname
echo "pinetos" > /etc/hostname
echo "127.0.0.1 localhost pinetos" >> /etc/hosts

# Configure apt
cat <<EOF > /etc/apt/sources.list
deb http://deb.debian.org/debian bookworm main contrib non-free non-free-firmware
deb http://security.debian.org/debian-security bookworm-security main contrib non-free non-free-firmware
deb http://deb.debian.org/debian bookworm-updates main contrib non-free non-free-firmware
EOF

apt-get update
apt-get install -y locales console-setup
echo "en_US.UTF-8 UTF-8" > /etc/locale.gen
locale-gen
export LC_ALL="en_US.UTF-8"

# Install essential packages
apt-get install -y \
    sudo ssh network-manager curl wget git build-essential \
    xserver-xorg xinit openbox lightdm plymouth plymouth-themes \
    openjdk-17-jre-headless \
    libnss3 libasound2 libatk-bridge2.0-0 libgtk-3-0 libdrm2 libgbm1 \
    linux-image-arm64 linux-headers-arm64 firmware-linux-free firmware-brcm80211 \
    i2c-tools spi-tools python3-smbus

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Create pi user with hardware access groups
useradd -m -s /bin/bash -G sudo,video,audio,plugdev,netdev,gpio,i2c,spi,dialout pi
echo "pi:pinetos" | chpasswd
echo "pi ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers.d/010_pi-nopasswd

# Setup directories
mkdir -p /opt/pinetos/app
mkdir -p /opt/minima
mkdir -p /home/pi/pinet-data
mkdir -p /home/pi/pinet-wallet
mkdir -p /home/pi/.pinet/bin
mkdir -p /home/pi/.pinet/minima-data
mkdir -p /home/pi/.config/openbox
chown -R pi:pi /home/pi/pinet-data /home/pi/pinet-wallet /home/pi/.pinet /home/pi/.config

# Download Minima JAR
echo "Downloading Minima v${MINIMA_VERSION}..."
MINIMA_JAR_URL="https://github.com/minima-global/Minima/releases/download/v${MINIMA_VERSION}/minima.jar"
if command -v wget >/dev/null 2>&1; then
    wget -O /opt/minima/minima.jar "${MINIMA_JAR_URL}" || echo "WARNING: Minima download failed; place JAR manually"
elif command -v curl >/dev/null 2>&1; then
    curl -fsSL -o /opt/minima/minima.jar "${MINIMA_JAR_URL}" || echo "WARNING: Minima download failed; place JAR manually"
fi

if [ -f /opt/minima/minima.jar ]; then
    ln -sf /opt/minima/minima.jar /home/pi/.pinet/bin/minima.jar
    echo "Minima JAR installed to /opt/minima/minima.jar"
else
    echo "WARNING: Minima JAR not downloaded. Place it at /opt/minima/minima.jar"
fi

chown -R pi:pi /home/pi/.pinet /opt/minima

# Copy configs
cp /tmp/config/openbox/autostart /home/pi/.config/openbox/autostart
chown pi:pi /home/pi/.config/openbox/autostart

cp /tmp/config/systemd/*.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable minima.service
systemctl enable pinet-desktop.service
systemctl enable pinet-node-monitor.service
systemctl enable NetworkManager.service
systemctl enable ssh.service

# Enable I2C and SPI kernel modules
echo "i2c-bcm2835" >> /etc/modules
echo "i2c-dev" >> /etc/modules
echo "spi-bcm2835" >> /etc/modules

# Setup Plymouth
mkdir -p /usr/share/plymouth/themes/pinetos
cp /tmp/config/plymouth/pinetos.plymouth /usr/share/plymouth/themes/pinetos/
plymouth-set-default-theme -R pinetos

echo "Chroot setup complete."