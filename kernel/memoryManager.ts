/**
 * PiNet-OS Memory Manager
 * Tracks memory allocation, limits, and provides system memory statistics.
 * Manages per-process memory regions and enforces OOM policies.
 */

import os from 'os';
import type {
  MemoryRegion,
  MemoryStats,
  ProcessMemoryInfo,
  MemoryLimit,
} from '../types/kernel.js';

// ─── Memory Manager ─────────────────────────────────────────────────────────

class MemoryManagerImpl {
  private regions = new Map<string, MemoryRegion>();
  private limits = new Map<number, MemoryLimit>();
  private nextAddress = 0x400000; // start after 4MB
  private pageSize = 4096;
  private pageFaults = 0;
  private oomKills = 0;
  private listeners: Array<() => void> = [];

  constructor() {
    // Set default limits for init
    this.limits.set(1, { pid: 1, softLimitBytes: 512 * 1024 * 1024, hardLimitBytes: 1024 * 1024 * 1024, oomScore: 0 });
  }

  // ─── Allocation ─────────────────────────────────────────────────────────

  /** Allocate a memory region for a process. Returns the start address or -1 on failure. */
  allocate(pid: number, size: number, type: MemoryRegion['type'], name?: string): number {
    const limit = this.limits.get(pid);
    const currentUsage = this.getProcessUsage(pid);

    // Check hard limit
    if (limit && currentUsage + size > limit.hardLimitBytes) {
      return -1; // ENOMEM
    }

    const aligned = Math.ceil(size / this.pageSize) * this.pageSize;
    const start = this.nextAddress;
    this.nextAddress += aligned;

    const regionId = `${pid}:${start.toString(16)}`;
    const region: MemoryRegion = {
      id: regionId,
      start,
      size: aligned,
      type,
      permissions: type === 'code' ? 'rx' : type === 'data' || type === 'heap' || type === 'mmap' || type === 'shared' ? 'rw' : 'rw',
      owner: pid,
      name,
    };

    this.regions.set(regionId, region);
    this.notify();
    return start;
  }

  /** Free a memory region. */
  free(pid: number, regionId: string): boolean {
    const region = this.regions.get(regionId);
    if (!region || region.owner !== pid) return false;
    this.regions.delete(regionId);
    this.notify();
    return true;
  }

  /** Free all memory owned by a process. */
  freeAll(pid: number): void {
    for (const [id, region] of this.regions) {
      if (region.owner === pid) this.regions.delete(id);
    }
    this.limits.delete(pid);
    this.notify();
  }

  // ─── Limits ─────────────────────────────────────────────────────────────

  /** Set memory limits for a process. */
  setLimit(pid: number, softLimitBytes: number, hardLimitBytes: number, oomScore = 500): void {
    this.limits.set(pid, { pid, softLimitBytes, hardLimitBytes, oomScore });
  }

  /** Get memory limit for a process. */
  getLimit(pid: number): MemoryLimit | undefined {
    return this.limits.get(pid);
  }

  // ─── Queries ────────────────────────────────────────────────────────────

  /** Get total memory used by a process. */
  private getProcessUsage(pid: number): number {
    let total = 0;
    for (const region of this.regions.values()) {
      if (region.owner === pid) total += region.size;
    }
    return total;
  }

  /** Get detailed memory information for a process. */
  getProcessMemory(pid: number): ProcessMemoryInfo {
    const processRegions: MemoryRegion[] = [];
    let vss = 0;
    let shared = 0;
    let priv = 0;

    for (const region of this.regions.values()) {
      if (region.owner === pid) {
        processRegions.push(region);
        vss += region.size;
        if (region.type === 'shared') shared += region.size;
        else priv += region.size;
      }
    }

    return {
      pid,
      vssBytes: vss,
      rssBytes: Math.floor(vss * 0.8), // approximation
      sharedBytes: shared,
      privateBytes: priv,
      swapBytes: 0,
      regions: processRegions,
    };
  }

  /** Get system-wide memory statistics. */
  getMemoryStats(): MemoryStats {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    // Estimate cached/buffers as a portion of used memory
    const cached = Math.floor(used * 0.25);
    const buffers = Math.floor(used * 0.05);

    return {
      totalBytes: total,
      usedBytes: used,
      freeBytes: free,
      cachedBytes: cached,
      buffersBytes: buffers,
      swapTotalBytes: 0, // Pi typically has no swap or uses zram
      swapUsedBytes: 0,
      swapFreeBytes: 0,
      shmBytes: this.getSharedMemorySize(),
      pageSize: this.pageSize,
      pagesTotal: Math.floor(total / this.pageSize),
      pagesFree: Math.floor(free / this.pageSize),
      pagesFaults: this.pageFaults,
      oomKills: this.oomKills,
    };
  }

  /** Get all memory regions. */
  getAllRegions(): MemoryRegion[] {
    return Array.from(this.regions.values());
  }

  /** Get total shared memory size. */
  private getSharedMemorySize(): number {
    let total = 0;
    for (const region of this.regions.values()) {
      if (region.type === 'shared') total += region.size;
    }
    return total;
  }

  /** Get all process memory limits. */
  getAllLimits(): MemoryLimit[] {
    return Array.from(this.limits.values());
  }

  // ─── OOM Killer ─────────────────────────────────────────────────────────

  /** Check for OOM condition and kill the highest-score process if needed. */
  checkOOM(): { killed: boolean; pid?: number; reason?: string } {
    const stats = this.getMemoryStats();
    const threshold = stats.totalBytes * 0.95; // 95% usage triggers OOM

    if (stats.usedBytes < threshold) return { killed: false };

    // Find highest OOM score process (excluding PID 0,1)
    let victim: { pid: number; score: number } | null = null;
    for (const [pid, limit] of this.limits) {
      if (pid <= 1) continue;
      if (!victim || limit.oomScore > victim.score) {
        victim = { pid, score: limit.oomScore };
      }
    }

    if (victim) {
      this.freeAll(victim.pid);
      this.oomKills++;
      this.notify();
      return { killed: true, pid: victim.pid, reason: `OOM: memory usage at ${((stats.usedBytes / stats.totalBytes) * 100).toFixed(1)}%` };
    }

    return { killed: false, reason: 'No eligible process to kill' };
  }

  /** Record a page fault. */
  recordPageFault(): void {
    this.pageFaults++;
  }

  // ─── Observer ───────────────────────────────────────────────────────────

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private notify(): void {
    for (const l of this.listeners) { try { l(); } catch { /* noop */ } }
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const memoryManager = new MemoryManagerImpl();
