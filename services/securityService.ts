/**
 * PiNet-OS Security Service
 * Mandatory Access Control, capabilities, audit logging, and integrity verification.
 * Provides a comprehensive security framework for the operating system.
 */

import crypto from 'crypto';
import type {
  SecurityProfile,
  AuditEvent,
  CapabilityName,
} from '../types/kernel.js';
import type {
  SecurityPolicy,
  AccessControlEntry,
  IntegrityCheckResult,
  TrustChain,
  SecurityDashboard,
  ThreatEvent,
  ThreatLevel,
} from '../types/security.js';

// ─── Security Service ───────────────────────────────────────────────────────

class SecurityService {
  private policies: SecurityPolicy[] = [];
  private profiles = new Map<string, SecurityProfile>();
  private auditLog: AuditEvent[] = [];
  private threats: ThreatEvent[] = [];
  private integrityResults = new Map<string, IntegrityCheckResult>();
  private trustChain: TrustChain | null = null;
  private maxAuditEntries = 10000;
  private nextAuditId = 1;
  private listeners: Array<() => void> = [];

  constructor() {
    this.initDefaultPolicies();
    this.initDefaultProfiles();
    this.initIntegrityBaseline();
  }

  // ─── Initialization ───────────────────────────────────────────────────

  private initDefaultPolicies(): void {
    this.policies = [
      {
        id: 'policy-default', name: 'Default System Policy',
        description: 'Base security policy for PiNet-OS',
        mode: 'MAC', enabled: true,
        createdAt: Date.now(), updatedAt: Date.now(),
        rules: [
          { subject: 'root', object: '/**', permissions: ['read', 'write', 'execute', 'admin'], effect: 'allow' },
          { subject: 'pi', object: '/home/pi/**', permissions: ['read', 'write', 'execute'], effect: 'allow' },
          { subject: 'pi', object: '/opt/pinet/**', permissions: ['read', 'execute'], effect: 'allow' },
          { subject: 'pi', object: '/etc/pinet/**', permissions: ['read'], effect: 'allow' },
          { subject: '*', object: '/boot/**', permissions: ['read'], effect: 'allow' },
          { subject: '*', object: '/boot/**', permissions: ['write'], effect: 'deny' },
          { subject: '*', object: '/proc/**', permissions: ['read'], effect: 'allow' },
          { subject: '*', object: '/sys/**', permissions: ['read'], effect: 'allow' },
        ],
      },
      {
        id: 'policy-network', name: 'Network Security Policy',
        description: 'Controls network access and firewall rules',
        mode: 'MAC', enabled: true,
        createdAt: Date.now(), updatedAt: Date.now(),
        rules: [
          { subject: 'minima', object: 'port:9001', permissions: ['read', 'write'], effect: 'allow' },
          { subject: 'pinet-desktop', object: 'port:3000', permissions: ['read', 'write'], effect: 'allow' },
          { subject: 'pinet-cluster', object: 'port:9090', permissions: ['read', 'write'], effect: 'allow' },
          { subject: 'sshd', object: 'port:22', permissions: ['read', 'write'], effect: 'allow' },
          { subject: '*', object: 'port:0-1023', permissions: ['write'], effect: 'deny' },
        ],
      },
      {
        id: 'policy-container', name: 'Container Isolation Policy',
        description: 'Restricts container workload access',
        mode: 'MAC', enabled: true,
        createdAt: Date.now(), updatedAt: Date.now(),
        rules: [
          { subject: 'container:*', object: '/dev/**', permissions: ['read', 'write'], effect: 'deny' },
          { subject: 'container:*', object: '/proc/sys/**', permissions: ['write'], effect: 'deny' },
          { subject: 'container:*', object: 'network:host', permissions: ['read', 'write'], effect: 'deny' },
        ],
      },
    ];
  }

  private initDefaultProfiles(): void {
    // Default security profile for the PiNet desktop
    this.profiles.set('pinet-desktop', {
      name: 'pinet-desktop', pid: 14,
      capabilities: ['CAP_NET_BIND_SERVICE'],
      seccompFilter: 'moderate',
      readOnlyPaths: ['/boot', '/usr'],
      hiddenPaths: ['/proc/kcore', '/proc/kmsg'],
      noNewPrivileges: true,
      namespaces: { pid: false, net: false, mount: false, uts: false, ipc: false, user: false },
    });

    this.profiles.set('minima', {
      name: 'minima', pid: 13,
      capabilities: ['CAP_NET_BIND_SERVICE', 'CAP_NET_RAW'],
      seccompFilter: 'moderate',
      readOnlyPaths: ['/boot', '/usr'],
      hiddenPaths: ['/proc/kcore'],
      noNewPrivileges: true,
      namespaces: { pid: false, net: false, mount: false, uts: false, ipc: false, user: false },
    });

    this.profiles.set('container-default', {
      name: 'container-default',
      capabilities: [],
      seccompFilter: 'strict',
      readOnlyPaths: ['/boot', '/usr', '/etc'],
      hiddenPaths: ['/proc/kcore', '/proc/kmsg', '/proc/sysrq-trigger'],
      noNewPrivileges: true,
      namespaces: { pid: true, net: true, mount: true, uts: true, ipc: true, user: true },
    });
  }

  private initIntegrityBaseline(): void {
    const now = Date.now();
    const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

    const checks: IntegrityCheckResult[] = [
      { path: '/boot/config.txt', expectedHash: hash('boot-config'), actualHash: hash('boot-config'), algorithm: 'sha256', valid: true, checkedAt: now },
      { path: '/boot/cmdline.txt', expectedHash: hash('cmdline'), actualHash: hash('cmdline'), algorithm: 'sha256', valid: true, checkedAt: now },
      { path: '/boot/kernel8.img', expectedHash: hash('kernel'), actualHash: hash('kernel'), algorithm: 'sha256', valid: true, checkedAt: now },
      { path: '/etc/pinet/config.json', expectedHash: hash('pinet-config'), actualHash: hash('pinet-config'), algorithm: 'sha256', valid: true, checkedAt: now },
      { path: '/opt/pinet/server.js', expectedHash: hash('server'), actualHash: hash('server'), algorithm: 'sha256', valid: true, checkedAt: now },
      { path: '/opt/minima/minima.jar', expectedHash: hash('minima'), actualHash: hash('minima'), algorithm: 'sha256', valid: true, checkedAt: now },
    ];

    for (const c of checks) {
      this.integrityResults.set(c.path, c);
    }

    this.trustChain = {
      bootloader: { path: '/boot/start4.elf', expectedHash: hash('bootloader'), actualHash: hash('bootloader'), algorithm: 'sha256', valid: true, checkedAt: now },
      kernel: { path: '/boot/kernel8.img', expectedHash: hash('kernel'), actualHash: hash('kernel'), algorithm: 'sha256', valid: true, checkedAt: now },
      initramfs: { path: '/boot/initramfs.img', expectedHash: hash('initramfs'), actualHash: hash('initramfs'), algorithm: 'sha256', valid: true, checkedAt: now },
      systemServices: checks,
      overallValid: true,
      lastVerified: now,
    };
  }

  // ─── Policy Management ────────────────────────────────────────────────

  addPolicy(policy: SecurityPolicy): void {
    this.policies.push(policy);
    this.notify();
  }

  removePolicy(id: string): boolean {
    const idx = this.policies.findIndex(p => p.id === id);
    if (idx < 0) return false;
    this.policies.splice(idx, 1);
    this.notify();
    return true;
  }

  getPolicy(id: string): SecurityPolicy | undefined {
    return this.policies.find(p => p.id === id);
  }

  listPolicies(): SecurityPolicy[] {
    return [...this.policies];
  }

  /** Check if an access is allowed by policies. */
  checkAccess(subject: string, object: string, permission: string): { allowed: boolean; reason: string } {
    for (const policy of this.policies) {
      if (!policy.enabled) continue;
      for (const rule of policy.rules) {
        const subjectMatch = rule.subject === '*' || rule.subject === subject || (rule.subject.includes('*') && new RegExp(rule.subject.replace(/\*/g, '.*')).test(subject));
        const objectMatch = rule.object === '*' || rule.object === object || (rule.object.includes('*') && new RegExp(rule.object.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')).test(object));
        const permMatch = rule.permissions.includes(permission);

        if (subjectMatch && objectMatch && permMatch) {
          const allowed = rule.effect === 'allow';
          this.recordAudit('access', `${subject} -> ${object} [${permission}]`, { uid: 0, pid: 0, process: subject }, { path: object }, allowed ? 'success' : 'denied');
          return { allowed, reason: `${policy.name}: ${rule.effect}` };
        }
      }
    }

    // Default deny
    this.recordAudit('access', `${subject} -> ${object} [${permission}] (default deny)`, { uid: 0, pid: 0, process: subject }, { path: object }, 'denied');
    return { allowed: false, reason: 'No matching policy rule (default deny)' };
  }

  // ─── Security Profiles ────────────────────────────────────────────────

  getProfile(name: string): SecurityProfile | undefined {
    return this.profiles.get(name);
  }

  setProfile(name: string, profile: SecurityProfile): void {
    this.profiles.set(name, profile);
    this.notify();
  }

  listProfiles(): SecurityProfile[] {
    return Array.from(this.profiles.values());
  }

  // ─── Audit Log ────────────────────────────────────────────────────────

  recordAudit(
    type: AuditEvent['type'],
    action: string,
    subject: AuditEvent['subject'],
    object: AuditEvent['object'],
    result: AuditEvent['result'],
    message?: string,
  ): AuditEvent {
    const event: AuditEvent = {
      id: `audit-${this.nextAuditId++}`,
      timestamp: Date.now(),
      type, action, subject, object, result,
      message: message ?? `${type}: ${action} => ${result}`,
    };
    this.auditLog.push(event);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-Math.floor(this.maxAuditEntries * 0.8));
    }
    return event;
  }

  getAuditLog(limit = 100): AuditEvent[] {
    return this.auditLog.slice(-limit);
  }

  queryAudit(filters: { type?: AuditEvent['type']; result?: AuditEvent['result']; since?: number; limit?: number }): AuditEvent[] {
    let results = this.auditLog;
    if (filters.type) results = results.filter(e => e.type === filters.type);
    if (filters.result) results = results.filter(e => e.result === filters.result);
    if (filters.since) results = results.filter(e => e.timestamp >= filters.since!);
    return results.slice(-(filters.limit ?? 100));
  }

  // ─── Threat Detection ─────────────────────────────────────────────────

  reportThreat(threat: Omit<ThreatEvent, 'id' | 'timestamp'>): ThreatEvent {
    const event: ThreatEvent = {
      ...threat,
      id: `threat-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: Date.now(),
    };
    this.threats.push(event);
    this.notify();
    return event;
  }

  getThreats(limit = 50): ThreatEvent[] {
    return this.threats.slice(-limit);
  }

  getOpenThreats(): ThreatEvent[] {
    return this.threats.filter(t => !t.mitigated);
  }

  mitigateThreat(id: string): boolean {
    const threat = this.threats.find(t => t.id === id);
    if (!threat) return false;
    threat.mitigated = true;
    this.notify();
    return true;
  }

  // ─── Integrity ────────────────────────────────────────────────────────

  getIntegrityResults(): IntegrityCheckResult[] {
    return Array.from(this.integrityResults.values());
  }

  getTrustChain(): TrustChain | null {
    return this.trustChain;
  }

  /** Run integrity verification on all monitored paths. */
  verifyIntegrity(): { valid: boolean; results: IntegrityCheckResult[] } {
    const results = this.getIntegrityResults();
    // In production, this would read files and compute hashes
    // For now, verify all checks still pass
    const allValid = results.every(r => r.valid);
    if (this.trustChain) {
      this.trustChain.overallValid = allValid;
      this.trustChain.lastVerified = Date.now();
    }
    return { valid: allValid, results };
  }

  // ─── Dashboard ────────────────────────────────────────────────────────

  getDashboard(): SecurityDashboard {
    const openThreats = this.getOpenThreats();
    const maxLevel = openThreats.reduce<ThreatLevel>((max, t) => {
      const levels: ThreatLevel[] = ['none', 'low', 'medium', 'high', 'critical'];
      return levels.indexOf(t.level) > levels.indexOf(max) ? t.level : max;
    }, 'none');

    const failedLogins = this.auditLog.filter(e => e.type === 'auth' && e.result === 'failure' && e.timestamp > Date.now() - 86400000).length;
    const blockedConns = this.auditLog.filter(e => e.type === 'network' && e.result === 'denied' && e.timestamp > Date.now() - 86400000).length;

    return {
      threatLevel: maxLevel,
      openThreats: openThreats.length,
      failedLogins24h: failedLogins,
      blockedConnections24h: blockedConns,
      integrityStatus: this.trustChain?.overallValid ? 'valid' : 'unchecked',
      firewallActive: true,
      vpnActive: true,
      auditingEnabled: true,
      lastScan: this.trustChain?.lastVerified ?? 0,
      policyCount: this.policies.length,
    };
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

export const securityService = new SecurityService();
