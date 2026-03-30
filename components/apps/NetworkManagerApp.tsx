
import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../../utils/api';

const NetworkManagerApp: React.FC = () => {
  const [interfaces, setInterfaces] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [firewallRules, setFirewallRules] = useState<any[]>([]);
  const [dns, setDns] = useState<any>({});
  const [wireguard, setWireguard] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'interfaces' | 'routes' | 'firewall' | 'dns' | 'vpn'>('interfaces');

  const fetchAll = () => {
    fetch(getApiUrl('/api/network/interfaces')).then(r => r.json()).then(d => { setInterfaces(d.interfaces ?? []); setStats(d.stats ?? {}); }).catch(() => {});
    fetch(getApiUrl('/api/network/routes')).then(r => r.json()).then(d => setRoutes(d.routes ?? [])).catch(() => {});
    fetch(getApiUrl('/api/network/firewall')).then(r => r.json()).then(d => setFirewallRules(d.rules ?? [])).catch(() => {});
    fetch(getApiUrl('/api/network/dns')).then(r => r.json()).then(d => setDns(d)).catch(() => {});
    fetch(getApiUrl('/api/network/wireguard')).then(r => r.json()).then(d => setWireguard(d.interfaces ?? [])).catch(() => {});
  };

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 5000); return () => clearInterval(i); }, []);

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b}B`;
    if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)}K`;
    if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)}M`;
    return `${(b / 1024 ** 3).toFixed(2)}G`;
  };

  const tabs = [
    { id: 'interfaces' as const, label: 'Interfaces', icon: '🔌' },
    { id: 'routes' as const, label: 'Routes', icon: '🗺️' },
    { id: 'firewall' as const, label: 'Firewall', icon: '🛡️' },
    { id: 'dns' as const, label: 'DNS', icon: '🌐' },
    { id: 'vpn' as const, label: 'WireGuard', icon: '🔒' },
  ];

  const stateIcon = (state: string) => state === 'up' ? '🟢' : '🔴';

  return (
    <div className="flex h-full bg-slate-900/40">
      <div className="w-44 bg-black/20 border-r border-white/5 p-4 flex flex-col gap-1">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Network</h2>
        {tabs.map(t => (
          <button key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-all ${activeTab === t.id ? 'bg-blue-600/20 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} onClick={() => setActiveTab(t.id)}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
        <div className="mt-auto pt-4 border-t border-white/5 space-y-1 text-xs text-slate-500">
          <div>Interfaces: {stats.interfaces ?? 0}</div>
          <div>RX: {formatBytes(stats.totalRxBytes ?? 0)}</div>
          <div>TX: {formatBytes(stats.totalTxBytes ?? 0)}</div>
          <div>VPN Peers: {stats.vpnPeers ?? 0}</div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'interfaces' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Network Interfaces</h1>
            {interfaces.map((iface: any) => (
              <div key={iface.name} className="p-4 rounded-2xl border border-white/5 bg-black/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{stateIcon(iface.state)}</span>
                    <span className="text-white font-bold">{iface.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-lg bg-white/5 text-slate-400">{iface.type}</span>
                    {iface.speed && <span className="text-xs text-slate-500">{iface.speed} Mbps</span>}
                  </div>
                  <span className="text-xs text-slate-500">{iface.mac}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(iface.addresses ?? []).map((addr: any, i: number) => (
                    <div key={i} className="text-slate-300">
                      <span className="text-slate-500">{addr.family}:</span> {addr.address}/{addr.netmask}
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
                  <span>RX: {formatBytes(iface.rxBytes)} ({iface.rxPackets} pkts)</span>
                  <span>TX: {formatBytes(iface.txBytes)} ({iface.txPackets} pkts)</span>
                  <span>MTU: {iface.mtu}</span>
                  {iface.rxErrors > 0 && <span className="text-red-400">Errors: {iface.rxErrors}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'routes' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Routing Table</h1>
            <table className="w-full text-xs text-slate-300">
              <thead><tr className="text-slate-500 uppercase tracking-widest border-b border-white/5">
                <th className="text-left p-3">Destination</th><th className="text-left p-3">Gateway</th><th className="text-left p-3">Interface</th><th className="text-right p-3">Metric</th><th className="text-left p-3">Flags</th>
              </tr></thead>
              <tbody>
                {routes.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 font-mono">{r.destination}</td>
                    <td className="p-3 font-mono">{r.gateway}</td>
                    <td className="p-3">{r.interface}</td>
                    <td className="p-3 text-right">{r.metric}</td>
                    <td className="p-3">{(r.flags ?? []).join(' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'firewall' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Firewall Rules (UFW)</h1>
            <table className="w-full text-xs text-slate-300">
              <thead><tr className="text-slate-500 uppercase tracking-widest border-b border-white/5">
                <th className="text-left p-3">Chain</th><th className="text-left p-3">Action</th><th className="text-left p-3">Protocol</th><th className="text-left p-3">Port</th><th className="text-left p-3">Comment</th><th className="text-center p-3">Enabled</th>
              </tr></thead>
              <tbody>
                {firewallRules.map((r: any) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3">{r.chain}</td>
                    <td className={`p-3 font-bold ${r.action === 'ACCEPT' ? 'text-emerald-400' : r.action === 'DROP' ? 'text-red-400' : 'text-yellow-400'}`}>{r.action}</td>
                    <td className="p-3">{r.protocol}</td>
                    <td className="p-3 font-mono">{r.destinationPort ?? '-'}</td>
                    <td className="p-3 text-slate-500">{r.comment}</td>
                    <td className="p-3 text-center">{r.enabled ? '✅' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'dns' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">DNS Configuration</h1>
            <div className="p-4 rounded-2xl border border-white/5 bg-black/20 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nameservers</label>
                <div className="flex gap-2 mt-1">{(dns.nameservers ?? []).map((ns: string, i: number) => (
                  <span key={i} className="px-3 py-1.5 bg-white/5 rounded-lg text-sm text-white font-mono">{ns}</span>
                ))}</div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Search Domains</label>
                <div className="flex gap-2 mt-1">{(dns.search ?? []).map((s: string, i: number) => (
                  <span key={i} className="px-3 py-1.5 bg-white/5 rounded-lg text-sm text-white font-mono">{s}</span>
                ))}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vpn' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">WireGuard VPN</h1>
            {wireguard.map((wg: any) => (
              <div key={wg.name} className="p-4 rounded-2xl border border-white/5 bg-black/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">{wg.name}</span>
                  <span className="text-xs text-slate-500">Port: {wg.listenPort}</span>
                </div>
                <div className="text-xs text-slate-400">Address: {wg.address}</div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Peers ({wg.peers?.length ?? 0})</label>
                  {(wg.peers ?? []).map((peer: any, i: number) => (
                    <div key={i} className="mt-2 p-3 rounded-xl bg-white/5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-white font-mono truncate max-w-[200px]">{peer.publicKey}</span>
                        <span className="text-slate-500">{peer.endpoint ?? 'No endpoint'}</span>
                      </div>
                      <div className="flex gap-3 mt-1 text-slate-500">
                        <span>RX: {formatBytes(peer.transferRx)}</span>
                        <span>TX: {formatBytes(peer.transferTx)}</span>
                        {peer.latestHandshake && <span>Handshake: {Math.round((Date.now() - peer.latestHandshake) / 1000)}s ago</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkManagerApp;
