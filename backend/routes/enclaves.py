from fastapi import APIRouter, HTTPException

from ..enclave_manager import (
    attest_enclave,
    create_enclave,
    get_enclave,
    get_measurement,
    list_enclaves,
    record_measurement,
    stop_enclave,
    terminate_enclave,
)

router = APIRouter()

@router.get("/enclaves")
async def api_list_enclaves(node_id: str = ""):
    return {"enclaves": await list_enclaves(node_id)}

@router.get("/enclaves/{enclave_id}")
async def api_get_enclave(enclave_id: str):
    e = await get_enclave(enclave_id)
    if not e:
        raise HTTPException(404, "Enclave not found")
    return e

@router.post("/enclaves")
async def api_create_enclave(body: dict):
    try:
        e = await create_enclave(
            name=body.get("name", "unnamed"),
            tee_type=body.get("teeType", "cca"),
            memory_mb=body.get("memoryMb", 1024),
            cpu_count=body.get("cpuCount", 2),
            image_ref=body.get("imageRef", ""),
            runtime=body.get("runtime", "linux"),
            node_id=body.get("nodeId", "localhost"),
        )
        return e
    except RuntimeError as exc:
        raise HTTPException(400, str(exc))

@router.post("/enclaves/{enclave_id}/stop")
async def api_stop_enclave(enclave_id: str):
    try:
        return await stop_enclave(enclave_id)
    except KeyError:
        raise HTTPException(404, "Enclave not found")

@router.delete("/enclaves/{enclave_id}")
async def api_terminate_enclave(enclave_id: str):
    try:
        return await terminate_enclave(enclave_id)
    except KeyError:
        raise HTTPException(404, "Enclave not found")

@router.get("/enclaves/{enclave_id}/measurement")
async def api_get_measurement(enclave_id: str):
    m = await get_measurement(enclave_id)
    if not m:
        raise HTTPException(404, "No measurement found")
    return m

@router.post("/enclaves/{enclave_id}/measurement")
async def api_record_measurement(enclave_id: str, body: dict):
    return await record_measurement(
        enclave_id,
        pcr_values=body.get("pcrValues", {}),
        runtime_hash=body.get("runtimeHash", ""),
        config_hash=body.get("configHash", ""),
    )

@router.post("/enclaves/{enclave_id}/attest")
async def api_attest_enclave(enclave_id: str):
    try:
        return await attest_enclave(enclave_id)
    except KeyError:
        raise HTTPException(404, "Enclave not found")
