/**
 * PiNet-OS Security Type Definitions
 * Types for mandatory access control, integrity verification, and security policies.
 */

// ─── Access Control ─────────────────────────────────────────────────────────

export type AccessControlMode = 'DAC' | 'MAC' | 'RBAC';

export interface AccessControlEntry {
  subject: string;           // user/group/role
  object: string;            // resource path
  permissions: string[];     // read, write, execute, admin
  effect: 'allow' | 'deny';
  conditions?: Record<string, string>;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  mode: AccessControlMode;
  rules: AccessControlEntry[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// ─── Integrity Verification ─────────────────────────────────────────────────

export interface IntegrityCheckResult {
  path: string;
  expectedHash: string;
  actualHash: string;
  algorithm: 'sha256' | 'sha512' | 'blake2b';
  valid: boolean;
  checkedAt: number;
}

export interface MeasuredBootEntry {
  pcr: number;               // Platform Configuration Register index
  digest: string;
  description: string;
  timestamp: number;
}

export interface TrustChain {
  bootloader: IntegrityCheckResult;
  kernel: IntegrityCheckResult;
  initramfs: IntegrityCheckResult;
  systemServices: IntegrityCheckResult[];
  overallValid: boolean;
  lastVerified: number;
}

// ─── Sandbox / Container Security ───────────────────────────────────────────

export interface SandboxPolicy {
  name: string;
  allowedSyscalls: string[];
  blockedSyscalls: string[];
  filesystemAccess: Array<{
    path: string;
    mode: 'read' | 'write' | 'readwrite' | 'none';
  }>;
  networkAccess: {
    outbound: boolean;
    inbound: boolean;
    allowedPorts: number[];
    allowedHosts: string[];
  };
  resourceLimits: {
    maxCpuPercent: number;
    maxMemoryBytes: number;
    maxOpenFiles: number;
    maxProcesses: number;
    maxDiskBytes: number;
  };
}

// ─── Threat Detection ───────────────────────────────────────────────────────

export type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface ThreatEvent {
  id: string;
  timestamp: number;
  level: ThreatLevel;
  category: 'intrusion' | 'malware' | 'anomaly' | 'policy-violation' | 'brute-force';
  source: string;
  description: string;
  mitigated: boolean;
  details: Record<string, unknown>;
}

export interface SecurityDashboard {
  threatLevel: ThreatLevel;
  openThreats: number;
  failedLogins24h: number;
  blockedConnections24h: number;
  integrityStatus: 'valid' | 'compromised' | 'unchecked';
  firewallActive: boolean;
  vpnActive: boolean;
  auditingEnabled: boolean;
  lastScan: number;
  policyCount: number;
}
