# PiNetOS Deployment Guide

## Spawnable Runtime (Recommended)

PiNet-OS runs as a contained environment on **any existing Linux distro** on Raspberry Pi 5.
No dedicated image flashing required.

### Prerequisites

- Raspberry Pi 5 (4GB+ RAM recommended)
- Any Linux distro (Raspberry Pi OS, Ubuntu, Debian, etc.)
- Internet access for initial setup

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/WilliamMajanja/Minima-PiNet-Os.git
cd Minima-PiNet-Os

# 2. Run the setup script (installs Java, Python, downloads Minima)
bin/pinet setup

# 3. Start PiNet-OS
bin/pinet start --role master    # For the first node (master)
# OR
bin/pinet start --role worker --master <address>  # For worker nodes
```

### What Setup Does

1. Checks and installs **Java 17+** (for the Minima node)
2. Checks and installs **Python 3.11+** (for the FastAPI/Jinja web desktop)
3. Downloads the **Minima JAR** to `~/.pinet/bin/minima.jar`
4. Installs the Python desktop's `requirements.txt`
5. Generates node identity and initial configuration

### Runtime Directory

After setup, the PiNet-OS runtime lives at `~/.pinet/`:

```
~/.pinet/
├── config.json          # Node config (role, ports, master address)
├── pinet.pid            # Master PID file
├── bin/minima.jar       # Minima blockchain node
├── minima-data/         # Blockchain data
├── logs/                # Service logs
├── state/
│   ├── cluster.json     # Cluster state cache
│   └── identity.json    # Node identity
└── modules/             # Plugin modules
```

### Managing the Runtime

```bash
pinet status             # Show runtime status
pinet stop               # Stop all services
pinet logs --follow      # Tail service logs
pinet shell              # Attach to PiNet-OS session
pinet cluster            # Show cluster topology
pinet open               # List available apps
```

### Accessing the Desktop

Open a browser and navigate to:
```
http://<pi-ip>:3000
```

## Image-Based Installation (Legacy)

For a dedicated installation using a pre-built image:

1. Download the `PiNetOS.img` file from the releases page
2. Flash to MicroSD:
   ```bash
   sudo dd if=PiNetOS.img of=/dev/sdX bs=4M status=progress
   ```
3. Boot the Pi and access via SSH:
   ```bash
   ssh pi@<pi-ip>
   ```
   Default password: `pinet` (change immediately)

## Systemd Services (Production)

For production deployments, install the systemd services:

```bash
sudo cp PiNetOS/services/minima.service /etc/systemd/system/
sudo cp PiNetOS/services/pinet-cluster-manager.service /etc/systemd/system/
sudo cp PiNetOS/services/pinet-desktop.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now minima pinet-cluster-manager pinet-desktop
```

## Port Reference

| Port | Service | Description |
|------|---------|-------------|
| 3000 | Web Desktop | Browser-based control plane |
| 9001 | Minima P2P | Blockchain peer-to-peer |
| 9005 | Minima RPC | Blockchain node API |
| 4180 | CPIP Security | ITF Defense + crypto API |
| 9090 | Cluster API | Go cluster manager API |
