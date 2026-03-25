#!/bin/bash

echo "Installing PiNetOS v2 on Raspberry Pi..."

# Update system
sudo apt-update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Raspberry Pi Connect
sudo apt install -y rpi-connect
systemctl --user enable rpi-connect
systemctl --user start rpi-connect

# Install IPFS
wget https://dist.ipfs.tech/kubo/v0.28.0/kubo_v0.28.0_linux-arm64.tar.gz
tar -xvzf kubo_v0.28.0_linux-arm64.tar.gz
cd kubo
sudo bash install.sh
ipfs init

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Download PiNetOS binary
echo "Downloading PiNetOS binary..."
# wget https://github.com/pinetos/pinetos-v2/releases/latest/download/pinet-linux-arm64
# chmod +x pinet-linux-arm64
# sudo mv pinet-linux-arm64 /usr/local/bin/pinet

echo "Installation complete! Run 'pinet cluster init' to start."
