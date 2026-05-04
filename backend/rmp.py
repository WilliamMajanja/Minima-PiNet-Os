"""RMP and RNPE-2 state proof helpers."""
from __future__ import annotations

import hashlib
import json
import time
from typing import Any

RMP_SCHEMA_VERSION = "RMP-1"
RNPE_SCHEMA_VERSION = "RNPE-2"
MAX_RNPE_BLOCK_REQUEST = 512


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _hash_pair(left: str, right: str) -> str:
    return _sha256(f"node:{left}:{right}")


def _flatten_state(value: Any, prefix: str = "") -> list[tuple[str, Any]]:
    if isinstance(value, dict):
        items: list[tuple[str, Any]] = []
        for key in sorted(value):
            path = f"{prefix}.{key}" if prefix else str(key)
            items.extend(_flatten_state(value[key], path))
        return items
    if isinstance(value, list):
        items = []
        for index, item in enumerate(value):
            path = f"{prefix}[{index}]"
            items.extend(_flatten_state(item, path))
        return items
    return [(prefix, value)]


def _leaf_hash(path: str, value: Any) -> str:
    return _sha256(f"leaf:{path}:{canonical_json(value)}")


def _build_levels(leaf_hashes: list[str]) -> list[list[str]]:
    if not leaf_hashes:
        empty_root = _sha256("empty:rmp")
        return [[empty_root]]

    levels = [leaf_hashes]
    current = leaf_hashes
    while len(current) > 1:
        next_level = []
        for index in range(0, len(current), 2):
            left = current[index]
            right = current[index + 1] if index + 1 < len(current) else left
            next_level.append(_hash_pair(left, right))
        levels.append(next_level)
        current = next_level
    return levels


def build_rmp_proof(state: dict[str, Any], requested_paths: list[str] | None = None) -> dict[str, Any]:
    leaves = _flatten_state(state)
    leaf_hashes = [_leaf_hash(path, value) for path, value in leaves]
    levels = _build_levels(leaf_hashes)
    root = levels[-1][0]

    wanted = set(requested_paths or [path for path, _ in leaves])
    targets = []
    for leaf_index, (path, value) in enumerate(leaves):
        if path not in wanted:
            continue
        proof_path = []
        cursor = leaf_index
        for level in levels[:-1]:
            sibling_index = cursor - 1 if cursor % 2 else cursor + 1
            if sibling_index >= len(level):
                sibling_index = cursor
            proof_path.append({
                "position": "left" if sibling_index < cursor else "right",
                "hash": level[sibling_index],
            })
            cursor //= 2
        targets.append({
            "path": path,
            "value": value,
            "leafHash": leaf_hashes[leaf_index],
            "proof": proof_path,
        })

    return {
        "schemaVersion": RMP_SCHEMA_VERSION,
        "type": "recursive-merkle-proof",
        "generatedAt": int(time.time() * 1000),
        "root": f"sha256:{root}",
        "leafCount": len(leaves),
        "targetCount": len(targets),
        "omittedLeaves": max(len(leaves) - len(targets), 0),
        "targets": targets,
    }


def verify_rmp_proof(proof: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(proof, dict) or proof.get("schemaVersion") != RMP_SCHEMA_VERSION:
        return {"valid": False, "reason": "invalid RMP schema"}

    root = proof.get("root", "")
    if not isinstance(root, str) or not root.startswith("sha256:"):
        return {"valid": False, "reason": "invalid RMP root"}

    expected_root = root.removeprefix("sha256:")
    targets = proof.get("targets")
    if not isinstance(targets, list) or not targets:
        return {"valid": False, "reason": "missing RMP targets"}

    verified_paths = []
    for target in targets:
        if not isinstance(target, dict):
            return {"valid": False, "reason": "invalid RMP target"}
        path = target.get("path")
        if not isinstance(path, str):
            return {"valid": False, "reason": "invalid RMP target path"}

        computed = _leaf_hash(path, target.get("value"))
        if computed != target.get("leafHash"):
            return {"valid": False, "reason": "RMP leaf hash mismatch", "path": path}

        proof_path = target.get("proof", [])
        if not isinstance(proof_path, list):
            return {"valid": False, "reason": "invalid RMP proof path", "path": path}
        for sibling in proof_path:
            if not isinstance(sibling, dict):
                return {"valid": False, "reason": "invalid RMP sibling", "path": path}
            sibling_hash = sibling.get("hash")
            position = sibling.get("position")
            if not isinstance(sibling_hash, str) or position not in {"left", "right"}:
                return {"valid": False, "reason": "invalid RMP sibling", "path": path}
            computed = _hash_pair(sibling_hash, computed) if position == "left" else _hash_pair(computed, sibling_hash)

        if computed != expected_root:
            return {"valid": False, "reason": "RMP root mismatch", "path": path}
        verified_paths.append(path)

    return {"valid": True, "root": root, "verifiedPaths": verified_paths}


def create_rnpe2_request(local_height: int, peer_height: int, local_proof: dict[str, Any]) -> dict[str, Any]:
    start = max(local_height + 1, 0)
    end = max(peer_height, local_height)
    limited_end = min(end, start + MAX_RNPE_BLOCK_REQUEST - 1) if end >= start else local_height
    return {
        "schemaVersion": RNPE_SCHEMA_VERSION,
        "type": "recursive-network-peer-exchange",
        "generatedAt": int(time.time() * 1000),
        "localHeight": local_height,
        "peerHeight": peer_height,
        "missingBlocks": {
            "from": start if peer_height > local_height else None,
            "to": limited_end if peer_height > local_height else None,
            "truncated": peer_height > limited_end,
            "maxBlocks": MAX_RNPE_BLOCK_REQUEST,
        },
        "localRoot": local_proof.get("root"),
    }


def verify_rnpe2_consensus(local_proof: dict[str, Any], peer_proof: dict[str, Any]) -> dict[str, Any]:
    local_result = verify_rmp_proof(local_proof)
    peer_result = verify_rmp_proof(peer_proof)
    local_root = local_proof.get("root")
    peer_root = peer_proof.get("root")

    return {
        "schemaVersion": RNPE_SCHEMA_VERSION,
        "localValid": local_result.get("valid", False),
        "peerValid": peer_result.get("valid", False),
        "localRoot": local_root,
        "peerRoot": peer_root,
        "consensusMatch": bool(local_result.get("valid") and peer_result.get("valid") and local_root == peer_root),
        "reason": "roots match" if local_root == peer_root else "roots differ",
    }
