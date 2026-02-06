
import React, { useState } from 'react';
import { ClusterNode } from '../../types';

interface ClusterManagerAppProps {
  nodes: ClusterNode[];
}

const ClusterManagerApp: React.FC<ClusterManagerAppProps> = ({ nodes }) => {
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const startProvisioning = (id: string) => {
    setProvisioningId(id);
    setTimeout(() => setProvisioningId(null), 5000);
  };

  const toggleBroadcast = () => {
    setIsBroadcasting(!isBroadcasting);
  };

  return (
    <div className="p-8 h-full space-y-8 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#C51A4A] rounded-2xl flex items-center justify-center shadow-lg shadow-pink-900/20 border border-white/10">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M19 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="m8 10 3-3"/><path d="m13 7 3 3"/><path d="m13 18-1-12"/><path d="m17 11-4 7"/><path d="m7 11 4 7"/></svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Cluster Orchestrator</h1>
            <p className="text-slate-400 font-medium italic">OS Multi-Pi Deployment Engine • PXE Discovery</p>
          </div>
        </div>
        <div className="flex gap-3">
           <button 
              onClick={toggleBroadcast}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 ${isBroadcasting ? 'bg-emerald-600 animate-pulse' : 'bg-white/5 border border-white/10 text-slate-300'}`}
           >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 5.64a9 9 0 1 1-12.73 0M12 2v10"/></svg>
              {isBroadcasting ? 'Broadcasting OS Image...' : 'Broadcast OS to Network'}
           </button>
           <span className="px-4 py-2 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-xl border border-emerald-500/20 uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              {nodes.length} Node{nodes.length !== 1 ? 's' : ''} Synced
           </span>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${nodes.length === 1 ? 'md:grid-cols-1 max-w-xl mx-auto' : 'md:grid-cols-3'} gap-6`}>
        {nodes.map(node => (
          <NodeCard 
            key={node.id} 
            node={node} 
            isProvisioning={provisioningId === node.id} 
            onProvision={() => startProvisioning(node.id)} 
            isBroadcastMode={isBroadcasting}
          />
        ))}
        {/* Placeholder slots for up to 3 nodes simulation */}
        {nodes.length < 3 && isBroadcasting && (
             <div className="glass-dark p-6 rounded-[2.5rem] border border-white/10 border-dashed flex flex-col items-center justify-center opacity-50 min-h-[300px]">
                 <div className="w-12 h-12 rounded-full bg-slate-800 animate-pulse flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
                 </div>
                 <div className="mt-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Searching...</div>
             </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8">
        <div className="glass-dark p-6 rounded-[2rem] border border-white/5 space-y-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                Provisioning Topology
            </h3>
            <div className="relative h-56 border border-white/10 rounded-2xl bg-black/40 overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')]" />
                <div className="flex items-center gap-4 sm:gap-12 z-10">
                    {nodes.map((node, i) => (
                        <React.Fragment key={node.id}>
                            <TopologyNode 
                                label={i === 0 ? "α" : i === 1 ? "β" : "γ"} 
                                color={i === 0 ? "border-pink-500" : i === 1 ? "border-emerald-500" : "border-amber-500"} 
                                glow={i === 0 ? "shadow-pink-500/30" : i === 1 ? "shadow-emerald-500/30" : "shadow-amber-500/30"} 
                            />
                            {i < nodes.length - 1 && (
                                <div className="relative w-10 sm:w-20 h-px bg-white/10">
                                    <div className={`absolute inset-0 bg-gradient-to-r ${i===0 ? 'from-pink-500 to-emerald-500' : 'from-emerald-500 to-amber-500'} ${isBroadcasting ? 'animate-[ping_1.5s_infinite]' : ''}`} />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                    {nodes.length === 1 && (
                        <div className="text-[10px] text-slate-600 font-mono absolute bottom-4">Single Node Mode</div>
                    )}
                </div>
            </div>
        </div>

        <div className="glass-dark p-6 rounded-[2rem] border border-white/5 space-y-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                Web3 Imager Configuration
            </h3>
            <div className="space-y-6">
                <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">OS Image Version</span>
                        <div className="text-3xl font-mono font-bold text-pink-500 tracking-tighter">1.0.35-STABLE</div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Architecture</span>
                        <span className="text-sm font-mono text-white font-bold">AARCH64 (v8.1)</span>
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-[11px] font-mono text-slate-400">
                    pinet-cluster discovery=auto pxe=enabled burn=m402
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <button className="flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs font-bold transition-all border border-white/10 active:scale-95">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>
                        Mass Config
                    </button>
                    <button className="flex items-center justify-center gap-2 py-4 bg-pink-600 hover:bg-pink-500 text-white rounded-2xl text-xs font-bold transition-all shadow-lg active:scale-95">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        Export Flash ISO
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const TopologyNode = ({ label, color, glow }: { label: string; color: string; glow: string }) => (
    <div className={`w-14 h-14 rounded-2xl bg-slate-900 border-2 ${color} ${glow} flex items-center justify-center text-white text-lg font-bold shadow-2xl transition-transform hover:scale-110 cursor-pointer`}>
        {label}
    </div>
);

interface NodeCardProps {
  node: ClusterNode;
  isProvisioning: boolean;
  onProvision: () => void;
  isBroadcastMode: boolean;
}

const NodeCard: React.FC<NodeCardProps> = ({ node, isProvisioning, onProvision, isBroadcastMode }) => {
    const getHatLabel = (hat: string) => {
        switch(hat) {
            case 'AI_NPU': return { label: 'AI NPU Accelerate', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.989-2.386l-.548-.547z"/></svg>, color: 'text-pink-400' };
            case 'SENSE': return { label: 'Environment Sense', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>, color: 'text-emerald-400' };
            case 'SSD_NVME': return { label: 'NVMe Sharding', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/></svg>, color: 'text-amber-400' };
            default: return { label: 'Generic Node', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>, color: 'text-slate-400' };
        }
    };

    const h = getHatLabel(node.hat);

    return (
        <div className="glass-dark p-6 rounded-[2.5rem] border border-white/10 hover:border-pink-500/30 transition-all group hover:bg-white/5 flex flex-col h-full relative overflow-hidden">
            {isBroadcastMode && node.status !== 'online' && (
                <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[2px] flex flex-col items-center justify-center z-10 p-6 text-center">
                    <div className="w-12 h-12 bg-emerald-500 rounded-full animate-ping mb-4 opacity-50" />
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Found New Node</div>
                    <div className="text-[10px] text-emerald-300 opacity-60">Waiting for PXE handshake...</div>
                    <button className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[9px] font-bold uppercase">Flash Web3PiOS</button>
                </div>
            )}

            <div className="flex justify-between items-start mb-5">
                <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{node.ip}</div>
                    <div className="text-xl font-bold text-white group-hover:text-pink-400 transition-colors mt-1">{node.name}</div>
                </div>
                <div className={`px-3 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase ${node.status === 'online' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-400'}`}>
                    ● {node.status}
                </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 mb-6">
                <div className={h.color}>{h.icon}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{h.label}</div>
            </div>

            <div className="space-y-4 flex-1">
                <MetricBar label="Core Load" value={node.metrics.cpu} color="bg-pink-500" />
                <MetricBar label="Memory" value={node.metrics.ram * 4} color="bg-emerald-500" />
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
                {isProvisioning ? (
                    <div className="space-y-2">
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-pink-500 animate-[provision_5s_linear]" />
                        </div>
                        <p className="text-[9px] font-bold text-pink-500 uppercase text-center tracking-widest">Imaging Web3PiOS...</p>
                    </div>
                ) : (
                    <button 
                        onClick={onProvision}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl border border-white/10 transition-all active:scale-95"
                    >
                        Provision Node
                    </button>
                )}
            </div>
        </div>
    );
};

const MetricBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span>{label}</span>
            <span className="font-mono">{Math.round(value)}%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div className={`h-full ${color} transition-all duration-1000 shadow-[0_0_8px_rgba(0,0,0,0.5)]`} style={{ width: `${value}%` }} />
        </div>
    </div>
);

export default ClusterManagerApp;
