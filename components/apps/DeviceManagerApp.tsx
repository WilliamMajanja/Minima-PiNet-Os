
import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../../utils/api';

const DeviceManagerApp: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [tree, setTree] = useState<Record<string, any[]>>({});
  const [stats, setStats] = useState<any>({});
  const [rules, setRules] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'devices' | 'tree' | 'rules' | 'events'>('devices');
  const [selectedDevice, setSelectedDevice] = useState<any>(null);

  const fetchAll = () => {
    fetch(getApiUrl('/api/devices')).then(r => r.json()).then(d => { setDevices(d.devices ?? []); setTree(d.tree ?? {}); setStats(d.stats ?? {}); }).catch(() => {});
    fetch(getApiUrl('/api/devices/rules/list')).then(r => r.json()).then(d => setRules(d.rules ?? [])).catch(() => {});
    fetch(getApiUrl('/api/devices/events/recent')).then(r => r.json()).then(d => setEvents(d.events ?? [])).catch(() => {});
  };

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 5000); return () => clearInterval(i); }, []);

  const classIcon = (cls: string) => {
    const icons: Record<string, string> = {
      block: '💾', net: '🌐', usb: '🔌', pci: '🔲', gpio: '📌', i2c: '🔗', spi: '⚡', input: '⌨️',
      thermal: '🌡️', video: '🎮', sound: '🔊', serial: '📡', sensor: '📊', power: '🔋', char: '📄',
    };
    return icons[cls] || '❓';
  };

  const stateColor = (state: string) => {
    switch (state) { case 'attached': return 'text-emerald-400'; case 'detached': return 'text-slate-500'; case 'error': return 'text-red-400'; case 'suspended': return 'text-yellow-400'; default: return 'text-blue-400'; }
  };

  const tabs = [
    { id: 'devices' as const, label: 'All Devices', icon: '🔌' },
    { id: 'tree' as const, label: 'Device Tree', icon: '🌳' },
    { id: 'rules' as const, label: 'Udev Rules', icon: '📋' },
    { id: 'events' as const, label: 'Events', icon: '📊' },
  ];

  return (
    <div className="flex h-full bg-slate-900/40">
      <div className="w-44 bg-black/20 border-r border-white/5 p-4 flex flex-col gap-1">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Devices</h2>
        {tabs.map(t => (
          <button key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-all ${activeTab === t.id ? 'bg-blue-600/20 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} onClick={() => setActiveTab(t.id)}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
        <div className="mt-auto pt-4 border-t border-white/5 text-xs text-slate-500 space-y-1">
          <div>Total: {stats.total ?? 0}</div>
          {stats.byClass && Object.entries(stats.byClass).slice(0, 5).map(([k, v]) => (
            <div key={k}>{classIcon(k)} {k}: {v as number}</div>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'devices' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Hardware Devices</h1>
            <div className="space-y-2">
              {devices.map((dev: any) => (
                <div
                  key={dev.id}
                  className={`p-3 rounded-xl border border-white/5 bg-black/20 cursor-pointer hover:bg-white/5 transition-all ${selectedDevice?.id === dev.id ? 'border-blue-500/30' : ''}`}
                  onClick={() => setSelectedDevice(selectedDevice?.id === dev.id ? null : dev)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{classIcon(dev.deviceClass)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{dev.name}</span>
                        <span className={`text-[10px] font-bold ${stateColor(dev.state)}`}>{dev.state}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {dev.driver} | {dev.subsystem} | {dev.path}
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-slate-600">
                      {dev.vendor && <div>{dev.vendor}</div>}
                      {dev.devNode && <div className="font-mono">{dev.devNode}</div>}
                    </div>
                  </div>

                  {selectedDevice?.id === dev.id && (
                    <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
                      {dev.vendor && <div><span className="text-slate-500">Vendor:</span> <span className="text-white">{dev.vendor}</span></div>}
                      {dev.product && <div><span className="text-slate-500">Product:</span> <span className="text-white">{dev.product}</span></div>}
                      {dev.major !== undefined && <div><span className="text-slate-500">Major:Minor:</span> <span className="text-white font-mono">{dev.major}:{dev.minor}</span></div>}
                      {Object.entries(dev.properties ?? {}).map(([k, v]) => (
                        <div key={k}><span className="text-slate-500">{k}:</span> <span className="text-white">{v as string}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tree' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Device Tree</h1>
            {Object.entries(tree).map(([cls, devs]) => (
              <div key={cls} className="p-4 rounded-2xl border border-white/5 bg-black/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{classIcon(cls)}</span>
                  <span className="text-white font-bold text-sm uppercase">{cls}</span>
                  <span className="text-xs text-slate-500">({(devs as any[]).length})</span>
                </div>
                <div className="space-y-1 pl-6 border-l border-white/10">
                  {(devs as any[]).map((d: any) => (
                    <div key={d.id} className="flex items-center gap-2 text-xs py-1">
                      <span className={stateColor(d.state)}>●</span>
                      <span className="text-white">{d.name}</span>
                      <span className="text-slate-600">{d.driver}</span>
                      {d.devNode && <span className="text-slate-500 font-mono">{d.devNode}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Udev Rules</h1>
            {rules.map((r: any) => (
              <div key={r.id} className="p-3 rounded-xl border border-white/5 bg-black/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">{r.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.enabled ? 'bg-emerald-600/20 text-emerald-300' : 'bg-slate-600/20 text-slate-400'}`}>{r.enabled ? 'ON' : 'OFF'}</span>
                    <span className="text-[10px] text-slate-500">Priority: {r.priority}</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Match: {Object.entries(r.match || {}).map(([k, v]) => `${k}=${v}`).join(', ')} |
                  Action: {Object.entries(r.action || {}).map(([k, v]) => `${k}=${v}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Device Events</h1>
            {events.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No recent device events</div>
            ) : (
              <div className="space-y-1">
                {events.map((e: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-xs">
                    <span className="text-slate-600 font-mono w-36">{new Date(e.timestamp).toLocaleString()}</span>
                    <span className={`w-16 font-bold ${e.type === 'add' ? 'text-emerald-400' : e.type === 'remove' ? 'text-red-400' : 'text-blue-400'}`}>{e.type}</span>
                    <span className="text-white">{e.device?.name}</span>
                    <span className="text-slate-500">{e.device?.driver}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceManagerApp;
