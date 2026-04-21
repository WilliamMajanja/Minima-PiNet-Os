#!/bin/bash
set -e

echo "Installing PiNetOS Desktop Environment..."

# Install dependencies
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv build-essential

# Install Python dependencies
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt

# Configure autostart
mkdir -p ~/.config/autostart
cat <<EOF > ~/.config/autostart/pinetos.desktop
[Desktop Entry]
Type=Application
Exec=/usr/bin/python3 /opt/pinet/desktop/run.py
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=PiNetOS
Comment=Start PiNetOS Desktop
EOF

echo "PiNetOS Desktop installed and configured for autostart."
