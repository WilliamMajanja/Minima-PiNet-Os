/**
 * PiNet-OS Init System / Service Manager
 * Manages system runlevels, service orchestration, dependency resolution,
 * and automatic service recovery. Equivalent to systemd for PiNet-OS.
 */

import type {
  RunLevel,
  ServiceUnit,
  ServiceState,
  ServiceType,
  ServiceLogEntry,
  InitTarget,
} from '../types/kernel.js';

import * as fs from 'fs';
import { execFileSync } from 'child_process';

// ─── Init System ────────────────────────────────────────────────────────────

class InitSystem {
  private services = new Map<string, ServiceUnit>();
  private targets = new Map<string, InitTarget>();
  private currentRunLevel: RunLevel = 5;
  private bootTime = Date.now();
  private listeners: Array<() => void> = [];

  constructor() {
    this.defineTargets();
    this.registerCoreServices();
  }

  // ─── Targets / Run Levels ─────────────────────────────────────────────

  private defineTargets(): void {
    const targetDefs: Array<Omit<InitTarget, 'active'>> = [
      { name: 'poweroff.target', description: 'System Power Off', runLevel: 0, services: [] },
      { name: 'rescue.target', description: 'Single-User / Rescue Mode', runLevel: 1, services: ['systemd-journald', 'sshd'] },
      { name: 'multi-user-nonet.target', description: 'Multi-User (No Networking)', runLevel: 2, services: ['systemd-journald', 'systemd-logind', 'sshd', 'chronyd'] },
      { name: 'multi-user.target', description: 'Multi-User', runLevel: 3, services: ['systemd-journald', 'systemd-udevd', 'systemd-logind', 'NetworkManager', 'sshd', 'chronyd', 'minima', 'pinet-cluster-manager', 'pinet-hal', 'pinet-storage'] },
      { name: 'custom.target', description: 'Custom Target', runLevel: 4, services: [] },
      { name: 'graphical.target', description: 'Graphical Desktop', runLevel: 5, services: ['systemd-journald', 'systemd-udevd', 'systemd-logind', 'NetworkManager', 'sshd', 'chronyd', 'minima', 'pinet-cluster-manager', 'pinet-hal', 'pinet-storage', 'pinet-desktop', 'pinet-ota'] },
      { name: 'reboot.target', description: 'System Reboot', runLevel: 6, services: [] },
    ];

    for (const t of targetDefs) {
      this.targets.set(t.name, { ...t, active: t.runLevel === this.currentRunLevel });
    }
  }

  // ─── Core Service Registration ────────────────────────────────────────

  /** Look up real PID of a process by name using pgrep */
  private findRealPid(processName: string): number | undefined {
    try {
      const raw = execFileSync('pgrep', ['-x', '-o', processName], { stdio: 'pipe' }).toString().trim();
      const pid = parseInt(raw, 10);
      return Number.isFinite(pid) ? pid : undefined;
    } catch {
      return undefined;
    }
  }

  private registerCoreServices(): void {
    const now = Date.now();

    // Attempt to find real PIDs for each service
    const pidMap: Record<string, number | undefined> = {
      'systemd-journald': this.findRealPid('systemd-journald'),
      'systemd-udevd': this.findRealPid('systemd-udevd'),
      'systemd-logind': this.findRealPid('systemd-logind'),
      'sshd': this.findRealPid('sshd'),
      'chronyd': this.findRealPid('chronyd'),
      'NetworkManager': this.findRealPid('NetworkManager'),
      'java': this.findRealPid('java'), // minima
    };

    const defs: Array<Omit<ServiceUnit, 'state' | 'restartCount' | 'logs' | 'startedAt'>> = [
      {
        name: 'systemd-journald', description: 'Journal Logging Service',
        type: 'notify', pid: pidMap['systemd-journald'] ?? 7, mainPid: pidMap['systemd-journald'] ?? 7, autoRestart: true, maxRestarts: 5,
        restartDelayMs: 1000, dependencies: [], wantedBy: ['multi-user.target'],
        execStart: '/lib/systemd/systemd-journald', runLevel: [1, 2, 3, 4, 5], enabled: true,
      },
      {
        name: 'systemd-udevd', description: 'Device Manager',
        type: 'notify', pid: pidMap['systemd-udevd'] ?? 8, mainPid: pidMap['systemd-udevd'] ?? 8, autoRestart: true, maxRestarts: 5,
        restartDelayMs: 1000, dependencies: ['systemd-journald'], wantedBy: ['multi-user.target'],
        execStart: '/lib/systemd/systemd-udevd', runLevel: [3, 4, 5], enabled: true,
      },
      {
        name: 'systemd-logind', description: 'Login Service',
        type: 'notify', pid: pidMap['systemd-logind'] ?? 9, mainPid: pidMap['systemd-logind'] ?? 9, autoRestart: true, maxRestarts: 5,
        restartDelayMs: 2000, dependencies: ['systemd-journald', 'systemd-udevd'],
        wantedBy: ['multi-user.target'], execStart: '/lib/systemd/systemd-logind',
        runLevel: [2, 3, 4, 5], enabled: true,
      },
      {
        name: 'NetworkManager', description: 'Network Manager',
        type: 'simple', pid: pidMap['NetworkManager'] ?? 12, mainPid: pidMap['NetworkManager'] ?? 12, autoRestart: true, maxRestarts: 10,
        restartDelayMs: 5000, dependencies: ['systemd-udevd'],
        wantedBy: ['multi-user.target'], execStart: '/usr/sbin/NetworkManager --no-daemon',
        runLevel: [3, 4, 5], enabled: true,
      },
      {
        name: 'sshd', description: 'OpenSSH Server',
        type: 'simple', pid: pidMap['sshd'] ?? 10, mainPid: pidMap['sshd'] ?? 10, autoRestart: true, maxRestarts: 10,
        restartDelayMs: 3000, dependencies: ['systemd-logind', 'NetworkManager'],
        wantedBy: ['multi-user.target'], execStart: '/usr/sbin/sshd -D',
        user: 'root', runLevel: [1, 2, 3, 4, 5], enabled: true,
      },
      {
        name: 'chronyd', description: 'NTP Time Synchronization',
        type: 'simple', pid: pidMap['chronyd'] ?? 11, mainPid: pidMap['chronyd'] ?? 11, autoRestart: true, maxRestarts: 5,
        restartDelayMs: 5000, dependencies: ['NetworkManager'],
        wantedBy: ['multi-user.target'], execStart: '/usr/sbin/chronyd -F 1',
        runLevel: [2, 3, 4, 5], enabled: true,
      },
      {
        name: 'minima', description: 'Minima Blockchain Node',
        type: 'simple', pid: pidMap['java'] ?? 13, mainPid: pidMap['java'] ?? 13, autoRestart: true, maxRestarts: 10,
        restartDelayMs: 10000, dependencies: ['NetworkManager'],
        wantedBy: ['multi-user.target'],
        execStart: '/usr/bin/java -jar /opt/minima/minima.jar -rpcenable -rpc 9001',
        environment: { JAVA_HOME: '/usr/lib/jvm/java-17-openjdk-arm64' },
        runLevel: [3, 4, 5], enabled: true,
      },
      {
        name: 'pinet-cluster-manager', description: 'PiNet Cluster Manager',
        type: 'simple', pid: 15, mainPid: 15, autoRestart: true, maxRestarts: 5,
        restartDelayMs: 5000, dependencies: ['minima', 'NetworkManager'],
        wantedBy: ['multi-user.target'], execStart: '/opt/pinet/cluster-manager',
        environment: { PINET_CLUSTER_API_PORT: '9090' },
        runLevel: [3, 4, 5], enabled: true,
      },
      {
        name: 'pinet-hal', description: 'PiNet Hardware Abstraction Layer',
        type: 'simple', pid: 16, mainPid: 16, autoRestart: true, maxRestarts: 5,
        restartDelayMs: 3000, dependencies: ['systemd-udevd'],
        wantedBy: ['multi-user.target'], execStart: '/opt/pinet/hal-daemon',
        runLevel: [3, 4, 5], enabled: true,
      },
      {
        name: 'pinet-storage', description: 'PiNet IPFS Storage',
        type: 'simple', pid: 17, mainPid: 17, autoRestart: true, maxRestarts: 5,
        restartDelayMs: 10000, dependencies: ['NetworkManager'],
        wantedBy: ['multi-user.target'], execStart: '/usr/local/bin/ipfs daemon',
        runLevel: [3, 4, 5], enabled: true,
      },
      {
        name: 'pinet-desktop', description: 'PiNet Web Desktop Server',
        type: 'simple', pid: 14, mainPid: 14, autoRestart: true, maxRestarts: 5,
        restartDelayMs: 5000, dependencies: ['minima', 'NetworkManager', 'pinet-hal'],
        wantedBy: ['graphical.target'], execStart: '/usr/bin/node /opt/pinet/server.js',
        environment: { PINET_DESKTOP_PORT: '3000', NODE_ENV: 'production' },
        runLevel: [5], enabled: true,
      },
      {
        name: 'pinet-ota', description: 'PiNet OTA Update Service',
        type: 'oneshot', autoRestart: false, maxRestarts: 0,
        restartDelayMs: 0, dependencies: ['NetworkManager'],
        wantedBy: ['graphical.target'], execStart: '/opt/pinet/ota-update.sh',
        runLevel: [3, 4, 5], enabled: true,
      },
      {
        name: 'wireguard', description: 'WireGuard VPN Mesh',
        type: 'oneshot', autoRestart: false, maxRestarts: 0,
        restartDelayMs: 0, dependencies: ['NetworkManager'],
        wantedBy: ['multi-user.target'], execStart: '/usr/bin/wg-quick up wg0',
        execStop: '/usr/bin/wg-quick down wg0',
        runLevel: [3, 4, 5], enabled: true,
      },
      {
        name: 'pinet-firewall', description: 'PiNet Firewall (UFW)',
        type: 'oneshot', autoRestart: false, maxRestarts: 0,
        restartDelayMs: 0, dependencies: ['NetworkManager'],
        wantedBy: ['multi-user.target'], execStart: '/usr/sbin/ufw enable',
        runLevel: [3, 4, 5], enabled: true,
      },
    ];

    for (const d of defs) {
      this.services.set(d.name, {
        ...d,
        state: d.runLevel.includes(this.currentRunLevel) ? 'active' : 'inactive',
        restartCount: 0,
        startedAt: d.runLevel.includes(this.currentRunLevel) ? now - Math.floor(Math.random() * 300000) : undefined,
        logs: [
          { timestamp: now, level: 'info', message: `${d.name} registered`, source: 'init' },
        ],
      });
    }
  }

  // ─── Service Lifecycle ────────────────────────────────────────────────

  /** Start a service by name. */
  async startService(name: string): Promise<{ success: boolean; error?: string }> {
    const svc = this.services.get(name);
    if (!svc) return { success: false, error: `Service '${name}' not found` };
    if (svc.state === 'active') return { success: true };

    // Check dependencies
    for (const dep of svc.dependencies) {
      const depSvc = this.services.get(dep);
      if (!depSvc || depSvc.state !== 'active') {
        const depResult = await this.startService(dep);
        if (!depResult.success) {
          return { success: false, error: `Dependency '${dep}' failed to start: ${depResult.error}` };
        }
      }
    }

    svc.state = 'activating';
    this.addLog(name, 'info', `Starting ${name}...`);
    this.notify();

    // Simulate startup delay
    await new Promise(r => setTimeout(r, 50));

    svc.state = 'active';
    svc.startedAt = Date.now();
    svc.stoppedAt = undefined;
    this.addLog(name, 'info', `Started ${name} successfully`);
    this.notify();

    return { success: true };
  }

  /** Stop a service by name. */
  async stopService(name: string): Promise<{ success: boolean; error?: string }> {
    const svc = this.services.get(name);
    if (!svc) return { success: false, error: `Service '${name}' not found` };
    if (svc.state === 'inactive') return { success: true };

    // Stop dependent services first
    for (const [svcName, svcUnit] of this.services) {
      if (svcUnit.dependencies.includes(name) && svcUnit.state === 'active') {
        await this.stopService(svcName);
      }
    }

    svc.state = 'deactivating';
    this.addLog(name, 'info', `Stopping ${name}...`);
    this.notify();

    await new Promise(r => setTimeout(r, 30));

    svc.state = 'inactive';
    svc.stoppedAt = Date.now();
    svc.pid = undefined;
    this.addLog(name, 'info', `Stopped ${name}`);
    this.notify();

    return { success: true };
  }

  /** Restart a service. */
  async restartService(name: string): Promise<{ success: boolean; error?: string }> {
    const svc = this.services.get(name);
    if (!svc) return { success: false, error: `Service '${name}' not found` };

    await this.stopService(name);
    svc.restartCount++;
    return this.startService(name);
  }

  /** Reload a service configuration. */
  async reloadService(name: string): Promise<{ success: boolean; error?: string }> {
    const svc = this.services.get(name);
    if (!svc) return { success: false, error: `Service '${name}' not found` };
    if (svc.state !== 'active') return { success: false, error: 'Service not running' };

    svc.state = 'reloading';
    this.addLog(name, 'info', `Reloading ${name} configuration...`);
    this.notify();

    await new Promise(r => setTimeout(r, 20));
    svc.state = 'active';
    this.addLog(name, 'info', `Reloaded ${name}`);
    this.notify();

    return { success: true };
  }

  /** Enable or disable a service for auto-start. */
  enableService(name: string, enabled: boolean): boolean {
    const svc = this.services.get(name);
    if (!svc) return false;
    svc.enabled = enabled;
    this.addLog(name, 'info', `${enabled ? 'Enabled' : 'Disabled'} ${name}`);
    this.notify();
    return true;
  }

  // ─── Run Level ────────────────────────────────────────────────────────

  /** Switch to a new run level. */
  async switchRunLevel(level: RunLevel): Promise<void> {
    if (level === this.currentRunLevel) return;

    const oldLevel = this.currentRunLevel;
    this.currentRunLevel = level;

    // Update targets
    for (const [, target] of this.targets) {
      target.active = target.runLevel === level;
    }

    // Stop services not in new level, start those that are
    for (const [name, svc] of this.services) {
      if (svc.enabled && svc.runLevel.includes(level) && svc.state !== 'active') {
        await this.startService(name);
      } else if (!svc.runLevel.includes(level) && svc.state === 'active') {
        await this.stopService(name);
      }
    }

    this.notify();
  }

  /** Get current run level. */
  getRunLevel(): RunLevel { return this.currentRunLevel; }

  // ─── Queries ──────────────────────────────────────────────────────────

  /** Get a service by name. */
  getService(name: string): ServiceUnit | undefined {
    return this.services.get(name);
  }

  /** List all services. */
  listServices(): ServiceUnit[] {
    return Array.from(this.services.values());
  }

  /** List services by state. */
  listByState(state: ServiceState): ServiceUnit[] {
    return this.listServices().filter(s => s.state === state);
  }

  /** List all targets. */
  listTargets(): InitTarget[] {
    return Array.from(this.targets.values());
  }

  /** Get boot time. */
  getBootTime(): number { return this.bootTime; }

  /** Get uptime in ms. */
  getUptime(): number { return Date.now() - this.bootTime; }

  /** Get service dependency graph. */
  getDependencyGraph(): Array<{ service: string; dependencies: string[] }> {
    return this.listServices().map(s => ({ service: s.name, dependencies: s.dependencies }));
  }

  // ─── Logging ──────────────────────────────────────────────────────────

  private addLog(service: string, level: ServiceLogEntry['level'], message: string): void {
    const svc = this.services.get(service);
    if (!svc) return;
    svc.logs.push({ timestamp: Date.now(), level, message, source: service });
    // Keep last 100 log entries per service
    if (svc.logs.length > 100) svc.logs = svc.logs.slice(-100);
  }

  /** Get logs for a service. */
  getServiceLogs(name: string, limit = 50): ServiceLogEntry[] {
    const svc = this.services.get(name);
    if (!svc) return [];
    return svc.logs.slice(-limit);
  }

  /** Get all recent logs across all services. */
  getAllLogs(limit = 100): ServiceLogEntry[] {
    const allLogs: ServiceLogEntry[] = [];
    for (const svc of this.services.values()) {
      allLogs.push(...svc.logs);
    }
    return allLogs.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
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

export const initSystem = new InitSystem();
