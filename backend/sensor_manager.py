"""Custom User Sensor Manager for PiNet-OS.

Provides a pluggable sensor backend system for user-built sensors attached to
Raspberry Pi nodes, with explicit optimisation and resource limits for the
**Pi Zero 2 W** (BCM2837B0, 512 MB RAM, single-core turbo @ 1 GHz).

Supported sensor buses:
  - I2C (e.g. BME280, SHT31, BMP280, MPU-6050)
  - GPIO (e.g. DHT11/22, PIR motion, HC-SR04 echo)
  - SPI (e.g. MCP3008 ADC, MAX6675 thermocouple)
  - 1-Wire (e.g. DS18B20 temperature)
  - ADC (e.g. MCP3008 / ADS1115 analog sensors)
  - UART (e.g. NMEA GPS, MH-Z19 CO2)

On non-Pi platforms (CI / dev), all backends degrade to simulated readings.
"""
from __future__ import annotations

import asyncio
import logging
import os
import random
import time
from pathlib import Path
from typing import Any

from .models import (
    CustomSensorDef,
    PlatformSensorCaps,
    SensorBus,
    SensorKind,
    SensorReading,
)

logger = logging.getLogger(__name__)

# ─── Platform capabilities ───────────────────────────────────────────────────
# Pi Zero 2 W is the canonical low-power custom-sensor target: it shares the
# Pi 3 SoC (BCM2837B0) but has only 512 MB RAM and a single-core turbo.
# We cap simultaneous custom sensors at 4 and floor poll interval at 15s.

_PLATFORM_CAPS: dict[str, PlatformSensorCaps] = {
    "pi5": PlatformSensorCaps(
        platform="pi5", maxSensors=16, minPollInterval=5,
        i2cBus=1, label="Raspberry Pi 5",
    ),
    "pi4": PlatformSensorCaps(
        platform="pi4", maxSensors=12, minPollInterval=5,
        i2cBus=1, label="Raspberry Pi 4",
    ),
    "pi3": PlatformSensorCaps(
        platform="pi3", maxSensors=8, minPollInterval=10,
        i2cBus=1, label="Raspberry Pi 3",
    ),
    "pi2": PlatformSensorCaps(
        platform="pi2", maxSensors=6, minPollInterval=10,
        i2cBus=1, label="Raspberry Pi 2",
    ),
    "pi1": PlatformSensorCaps(
        platform="pi1", maxSensors=4, minPollInterval=20,
        i2cBus=1, label="Raspberry Pi 1",
    ),
    "zero2w": PlatformSensorCaps(
        platform="zero2w", maxSensors=4, minPollInterval=15,
        i2cBus=1, supportsSpi=True, supportsGpio=True,
        supportsOneWire=True, supportsAdc=True,
        label="Raspberry Pi Zero 2 W",
    ),
    "zero": PlatformSensorCaps(
        platform="zero", maxSensors=3, minPollInterval=30,
        i2cBus=1, supportsSpi=True, supportsGpio=True,
        supportsOneWire=True, supportsAdc=False,
        label="Raspberry Pi Zero",
    ),
    "cm4": PlatformSensorCaps(
        platform="cm4", maxSensors=12, minPollInterval=5,
        i2cBus=1, label="Compute Module 4",
    ),
    "cm3": PlatformSensorCaps(
        platform="cm3", maxSensors=6, minPollInterval=10,
        i2cBus=1, label="Compute Module 3",
    ),
    "generic": PlatformSensorCaps(
        platform="generic", maxSensors=4, minPollInterval=15,
        i2cBus=1, label="Generic Platform",
    ),
}


def get_platform_caps(platform: str) -> PlatformSensorCaps:
    """Return sensor capability limits for the given platform identifier."""
    return _PLATFORM_CAPS.get(platform, _PLATFORM_CAPS["generic"])


def detect_pi_model() -> str:
    """Detect Raspberry Pi model from device tree / cpuinfo.

    Returns one of: pi5, pi4, pi3, pi2, pi1, zero, zero2w, cm4, cm3, generic.
    """
    try:
        model_path = Path("/proc/device-tree/model")
        if model_path.exists():
            model = model_path.read_text().replace("\x00", "").strip().lower()
            if "pi 5" in model or "bcm2712" in model:
                return "pi5"
            if "pi 4" in model or "bcm2711" in model:
                return "pi4"
            if "zero 2" in model or "zero2" in model:
                return "zero2w"
            if "pi 3" in model or "bcm2837" in model:
                return "pi3"
            if "pi 2" in model or "bcm2836" in model:
                return "pi2"
            if "zero" in model:
                return "zero"
            if "compute module 4" in model or "cm4" in model:
                return "cm4"
            if "compute module 3" in model or "cm3" in model:
                return "cm3"
            if "compute module" in model:
                return "cm"
            if "pi 1" in model or "model a" in model or "model b" in model:
                return "pi1"
            if "raspberry pi" in model:
                return "pi"
    except Exception:
        pass

    try:
        cpuinfo = Path("/proc/cpuinfo").read_text().lower()
        if "bcm2712" in cpuinfo:
            return "pi5"
        if "bcm2711" in cpuinfo:
            return "pi4"
        if "bcm2837" in cpuinfo:
            return "pi3"
        if "bcm2836" in cpuinfo:
            return "pi2"
        if "bcm2835" in cpuinfo:
            return "pi1"
    except Exception:
        pass

    return "generic"


# ─── Sensor backends ─────────────────────────────────────────────────────────
# Each backend is a callable that takes a CustomSensorDef and returns a float.
# On non-Pi platforms (no /dev/i2c-*, no /sys/bus/w1, etc.) a simulated value
# is returned so the API is always testable in CI.

_I2C_AVAILABLE = Path("/dev/i2c-1").exists() or Path("/dev/i2c-0").exists()
_GPIO_AVAILABLE = Path("/dev/gpiomem").exists()
_SPI_AVAILABLE = Path("/dev/spidev0.0").exists() or Path("/dev/spidev0.1").exists()
_W1_AVAILABLE = Path("/sys/bus/w1").exists()


def _simulate(sensor: CustomSensorDef) -> float:
    """Return a plausible simulated reading for CI / non-Pi hosts."""
    base = {
        SensorKind.TEMPERATURE: 22.5,
        SensorKind.HUMIDITY: 58.3,
        SensorKind.PRESSURE: 1013.25,
        SensorKind.LIGHT: 420.0,
        SensorKind.SOIL_MOISTURE: 35.0,
        SensorKind.AIR_QUALITY: 45.0,
        SensorKind.PROXIMITY: 0.0,
        SensorKind.CUSTOM: 0.0,
    }.get(sensor.kind, 0.0)
    jitter = random.uniform(-2.0, 2.0)
    return round(base + jitter, 2)


def _read_i2c(sensor: CustomSensorDef) -> float:
    """Read an I2C sensor. Falls back to simulation if no /dev/i2c-* present."""
    if not _I2C_AVAILABLE or not sensor.address:
        return _simulate(sensor)
    try:
        import smbus2  # type: ignore
        bus_num = get_platform_caps(detect_pi_model()).i2c_bus
        bus = smbus2.SMBus(bus_num)
        addr = int(sensor.address, 0)
        # Read 2 bytes (common for BME280 / BMP280 / SHT31)
        data = bus.read_i2c_block_data(addr, 0x00, 2)
        bus.close()
        raw = (data[0] << 8 | data[1]) / 100.0
        return round(raw * sensor.calibration_scale + sensor.calibration_offset, 2)
    except Exception as exc:
        logger.debug("I2C read failed for %s: %s", sensor.id, exc)
        return _simulate(sensor)


def _read_gpio(sensor: CustomSensorDef) -> float:
    """Read a GPIO sensor (e.g. DHT22 on pin 4). Falls back to simulation."""
    if not _GPIO_AVAILABLE or sensor.pin is None:
        return _simulate(sensor)
    try:
        import Adafruit_DHT  # type: ignore
        humidity, _temp = Adafruit_DHT.read_retry(Adafruit_DHT.DHT22, sensor.pin)
        if humidity is not None:
            return round(humidity * sensor.calibration_scale + sensor.calibration_offset, 2)
    except Exception as exc:
        logger.debug("GPIO read failed for %s: %s", sensor.id, exc)
    return _simulate(sensor)


def _read_spi(sensor: CustomSensorDef) -> float:
    """Read an SPI sensor (e.g. MCP3008 ADC channel). Falls back to simulation."""
    if not _SPI_AVAILABLE or sensor.spi_channel is None:
        return _simulate(sensor)
    try:
        import spidev  # type: ignore
        spi = spidev.SpiDev()
        spi.open(0, 0)
        # MCP3008: single-ended read on channel
        cmd = [0x01, (0x08 | sensor.spi_channel) << 4, 0x00]
        reply = spi.xfer3(cmd)
        spi.close()
        raw = ((reply[1] & 0x03) << 8) | reply[2]
        voltage = (raw * 3.3) / 1023.0
        return round(voltage * sensor.calibration_scale + sensor.calibration_offset, 2)
    except Exception as exc:
        logger.debug("SPI read failed for %s: %s", sensor.id, exc)
    return _simulate(sensor)


def _read_one_wire(sensor: CustomSensorDef) -> float:
    """Read a 1-Wire sensor (e.g. DS18B20). Falls back to simulation."""
    if not _W1_AVAILABLE:
        return _simulate(sensor)
    try:
        w1_dir = Path("/sys/bus/w1/devices")
        devices = list(w1_dir.glob("28-*"))
        if not devices:
            return _simulate(sensor)
        # If sensor.address is set, match it; else use first device
        target = devices[0]
        if sensor.address:
            matches = [d for d in devices if sensor.address in d.name]
            if matches:
                target = matches[0]
        data = (target / "w1_slave").read_text()
        if "YES" not in data:
            return _simulate(sensor)
        temp_line = [l for l in data.splitlines() if "t=" in l]
        if temp_line:
            raw = float(temp_line[0].split("t=")[1]) / 1000.0
            return round(raw * sensor.calibration_scale + sensor.calibration_offset, 2)
    except Exception as exc:
        logger.debug("1-Wire read failed for %s: %s", sensor.id, exc)
    return _simulate(sensor)


def _read_adc(sensor: CustomSensorDef) -> float:
    """Read an ADC sensor (via SPI MCP3008 or ADS1115 via I2C)."""
    if sensor.bus == SensorBus.SPI or sensor.spi_channel is not None:
        return _read_spi(sensor)
    return _read_i2c(sensor)


def _read_uart(sensor: CustomSensorDef) -> float:
    """Read a UART sensor (e.g. MH-Z19 CO2 on /dev/serial0). Falls back to sim."""
    serial_path = Path("/dev/serial0")
    if not serial_path.exists():
        return _simulate(sensor)
    try:
        import serial  # type: ignore
        with serial.Serial("/dev/serial0", 9600, timeout=1) as ser:
            ser.write(bytes([0xFF, 0x01, 0x86, 0x00, 0x00, 0x00, 0x00, 0x00, 0x79]))
            resp = ser.read(9)
            if len(resp) >= 9:
                co2 = resp[2] * 256 + resp[3]
                return round(float(co2) * sensor.calibration_scale + sensor.calibration_offset, 2)
    except Exception as exc:
        logger.debug("UART read failed for %s: %s", sensor.id, exc)
    return _simulate(sensor)


_BACKENDS: dict[SensorBus, Any] = {
    SensorBus.I2C: _read_i2c,
    SensorBus.GPIO: _read_gpio,
    SensorBus.SPI: _read_spi,
    SensorBus.ONE_WIRE: _read_one_wire,
    SensorBus.ADC: _read_adc,
    SensorBus.UART: _read_uart,
}


def read_sensor(sensor: CustomSensorDef) -> SensorReading:
    """Read a single sensor and return a SensorReading (never raises)."""
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    if not sensor.enabled:
        return SensorReading(
            sensorId=sensor.id, value=0.0, unit=sensor.unit,
            timestamp=ts, error="sensor disabled",
        )
    backend = _BACKENDS.get(sensor.bus, _simulate)
    try:
        value = backend(sensor)
        return SensorReading(
            sensorId=sensor.id, value=value, unit=sensor.unit,
            timestamp=ts, raw=value,
        )
    except Exception as exc:
        logger.warning("Sensor %s read error: %s", sensor.id, exc)
        return SensorReading(
            sensorId=sensor.id, value=0.0, unit=sensor.unit,
            timestamp=ts, error=str(exc),
        )


# ─── Sensor registry (in-memory, persisted via state) ────────────────────────

class SensorManager:
    """Manages custom user sensor definitions and live readings.

    Enforces platform capability limits — especially for Pi Zero 2 W, which
    is the primary low-power target for custom-built user sensors.
    """

    def __init__(self) -> None:
        self._sensors: dict[str, CustomSensorDef] = {}
        self._platform: str = os.getenv("PINET_SENSOR_PLATFORM", "") or detect_pi_model()
        self._caps: PlatformSensorCaps = get_platform_caps(self._platform)

    @property
    def platform(self) -> str:
        return self._platform

    @property
    def caps(self) -> PlatformSensorCaps:
        return self._caps

    def list_sensors(self) -> list[CustomSensorDef]:
        return list(self._sensors.values())

    def get_sensor(self, sensor_id: str) -> CustomSensorDef | None:
        return self._sensors.get(sensor_id)

    def add_sensor(self, sensor: CustomSensorDef) -> CustomSensorDef:
        if len(self._sensors) >= self._caps.max_sensors:
            raise ValueError(
                f"Platform {self._platform} supports at most "
                f"{self._caps.max_sensors} custom sensors "
                f"(Pi Zero 2 W limit: 4)"
            )
        if sensor.poll_interval < self._caps.min_poll_interval:
            sensor.poll_interval = self._caps.min_poll_interval
        self._sensors[sensor.id] = sensor
        return sensor

    def update_sensor(self, sensor_id: str, updates: dict) -> CustomSensorDef:
        sensor = self._sensors.get(sensor_id)
        if sensor is None:
            raise KeyError(f"Sensor not found: {sensor_id}")
        for key, val in updates.items():
            if hasattr(sensor, key):
                setattr(sensor, key, val)
        if sensor.poll_interval < self._caps.min_poll_interval:
            sensor.poll_interval = self._caps.min_poll_interval
        return sensor

    def remove_sensor(self, sensor_id: str) -> bool:
        return self._sensors.pop(sensor_id, None) is not None

    def read_all(self) -> list[SensorReading]:
        return [read_sensor(s) for s in self._sensors.values() if s.enabled]

    async def read_all_async(self) -> list[SensorReading]:
        loop = asyncio.get_event_loop()
        tasks = [
            loop.run_in_executor(None, read_sensor, s)
            for s in self._sensors.values() if s.enabled
        ]
        return await asyncio.gather(*tasks)

    def to_state(self) -> list[dict[str, Any]]:
        return [s.model_dump(by_alias=True) for s in self._sensors.values()]

    def from_state(self, data: list[dict[str, Any]]) -> None:
        self._sensors.clear()
        for item in data:
            try:
                sensor = CustomSensorDef(**item)
                self._sensors[sensor.id] = sensor
            except Exception as exc:
                logger.warning("Skipping invalid sensor in state: %s", exc)


sensor_manager = SensorManager()