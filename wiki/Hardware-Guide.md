# Hardware Guide

PiNet OS includes a Hardware Abstraction Layer (HAL) for interacting with Raspberry Pi 5 peripherals.

---

## GPIO Pinout (40-Pin Header)

The Raspberry Pi 5 uses the BCM2712 SoC. PiNet OS maps GPIO pins using BCM numbering:

| Pin | BCM | Function | Alt Functions |
|---|---|---|---|
| 1 | — | 3.3V Power | — |
| 2 | — | 5V Power | — |
| 3 | GPIO 2 | I2C1 SDA | SDA1 |
| 4 | — | 5V Power | — |
| 5 | GPIO 3 | I2C1 SCL | SCL1 |
| 6 | — | Ground | — |
| 7 | GPIO 4 | GPCLK0 | 1-Wire |
| 8 | GPIO 14 | UART TX | TXD0 |
| 9 | — | Ground | — |
| 10 | GPIO 15 | UART RX | RXD0 |
| 11 | GPIO 17 | Digital I/O | SPI1 CE1 |
| 12 | GPIO 18 | PCM CLK | PWM0 |
| 13 | GPIO 27 | Digital I/O | — |
| 14 | — | Ground | — |
| 15 | GPIO 22 | Digital I/O | — |
| 16 | GPIO 23 | Digital I/O | — |
| 17 | — | 3.3V Power | — |
| 18 | GPIO 24 | Digital I/O | — |
| 19 | GPIO 10 | SPI0 MOSI | — |
| 20 | — | Ground | — |
| 21 | GPIO 9 | SPI0 MISO | — |
| 22 | GPIO 25 | Digital I/O | — |
| 23 | GPIO 11 | SPI0 SCLK | — |
| 24 | GPIO 8 | SPI0 CE0 | — |
| 25 | — | Ground | — |
| 26 | GPIO 7 | SPI0 CE1 | — |
| 27 | GPIO 0 | I2C0 SDA | ID_SD (EEPROM) |
| 28 | GPIO 1 | I2C0 SCL | ID_SC (EEPROM) |
| 29 | GPIO 5 | Digital I/O | — |
| 30 | — | Ground | — |
| 31 | GPIO 6 | Digital I/O | — |
| 32 | GPIO 12 | PWM0 | — |
| 33 | GPIO 13 | PWM1 | — |
| 34 | — | Ground | — |
| 35 | GPIO 19 | PCM FS | PWM1 / SPI1 MISO |
| 36 | GPIO 16 | Digital I/O | SPI1 CE2 |
| 37 | GPIO 26 | Digital I/O | — |
| 38 | GPIO 20 | PCM DIN | SPI1 MOSI |
| 39 | — | Ground | — |
| 40 | GPIO 21 | PCM DOUT | SPI1 SCLK |

---

## Protocol Mapping

| Protocol | Pins | Speed | Use Case |
|---|---|---|---|
| **UART** | GPIO 14 (TX), GPIO 15 (RX) | 115200 baud | Serial console, GPS modules |
| **I2C0** | GPIO 0 (SDA), GPIO 1 (SCL) | 100–400 kHz | HAT EEPROM identification |
| **I2C1** | GPIO 2 (SDA), GPIO 3 (SCL) | 100–400 kHz | Sensors, displays, ADCs |
| **SPI0** | GPIO 10 (MOSI), 9 (MISO), 11 (SCLK), 8/7 (CE0/CE1) | Up to 125 MHz | High-speed peripherals |
| **SPI1** | GPIO 20 (MOSI), 19 (MISO), 21 (SCLK) | Up to 125 MHz | Secondary SPI bus |
| **PWM** | GPIO 12 (PWM0), GPIO 13 (PWM1), GPIO 18, GPIO 19 | Variable | Motors, LEDs, servos |
| **1-Wire** | GPIO 4 | — | Temperature sensors (DS18B20) |

---

## HAL TypeScript API

The HAL is initialized as a singleton:

```typescript
import { hal } from './hal';

await hal.init();    // Initialize all subsystems
await hal.shutdown(); // Graceful cleanup
```

### GPIO

```typescript
import { hal } from './hal';

// Configure a pin as output
hal.gpio.setup(17, 'out');
hal.gpio.write(17, 1);     // Set HIGH
hal.gpio.write(17, 0);     // Set LOW

// Configure a pin as input with pull-up
hal.gpio.setup(22, 'in', 'up');
const value = hal.gpio.read(22);  // 0 or 1

// Edge detection
hal.gpio.onEdge(22, 'rising', (pin, value) => {
  console.log(`Pin ${pin} went HIGH`);
});

// Cleanup
hal.gpio.unexport(17);
```

### I2C

```typescript
// Scan for devices on I2C1
const devices = await hal.i2c.scan(1);  // e.g., [0x48, 0x68, 0x76]

// Read from a device
const data = await hal.i2c.read(1, 0x48, 2);  // bus 1, addr 0x48, 2 bytes

// Write to a device
await hal.i2c.write(1, 0x48, Buffer.from([0x01, 0xFF]));
```

### SPI

```typescript
// Configure SPI device
const config = { bus: 0, device: 0, speed: 1000000, mode: 0 };

// Transfer data (simultaneous read/write)
const response = await hal.spi.transfer(config, Buffer.from([0x01, 0x80, 0x00]));
```

### Thermal

```typescript
// Get CPU temperature
const temp = hal.thermal.getCpuTemp();  // e.g., 54.2 (°C)

// Get power metrics
const power = hal.thermal.getPowerMetrics();
// { voltage: 5.1, current: 2.3, throttled: false }

// Check system health
const health = hal.thermal.getHealth();
// { temp: 54.2, throttled: false, underVoltage: false }
```

### Storage

```typescript
// List block devices
const devices = await hal.storage.listDevices();
// [{ name: "mmcblk0", size: "32G", type: "disk" }, { name: "nvme0n1", ... }]

// Get disk usage
const usage = await hal.storage.getDiskUsage();
// [{ mount: "/", total: "32G", used: "8.2G", available: "22G", percent: 27 }]

// Get mount points
const mounts = await hal.storage.getMounts();
```

---

## PCIe / NVMe

The Raspberry Pi 5 has a PCIe 2.0 x1 lane (can be overclocked to Gen 3):

### Enable PCIe Gen 3

Add to `/boot/config.txt`:
```
dtparam=pciex1
dtparam=pciex1_gen=3
```

### NVMe Boot

1. Flash PiNet OS to NVMe SSD via USB adapter
2. Update EEPROM boot order:
   ```bash
   sudo rpi-eeprom-config --edit
   # Set: BOOT_ORDER=0xf416  (NVMe → USB → SD → Network)
   ```
3. Reboot with NVMe installed in M.2 HAT

### Verify NVMe

```bash
lsblk | grep nvme
# nvme0n1     259:0    0 476.9G  0 disk

sudo nvme list
# /dev/nvme0n1  Samsung 970 EVO Plus  476.94 GB
```

---

## Supported HATs & Peripherals

| Peripheral | Interface | HAL Support |
|---|---|---|
| **Hailo-8L AI NPU** | PCIe M.2 | Full — 13 TOPS inference |
| **NVMe SSD** | PCIe M.2 | Full — Gen 3 x1 |
| **Sense HAT** | I2C + GPIO | Sensors: gyro, accel, mag, temp, humidity, pressure |
| **Camera Module 3** | CSI (MIPI) | libcamera integration |
| **Official 7" Touchscreen** | DSI | Multitouch input |
| **PoE+ HAT** | GPIO + I2C | Power over Ethernet, fan control |
| **RTC HAT** | I2C (0x68) | Real-time clock (DS3231) |
| **GPS Module** | UART (GPIO 14/15) | NMEA parsing, PPS |
| **ADC (ADS1115)** | I2C (0x48) | 16-bit 4-channel analog input |
| **OLED Display (SSD1306)** | I2C (0x3C) | 128×64 pixel monochrome |
| **Relay Board** | GPIO | Up to 8-channel relay switching |
| **4G/LTE Modem** | USB + UART | Cellular connectivity with SMS fallback |

---

## Serial Console

For headless debugging, connect via UART:

### Wiring

| Pi Pin | UART Adapter |
|---|---|
| GPIO 14 (Pin 8) — TX | RX |
| GPIO 15 (Pin 10) — RX | TX |
| GND (Pin 6) | GND |

> ⚠️ Do **not** connect 5V — use the USB-C power supply.

### Enable UART

Already enabled in PiNet OS default `config.txt`:
```
enable_uart=1
dtoverlay=uart0
```

### Connect

```bash
# Linux / macOS
screen /dev/ttyUSB0 115200

# Or with minicom
minicom -b 115200 -D /dev/ttyUSB0
```

---

## Boot Configuration

Key settings in `/boot/config.txt` for PiNet OS:

```ini
# GPU memory allocation
gpu_mem=256

# CPU overclocking (Pi 5)
arm_freq=2600
over_voltage=4

# Display
hdmi_group=2
hdmi_mode=82    # 1920x1080 @ 60Hz

# I2C high-speed
dtparam=i2c_arm=on
dtparam=i2c_arm_baudrate=400000

# SPI
dtparam=spi=on

# PCIe Gen 3
dtparam=pciex1
dtparam=pciex1_gen=3

# USB boot
program_usb_boot_mode=1
```

---

## See Also

- [AI and Edge Computing](AI-and-Edge-Computing) — Hailo NPU and AI runtimes
- [Architecture](Architecture) — System design
- [Troubleshooting](Troubleshooting) — Hardware debugging
