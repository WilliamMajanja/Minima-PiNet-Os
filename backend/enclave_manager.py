from __future__ import annotations
import hashlib
import json
import struct
import time
from typing import Optional
from .config import ENCLAVE_DEFAULT_MEM_GB, ENCLAVE_MAX_PER_NODE

ENCLAVES: dict[str, dict] = {}
_ENCLAVE_MEASUREMENTS: dict[str, dict] = {}

def _generate_enclave_id() -> str:
    return f"enc-{int(time.time() * 1000)}-{hashlib.sha256(struct.pack('!d', time.time())).hexdigest()[:8]}"

def _make_measurement(name: str, tee_type: str, memory_mb: int) -> str:
    raw = f"{name}:{tee_type}:{memory_mb}:{time.time()}"
    return hashlib.sha256(raw.encode()).hexdigest()

async def create_enclave(
    name: str,
    tee_type: str = "cca",
    memory_mb: int = 1024,
    cpu_count: int = 2,
    image_ref: str = "",
    runtime: str = "linux",
    node_id: str = "localhost",
) -> dict:
    if len(ENCLAVES) >= ENCLAVE_MAX_PER_NODE:
        raise RuntimeError(f"Max enclaves per node ({ENCLAVE_MAX_PER_NODE}) reached")
    eid = _generate_enclave_id()
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    measurement = _make_measurement(name, tee_type, memory_mb)
    enclave = {
        "enclaveId": eid,
        "name": name,
        "teeType": tee_type,
        "status": "creating",
        "memoryMb": memory_mb,
        "cpuCount": cpu_count,
        "measurement": measurement,
        "runtime": runtime,
        "imageRef": image_ref,
        "nodeId": node_id,
        "attestationToken": "",
        "createdAt": now,
    }
    ENCLAVES[eid] = enclave
    enclave["status"] = "running"
    return enclave

async def get_enclave(enclave_id: str) -> Optional[dict]:
    return ENCLAVES.get(enclave_id)

async def list_enclaves(node_id: str = "") -> list[dict]:
    if node_id:
        return [e for e in ENCLAVES.values() if e["nodeId"] == node_id]
    return list(ENCLAVES.values())

async def stop_enclave(enclave_id: str) -> dict:
    e = ENCLAVES.get(enclave_id)
    if not e:
        raise KeyError(f"Enclave {enclave_id} not found")
    e["status"] = "stopped"
    return e

async def terminate_enclave(enclave_id: str) -> dict:
    e = ENCLAVES.pop(enclave_id, None)
    if not e:
        raise KeyError(f"Enclave {enclave_id} not found")
    e["status"] = "terminated"
    return e

async def get_measurement(enclave_id: str) -> Optional[dict]:
    return _ENCLAVE_MEASUREMENTS.get(enclave_id)

async def record_measurement(enclave_id: str, pcr_values: dict, runtime_hash: str = "", config_hash: str = "") -> dict:
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    m = {
        "enclaveId": enclave_id,
        "pcrValues": pcr_values,
        "runtimeHash": runtime_hash,
        "configHash": config_hash,
        "signingKeyFingerprint": hashlib.sha256(json.dumps(pcr_values, sort_keys=True).encode()).hexdigest()[:16],
        "timestamp": now,
    }
    _ENCLAVE_MEASUREMENTS[enclave_id] = m
    return m

async def attest_enclave(enclave_id: str) -> dict:
    e = ENCLAVES.get(enclave_id)
    if not e:
        raise KeyError(f"Enclave {enclave_id} not found")
    token = hashlib.sha256(f"{enclave_id}:{e['measurement']}:{int(time.time())}".encode()).hexdigest()
    e["attestationToken"] = token
    e["status"] = "attested"
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return {
        "enclaveId": enclave_id,
        "attested": True,
        "measurement": e["measurement"],
        "verificationResult": "pass",
        "ledgerTxid": f"0x{hashlib.sha256(token.encode()).hexdigest()[:64]}",
        "timestamp": now,
    }
