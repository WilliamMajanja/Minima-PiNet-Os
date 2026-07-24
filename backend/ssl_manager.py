"""PiNet-OS — SSL/TLS Certificate Manager

Generates and manages local trusted certificates using mkcert (preferred)
or falls back to openssl self-signed certificates. Integrates with CPIP
for certificate lifecycle management.
"""
from __future__ import annotations

import datetime
import logging
import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger("pinet.ssl")

# ─── Configuration ─────────────────────────────────────────────────────────────

SSL_DIR = os.getenv("PINET_SSL_DIR", os.path.expanduser("~/.local/share/pinet/ssl"))
SSL_CERT_FILE = os.getenv("PINET_SSL_CERT", "")
SSL_KEY_FILE = os.getenv("PINET_SSL_KEY", "")
MKCERT_PATH = os.getenv("PINET_MKCERT_PATH", "mkcert")
SSL_ENABLED = os.getenv("PINET_SSL_ENABLED", "1") == "1"
SSL_DEFAULT_HOSTS = os.getenv("PINET_SSL_HOSTS", "localhost,127.0.0.1,::1").split(",")
SSL_CA_DIR = os.path.join(SSL_DIR, "ca")
SSL_CERTS_DIR = os.path.join(SSL_DIR, "certs")

# HSTS defaults
HSTS_ENABLED = os.getenv("PINET_HSTS_ENABLED", "1") == "1"
HSTS_MAX_AGE = int(os.getenv("PINET_HSTS_MAX_AGE", "31536000"))
HSTS_INCLUDE_SUBDOMAINS = os.getenv("PINET_HSTS_INCLUDE_SUBDOMAINS", "1") == "1"
HSTS_PRELOAD = os.getenv("PINET_HSTS_PRELOAD", "1") == "1"


# ─── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class SSLCertInfo:
    """Information about an SSL certificate."""
    cert_path: str = ""
    key_path: str = ""
    ca_cert_path: str = ""
    issuer: str = ""
    subject: str = ""
    not_before: str = ""
    not_after: str = ""
    serial: str = ""
    san: list[str] = field(default_factory=list)
    is_mkcert: bool = False
    is_valid: bool = False
    days_until_expiry: int = 0


@dataclass
class SSLStatus:
    """Overall SSL status."""
    ssl_enabled: bool = False
    mkcert_available: bool = False
    certs_exist: bool = False
    cert_info: Optional[SSLCertInfo] = None
    hsts_enabled: bool = False
    hsts_max_age: int = 31536000
    hsts_include_subdomains: bool = True
    hsts_preload: bool = True
    ssl_dir: str = ""


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _run(cmd: list[str], check: bool = False, capture: bool = True) -> subprocess.CompletedProcess:
    """Run a subprocess command with error handling."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            timeout=30,
        )
        if check and result.returncode != 0:
            logger.error("Command failed: %s → %s", " ".join(cmd), result.stderr.strip())
        return result
    except FileNotFoundError:
        logger.warning("Command not found: %s", cmd[0])
        return subprocess.CompletedProcess(cmd, returncode=127, stdout="", stderr=f"{cmd[0]}: not found")
    except subprocess.TimeoutExpired:
        logger.error("Command timed out: %s", " ".join(cmd))
        return subprocess.CompletedProcess(cmd, returncode=124, stdout="", stderr="timeout")


def _check_mkcert() -> bool:
    """Check if mkcert is available."""
    result = _run([MKCERT_PATH, "--version"])
    return result.returncode == 0


def _check_openssl() -> bool:
    """Check if openssl is available."""
    result = _run(["openssl", "version"])
    return result.returncode == 0


def _ensure_dirs() -> None:
    """Create SSL directory structure."""
    os.makedirs(SSL_DIR, exist_ok=True)
    os.makedirs(SSL_CA_DIR, exist_ok=True)
    os.makedirs(SSL_CERTS_DIR, exist_ok=True)


def _parse_cert_dates(cert_path: str) -> tuple[str, str, int]:
    """Parse certificate dates. Returns (not_before, not_after, days_until_expiry)."""
    try:
        result = _run([
            "openssl", "x509", "-in", cert_path,
            "-noout", "-startdate", "-enddate",
        ])
        if result.returncode != 0:
            return ("", "", 0)

        not_before = ""
        not_after = ""
        for line in result.stdout.strip().split("\n"):
            if line.startswith("notBefore="):
                not_before = line.split("=", 1)[1]
            elif line.startswith("notAfter="):
                not_after = line.split("=", 1)[1]

        if not_after:
            try:
                expiry = datetime.datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z")
                days = (expiry - datetime.datetime.utcnow()).days
                return (not_before, not_after, max(0, days))
            except ValueError:
                pass

        return (not_before, not_after, 0)
    except Exception:
        return ("", "", 0)


def _parse_cert_info(cert_path: str) -> dict:
    """Parse certificate details using openssl."""
    info = {
        "issuer": "",
        "subject": "",
        "serial": "",
        "san": [],
    }
    try:
        result = _run(["openssl", "x509", "-in", cert_path, "-noout", "-subject", "-issuer", "-serial", "-text"])
        if result.returncode != 0:
            return info

        for line in result.stdout.strip().split("\n"):
            line = line.strip()
            if line.startswith("subject="):
                info["subject"] = line.split("=", 1)[1]
            elif line.startswith("issuer="):
                info["issuer"] = line.split("=", 1)[1]
            elif line.startswith("serial="):
                info["serial"] = line.split("=", 1)[1]
            elif "DNS:" in line or "IP Address:" in line:
                for part in line.split(","):
                    part = part.strip()
                    if part.startswith("DNS:"):
                        info["san"].append(part[4:])
                    elif part.startswith("IP Address:"):
                        info["san"].append(part[12:])

        return info
    except Exception:
        return info


# ─── Certificate Generation ───────────────────────────────────────────────────

def generate_ca_mkcert() -> bool:
    """Generate a local CA using mkcert."""
    _ensure_dirs()

    ca_cert = os.path.join(SSL_CA_DIR, "rootCA.pem")
    ca_key = os.path.join(SSL_CA_DIR, "rootCA-key.pem")

    if os.path.exists(ca_cert) and os.path.exists(ca_key):
        logger.info("mkcert CA already exists at %s", ca_cert)
        return True

    result = _run([MKCERT_PATH, "-install"], check=False)
    if result.returncode == 0:
        logger.info("mkcert CA installed into system trust store")
    else:
        logger.warning("mkcert -install failed (may need sudo): %s", result.stderr.strip())

    result = _run([MKCERT_PATH, "-cert-file", ca_cert, "-key-file", ca_key, "pinet-ca"], check=True)
    if result.returncode == 0:
        logger.info("mkcert CA generated: %s", ca_cert)
        return True

    logger.error("Failed to generate mkcert CA: %s", result.stderr.strip())
    return False


def generate_cert_mkcert(hosts: list[str] | None = None) -> tuple[str, str] | None:
    """Generate a server certificate using mkcert signed by local CA.

    Returns (cert_path, key_path) or None on failure.
    """
    _ensure_dirs()

    if hosts is None:
        hosts = SSL_DEFAULT_HOSTS

    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    cert_path = os.path.join(SSL_CERTS_DIR, f"pinet-server-{timestamp}.pem")
    key_path = os.path.join(SSL_CERTS_DIR, f"pinet-server-{timestamp}-key.pem")

    cmd = [MKCERT_PATH, "-cert-file", cert_path, "-key-file", key_path] + hosts
    result = _run(cmd, check=True)

    if result.returncode == 0:
        logger.info("mkcert server cert generated for %s", ", ".join(hosts))
        # Create symlinks for easy access
        latest_cert = os.path.join(SSL_CERTS_DIR, "server.pem")
        latest_key = os.path.join(SSL_CERTS_DIR, "server-key.pem")
        for link, target in [(latest_cert, cert_path), (latest_key, key_path)]:
            if os.path.exists(link) or os.path.islink(link):
                os.remove(link)
            os.symlink(target, link)
        return (cert_path, key_path)

    logger.error("Failed to generate mkcert cert: %s", result.stderr.strip())
    return None


def generate_ca_openssl() -> bool:
    """Generate a self-signed CA using openssl."""
    _ensure_dirs()

    ca_cert = os.path.join(SSL_CA_DIR, "rootCA.pem")
    ca_key = os.path.join(SSL_CA_DIR, "rootCA-key.pem")

    if os.path.exists(ca_cert) and os.path.exists(ca_key):
        logger.info("openssl CA already exists at %s", ca_cert)
        return True

    cmd = [
        "openssl", "req", "-x509", "-newkey", "rsa:4096",
        "-keyout", ca_key, "-out", ca_cert,
        "-days", "3650", "-nodes",
        "-subj", "/C=GB/ST=London/L=London/O=PiNet-OS/CN=PiNet-OS Local CA",
    ]
    result = _run(cmd, check=True)

    if result.returncode == 0:
        os.chmod(ca_key, 0o600)
        logger.info("openssl CA generated: %s", ca_cert)
        return True

    logger.error("Failed to generate openssl CA: %s", result.stderr.strip())
    return False


def generate_cert_openssl(hosts: list[str] | None = None) -> tuple[str, str] | None:
    """Generate a self-signed server certificate using openssl.

    Returns (cert_path, key_path) or None on failure.
    """
    _ensure_dirs()

    if hosts is None:
        hosts = SSL_DEFAULT_HOSTS

    ca_cert = os.path.join(SSL_CA_DIR, "rootCA.pem")
    ca_key = os.path.join(SSL_CA_DIR, "rootCA-key.pem")

    if not os.path.exists(ca_cert) or not os.path.exists(ca_key):
        if not generate_ca_openssl():
            return None

    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    cert_path = os.path.join(SSL_CERTS_DIR, f"pinet-server-{timestamp}.pem")
    key_path = os.path.join(SSL_CERTS_DIR, f"pinet-server-{timestamp}-key.pem")
    csr_path = os.path.join(SSL_CERTS_DIR, f"pinet-server-{timestamp}.csr")
    ext_path = os.path.join(SSL_CERTS_DIR, f"pinet-server-{timestamp}.ext")

    # Build SAN extension
    san_lines = ["[req_ext]", "subjectAltName = @alt_names", "", "[alt_names]"]
    for i, host in enumerate(hosts, 1):
        host = host.strip()
        if host.replace(".", "").isdigit():
            san_lines.append(f"IP.{i} = {host}")
        else:
            san_lines.append(f"DNS.{i} = {host}")

    with open(ext_path, "w") as f:
        f.write("\n".join(san_lines) + "\n")

    # Generate key + CSR
    cmd_key = [
        "openssl", "req", "-newkey", "rsa:2048",
        "-keyout", key_path, "-out", csr_path,
        "-nodes", "-subj",
        "/C=GB/ST=London/L=London/O=PiNet-OS/CN=PiNet-OS Server",
    ]
    result = _run(cmd_key, check=True)
    if result.returncode != 0:
        return None

    # Sign with CA
    cmd_sign = [
        "openssl", "x509", "-req",
        "-in", csr_path, "-CA", ca_cert, "-CAkey", ca_key,
        "-CAcreateserial", "-out", cert_path,
        "-days", "825", "-extfile", ext_path, "-extensions", "req_ext",
    ]
    result = _run(cmd_sign, check=True)

    # Cleanup
    for f in [csr_path, ext_path]:
        if os.path.exists(f):
            os.remove(f)

    if result.returncode == 0:
        os.chmod(key_path, 0o600)
        logger.info("openssl cert generated for %s", ", ".join(hosts))

        latest_cert = os.path.join(SSL_CERTS_DIR, "server.pem")
        latest_key = os.path.join(SSL_CERTS_DIR, "server-key.pem")
        for link, target in [(latest_cert, cert_path), (latest_key, key_path)]:
            if os.path.exists(link) or os.path.islink(link):
                os.remove(link)
            os.symlink(target, link)
        return (cert_path, key_path)

    logger.error("Failed to sign cert: %s", result.stderr.strip())
    return None


# ─── Public API ────────────────────────────────────────────────────────────────

def generate_ca() -> bool:
    """Generate a local CA (mkcert preferred, openssl fallback)."""
    if _check_mkcert():
        return generate_ca_mkcert()
    elif _check_openssl():
        logger.info("mkcert not found, falling back to openssl")
        return generate_ca_openssl()
    else:
        logger.error("Neither mkcert nor openssl found. Cannot generate certificates.")
        return False


def generate_cert(hosts: list[str] | None = None) -> tuple[str, str] | None:
    """Generate a server certificate (mkcert preferred, openssl fallback)."""
    if _check_mkcert():
        return generate_cert_mkcert(hosts)
    elif _check_openssl():
        return generate_cert_openssl(hosts)
    else:
        logger.error("Neither mkcert nor openssl found. Cannot generate certificates.")
        return None


def get_cert_paths() -> tuple[str, str]:
    """Return the current cert and key paths (from env or latest generated)."""
    cert = SSL_CERT_FILE
    key = SSL_KEY_FILE

    if cert and key and os.path.exists(cert) and os.path.exists(key):
        return (cert, key)

    latest_cert = os.path.join(SSL_CERTS_DIR, "server.pem")
    latest_key = os.path.join(SSL_CERTS_DIR, "server-key.pem")

    if os.path.exists(latest_cert) and os.path.exists(latest_key):
        return (latest_cert, latest_key)

    return ("", "")


def ensure_certs() -> tuple[str, str]:
    """Ensure certificates exist, generating them if needed.

    Returns (cert_path, key_path). Empty strings if SSL is disabled or failed.
    """
    if not SSL_ENABLED:
        return ("", "")

    cert, key = get_cert_paths()
    if cert and key:
        return (cert, key)

    logger.info("No SSL certificates found — generating...")
    result = generate_cert()
    if result:
        return result

    logger.error("SSL certificate generation failed")
    return ("", "")


def get_cert_info() -> Optional[SSLCertInfo]:
    """Get detailed information about the current certificate."""
    cert, key = get_cert_paths()
    if not cert or not os.path.exists(cert):
        return None

    not_before, not_after, days = _parse_cert_dates(cert)
    info = _parse_cert_info(cert)

    is_mkcert = False
    if info["issuer"] and "mkcert" in info["issuer"].lower():
        is_mkcert = True

    return SSLCertInfo(
        cert_path=cert,
        key_path=key,
        ca_cert_path=os.path.join(SSL_CA_DIR, "rootCA.pem"),
        issuer=info.get("issuer", ""),
        subject=info.get("subject", ""),
        not_before=not_before,
        not_after=not_after,
        serial=info.get("serial", ""),
        san=info.get("san", []),
        is_mkcert=is_mkcert,
        is_valid=os.path.exists(cert) and os.path.exists(key),
        days_until_expiry=days,
    )


def get_status() -> SSLStatus:
    """Get overall SSL status."""
    return SSLStatus(
        ssl_enabled=SSL_ENABLED,
        mkcert_available=_check_mkcert(),
        certs_exist=os.path.exists(get_cert_paths()[0]),
        cert_info=get_cert_info(),
        hsts_enabled=HSTS_ENABLED,
        hsts_max_age=HSTS_MAX_AGE,
        hsts_include_subdomains=HSTS_INCLUDE_SUBDOMAINS,
        hsts_preload=HSTS_PRELOAD,
        ssl_dir=SSL_DIR,
    )


def delete_certs() -> bool:
    """Delete all generated certificates."""
    import shutil
    try:
        if os.path.exists(SSL_CERTS_DIR):
            shutil.rmtree(SSL_CERTS_DIR)
            os.makedirs(SSL_CERTS_DIR)
        if os.path.exists(SSL_CA_DIR):
            shutil.rmtree(SSL_CA_DIR)
            os.makedirs(SSL_CA_DIR)
        logger.info("All certificates deleted")
        return True
    except Exception as e:
        logger.error("Failed to delete certs: %s", e)
        return False


def install_ca_system() -> tuple[bool, str]:
    """Install the local CA into the system trust store.

    Returns (success, message).
    """
    if _check_mkcert():
        result = _run([MKCERT_PATH, "-install"])
        if result.returncode == 0:
            return (True, "CA installed into system trust store via mkcert")
        return (False, f"mkcert -install failed: {result.stderr.strip()}")

    # openssl fallback: copy CA cert to system trust store
    ca_cert = os.path.join(SSL_CA_DIR, "rootCA.pem")
    if not os.path.exists(ca_cert):
        return (False, "No CA certificate found. Generate one first with: pinet ssl generate")

    trust_dirs = [
        "/usr/local/share/ca-certificates",
        "/etc/ssl/certs",
    ]

    for trust_dir in trust_dirs:
        if os.path.isdir(trust_dir):
            dest = os.path.join(trust_dir, "pinet-os-ca.crt")
            try:
                import shutil
                shutil.copy2(ca_cert, dest)
                # Update trust store on Debian/Ubuntu
                if os.path.exists("/usr/sbin/update-ca-certificates"):
                    _run(["sudo", "update-ca-certificates"], check=False)
                return (True, f"CA installed to {dest}")
            except PermissionError:
                continue

    return (False, "Could not install CA — insufficient permissions. Try: sudo pinet ssl install")
