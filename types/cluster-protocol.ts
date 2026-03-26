/**
 * Maxima Cluster Protocol — Message Types and Interfaces
 *
 * All cluster coordination is done via Maxima messages (Minima's encrypted P2P bus).
 * No central API server needed — nodes communicate directly through their Minima nodes.
 */

// ─── Message Types ───────────────────────────────────────────────────────────

export enum ClusterMessageType {
  /** Worker → Master: Request to join the cluster */
  JOIN_REQUEST = 'CLUSTER_JOIN_REQUEST',
  /** Master → Worker: Acceptance with cluster config and peer list */
  JOIN_ACCEPT = 'CLUSTER_JOIN_ACCEPT',
  /** Master → Worker: Rejection with reason */
  JOIN_REJECT = 'CLUSTER_JOIN_REJECT',
  /** All → Master: Periodic liveness signal with metrics */
  HEARTBEAT = 'CLUSTER_HEARTBEAT',
  /** Master → All: Broadcast updated cluster topology */
  STATE_UPDATE = 'CLUSTER_STATE_UPDATE',
  /** Master → Worker: Execute a workload */
  EXEC_REQUEST = 'CLUSTER_EXEC_REQUEST',
  /** Worker → Master: Workload execution result */
  EXEC_RESULT = 'CLUSTER_EXEC_RESULT',
  /** Any → Any: Filesystem/state snapshot transfer */
  SNAPSHOT = 'CLUSTER_SNAPSHOT',
  /** All → Master: System metrics broadcast */
  METRICS = 'CLUSTER_METRICS',
  /** Any → Master: Graceful departure from cluster */
  DEREGISTER = 'NODE_DEREGISTER',
}

// ─── Message Envelope ────────────────────────────────────────────────────────

export interface ClusterMessage<T = unknown> {
  type: ClusterMessageType;
  sender: string;        // Node ID of the sender
  senderAddress: string; // Maxima address of sender
  timestamp: number;     // Unix epoch ms
  nonce: string;         // Unique message ID
  clusterId: string;     // Cluster UUID
  payload: T;
}

// ─── Payload Types ───────────────────────────────────────────────────────────

export interface JoinRequestPayload {
  nodeId: string;
  hostname: string;
  platform: string;       // e.g., "Linux aarch64"
  version: string;        // PiNet-OS version
  capabilities: string[]; // e.g., ["ai-npu", "ssd-nvme", "sensor-hat"]
}

export interface JoinAcceptPayload {
  clusterId: string;
  assignedRole: NodeRole;
  peers: PeerInfo[];
  clusterConfig: {
    heartbeatInterval: number;
    heartbeatTimeout: number;
  };
}

export interface JoinRejectPayload {
  reason: string;
}

export interface HeartbeatPayload {
  nodeId: string;
  role: NodeRole;
  uptime: number;         // seconds
  metrics: NodeMetrics;
}

export interface StateUpdatePayload {
  version: number;        // Monotonically increasing topology version
  nodes: NodeInfo[];
  removedNodes: string[]; // Node IDs removed since last update
}

export interface ExecRequestPayload {
  workloadId: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  timeout: number;        // ms
}

export interface ExecResultPayload {
  workloadId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface SnapshotPayload {
  snapshotId: string;
  sourceNodeId: string;
  type: 'full' | 'incremental';
  size: number;
  checksum: string;
  data: string;           // Base64 encoded
}

export interface MetricsPayload {
  nodeId: string;
  timestamp: number;
  metrics: NodeMetrics;
}

export interface DeregisterPayload {
  nodeId: string;
  reason: string;
}

// ─── Node Types ──────────────────────────────────────────────────────────────

export type NodeRole = 'master' | 'worker';
export type NodeStatus = 'active' | 'stale' | 'offline' | 'pending' | 'provisioning';

export interface NodeMetrics {
  cpu: number;           // Percentage (0-100)
  ram: number;           // Percentage (0-100)
  temp: number;          // Celsius
  disk: number;          // Percentage (0-100)
  networkIn: number;     // bytes/sec
  networkOut: number;    // bytes/sec
  npu?: number;          // NPU utilization percentage (if Hailo-8L present)
  iops?: number;         // Storage IOPS (if NVMe present)
}

export interface NodeInfo {
  nodeId: string;
  maximaAddress: string;
  hostname: string;
  role: NodeRole;
  status: NodeStatus;
  lastHeartbeat: number; // Unix epoch ms
  joinedAt: number;      // Unix epoch ms
  metrics: NodeMetrics;
  capabilities: string[];
  version: string;
}

export interface PeerInfo {
  nodeId: string;
  maximaAddress: string;
  role: NodeRole;
}

// ─── Cluster State ───────────────────────────────────────────────────────────

export interface ClusterState {
  clusterId: string;
  version: number;       // Topology version
  masterNodeId: string;
  masterAddress: string;
  nodes: NodeInfo[];
  createdAt: number;
  lastUpdated: number;
}

// ─── Provenance Event Types ──────────────────────────────────────────────────

export enum ProvenanceEventType {
  NODE_JOIN = 'NODE_JOIN',
  NODE_LEAVE = 'NODE_LEAVE',
  ROLE_CHANGE = 'ROLE_CHANGE',
  WORKLOAD_SUBMIT = 'WORKLOAD_SUBMIT',
  WORKLOAD_COMPLETE = 'WORKLOAD_COMPLETE',
  STATE_CHANGE = 'STATE_CHANGE',
  SNAPSHOT_CREATED = 'SNAPSHOT_CREATED',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
}

export interface ProvenanceEvent {
  pinetVersion: string;
  eventType: ProvenanceEventType;
  clusterId: string;
  nodeId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

// ─── Enterprise Use Case Metadata ────────────────────────────────────────────

export type IndustryVertical =
  | 'agritech'
  | 'logistics'
  | 'ev-infrastructure'
  | 'telecoms'
  | 'industrial-iot'
  | 'smart-city'
  | 'general';

export interface EdgeWorkloadConfig {
  vertical: IndustryVertical;
  workloadType: 'ai-inference' | 'data-collection' | 'container' | 'storage' | 'relay';
  priority: 'critical' | 'standard' | 'background';
  connectivityRequirement: 'high-bandwidth' | 'standard' | 'low-bandwidth' | 'offline-capable';
}
