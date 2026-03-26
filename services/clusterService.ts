/**
 * Cluster Service
 *
 * Frontend service that provides reactive cluster state to UI components.
 * Fetches state from the backend API, which aggregates data from
 * the Maxima cluster protocol and local node metrics.
 */

import { ClusterNode } from '../types';
import { ExceptionFilter } from '../utils/core';
import { getApiUrl } from '../utils/api';
import type { ClusterState, NodeInfo, ProvenanceEvent } from '../types/cluster-protocol';

type Listener = () => void;

class ClusterServiceImpl {
  private listeners: Listener[] = [];
  private _nodes: ClusterNode[] = [];
  private _clusterState: ClusterState | null = null;
  private _provenanceEvents: ProvenanceEvent[] = [];
  private ws: WebSocket | null = null;

  constructor() {
    this.fetchUpdates();
    setInterval(() => this.fetchUpdates(), 5000);
    this.connectWebSocket();
  }

  // ─── Data Fetching ─────────────────────────────────────────────────────

  private async fetchUpdates(): Promise<void> {
    try {
      // Fetch nodes (backwards compatible)
      const nodesResponse = await fetch(getApiUrl('/api/cluster/nodes'));
      if (nodesResponse.ok) {
        this._nodes = await nodesResponse.json() as ClusterNode[];
      }

      // Fetch full cluster state
      const stateResponse = await fetch(getApiUrl('/api/cluster/state'));
      if (stateResponse.ok) {
        const data = await stateResponse.json();
        if (data && data.clusterId) {
          this._clusterState = data as ClusterState;
        }
      }

      this.emit();
    } catch (e) {
      ExceptionFilter.handle(e, 'clusterService.fetchUpdates');
    }
  }

  // ─── WebSocket for Real-time Updates ───────────────────────────────────

  private connectWebSocket(): void {
    try {
      const wsUrl = getApiUrl('/ws/cluster').replace('http', 'ws');
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'cluster-state') {
            this._clusterState = data.payload as ClusterState;
            this.emit();
          } else if (data.type === 'cluster-event') {
            this._provenanceEvents.push(data.payload);
            if (this._provenanceEvents.length > 200) {
              this._provenanceEvents = this._provenanceEvents.slice(-100);
            }
            this.emit();
          }
        } catch (e) {
          ExceptionFilter.handle(e, 'clusterService.wsMessage');
        }
      };

      this.ws.onclose = () => {
        // Reconnect after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.ws.onerror = () => {
        // Will trigger onclose → reconnect
      };
    } catch (e) {
      // WebSocket not available (e.g., SSR) — rely on polling
    }
  }

  // ─── Subscriptions ─────────────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(): void { this.listeners.forEach(l => l()); }

  // ─── Getters ───────────────────────────────────────────────────────────

  get nodes(): ClusterNode[] { return this._nodes; }
  get clusterState(): ClusterState | null { return this._clusterState; }
  get provenanceEvents(): ProvenanceEvent[] { return this._provenanceEvents; }

  get nodeCount(): number {
    return this._clusterState?.nodes.length || this._nodes.length;
  }

  get activeNodeCount(): number {
    if (this._clusterState) {
      return this._clusterState.nodes.filter(n => n.status === 'active').length;
    }
    return this._nodes.filter(n => n.status === 'online').length;
  }

  // ─── Cluster Actions ───────────────────────────────────────────────────

  async provisionNode(id: string): Promise<void> {
    try {
      const response = await fetch(getApiUrl('/api/cluster/provision'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      this.fetchUpdates();
    } catch (e) {
      ExceptionFilter.handle(e, 'clusterService.provisionNode');
    }
  }

  /** Request to join a cluster via Maxima */
  async joinCluster(masterAddress: string): Promise<boolean> {
    try {
      const response = await fetch(getApiUrl('/api/cluster/join'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterAddress })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json() as { success: boolean };
      this.fetchUpdates();
      return result.success;
    } catch (e) {
      ExceptionFilter.handle(e, 'clusterService.joinCluster');
      return false;
    }
  }

  /** Submit a workload to a specific node */
  async submitExec(targetNodeId: string, command: string, args: string[] = []): Promise<boolean> {
    try {
      const response = await fetch(getApiUrl('/api/cluster/exec'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetNodeId, command, args })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json() as { success: boolean };
      return result.success;
    } catch (e) {
      ExceptionFilter.handle(e, 'clusterService.submitExec');
      return false;
    }
  }

  /** Get provenance history from on-chain records */
  async fetchProvenance(): Promise<ProvenanceEvent[]> {
    try {
      const response = await fetch(getApiUrl('/api/cluster/provenance'));
      if (response.ok) {
        const events = await response.json() as ProvenanceEvent[];
        this._provenanceEvents = events;
        return events;
      }
    } catch (e) {
      ExceptionFilter.handle(e, 'clusterService.fetchProvenance');
    }
    return this._provenanceEvents;
  }
}

export const clusterService = new ClusterServiceImpl();
