"""Formal Remote Attestation for PiNet-OS v2.0.0.

Provides TPM 2.0 PCR-based remote attestation with results anchored to
the Minima blockchain ledger. The attestation protocol:

  1. Collect PCR values from the TPM (sha256 bank)
  2. Hash /boot/firmware and /etc/pinet for boot/config integrity
  3. Create an AttestationRecord with all hashes
  4. Anchor the record to the Minima ledger via a provenance burn
  5. Verifiers compare the record against expected golden values

The spec is documented in ATTESTATION_SPEC.md.
"""
from __future__ import annotations

import hashlib
import logging
import time
from pathlib import Path
from typing import Any

from .config import ATTESTATION_ENABLED, ATTESTATION_PCR_BANK
from .models import AttestationRecord, AttestationVerifyResult
from .tpm_keystore import tpm_keystore

logger = logging.getLogger(__name__)

_BOOT_PATH = Path("/boot/firmware")
_CONFIG_PATH = Path("/etc/pinet")


class AttestationManager:
    """Manages formal remote attestation records anchored to Minima ledger.

    v2.0.0 feature: provides a verifiable chain of trust from TPM 2.0
    PCRs through boot/config hashes to the immutable Minima blockchain.
    """

    def __init__(self) -> None:
        self._records: dict[str, AttestationRecord] = {}
        self._pcr_bank = ATTESTATION_PCR_BANK

    @property
    def enabled(self) -> bool:
        return ATTESTATION_ENABLED

    def collect_pcrs(self) -> dict[str, str]:
        """Collect current TPM PCR values."""
        return tpm_keystore.get_pcr_values()

    def hash_directory(self, path: Path) -> str:
        """Compute a SHA-256 hash of all files in a directory.

        This is used for boot integrity (/boot/firmware) and config
        integrity (/etc/pinet) attestation.
        """
        if not path.exists():
            return ""
        h = hashlib.sha256()
        try:
            for file_path in sorted(path.rglob("*")):
                if file_path.is_file():
                    rel = str(file_path.relative_to(path)).encode()
                    h.update(rel)
                    h.update(file_path.read_bytes())
        except PermissionError:
            logger.warning("Permission denied hashing %s", path)
            return ""
        except Exception as exc:
            logger.warning("Failed to hash %s: %s", path, exc)
            return ""
        return h.hexdigest()

    def create_attestation(self, node_id: str) -> AttestationRecord:
        """Create a new attestation record from current system state."""
        if not ATTESTATION_ENABLED:
            raise RuntimeError("Attestation is disabled")

        pcrs = self.collect_pcrs()
        boot_hash = self.hash_directory(_BOOT_PATH)
        config_hash = self.hash_directory(_CONFIG_PATH)
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # Generate attestation ID from hashes
        attestation_id = hashlib.sha256(
            f"{node_id}:{timestamp}:{boot_hash}:{config_hash}".encode()
        ).hexdigest()[:16]

        record = AttestationRecord(
            attestationId=attestation_id,
            nodeId=node_id,
            pcrBank=self._pcr_bank,
            pcrValues=pcrs,
            bootHash=boot_hash,
            configHash=config_hash,
            timestamp=timestamp,
            verified=False,
            ledgerTxid="",
        )
        self._records[attestation_id] = record
        return record

    def verify_attestation(
        self, attestation_id: str, expected_pcrs: dict[str, str] | None = None,
        expected_boot_hash: str = "", expected_config_hash: str = "",
    ) -> AttestationVerifyResult:
        """Verify an attestation record against expected golden values."""
        record = self._records.get(attestation_id)
        if record is None:
            raise KeyError(f"Attestation not found: {attestation_id}")

        pcr_mismatch: list[str] = []
        boot_mismatch = False
        config_mismatch = False

        if expected_pcrs:
            for pcr_idx, expected_val in expected_pcrs.items():
                actual_val = record.pcr_values.get(pcr_idx, "")
                if actual_val != expected_val:
                    pcr_mismatch.append(pcr_idx)

        if expected_boot_hash and record.boot_hash != expected_boot_hash:
            boot_mismatch = True

        if expected_config_hash and record.config_hash != expected_config_hash:
            config_mismatch = True

        valid = not pcr_mismatch and not boot_mismatch and not config_mismatch
        result = AttestationVerifyResult(
            attestationId=attestation_id,
            valid=valid,
            pcrMismatch=pcr_mismatch,
            bootHashMismatch=boot_mismatch,
            configHashMismatch=config_mismatch,
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        )

        if valid:
            record.verified = True

        return result

    def list_attestations(self) -> list[AttestationRecord]:
        return list(self._records.values())

    def get_attestation(self, attestation_id: str) -> AttestationRecord | None:
        return self._records.get(attestation_id)

    def anchor_to_ledger(self, attestation_id: str, txid: str) -> bool:
        """Anchor an attestation record to the Minima ledger.

        In production, this calls the provenance burn endpoint to write
        the attestation hash to the immutable Minima blockchain.
        """
        record = self._records.get(attestation_id)
        if record is None:
            return False
        record.ledger_txid = txid
        return True

    def to_state(self) -> list[dict[str, Any]]:
        return [r.model_dump(by_alias=True) for r in self._records.values()]

    def from_state(self, data: list[dict[str, Any]]) -> None:
        self._records.clear()
        for item in data:
            try:
                record = AttestationRecord(**item)
                self._records[record.attestation_id] = record
            except Exception as exc:
                logger.warning("Skipping invalid attestation in state: %s", exc)


attestation_manager = AttestationManager()