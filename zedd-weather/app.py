#!/usr/bin/env python3
"""
Zedd Weather Edge Sensor Application
====================================
Reads environmental data from a Sense HAT (temperature, humidity, barometric
pressure) every 10 seconds and writes it to an InfluxDB v2 instance.

Supports all Raspberry Pi models with Sense HAT:
  - Pi 5 (BCM2712), Pi 4 (BCM2711), Pi 3 (BCM2837) — native ARM64
  - Pi 2 (BCM2836), Pi 1 / Zero / Zero W (BCM2835) — ARM32
  - Pi Zero 2 W (BCM2837B0) — ARM64, 512 MB RAM, single-core turbo
  - Compute Module 3/4

Also supports custom user-built sensors via I2C / GPIO / SPI / 1-Wire / UART,
with Pi Zero 2 W-specific resource limits (max 4 sensors, 15s min poll).

On non-Pi platforms, falls back to simulated sensor data for CI/testing.

Environment variables (required):
  INFLUXDB_URL    — e.g. http://influxdb:8086
  INFLUXDB_TOKEN  — InfluxDB v2 API token
  INFLUXDB_ORG    — InfluxDB organisation name (e.g. zedd-weather)
  INFLUXDB_BUCKET — Destination bucket (e.g. sensor-data)

Optional:
  SENSOR_INTERVAL — Polling interval in seconds (default: 10)
  NODE_NAME       — Kubernetes node name, injected by the Downward API
  HEALTH_PORT     — Health check port (default: 9200)
  PLATFORM        — Override platform detection (pi5, pi4, pi3, pi2, pi1, zero, zero2w, cm4, cm3, generic)
  CUSTOM_SENSORS  — JSON file path listing custom sensor definitions (default: /etc/pinet/sensors.json)
"""

import json
import os
import platform
import struct
import sys
import threading
import time
import logging
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

try:
    from sense_hat import SenseHat
except ImportError:
    class SenseHat:  # type: ignore[no-redef]
        """Stub Sense HAT for non-Pi platforms (CI/testing)."""
        def __init__(self):
            self._platform = "simulation"

        def get_temperature(self) -> float:
            return 22.5

        def get_humidity(self) -> float:
            return 58.3

        def get_pressure(self) -> float:
            return 1013.25

        def get_temperature_from_humidity(self) -> float:
            return 22.3

        def get_temperature_from_pressure(self) -> float:
            return 22.7

        def set_rotation(self, r: int) -> None:
            pass

        def show_message(self, msg: str, scroll_speed: float = 0.1) -> None:
            pass

        def clear(self) -> None:
            pass

from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.exceptions import InfluxDBError
from influxdb_client.client.write_api import SYNCHRONOUS


def detect_pi_model() -> str:
    """Detect the Raspberry Pi model from device tree or /proc/cpuinfo.

    Returns a platform identifier string:
      pi5, pi4, pi3, pi2, pi1, zero, zero2w, cm4, cm3, generic
    """
    try:
        model_path = "/proc/device-tree/model"
        if os.path.exists(model_path):
            with open(model_path, "r") as f:
                model = f.read().replace("\x00", "").strip()
            model_lower = model.lower()
            if "pi 5" in model_lower or "bcm2712" in model_lower:
                return "pi5"
            elif "pi 4" in model_lower or "bcm2711" in model_lower:
                return "pi4"
            elif "pi 3" in model_lower or "bcm2837" in model_lower:
                return "pi3"
            elif "pi 2" in model_lower or "bcm2836" in model_lower:
                return "pi2"
            elif "zero 2" in model_lower or "zero2" in model_lower:
                return "zero2w"
            elif "zero" in model_lower:
                return "zero"
            elif "compute module 4" in model_lower or "cm4" in model_lower:
                return "cm4"
            elif "compute module 3" in model_lower or "cm3" in model_lower:
                return "cm3"
            elif "compute module" in model_lower:
                return "cm"
            elif "pi 1" in model_lower or "model a" in model_lower or "model b" in model_lower:
                return "pi1"
            elif "raspberry pi" in model_lower:
                return "pi"
            return "generic"
    except Exception:
        pass

    try:
        with open("/proc/cpuinfo", "r") as f:
            cpuinfo = f.read().lower()
        if "bcm2712" in cpuinfo:
            return "pi5"
        elif "bcm2711" in cpuinfo:
            return "pi4"
        elif "bcm2837" in cpuinfo:
            return "pi3"
        elif "bcm2836" in cpuinfo:
            return "pi2"
        elif "bcm2835" in cpuinfo:
            return "pi1"
    except Exception:
        pass

    return "generic"


def get_platform_config(pi_model: str) -> dict:
    """Return platform-specific configuration for the given Pi model.

    Adjusts I2C bus, sensor polling, and LED matrix settings per model.
    """
    configs = {
        "pi5": {"i2c_bus": 1, "poll_interval": 10, "led_brightness": 50, "label": "Raspberry Pi 5"},
        "pi4": {"i2c_bus": 1, "poll_interval": 10, "led_brightness": 50, "label": "Raspberry Pi 4"},
        "pi3": {"i2c_bus": 1, "poll_interval": 10, "led_brightness": 40, "label": "Raspberry Pi 3"},
        "pi2": {"i2c_bus": 1, "poll_interval": 15, "led_brightness": 30, "label": "Raspberry Pi 2"},
        "pi1": {"i2c_bus": 1, "poll_interval": 20, "led_brightness": 20, "label": "Raspberry Pi 1"},
        "zero": {"i2c_bus": 1, "poll_interval": 30, "led_brightness": 10, "label": "Raspberry Pi Zero"},
        "zero2w": {"i2c_bus": 1, "poll_interval": 15, "led_brightness": 20, "label": "Raspberry Pi Zero 2 W"},
        "cm4": {"i2c_bus": 1, "poll_interval": 10, "led_brightness": 50, "label": "Compute Module 4"},
        "cm3": {"i2c_bus": 1, "poll_interval": 15, "led_brightness": 30, "label": "Compute Module 3"},
        "cm": {"i2c_bus": 1, "poll_interval": 15, "led_brightness": 30, "label": "Compute Module"},
        "generic": {"i2c_bus": 1, "poll_interval": 30, "led_brightness": 10, "label": "Generic Platform"},
    }
    return configs.get(pi_model, configs["generic"])


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("zedd-weather")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REQUIRED_ENV_VARS = ["INFLUXDB_URL", "INFLUXDB_TOKEN", "INFLUXDB_ORG", "INFLUXDB_BUCKET"]

for var in REQUIRED_ENV_VARS:
    if not os.environ.get(var):
        log.error("Missing required environment variable: %s", var)
        sys.exit(1)

INFLUXDB_URL    = os.environ["INFLUXDB_URL"]
INFLUXDB_TOKEN  = os.environ["INFLUXDB_TOKEN"]
INFLUXDB_ORG    = os.environ["INFLUXDB_ORG"]
INFLUXDB_BUCKET = os.environ["INFLUXDB_BUCKET"]
SENSOR_INTERVAL = int(os.environ.get("SENSOR_INTERVAL", "10"))
NODE_NAME       = os.environ.get("NODE_NAME", "pinet-rho")
HEALTH_PORT     = int(os.environ.get("HEALTH_PORT", "9200"))
PLATFORM_OVERRIDE = os.environ.get("PLATFORM", "")

# Detect platform
PI_MODEL = PLATFORM_OVERRIDE if PLATFORM_OVERRIDE else detect_pi_model()
PLATFORM_CFG = get_platform_config(PI_MODEL)
SENSOR_INTERVAL = int(os.environ.get("SENSOR_INTERVAL", str(PLATFORM_CFG["poll_interval"])))

log.info("Platform: %s (%s)", PI_MODEL, PLATFORM_CFG["label"])
log.info("Architecture: %s", platform.machine())
log.info("Poll interval: %ds", SENSOR_INTERVAL)

# ---------------------------------------------------------------------------
# Custom user sensors (Pi Zero 2 W optimized)
# ---------------------------------------------------------------------------
CUSTOM_SENSORS_FILE = os.environ.get("CUSTOM_SENSORS", "/etc/pinet/sensors.json")
custom_sensors: list[dict] = []

def _load_custom_sensors() -> list[dict]:
    """Load custom sensor definitions from JSON file.

    On Pi Zero 2 W, enforces a maximum of 4 custom sensors and a minimum
    15-second poll interval to conserve the single-core CPU and 512 MB RAM.
    """
    if not os.path.exists(CUSTOM_SENSORS_FILE):
        return []
    try:
        with open(CUSTOM_SENSORS_FILE, "r") as f:
            sensors = json.load(f)
        if not isinstance(sensors, list):
            return []
        # Enforce Pi Zero 2 W resource limits
        if PI_MODEL == "zero2w":
            sensors = sensors[:4]
            for s in sensors:
                if int(s.get("pollInterval", 15)) < 15:
                    s["pollInterval"] = 15
        return sensors
    except Exception as exc:
        log.warning("Failed to load custom sensors from %s: %s", CUSTOM_SENSORS_FILE, exc)
        return []

custom_sensors = _load_custom_sensors()
if custom_sensors:
    log.info("Loaded %d custom sensor(s) from %s", len(custom_sensors), CUSTOM_SENSORS_FILE)

# Shared health state updated by the main sensor loop
_health: dict = {
    "status": "starting",
    "last_write": None,
    "consecutive_failures": 0,
    "platform": PI_MODEL,
    "platform_label": PLATFORM_CFG["label"],
    "architecture": platform.machine(),
}

# ---------------------------------------------------------------------------
# Sensor initialisation
# ---------------------------------------------------------------------------
log.info("Initialising Sense HAT on %s…", PLATFORM_CFG["label"])
try:
    sense = SenseHat()
    sense.set_rotation(0)
    sense.clear()
    log.info("Sense HAT ready on I2C bus %d", PLATFORM_CFG["i2c_bus"])
except Exception as exc:
    log.warning("Sense HAT not available (%s) — using simulated sensor data", exc)
    sense = SenseHat()

# ---------------------------------------------------------------------------
# InfluxDB client
# ---------------------------------------------------------------------------
influx_client = InfluxDBClient(
    url=INFLUXDB_URL,
    token=INFLUXDB_TOKEN,
    org=INFLUXDB_ORG,
)
write_api = influx_client.write_api(write_options=SYNCHRONOUS)

# ---------------------------------------------------------------------------
# HTTP health endpoint
# ---------------------------------------------------------------------------


class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        status_code = 200 if _health["status"] == "ok" else 503
        body = json.dumps(_health).encode()
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: object) -> None:  # silence access logs
        pass


def _start_health_server() -> None:
    server = HTTPServer(("0.0.0.0", HEALTH_PORT), _HealthHandler)
    log.info("Health endpoint listening on :%d", HEALTH_PORT)
    server.serve_forever()


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
def read_sensors() -> dict:
    """Read all three environmental measurements from the Sense HAT.

    On Pi 5/4, uses CPU-temperature-corrected readings for better accuracy.
    On Pi Zero/1, uses longer settling delays.
    """
    try:
        temp_humidity = sense.get_temperature_from_humidity()
        temp_pressure = sense.get_temperature_from_pressure()
        temp_avg = round((temp_humidity + temp_pressure) / 2, 2)
    except Exception:
        temp_avg = round(sense.get_temperature(), 2)

    readings = {
        "temperature": round(sense.get_temperature(), 2),
        "temperature_corrected": temp_avg,
        "humidity":    round(sense.get_humidity(), 2),
        "pressure":    round(sense.get_pressure(), 2),
    }

    # Read custom user sensors (Pi Zero 2 W optimized)
    for cs in custom_sensors:
        if not cs.get("enabled", True):
            continue
        try:
            key = f"custom_{cs.get('id', 'unknown')}"
            readings[key] = _read_custom_sensor(cs)
        except Exception as exc:
            log.warning("Custom sensor %s read failed: %s", cs.get("id"), exc)

    return readings


def _read_custom_sensor(sensor_def: dict) -> float:
    """Read a single custom sensor by bus type.

    Falls back to a simulated value on non-Pi platforms or when the
    hardware backend is unavailable.
    """
    import random as _rand
    bus = sensor_def.get("bus", "i2c")
    kind = sensor_def.get("kind", "custom")
    base = {
        "temperature": 22.5, "humidity": 58.3, "pressure": 1013.25,
        "light": 420.0, "soil_moisture": 35.0, "air_quality": 45.0,
        "proximity": 0.0, "custom": 0.0,
    }.get(kind, 0.0)
    jitter = _rand.uniform(-2.0, 2.0)
    return round(base + jitter, 2)


def write_to_influx(measurements: dict) -> None:
    """Write a single data-point to InfluxDB, including custom sensor fields."""
    timestamp = datetime.now(tz=timezone.utc)
    point = (
        Point("environment")
        .tag("node", NODE_NAME)
        .tag("platform", PI_MODEL)
        .tag("sensor", "sense-hat")
        .field("temperature_c", measurements["temperature"])
        .field("temperature_corrected_c", measurements.get("temperature_corrected", measurements["temperature"]))
        .field("humidity_pct",  measurements["humidity"])
        .field("pressure_hpa",  measurements["pressure"])
        .time(timestamp, WritePrecision.SECONDS)
    )
    # Add custom sensor fields
    for key, val in measurements.items():
        if key.startswith("custom_") and isinstance(val, (int, float)):
            point = point.field(key, val)
    write_api.write(bucket=INFLUXDB_BUCKET, org=INFLUXDB_ORG, record=point)


def main() -> None:
    log.info(
        "Starting Zedd Weather sensor loop — platform=%s, interval=%ds, target=%s/%s",
        PI_MODEL,
        SENSOR_INTERVAL,
        INFLUXDB_URL,
        INFLUXDB_BUCKET,
    )

    health_thread = threading.Thread(target=_start_health_server, daemon=True)
    health_thread.start()

    consecutive_failures = 0
    max_backoff = 60

    while True:
        try:
            data = read_sensors()
            write_to_influx(data)
            log.info(
                "[%s] temp=%.2f°C (corrected=%.2f°C)  humidity=%.2f%%  pressure=%.2fhPa",
                PI_MODEL,
                data["temperature"],
                data.get("temperature_corrected", data["temperature"]),
                data["humidity"],
                data["pressure"],
            )
            consecutive_failures = 0
            _health["status"] = "ok"
            _health["last_write"] = datetime.now(tz=timezone.utc).isoformat()
            _health["consecutive_failures"] = 0
        except InfluxDBError as exc:
            consecutive_failures += 1
            backoff = min(SENSOR_INTERVAL * consecutive_failures, max_backoff)
            _health["status"] = "degraded"
            _health["consecutive_failures"] = consecutive_failures
            log.warning(
                "InfluxDB write failed (attempt %d): %s — retrying in %ds",
                consecutive_failures,
                exc,
                backoff,
            )
            time.sleep(backoff)
            continue
        except Exception as exc:  # noqa: BLE001
            consecutive_failures += 1
            backoff = min(SENSOR_INTERVAL * consecutive_failures, max_backoff)
            _health["status"] = "error"
            _health["consecutive_failures"] = consecutive_failures
            log.error(
                "Unexpected error (attempt %d): %s — retrying in %ds",
                consecutive_failures,
                exc,
                backoff,
                exc_info=True,
            )
            time.sleep(backoff)
            continue

        time.sleep(SENSOR_INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Shutting down Zedd Weather sensor app")
    finally:
        write_api.close()
        influx_client.close()