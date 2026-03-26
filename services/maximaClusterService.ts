/**
 * Maxima Cluster Service
 *
 * Handles all cluster coordination via Maxima messages.
 * This is the control plane — no central API server needed.
 * Nodes communicate directly through their Minima nodes' Maxima protocol.
 */

import { MinimaRpcClient } from './minimaRpcClient';
import { MAXIMA_APPLICATION, MAXIMA_POLL_INTERVAL, HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT, NODE_OFFLINE_TIMEOUT } from '../config/defaults';
import type {
  ClusterMessage,
  ClusterMessageType,
  ClusterState,
  NodeInfo,
  NodeRole,
  NodeStatus,
  NodeMetrics,
  JoinRequestPayload,
  JoinAcceptPayload,
  HeartbeatPayload,
  StateUpdatePayload,
  ExecRequestPayload,
  ExecResultPayload,
  MetricsPayload,
  DeregisterPayload,
} from '../types/cluster-protocol';
import { ClusterMessageType as MsgType } from '../types/cluster-protocol';
import { ExceptionFilter } from '../utils/core';
import { getApiUrl } from '../utils/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type ClusterEventListener = (event: ClusterMessage) => void;
type StateChangeListener = (state: ClusterState) => void;

// ─── Maxima Cluster Service ──────────────────────────────────────────────────

class MaximaClusterServiceImpl {
  private clusterState: ClusterState | null = null;
  private eventListeners: ClusterEventListener[] = [];
  private stateListeners: StateChangeListener[] = [];
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private nodeCheckInterval: ReturnType<typeof setInterval> | null = null;
  private localNodeId = '';
  private localAddress = '';
  private localRole: NodeRole = 'worker';

  // ─── Initialization ────────────────────────────────────────────────────

  async initialize(nodeId: string, role: NodeRole): Promise<void> {
    this.localNodeId = nodeId;
    this.localRole = role;

    // Get our Maxima address
    try {
      const info = await MinimaRpcClient.maximaInfo();
      if (info.status && info.response) {
        this.localAddress = info.response.address || '';
      }
    } catch (e) {
      ExceptionFilter.handle(e, 'maximaClusterService.initialize');
    }

    // If master, create initial cluster state
    if (role === 'master') {
      this.clusterState = {
        clusterId: this.generateClusterId(),
        version: 1,
        masterNodeId: nodeId,
        masterAddress: this.localAddress,
        nodes: [{
          nodeId,
          maximaAddress: this.localAddress,
          hostname: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
          role: 'master',
          status: 'active',
          lastHeartbeat: Date.now(),
          joinedAt: Date.now(),
          metrics: { cpu: 0, ram: 0, temp: 0, disk: 0, networkIn: 0, networkOut: 0 },
          capabilities: [],
          version: '3.0.0',
        }],
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };
    }

    // Start polling for incoming Maxima messages
    this.startPolling();

    // Start heartbeat broadcasting
    this.startHeartbeat();

    // Start node health checking (master only)
    if (role === 'master') {
      this.startNodeHealthCheck();
    }
  }

  // ─── Message Dispatch ──────────────────────────────────────────────────

  private async handleMessage(message: ClusterMessage): Promise<void> {
    // Notify all event listeners
    this.eventListeners.forEach(l => l(message));

    switch (message.type) {
      case MsgType.JOIN_REQUEST:
        await this.handleJoinRequest(message as ClusterMessage<JoinRequestPayload>);
        break;
      case MsgType.JOIN_ACCEPT:
        await this.handleJoinAccept(message as ClusterMessage<JoinAcceptPayload>);
        break;
      case MsgType.HEARTBEAT:
        this.handleHeartbeat(message as ClusterMessage<HeartbeatPayload>);
        break;
      case MsgType.STATE_UPDATE:
        this.handleStateUpdate(message as ClusterMessage<StateUpdatePayload>);
        break;
      case MsgType.EXEC_REQUEST:
        await this.handleExecRequest(message as ClusterMessage<ExecRequestPayload>);
        break;
      case MsgType.EXEC_RESULT:
        this.handleExecResult(message as ClusterMessage<ExecResultPayload>);
        break;
      case MsgType.METRICS:
        this.handleMetrics(message as ClusterMessage<MetricsPayload>);
        break;
      case MsgType.DEREGISTER:
        this.handleDeregister(message as ClusterMessage<DeregisterPayload>);
        break;
    }
  }

  // ─── Join Protocol ─────────────────────────────────────────────────────

  async requestJoin(masterAddress: string): Promise<void> {
    const message = this.createMessage<JoinRequestPayload>(MsgType.JOIN_REQUEST, {
      nodeId: this.localNodeId,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
      platform: 'Linux aarch64',
      version: '3.0.0',
      capabilities: [],
    });

    await this.sendMaximaMessage(masterAddress, message);
  }

  private async handleJoinRequest(message: ClusterMessage<JoinRequestPayload>): Promise<void> {
    if (this.localRole !== 'master' || !this.clusterState) return;

    const { nodeId, hostname, version, capabilities } = message.payload;

    // Add node to cluster
    const newNode: NodeInfo = {
      nodeId,
      maximaAddress: message.senderAddress,
      hostname,
      role: 'worker',
      status: 'active',
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
      metrics: { cpu: 0, ram: 0, temp: 0, disk: 0, networkIn: 0, networkOut: 0 },
      capabilities,
      version,
    };

    this.clusterState.nodes.push(newNode);
    this.clusterState.version++;
    this.clusterState.lastUpdated = Date.now();

    // Send acceptance
    const peers = this.clusterState.nodes.map(n => ({
      nodeId: n.nodeId,
      maximaAddress: n.maximaAddress,
      role: n.role,
    }));

    const acceptMessage = this.createMessage<JoinAcceptPayload>(MsgType.JOIN_ACCEPT, {
      clusterId: this.clusterState.clusterId,
      assignedRole: 'worker',
      peers,
      clusterConfig: {
        heartbeatInterval: HEARTBEAT_INTERVAL,
        heartbeatTimeout: HEARTBEAT_TIMEOUT,
      },
    });

    await this.sendMaximaMessage(message.senderAddress, acceptMessage);

    // Broadcast state update to all nodes
    await this.broadcastStateUpdate();
    this.emitStateChange();
  }

  private async handleJoinAccept(message: ClusterMessage<JoinAcceptPayload>): Promise<void> {
    const { clusterId, assignedRole, peers, clusterConfig } = message.payload;

    this.localRole = assignedRole;
    this.clusterState = {
      clusterId,
      version: 1,
      masterNodeId: message.sender,
      masterAddress: message.senderAddress,
      nodes: peers.map(p => ({
        nodeId: p.nodeId,
        maximaAddress: p.maximaAddress,
        hostname: '',
        role: p.role,
        status: 'active' as NodeStatus,
        lastHeartbeat: Date.now(),
        joinedAt: Date.now(),
        metrics: { cpu: 0, ram: 0, temp: 0, disk: 0, networkIn: 0, networkOut: 0 },
        capabilities: [],
        version: '3.0.0',
      })),
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };

    this.emitStateChange();
  }

  // ─── Heartbeat ─────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      if (!this.clusterState) return;

      const metrics = await this.getLocalMetrics();
      const heartbeat = this.createMessage<HeartbeatPayload>(MsgType.HEARTBEAT, {
        nodeId: this.localNodeId,
        role: this.localRole,
        uptime: Math.floor((Date.now() - (this.clusterState?.createdAt || Date.now())) / 1000),
        metrics,
      });

      // Send to master (or broadcast if master)
      if (this.localRole === 'master') {
        this.handleHeartbeat(heartbeat);
      } else if (this.clusterState?.masterAddress) {
        await this.sendMaximaMessage(this.clusterState.masterAddress, heartbeat);
      }
    }, HEARTBEAT_INTERVAL);
  }

  private handleHeartbeat(message: ClusterMessage<HeartbeatPayload>): void {
    if (!this.clusterState) return;

    const node = this.clusterState.nodes.find(n => n.nodeId === message.payload.nodeId);
    if (node) {
      node.lastHeartbeat = Date.now();
      node.metrics = message.payload.metrics;
      node.status = 'active';
      this.clusterState.lastUpdated = Date.now();
      this.emitStateChange();
    }
  }

  // ─── Node Health Check (Master Only) ───────────────────────────────────

  private startNodeHealthCheck(): void {
    this.nodeCheckInterval = setInterval(() => {
      if (!this.clusterState || this.localRole !== 'master') return;

      const now = Date.now();
      let changed = false;

      this.clusterState.nodes.forEach(node => {
        if (node.nodeId === this.localNodeId) return;

        const elapsed = now - node.lastHeartbeat;
        let newStatus: NodeStatus = node.status;

        if (elapsed > NODE_OFFLINE_TIMEOUT) {
          newStatus = 'offline';
        } else if (elapsed > HEARTBEAT_TIMEOUT) {
          newStatus = 'stale';
        } else {
          newStatus = 'active';
        }

        if (newStatus !== node.status) {
          node.status = newStatus;
          changed = true;
        }
      });

      if (changed) {
        this.clusterState.lastUpdated = now;
        this.emitStateChange();
        this.broadcastStateUpdate();
      }
    }, HEARTBEAT_INTERVAL);
  }

  // ─── State Updates ─────────────────────────────────────────────────────

  private handleStateUpdate(message: ClusterMessage<StateUpdatePayload>): void {
    if (!this.clusterState) return;

    const { version, nodes, removedNodes } = message.payload;
    if (version > this.clusterState.version) {
      // Update cluster with the new node list from master
      this.clusterState.version = version;
      this.clusterState.nodes = nodes;
      this.clusterState.lastUpdated = Date.now();
      this.emitStateChange();
    }
  }

  private async broadcastStateUpdate(): Promise<void> {
    if (!this.clusterState || this.localRole !== 'master') return;

    const stateUpdate = this.createMessage<StateUpdatePayload>(MsgType.STATE_UPDATE, {
      version: this.clusterState.version,
      nodes: this.clusterState.nodes,
      removedNodes: [],
    });

    // Send to all nodes except self
    for (const node of this.clusterState.nodes) {
      if (node.nodeId !== this.localNodeId && node.maximaAddress) {
        await this.sendMaximaMessage(node.maximaAddress, stateUpdate);
      }
    }
  }

  // ─── Workload Execution ────────────────────────────────────────────────

  async submitExecRequest(targetNodeId: string, command: string, args: string[] = [], timeout = 30000): Promise<void> {
    if (!this.clusterState) return;

    const targetNode = this.clusterState.nodes.find(n => n.nodeId === targetNodeId);
    if (!targetNode) return;

    const execRequest = this.createMessage<ExecRequestPayload>(MsgType.EXEC_REQUEST, {
      workloadId: `wl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      command,
      args,
      env: {},
      timeout,
    });

    await this.sendMaximaMessage(targetNode.maximaAddress, execRequest);
  }

  private async handleExecRequest(message: ClusterMessage<ExecRequestPayload>): Promise<void> {
    // Forward exec request to backend for actual execution
    try {
      const response = await fetch(getApiUrl('/api/cluster/exec-local'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.payload),
      });

      const result = await response.json() as { exitCode: number; stdout: string; stderr: string; durationMs: number };

      // Send result back to requester
      const execResult = this.createMessage<ExecResultPayload>(MsgType.EXEC_RESULT, {
        workloadId: message.payload.workloadId,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
      });

      await this.sendMaximaMessage(message.senderAddress, execResult);
    } catch (e) {
      ExceptionFilter.handle(e, 'maximaClusterService.handleExecRequest');
    }
  }

  private handleExecResult(message: ClusterMessage<ExecResultPayload>): void {
    // Notify event listeners (UI will pick this up)
    this.eventListeners.forEach(l => l(message));
  }

  // ─── Metrics ───────────────────────────────────────────────────────────

  private handleMetrics(message: ClusterMessage<MetricsPayload>): void {
    if (!this.clusterState) return;

    const node = this.clusterState.nodes.find(n => n.nodeId === message.payload.nodeId);
    if (node) {
      node.metrics = message.payload.metrics;
      node.lastHeartbeat = Date.now();
      this.emitStateChange();
    }
  }

  // ─── Deregistration ────────────────────────────────────────────────────

  async deregister(reason = 'graceful shutdown'): Promise<void> {
    if (!this.clusterState) return;

    const deregMsg = this.createMessage<DeregisterPayload>(MsgType.DEREGISTER, {
      nodeId: this.localNodeId,
      reason,
    });

    if (this.localRole !== 'master' && this.clusterState.masterAddress) {
      await this.sendMaximaMessage(this.clusterState.masterAddress, deregMsg);
    }

    this.stop();
  }

  private handleDeregister(message: ClusterMessage<DeregisterPayload>): void {
    if (!this.clusterState || this.localRole !== 'master') return;

    this.clusterState.nodes = this.clusterState.nodes.filter(
      n => n.nodeId !== message.payload.nodeId
    );
    this.clusterState.version++;
    this.clusterState.lastUpdated = Date.now();
    this.emitStateChange();
    this.broadcastStateUpdate();
  }

  // ─── Polling ───────────────────────────────────────────────────────────

  private startPolling(): void {
    this.pollInterval = setInterval(async () => {
      try {
        const result = await MinimaRpcClient.maximaPoll();
        if (result.status && result.response) {
          for (const msg of result.response) {
            if (msg.application === MAXIMA_APPLICATION) {
              try {
                const clusterMsg = JSON.parse(msg.data) as ClusterMessage;
                await this.handleMessage(clusterMsg);
              } catch (e) {
                ExceptionFilter.handle(e, 'maximaClusterService.parseMessage');
              }
            }
          }
        }
      } catch (e) {
        ExceptionFilter.handle(e, 'maximaClusterService.poll');
      }
    }, MAXIMA_POLL_INTERVAL);
  }

  // ─── Messaging ─────────────────────────────────────────────────────────

  private async sendMaximaMessage(to: string, message: ClusterMessage): Promise<boolean> {
    try {
      const result = await MinimaRpcClient.maximaSend(to, MAXIMA_APPLICATION, message);
      return result.status;
    } catch (e) {
      ExceptionFilter.handle(e, 'maximaClusterService.sendMaximaMessage');
      return false;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private createMessage<T>(type: ClusterMessageType, payload: T): ClusterMessage<T> {
    return {
      type,
      sender: this.localNodeId,
      senderAddress: this.localAddress,
      timestamp: Date.now(),
      nonce: `${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
      clusterId: this.clusterState?.clusterId || '',
      payload,
    };
  }

  private generateClusterId(): string {
    return `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }

  private async getLocalMetrics(): Promise<NodeMetrics> {
    try {
      const response = await fetch(getApiUrl('/api/system-stats'));
      if (response.ok) {
        const data = await response.json() as { cpu: number; ram: number; temp: number; disk: number };
        return {
          cpu: data.cpu || 0,
          ram: data.ram || 0,
          temp: data.temp || 0,
          disk: data.disk || 0,
          networkIn: 0,
          networkOut: 0,
        };
      }
    } catch (e) {
      // Fallback
    }
    return { cpu: 0, ram: 0, temp: 0, disk: 0, networkIn: 0, networkOut: 0 };
  }

  // ─── Public API ────────────────────────────────────────────────────────

  onClusterEvent(listener: ClusterEventListener): () => void {
    this.eventListeners.push(listener);
    return () => { this.eventListeners = this.eventListeners.filter(l => l !== listener); };
  }

  onStateChange(listener: StateChangeListener): () => void {
    this.stateListeners.push(listener);
    return () => { this.stateListeners = this.stateListeners.filter(l => l !== listener); };
  }

  private emitStateChange(): void {
    if (this.clusterState) {
      this.stateListeners.forEach(l => l(this.clusterState!));
    }
  }

  get state(): ClusterState | null {
    return this.clusterState;
  }

  get nodeId(): string {
    return this.localNodeId;
  }

  get role(): NodeRole {
    return this.localRole;
  }

  stop(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.nodeCheckInterval) clearInterval(this.nodeCheckInterval);
    this.pollInterval = null;
    this.heartbeatInterval = null;
    this.nodeCheckInterval = null;
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const maximaClusterService = new MaximaClusterServiceImpl();
export const MaximaClusterService = maximaClusterService;
