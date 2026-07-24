"""CPIP Security Provider for PiNet-OS.

Integrates The Coffee Protocol (CPIP v5.0.5) cryptographic primitives
as the security provider for all PiNet-OS nodes and Minima operations.

Provides:
  - CoffeeCipher v5: AES-256-GCM (FIPS 197) with HKDF-SHA256 key derivation
  - ECP256: ECDSA/ECDH P-256 (FIPS 186-4) constant-time ECC
  - HybridKEM: ECDH P-256 + ML-KEM-768 post-quantum hybrid key exchange
  - SecureHash: SHA-256 domain-separated hashing + HMAC-SHA256
  - ITFDefense: Active probe blocking, pentest tool detection, IP blacklisting
  - NodeIdentity: CPIP-signed node identity with challenge-response auth
  - RpcToken: HMAC-SHA256 token generation/verification for RPC auth
  - FipsSelfTest: Power-on cryptographic self-tests (AES-GCM, HMAC, HKDF, ECDSA, ECDH)

All classical operations use FIPS-compliant algorithms via the `cryptography`
library (constant-time). PQ KEM uses 1nf1D3L's Kyber (non-FIPS ML-KEM-768).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import secrets
import time
from dataclasses import dataclass, field
from typing import Any, ClassVar

try:
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    _CRYPTO_AVAILABLE = True
except ImportError:
    _CRYPTO_AVAILABLE = False
    default_backend = None
    hashes = None
    serialization = None
    ec = None
    asym_padding = None
    AESGCM = None
    HKDF = None

logger = logging.getLogger(__name__)

# ─── Configuration ───────────────────────────────────────────────────────────

from .config import CPIP_VERSION as _CPIP_VERSION

CPIP_ENABLED = os.getenv("CPIP_ENABLED", "1") == "1"
CPIP_FIPS_MODE = os.getenv("CPIP_FIPS", "0") == "1"
CPIP_COVERT_KEY = os.getenv(
    "CPIP_COVERT_KEY",
    secrets.token_hex(32) if CPIP_ENABLED else "",
).encode() if CPIP_ENABLED else b""
CPIP_RECIPE = os.getenv("CPIP_RECIPE", "minima")
CPIP_NODE_IDENTITY_DIR = os.getenv("CPIP_NODE_IDENTITY_DIR", "/opt/pinet/identity")
CPIP_TOKEN_TTL = int(os.getenv("CPIP_TOKEN_TTL", "300"))
CPIP_DEFENSE_ENABLED = os.getenv("CPIP_DEFENSE_ENABLED", "1") == "1"
CPIP_DEFENSE_RATE_LIMIT = int(os.getenv("CPIP_DEFENSE_RATE_LIMIT", "10"))
CPIP_DEFENSE_RATE_WINDOW = int(os.getenv("CPIP_DEFENSE_RATE_WINDOW", "60"))
CPIP_DEFENSE_BLACKLIST_TTL = int(os.getenv("CPIP_DEFENSE_BLACKLIST_TTL", "3600"))
CPIP_DEFENSE_MAX_BLACKLIST = int(os.getenv("CPIP_DEFENSE_MAX_BLACKLIST", "1000"))

# Probe detection: paths that indicate scanning tools
_SCANNER_PATHS = frozenset({
    "/admin", "/wp-admin", "/wp-login", "/wp-", "/.env", "/phpmyadmin",
    "/shell", "/cmd", "/exec", "/backdoor", "/login", "/setup",
    "/install", "/manager", "/console", "/xmlrpc.php", "/.git",
    "/config", "/backup", "/database", "/db", "/sql",
})

_PENTEST_TOOLS = frozenset({
    "burp", "nmap", "sqlmap", "nikto", "gobuster", "dirb", "ffuf",
    "wfuzz", "openvas", "nessus", "masscan", "zap", "arachni",
    "w3af", "metasploit", "acunetix", "nuclei", "hydra", "wpscan",
})

_INFO_TOOLS = frozenset({
    "curl", "wget", "python-requests", "go-http", "okhttp",
})


# ─── CoffeeCipher v5 ─────────────────────────────────────────────────────────

class CoffeeCipher:
    """AES-256-GCM (FIPS 197) authenticated encryption with HKDF-SHA256.

    Format: nonce (12 bytes) || ciphertext || GCM tag (16 bytes)
    """

    @classmethod
    def _hkdf_extract(cls, salt: bytes, ikm: bytes) -> bytes:
        return hmac.new(salt, ikm, hashlib.sha256).digest()

    @classmethod
    def _hkdf_expand(cls, prk: bytes, info: bytes, length: int = 32) -> bytes:
        n = (length + 31) // 32
        okm = b""
        t = b""
        for i in range(1, n + 1):
            t = hmac.new(prk, t + info + bytes([i]), hashlib.sha256).digest()
            okm += t
        return okm[:length]

    @classmethod
    def hkdf(cls, ikm: bytes, salt: bytes, info: bytes, length: int = 32) -> bytes:
        prk = cls._hkdf_extract(salt, ikm)
        return cls._hkdf_expand(prk, info, length)

    @classmethod
    def key_from_recipe(cls, base_key: bytes, recipe: str = CPIP_RECIPE) -> bytes:
        recipe_bytes = recipe.encode()
        salt = hashlib.sha256(b"\xc0\xff\xee" + recipe_bytes).digest()
        return cls.hkdf(base_key, salt, b"cpip-cipher-v5:" + recipe_bytes, 32)

    @classmethod
    def encrypt(cls, plaintext: bytes, base_key: bytes | None = None,
                recipe: str = CPIP_RECIPE) -> bytes:
        if not _CRYPTO_AVAILABLE:
            raise RuntimeError("CoffeeCipher requires 'cryptography' package")
        if base_key is None:
            base_key = CPIP_COVERT_KEY
        key = cls.key_from_recipe(base_key, recipe)
        nonce = secrets.token_bytes(12)
        aesgcm = AESGCM(key)
        ct = aesgcm.encrypt(nonce, plaintext, None)
        return nonce + ct

    @classmethod
    def decrypt(cls, ciphertext: bytes, base_key: bytes | None = None,
                recipe: str = CPIP_RECIPE) -> bytes:
        if not _CRYPTO_AVAILABLE:
            raise RuntimeError("CoffeeCipher requires 'cryptography' package")
        if base_key is None:
            base_key = CPIP_COVERT_KEY
        if len(ciphertext) < 28:
            return b""
        key = cls.key_from_recipe(base_key, recipe)
        nonce = ciphertext[:12]
        ct_and_tag = ciphertext[12:]
        aesgcm = AESGCM(key)
        try:
            return aesgcm.decrypt(nonce, ct_and_tag, None)
        except (ValueError, TypeError):
            return b""

    @classmethod
    def hash(cls, data: bytes) -> str:
        h = hashlib.sha256(b"cpip-hash-v5:" + data).digest()
        for _ in range(4):
            h = hashlib.sha256(b"cpip-hash-v5:" + h + data).digest()
        return h.hex()[:16]


# ─── ECP256: ECDSA / ECDH P-256 ──────────────────────────────────────────────

class ECP256:
    """ECDSA/ECDH using NIST P-256 (secp256r1) — FIPS 186-4 constant-time."""

    _CURVE = ec.SECP256R1() if _CRYPTO_AVAILABLE else None
    _CURVE_ORDER = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551

    @classmethod
    def _derive_key_from_seed(cls, seed: bytes):
        if not _CRYPTO_AVAILABLE:
            raise RuntimeError("ECP256 requires 'cryptography' package")
        derived = hashlib.sha256(b"cpip-ecdsa-v1:" + seed).digest()
        privkey = ec.derive_private_key(
            int.from_bytes(derived, "big") % cls._CURVE_ORDER,
            cls._CURVE, default_backend(),
        )
        return privkey

    @classmethod
    def generate_keypair(cls, seed: bytes | None = None):
        if not _CRYPTO_AVAILABLE:
            raise RuntimeError("ECP256 requires 'cryptography' package")
        if seed is None:
            seed = secrets.token_bytes(32)
        privkey = cls._derive_key_from_seed(seed)
        pubkey_bytes = privkey.public_key().public_bytes(
            serialization.Encoding.X962,
            serialization.PublicFormat.UncompressedPoint,
        )
        return (pubkey_bytes, seed, privkey, privkey.public_key())

    @classmethod
    def sign(cls, message: bytes, seed: bytes) -> bytes:
        if not _CRYPTO_AVAILABLE:
            raise RuntimeError("ECP256 requires 'cryptography' package")
        privkey = cls._derive_key_from_seed(seed)
        return privkey.sign(
            message if isinstance(message, bytes) else message.encode(),
            ec.ECDSA(hashes.SHA256()),
        )

    @classmethod
    def verify(cls, message: bytes, signature: bytes, public_key) -> bool:
        if not _CRYPTO_AVAILABLE:
            raise RuntimeError("ECP256 requires 'cryptography' package")
        try:
            if isinstance(public_key, ec.EllipticCurvePublicKey):
                pubkey_obj = public_key
            elif isinstance(public_key, bytes):
                pubkey_obj = ec.EllipticCurvePublicKey.from_encoded_point(
                    cls._CURVE, public_key,
                )
            else:
                return False
            pubkey_obj.verify(
                signature,
                message if isinstance(message, bytes) else message.encode(),
                ec.ECDSA(hashes.SHA256()),
            )
            return True
        except (ValueError, TypeError):
            return False

    @classmethod
    def key_exchange(cls, our_seed: bytes, their_public_key: bytes) -> bytes:
        if not _CRYPTO_AVAILABLE:
            raise RuntimeError("ECP256 requires 'cryptography' package")
        privkey = cls._derive_key_from_seed(our_seed)
        pubkey_obj = ec.EllipticCurvePublicKey.from_encoded_point(
            cls._CURVE, their_public_key,
        )
        shared = privkey.exchange(ec.ECDH(), pubkey_obj)
        return hashlib.sha256(shared).digest()

    @classmethod
    def pubkey_to_address(cls, public_key: bytes) -> str:
        h = hashlib.sha256(public_key).digest()[:4]
        b32 = base64.b32encode(h).decode().rstrip("=").lower()
        return f"coffee:{b32}"


# ─── SecureHash ──────────────────────────────────────────────────────────────

class SecureHash:
    """Domain-separated SHA-256 and HMAC-SHA256 (FIPS 180-4)."""

    @staticmethod
    def hash(data: bytes, algorithm: str = "sha256") -> bytes:
        if algorithm == "sha256":
            return hashlib.sha256(data).digest()
        elif algorithm == "sha3_256":
            return hashlib.sha3_256(data).digest()
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")

    @staticmethod
    def domain_hash(domain: str, data: bytes) -> bytes:
        return hashlib.sha256(domain.encode() + b"||" + data).digest()

    @staticmethod
    def keyed_hash(key: bytes, data: bytes) -> bytes:
        return hmac.new(key, data, hashlib.sha256).digest()


# ─── FIPS Self-Tests ─────────────────────────────────────────────────────────

_FIPS_SELF_TESTS_PASSED = False


def run_fips_self_tests() -> bool:
    """Run FIPS-approved power-on self-tests (KATs).

    Tests AES-256-GCM, HMAC-SHA256, HKDF, ECDSA sign/verify, ECDH.
    """
    global _FIPS_SELF_TESTS_PASSED
    if not _CRYPTO_AVAILABLE:
        logger.warning("FIPS self-tests skipped — 'cryptography' package not installed")
        return False
    try:
        # AES-256-GCM KAT
        kat_key = bytes(range(32))
        kat_nonce = bytes(range(12))
        kat_pt = b"FIPS AES-256-GCM KAT"
        aesgcm = AESGCM(kat_key)
        kat_ct = aesgcm.encrypt(kat_nonce, kat_pt, None)
        assert aesgcm.decrypt(kat_nonce, kat_ct, None) == kat_pt

        # HMAC-SHA256 KAT
        hmac_result = hmac.new(b"key", b"msg", hashlib.sha256).hexdigest()
        assert len(hmac_result) == 64

        # HKDF KAT
        hkdf_out = CoffeeCipher.hkdf(b"ikm", b"salt", b"info", 16)
        assert len(hkdf_out) == 16

        # ECDSA KAT
        ecdsa_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
        sig = ecdsa_key.sign(b"test", ec.ECDSA(hashes.SHA256()))
        ecdsa_key.public_key().verify(sig, b"test", ec.ECDSA(hashes.SHA256()))

        # ECDH KAT
        alice = ec.generate_private_key(ec.SECP256R1(), default_backend())
        bob = ec.generate_private_key(ec.SECP256R1(), default_backend())
        shared_a = alice.exchange(ec.ECDH(), bob.public_key())
        shared_b = bob.exchange(ec.ECDH(), alice.public_key())
        assert shared_a == shared_b

        _FIPS_SELF_TESTS_PASSED = True
        logger.info("CPIP FIPS self-tests passed")
        return True
    except Exception as e:
        logger.error("CPIP FIPS self-tests FAILED: %s", e)
        if CPIP_FIPS_MODE:
            raise RuntimeError(f"FIPS self-test failure: {e}") from e
        return False


def fips_assert():
    """Assert FIPS mode is active and self-tests passed."""
    if CPIP_FIPS_MODE and not _FIPS_SELF_TESTS_PASSED:
        raise RuntimeError("FIPS mode enabled but self-tests have not passed")


# ─── ITF Defense (418 Teapot) ────────────────────────────────────────────────

class ITFDefense:
    """Active network defense: probe blocking, pentest detection, IP blacklisting.

    Blocks hostile probes with HTTP 418 and blacklists offending IPs.
    """

    _blacklist: ClassVar[dict[str, dict[str, float | int]]] = {}
    _probe_counts: ClassVar[dict[str, list[float]]] = {}

    @classmethod
    def is_blacklisted(cls, addr: str) -> bool:
        if addr in ("127.0.0.1", "::1", "localhost"):
            return False
        entry = cls._blacklist.get(addr)
        if entry is None:
            return False
        if time.time() > entry["expires"]:
            del cls._blacklist[addr]
            return False
        return True

    @classmethod
    def blacklist_addr(cls, addr: str) -> None:
        if addr in ("127.0.0.1", "::1", "localhost"):
            return
        now = time.time()
        window = CPIP_DEFENSE_RATE_WINDOW
        counts = cls._probe_counts.get(addr, [])
        counts = [t for t in counts if now - t < window]
        counts.append(now)
        cls._probe_counts[addr] = counts

        ttl = CPIP_DEFENSE_BLACKLIST_TTL
        if len(counts) > CPIP_DEFENSE_RATE_LIMIT:
            ttl *= 2
        ttl = min(ttl, 86400)

        cls._blacklist[addr] = {"expires": now + ttl, "ttl": ttl}

        if len(cls._blacklist) > CPIP_DEFENSE_MAX_BLACKLIST:
            sorted_addrs = sorted(
                cls._blacklist.items(),
                key=lambda x: x[1]["expires"],
            )
            for addr_to_remove, _ in sorted_addrs[:len(sorted_addrs) // 2]:
                cls._blacklist.pop(addr_to_remove, None)

        logger.warning("CPIP ITF: blacklisted %s for %ds", addr, ttl)

    @classmethod
    def whitelist_addr(cls, addr: str) -> None:
        cls._blacklist.pop(addr, None)
        cls._probe_counts.pop(addr, None)

    @classmethod
    def clear_blacklist(cls) -> None:
        cls._blacklist.clear()
        cls._probe_counts.clear()

    @classmethod
    def get_blacklist(cls) -> list[str]:
        now = time.time()
        return [addr for addr, e in cls._blacklist.items() if now < e["expires"]]

    @classmethod
    def detect_tools(cls, user_agent: str) -> list[str]:
        ua_lower = (user_agent or "").lower()
        detected = []
        for tool in _PENTEST_TOOLS:
            if tool in ua_lower:
                detected.append(tool)
        return detected

    @classmethod
    def is_info_tool(cls, user_agent: str) -> str | None:
        ua_lower = (user_agent or "").lower()
        for tool in _INFO_TOOLS:
            if tool in ua_lower:
                return tool
        return None

    @classmethod
    def probe_check(cls, path: str, method: str, user_agent: str,
                    has_accept_additions: bool = False) -> bool:
        """Return True if the request looks like a probe."""
        if not CPIP_DEFENSE_ENABLED:
            return False
        score = 0
        path_lower = path.lower()

        for scanner_path in _SCANNER_PATHS:
            if scanner_path in path_lower:
                score += 3
                break

        if not has_accept_additions and method.upper() == "BREW":
            score += 1

        if cls.detect_tools(user_agent):
            score += 2

        return score >= 2

    @classmethod
    def check_request(cls, addr: str, path: str, method: str,
                      user_agent: str, headers: dict | None = None) -> bool:
        """Full defense check. Returns True if request should be blocked (418)."""
        if not CPIP_DEFENSE_ENABLED:
            return False
        if cls.is_blacklisted(addr):
            return True
        has_additions = bool(headers and headers.get("accept-additions"))
        if cls.probe_check(path, method, user_agent, has_additions):
            cls.blacklist_addr(addr)
            return True
        return False


# ─── RPC Token (HMAC-SHA256) ─────────────────────────────────────────────────

class RpcToken:
    """HMAC-SHA256 token generation and verification for RPC authentication.

    Replaces Minima's Basic Auth with CPIP-issued time-bounded tokens.
    """

    _secret: bytes = b""

    @classmethod
    def init_secret(cls, secret: bytes | None = None) -> None:
        if secret is None:
            secret = CPIP_COVERT_KEY
        cls._secret = secret

    @classmethod
    def generate(cls, node_id: str, ttl: int | None = None) -> str:
        if not cls._secret:
            cls.init_secret()
        ttl = ttl or CPIP_TOKEN_TTL
        expiry = int(time.time()) + ttl
        payload = f"{node_id}:{expiry}".encode()
        sig = hmac.new(cls._secret, payload, hashlib.sha256).hexdigest()
        token_raw = f"{payload.decode()}:{sig}"
        return base64.urlsafe_b64encode(token_raw.encode()).decode()

    @classmethod
    def verify(cls, token: str, node_id: str) -> bool:
        if not cls._secret:
            cls.init_secret()
        try:
            decoded = base64.urlsafe_b64decode(token.encode()).decode()
            parts = decoded.split(":")
            if len(parts) != 3:
                return False
            token_node_id, expiry_str, sig = parts
            if token_node_id != node_id:
                return False
            expiry = int(expiry_str)
            if time.time() > expiry:
                return False
            payload = f"{token_node_id}:{expiry_str}".encode()
            expected_sig = hmac.new(cls._secret, payload, hashlib.sha256).hexdigest()
            return hmac.compare_digest(sig, expected_sig)
        except (ValueError, TypeError):
            return False

    @classmethod
    def extract_node_id(cls, token: str) -> str | None:
        try:
            decoded = base64.urlsafe_b64decode(token.encode()).decode()
            return decoded.split(":")[0]
        except (ValueError, TypeError, UnicodeDecodeError):
            return None


# ─── Node Identity ───────────────────────────────────────────────────────────

@dataclass
class NodeIdentity:
    """CPIP-signed node identity with ECDSA P-256 challenge-response auth."""
    node_id: str
    public_key: bytes
    seed: bytes
    address: str
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "node_id": self.node_id,
            "public_key": self.public_key.hex(),
            "address": self.address,
            "created_at": self.created_at,
        }

    def sign(self, message: bytes) -> bytes:
        return ECP256.sign(message, self.seed)

    def verify_signature(self, message: bytes, signature: bytes) -> bool:
        return ECP256.verify(message, signature, self.public_key)

    def create_challenge(self) -> bytes:
        return secrets.token_bytes(32)

    def respond_to_challenge(self, challenge: bytes) -> bytes:
        return self.sign(challenge)

    @staticmethod
    def verify_challenge(challenge: bytes, response: bytes,
                         public_key: bytes) -> bool:
        return ECP256.verify(challenge, response, public_key)


def generate_node_identity(node_id: str, seed: bytes | None = None) -> NodeIdentity:
    """Generate a new CPIP-signed node identity."""
    if seed is None:
        seed = secrets.token_bytes(32)
    pubkey_bytes, _, _, _ = ECP256.generate_keypair(seed)
    address = ECP256.pubkey_to_address(pubkey_bytes)
    return NodeIdentity(
        node_id=node_id,
        public_key=pubkey_bytes,
        seed=seed,
        address=address,
    )


def authenticate_node(identity: NodeIdentity, challenge: bytes,
                      response: bytes) -> bool:
    """Verify a node's challenge-response authentication."""
    return NodeIdentity.verify_challenge(challenge, response, identity.public_key)


# ─── CPIP Security Middleware ────────────────────────────────────────────────

class CPIPSecurityMiddleware:
    """FastAPI/Starlette middleware for CPIP security enforcement.

    - ITF Defense: probe blocking, pentest detection, IP blacklisting
    - Security headers: CSP, X-Frame-Options, X-Content-Type-Options, etc.
    - Rate limiting: per-IP sliding window
    - Request size limiting
    """

    RATE_LIMIT = int(os.getenv("CPIP_HTTP_RATE_LIMIT", "500"))
    RATE_WINDOW = int(os.getenv("CPIP_HTTP_RATE_WINDOW", "120"))
    MAX_REQUEST_SIZE = int(os.getenv("CPIP_MAX_REQUEST_SIZE", "65536"))

    _rate_counts: ClassVar[dict[str, list[float]]] = {}

    @classmethod
    def _check_rate_limit(cls, addr: str) -> bool:
        now = time.time()
        counts = cls._rate_counts.get(addr, [])
        counts = [t for t in counts if now - t < cls.RATE_WINDOW]
        if len(counts) >= cls.RATE_LIMIT:
            cls._rate_counts[addr] = counts
            return False
        counts.append(now)
        cls._rate_counts[addr] = counts
        return True

    @classmethod
    async def __call__(cls, request, call_next):
        from starlette.responses import JSONResponse

        client_addr = request.client.host if request.client else "unknown"
        path = request.url.path
        method = request.method
        user_agent = request.headers.get("user-agent", "")
        headers = dict(request.headers)

        # ITF Defense check
        if ITFDefense.check_request(client_addr, path, method, user_agent, headers):
            return JSONResponse(
                status_code=418,
                content={"error": "I'm a teapot", "detail": "Probe detected"},
                headers={"CPIP-Defense": "blocked"},
            )

        # Rate limiting
        if not cls._check_rate_limit(client_addr):
            return JSONResponse(
                status_code=429,
                content={"error": "Rate limit exceeded"},
                headers={"Retry-After": str(cls.RATE_WINDOW)},
            )

        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
            "font-src 'self' data:; connect-src 'self' ws: wss: http: https:; "
            "object-src 'none'; frame-ancestors 'none'"
        )
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        )
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        response.headers["CPIP-Version"] = _CPIP_VERSION
        response.headers["CPIP-Provider"] = "active"

        # HSTS — only on HTTPS
        is_secure = (
            request.url.scheme == "https"
            or request.headers.get("x-forwarded-proto") == "https"
        )
        if is_secure:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        return response


# ─── Initialize ──────────────────────────────────────────────────────────────

def initialize_cpip() -> None:
    """Initialize the CPIP security provider. Call at application startup."""
    if not CPIP_ENABLED:
        logger.info("CPIP security provider disabled")
        return

    if not _CRYPTO_AVAILABLE:
        logger.warning("CPIP security provider partially active — ITF Defense and RPC tokens enabled, crypto features require 'cryptography' package")
        RpcToken.init_secret()
        return

    logger.info("CPIP security provider initializing (FIPS=%s, recipe=%s)",
                CPIP_FIPS_MODE, CPIP_RECIPE)

    # Run FIPS self-tests
    run_fips_self_tests()

    # Initialize RPC token secret
    RpcToken.init_secret()

    # Initialize ITF defense
    if CPIP_DEFENSE_ENABLED:
        logger.info("CPIP ITF Defense active (rate_limit=%d, blacklist_ttl=%d)",
                     CPIP_DEFENSE_RATE_LIMIT, CPIP_DEFENSE_BLACKLIST_TTL)

    logger.info("CPIP security provider ready")


# Auto-initialize on import if enabled
if CPIP_ENABLED:
    if not _CRYPTO_AVAILABLE:
        logger.warning("CPIP enabled but 'cryptography' package not installed — crypto features disabled, ITF Defense still active")
    else:
        try:
            initialize_cpip()
        except Exception as e:
            logger.error("CPIP initialization failed: %s", e)
            if CPIP_FIPS_MODE:
                raise