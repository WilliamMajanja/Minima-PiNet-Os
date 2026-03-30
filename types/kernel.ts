/**
 * PiNet-OS Kernel Type Definitions
 * Core types for process management, memory, scheduling, IPC, and system calls.
 */

// ─── Process Management ──────────────────────────────────────────────────────

export type ProcessState =
  | 'created'
  | 'ready'
  | 'running'
  | 'sleeping'
  | 'stopped'
  | 'zombie'
  | 'dead';

export type SignalType =
  | 'SIGHUP'   // 1  – Hangup
  | 'SIGINT'   // 2  – Interrupt (Ctrl+C)
  | 'SIGQUIT'  // 3  – Quit
  | 'SIGKILL'  // 9  – Kill (unblockable)
  | 'SIGTERM'  // 15 – Terminate
  | 'SIGSTOP'  // 19 – Stop (unblockable)
  | 'SIGCONT'  // 18 – Continue
  | 'SIGCHLD'  // 17 – Child exited
  | 'SIGUSR1'  // 10
  | 'SIGUSR2'; // 12

export const SIGNAL_MAP: Record<SignalType, number> = {
  SIGHUP:  1,
  SIGINT:  2,
  SIGQUIT: 3,
  SIGKILL: 9,
  SIGUSR1: 10,
  SIGUSR2: 12,
  SIGTERM: 15,
  SIGCHLD: 17,
  SIGCONT: 18,
  SIGSTOP: 19,
};

export type ProcessPriority = -20 | -10 | 0 | 10 | 19; // nice values

export interface ProcessDescriptor {
  pid: number;
  ppid: number;
  name: string;
  state: ProcessState;
  uid: number;
  gid: number;
  priority: number;          // nice value -20..19
  cpuPercent: number;
  memoryBytes: number;
  threads: number;
  startTime: number;         // ms since epoch
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  tty?: string;
  exitCode?: number;
}

export interface ProcessTree {
  process: ProcessDescriptor;
  children: ProcessTree[];
}

export interface SignalHandler {
  signal: SignalType;
  handler: 'default' | 'ignore' | 'custom';
  callback?: () => void;
}

// ─── Memory Management ──────────────────────────────────────────────────────

export interface MemoryRegion {
  id: string;
  start: number;            // virtual address
  size: number;             // bytes
  type: 'heap' | 'stack' | 'mmap' | 'shared' | 'code' | 'data';
  permissions: 'r' | 'rw' | 'rx' | 'rwx';
  owner: number;            // pid
  name?: string;
}

export interface MemoryStats {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  cachedBytes: number;
  buffersBytes: number;
  swapTotalBytes: number;
  swapUsedBytes: number;
  swapFreeBytes: number;
  shmBytes: number;
  pageSize: number;
  pagesTotal: number;
  pagesFree: number;
  pagesFaults: number;
  oomKills: number;
}

export interface ProcessMemoryInfo {
  pid: number;
  vssBytes: number;         // virtual set size
  rssBytes: number;         // resident set size
  sharedBytes: number;
  privateBytes: number;
  swapBytes: number;
  regions: MemoryRegion[];
}

export interface MemoryLimit {
  pid: number;
  softLimitBytes: number;
  hardLimitBytes: number;
  oomScore: number;          // 0-1000
}

// ─── Scheduler ──────────────────────────────────────────────────────────────

export type SchedulerPolicy =
  | 'SCHED_OTHER'   // Default CFS
  | 'SCHED_FIFO'    // Real-time FIFO
  | 'SCHED_RR'      // Real-time round-robin
  | 'SCHED_BATCH'   // CPU-intensive batch
  | 'SCHED_IDLE';   // Very low priority

export interface SchedulerEntry {
  pid: number;
  policy: SchedulerPolicy;
  priority: number;
  cpuAffinity: number[];     // core IDs
  timeSliceMs: number;
  vruntime: number;          // virtual runtime (CFS)
  lastScheduled: number;     // timestamp
  totalCpuMs: number;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;          // cron expression "* * * * *"
  command: string;
  args: string[];
  uid: number;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  exitCode?: number;
  output?: string;
}

export interface SchedulerStats {
  contextSwitches: number;
  runQueueLength: number;
  loadAverage: [number, number, number]; // 1, 5, 15 min
  cpuCores: number;
  uptimeMs: number;
  idleMs: number;
  processes: { total: number; running: number; sleeping: number; stopped: number; zombie: number };
}

// ─── Init System / Service Manager ──────────────────────────────────────────

export type RunLevel =
  | 0    // Halt
  | 1    // Single-user
  | 2    // Multi-user (no networking)
  | 3    // Multi-user (with networking)
  | 4    // Reserved / custom
  | 5    // Multi-user + GUI
  | 6;   // Reboot

export type ServiceState =
  | 'inactive'
  | 'activating'
  | 'active'
  | 'deactivating'
  | 'failed'
  | 'reloading';

export type ServiceType =
  | 'simple'
  | 'forking'
  | 'oneshot'
  | 'notify'
  | 'dbus'
  | 'idle';

export interface ServiceUnit {
  name: string;
  description: string;
  type: ServiceType;
  state: ServiceState;
  pid?: number;
  mainPid?: number;
  exitCode?: number;
  startedAt?: number;
  stoppedAt?: number;
  restartCount: number;
  autoRestart: boolean;
  maxRestarts: number;
  restartDelayMs: number;
  dependencies: string[];    // services that must start before this one
  wantedBy: string[];        // targets that want this service
  execStart: string;
  execStop?: string;
  execReload?: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  user?: string;
  group?: string;
  capabilities?: string[];
  runLevel: RunLevel[];
  enabled: boolean;
  logs: ServiceLogEntry[];
}

export interface ServiceLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
}

export interface InitTarget {
  name: string;
  description: string;
  runLevel: RunLevel;
  services: string[];
  active: boolean;
}

// ─── System Calls ───────────────────────────────────────────────────────────

export type SyscallCategory =
  | 'process'
  | 'memory'
  | 'filesystem'
  | 'network'
  | 'ipc'
  | 'device'
  | 'security'
  | 'time';

export interface SyscallResult<T = unknown> {
  errno: number;             // 0 = success
  result: T;
  syscall: string;
  latencyMs: number;
}

// ─── IPC / Message Bus ──────────────────────────────────────────────────────

export type IPCType =
  | 'pipe'
  | 'fifo'
  | 'socket'
  | 'shared-memory'
  | 'message-queue'
  | 'signal'
  | 'dbus';

export interface IPCChannel {
  id: string;
  type: IPCType;
  name: string;
  ownerPid: number;
  readerPids: number[];
  writerPids: number[];
  createdAt: number;
  messageCount: number;
  bytesSent: number;
  bytesReceived: number;
}

export interface DBusMessage {
  id: string;
  type: 'signal' | 'method_call' | 'method_return' | 'error';
  sender: string;
  destination?: string;
  interface: string;
  member: string;
  path: string;
  body: unknown;
  timestamp: number;
  serial: number;
  replySerial?: number;
}

export interface DBusService {
  name: string;
  pid: number;
  interfaces: string[];
  objectPaths: string[];
}

// ─── Device Management ──────────────────────────────────────────────────────

export type DeviceClass =
  | 'block'
  | 'char'
  | 'net'
  | 'usb'
  | 'pci'
  | 'input'
  | 'sound'
  | 'video'
  | 'gpio'
  | 'i2c'
  | 'spi'
  | 'serial'
  | 'sensor'
  | 'power'
  | 'thermal';

export type DeviceState = 'attached' | 'detached' | 'error' | 'suspended' | 'initializing';

export interface DeviceDescriptor {
  id: string;
  name: string;
  deviceClass: DeviceClass;
  driver: string;
  subsystem: string;
  path: string;               // sysfs path e.g. /sys/class/…
  devNode?: string;           // /dev/… path
  major?: number;
  minor?: number;
  vendor?: string;
  product?: string;
  serial?: string;
  state: DeviceState;
  attachedAt: number;
  properties: Record<string, string>;
}

export interface DeviceEvent {
  type: 'add' | 'remove' | 'change' | 'move' | 'bind' | 'unbind';
  device: DeviceDescriptor;
  timestamp: number;
}

export interface UdevRule {
  id: string;
  name: string;
  match: {
    subsystem?: string;
    vendor?: string;
    product?: string;
    driver?: string;
    deviceClass?: DeviceClass;
  };
  action: {
    symlink?: string;
    permissions?: string;
    owner?: string;
    group?: string;
    runCommand?: string;
    env?: Record<string, string>;
  };
  priority: number;
  enabled: boolean;
}

// ─── User / Authentication ──────────────────────────────────────────────────

export interface UserAccount {
  uid: number;
  gid: number;
  username: string;
  fullName: string;
  homeDir: string;
  shell: string;
  groups: string[];
  locked: boolean;
  lastLogin?: number;
  passwordHash?: string;     // bcrypt hash (never sent to client)
  createdAt: number;
  sudoer: boolean;
  sshKeys: string[];
}

export interface GroupInfo {
  gid: number;
  name: string;
  members: string[];
  system: boolean;
}

export interface UserSession {
  sessionId: string;
  uid: number;
  username: string;
  loginTime: number;
  lastActivity: number;
  tty?: string;
  remoteAddr?: string;
  active: boolean;
}

export interface AuthResult {
  success: boolean;
  uid?: number;
  sessionId?: string;
  error?: string;
  mfaRequired?: boolean;
}

// ─── System Logging ─────────────────────────────────────────────────────────

export type SyslogFacility =
  | 'kern'
  | 'user'
  | 'daemon'
  | 'auth'
  | 'syslog'
  | 'cron'
  | 'local0' | 'local1' | 'local2' | 'local3'
  | 'local4' | 'local5' | 'local6' | 'local7';

export type SyslogSeverity =
  | 'emerg'    // 0
  | 'alert'    // 1
  | 'crit'     // 2
  | 'err'      // 3
  | 'warning'  // 4
  | 'notice'   // 5
  | 'info'     // 6
  | 'debug';   // 7

export interface SyslogEntry {
  id: string;
  timestamp: number;
  facility: SyslogFacility;
  severity: SyslogSeverity;
  hostname: string;
  process: string;
  pid?: number;
  message: string;
  structured?: Record<string, string>;
}

// ─── Network Management ─────────────────────────────────────────────────────

export type NetworkInterfaceState = 'up' | 'down' | 'unknown' | 'dormant' | 'lowerlayerdown';

export type AddressFamily = 'inet' | 'inet6' | 'link';

export interface NetworkAddress {
  family: AddressFamily;
  address: string;
  netmask: string;
  broadcast?: string;
  scope: 'global' | 'link' | 'host';
}

export interface NetworkInterface {
  name: string;
  index: number;
  state: NetworkInterfaceState;
  mac: string;
  mtu: number;
  type: 'ethernet' | 'wifi' | 'loopback' | 'bridge' | 'tunnel' | 'wireguard' | 'virtual';
  addresses: NetworkAddress[];
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  speed?: number;            // Mbps
  duplex?: 'full' | 'half';
  carrier: boolean;
}

export interface Route {
  destination: string;
  gateway: string;
  interface: string;
  metric: number;
  scope: 'global' | 'link' | 'host';
  protocol: string;
  flags: string[];
}

export interface DNSConfig {
  nameservers: string[];
  search: string[];
  options: string[];
}

export interface FirewallRule {
  id: string;
  chain: 'INPUT' | 'OUTPUT' | 'FORWARD';
  action: 'ACCEPT' | 'DROP' | 'REJECT' | 'LOG';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  source?: string;
  destination?: string;
  sourcePort?: number;
  destinationPort?: number;
  interface?: string;
  comment?: string;
  enabled: boolean;
  order: number;
}

export interface WireGuardPeer {
  publicKey: string;
  endpoint?: string;
  allowedIPs: string[];
  latestHandshake?: number;
  transferRx: number;
  transferTx: number;
  persistentKeepalive?: number;
}

export interface WireGuardInterface {
  name: string;
  publicKey: string;
  listenPort: number;
  address: string;
  peers: WireGuardPeer[];
}

// ─── Power Management ───────────────────────────────────────────────────────

export type PowerState =
  | 'running'
  | 'idle'
  | 'suspend'
  | 'hibernate'
  | 'poweroff'
  | 'reboot';

export type PowerSource = 'ac' | 'battery' | 'usb' | 'poe';

export interface PowerInfo {
  state: PowerState;
  source: PowerSource;
  uptimeMs: number;
  voltage: number;           // V
  current: number;           // A
  power: number;             // W
  cpuFrequencyMhz: number;
  cpuGovernor: 'performance' | 'powersave' | 'ondemand' | 'conservative' | 'schedutil';
  throttled: boolean;
  underVoltage: boolean;
  temperatureC: number;
}

export interface WatchdogConfig {
  enabled: boolean;
  timeoutMs: number;
  action: 'reboot' | 'poweroff' | 'log';
  lastKick: number;
}

// ─── Security / MAC ─────────────────────────────────────────────────────────

export type SecurityAction = 'allow' | 'deny' | 'audit' | 'log';

export interface Capability {
  name: string;
  description: string;
  granted: boolean;
}

export const CAPABILITIES = [
  'CAP_NET_ADMIN',
  'CAP_SYS_ADMIN',
  'CAP_SYS_PTRACE',
  'CAP_DAC_OVERRIDE',
  'CAP_CHOWN',
  'CAP_NET_RAW',
  'CAP_SYS_BOOT',
  'CAP_KILL',
  'CAP_NET_BIND_SERVICE',
  'CAP_SYS_TIME',
  'CAP_AUDIT_WRITE',
  'CAP_SETUID',
  'CAP_SETGID',
  'CAP_FOWNER',
  'CAP_MKNOD',
  'CAP_SYS_RESOURCE',
] as const;

export type CapabilityName = (typeof CAPABILITIES)[number];

export interface SecurityProfile {
  name: string;
  pid?: number;
  capabilities: CapabilityName[];
  seccompFilter: 'strict' | 'moderate' | 'permissive' | 'disabled';
  readOnlyPaths: string[];
  hiddenPaths: string[];
  noNewPrivileges: boolean;
  namespaces: {
    pid: boolean;
    net: boolean;
    mount: boolean;
    uts: boolean;
    ipc: boolean;
    user: boolean;
  };
}

export interface AuditEvent {
  id: string;
  timestamp: number;
  type: 'auth' | 'access' | 'exec' | 'network' | 'mount' | 'policy' | 'system';
  action: string;
  subject: { uid: number; pid: number; process: string };
  object: { path?: string; port?: number; address?: string; resource?: string };
  result: 'success' | 'failure' | 'denied';
  message: string;
}
