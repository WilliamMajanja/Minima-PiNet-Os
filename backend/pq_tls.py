"""CPIP Post-Quantum TLS (PQ-TLS) for PiNet-OS v1.3.0.

Provides hybrid post-quantum key exchange for CPIP RPC transport, combining
classical ECDH P-256 with 1nf1D3L Kyber (ML-KEM-768) for quantum resistance.

The PQ-TLS layer wraps the existing CPIP mTLS transport with an additional
hybrid KEM handshake, ensuring forward secrecy even against a future
quantum adversary that can break ECDH.

When `CPIP_PQ_TLS=1`, the Minima RPC client negotiates a hybrid key:
  1. ECDH P-256 classical shared secret (FIPS 186-4)
  2. Kyber-768 PQ shared secret (non-FIPS, ML-KEM-768)
  3. Both secrets are combined via HKDF-SHA256 to derive the session key

On hosts without the Kyber library, the module reports status but does not
attempt the PQ handshake (graceful degradation to classical TLS).
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
import time
from typing import Any

from .config import (
    CPIP_COVERT_KEY,
    CPIP_PQ_HYBRID,
    CPIP_PQ_KEM,
    CPIP_PQ_TLS_ENABLED,
    CPIP_RECIPE,
)

logger = logging.getLogger(__name__)

# Check for Kyber library availability
try:
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    from cryptography.hazmat.primitives import hashes, serialization
    _CRYPTO_AVAILABLE = True
except ImportError:
    _CRYPTO_AVAILABLE = False

# Kyber availability (1nf1D3L or pqcrypto)
try:
    import oqs  # type: ignore  # liboqs-python
    _KYBER_AVAILABLE = True
    _KYBER_ALG = "ML-KEM-768"
except ImportError:
    _KYBER_AVAILABLE = False
    _KYBER_ALG = None


class PQTLSManager:
    """Post-quantum TLS handshake manager for CPIP RPC transport.

    Implements a hybrid KEM key exchange:
      - Classical: ECDH P-256 (FIPS 186-4)
      - Post-quantum: Kyber-768 (ML-KEM-768, non-FIPS)
      - Combined: HKDF-SHA256 of both shared secrets
    """

    def __init__(self) -> None:
        self._enabled = CPIP_PQ_TLS_ENABLED
        self._kem = CPIP_PQ_KEM
        self._hybrid = CPIP_PQ_HYBRID
        self._handshake_count = 0
        self._classical_curve = "ecdh-p256"

    @property
    def enabled(self) -> bool:
        return self._enabled

    @property
    def kyber_available(self) -> bool:
        return _KYBER_AVAILABLE

    @property
    def crypto_available(self) -> bool:
        return _CRYPTO_AVAILABLE

    def status(self) -> dict[str, Any]:
        """Return PQ-TLS configuration and runtime status."""
        return {
            "enabled": self._enabled,
            "kemAlgorithm": self._kem,
            "hybridMode": self._hybrid,
            "classicalCurve": self._classical_curve,
            "kyberAvailable": _KYBER_AVAILABLE,
            "cryptoAvailable": _CRYPTO_AVAILABLE,
            "pqHandshakeCount": self._handshake_count,
            "certificateAvailable": bool(os.getenv("CPIP_MTLS_CERT", "")),
        }

    def generate_classical_keypair(self) -> tuple[bytes, bytes]:
        """Generate an ECDH P-256 keypair for the classical component."""
        if not _CRYPTO_AVAILABLE:
            return b"", b""
        private_key = ec.generate_private_key(ec.SECP256R1())
        public_key = private_key.public_key()
        priv_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        pub_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        return priv_bytes, pub_bytes

    def generate_pq_keypair(self) -> tuple[bytes, bytes]:
        """Generate a Kyber-768 keypair for the post-quantum component."""
        if not _KYBER_AVAILABLE:
            return b"", b""
        try:
            with oqs.KeyEncapsulation(_KYBER_ALG) as kem:
                public_key = kem.generate_keypair()
                secret_key = kem.export_secret_key()
            return bytes(secret_key), bytes(public_key)
        except Exception as exc:
            logger.warning("Kyber keypair generation failed: %s", exc)
            return b"", b""

    def encapsulate(self, peer_public_key: bytes) -> tuple[bytes, bytes]:
        """Encapsulate a shared secret using the peer's PQ public key.

        Returns (ciphertext, shared_secret).
        """
        if not _KYBER_AVAILABLE:
            return b"", b""
        try:
            with oqs.KeyEncapsulation(_KYBER_ALG) as kem:
                ciphertext, shared_secret = kem.encap_secret(peer_public_key)
            self._handshake_count += 1
            return bytes(ciphertext), bytes(shared_secret)
        except Exception as exc:
            logger.warning("Kyber encapsulation failed: %s", exc)
            return b"", b""

    def decapsulate(self, ciphertext: bytes, secret_key: bytes) -> bytes:
        """Decapsulate a shared secret using our PQ secret key."""
        if not _KYBER_AVAILABLE:
            return b""
        try:
            with oqs.KeyEncapsulation(_KYBER_ALG, secret_key=secret_key) as kem:
                shared_secret = kem.decap_secret(ciphertext)
            return bytes(shared_secret)
        except Exception as exc:
            logger.warning("Kyber decapsulation failed: %s", exc)
            return b""

    def derive_hybrid_session_key(
        self, classical_secret: bytes, pq_secret: bytes
    ) -> bytes:
        """Derive a 256-bit session key from hybrid KEM secrets.

        Uses HKDF-SHA256 with the CPIP recipe as domain separation.
        """
        combined = classical_secret + pq_secret
        if not _CRYPTO_AVAILABLE:
            # Fallback: SHA-256 directly
            return hashlib.sha256(combined).digest()
        try:
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=32,
                salt=CPIP_COVERT_KEY.encode() if CPIP_COVERT_KEY else None,
                info=CPIP_RECIPE.encode(),
            )
            return hkdf.derive(combined)
        except Exception:
            return hashlib.sha256(combined).digest()

    def perform_handshake(self, peer_classical_pub: bytes = b"",
                          peer_pq_pub: bytes = b"") -> dict[str, Any]:
        """Perform a full hybrid PQ-TLS handshake (simulated for testing).

        In production, this is called during the CPIP RPC connection setup.
        """
        if not self._enabled:
            return {"success": False, "error": "PQ-TLS is disabled"}

        start = time.monotonic()
        classical_secret = b""
        pq_secret = b""
        pq_ciphertext = b""

        # Classical component (ECDH P-256)
        if self._hybrid and _CRYPTO_AVAILABLE and peer_classical_pub:
            try:
                from cryptography.hazmat.primitives.serialization import load_pem_public_key
                peer_pub = load_pem_public_key(peer_classical_pub)
                our_priv = ec.generate_private_key(ec.SECP256R1())
                classical_secret = our_priv.exchange(ec.ECDH(), peer_pub)
            except Exception as exc:
                logger.warning("Classical ECDH failed: %s", exc)

        # PQ component (Kyber-768)
        if _KYBER_AVAILABLE and peer_pq_pub:
            pq_ciphertext, pq_secret = self.encapsulate(peer_pq_pub)
        elif _KYBER_AVAILABLE:
            # Self-test: generate keypair and encapsulate to ourselves
            try:
                with oqs.KeyEncapsulation(_KYBER_ALG) as kem:
                    pub = kem.generate_keypair()
                    ct, ss = kem.encap_secret(pub)
                    pq_secret = bytes(ss)
                    pq_ciphertext = bytes(ct)
            except Exception as exc:
                logger.warning("PQ self-test failed: %s", exc)

        # Derive hybrid session key
        if classical_secret or pq_secret:
            session_key = self.derive_hybrid_session_key(classical_secret, pq_secret)
        else:
            session_key = b""

        duration_ms = int((time.monotonic() - start) * 1000)
        self._handshake_count += 1

        return {
            "success": bool(session_key),
            "hybrid": self._hybrid,
            "classicalCurve": self._classical_curve if classical_secret else None,
            "kemAlgorithm": _KYBER_ALG if pq_secret else None,
            "sessionKeyLength": len(session_key),
            "durationMs": duration_ms,
            "handshakeCount": self._handshake_count,
        }


pqtls_manager = PQTLSManager()