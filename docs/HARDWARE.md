# PiNetOS Hardware Guide — Raspberry Pi 5

## GPIO Pinout (BCM2712 / 40-pin Header)

The Raspberry Pi 5 retains the standard 40-pin GPIO header compatible with all Pi HATs.

```
 3V3  (1) (2)  5V
 GPIO2  (3) (4)  5V
 GPIO3  (5) (6)  GND
 GPIO4  (7) (8)  GPIO14 (TXD)
 GND  (9) (10) GPIO15 (RXD)
GPIO17 (11) (12) GPIO18 (PWM0)
GPIO27 (13) (14) GND
GPIO22 (15) (16) GPIO23
 3V3 (17) (18) GPIO24
GPIO10 (19) (20) GND
 GPIO9 (21) (22) GPIO25
GPIO11 (23) (24) GPIO8 (CE0)
 GND (25) (26) GPIO7 (CE1)
 GPIO0 (27) (28) GPIO1
 GPIO5 (29) (30) GND
 GPIO6 (31) (32) GPIO12 (PWM0)
GPIO13 (33) (34) GND
GPIO19 (35) (36) GPIO16
GPIO26 (37) (38) GPIO20
 GND (39) (40) GPIO21
```

### Protocol Mapping

| Interface | GPIO Pins | Function |
|---|---|---|
| UART0 (Console) | GPIO14 (TX), GPIO15 (RX) | Serial console @ 115200 |
| I2C1 (Primary) | GPIO2 (SDA), GPIO3 (SCL) | 400 kHz by default |
| SPI0 | GPIO10 (MOSI), GPIO9 (MISO), GPIO11 (CLK), GPIO8 (CE0), GPIO7 (CE1) | |
| PWM0 | GPIO18 or GPIO12 | Hardware PWM |
| 1-Wire | GPIO4 (default) | Temperature sensors |

---

## I2C Usage with PiNetOS HAL

Enable I2C in `/boot/config.txt` (already done in PiNetOS):
```
dtparam=i2c_arm=on
dtparam=i2c_arm_baudrate=400000
```

### TypeScript API

```typescript
import { hal } from '/opt/pinetos/hal';

// Scan for devices on I2C bus 1
const result = await hal.i2c.scan(1);
console.log('Found devices:', result.addresses.map(a => '0x' + a.toString(16)));

// Read a byte from register 0x00 of device at 0x48 (e.g., ADS1115 ADC)
const value = await hal.i2c.readByte({ bus: 1, address: 0x48 }, 0x00);

// Write to a device (e.g., MCP23017 I/O expander)
await hal.i2c.writeByte({ bus: 1, address: 0x20 }, 0x00, 0xFF);  // Set IODIRA all inputs
```

### Shell (i2c-tools)

```bash
# Scan bus 1
i2cdetect -y 1

# Read register 0x00 from device 0x48
i2cget -y 1 0x48 0x00

# Write to register 0x01
i2cset -y 1 0x20 0x01 0xFF
```

---

## SPI Usage

```typescript
import { hal } from '/opt/pinetos/hal';

// Read MCP3008 ADC channel 0 (0-1023)
const adcValue = await hal.spi.mcp3008Read(0, { bus: 0, cs: 0 });
const voltage = (adcValue / 1023) * 3.3;
console.log(`Channel 0: ${voltage.toFixed(3)} V`);

// Raw transfer
const rx = await hal.spi.transfer(
    Buffer.from([0x01, 0x80, 0x00]),
    { bus: 0, cs: 0, maxSpeedHz: 1_000_000 }
);
```

---

## GPIO Usage

```typescript
import { hal } from '/opt/pinetos/hal';

// Configure GPIO 18 as output, write HIGH
await hal.gpio.export(18, { direction: 'out' });
await hal.gpio.write(18, true);   // HIGH
await hal.gpio.write(18, false);  // LOW

// Read GPIO 4 (input with pull-up via dtoverlay)
await hal.gpio.export(4, { direction: 'in', pull: 'up' });
const value = await hal.gpio.read(4);

// PWM on GPIO 18 (1 kHz, 50% duty cycle)
await hal.gpio.setPwm(18, 1000, 0.5);

// Edge-triggered interrupt
hal.gpio.watch(4, (pin, value) => {
    console.log(`GPIO ${pin} changed to ${value}`);
});
```

---

## Temperature & Power Monitoring

```typescript
import { hal } from '/opt/pinetos/hal';

const health = await hal.thermal.getSystemHealth();
console.log(`CPU temp: ${health.thermal.cpuTempC.toFixed(1)}°C`);
console.log(`Core voltage: ${health.power.coreVoltage}V`);
console.log(`Throttled: ${health.throttle.currentlyThrottled}`);

// Subscribe to continuous updates (every 5 seconds)
const unsubscribe = hal.thermal.subscribe((h) => {
    if (h.thermal.cpuTempC > 80) {
        console.warn('High temperature warning!');
    }
});
// Later: unsubscribe();
```

---

## PCIe / NVMe (RPi 5 Exclusive)

The Raspberry Pi 5 includes a single-lane **PCIe Gen 3** interface for high-speed storage.

### Enable PCIe Gen 3 in `/boot/config.txt`
```
dtparam=pciex1_gen=3
```

### Check NVMe device
```bash
ls /dev/nvme*          # /dev/nvme0, /dev/nvme0n1
nvme list              # List NVMe devices
nvme smart-log /dev/nvme0  # Health information
```

### Format and use NVMe
```bash
# Partition NVMe
sudo parted /dev/nvme0n1 mklabel gpt
sudo parted /dev/nvme0n1 mkpart primary ext4 0% 100%

# Format
sudo mkfs.ext4 /dev/nvme0n1p1

# Mount persistently
echo "/dev/nvme0n1p1  /data  ext4  defaults,noatime  0 2" | sudo tee -a /etc/fstab
sudo mount -a
```

---

## Hardware PWM

Two hardware PWM channels are available on the RPi 5:

| PWM Channel | GPIO | Pin |
|---|---|---|
| PWM0 | GPIO12 or GPIO18 | 32 or 12 |
| PWM1 | GPIO13 or GPIO19 | 33 or 35 |

Enable in `/boot/config.txt`:
```
dtoverlay=pwm-2chan,pin=18,func=2,pin2=19,func2=2
```

Shell example (1 kHz, 50% duty cycle):
```bash
echo 0 > /sys/class/pwm/pwmchip0/export
echo 1000000 > /sys/class/pwm/pwmchip0/pwm0/period    # 1 ms = 1 kHz
echo 500000  > /sys/class/pwm/pwmchip0/pwm0/duty_cycle  # 50%
echo 1       > /sys/class/pwm/pwmchip0/pwm0/enable
```

---

## Supported HATs and Peripherals

| HAT / Peripheral | Support Status | Notes |
|---|---|---|
| Hailo-8L AI Accelerator | ✅ Supported | Via PCIe M.2 HAT; requires hailo-pcie kernel driver |
| Official RPi Camera Module 3 | ✅ Supported | `dtoverlay=imx708` |
| Official Active Cooler | ✅ Supported | Auto-detected |
| NVMe M.2 HAT | ✅ Supported | PCIe Gen 3, any M.2 2230/2242/2280 NVMe |
| ReSpeaker 4-Mic Array | ✅ Supported | USB or I2S HAT variant |
| Sense HAT | ✅ Supported | I2C gyroscope, magnetometer, LED matrix |
| PoE+ HAT | ✅ Supported | `dtoverlay=rpi-poe-plus` |
| DS3231 RTC | ✅ Supported | `dtoverlay=i2c-rtc,ds3231` |
| 1-Wire temperature (DS18B20) | ✅ Supported | GPIO4, `dtoverlay=w1-gpio` |
| MCP3008 8-ch ADC | ✅ Supported | SPI, see HAL spi.ts `mcp3008Read()` |
| Adafruit PCA9685 Servo Driver | ✅ Supported | I2C 0x40 |
| Pimoroni Automation HAT | ✅ Supported | I2C + GPIO |

---

## Serial Console (UART)

For headless debugging, connect a USB-UART adapter (e.g., CP2102 or FT232) to:

| Signal | GPIO | Physical Pin |
|---|---|---|
| GND | GND | Pin 6 |
| RX (adapter TX) | GPIO15 | Pin 10 |
| TX (adapter RX) | GPIO14 | Pin 8 |

Connect at **115200 8N1**:
```bash
# Linux
screen /dev/ttyUSB0 115200
# or
minicom -D /dev/ttyUSB0 -b 115200

# macOS
screen /dev/cu.usbserial-XXXX 115200

# Windows
PuTTY → Serial → COM3 → 115200
```
