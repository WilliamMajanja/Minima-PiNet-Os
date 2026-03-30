
/** Built-in application identifiers. */
export type BuiltinAppId = 'minima-node' | 'system-monitor' | 'terminal' | 'wallet' | 'ai-assistant' | 'maxima-messenger' | 'cluster-manager' | 'depai-executor' | 'settings' | 'setup-wizard' | 'imager-utility' | 'file-explorer' | 'visual-studio' | 'dapp-store';

/**
 * AppId is either a built-in id or a dynamic DApp id prefixed with `dapp:`.
 * Example dynamic id: `dapp:com.example.my-cool-dapp`
 */
export type AppId = BuiltinAppId | `dapp:${string}`;

/** Helper to check whether an AppId refers to an installed DApp. */
export function isDAppId(id: AppId): id is `dapp:${string}` {
  return id.startsWith('dapp:');
}

/** Extract the manifest id from a DApp AppId. */
export function extractDAppId(id: AppId): string {
  return id.slice(5); // strip "dapp:"
}

export type AIProvider = 'gemini' | 'airllm';

export interface WindowState {
  id: AppId;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  zIndex: number;
}

export interface NodeStats {
  blockHeight: number;
  peers: number;
  status: 'Synced' | 'Syncing' | 'Offline';
  uptime: string;
  version: string;
}

export interface SystemStats {
  cpu: number;
  ram: number;
  temp: number;
  disk: number;
}

export type HatType = 'AI_NPU' | 'SENSE' | 'SSD_NVME' | 'NONE';

export type OSMode = 'pinet' | 'raspbian' | 'ubuntu' | 'debian';

export interface HypervisorSwitchResult {
  success: boolean;
  targetOS: OSMode;
  nodeId: string;
  transport: 'local-systemd' | 'rpi-connect' | 'local-boot-profile';
  strategy: 'systemd' | 'boot-profile';
  action: 'restart' | 'isolate' | 'stage-reboot';
  unit: string;
  requiresReboot: boolean;
  rebootScheduled: boolean;
  bootMount?: string;
  profileLabel?: 'host' | 'pinet';
  fallbackReason?: string;
  stdout: string;
  stderr: string;
}

export interface ClusterNode {
  id: string;
  name: string;
  ip: string;
  hat: HatType;
  status: 'online' | 'offline' | 'processing' | 'provisioning' | 'awaiting-os';
  role?: 'master' | 'worker';
  maximaAddress?: string;
  lastHeartbeat?: number;
  metrics: {
    cpu: number;
    ram: number;
    temp: number;
    npu?: number;
    iops?: number;
    env?: { temp: number; humidity: number; pressure: number };
  };
}

export interface M402Session {
  sessionId: string;
  ratePerSecond: number;
  totalBurned: number;
  isActive: boolean;
  startTime?: number;
}

export interface MaximaContact {
  name: string;
  address: string;
  status: 'online' | 'offline';
  lastSeen: string;
  publicKey?: string;
  sameChain?: boolean;
}

export interface MaximaMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  application?: string;
  delivered?: boolean;
}

// VFS Types
export interface VFSNode {
  name: string;
  type: 'file' | 'dir';
  content?: string;
  children?: VFSNode[];
  size?: number;
  modified: number;
  permissions: string;
}

// ─── Enterprise Edge Types ────────────────────────────────────────────────────

export type IndustryVertical =
  | 'agritech'
  | 'logistics'
  | 'ev-infrastructure'
  | 'telecoms'
  | 'industrial-iot'
  | 'smart-city'
  | 'general';

export type ConnectivityLayer = '5g' | '4g-lte' | '2g-gsm' | 'wireguard-mesh' | 'offline';

export interface EdgeCapabilities {
  aiRuntime: 'tflite' | 'onnx' | 'gguf' | 'none';
  containerRuntime: 'k3s' | 'docker' | 'none';
  storage: 'ipfs' | 'local' | 'none';
  connectivity: ConnectivityLayer[];
  hasNpu: boolean;
  hasNvme: boolean;
  hasSenseHat: boolean;
}

// Re-export cluster protocol types for convenience
export type { ClusterState, NodeInfo, NodeRole, NodeStatus, NodeMetrics, ProvenanceEvent } from './types/cluster-protocol';

// Re-export DApp types for convenience
export type { DAppManifest, InstalledDApp, DAppKind, DAppPermission, DAppStatus } from './types/dapp';
