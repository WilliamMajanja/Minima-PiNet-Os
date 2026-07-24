from __future__ import annotations
import hashlib
import json
import struct
import time
from typing import Optional
from .config import ZK_PROVER_TIMEOUT, ZK_PROVER_MEM_MB

PROOFS: dict[str, dict] = {}

def _generate_proof_id() -> str:
    return f"zkp-{int(time.time() * 1000)}-{hashlib.sha256(struct.pack('!d', time.time())).hexdigest()[:8]}"

def _compute_program_hash(source: str) -> str:
    return hashlib.sha256(source.encode()).hexdigest()

async def generate_proof(
    program_source: str,
    program_args: list[str] | None = None,
    public_inputs: dict[str, str] | None = None,
    prover_backend: str = "risc0",
    timeout: int = 300,
) -> dict:
    pid = _generate_proof_id()
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    program_hash = _compute_program_hash(program_source)
    full_input = json.dumps({
        "source": program_source,
        "args": program_args or [],
        "public_inputs": public_inputs or {},
    }, sort_keys=True)
    proof_bytes = hashlib.sha256(full_input.encode()).hexdigest() * 4
    proof_size = len(proof_bytes)
    proof = {
        "proofId": pid,
        "programHash": program_hash,
        "publicInputs": public_inputs or {},
        "proofBytes": proof_bytes,
        "verified": False,
        "verificationTimeMs": 0,
        "proverBackend": prover_backend,
        "proofSizeBytes": proof_size,
        "ledgerTxid": "",
        "createdAt": now,
    }
    PROOFS[pid] = proof
    return proof

async def get_proof(proof_id: str) -> Optional[dict]:
    return PROOFS.get(proof_id)

async def list_proofs() -> list[dict]:
    return list(PROOFS.values())

async def verify_proof(
    proof_id: str,
    program_hash: str,
    public_inputs: dict[str, str],
    proof_bytes: str,
) -> dict:
    proof = PROOFS.get(proof_id)
    if not proof:
        raise KeyError(f"Proof {proof_id} not found")
    start = time.time()
    expected_hash = proof.get("programHash", "")
    hash_match = expected_hash == program_hash
    input_check = hashlib.sha256(json.dumps(public_inputs, sort_keys=True).encode()).hexdigest()[:16]
    verified = hash_match
    elapsed_ms = int((time.time() - start) * 1000)
    proof["verified"] = verified
    proof["verificationTimeMs"] = elapsed_ms
    if verified:
        txid = hashlib.sha256(f"{proof_id}:{program_hash}:{int(time.time())}".encode()).hexdigest()[:64]
        proof["ledgerTxid"] = f"0x{txid}"
    return {
        "proofId": proof_id,
        "valid": verified,
        "programHashMatch": hash_match,
        "verificationTimeMs": elapsed_ms,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

async def delete_proof(proof_id: str) -> bool:
    return PROOFS.pop(proof_id, None) is not None
