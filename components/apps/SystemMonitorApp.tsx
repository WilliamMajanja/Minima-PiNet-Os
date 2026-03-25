
import React, { useEffect, useState } from 'react';
import { SystemStats } from '../../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface SystemMonitorAppProps {
  stats: SystemStats;
}

const SystemMonitorApp: React.FC<SystemMonitorAppProps> = ({ stats }) => {
  const [realStats, setRealStats] = useState<any>(null);
  const [pinet2Status, setPinet2Status] = useState<any>({
    lxcStatus: 'uninitialized',
    resourcePriority: 'host',
    aiAcceleration: 'detecting',
    healthStatus: 'unknown',
    lastHealthCheck: null,
    systemHash: null
  });

  const fetchPinet2Status = () => {
    fetch('/api/pinet2/status')
      .then(res => res.json())
      .then(data => setPinet2Status(data))
      .catch(err => console.error("Failed to load PiNet 2.0 status", err));
  };

  if (!stats) return null;

  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (window.electron) {
      const fetchStats = async () => {
        const metrics = await window.electron!.getHardwareMetrics();
        setRealStats(metrics);
      };
      fetchStats();
      interval = setInterval(fetchStats, 2000);
    }
    fetchPinet2Status();
    const pinet2Interval = setInterval(fetchPinet2Status, 5000);

    return () => {
        clearInterval(interval);
        clearInterval(pinet2Interval);
    };
  }, []);

  const displayCpu = realStats ? realStats.cpuUsage * 100 : (stats.cpu ?? 0);
  const displayRam = realStats ? (1 - realStats.freeMem / realStats.totalMem) * 100 : (stats.ram ?? 0);
  const displayTemp = stats.temp ?? 0;

  useEffect(() => {
    setHistory(prev => {
      const newEntry = {
        time: Date.now(),
        cpu: displayCpu,
        ram: displayRam,
        temp: displayTemp
      };
      const newHistory = [...prev, newEntry];
      if (newHistory.length > 20) {
        return newHistory.slice(newHistory.length - 20);
      }
      return newHistory;
    });
  }, [displayCpu, displayRam, displayTemp]);

  const data = history;

  return (
    <div className="p-8 h-full space-y-8 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Performance</h1>
        <p className="text-slate-400 text-sm">Real-time telemetry for Raspberry Pi Node</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatusCard 
          title="LXC Isolation" 
          value={pinet2Status.lxcStatus} 
          subValue={pinet2Status.resourcePriority === 'container' ? 'Priority: High' : 'Priority: Low'} 
          color="blue" 
          icon={<LxcIcon />}
        />
        <StatusCard 
          title="AI Acceleration" 
          value={pinet2Status.aiAcceleration} 
          subValue={pinet2Status.aiAcceleration === 'hailo' ? 'NPU: Hailo-8L' : 'CPU: GGUF-4bit'} 
          color="pink" 
          icon={<AiIcon />}
        />
        <StatusCard 
          title="Zero Trust" 
          value={pinet2Status.healthStatus} 
          subValue={pinet2Status.healthStatus === 'verified' ? 'State: Attested' : 'State: Unknown'} 
          color="emerald" 
          icon={<SecurityIcon />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass p-6 rounded-2xl border border-white/5 space-y-4">
          <div className="flex justify-between items-end">
             <span className="text-sm font-semibold text-slate-400 uppercase tracking-widest">CPU Load</span>
             <span className="text-2xl font-mono text-blue-400">{Math.round(displayCpu)}%</span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpu)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-6 rounded-2xl border border-white/5 space-y-4">
          <div className="flex justify-between items-end">
             <span className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Memory Usage</span>
             <span className="text-2xl font-mono text-emerald-400">{Math.round(displayRam)}%</span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="ram" stroke="#10b981" fillOpacity={1} fill="url(#colorRam)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-6 rounded-2xl border border-white/5 space-y-4 md:col-span-2">
          <div className="flex justify-between items-end">
             <span className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Thermal Monitoring</span>
             <span className="text-2xl font-mono text-amber-400">{Math.round(stats.temp ?? 0)}°C</span>
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <Line type="stepAfter" dataKey="temp" stroke="#f59e0b" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
             <div className="w-2 h-2 rounded-full bg-amber-500" />
             <span>Active cooling fan engaged (PWM 60%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusCard = ({ title, value, subValue, color, icon }: any) => {
    const colorClasses: any = {
        blue: 'text-blue-400 border-blue-500/20 bg-blue-500/5',
        pink: 'text-pink-400 border-pink-500/20 bg-pink-500/5',
        emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
    };

    return (
        <div className={`glass p-6 rounded-2xl border ${colorClasses[color]} space-y-3`}>
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{title}</span>
                <div className="opacity-40">{icon}</div>
            </div>
            <div>
                <div className="text-xl font-bold uppercase tracking-tight">{value}</div>
                <div className="text-[10px] opacity-60 font-medium">{subValue}</div>
            </div>
        </div>
    );
};

const LxcIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>;
const AiIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>;
const SecurityIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>;

export default SystemMonitorApp;
