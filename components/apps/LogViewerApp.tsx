
import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../../utils/api';

interface LogEntry {
  id: string;
  timestamp: number;
  facility: string;
  severity: string;
  hostname: string;
  process: string;
  pid?: number;
  message: string;
}

const LogViewerApp: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<any>({});
  const [processes, setProcesses] = useState<string[]>([]);
  const [filter, setFilter] = useState({ severity: '', facility: '', process: '', search: '' });
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = () => {
    if (paused) return;
    const params = new URLSearchParams();
    params.set('limit', '200');
    if (filter.severity) params.set('severity', filter.severity);
    if (filter.facility) params.set('facility', filter.facility);
    if (filter.process) params.set('process', filter.process);
    if (filter.search) params.set('search', filter.search);

    fetch(getApiUrl(`/api/syslog?${params.toString()}`))
      .then(r => r.json())
      .then(d => setLogs(d.logs ?? []))
      .catch(() => {});
  };

  const fetchMeta = () => {
    fetch(getApiUrl('/api/syslog/stats')).then(r => r.json()).then(d => setStats(d)).catch(() => {});
    fetch(getApiUrl('/api/syslog/processes')).then(r => r.json()).then(d => setProcesses(d.processes ?? [])).catch(() => {});
  };

  useEffect(() => { fetchLogs(); fetchMeta(); const i = setInterval(fetchLogs, 2000); const j = setInterval(fetchMeta, 10000); return () => { clearInterval(i); clearInterval(j); }; }, [filter, paused]);

  useEffect(() => {
    if (autoScroll && logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs, autoScroll]);

  const severityColor = (sev: string) => {
    switch (sev) {
      case 'emerg': case 'alert': case 'crit': return 'text-red-400 bg-red-600/10';
      case 'err': return 'text-red-300';
      case 'warning': return 'text-yellow-400';
      case 'notice': return 'text-blue-300';
      case 'info': return 'text-slate-300';
      case 'debug': return 'text-slate-500';
      default: return 'text-slate-400';
    }
  };

  const facilityIcon = (fac: string) => {
    switch (fac) { case 'kern': return '🔧'; case 'auth': return '🔐'; case 'daemon': return '⚙️'; case 'cron': return '⏰'; case 'syslog': return '📋'; default: return '📌'; }
  };

  const severities = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'];
  const facilities = ['kern', 'user', 'daemon', 'auth', 'syslog', 'cron', 'local0', 'local1'];

  return (
    <div className="flex flex-col h-full bg-slate-900/40">
      {/* Filter Bar */}
      <div className="p-3 border-b border-white/5 flex gap-2 items-center flex-wrap">
        <input className="flex-1 min-w-[150px] bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white placeholder-slate-500" placeholder="Search logs..." value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} />
        <select className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white" value={filter.severity} onChange={e => setFilter({ ...filter, severity: e.target.value })}>
          <option value="">All Severities</option>
          {severities.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </select>
        <select className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white" value={filter.facility} onChange={e => setFilter({ ...filter, facility: e.target.value })}>
          <option value="">All Facilities</option>
          {facilities.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white" value={filter.process} onChange={e => setFilter({ ...filter, process: e.target.value })}>
          <option value="">All Processes</option>
          {processes.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className={`px-3 py-1.5 rounded-xl text-xs font-bold ${paused ? 'bg-yellow-600 text-white' : 'bg-black/40 text-slate-400 border border-white/10'}`} onClick={() => setPaused(!paused)}>
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button className={`px-3 py-1.5 rounded-xl text-xs font-bold ${autoScroll ? 'bg-blue-600 text-white' : 'bg-black/40 text-slate-400 border border-white/10'}`} onClick={() => setAutoScroll(!autoScroll)}>
          ⬇ Auto
        </button>
      </div>

      {/* Stats Bar */}
      <div className="px-3 py-1.5 border-b border-white/5 flex gap-4 text-[10px] text-slate-500">
        <span>Total: {stats.total ?? 0}</span>
        {stats.bySeverity && Object.entries(stats.bySeverity).map(([k, v]) => (
          <span key={k} className={severityColor(k)}>{k}: {v as number}</span>
        ))}
      </div>

      {/* Log Stream */}
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {logs.map(log => (
          <div key={log.id} className={`flex items-start px-3 py-1 hover:bg-white/5 border-b border-white/[0.02] ${severityColor(log.severity)}`}>
            <span className="w-36 flex-shrink-0 text-slate-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span className="w-5 flex-shrink-0" title={log.facility}>{facilityIcon(log.facility)}</span>
            <span className={`w-16 flex-shrink-0 font-bold uppercase text-[10px] ${severityColor(log.severity)}`}>{log.severity}</span>
            <span className="w-32 flex-shrink-0 text-slate-500">{log.process}{log.pid ? `[${log.pid}]` : ''}</span>
            <span className="flex-1 text-slate-300">{log.message}</span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default LogViewerApp;
