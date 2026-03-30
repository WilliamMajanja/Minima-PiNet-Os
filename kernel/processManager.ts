/**
 * PiNet-OS Process Manager
 * Manages the process table, PIDs, signals, and process lifecycle.
 * Provides a POSIX-like process model for the operating system.
 */

import type {
  ProcessDescriptor,
  ProcessTree,
  ProcessState,
  SignalType,
  SignalHandler,
  SIGNAL_MAP,
} from '../types/kernel.js';

// ─── Process Table ──────────────────────────────────────────────────────────

class ProcessManager {
  private processTable = new Map<number, ProcessDescriptor>();
  private signalHandlers = new Map<number, Map<SignalType, SignalHandler>>();
  private nextPid = 1;
  private listeners: Array<() => void> = [];

  constructor() {
    this.createKernelProcesses();
  }

  /** Initialise kernel process entries (PID 0 and PID 1). */
  private createKernelProcesses(): void {
    // PID 0 – swapper / idle
    this.processTable.set(0, {
      pid: 0, ppid: 0, name: 'swapper', state: 'running',
      uid: 0, gid: 0, priority: 0, cpuPercent: 0,
      memoryBytes: 0, threads: 1, startTime: Date.now(),
      command: '[swapper/0]', args: [], env: {}, cwd: '/',
    });
    // PID 1 – init (PiNet-OS)
    this.processTable.set(1, {
      pid: 1, ppid: 0, name: 'init', state: 'running',
      uid: 0, gid: 0, priority: 0, cpuPercent: 0.1,
      memoryBytes: 4 * 1024 * 1024, threads: 1, startTime: Date.now(),
      command: '/sbin/init', args: [], env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' }, cwd: '/',
    });
    this.nextPid = 2;

    // Create standard system processes
    const systemProcs: Array<Partial<ProcessDescriptor> & { name: string; command: string }> = [
      { name: 'kthreadd', command: '[kthreadd]', memoryBytes: 0, cpuPercent: 0 },
      { name: 'rcu_gp', command: '[rcu_gp]', memoryBytes: 0, cpuPercent: 0 },
      { name: 'kworker/0:0', command: '[kworker/0:0]', memoryBytes: 0, cpuPercent: 0 },
      { name: 'ksoftirqd/0', command: '[ksoftirqd/0]', memoryBytes: 0, cpuPercent: 0 },
      { name: 'systemd-journald', command: '/lib/systemd/systemd-journald', memoryBytes: 16 * 1024 * 1024, cpuPercent: 0.2 },
      { name: 'systemd-udevd', command: '/lib/systemd/systemd-udevd', memoryBytes: 8 * 1024 * 1024, cpuPercent: 0.1 },
      { name: 'systemd-logind', command: '/lib/systemd/systemd-logind', memoryBytes: 4 * 1024 * 1024, cpuPercent: 0.05 },
      { name: 'sshd', command: '/usr/sbin/sshd -D', memoryBytes: 6 * 1024 * 1024, cpuPercent: 0.01 },
      { name: 'chronyd', command: '/usr/sbin/chronyd -F 1', memoryBytes: 2 * 1024 * 1024, cpuPercent: 0.01 },
      { name: 'NetworkManager', command: '/usr/sbin/NetworkManager --no-daemon', memoryBytes: 12 * 1024 * 1024, cpuPercent: 0.05 },
      { name: 'minima', command: '/usr/bin/java -jar /opt/minima/minima.jar', memoryBytes: 256 * 1024 * 1024, cpuPercent: 3.2 },
      { name: 'pinet-desktop', command: '/usr/bin/node /opt/pinet/server.js', memoryBytes: 128 * 1024 * 1024, cpuPercent: 1.5 },
      { name: 'pinet-cluster', command: '/opt/pinet/cluster-manager', memoryBytes: 32 * 1024 * 1024, cpuPercent: 0.8 },
      { name: 'pinet-hal', command: '/opt/pinet/hal-daemon', memoryBytes: 8 * 1024 * 1024, cpuPercent: 0.3 },
      { name: 'pinet-storage', command: '/usr/local/bin/ipfs daemon', memoryBytes: 64 * 1024 * 1024, cpuPercent: 0.5 },
      { name: 'wg-quick', command: '/usr/bin/wg-quick up wg0', memoryBytes: 2 * 1024 * 1024, cpuPercent: 0.02 },
    ];

    for (const sp of systemProcs) {
      this.spawn(1, sp.name, sp.command, [], {}, '/', 0, 0, sp.memoryBytes, sp.cpuPercent);
    }
  }

  // ─── Process Lifecycle ──────────────────────────────────────────────────

  /** Spawn a new process. Returns the process descriptor. */
  spawn(
    ppid: number,
    name: string,
    command: string,
    args: string[] = [],
    env: Record<string, string> = {},
    cwd = '/',
    uid = 1000,
    gid = 1000,
    memoryBytes?: number,
    cpuPercent?: number,
  ): ProcessDescriptor {
    const pid = this.nextPid++;
    const proc: ProcessDescriptor = {
      pid, ppid, name, state: 'running',
      uid, gid, priority: 0,
      cpuPercent: cpuPercent ?? Math.random() * 2,
      memoryBytes: memoryBytes ?? Math.floor(Math.random() * 32 * 1024 * 1024),
      threads: 1, startTime: Date.now(),
      command, args, env, cwd,
    };
    this.processTable.set(pid, proc);
    this.notify();
    return proc;
  }

  /** Fork a process (create a copy). */
  fork(ppid: number): ProcessDescriptor | null {
    const parent = this.processTable.get(ppid);
    if (!parent) return null;
    return this.spawn(ppid, parent.name, parent.command, [...parent.args], { ...parent.env }, parent.cwd, parent.uid, parent.gid);
  }

  /** Replace a process image (exec). */
  exec(pid: number, command: string, args: string[], env: Record<string, string>): boolean {
    const proc = this.processTable.get(pid);
    if (!proc) return false;
    proc.command = command;
    proc.args = args;
    proc.env = { ...proc.env, ...env };
    proc.name = command.split('/').pop() ?? command;
    this.notify();
    return true;
  }

  /** Terminate a process. */
  exit(pid: number, exitCode: number): void {
    const proc = this.processTable.get(pid);
    if (!proc || pid <= 1) return; // can't kill kernel processes
    proc.state = 'zombie';
    proc.exitCode = exitCode;

    // Reparent children to init (PID 1)
    for (const [, child] of this.processTable) {
      if (child.ppid === pid) child.ppid = 1;
    }

    // Mark as dead after a brief period
    setTimeout(() => {
      proc.state = 'dead';
      this.processTable.delete(pid);
      this.signalHandlers.delete(pid);
      this.notify();
    }, 100);

    this.notify();
  }

  /** Send a signal to a process. */
  sendSignal(pid: number, signal: SignalType): boolean {
    const proc = this.processTable.get(pid);
    if (!proc) return false;

    // Check for custom handler
    const handlers = this.signalHandlers.get(pid);
    const handler = handlers?.get(signal);

    if (handler?.handler === 'ignore') return true;
    if (handler?.handler === 'custom' && handler.callback) {
      handler.callback();
      return true;
    }

    // Default actions
    switch (signal) {
      case 'SIGKILL':
        this.exit(pid, 137);
        return true;
      case 'SIGTERM':
      case 'SIGINT':
      case 'SIGQUIT':
      case 'SIGHUP':
        this.exit(pid, 128 + (signal === 'SIGTERM' ? 15 : signal === 'SIGINT' ? 2 : signal === 'SIGQUIT' ? 3 : 1));
        return true;
      case 'SIGSTOP':
        proc.state = 'stopped';
        this.notify();
        return true;
      case 'SIGCONT':
        if (proc.state === 'stopped') { proc.state = 'running'; this.notify(); }
        return true;
      default:
        return true;
    }
  }

  /** Register a signal handler for a process. */
  registerSignalHandler(pid: number, signal: SignalType, handler: SignalHandler): boolean {
    if (signal === 'SIGKILL' || signal === 'SIGSTOP') return false; // unblockable
    const proc = this.processTable.get(pid);
    if (!proc) return false;
    if (!this.signalHandlers.has(pid)) this.signalHandlers.set(pid, new Map());
    this.signalHandlers.get(pid)!.set(signal, handler);
    return true;
  }

  /** Adjust process priority (nice value). */
  setNice(pid: number, priority: number): boolean {
    const proc = this.processTable.get(pid);
    if (!proc) return false;
    proc.priority = Math.max(-20, Math.min(19, priority));
    this.notify();
    return true;
  }

  // ─── Queries ────────────────────────────────────────────────────────────

  /** Get a single process by PID. */
  getProcess(pid: number): ProcessDescriptor | undefined {
    return this.processTable.get(pid);
  }

  /** List all processes. */
  listProcesses(): ProcessDescriptor[] {
    return Array.from(this.processTable.values());
  }

  /** List processes filtered by state. */
  listByState(state: ProcessState): ProcessDescriptor[] {
    return this.listProcesses().filter(p => p.state === state);
  }

  /** Get process count. */
  getProcessCount(): { total: number; running: number; sleeping: number; stopped: number; zombie: number } {
    const procs = this.listProcesses();
    return {
      total: procs.length,
      running: procs.filter(p => p.state === 'running').length,
      sleeping: procs.filter(p => p.state === 'sleeping').length,
      stopped: procs.filter(p => p.state === 'stopped').length,
      zombie: procs.filter(p => p.state === 'zombie').length,
    };
  }

  /** Build process tree starting from PID. */
  getProcessTree(rootPid = 0): ProcessTree | null {
    const root = this.processTable.get(rootPid);
    if (!root) return null;

    const buildTree = (pid: number): ProcessTree => {
      const proc = this.processTable.get(pid)!;
      const children = this.listProcesses()
        .filter(p => p.ppid === pid && p.pid !== pid)
        .map(p => buildTree(p.pid));
      return { process: proc, children };
    };

    return buildTree(rootPid);
  }

  /** Get top processes by CPU usage. */
  getTopByCpu(limit = 10): ProcessDescriptor[] {
    return this.listProcesses()
      .sort((a, b) => b.cpuPercent - a.cpuPercent)
      .slice(0, limit);
  }

  /** Get top processes by memory usage. */
  getTopByMemory(limit = 10): ProcessDescriptor[] {
    return this.listProcesses()
      .sort((a, b) => b.memoryBytes - a.memoryBytes)
      .slice(0, limit);
  }

  /** Find processes by name (glob-like matching). */
  findByName(pattern: string): ProcessDescriptor[] {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    return this.listProcesses().filter(p => regex.test(p.name) || regex.test(p.command));
  }

  /** Get the next available PID. */
  getNextPid(): number {
    return this.nextPid;
  }

  // ─── Simulated CPU fluctuation ─────────────────────────────────────────

  /** Simulate realistic CPU/memory fluctuation for demonstration purposes. */
  tick(): void {
    for (const [pid, proc] of this.processTable) {
      if (proc.state !== 'running') continue;
      // Small random fluctuation
      proc.cpuPercent = Math.max(0, proc.cpuPercent + (Math.random() - 0.5) * 0.3);
      proc.memoryBytes = Math.max(0, proc.memoryBytes + Math.floor((Math.random() - 0.5) * 1024 * 64));
    }
  }

  // ─── Observer pattern ─────────────────────────────────────────────────

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private notify(): void {
    for (const l of this.listeners) { try { l(); } catch { /* noop */ } }
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const processManager = new ProcessManager();
