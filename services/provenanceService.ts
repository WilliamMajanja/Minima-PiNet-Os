/**
 * Provenance Service
 *
 * Records significant cluster events as Minima burn transactions with structured metadata.
 * Every event creates an immutable, on-chain audit trail.
 * Events are batched to minimize chain bloat.
 */

import { MinimaRpcClient } from './minimaRpcClient';
import { PROVENANCE_BATCH_INTERVAL, PROVENANCE_BURN_AMOUNT, PINET_VERSION } from '../config/defaults';
import { ProvenanceEventType } from '../types/cluster-protocol';
import type { ProvenanceEvent } from '../types/cluster-protocol';
import { ExceptionFilter } from '../utils/core';

// ─── Provenance Service ──────────────────────────────────────────────────────

class ProvenanceServiceImpl {
  private eventQueue: ProvenanceEvent[] = [];
  private batchInterval: ReturnType<typeof setInterval> | null = null;
  private clusterId = '';
  private nodeId = '';
  private enabled = true;
  private history: ProvenanceEvent[] = []; // Local cache of recorded events

  // ─── Initialization ────────────────────────────────────────────────────

  initialize(clusterId: string, nodeId: string, enabled = true): void {
    this.clusterId = clusterId;
    this.nodeId = nodeId;
    this.enabled = enabled;

    if (this.enabled) {
      this.startBatchProcessor();
    }
  }

  // ─── Event Recording ──────────────────────────────────────────────────

  /** Record a node joining the cluster */
  recordNodeJoin(nodeId: string, hostname: string, role: string): void {
    this.enqueue(ProvenanceEventType.NODE_JOIN, {
      joinedNodeId: nodeId,
      hostname,
      role,
    });
  }

  /** Record a node leaving the cluster */
  recordNodeLeave(nodeId: string, reason: string): void {
    this.enqueue(ProvenanceEventType.NODE_LEAVE, {
      leftNodeId: nodeId,
      reason,
    });
  }

  /** Record a role change (e.g., worker promoted to master) */
  recordRoleChange(nodeId: string, oldRole: string, newRole: string): void {
    this.enqueue(ProvenanceEventType.ROLE_CHANGE, {
      changedNodeId: nodeId,
      oldRole,
      newRole,
    });
  }

  /** Record a workload submission */
  recordWorkloadSubmit(workloadId: string, command: string, targetNodeId: string): void {
    this.enqueue(ProvenanceEventType.WORKLOAD_SUBMIT, {
      workloadId,
      command,
      targetNodeId,
    });
  }

  /** Record a workload completion */
  recordWorkloadComplete(workloadId: string, exitCode: number, durationMs: number): void {
    this.enqueue(ProvenanceEventType.WORKLOAD_COMPLETE, {
      workloadId,
      exitCode,
      durationMs,
      success: exitCode === 0,
    });
  }

  /** Record a cluster state change */
  recordStateChange(description: string, details: Record<string, unknown> = {}): void {
    this.enqueue(ProvenanceEventType.STATE_CHANGE, {
      description,
      ...details,
    });
  }

  /** Record a snapshot creation */
  recordSnapshotCreated(snapshotId: string, sourceNodeId: string, size: number): void {
    this.enqueue(ProvenanceEventType.SNAPSHOT_CREATED, {
      snapshotId,
      sourceNodeId,
      size,
    });
  }

  /** Record a config change */
  recordConfigChange(key: string, oldValue: string, newValue: string): void {
    this.enqueue(ProvenanceEventType.CONFIG_CHANGE, {
      key,
      oldValue,
      newValue,
    });
  }

  // ─── Internal Queue ────────────────────────────────────────────────────

  private enqueue(eventType: ProvenanceEventType, payload: Record<string, unknown>): void {
    const event: ProvenanceEvent = {
      pinetVersion: PINET_VERSION,
      eventType,
      clusterId: this.clusterId,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      payload,
    };

    this.eventQueue.push(event);
    this.history.push(event);

    // Keep local history bounded
    if (this.history.length > 1000) {
      this.history = this.history.slice(-500);
    }
  }

  // ─── Batch Processor ──────────────────────────────────────────────────

  private startBatchProcessor(): void {
    this.batchInterval = setInterval(async () => {
      await this.flush();
    }, PROVENANCE_BATCH_INTERVAL);
  }

  /** Flush pending events as a burn transaction */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const batch = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const burnData = {
        type: 'pinet-provenance',
        version: PINET_VERSION,
        clusterId: this.clusterId,
        batchSize: batch.length,
        events: batch,
        recordedAt: Date.now(),
      };

      const result = await MinimaRpcClient.burn(PROVENANCE_BURN_AMOUNT, burnData);

      if (!result.status) {
        // If burn failed, re-queue events for next batch
        this.eventQueue = [...batch, ...this.eventQueue];
        console.warn('[Provenance] Burn transaction failed, events re-queued.');
      }
    } catch (e) {
      // Re-queue on error
      this.eventQueue = [...batch, ...this.eventQueue];
      ExceptionFilter.handle(e, 'provenanceService.flush');
    }
  }

  // ─── Query ─────────────────────────────────────────────────────────────

  /** Get local event history (cached) */
  getHistory(options?: {
    eventType?: ProvenanceEventType;
    nodeId?: string;
    limit?: number;
  }): ProvenanceEvent[] {
    let events = [...this.history];

    if (options?.eventType) {
      events = events.filter(e => e.eventType === options.eventType);
    }
    if (options?.nodeId) {
      events = events.filter(e => e.nodeId === options.nodeId || e.payload?.joinedNodeId === options.nodeId);
    }
    if (options?.limit) {
      events = events.slice(-options.limit);
    }

    return events;
  }

  /** Get pending events count */
  get pendingCount(): number {
    return this.eventQueue.length;
  }

  /** Get total recorded events count */
  get totalRecorded(): number {
    return this.history.length;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  stop(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
    // Attempt final flush
    this.flush().catch(e => ExceptionFilter.handle(e, 'provenanceService.stop'));
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const provenanceService = new ProvenanceServiceImpl();
export const ProvenanceService = provenanceService;
