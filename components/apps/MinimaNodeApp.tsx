
import React, { useEffect, useState } from 'react';
import { NodeStats } from '../../types';
import { MinimaService } from '../../services/minimaService';

interface MinimaNodeAppProps {
  stats: NodeStats;
}

const MinimaNodeApp: React.FC<MinimaNodeAppProps> = ({ stats }) => {
  const [minimaStatus, setMinimaStatus] = useState<any>(null);
  const [connectionState, setConnectionState] = useState<string>('checking');

  useEffect(() => {
    if (window.electron) {
      window.electron.checkMinima().then(setMinimaStatus);
    }

    // Monitor connection state
    const checkConnection = () => {
      setConnectionState(MinimaService.connectionState);
    };
    checkConnection();
    const unsub = MinimaService.subscribe(checkConnection);
    return unsub;
  }, []);

  const isActive = minimaStatus ? minimaStatus.status === 'active' : stats.status === 'Synced';
  const isConnected = connectionState === 'connected';

  return (
    <div className="p-8 h-full space-y-8 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Minima Node</h1>
          <p className="text-slate-400">Enterprise Edge v{stats.version} • RPC Port 9001</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
            {isConnected ? 'RPC Connected' : connectionState}
          </div>
          <div className="px-4 py-2 rounded-full glass border border-white/10 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={`text-xs font-semibold ${isActive ? 'text-emerald-500' : 'text-red-500'} uppercase tracking-widest`}>
                {isActive ? 'Active & Protected' : 'Inactive'}
              </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Current Block" value={stats.blockHeight.toLocaleString()} icon={<BlockIcon />} />
        <StatCard title="Connected Peers" value={stats.peers.toString()} icon={<PeersIcon />} />
        <StatCard title="Node Uptime" value={stats.uptime} icon={<UptimeIcon />} />
        <StatCard title="Storage Used" value="12.4 GB" icon={<StorageIcon />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Decentralized Services (MiniDapps)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <MiniDappItem 
                name="MiniPay" 
                description="P2P Payments" 
                color="bg-blue-500/10 text-blue-400" 
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
            />
            <MiniDappItem 
                name="Maxima" 
                description="Encrypted P2P Bus" 
                color="bg-purple-500/10 text-purple-400" 
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>}
            />
            <MiniDappItem 
                name="Swap" 
                description="Atomic DEX" 
                color="bg-amber-500/10 text-amber-400" 
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>}
            />
            <MiniDappItem 
                name="ChainView" 
                description="Explorer" 
                color="bg-emerald-500/10 text-emerald-400" 
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>}
            />
            <MiniDappItem 
                name="Provenance" 
                description="On-chain Audit" 
                color="bg-rose-500/10 text-rose-400" 
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}
            />
            <button className="rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center p-4 hover:bg-white/5 hover:border-white/40 transition-all cursor-pointer group">
              <svg className="w-5 h-5 text-slate-500 group-hover:text-blue-400 mb-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
              <span className="text-slate-500 group-hover:text-slate-300 text-[10px] font-bold uppercase tracking-wider">Install New</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Node Health</h3>
          <div className="p-5 rounded-xl bg-slate-800/40 border border-white/5 space-y-4">
            <HealthIndicator label="Network Sync" percentage={stats.status === 'Synced' ? 100 : stats.status === 'Syncing' ? 60 : 0} color="bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <HealthIndicator label="Peer Quality" percentage={Math.min(100, (stats.peers / 20) * 100)} color="bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            <HealthIndicator label="Maxima Throughput" percentage={92} color="bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
          </div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-white/5">
            <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Enterprise Capabilities</h4>
            <div className="flex flex-wrap gap-1">
              {['Edge AI', 'k3s', 'IPFS', 'WireGuard', 'Maxima'].map(cap => (
                <span key={cap} className="px-2 py-1 text-[8px] font-bold bg-cyan-500/10 text-cyan-400 rounded-md border border-cyan-500/20">
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) => (
  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-[1.02]">
    <div className="text-slate-400 mb-3">{icon}</div>
    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</div>
    <div className="text-2xl font-bold text-white mt-1 font-mono">{value}</div>
  </div>
);

const MiniDappItem = ({ name, description, color, icon }: { name: string; description: string; color: string; icon: React.ReactNode }) => (
  <button className={`p-4 rounded-xl ${color} border border-white/5 text-left transition-all hover:scale-[1.05] hover:shadow-lg active:scale-95 flex flex-col gap-3 group`}>
    <div className="p-2 rounded-lg bg-white/5 w-fit group-hover:bg-white/10 transition-colors">
        {icon}
    </div>
    <div>
        <div className="font-bold text-sm tracking-wide">{name}</div>
        <div className="text-[10px] opacity-70 mt-0.5 leading-tight">{description}</div>
    </div>
  </button>
);

const HealthIndicator = ({ label, percentage, color }: { label: string; percentage: number; color: string }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
      <span>{label}</span>
      <span className="font-mono">{percentage}%</span>
    </div>
    <div className="h-2 w-full bg-slate-900/60 rounded-full overflow-hidden border border-white/5">
      <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${percentage}%` }} />
    </div>
  </div>
);

const BlockIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
const PeersIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const UptimeIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const StorageIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>;

export default MinimaNodeApp;
