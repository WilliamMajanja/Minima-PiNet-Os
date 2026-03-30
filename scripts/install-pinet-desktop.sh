#!/bin/bash
set -e

echo "Installing PiNetOS Desktop Environment..."

# Install dependencies
sudo apt-get update
sudo apt-get install -y nodejs npm build-essential

# Build Electron app
npm install
npm run build
npm run electron:build

# Configure autostart
mkdir -p ~/.config/autostart
cat <<EOF > ~/.config/autostart/pinetos.desktop
[Desktop Entry]
Type=Application
Exec=/opt/PiNetOS/PiNetOS-Desktop.AppImage --no-sandbox
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=PiNetOS
Comment=Start PiNetOS Desktop
EOF

echo "PiNetOS Desktop installed and configured for autostart."
