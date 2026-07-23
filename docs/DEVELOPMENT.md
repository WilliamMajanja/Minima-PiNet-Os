# PiNetOS Development Guide

## Overview

This guide explains how to develop for PiNetOS — adding custom drivers, building services, extending the Python backend, and creating MiniDAPPs.

---

## Development Environment Setup

### Option A: Native Development on Pi 5

```bash
# 1. SSH into your Pi 5
ssh pinet@<pi-ip>

# 2. Clone the repository
git clone https://github.com/WilliamMajanja/Minima-PiNet-Os.git
cd Minima-PiNet-Os

# 3. Install Python dependencies
pip install --break-system-packages -r requirements.txt

# 4. Start the desktop server
python run.py
# → http://<pi-ip>:3000
```

### Option B: Cross-Development on x86_64 Linux/macOS

```bash
# 1. Clone repository
git clone https://github.com/WilliamMajanja/Minima-PiNet-Os.git
cd Minima-PiNet-Os

# 2. Install Python dependencies
pip install --break-system-packages -r requirements.txt

# 3. Start the desktop server
python run.py
# → http://localhost:3000

# Hardware-backed routes auto-detect missing peripherals and degrade gracefully.
```

### Option C: Docker Development Container

```bash
docker run --rm -it \
  -v "$(pwd)":/workspace \
  -p 3000:3000 \
  -w /workspace \
  python:3.11-bookworm \
  bash -c "pip install --break-system-packages -r requirements.txt && python run.py"
```

---

## Project Structure

```
Minima-PiNet-Os/
├── run.py                     # FastAPI/Jinja desktop entrypoint
├── backend/                   # FastAPI application
│   ├── main.py                # ASGI app; mounts routes and static
│   ├── config.py              # Defaults, version, environment binding
│   ├── models.py              # Pydantic models (DApp, Cluster, …)
│   ├── state.py               # In-memory app state
│   ├── minima_client.py       # Async Minima RPC client (httpx)
│   ├── rate_limiter.py        # Per-IP rate limiting
│   ├── routes/                # REST endpoints (cluster, kernel, network, dapps, …)
│   ├── services/              # Backend service helpers
│   └── websocket/             # WebSocket handlers (terminal, cluster)
├── frontend/                  # Server-rendered desktop
│   ├── templates/             # base.html, desktop.html (Jinja2)
│   └── static/                # css/, js/ (window manager, terminal, app shell)
├── kernel/                    # Linux kernel build inputs
│   ├── rpi5-bcm2712.config    # ARM64 kernel config fragment
│   ├── bcm2712-rpi5.dts       # Device tree source
│   └── build-kernel.sh        # Kernel build script
├── boot/                      # Boot configuration
│   ├── config.txt             # RPi firmware config
│   ├── cmdline.txt            # Kernel command line
│   └── uboot/                 # U-Boot configuration
├── system/                    # OS system configuration
│   ├── services/              # systemd service units
│   ├── networking/            # Network configuration
│   ├── ota/                   # OTA update framework
│   └── package-manager/       # pinet-pkg tool
├── build-system/              # Build infrastructure
├── tools/                     # Build and flash utilities
│   ├── build-rpi5.sh          # Full OS build script
│   └── flash.sh               # Image flashing utility
├── tests/                     # Test suites
│   └── system/run-tests.sh    # System integration tests
└── docs/                      # Documentation
```

---

## Adding a Hardware Driver

### 1. Kernel Module (C)

Create your driver in `kernel/drivers/my-driver/`:

```c
// kernel/drivers/my-sensor/my-sensor.c
#include <linux/module.h>
#include <linux/i2c.h>

static int my_sensor_probe(struct i2c_client *client) {
    dev_info(&client->dev, "my-sensor: probed at 0x%02x\n", client->addr);
    return 0;
}

static const struct of_device_id my_sensor_of_match[] = {
    { .compatible = "vendor,my-sensor" },
    { }
};
MODULE_DEVICE_TABLE(of, my_sensor_of_match);

static struct i2c_driver my_sensor_driver = {
    .driver = {
        .name = "my-sensor",
        .of_match_table = my_sensor_of_match,
    },
    .probe = my_sensor_probe,
};
module_i2c_driver(my_sensor_driver);

MODULE_LICENSE("GPL");
MODULE_DESCRIPTION("PiNetOS my-sensor driver");
```

Add a DTS overlay in `kernel/overlays/my-sensor-overlay.dts`:

```dts
/dts-v1/;
/plugin/;

/ {
    compatible = "brcm,bcm2712";

    fragment@0 {
        target = <&i2c1>;
        __overlay__ {
            my_sensor: my-sensor@48 {
                compatible = "vendor,my-sensor";
                reg = <0x48>;
                status = "okay";
            };
        };
    };
};
```

### 2. Python Driver Module

Add a small async module under `backend/services/`:

```python
# backend/services/my_sensor.py
from pathlib import Path

SENSOR_PATH = Path("/sys/bus/i2c/devices/1-0048/in0_input")

async def read_value() -> float | None:
    """Return the latest sensor reading in engineering units, or None if unavailable."""
    try:
        raw = SENSOR_PATH.read_text().strip()
    except FileNotFoundError:
        return None
    return int(raw) * 0.0625
```

### 3. Expose it via a FastAPI Route

Wire the driver into a route under `backend/routes/`:

```python
# backend/routes/my_sensor.py
from fastapi import APIRouter, HTTPException
from backend.services.my_sensor import read_value

router = APIRouter(prefix="/api/sensors", tags=["sensors"])

@router.get("/my-sensor")
async def get_my_sensor():
    value = await read_value()
    if value is None:
        raise HTTPException(503, "sensor unavailable")
    return {"value": value, "unit": "°C"}
```

Register the router in `backend/main.py` next to the other routers.

### 4. Render it in the Desktop UI

Add a card or app to the Jinja desktop and poll the new endpoint via `frontend/static/js/api.js`:

```js
// frontend/static/js/app.js (excerpt)
setInterval(async () => {
  const data = await PiNetAPI.get('/api/sensors/my-sensor');
  document.getElementById('my-sensor-value').textContent =
    data?.value?.toFixed(2) ?? '—';
}, 1000);
```

---

## Creating a systemd Service

```ini
# system/services/my-service.service
[Unit]
Description=My PiNetOS Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/pinetos/services/my_service.py
Restart=on-failure
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

Install and enable:
```bash
sudo cp system/services/my-service.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now my-service
```

---

## Building the Full OS Image

```bash
# Full build (requires aarch64 cross-compiler and debootstrap)
sudo ./tools/build-rpi5.sh

# Skip kernel compilation (use prebuilt)
sudo ./tools/build-rpi5.sh --no-kernel

# Custom output location
sudo ./tools/build-rpi5.sh --output=/mnt/fast-ssd

# Clean build
sudo ./tools/build-rpi5.sh --clean
```

---

## Running Tests

```bash
# Validate Python modules
python -m compileall run.py backend

# Validate boot configuration
npm run release:validate-boot

# Run all system tests
bash tests/system/run-tests.sh --suite all

# Run specific suite
bash tests/system/run-tests.sh --suite networking
bash tests/system/run-tests.sh --suite security

# CPIP security provider tests (FIPS self-tests, crypto KATs)
python3 -c "from backend.cpip_provider import run_fips_self_tests; print('CPIP FIPS:', 'PASS' if run_fips_self_tests() else 'SKIP')"

# Verbose output
bash tests/system/run-tests.sh --suite all --verbose
```

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-sensor-driver`
3. Write code following the patterns above.
4. Run the test suite: `bash tests/system/run-tests.sh`
5. Commit: `git commit -m 'feat: add my-sensor driver'`
6. Open a Pull Request.

### Code Style

- Python: type hints, async-first I/O, follow the patterns in `backend/`
- Shell scripts: `set -euo pipefail`, functions with clear names, coloured output
- Commit messages: [Conventional Commits](https://www.conventionalcommits.org/) format (`feat:`, `fix:`, `docs:`, `chore:`)

---

## Performance Profiling

```bash
# CPU profiling (cProfile)
python -m cProfile -o /tmp/pinet.prof run.py
python -m pstats /tmp/pinet.prof

# Memory profiling
pip install memray
memray run --output /tmp/pinet.bin run.py
memray flamegraph /tmp/pinet.bin

# GPU/VideoCore metrics
vcgencmd get_mem arm
vcgencmd get_mem gpu
```

---

## OTA Release Pipeline

To publish a new PiNetOS version:

1. Tag the release: `git tag v1.2.3`
2. GitHub Actions builds and publishes the update manifest and payload.
3. Devices running `pinet-ota.timer` will pick up the update within 24 hours.
4. Manual trigger: `sudo systemctl start pinet-ota.service`
