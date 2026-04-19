/**
 * PiNet-OS Default Configuration
 * Central configuration constants for the entire system
 */

// ─── Network Ports ───────────────────────────────────────────────────────────

export const MINIMA_RPC_PORT = parseInt(process.env.PINET_MINIMA_RPC_PORT || '', 10) || 9001;
export const DESKTOP_PORT = parseInt(process.env.PINET_DESKTOP_PORT || '', 10) || 3000;
export const CLUSTER_API_PORT = parseInt(process.env.PINET_CLUSTER_API_PORT || '', 10) || 9090;

// ─── Minima RPC ──────────────────────────────────────────────────────────────

export const MINIMA_RPC_URL = process.env.MINIMA_RPC_URL || `http://127.0.0.1:${MINIMA_RPC_PORT}`;
export const MINIMA_RPC_TIMEOUT = 5000; // ms

// ─── Cluster Timing ──────────────────────────────────────────────────────────

export const HEARTBEAT_INTERVAL = 10000;   // 10 seconds between heartbeats
export const HEARTBEAT_TIMEOUT = 30000;    // 30 seconds before node is "stale"
export const NODE_OFFLINE_TIMEOUT = 60000; // 60 seconds before node is "offline"
export const CLUSTER_POLL_INTERVAL = 5000; // 5 seconds between state polls

// ─── Provenance ──────────────────────────────────────────────────────────────

export const PROVENANCE_BATCH_INTERVAL = 60000; // 60 seconds — aggregate then burn
export const PROVENANCE_BURN_AMOUNT = '0.001';  // Minima burn amount per provenance entry

// ─── Maxima Protocol ─────────────────────────────────────────────────────────

export const MAXIMA_APPLICATION = 'pinet-cluster';
export const MAXIMA_POLL_INTERVAL = 3000;  // 3 seconds between polling for messages

// ─── Enterprise Edge Capabilities ────────────────────────────────────────────

export const EDGE_AI_RUNTIMES = ['tflite', 'onnx', 'gguf'] as const;
export const CONTAINER_RUNTIME = 'k3s';
export const STORAGE_BACKEND = 'ipfs';
export const MESH_VPN = 'wireguard';

// ─── Connectivity Layers ─────────────────────────────────────────────────────

export const CONNECTIVITY_LAYERS = {
  PRIMARY: '5g',
  SECONDARY: '4g-lte',
  FALLBACK: '2g-gsm',
  MESH: 'wireguard-mesh',
} as const;

// ─── Thermal Thresholds (Pi 5 specific) ──────────────────────────────────────

export const THERMAL_WARNING = 80;  // °C
export const THERMAL_CRITICAL = 85; // °C

// ─── DApp Platform ───────────────────────────────────────────────────────────

/** Directory where installed DApps are stored on disk (relative to cwd) */
export const DAPP_INSTALL_DIR = process.env.PINET_DAPP_DIR || 'dapps-installed';
/** Maximum number of DApps that can be installed */
export const DAPP_MAX_INSTALLED = 50;
/** Maximum archive size for a DApp upload (bytes) — 50 MB */
export const DAPP_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
/** Allowed archive extensions for DApp installation */
export const DAPP_ALLOWED_EXTENSIONS = ['.zip', '.tar.gz', '.mds.zip'] as const;

// ─── Version ─────────────────────────────────────────────────────────────────

export const PINET_VERSION = '1.1.0';
export const MINIMA_VERSION = '1.0.35';

// ─── Kernel / Init System ────────────────────────────────────────────────────

export const DEFAULT_RUN_LEVEL = 5;           // Graphical desktop
export const INIT_SERVICE_TIMEOUT = 30000;    // 30s timeout for service startup
export const MAX_SERVICE_RESTARTS = 5;        // Max auto-restart attempts
export const SERVICE_RESTART_DELAY = 5000;    // 5s between restart attempts

// ─── Process Manager ─────────────────────────────────────────────────────────

export const MAX_PROCESSES = 4096;
export const PROCESS_TICK_INTERVAL = 1000;    // 1s between process stats updates
export const ZOMBIE_REAP_INTERVAL = 5000;     // 5s between zombie reaping

// ─── Memory Manager ─────────────────────────────────────────────────────────

export const OOM_THRESHOLD_PERCENT = 95;      // OOM killer triggers at 95% usage
export const DEFAULT_PROCESS_MEM_LIMIT = 512 * 1024 * 1024; // 512MB default per-process
export const PAGE_SIZE = 4096;

// ─── Scheduler ──────────────────────────────────────────────────────────────

export const SCHEDULER_TICK_MS = 1000;        // Scheduler tick interval
export const DEFAULT_TIME_SLICE_MS = 10;      // CFS default time slice
export const CRON_CHECK_INTERVAL = 60000;     // Check cron jobs every minute

// ─── System Logging ─────────────────────────────────────────────────────────

export const SYSLOG_MAX_ENTRIES = 10000;
export const SYSLOG_DEFAULT_SEVERITY = 'debug' as const;
export const SYSLOG_ROTATION_PERCENT = 0.8;   // Keep 80% on rotation

// ─── User Management ────────────────────────────────────────────────────────

export const DEFAULT_USER = 'pi';
export const DEFAULT_UID = 1000;
export const DEFAULT_SHELL = '/bin/bash';
export const SESSION_TIMEOUT = 3600000;       // 1 hour session timeout
export const PASSWORD_MIN_LENGTH = 8;

// ─── Network ────────────────────────────────────────────────────────────────

export const DEFAULT_DNS = ['8.8.8.8', '8.8.4.4', '1.1.1.1'];
export const WIREGUARD_PORT = 51820;
export const FIREWALL_DEFAULT_POLICY = 'deny' as const;

// ─── Power Management ───────────────────────────────────────────────────────

export const WATCHDOG_TIMEOUT = 30000;        // 30s watchdog timeout
export const DEFAULT_CPU_GOVERNOR = 'ondemand' as const;
export const POWER_POLL_INTERVAL = 5000;      // 5s between power status polls

// ─── Security ───────────────────────────────────────────────────────────────

export const AUDIT_MAX_ENTRIES = 10000;
export const INTEGRITY_CHECK_INTERVAL = 3600000; // 1 hour between integrity checks
export const MAX_FAILED_LOGINS = 5;           // Lock account after 5 failures
export const LOCKOUT_DURATION = 300000;       // 5 minute lockout
