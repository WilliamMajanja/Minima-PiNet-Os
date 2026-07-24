"""PiNet-OS Default Configuration — Central configuration constants."""
import os

# Network Ports
# Minima port layout: base port (9001) = P2P, base+2 = MDS file server,
# base+3 = MDS command server, base+4 = RPC HTTP server.
# PiNet-OS connects to the RPC port (base+4) for all command communication.
MINIMA_P2P_PORT = int(os.getenv("PINET_MINIMA_P2P_PORT", "9001"))
MINIMA_RPC_PORT = int(os.getenv("PINET_MINIMA_RPC_PORT", "9005"))
MINIMA_MDS_FILE_PORT = MINIMA_P2P_PORT + 2
MINIMA_MDS_CMD_PORT = MINIMA_P2P_PORT + 3
DESKTOP_PORT = int(os.getenv("PINET_DESKTOP_PORT", "3000"))
CLUSTER_API_PORT = int(os.getenv("PINET_CLUSTER_API_PORT", "9090"))

# Minima RPC
MINIMA_RPC_URL = os.getenv("MINIMA_RPC_URL", f"http://127.0.0.1:{MINIMA_RPC_PORT}")
MINIMA_RPC_TIMEOUT = int(os.getenv("PINET_MINIMA_RPC_TIMEOUT", "10000"))
MINIMA_RPC_RETRIES = int(os.getenv("PINET_MINIMA_RPC_RETRIES", "3"))
MINIMA_RPC_RETRY_DELAY = float(os.getenv("PINET_MINIMA_RPC_RETRY_DELAY", "1.0"))
MINIMA_VERSION = "1.0.49-cpip"

# Cluster Timing
HEARTBEAT_INTERVAL = 10000
HEARTBEAT_TIMEOUT = 30000
NODE_OFFLINE_TIMEOUT = 60000
CLUSTER_POLL_INTERVAL = 5000

# Provenance
PROVENANCE_BATCH_INTERVAL = 60000
PROVENANCE_BURN_AMOUNT = "0.001"

# Maxima Protocol
MAXIMA_APPLICATION = "pinet-cluster"
MAXIMA_POLL_INTERVAL = 3000

# Enterprise Edge
EDGE_AI_RUNTIMES = ("tflite", "onnx", "gguf")
CONTAINER_RUNTIME = "k3s"
STORAGE_BACKEND = "ipfs"
MESH_VPN = "wireguard"

# Connectivity Layers
CONNECTIVITY_LAYERS = {
    "PRIMARY": "5g",
    "SECONDARY": "4g-lte",
    "FALLBACK": "2g-gsm",
    "MESH": "wireguard-mesh",
}

# Thermal
THERMAL_WARNING = 80
THERMAL_CRITICAL = 85

# DApp Platform
DAPP_INSTALL_DIR = os.getenv("PINET_DAPP_DIR", "dapps-installed")
DAPP_MAX_INSTALLED = 50
DAPP_MAX_UPLOAD_BYTES = 50 * 1024 * 1024
DAPP_ALLOWED_EXTENSIONS = (".zip", ".tar.gz", ".mds.zip")

# Version
PINET_VERSION = "3.0.0"

# Kernel / Init System
DEFAULT_RUN_LEVEL = 5
INIT_SERVICE_TIMEOUT = 30000
MAX_SERVICE_RESTARTS = 5
SERVICE_RESTART_DELAY = 5000

# Process Manager
MAX_PROCESSES = 4096
PROCESS_TICK_INTERVAL = 1000
ZOMBIE_REAP_INTERVAL = 5000

# Memory Manager
OOM_THRESHOLD_PERCENT = 95
DEFAULT_PROCESS_MEM_LIMIT = 512 * 1024 * 1024
PAGE_SIZE = 4096

# Scheduler
SCHEDULER_TICK_MS = 1000
DEFAULT_TIME_SLICE_MS = 10
CRON_CHECK_INTERVAL = 60000

# Logging
SYSLOG_MAX_ENTRIES = 10000
SYSLOG_DEFAULT_SEVERITY = "debug"
SYSLOG_ROTATION_PERCENT = 0.8

# User Management
DEFAULT_USER = "pi"
DEFAULT_UID = 1000
DEFAULT_SHELL = "/bin/bash"
SESSION_TIMEOUT = 3600000
PASSWORD_MIN_LENGTH = 8

# Network
DEFAULT_DNS = ["8.8.8.8", "8.8.4.4", "1.1.1.1"]
WIREGUARD_PORT = 51820
FIREWALL_DEFAULT_POLICY = "deny"

# Power Management
WATCHDOG_TIMEOUT = 30000
DEFAULT_CPU_GOVERNOR = "ondemand"
POWER_POLL_INTERVAL = 5000

# Security
AUDIT_MAX_ENTRIES = 10000
INTEGRITY_CHECK_INTERVAL = 3600000
MAX_FAILED_LOGINS = 5
LOCKOUT_DURATION = 300000

# CPIP Security Provider (The Coffee Protocol)
CPIP_VERSION = "5.0.5"
CPIP_ENABLED = os.getenv("CPIP_ENABLED", "1") == "1"
CPIP_FIPS_MODE = os.getenv("CPIP_FIPS", "0") == "1"
CPIP_PROVIDER_URL = os.getenv("CPIP_PROVIDER_URL", "http://127.0.0.1:4180")
CPIP_API_KEY = os.getenv("CPIP_API_KEY", "")
CPIP_NODE_CERT = os.getenv("CPIP_NODE_CERT", "")
CPIP_NODE_KEY = os.getenv("CPIP_NODE_KEY", "")
CPIP_DEFENSE_ENABLED = os.getenv("CPIP_DEFENSE_ENABLED", "1") == "1"
CPIP_COVERT_KEY = os.getenv("CPIP_COVERT_KEY", "")
CPIP_RECIPE = os.getenv("CPIP_RECIPE", "minima")
CPIP_TOKEN_TTL = int(os.getenv("CPIP_TOKEN_TTL", "300"))
CPIP_RPC_AUTH = os.getenv("CPIP_RPC_AUTH", "1") == "1"
CPIP_HTTP_RATE_LIMIT = int(os.getenv("CPIP_HTTP_RATE_LIMIT", "500"))
CPIP_HTTP_RATE_WINDOW = int(os.getenv("CPIP_HTTP_RATE_WINDOW", "120"))
CPIP_MTLS_CERT = os.getenv("CPIP_MTLS_CERT", "")
CPIP_MTLS_KEY = os.getenv("CPIP_MTLS_KEY", "")
CPIP_MTLS_CA = os.getenv("CPIP_MTLS_CA", "")

# CORS
CORS_ORIGIN = os.getenv("PINET_CORS_ORIGIN", "")

# CPIP Auto-Update
CPIP_UPDATE_AUTO = os.getenv("CPIP_UPDATE_AUTO", "1") == "1"
CPIP_UPDATE_INTERVAL = int(os.getenv("CPIP_UPDATE_INTERVAL", "86400"))  # 24h

# Files Root
FILES_ROOT = os.path.realpath(os.getenv("PINET_FILES_ROOT", os.getcwd()))

# GitHub
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_REPO = os.getenv("GITHUB_REPO", "WilliamMajanja/Minima-PiNet-Os")

# AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ─── v1.3.0: On-Device LLM Gateway ────────────────────────────────────────────
LLM_GATEWAY_ENABLED = os.getenv("PINET_LLM_GATEWAY", "1") == "1"
LLM_GATEWAY_URL = os.getenv("PINET_LLM_GATEWAY_URL", "http://127.0.0.1:11434")
LLM_GATEWAY_TIMEOUT = int(os.getenv("PINET_LLM_GATEWAY_TIMEOUT", "120"))
LLM_DEFAULT_MODEL = os.getenv("PINET_LLM_DEFAULT_MODEL", "llama3.2:3b")
LLM_MAX_CONTEXT = int(os.getenv("PINET_LLM_MAX_CONTEXT", "4096"))
LLM_MODELS_DIR = os.getenv("PINET_LLM_MODELS_DIR", "/opt/pinet/llm-models")
LLM_FALLBACK_TO_GEMINI = os.getenv("PINET_LLM_FALLBACK_GEMINI", "1") == "1"

# ─── v1.3.0: Multi-Tenant LXC Quotas ─────────────────────────────────────────
LXC_QUOTA_ENABLED = os.getenv("PINET_LXC_QUOTA", "1") == "1"
LXC_DEFAULT_CPU_LIMIT = int(os.getenv("PINET_LXC_DEFAULT_CPU", "50"))
LXC_DEFAULT_RAM_MB = int(os.getenv("PINET_LXC_DEFAULT_RAM_MB", "512"))
LXC_DEFAULT_DISK_GB = int(os.getenv("PINET_LXC_DEFAULT_DISK_GB", "10"))
LXC_DEFAULT_IO_IOPS = int(os.getenv("PINET_LXC_DEFAULT_IO_IOPS", "1000"))
LXC_MAX_TENANTS = int(os.getenv("PINET_LXC_MAX_TENANTS", "16"))

# ─── v1.3.0: Hardware Key-Wrap (TPM 2.0) ─────────────────────────────────────
TPM_KEYWRAP_ENABLED = os.getenv("PINET_TPM_KEYWRAP", "1") == "1"
TPM_DEVICE = os.getenv("PINET_TPM_DEVICE", "/dev/tpm0")
TPM_SRK_HANDLE = int(os.getenv("PINET_TPM_SRK_HANDLE", "0x81000001"), 0)
TPM_SEALED_KEY_PATH = os.getenv("PINET_TPM_SEALED_KEY", "/opt/pinet/identity/cpip-sealed.key")

# ─── v1.3.0: CPIP PQ-TLS (Post-Quantum TLS) ──────────────────────────────────
CPIP_PQ_TLS_ENABLED = os.getenv("CPIP_PQ_TLS", "0") == "1"
CPIP_PQ_KEM = os.getenv("CPIP_PQ_KEM", "kyber768")
CPIP_PQ_HYBRID = os.getenv("CPIP_PQ_HYBRID", "1") == "1"

# ─── v2.0.0: Formal Attestation ──────────────────────────────────────────────
ATTESTATION_ENABLED = os.getenv("PINET_ATTESTATION", "1") == "1"
ATTESTATION_PCR_BANK = os.getenv("PINET_ATTESTATION_PCR_BANK", "sha256")
ATTESTATION_VERIFY_URL = os.getenv("PINET_ATTESTATION_VERIFY_URL", "")

# ─── v3.0.0: Confidential Computing Enclaves ──────────────────────────────────
ENCLAVE_ENABLED = os.getenv("PINET_ENCLAVE", "1") == "1"
ENCLAVE_DEFAULT_MEM_GB = int(os.getenv("PINET_ENCLAVE_DEFAULT_MEM_GB", "1"))
ENCLAVE_MAX_PER_NODE = int(os.getenv("PINET_ENCLAVE_MAX_PER_NODE", "8"))
ENCLAVE_TEE_TYPE = os.getenv("PINET_ENCLAVE_TEE_TYPE", "auto")

# ─── v3.0.0: Verifiable Compute Proofs (zkVM) ────────────────────────────────
ZK_PROVER_ENABLED = os.getenv("PINET_ZK_PROVER", "1") == "1"
ZK_PROVER_TIMEOUT = int(os.getenv("PINET_ZK_PROVER_TIMEOUT", "300"))
ZK_PROVER_MEM_MB = int(os.getenv("PINET_ZK_PROVER_MEM_MB", "1024"))

# ─── v3.0.0: Decentralized Compute Marketplace ────────────────────────────────
MARKETPLACE_ENABLED = os.getenv("PINET_MARKETPLACE", "1") == "1"
MARKETPLACE_MAX_LISTINGS = int(os.getenv("PINET_MARKETPLACE_MAX_LISTINGS", "100"))
MARKETPLACE_ESCROW_TOKENS = os.getenv("PINET_MARKETPLACE_ESCROW_TOKENS", "minima")
MARKETPLACE_CURATION_DEPOSIT = os.getenv("PINET_MARKETPLACE_CURATION_DEPOSIT", "100")

# ─── SSL/TLS & HSTS (CPIP + mkcert) ──────────────────────────────────────────
SSL_ENABLED = os.getenv("PINET_SSL_ENABLED", "1") == "1"
SSL_DIR = os.getenv("PINET_SSL_DIR", os.path.expanduser("~/.local/share/pinet/ssl"))
SSL_CERT_FILE = os.getenv("PINET_SSL_CERT", "")
SSL_KEY_FILE = os.getenv("PINET_SSL_KEY", "")
SSL_HOSTS = os.getenv("PINET_SSL_HOSTS", "localhost,127.0.0.1,::1")
MKCERT_PATH = os.getenv("PINET_MKCERT_PATH", "mkcert")

# HSTS (HTTP Strict Transport Security)
HSTS_ENABLED = os.getenv("PINET_HSTS_ENABLED", "1") == "1"
HSTS_MAX_AGE = int(os.getenv("PINET_HSTS_MAX_AGE", "31536000"))
HSTS_INCLUDE_SUBDOMAINS = os.getenv("PINET_HSTS_INCLUDE_SUBDOMAINS", "1") == "1"
HSTS_PRELOAD = os.getenv("PINET_HSTS_PRELOAD", "1") == "1"