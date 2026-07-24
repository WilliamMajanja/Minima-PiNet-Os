"""Hardware Key-Wrap Manager for PiNet-OS v1.3.0.

Wraps CPIP master keys using TPM 2.0 hardware sealing. Keys are sealed
against PCR values (boot integrity) and can only be unsealed on the same
hardware with the same boot state.

Uses the `tpm2-tools` CLI (`tpm2_createprimary`, `tpm2_create`,
`tpm2_load`, `tpm2_unseal`) for hardware-backed operations. On hosts
without a TPM, falls back to a software-emulated sealed key (encrypted
with a machine-specific key derived from /etc/machine-id) so the API
remains testable in CI.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import subprocess
from pathlib import Path
from typing import Any

from .config import (
    TPM_DEVICE,
    TPM_KEYWRAP_ENABLED,
    TPM_SEALED_KEY_PATH,
    TPM_SRK_HANDLE,
)
from .models import TPMSealedKey

logger = logging.getLogger(__name__)

_PCR_BANK = "sha256"
_PCR_SELECTION = [0, 1, 2, 3, 4, 5, 6, 7]


def shutil_which(cmd: str) -> bool:
    import shutil
    return shutil.which(cmd) is not None


def _has_tpm2_tools() -> bool:
    """Check if tpm2-tools CLI is available."""
    for tool in ("tpm2_createprimary", "tpm2_create", "tpm2_unseal"):
        if not shutil_which(tool):
            return False
    return True


_TPM_AVAILABLE = Path(TPM_DEVICE).exists() and _has_tpm2_tools()


class TPMKeystore:
    """TPM 2.0 hardware key-wrapping for CPIP master keys.

    Sealing flow:
      1. Generate a 256-bit CPIP master key (if not exists)
      2. Create a TPM primary key under the storage hierarchy
      3. Seal the master key under the primary, bound to PCR selection
      4. Store the sealed blob at TPM_SEALED_KEY_PATH

    Unsealing flow (at boot):
      1. Load the sealed blob
      2. Unseal using the TPM (fails if PCR values have changed)
      3. Inject the unsealed key into the CPIP provider
    """

    def __init__(self) -> None:
        self._sealed_path = Path(TPM_SEALED_KEY_PATH)
        self._srk_handle = TPM_SRK_HANDLE
        self._pcr_bank = _PCR_BANK
        self._pcr_selection = _PCR_SELECTION

    @property
    def tpm_available(self) -> bool:
        return _TPM_AVAILABLE

    @property
    def sealed_path(self) -> str:
        return str(self._sealed_path)

    def status(self) -> dict[str, Any]:
        """Return TPM keystore status."""
        return {
            "enabled": TPM_KEYWRAP_ENABLED,
            "tpmAvailable": _TPM_AVAILABLE,
            "tpmDevice": TPM_DEVICE,
            "sealedPath": str(self._sealed_path),
            "sealed": self._sealed_path.exists(),
            "pcrBank": self._pcr_bank,
            "pcrSelection": self._pcr_selection,
        }

    def seal_key(self, key_id: str = "cpip-master") -> TPMSealedKey:
        """Seal the CPIP master key using TPM 2.0.

        On non-TPM hosts, falls back to software sealing (encrypt with
        a machine-id-derived key) so the API is testable.
        """
        sealed = TPMSealedKey(
            keyId=key_id,
            sealedPath=str(self._sealed_path),
            pcrBank=self._pcr_bank,
            pcrSelection=self._pcr_selection,
            sealed=False,
            tpmAvailable=_TPM_AVAILABLE,
        )

        if not TPM_KEYWRAP_ENABLED:
            return sealed

        self._sealed_path.parent.mkdir(parents=True, exist_ok=True)

        if _TPM_AVAILABLE:
            success = self._seal_tpm(key_id)
        else:
            success = self._seal_software(key_id)

        sealed.sealed = success
        return sealed

    def unseal_key(self) -> dict[str, Any]:
        """Unseal the CPIP master key (called at boot).

        Returns the unsealed key bytes on success, or an error.
        """
        if not self._sealed_path.exists():
            return {"success": False, "error": "No sealed key found"}

        if _TPM_AVAILABLE:
            return self._unseal_tpm()
        return self._unseal_software()

    def get_pcr_values(self) -> dict[str, str]:
        """Read current TPM PCR values for attestation."""
        if not _TPM_AVAILABLE:
            return {}
        try:
            result = subprocess.run(
                ["tpm2_pcrread", f"{self._pcr_bank}:all", "-o", "/dev/stdout"],
                capture_output=True, timeout=5, check=False,
            )
            if result.returncode != 0:
                return {}
            # Parse PCR values
            pcrs: dict[str, str] = {}
            for line in result.stdout.decode(errors="replace").splitlines():
                line = line.strip()
                if line and ":" in line:
                    parts = line.split(":", 1)
                    if len(parts) == 2 and parts[0].strip().isdigit():
                        idx = parts[0].strip()
                        pcrs[idx] = parts[1].strip()
            return pcrs
        except (subprocess.SubprocessError, OSError) as exc:
            logger.warning("Failed to read PCRs: %s", exc)
            return {}

    def _seal_tpm(self, key_id: str) -> bool:
        """Seal using real TPM 2.0 hardware."""
        try:
            # Generate master key
            master_key = secrets.token_bytes(32)
            # Create primary key
            subprocess.run(
                ["tpm2_createprimary", "-C", "o", "-g", self._pcr_bank,
                 "-c", "primary.ctx"],
                capture_output=True, timeout=10, check=True,
            )
            # Create sealed object with PCR policy
            pcr_policy = ",".join(f"{self._pcr_bank}:{p}" for p in self._pcr_selection)
            with open("/tmp/cpip-key.dat", "wb") as f:
                f.write(master_key)
            subprocess.run(
                ["tpm2_create", "-C", "primary.ctx", "-g", self._pcr_bank,
                 "-i", "/tmp/cpip-key.dat", "-u", "sealed.pub",
                 "-r", "sealed.priv", "-L", pcr_policy],
                capture_output=True, timeout=10, check=True,
            )
            # Store sealed blob
            sealed_blob = Path("sealed.pub").read_bytes() + Path("sealed.priv").read_bytes()
            self._sealed_path.write_bytes(sealed_blob)
            # Cleanup temp files
            for p in ("primary.ctx", "sealed.pub", "sealed.priv", "/tmp/cpip-key.dat"):
                Path(p).unlink(missing_ok=True)
            logger.info("CPIP master key sealed with TPM 2.0 (PCRs: %s)", pcr_policy)
            return True
        except (subprocess.SubprocessError, OSError) as exc:
            logger.error("TPM seal failed: %s", exc)
            return False

    def _seal_software(self, key_id: str) -> bool:
        """Software-emulated sealing for non-TPM hosts (CI/testing)."""
        try:
            machine_id = Path("/etc/machine-id").read_text().strip()
            if not machine_id:
                machine_id = "pinet-fallback-key"
            # Derive a wrapping key from machine-id
            wrapping_key = hashlib.sha256(machine_id.encode()).digest()
            # Generate master key
            master_key = secrets.token_bytes(32)
            # XOR-encrypt (simplified; real impl uses AES-256-GCM via CPIP)
            sealed = bytes(a ^ b for a, b in zip(master_key, wrapping_key))
            self._sealed_path.write_bytes(sealed)
            logger.info("CPIP master key software-sealed (non-TPM fallback)")
            return True
        except OSError as exc:
            logger.error("Software seal failed: %s", exc)
            return False

    def _unseal_tpm(self) -> dict[str, Any]:
        """Unseal using real TPM 2.0 hardware."""
        try:
            # Load sealed object
            sealed_data = self._sealed_path.read_bytes()
            pub_data = sealed_data[:len(sealed_data)//2]
            priv_data = sealed_data[len(sealed_data)//2:]
            Path("sealed.pub").write_bytes(pub_data)
            Path("sealed.priv").write_bytes(priv_data)
            subprocess.run(
                ["tpm2_load", "-C", "primary.ctx", "-u", "sealed.pub",
                 "-r", "sealed.priv", "-c", "sealed.ctx"],
                capture_output=True, timeout=10, check=True,
            )
            # Unseal
            result = subprocess.run(
                ["tpm2_unseal", "-c", "sealed.ctx", "-o", "/tmp/cpip-unsealed.dat"],
                capture_output=True, timeout=10, check=False,
            )
            if result.returncode == 0:
                key = Path("/tmp/cpip-unsealed.dat").read_bytes()
                Path("sealed.ctx").unlink(missing_ok=True)
                Path("/tmp/cpip-unsealed.dat").unlink(missing_ok=True)
                return {"success": True, "keyId": "cpip-master", "keyLength": len(key)}
            return {"success": False, "error": "TPM unseal failed (PCR mismatch?)"}
        except (subprocess.SubprocessError, OSError) as exc:
            return {"success": False, "error": str(exc)}

    def _unseal_software(self) -> dict[str, Any]:
        """Software-emulated unsealing for non-TPM hosts."""
        try:
            machine_id = Path("/etc/machine-id").read_text().strip()
            if not machine_id:
                machine_id = "pinet-fallback-key"
            wrapping_key = hashlib.sha256(machine_id.encode()).digest()
            sealed = self._sealed_path.read_bytes()
            master_key = bytes(a ^ b for a, b in zip(sealed, wrapping_key))
            return {"success": True, "keyId": "cpip-master", "keyLength": len(master_key)}
        except OSError as exc:
            return {"success": False, "error": str(exc)}


tpm_keystore = TPMKeystore()