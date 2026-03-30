/**
 * PiNet-OS System Logger (Syslog Service)
 * Centralized logging facility with severity levels, facilities, log rotation,
 * and structured logging support. Implements RFC 5424-like syslog semantics.
 */

import type { SyslogEntry, SyslogFacility, SyslogSeverity } from '../types/kernel.js';

// ─── Severity Priority ──────────────────────────────────────────────────────

const SEVERITY_PRIORITY: Record<SyslogSeverity, number> = {
  emerg: 0, alert: 1, crit: 2, err: 3,
  warning: 4, notice: 5, info: 6, debug: 7,
};

// ─── Syslog Service ─────────────────────────────────────────────────────────

class SyslogService {
  private logs: SyslogEntry[] = [];
  private maxEntries = 10000;
  private nextId = 1;
  private listeners: Array<(entry: SyslogEntry) => void> = [];
  private hostname: string;
  private filterSeverity: SyslogSeverity = 'debug'; // log everything by default

  constructor() {
    this.hostname = 'pinet';
    this.logBootMessages();
  }

  /** Emit initial boot log messages. */
  private logBootMessages(): void {
    this.log('kern', 'notice', 'kernel', 'PiNet-OS v3.0.0 booting on aarch64 (BCM2712)');
    this.log('kern', 'info', 'kernel', 'Linux 6.6.y arm64 SMP PREEMPT');
    this.log('kern', 'info', 'kernel', 'Memory: 8192MB total, 256MB reserved for GPU');
    this.log('kern', 'info', 'kernel', 'CPU: 4x Cortex-A76 @ 2.4GHz');
    this.log('kern', 'info', 'kernel', 'Detected Raspberry Pi 5 Model B Rev 1.0');
    this.log('kern', 'info', 'kernel', 'Thermal zones initialized (warning: 80°C, critical: 85°C)');
    this.log('kern', 'info', 'kernel', 'PCIe Gen 3.0 x1 bus initialized');
    this.log('daemon', 'info', 'systemd', 'systemd 254 running in system mode (+PAM +AUDIT +SELINUX)');
    this.log('daemon', 'info', 'systemd', 'Detected architecture arm64');
    this.log('daemon', 'info', 'systemd', 'Hostname set to pinet');
    this.log('daemon', 'info', 'systemd-journald', 'Journal service started');
    this.log('daemon', 'info', 'systemd-udevd', 'Device manager started');
    this.log('daemon', 'info', 'systemd-logind', 'Login service started');
    this.log('auth', 'info', 'sshd', 'OpenSSH 9.6 server listening on 0.0.0.0:22');
    this.log('daemon', 'info', 'NetworkManager', 'NetworkManager 1.44.2 started');
    this.log('daemon', 'info', 'NetworkManager', 'eth0: carrier on, 1000Mbps full duplex');
    this.log('daemon', 'info', 'NetworkManager', 'wlan0: connected to PiNet-Mesh');
    this.log('daemon', 'info', 'chronyd', 'NTP synchronized to time.google.com');
    this.log('daemon', 'info', 'minima', 'Minima node v1.0.35 starting...');
    this.log('daemon', 'info', 'minima', 'Blockchain sync started at block height 0');
    this.log('daemon', 'info', 'pinet-desktop', 'PiNet Desktop server started on :3000');
    this.log('daemon', 'info', 'pinet-cluster', 'Cluster manager started on :9090');
    this.log('daemon', 'info', 'pinet-hal', 'HAL daemon: GPIO, I2C, SPI, thermal initialized');
    this.log('daemon', 'info', 'pinet-storage', 'IPFS daemon started, peer ID: QmPiNet...');
    this.log('kern', 'notice', 'kernel', 'PiNet-OS boot complete. Run level 5 (graphical).');
  }

  // ─── Core Logging ─────────────────────────────────────────────────────

  /** Log a message. */
  log(
    facility: SyslogFacility,
    severity: SyslogSeverity,
    process: string,
    message: string,
    pid?: number,
    structured?: Record<string, string>,
  ): SyslogEntry {
    // Filter by severity
    if (SEVERITY_PRIORITY[severity] > SEVERITY_PRIORITY[this.filterSeverity]) {
      return { id: '', timestamp: 0, facility, severity, hostname: this.hostname, process, message };
    }

    const entry: SyslogEntry = {
      id: `log-${this.nextId++}`,
      timestamp: Date.now(),
      facility,
      severity,
      hostname: this.hostname,
      process,
      pid,
      message,
      structured,
    };

    this.logs.push(entry);

    // Log rotation
    if (this.logs.length > this.maxEntries) {
      this.logs = this.logs.slice(-Math.floor(this.maxEntries * 0.8));
    }

    // Notify listeners
    for (const l of this.listeners) { try { l(entry); } catch { /* noop */ } }

    return entry;
  }

  // ─── Convenience methods ──────────────────────────────────────────────

  emerg(process: string, message: string, pid?: number): SyslogEntry { return this.log('kern', 'emerg', process, message, pid); }
  alert(process: string, message: string, pid?: number): SyslogEntry { return this.log('kern', 'alert', process, message, pid); }
  crit(process: string, message: string, pid?: number): SyslogEntry { return this.log('kern', 'crit', process, message, pid); }
  err(facility: SyslogFacility, process: string, message: string, pid?: number): SyslogEntry { return this.log(facility, 'err', process, message, pid); }
  warn(facility: SyslogFacility, process: string, message: string, pid?: number): SyslogEntry { return this.log(facility, 'warning', process, message, pid); }
  info(facility: SyslogFacility, process: string, message: string, pid?: number): SyslogEntry { return this.log(facility, 'info', process, message, pid); }
  debug(facility: SyslogFacility, process: string, message: string, pid?: number): SyslogEntry { return this.log(facility, 'debug', process, message, pid); }

  // ─── Query ────────────────────────────────────────────────────────────

  /** Get recent log entries. */
  getRecent(limit = 100): SyslogEntry[] {
    return this.logs.slice(-limit);
  }

  /** Query logs with filters. */
  query(filters: {
    facility?: SyslogFacility;
    severity?: SyslogSeverity;
    process?: string;
    since?: number;
    until?: number;
    search?: string;
    limit?: number;
  }): SyslogEntry[] {
    let results = this.logs;

    if (filters.facility) results = results.filter(e => e.facility === filters.facility);
    if (filters.severity) results = results.filter(e => SEVERITY_PRIORITY[e.severity] <= SEVERITY_PRIORITY[filters.severity!]);
    if (filters.process) results = results.filter(e => e.process === filters.process);
    if (filters.since) results = results.filter(e => e.timestamp >= filters.since!);
    if (filters.until) results = results.filter(e => e.timestamp <= filters.until!);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(e => e.message.toLowerCase().includes(q) || e.process.toLowerCase().includes(q));
    }

    return results.slice(-(filters.limit ?? 100));
  }

  /** Get log statistics. */
  getStats(): { total: number; byFacility: Record<string, number>; bySeverity: Record<string, number>; byProcess: Record<string, number> } {
    const byFacility: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byProcess: Record<string, number> = {};

    for (const entry of this.logs) {
      byFacility[entry.facility] = (byFacility[entry.facility] || 0) + 1;
      bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;
      byProcess[entry.process] = (byProcess[entry.process] || 0) + 1;
    }

    return { total: this.logs.length, byFacility, bySeverity, byProcess };
  }

  /** Get unique process names from logs. */
  getProcesses(): string[] {
    return [...new Set(this.logs.map(e => e.process))];
  }

  // ─── Configuration ────────────────────────────────────────────────────

  /** Set minimum severity level to log. */
  setFilterSeverity(severity: SyslogSeverity): void {
    this.filterSeverity = severity;
  }

  /** Set max log entries before rotation. */
  setMaxEntries(max: number): void {
    this.maxEntries = Math.max(100, max);
  }

  /** Set hostname. */
  setHostname(hostname: string): void {
    this.hostname = hostname;
  }

  /** Clear all logs. */
  clear(): void {
    this.logs = [];
  }

  // ─── Observer ─────────────────────────────────────────────────────────

  subscribe(listener: (entry: SyslogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const syslog = new SyslogService();
