
export type AppId = 'minima-node' | 'system-monitor' | 'terminal' | 'wallet' | 'ai-assistant' | 'maxima-messenger' | 'cluster-manager' | 'depai-executor' | 'settings' | 'setup-wizard' | 'imager-utility' | 'file-explorer' | 'visual-studio';

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