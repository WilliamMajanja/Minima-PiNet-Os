# Getting Started

Welcome to Minima PiNet OS! This guide walks you through the fastest path to a running system.

---

## Choose Your Path

| Path | Best For | Time |
|---|---|---|
| **Option 1: Raspberry Pi Image** | Production deployment on real hardware | ~10 min |
| **Option 2: Local Development** | Contributing, testing, app development | ~5 min |
| **Option 3: Spawnable Runtime** | Automated deployment, CI/CD | ~3 min |

---

## Option 1: Raspberry Pi Image (Production)

Flash the pre-built image to your Raspberry Pi 5.

1. Download `PiNetOS-RaspberryPi.img` from [Releases](https://github.com/WilliamMajanja/Minima-PiNet-Os/releases)
2. Flash with [Raspberry Pi Imager](https://www.raspberrypi.com/software/) or `dd`
3. Insert SD card, connect power, and boot
4. Access the dashboard at `http://<pi-ip>:3000`

➡️ Full instructions: [Installation](Installation)

---

## Option 2: Local Development (Any OS)

Run the full PiNet OS desktop and API server on your development machine.

### Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11+ |
| pip | 23+ |
| Java | 17+ (for Minima node) |
| Git | 2.x |

### Steps

```bash
# Clone the repository
git clone https://github.com/WilliamMajanja/Minima-PiNet-Os.git
cd Minima-PiNet-Os

# Install dependencies
pip install --break-system-packages -r requirements.txt

# Start the desktop server
python run.py
```

Open `http://localhost:3000` to see the PiNet OS desktop.

### Available Scripts

| Command | Description |
|---|---|
| `python run.py` | Start the FastAPI desktop server (defaults to port 3000) |
| `python -m compileall run.py backend` | Validate Python sources |
| `npm run release:validate-boot` | Validate Raspberry Pi boot configuration |
| `npm run release:packages` | Generate release ZIP packages |
| `npm run release:img` | Build the flashable Raspberry Pi `.img` |

---

## Option 3: Spawnable Runtime (Automation-Friendly)

Use the `pinet` CLI to overlay the runtime on any existing Linux system.

```bash
# Download and set up
curl -fsSL https://raw.githubusercontent.com/WilliamMajanja/Minima-PiNet-Os/main/bin/pinet -o pinet
chmod +x pinet

# Initialize the runtime
./pinet setup

# Start as a standalone master node
./pinet start --role master

# Check status
./pinet status
```

➡️ Full CLI reference: [CLI Reference](CLI-Reference)

---

## What's Next?

- [Architecture](Architecture) — Understand the system design
- [Desktop Applications](Desktop-Applications) — Explore the 20 built-in apps
- [Cluster Management](Cluster-Management) — Set up multi-node clusters
- [DApp Development](DApp-Development) — Build decentralized applications
- [Hardware Guide](Hardware-Guide) — Connect sensors and peripherals
