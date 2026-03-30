/**
 * PiNet-OS System Call Interface
 * Provides a POSIX-like system call layer that abstracts kernel operations.
 * All OS services go through this interface for auditing and security checks.
 */

import type {
  SyscallResult,
  SyscallCategory,
  ProcessDescriptor,
  SignalType,
  MemoryStats,
  ProcessMemoryInfo,
  MemoryLimit,
  DeviceDescriptor,
  SyslogSeverity,
  SyslogFacility,
} from '../types/kernel.js';

// ─── Syscall Table ──────────────────────────────────────────────────────────

interface SyscallEntry {
  number: number;
  name: string;
  category: SyscallCategory;
  description: string;
  handler: (...args: unknown[]) => Promise<SyscallResult>;
}

const syscallTable = new Map<number, SyscallEntry>();
const syscallByName = new Map<string, SyscallEntry>();
let syscallCounter = 0;
let totalSyscalls = 0;

function makeSyscallResult<T>(syscall: string, errno: number, result: T, startMs: number): SyscallResult<T> {
  totalSyscalls++;
  return { errno, result, syscall, latencyMs: Date.now() - startMs };
}

// ─── Syscall Registration ───────────────────────────────────────────────────

function registerSyscall(
  name: string,
  category: SyscallCategory,
  description: string,
  handler: (...args: unknown[]) => Promise<SyscallResult>,
): number {
  const num = syscallCounter++;
  const entry: SyscallEntry = { number: num, name, category, description, handler };
  syscallTable.set(num, entry);
  syscallByName.set(name, entry);
  return num;
}

// ─── Process Syscalls ───────────────────────────────────────────────────────

registerSyscall('fork', 'process', 'Create a child process', async (...args) => {
  const start = Date.now();
  // Delegate to process manager
  const { processManager } = await import('./processManager.js');
  const parent = args[0] as number;
  const proc = processManager.fork(parent);
  return makeSyscallResult('fork', proc ? 0 : -1, proc?.pid ?? -1, start);
});

registerSyscall('exec', 'process', 'Execute a program', async (...args) => {
  const start = Date.now();
  const { processManager } = await import('./processManager.js');
  const [pid, command, cmdArgs, env] = args as [number, string, string[], Record<string, string>];
  const success = processManager.exec(pid, command, cmdArgs ?? [], env ?? {});
  return makeSyscallResult('exec', success ? 0 : -1, success, start);
});

registerSyscall('exit', 'process', 'Terminate calling process', async (...args) => {
  const start = Date.now();
  const { processManager } = await import('./processManager.js');
  const [pid, code] = args as [number, number];
  processManager.exit(pid, code ?? 0);
  return makeSyscallResult('exit', 0, null, start);
});

registerSyscall('kill', 'process', 'Send signal to process', async (...args) => {
  const start = Date.now();
  const { processManager } = await import('./processManager.js');
  const [pid, signal] = args as [number, SignalType];
  const ok = processManager.sendSignal(pid, signal);
  return makeSyscallResult('kill', ok ? 0 : -1, ok, start);
});

registerSyscall('wait', 'process', 'Wait for child process', async (...args) => {
  const start = Date.now();
  const { processManager } = await import('./processManager.js');
  const pid = args[0] as number;
  const proc = processManager.getProcess(pid);
  return makeSyscallResult('wait', proc ? 0 : -1, proc?.exitCode ?? -1, start);
});

registerSyscall('getpid', 'process', 'Get process ID', async (...args) => {
  const start = Date.now();
  const pid = args[0] as number;
  return makeSyscallResult('getpid', 0, pid, start);
});

registerSyscall('getppid', 'process', 'Get parent process ID', async (...args) => {
  const start = Date.now();
  const { processManager } = await import('./processManager.js');
  const pid = args[0] as number;
  const proc = processManager.getProcess(pid);
  return makeSyscallResult('getppid', proc ? 0 : -1, proc?.ppid ?? -1, start);
});

registerSyscall('nice', 'process', 'Change process priority', async (...args) => {
  const start = Date.now();
  const { processManager } = await import('./processManager.js');
  const [pid, priority] = args as [number, number];
  const ok = processManager.setNice(pid, priority);
  return makeSyscallResult('nice', ok ? 0 : -1, ok, start);
});

// ─── Memory Syscalls ────────────────────────────────────────────────────────

registerSyscall('brk', 'memory', 'Change data segment size', async (...args) => {
  const start = Date.now();
  const { memoryManager } = await import('./memoryManager.js');
  const [pid, size] = args as [number, number];
  const addr = memoryManager.allocate(pid, size, 'heap');
  return makeSyscallResult('brk', addr >= 0 ? 0 : -12, addr, start); // -12 = ENOMEM
});

registerSyscall('mmap', 'memory', 'Map memory', async (...args) => {
  const start = Date.now();
  const { memoryManager } = await import('./memoryManager.js');
  const [pid, size, type] = args as [number, number, string];
  const addr = memoryManager.allocate(pid, size, (type as 'mmap') || 'mmap');
  return makeSyscallResult('mmap', addr >= 0 ? 0 : -12, addr, start);
});

registerSyscall('munmap', 'memory', 'Unmap memory', async (...args) => {
  const start = Date.now();
  const { memoryManager } = await import('./memoryManager.js');
  const [pid, regionId] = args as [number, string];
  const ok = memoryManager.free(pid, regionId);
  return makeSyscallResult('munmap', ok ? 0 : -1, ok, start);
});

registerSyscall('shmget', 'memory', 'Get shared memory segment', async (...args) => {
  const start = Date.now();
  const { memoryManager } = await import('./memoryManager.js');
  const [pid, size] = args as [number, number];
  const addr = memoryManager.allocate(pid, size, 'shared');
  return makeSyscallResult('shmget', addr >= 0 ? 0 : -12, addr, start);
});

// ─── Filesystem Syscalls ────────────────────────────────────────────────────

registerSyscall('open', 'filesystem', 'Open a file', async (...args) => {
  const start = Date.now();
  const [_pid, path] = args as [number, string];
  return makeSyscallResult('open', path ? 0 : -2, path ? 3 : -1, start); // fd=3, -2 = ENOENT
});

registerSyscall('read', 'filesystem', 'Read from file', async (...args) => {
  const start = Date.now();
  const [_pid, _fd, _size] = args as [number, number, number];
  return makeSyscallResult('read', 0, '', start);
});

registerSyscall('write', 'filesystem', 'Write to file', async (...args) => {
  const start = Date.now();
  const [_pid, _fd, data] = args as [number, number, string];
  return makeSyscallResult('write', 0, (data ?? '').length, start);
});

registerSyscall('close', 'filesystem', 'Close file descriptor', async (...args) => {
  const start = Date.now();
  const [_pid, _fd] = args as [number, number];
  return makeSyscallResult('close', 0, true, start);
});

registerSyscall('stat', 'filesystem', 'Get file status', async (...args) => {
  const start = Date.now();
  const [_pid, path] = args as [number, string];
  return makeSyscallResult('stat', path ? 0 : -2, { path, size: 0, mode: '0644' }, start);
});

registerSyscall('mkdir', 'filesystem', 'Create directory', async (...args) => {
  const start = Date.now();
  const [_pid, path] = args as [number, string];
  return makeSyscallResult('mkdir', path ? 0 : -1, path ?? '', start);
});

registerSyscall('unlink', 'filesystem', 'Remove file', async (...args) => {
  const start = Date.now();
  const [_pid, path] = args as [number, string];
  return makeSyscallResult('unlink', path ? 0 : -2, path ?? '', start);
});

registerSyscall('chmod', 'filesystem', 'Change file permissions', async (...args) => {
  const start = Date.now();
  const [_pid, path, _mode] = args as [number, string, string];
  return makeSyscallResult('chmod', path ? 0 : -2, true, start);
});

registerSyscall('chown', 'filesystem', 'Change file owner', async (...args) => {
  const start = Date.now();
  const [_pid, path, _uid, _gid] = args as [number, string, number, number];
  return makeSyscallResult('chown', path ? 0 : -2, true, start);
});

// ─── Network Syscalls ───────────────────────────────────────────────────────

registerSyscall('socket', 'network', 'Create socket', async (..._args) => {
  const start = Date.now();
  return makeSyscallResult('socket', 0, 4, start); // fd=4
});

registerSyscall('bind', 'network', 'Bind socket to address', async (...args) => {
  const start = Date.now();
  const [_pid, _fd, _addr, _port] = args as [number, number, string, number];
  return makeSyscallResult('bind', 0, true, start);
});

registerSyscall('listen', 'network', 'Listen for connections', async (...args) => {
  const start = Date.now();
  const [_pid, _fd, _backlog] = args as [number, number, number];
  return makeSyscallResult('listen', 0, true, start);
});

registerSyscall('connect', 'network', 'Connect to remote', async (...args) => {
  const start = Date.now();
  const [_pid, _fd, _addr, _port] = args as [number, number, string, number];
  return makeSyscallResult('connect', 0, true, start);
});

// ─── IPC Syscalls ───────────────────────────────────────────────────────────

registerSyscall('pipe', 'ipc', 'Create pipe', async (..._args) => {
  const start = Date.now();
  return makeSyscallResult('pipe', 0, { readFd: 5, writeFd: 6 }, start);
});

registerSyscall('msgget', 'ipc', 'Get message queue', async (..._args) => {
  const start = Date.now();
  return makeSyscallResult('msgget', 0, 1, start); // queue id
});

registerSyscall('msgsnd', 'ipc', 'Send message', async (...args) => {
  const start = Date.now();
  const [_pid, _queueId, _msg] = args as [number, number, string];
  return makeSyscallResult('msgsnd', 0, true, start);
});

registerSyscall('msgrcv', 'ipc', 'Receive message', async (...args) => {
  const start = Date.now();
  const [_pid, _queueId] = args as [number, number];
  return makeSyscallResult('msgrcv', 0, null, start);
});

// ─── Device Syscalls ────────────────────────────────────────────────────────

registerSyscall('ioctl', 'device', 'Device I/O control', async (...args) => {
  const start = Date.now();
  const [_pid, _fd, _request] = args as [number, number, number];
  return makeSyscallResult('ioctl', 0, true, start);
});

// ─── Time Syscalls ──────────────────────────────────────────────────────────

registerSyscall('gettimeofday', 'time', 'Get current time', async (..._args) => {
  const start = Date.now();
  return makeSyscallResult('gettimeofday', 0, { sec: Math.floor(Date.now() / 1000), usec: (Date.now() % 1000) * 1000 }, start);
});

registerSyscall('clock_gettime', 'time', 'Get clock time', async (..._args) => {
  const start = Date.now();
  const hrtime = process.hrtime.bigint?.() ?? BigInt(Date.now()) * BigInt(1000000);
  return makeSyscallResult('clock_gettime', 0, { sec: Number(hrtime / BigInt(1000000000)), nsec: Number(hrtime % BigInt(1000000000)) }, start);
});

registerSyscall('nanosleep', 'time', 'Sleep for duration', async (...args) => {
  const start = Date.now();
  const ms = args[0] as number;
  await new Promise(resolve => setTimeout(resolve, ms));
  return makeSyscallResult('nanosleep', 0, true, start);
});

// ─── Security Syscalls ──────────────────────────────────────────────────────

registerSyscall('getuid', 'security', 'Get user ID', async (...args) => {
  const start = Date.now();
  const pid = args[0] as number;
  const { processManager } = await import('./processManager.js');
  const proc = processManager.getProcess(pid);
  return makeSyscallResult('getuid', 0, proc?.uid ?? 0, start);
});

registerSyscall('setuid', 'security', 'Set user ID', async (...args) => {
  const start = Date.now();
  const [pid, uid] = args as [number, number];
  const { processManager } = await import('./processManager.js');
  const proc = processManager.getProcess(pid);
  if (proc && proc.uid === 0) { proc.uid = uid; return makeSyscallResult('setuid', 0, true, start); }
  return makeSyscallResult('setuid', -1, false, start); // EPERM
});

registerSyscall('getgid', 'security', 'Get group ID', async (...args) => {
  const start = Date.now();
  const pid = args[0] as number;
  const { processManager } = await import('./processManager.js');
  const proc = processManager.getProcess(pid);
  return makeSyscallResult('getgid', 0, proc?.gid ?? 0, start);
});

registerSyscall('capget', 'security', 'Get capabilities', async (..._args) => {
  const start = Date.now();
  return makeSyscallResult('capget', 0, [], start);
});

// ─── Public Syscall API ─────────────────────────────────────────────────────

/**
 * Execute a system call by name.
 * All kernel operations should go through this interface.
 */
export async function syscall(name: string, ...args: unknown[]): Promise<SyscallResult> {
  const entry = syscallByName.get(name);
  if (!entry) {
    return { errno: -38, result: null, syscall: name, latencyMs: 0 }; // ENOSYS
  }
  try {
    return await entry.handler(...args);
  } catch (err) {
    return { errno: -1, result: (err as Error).message, syscall: name, latencyMs: 0 };
  }
}

/**
 * Execute a system call by number.
 */
export async function syscallByNumber(num: number, ...args: unknown[]): Promise<SyscallResult> {
  const entry = syscallTable.get(num);
  if (!entry) {
    return { errno: -38, result: null, syscall: `syscall_${num}`, latencyMs: 0 };
  }
  try {
    return await entry.handler(...args);
  } catch (err) {
    return { errno: -1, result: (err as Error).message, syscall: entry.name, latencyMs: 0 };
  }
}

/** List all registered system calls. */
export function listSyscalls(): Array<{ number: number; name: string; category: SyscallCategory; description: string }> {
  return Array.from(syscallTable.values()).map(e => ({
    number: e.number,
    name: e.name,
    category: e.category,
    description: e.description,
  }));
}

/** Get total number of syscalls executed since boot. */
export function getSyscallCount(): number {
  return totalSyscalls;
}
