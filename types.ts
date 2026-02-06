
export type AppId = 'minima-node' | 'system-monitor' | 'terminal' | 'wallet' | 'ai-assistant' | 'maxima-messenger' | 'cluster-manager' | 'depai-executor' | 'settings' | 'setup-wizard' | 'imager-utility' | 'file-explorer';

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

export interface ClusterNode {
  id: string;
  name: string;
  ip: string;
  hat: HatType;
  status: 'online' | 'offline' | 'processing' | 'provisioning' | 'awaiting-os';
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
}

export interface MaximaMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
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
