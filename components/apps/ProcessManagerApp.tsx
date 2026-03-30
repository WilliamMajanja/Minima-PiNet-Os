
import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../../utils/api';

interface ProcessInfo {
  pid: number;
  ppid: number;
  name: string;
  state: string;
  uid: number;
  cpuPercent: number;
  memoryBytes: number;
  threads: number;
  command: string;
  priority: number;
}

const ProcessManagerApp: React.FC = () => {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [processCount, setProcessCount] = useState<any>({});
  const [sortBy, setSortBy] = useState<'cpu' | 'memory' | 'pid'>('cpu');
  const [filter, setFilter] = useState('');
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [view, setView] = useState<'list' | 'tree'>('list');

  const fetchProcesses = () => {
    fetch(getApiUrl(`/api/kernel/processes/top?sort=${sortBy === 'memory' ? 'memory' : 'cpu'}&limit=50`))
      .then(res => res.json())
      .then(data => { setProcesses(data.processes ?? []); })
      .catch(() => {});
    fetch(getApiUrl('/api/kernel/processes'))
      .then(res => res.json())
      .then(data => { setProcessCount(data.count ?? {}); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchProcesses();
    const interval = setInterval(fetchProcesses, 3000);
    return () => clearInterval(interval);
  }, [sortBy]);

  const sendSignal = (pid: number, signal: string) => {
    fetch(getApiUrl(`/api/kernel/processes/${pid}/signal`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal }),
    }).then(() => fetchProcesses());
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}G`;
  };

  const filtered = processes.filter(p =>
    !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.command.toLowerCase().includes(filter.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === 'cpu') return b.cpuPercent - a.cpuPercent;
    if (sortBy === 'memory') return b.memoryBytes - a.memoryBytes;
    return a.pid - b.pid;
  });

  const stateColor = (state: string) => {
    switch (state) {
      case 'running': return 'text-emerald-400';
      case 'sleeping': return 'text-blue-400';
      case 'stopped': return 'text-yellow-400';
      case 'zombie': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-white uppercase tracking-tight">Process Manager</h1>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-emerald-600/20 text-emerald-300 rounded-lg">Running: {processCount.running ?? 0}</span>
            <span className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded-lg">Sleeping: {processCount.sleeping ?? 0}</span>
            <span className="px-2 py-1 bg-yellow-600/20 text-yellow-300 rounded-lg">Stopped: {processCount.stopped ?? 0}</span>
            <span className="px-2 py-1 bg-red-600/20 text-red-300 rounded-lg">Zombie: {processCount.zombie ?? 0}</span>
            <span className="px-2 py-1 bg-white/10 text-white rounded-lg">Total: {processCount.total ?? 0}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder-slate-500"
            placeholder="Filter processes..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <select className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
            <option value="cpu">Sort: CPU</option>
            <option value="memory">Sort: Memory</option>
            <option value="pid">Sort: PID</option>
          </select>
          <button className={`px-3 py-2 rounded-xl text-xs font-bold uppercase ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-black/40 text-slate-400 border border-white/10'}`} onClick={() => setView('list')}>List</button>
          <button className={`px-3 py-2 rounded-xl text-xs font-bold uppercase ${view === 'tree' ? 'bg-blue-600 text-white' : 'bg-black/40 text-slate-400 border border-white/10'}`} onClick={() => setView('tree')}>Tree</button>
        </div>
      </div>

      {/* Process Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs text-slate-300">
          <thead className="sticky top-0 bg-slate-900/80 backdrop-blur">
            <tr className="text-slate-500 uppercase tracking-widest border-b border-white/5">
              <th className="text-left p-3 w-16">PID</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3 w-20">State</th>
              <th className="text-right p-3 w-16">CPU%</th>
              <th className="text-right p-3 w-20">Memory</th>
              <th className="text-right p-3 w-12">THR</th>
              <th className="text-left p-3">Command</th>
              <th className="text-center p-3 w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(proc => (
              <tr
                key={proc.pid}
                className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${selectedPid === proc.pid ? 'bg-blue-600/10' : ''}`}
                onClick={() => setSelectedPid(proc.pid)}
              >
                <td className="p-3 font-mono text-slate-400">{proc.pid}</td>
                <td className="p-3 font-medium text-white">{proc.name}</td>
                <td className={`p-3 ${stateColor(proc.state)}`}>{proc.state}</td>
                <td className="p-3 text-right font-mono">
                  <span className={proc.cpuPercent > 50 ? 'text-red-400' : proc.cpuPercent > 10 ? 'text-yellow-400' : 'text-slate-300'}>
                    {proc.cpuPercent.toFixed(1)}%
                  </span>
                </td>
                <td className="p-3 text-right font-mono">{formatBytes(proc.memoryBytes)}</td>
                <td className="p-3 text-right font-mono">{proc.threads}</td>
                <td className="p-3 text-slate-500 truncate max-w-[200px]" title={proc.command}>{proc.command}</td>
                <td className="p-3 text-center">
                  <div className="flex gap-1 justify-center">
                    <button
                      className="px-2 py-1 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-300 rounded text-[10px] font-bold"
                      onClick={(e) => { e.stopPropagation(); sendSignal(proc.pid, 'SIGSTOP'); }}
                      title="Stop"
                    >■</button>
                    <button
                      className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded text-[10px] font-bold"
                      onClick={(e) => { e.stopPropagation(); sendSignal(proc.pid, 'SIGKILL'); }}
                      title="Kill"
                    >✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProcessManagerApp;
