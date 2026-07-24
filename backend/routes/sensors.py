"""Custom User Sensor API routes.

CRUD endpoints for user-defined sensors attached to Raspberry Pi nodes
(including Pi Zero 2 W), plus live reading endpoints.

Pi Zero 2 W is the primary low-power target: the API enforces platform
capability limits (max 4 sensors, min 15s poll interval) and returns
simulated readings on non-Pi hosts for CI/testability.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..models import CustomSensorDef, SensorBus, SensorKind
from ..sensor_manager import sensor_manager

router = APIRouter()


@router.get("/sensors/platform")
async def get_platform_caps():
    """Return the current platform's sensor capability limits."""
    caps = sensor_manager.caps
    return {
        "platform": caps.platform,
        "label": caps.label,
        "maxSensors": caps.max_sensors,
        "minPollInterval": caps.min_poll_interval,
        "i2cBus": caps.i2c_bus,
        "supportsSpi": caps.supports_spi,
        "supportsGpio": caps.supports_gpio,
        "supportsOneWire": caps.supports_one_wire,
        "supportsAdc": caps.supports_adc,
    }


@router.get("/sensors")
async def list_sensors():
    """List all registered custom sensors."""
    return {
        "sensors": [s.model_dump(by_alias=True) for s in sensor_manager.list_sensors()],
        "count": len(sensor_manager.list_sensors()),
        "platform": sensor_manager.platform,
    }


@router.post("/sensors")
async def create_sensor(sensor: CustomSensorDef):
    """Register a new custom sensor.

    Pi Zero 2 W supports at most 4 simultaneous custom sensors with a
    minimum 15-second poll interval to conserve the single-core CPU.
    """
    if sensor_manager.get_sensor(sensor.id) is not None:
        raise HTTPException(409, f"Sensor already exists: {sensor.id}")
    try:
        sensor_manager.add_sensor(sensor)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return {"success": True, "sensor": sensor.model_dump(by_alias=True)}


@router.get("/sensors/{sensor_id}")
async def get_sensor(sensor_id: str):
    sensor = sensor_manager.get_sensor(sensor_id)
    if sensor is None:
        raise HTTPException(404, f"Sensor not found: {sensor_id}")
    return sensor.model_dump(by_alias=True)


@router.put("/sensors/{sensor_id}")
async def update_sensor(sensor_id: str, updates: dict):
    if sensor_manager.get_sensor(sensor_id) is None:
        raise HTTPException(404, f"Sensor not found: {sensor_id}")
    try:
        sensor = sensor_manager.update_sensor(sensor_id, updates)
    except (KeyError, ValueError) as exc:
        raise HTTPException(400, str(exc))
    return {"success": True, "sensor": sensor.model_dump(by_alias=True)}


@router.delete("/sensors/{sensor_id}")
async def delete_sensor(sensor_id: str):
    if not sensor_manager.remove_sensor(sensor_id):
        raise HTTPException(404, f"Sensor not found: {sensor_id}")
    return {"success": True, "sensorId": sensor_id}


@router.get("/sensors/{sensor_id}/reading")
async def read_sensor(sensor_id: str):
    """Read a single sensor's current value."""
    sensor = sensor_manager.get_sensor(sensor_id)
    if sensor is None:
        raise HTTPException(404, f"Sensor not found: {sensor_id}")
    from ..sensor_manager import read_sensor as _read
    reading = _read(sensor)
    return reading.model_dump(by_alias=True)


@router.get("/sensors/readings/all")
async def read_all_sensors():
    """Read all enabled sensors concurrently."""
    readings = await sensor_manager.read_all_async()
    return {
        "readings": [r.model_dump(by_alias=True) for r in readings],
        "count": len(readings),
        "platform": sensor_manager.platform,
    }


@router.get("/sensors/buses")
async def list_sensor_buses():
    """List supported sensor bus types."""
    return {
        "buses": [b.value for b in SensorBus],
        "kinds": [k.value for k in SensorKind],
    }