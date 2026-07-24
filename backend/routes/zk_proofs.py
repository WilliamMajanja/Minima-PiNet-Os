from fastapi import APIRouter, HTTPException
from ..zk_prover import (
    generate_proof, get_proof, list_proofs,
    verify_proof, delete_proof,
)

router = APIRouter()

@router.get("/zk/proofs")
async def api_list_proofs():
    return {"proofs": await list_proofs()}

@router.get("/zk/proofs/{proof_id}")
async def api_get_proof(proof_id: str):
    p = await get_proof(proof_id)
    if not p:
        raise HTTPException(404, "Proof not found")
    return p

@router.post("/zk/proofs")
async def api_generate_proof(body: dict):
    return await generate_proof(
        program_source=body.get("programSource", ""),
        program_args=body.get("programArgs"),
        public_inputs=body.get("publicInputs"),
        prover_backend=body.get("proverBackend", "risc0"),
        timeout=body.get("timeout", 300),
    )

@router.post("/zk/proofs/{proof_id}/verify")
async def api_verify_proof(proof_id: str, body: dict):
    try:
        return await verify_proof(
            proof_id=proof_id,
            program_hash=body.get("programHash", ""),
            public_inputs=body.get("publicInputs", {}),
            proof_bytes=body.get("proofBytes", ""),
        )
    except KeyError:
        raise HTTPException(404, "Proof not found")

@router.delete("/zk/proofs/{proof_id}")
async def api_delete_proof(proof_id: str):
    if not await delete_proof(proof_id):
        raise HTTPException(404, "Proof not found")
    return {"status": "deleted"}
