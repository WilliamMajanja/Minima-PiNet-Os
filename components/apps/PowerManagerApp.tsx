
import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../../utils/api';

const PowerManagerApp: React.FC = () => {
  const [powerInfo, setPowerInfo] = useState<any>(null);
  const [watchdog, setWatchdog] = useState<any>(null);
  const [scheduledShutdown, setScheduledShutdown] = useState<any>(null);
  const [governors, setGovernors] = useState<string[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'power' | 'services' | 'scheduler'>('power');

  const fetchAll = () => {
    fetch(getApiUrl('/api/power')).then(r => r.json()).then(d => {
      setPowerInfo(d.info);
      setWatchdog(d.watchdog);
      setScheduledShutdown(d.scheduledShutdown);
      setGovernors(d.governors ?? []);
    }).catch(() => {});
    fetch(getApiUrl('/api/kernel/services')).then(r => r.json()).then(d => setServices(d.services ?? [])).catch(() => {});
  };

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 3000); return () => clearInterval(i); }, []);

  const setGovernor = (gov: string) => {
    fetch(getApiUrl('/api/power/governor'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ governor: gov }) })
      .then(() => fetchAll());
  };

  const requestPower = (state: string) => {
    fetch(getApiUrl('/api/power/state'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) })
      .then(() => fetchAll());
  };

  const serviceAction = (name: string, action: string) => {
    fetch(getApiUrl(`/api/kernel/services/${name}/${action}`), { method: 'POST' })
      .then(() => fetchAll());
  };

  const formatUptime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const tabs = [
    { id: 'power' as const, label: 'Power', icon: '⚡' },
    { id: 'services' as const, label: 'Services', icon: '⚙️' },
    { id: 'scheduler' as const, label: 'Scheduler', icon: '🕐' },
  ];

  const stateColor = (state: string) => {
    switch (state) { case 'active': return 'text-emerald-400'; case 'inactive': return 'text-slate-500'; case 'failed': return 'text-red-400'; case 'activating': return 'text-yellow-400'; default: return 'text-blue-400'; }
  };

  return (
    <div className="flex h-full bg-slate-900/40">
      <div className="w-44 bg-black/20 border-r border-white/5 p-4 flex flex-col gap-1">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Power & Services</h2>
        {tabs.map(t => (
          <button key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-all ${activeTab === t.id ? 'bg-blue-600/20 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} onClick={() => setActiveTab(t.id)}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}

        <div className="mt-auto pt-4 border-t border-white/5 space-y-2">
          <button className="w-full px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-xl text-xs font-bold transition-all" onClick={() => requestPower('poweroff')}>⏻ Shutdown</button>
          <button className="w-full px-3 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 rounded-xl text-xs font-bold transition-all" onClick={() => requestPower('reboot')}>🔄 Reboot</button>
          <button className="w-full px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-xl text-xs font-bold transition-all" onClick={() => requestPower('suspend')}>💤 Suspend</button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'power' && powerInfo && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Power Management</h1>

            <div className="grid grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl border border-white/5 bg-black/20">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">State</div>
                <div className="text-xl font-bold text-emerald-400 mt-1 uppercase">{powerInfo.state}</div>
              </div>
              <div className="p-4 rounded-2xl border border-white/5 bg-black/20">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Uptime</div>
                <div className="text-xl font-bold text-white mt-1">{formatUptime(powerInfo.uptimeMs)}</div>
              </div>
              <div className="p-4 rounded-2xl border border-white/5 bg-black/20">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Power Draw</div>
                <div className="text-xl font-bold text-white mt-1">{powerInfo.power?.toFixed(1)}W</div>
              </div>
              <div className="p-4 rounded-2xl border border-white/5 bg-black/20">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Temperature</div>
                <div className={`text-xl font-bold mt-1 ${powerInfo.temperatureC > 80 ? 'text-red-400' : powerInfo.temperatureC > 60 ? 'text-yellow-400' : 'text-emerald-400'}`}>{powerInfo.temperatureC?.toFixed(1)}°C</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl border border-white/5 bg-black/20 space-y-3">
                <h3 className="text-sm font-bold text-white">Power Details</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Source</span><span className="text-white uppercase">{powerInfo.source}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Voltage</span><span className="text-white">{powerInfo.voltage}V</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Current</span><span className="text-white">{powerInfo.current?.toFixed(2)}A</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">CPU Frequency</span><span className="text-white">{powerInfo.cpuFrequencyMhz} MHz</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Throttled</span><span className={powerInfo.throttled ? 'text-red-400' : 'text-emerald-400'}>{powerInfo.throttled ? 'Yes' : 'No'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Under-voltage</span><span className={powerInfo.underVoltage ? 'text-red-400' : 'text-emerald-400'}>{powerInfo.underVoltage ? 'Yes' : 'No'}</span></div>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-white/5 bg-black/20 space-y-3">
                <h3 className="text-sm font-bold text-white">CPU Governor</h3>
                <div className="grid grid-cols-1 gap-1">
                  {governors.map(gov => (
                    <button
                      key={gov}
                      className={`px-3 py-2 rounded-xl text-xs text-left transition-all ${powerInfo.cpuGovernor === gov ? 'bg-blue-600/20 text-blue-300 border border-blue-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                      onClick={() => setGovernor(gov)}
                    >
                      <span className="font-bold">{gov}</span>
                      <span className="text-[10px] text-slate-500 ml-2">
                        {gov === 'performance' && '(Max frequency)'}
                        {gov === 'powersave' && '(Min frequency)'}
                        {gov === 'ondemand' && '(Dynamic scaling)'}
                        {gov === 'conservative' && '(Gradual scaling)'}
                        {gov === 'schedutil' && '(Scheduler-driven)'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Watchdog */}
            {watchdog && (
              <div className="p-4 rounded-2xl border border-white/5 bg-black/20">
                <h3 className="text-sm font-bold text-white mb-2">Hardware Watchdog</h3>
                <div className="flex gap-4 text-xs">
                  <span className={watchdog.healthy ? 'text-emerald-400' : 'text-red-400'}>● {watchdog.healthy ? 'Healthy' : 'Warning'}</span>
                  <span className="text-slate-400">Enabled: {watchdog.enabled ? 'Yes' : 'No'}</span>
                  <span className="text-slate-400">Timeout: {watchdog.timeoutMs / 1000}s</span>
                  <span className="text-slate-400">Action: {watchdog.action}</span>
                  <span className="text-slate-400">Last kick: {Math.round(watchdog.timeSinceLastKickMs / 1000)}s ago</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'services' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">System Services</h1>
            <div className="space-y-1">
              {services.map((svc: any) => (
                <div key={svc.name} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-black/20 hover:bg-white/5 transition-all">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${svc.state === 'active' ? 'bg-emerald-400' : svc.state === 'failed' ? 'bg-red-400' : 'bg-slate-600'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">{svc.name}</span>
                      <span className={`text-[10px] font-bold ${stateColor(svc.state)}`}>{svc.state}</span>
                      <span className="text-[10px] text-slate-600">{svc.type}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">{svc.description}</div>
                  </div>
                  <div className="flex gap-1">
                    {svc.state !== 'active' && (
                      <button className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded text-[10px] font-bold" onClick={() => serviceAction(svc.name, 'start')}>Start</button>
                    )}
                    {svc.state === 'active' && (
                      <>
                        <button className="px-2 py-1 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-300 rounded text-[10px] font-bold" onClick={() => serviceAction(svc.name, 'restart')}>Restart</button>
                        <button className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded text-[10px] font-bold" onClick={() => serviceAction(svc.name, 'stop')}>Stop</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'scheduler' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Scheduled Tasks</h1>
            <CronJobList />
          </div>
        )}
      </div>
    </div>
  );
};

const CronJobList: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    fetch(getApiUrl('/api/kernel/scheduler/cron')).then(r => r.json()).then(d => setJobs(d.jobs ?? [])).catch(() => {});
    const i = setInterval(() => {
      fetch(getApiUrl('/api/kernel/scheduler/cron')).then(r => r.json()).then(d => setJobs(d.jobs ?? [])).catch(() => {});
    }, 10000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="space-y-2">
      {jobs.map((job: any) => (
        <div key={job.id} className="p-3 rounded-xl border border-white/5 bg-black/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${job.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span className="text-white font-medium text-sm">{job.name}</span>
              <span className="text-xs font-mono text-slate-500">{job.schedule}</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${job.enabled ? 'bg-emerald-600/20 text-emerald-300' : 'bg-slate-600/20 text-slate-400'}`}>
              {job.enabled ? 'ACTIVE' : 'DISABLED'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Command: {job.command} {(job.args ?? []).join(' ')}
            {job.lastRun && <span className="ml-2">| Last run: {new Date(job.lastRun).toLocaleString()}</span>}
            {job.nextRun && <span className="ml-2">| Next: {new Date(job.nextRun).toLocaleString()}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PowerManagerApp;
