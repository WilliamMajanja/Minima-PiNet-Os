# PiNetOS Development Guide

## Overview

This guide explains how to develop for PiNetOS — adding custom drivers, building services, extending the HAL, and creating MiniDAPPs.

---

## Development Environment Setup

### Option A: Native Development on Pi 5

```bash
# 1. SSH into your Pi 5
ssh pinet@<pi-ip>

# 2. Clone the repository
git clone https://github.com/WilliamMajanja/Minima-PiNet-Os.git
cd Minima-PiNet-Os

# 3. Install dependencies
npm install

# 4. Start development server
npm run dev
# → http://<pi-ip>:3000
```

### Option B: Cross-Development on x86_64 Linux/macOS

```bash
# 1. Clone repository
git clone https://github.com/WilliamMajanja/Minima-PiNet-Os.git
cd Minima-PiNet-Os

# 2. Install Node.js dependencies
npm install

# 3. Start development server (simulated hardware)
npm run dev
# → http://localhost:3000

# 4. HAL automatically detects missing hardware and runs in simulation mode
```

### Option C: Docker Development Container

```bash
docker run --rm -it \
  -v "$(pwd)":/workspace \
  -p 3000:3000 \
  -w /workspace \
  node:20-bookworm \
  bash -c "npm install && npm run dev"
```

---

## Project Structure

```
Minima-PiNet-Os/
├── App.tsx                    # Main React application entry point
├── components/                # React UI components
│   ├── apps/                  # App windows (Terminal, SystemMonitor, etc.)
│   ├── Desktop.tsx
│   ├── Taskbar.tsx
│   └── TopBar.tsx
├── services/                  # TypeScript backend services
│   ├── minimaService.ts       # Minima blockchain node interface
│   ├── systemService.ts       # System information service
│   ├── shellService.ts        # Terminal shell service
│   └── settingsService.ts     # Settings persistence
├── hal/                       # Hardware Abstraction Layer
│   ├── index.ts               # HAL entry point (exports `hal` singleton)
│   ├── gpio.ts                # GPIO controller
│   ├── i2c.ts                 # I2C controller
│   ├── spi.ts                 # SPI controller
│   ├── thermal.ts             # Thermal/power monitor
│   └── storage.ts             # Storage manager
├── kernel/                    # Linux kernel configuration
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

### 2. HAL TypeScript Layer

Extend the HAL with a new sensor class in `hal/`:

```typescript
// hal/my-sensor.ts
import { I2cController } from './i2c';

const SENSOR_ADDR = 0x48;
const REG_DATA    = 0x00;

export class MySensor {
    private i2c: I2cController;
    private device = { bus: 1, address: SENSOR_ADDR };

    constructor(i2c: I2cController) {
        this.i2c = i2c;
    }

    async init(): Promise<void> {
        // Configure sensor here
    }

    async readValue(): Promise<number> {
        const raw = await this.i2c.readWord(this.device, REG_DATA);
        return raw * 0.0625;  // Convert to engineering units
    }

    async shutdown(): Promise<void> {}
}
```

Register it in `hal/index.ts`:

```typescript
import { MySensor } from './my-sensor';
// Add to HAL class:
public mySensor: MySensor;
constructor() {
    this.mySensor = new MySensor(this.i2c);
}
async init() {
    await this.mySensor.init();
    // ...
}
```

### 3. React UI Component

Display sensor data in the dashboard:

```tsx
// components/apps/MySensorApp.tsx
import React, { useEffect, useState } from 'react';
import { hal } from '../../hal';

const MySensorApp: React.FC = () => {
    const [value, setValue] = useState<number | null>(null);

    useEffect(() => {
        const poll = setInterval(async () => {
            const v = await hal.mySensor.readValue();
            setValue(v);
        }, 1000);
        return () => clearInterval(poll);
    }, []);

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold">My Sensor</h2>
            <p className="text-3xl mt-4">{value?.toFixed(2) ?? '—'}</p>
        </div>
    );
};

export default MySensorApp;
```

---

## Creating a systemd Service

```ini
# system/services/my-service.service
[Unit]
Description=My PiNetOS Service
After=pinet-hal.service
Wants=pinet-hal.service

[Service]
Type=simple
ExecStart=/usr/bin/node /opt/pinetos/services/my-service.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

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
# Run all system tests
bash tests/system/run-tests.sh --suite all

# Run specific suite
bash tests/system/run-tests.sh --suite hal
bash tests/system/run-tests.sh --suite networking
bash tests/system/run-tests.sh --suite security

# Verbose output
bash tests/system/run-tests.sh --suite all --verbose
```

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-sensor-driver`
3. Write code following the patterns above.
4. Run the test suite: `bash tests/system/run-tests.sh`
5. Commit: `git commit -m 'feat: add my-sensor HAL driver'`
6. Open a Pull Request.

### Code Style

- TypeScript: follow existing patterns in `hal/` and `services/`
- Shell scripts: `set -euo pipefail`, functions with clear names, coloured output
- Commit messages: [Conventional Commits](https://www.conventionalcommits.org/) format (`feat:`, `fix:`, `docs:`, `chore:`)

---

## Performance Profiling

```bash
# CPU profiling
perf record -g node /opt/pinetos/server.js &
sleep 30; kill %1
perf report

# Memory profiling
node --heap-prof /opt/pinetos/server.js

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
