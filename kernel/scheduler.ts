/**
 * PiNet-OS Scheduler
 * Manages process scheduling, priority queues, CPU affinity, and cron jobs.
 * Implements a simplified Completely Fair Scheduler (CFS) model.
 */

import os from 'os';
import type {
  SchedulerEntry,
  SchedulerPolicy,
  SchedulerStats,
  CronJob,
} from '../types/kernel.js';

// ─── Cron Expression Parser ─────────────────────────────────────────────────

function parseCronField(field: string, min: number, max: number): number[] {
  if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => i + min);
  const values: number[] = [];
  for (const part of field.split(',')) {
    if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      const start = range === '*' ? min : parseInt(range, 10);
      for (let i = start; i <= max; i += step) values.push(i);
    } else if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      for (let i = a; i <= b; i++) values.push(i);
    } else {
      values.push(parseInt(part, 10));
    }
  }
  return values.filter(v => v >= min && v <= max);
}

function getNextCronRun(schedule: string, after: number = Date.now()): number {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return after + 60000; // fallback: 1 minute

  const [minF, hourF, domF, monF, dowF] = parts;
  const mins = parseCronField(minF, 0, 59);
  const hours = parseCronField(hourF, 0, 23);
  const doms = parseCronField(domF, 1, 31);
  const mons = parseCronField(monF, 1, 12);
  const dows = parseCronField(dowF, 0, 6);

  const date = new Date(after + 60000); // start searching from next minute
  date.setSeconds(0, 0);

  // Search up to 366 days ahead
  for (let i = 0; i < 527040; i++) {
    if (
      mons.includes(date.getMonth() + 1) &&
      doms.includes(date.getDate()) &&
      dows.includes(date.getDay()) &&
      hours.includes(date.getHours()) &&
      mins.includes(date.getMinutes())
    ) {
      return date.getTime();
    }
    date.setMinutes(date.getMinutes() + 1);
  }
  return after + 86400000; // fallback: 1 day
}

// ─── Scheduler ──────────────────────────────────────────────────────────────

class SchedulerImpl {
  private entries = new Map<number, SchedulerEntry>();
  private cronJobs = new Map<string, CronJob>();
  private contextSwitches = 0;
  private startTime = Date.now();
  private cronTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    this.initDefaults();
  }

  private initDefaults(): void {
    // Default scheduler entries for kernel processes
    this.setPolicy(0, 'SCHED_IDLE', 0, [0]);
    this.setPolicy(1, 'SCHED_OTHER', 0, [0, 1, 2, 3]);
  }

  // ─── Scheduler Policies ───────────────────────────────────────────────

  /** Set scheduling policy for a process. */
  setPolicy(pid: number, policy: SchedulerPolicy, priority = 0, cpuAffinity?: number[]): void {
    const cores = os.cpus().length;
    const affinity = cpuAffinity ?? Array.from({ length: cores }, (_, i) => i);

    const existing = this.entries.get(pid);
    this.entries.set(pid, {
      pid,
      policy,
      priority: Math.max(-20, Math.min(19, priority)),
      cpuAffinity: affinity.filter(c => c < cores),
      timeSliceMs: this.getTimeSlice(policy, priority),
      vruntime: existing?.vruntime ?? 0,
      lastScheduled: existing?.lastScheduled ?? Date.now(),
      totalCpuMs: existing?.totalCpuMs ?? 0,
    });
    this.notify();
  }

  /** Calculate time slice based on policy and priority. */
  private getTimeSlice(policy: SchedulerPolicy, priority: number): number {
    switch (policy) {
      case 'SCHED_FIFO': return Infinity; // runs until completion or preemption
      case 'SCHED_RR': return 100; // 100ms round-robin
      case 'SCHED_BATCH': return 200; // larger slices for batch
      case 'SCHED_IDLE': return 10; // minimal
      default: {
        // CFS: higher priority (lower nice) = larger slice
        const weight = 1024 / Math.pow(1.25, priority);
        return Math.max(1, Math.min(100, Math.floor(weight / 10)));
      }
    }
  }

  /** Get scheduler entry for a process. */
  getEntry(pid: number): SchedulerEntry | undefined {
    return this.entries.get(pid);
  }

  /** Remove scheduler entry (process exited). */
  removeEntry(pid: number): void {
    this.entries.delete(pid);
  }

  /** Set CPU affinity for a process. */
  setCpuAffinity(pid: number, cores: number[]): boolean {
    const entry = this.entries.get(pid);
    if (!entry) return false;
    entry.cpuAffinity = cores.filter(c => c < os.cpus().length);
    this.notify();
    return true;
  }

  // ─── Scheduling Decisions ─────────────────────────────────────────────

  /** Pick the next process to schedule (CFS algorithm). */
  pickNext(): number | null {
    let best: SchedulerEntry | null = null;

    // Real-time FIFO processes first
    for (const entry of this.entries.values()) {
      if (entry.policy === 'SCHED_FIFO' && (!best || entry.priority < best.priority)) {
        best = entry;
      }
    }
    if (best) { this.recordSwitch(best.pid); return best.pid; }

    // Then round-robin
    for (const entry of this.entries.values()) {
      if (entry.policy === 'SCHED_RR' && (!best || entry.priority < best.priority)) {
        best = entry;
      }
    }
    if (best) { this.recordSwitch(best.pid); return best.pid; }

    // CFS: pick process with smallest vruntime
    let minVruntime = Infinity;
    for (const entry of this.entries.values()) {
      if (entry.policy === 'SCHED_OTHER' || entry.policy === 'SCHED_BATCH') {
        if (entry.vruntime < minVruntime) {
          minVruntime = entry.vruntime;
          best = entry;
        }
      }
    }
    if (best) { this.recordSwitch(best.pid); return best.pid; }

    // SCHED_IDLE processes last
    for (const entry of this.entries.values()) {
      if (entry.policy === 'SCHED_IDLE') { this.recordSwitch(entry.pid); return entry.pid; }
    }

    return null;
  }

  /** Record a context switch. */
  private recordSwitch(pid: number): void {
    const entry = this.entries.get(pid);
    if (!entry) return;
    this.contextSwitches++;
    const now = Date.now();
    const elapsed = now - entry.lastScheduled;
    entry.totalCpuMs += elapsed;
    entry.vruntime += elapsed / this.getTimeSlice(entry.policy, entry.priority);
    entry.lastScheduled = now;
  }

  /** Simulate a scheduling tick. */
  tick(): void {
    this.pickNext();
  }

  // ─── Cron Jobs ────────────────────────────────────────────────────────

  /** Add a cron job. */
  addCronJob(job: Omit<CronJob, 'nextRun'>): void {
    const nextRun = getNextCronRun(job.schedule);
    this.cronJobs.set(job.id, { ...job, nextRun });
    this.notify();
  }

  /** Remove a cron job. */
  removeCronJob(id: string): boolean {
    const ok = this.cronJobs.delete(id);
    if (ok) this.notify();
    return ok;
  }

  /** Enable/disable a cron job. */
  toggleCronJob(id: string, enabled: boolean): boolean {
    const job = this.cronJobs.get(id);
    if (!job) return false;
    job.enabled = enabled;
    if (enabled) job.nextRun = getNextCronRun(job.schedule);
    this.notify();
    return true;
  }

  /** Get all cron jobs. */
  getCronJobs(): CronJob[] {
    return Array.from(this.cronJobs.values());
  }

  /** Check and execute due cron jobs. */
  private checkCronJobs(): void {
    const now = Date.now();
    for (const job of this.cronJobs.values()) {
      if (!job.enabled || !job.nextRun || job.nextRun > now) continue;
      // Mark as executed
      job.lastRun = now;
      job.nextRun = getNextCronRun(job.schedule, now);
      job.exitCode = 0;
      job.output = `[cron] Executed: ${job.command} ${job.args.join(' ')}`;
      this.notify();
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────

  /** Start the scheduler tick loop. */
  start(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), 1000);
    this.cronTimer = setInterval(() => this.checkCronJobs(), 60000);

    // Add default cron jobs
    this.addCronJob({
      id: 'ota-check', name: 'OTA Update Check', schedule: '0 3 * * *',
      command: '/opt/pinet/ota-update.sh', args: ['--check'], uid: 0,
      enabled: true,
    });
    this.addCronJob({
      id: 'log-rotate', name: 'Log Rotation', schedule: '0 0 * * *',
      command: '/usr/sbin/logrotate', args: ['/etc/logrotate.conf'], uid: 0,
      enabled: true,
    });
    this.addCronJob({
      id: 'health-report', name: 'System Health Report', schedule: '*/15 * * * *',
      command: '/opt/pinet/health-check.sh', args: [], uid: 0,
      enabled: true,
    });
    this.addCronJob({
      id: 'backup', name: 'System Backup', schedule: '0 2 * * 0',
      command: '/opt/pinet/backup.sh', args: ['--incremental'], uid: 0,
      enabled: true,
    });
  }

  /** Stop the scheduler. */
  stop(): void {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    if (this.cronTimer) { clearInterval(this.cronTimer); this.cronTimer = null; }
  }

  // ─── Statistics ───────────────────────────────────────────────────────

  /** Get comprehensive scheduler statistics. */
  getStats(): SchedulerStats {
    const cpus = os.cpus();
    const uptime = os.uptime() * 1000;
    const loadAvg = os.loadavg() as [number, number, number];

    const entries = Array.from(this.entries.values());
    return {
      contextSwitches: this.contextSwitches,
      runQueueLength: entries.filter(e => e.policy !== 'SCHED_IDLE').length,
      loadAverage: loadAvg,
      cpuCores: cpus.length,
      uptimeMs: uptime,
      idleMs: cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0),
      processes: {
        total: entries.length,
        running: entries.filter(e => e.lastScheduled > Date.now() - 5000).length,
        sleeping: entries.filter(e => e.lastScheduled <= Date.now() - 5000).length,
        stopped: 0,
        zombie: 0,
      },
    };
  }

  /** Get all scheduler entries. */
  getAllEntries(): SchedulerEntry[] {
    return Array.from(this.entries.values());
  }

  // ─── Observer ─────────────────────────────────────────────────────────

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private notify(): void {
    for (const l of this.listeners) { try { l(); } catch { /* noop */ } }
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const scheduler = new SchedulerImpl();
