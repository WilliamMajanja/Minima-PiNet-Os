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

// ─── Version ─────────────────────────────────────────────────────────────────

export const PINET_VERSION = '3.0.0';
export const MINIMA_VERSION = '1.0.35';
