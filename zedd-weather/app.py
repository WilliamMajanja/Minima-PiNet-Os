#!/usr/bin/env python3
"""
Zedd Weather Edge Sensor Application
=====================================
Reads environmental data from a Sense HAT (temperature, humidity, barometric
pressure) every 10 seconds and writes it to an InfluxDB v2 instance.

Environment variables (required):
  INFLUXDB_URL    — e.g. http://influxdb:8086
  INFLUXDB_TOKEN  — InfluxDB v2 API token
  INFLUXDB_ORG    — InfluxDB organisation name (e.g. zedd-weather)
  INFLUXDB_BUCKET — Destination bucket (e.g. sensor-data)

Optional:
  SENSOR_INTERVAL — Polling interval in seconds (default: 10)
  NODE_NAME       — Kubernetes node name, injected by the Downward API
"""

import os
import sys
import time
import logging
from datetime import datetime, timezone

try:
    from sense_hat import SenseHat
except ImportError:
    # Running outside a Raspberry Pi — use a stub for CI/testing
    class SenseHat:  # type: ignore[no-redef]
        def get_temperature(self) -> float:
            return 22.5

        def get_humidity(self) -> float:
            return 58.3

        def get_pressure(self) -> float:
            return 1013.25

from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.exceptions import InfluxDBError
from influxdb_client.client.write_api import SYNCHRONOUS

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

# ---------------------------------------------------------------------------
# Sensor initialisation
# ---------------------------------------------------------------------------
log.info("Initialising Sense HAT…")
sense = SenseHat()
log.info("Sense HAT ready")

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
# Main loop
# ---------------------------------------------------------------------------
def read_sensors() -> dict:
    """Read all three environmental measurements from the Sense HAT."""
    return {
        "temperature": round(sense.get_temperature(), 2),
        "humidity":    round(sense.get_humidity(), 2),
        "pressure":    round(sense.get_pressure(), 2),
    }


def write_to_influx(measurements: dict) -> None:
    """Write a single data-point to InfluxDB."""
    timestamp = datetime.now(tz=timezone.utc)
    point = (
        Point("environment")
        .tag("node", NODE_NAME)
        .tag("sensor", "sense-hat")
        .field("temperature_c", measurements["temperature"])
        .field("humidity_pct",  measurements["humidity"])
        .field("pressure_hpa",  measurements["pressure"])
        .time(timestamp, WritePrecision.SECONDS)
    )
    write_api.write(bucket=INFLUXDB_BUCKET, org=INFLUXDB_ORG, record=point)


def main() -> None:
    log.info(
        "Starting Zedd Weather sensor loop — interval=%ds, target=%s/%s",
        SENSOR_INTERVAL,
        INFLUXDB_URL,
        INFLUXDB_BUCKET,
    )

    consecutive_failures = 0
    max_backoff = 60  # seconds

    while True:
        try:
            data = read_sensors()
            write_to_influx(data)
            log.info(
                "Recorded — temp=%.2f°C  humidity=%.2f%%  pressure=%.2fhPa",
                data["temperature"],
                data["humidity"],
                data["pressure"],
            )
            consecutive_failures = 0
        except InfluxDBError as exc:
            consecutive_failures += 1
            backoff = min(SENSOR_INTERVAL * consecutive_failures, max_backoff)
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
            log.error("Unexpected error reading sensors: %s", exc)

        time.sleep(SENSOR_INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Shutting down Zedd Weather sensor app")
    finally:
        write_api.close()
        influx_client.close()
