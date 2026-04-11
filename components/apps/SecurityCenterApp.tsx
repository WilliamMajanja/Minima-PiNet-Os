
import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../../utils/api';

interface SecurityDashboard {
  threatLevel: string;
  openThreats: number;
  failedLogins24h: number;
  policyCount: number;
  firewallActive: boolean;
  vpnActive: boolean;
  auditingEnabled: boolean;
  integrityStatus: string;
}

interface SecurityPolicy {
  id: string;
  name: string;
  mode: string;
  enabled: boolean;
  description: string;
  rules?: unknown[];
}

interface AuditEvent {
  id: string;
  timestamp: number;
  result: string;
  type: string;
  message: string;
}

interface SecurityProfile {
  name: string;
  pid?: number;
  seccompFilter: string;
  capabilities: string[];
  noNewPrivileges: boolean;
  readOnlyPaths?: string[];
}

interface IntegrityResult {
  valid: boolean;
  path: string;
  algorithm: string;
  expectedHash?: string;
}

interface IntegrityReport {
  valid: boolean;
  results: IntegrityResult[];
}

interface Threat {
  id: string;
  level: string;
  category: string;
  mitigated: boolean;
  description: string;
  timestamp: number;
}

const SecurityCenterApp: React.FC = () => {
  const [dashboard, setDashboard] = useState<SecurityDashboard | null>(null);
  const [policies, setPolicies] = useState<SecurityPolicy[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [profiles, setProfiles] = useState<SecurityProfile[]>([]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'policies' | 'audit' | 'profiles' | 'integrity' | 'threats'>('overview');

  const fetchAll = () => {
    fetch(getApiUrl('/api/security/dashboard')).then(r => r.json()).then(d => setDashboard(d)).catch(() => { /* Security API unavailable */ });
    fetch(getApiUrl('/api/security/policies')).then(r => r.json()).then(d => setPolicies(d.policies ?? [])).catch(() => { /* Security API unavailable */ });
    fetch(getApiUrl('/api/security/audit?limit=50')).then(r => r.json()).then(d => setAudit(d.events ?? [])).catch(() => { /* Security API unavailable */ });
    fetch(getApiUrl('/api/security/profiles')).then(r => r.json()).then(d => setProfiles(d.profiles ?? [])).catch(() => { /* Security API unavailable */ });
    fetch(getApiUrl('/api/security/threats')).then(r => r.json()).then(d => setThreats(d.threats ?? [])).catch(() => { /* Security API unavailable */ });
    fetch(getApiUrl('/api/security/integrity')).then(r => r.json()).then(d => setIntegrity(d)).catch(() => { /* Security API unavailable */ });
  };

  const runIntegrityCheck = () => {
    fetch(getApiUrl('/api/security/integrity'))
      .then(r => r.json())
      .then(d => { setIntegrity(d); setActiveTab('integrity'); })
      .catch(() => { /* Integrity check unavailable */ });
  };

  const generateSecurityReport = () => {
    fetchAll();
    setActiveTab('overview');
  };

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 10000); return () => clearInterval(i); }, []);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: '🛡️' },
    { id: 'policies' as const, label: 'Policies', icon: '📋' },
    { id: 'audit' as const, label: 'Audit Log', icon: '📝' },
    { id: 'profiles' as const, label: 'Profiles', icon: '🔐' },
    { id: 'integrity' as const, label: 'Integrity', icon: '✅' },
    { id: 'threats' as const, label: 'Threats', icon: '⚠️' },
  ];

  const threatColor = (level: string) => {
    switch (level) { case 'critical': return 'text-red-500 bg-red-600/20'; case 'high': return 'text-orange-400 bg-orange-600/20'; case 'medium': return 'text-yellow-400 bg-yellow-600/20'; case 'low': return 'text-blue-400 bg-blue-600/20'; default: return 'text-emerald-400 bg-emerald-600/20'; }
  };

  return (
    <div className="flex h-full bg-slate-900/40">
      <div className="w-44 bg-black/20 border-r border-white/5 p-4 flex flex-col gap-1">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Security</h2>
        {tabs.map(t => (
          <button key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-all ${activeTab === t.id ? 'bg-blue-600/20 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} onClick={() => setActiveTab(t.id)}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'overview' && dashboard && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Security Dashboard</h1>
            <div className="grid grid-cols-4 gap-3">
              <div className={`p-4 rounded-2xl border border-white/5 ${threatColor(dashboard.threatLevel)}`}>
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Threat Level</div>
                <div className="text-2xl font-bold mt-1 uppercase">{dashboard.threatLevel}</div>
              </div>
              <div className="p-4 rounded-2xl border border-white/5 bg-black/20">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Open Threats</div>
                <div className="text-2xl font-bold text-white mt-1">{dashboard.openThreats}</div>
              </div>
              <div className="p-4 rounded-2xl border border-white/5 bg-black/20">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Failed Logins (24h)</div>
                <div className="text-2xl font-bold text-white mt-1">{dashboard.failedLogins24h}</div>
              </div>
              <div className="p-4 rounded-2xl border border-white/5 bg-black/20">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Policies Active</div>
                <div className="text-2xl font-bold text-white mt-1">{dashboard.policyCount}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl border border-white/5 bg-black/20 space-y-2">
                <h3 className="text-sm font-bold text-white">System Status</h3>
                <div className="flex items-center gap-2 text-xs"><span>{dashboard.firewallActive ? '🟢' : '🔴'}</span><span className="text-slate-300">Firewall</span></div>
                <div className="flex items-center gap-2 text-xs"><span>{dashboard.vpnActive ? '🟢' : '🔴'}</span><span className="text-slate-300">VPN (WireGuard)</span></div>
                <div className="flex items-center gap-2 text-xs"><span>{dashboard.auditingEnabled ? '🟢' : '🔴'}</span><span className="text-slate-300">Audit Logging</span></div>
                <div className="flex items-center gap-2 text-xs"><span>{dashboard.integrityStatus === 'valid' ? '🟢' : '🟡'}</span><span className="text-slate-300">System Integrity: {dashboard.integrityStatus}</span></div>
              </div>
              <div className="p-4 rounded-2xl border border-white/5 bg-black/20 space-y-2">
                <h3 className="text-sm font-bold text-white">Quick Actions</h3>
                <button className="w-full px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-xl text-xs text-left transition-all" onClick={fetchAll}>🔄 Refresh Security Status</button>
                <button className="w-full px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-xl text-xs text-left transition-all" onClick={runIntegrityCheck}>🔍 Run Integrity Check</button>
                <button className="w-full px-3 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 rounded-xl text-xs text-left transition-all" onClick={generateSecurityReport}>📊 Generate Security Report</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'policies' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Security Policies</h1>
            {policies.map((p: SecurityPolicy) => (
              <div key={p.id} className="p-4 rounded-2xl border border-white/5 bg-black/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">{p.name}</span>
                    <span className="px-2 py-0.5 bg-blue-600/20 text-blue-300 rounded text-[10px] font-bold">{p.mode}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.enabled ? 'bg-emerald-600/20 text-emerald-300' : 'bg-red-600/20 text-red-300'}`}>{p.enabled ? 'ACTIVE' : 'DISABLED'}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-500 mb-2">{p.description}</div>
                <div className="text-[10px] text-slate-600">{p.rules?.length ?? 0} rules</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Audit Log</h1>
            <div className="space-y-1">
              {audit.map((e: AuditEvent) => (
                <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-xs">
                  <span className="text-slate-600 font-mono w-36 flex-shrink-0">{new Date(e.timestamp).toLocaleString()}</span>
                  <span className={`w-16 font-bold ${e.result === 'success' ? 'text-emerald-400' : e.result === 'denied' ? 'text-red-400' : 'text-yellow-400'}`}>{e.result}</span>
                  <span className="px-1.5 py-0.5 bg-white/5 rounded text-slate-400 w-16 text-center">{e.type}</span>
                  <span className="text-slate-300 flex-1 truncate">{e.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Security Profiles</h1>
            {profiles.map((p: SecurityProfile) => (
              <div key={p.name} className="p-4 rounded-2xl border border-white/5 bg-black/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white font-bold text-sm">{p.name}</span>
                  {p.pid && <span className="text-xs text-slate-500">PID: {p.pid}</span>}
                  <span className="px-2 py-0.5 bg-purple-600/20 text-purple-300 rounded text-[10px] font-bold">seccomp: {p.seccompFilter}</span>
                </div>
                <div className="text-xs text-slate-400">
                  Capabilities: {p.capabilities?.length > 0 ? p.capabilities.join(', ') : 'None'}
                </div>
                <div className="text-[10px] text-slate-600 mt-1">
                  {p.noNewPrivileges && '🔒 No new privileges | '}
                  Read-only: {p.readOnlyPaths?.join(', ') || 'None'}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'integrity' && integrity && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">System Integrity</h1>
            <div className={`p-4 rounded-2xl border ${integrity.valid ? 'border-emerald-500/20 bg-emerald-600/5' : 'border-red-500/20 bg-red-600/5'}`}>
              <div className="text-lg font-bold">{integrity.valid ? '✅ System Integrity Valid' : '❌ Integrity Compromised'}</div>
            </div>
            <div className="space-y-2">
              {(integrity.results ?? []).map((r: IntegrityResult, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-black/20 text-xs">
                  <span>{r.valid ? '✅' : '❌'}</span>
                  <span className="text-white font-mono flex-1">{r.path}</span>
                  <span className="text-slate-500">{r.algorithm}</span>
                  <span className="text-slate-600 font-mono truncate max-w-[120px]">{r.expectedHash?.slice(0, 16)}...</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'threats' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Threat Detection</h1>
            {threats.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <div className="text-4xl mb-2">🛡️</div>
                <div className="text-sm">No threats detected</div>
              </div>
            ) : (
              threats.map((t: Threat) => (
                <div key={t.id} className={`p-4 rounded-2xl border border-white/5 bg-black/20`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${threatColor(t.level)}`}>{t.level}</span>
                    <span className="text-white text-sm">{t.category}</span>
                    {t.mitigated && <span className="px-2 py-0.5 bg-emerald-600/20 text-emerald-300 rounded text-[10px] font-bold">MITIGATED</span>}
                  </div>
                  <div className="text-xs text-slate-400">{t.description}</div>
                  <div className="text-[10px] text-slate-600 mt-1">{new Date(t.timestamp).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityCenterApp;
