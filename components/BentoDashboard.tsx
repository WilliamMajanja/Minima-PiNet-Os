
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { SystemStats, NodeStats } from '../types';

interface BentoDashboardProps {
  systemStats: SystemStats;
  nodeStats: NodeStats;
}

const BentoDashboard: React.FC<BentoDashboardProps> = ({ systemStats, nodeStats }) => {
  const [uptime, setUptime] = useState('—');

  useEffect(() => {
    const updateUptime = () => {
      // Prefer server-provided OS uptime if available
      const sec = systemStats.uptime != null ? systemStats.uptime : Math.floor(performance.now() / 1000);
      const days = Math.floor(sec / 86400);
      const hours = Math.floor((sec % 86400) / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      if (days > 0) {
        setUptime(`${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`);
      } else {
        setUptime(`${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`);
      }
    };
    updateUptime();
    const timer = setInterval(updateUptime, 60000);
    return () => clearInterval(timer);
  }, [systemStats.uptime]);

  if (!systemStats) return null;

  const statusText = nodeStats.status === 'Synced' ? 'ONLINE / SYNCED'
    : nodeStats.status === 'Syncing' ? 'SYNCING...'
    : 'OFFLINE';
  const statusColor = nodeStats.status === 'Synced' ? 'text-blue-400'
    : nodeStats.status === 'Syncing' ? 'text-amber-400'
    : 'text-red-400';

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-4 gap-4 w-full h-full max-w-6xl mx-auto opacity-40 pointer-events-none select-none">
      {/* CPU Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="md:col-span-2 md:row-span-2 glass-dark p-6 rounded-3xl flex flex-col justify-between"
      >
        <div>
          <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">CPU Load</h3>
          <div className="text-4xl font-black text-white">{(systemStats.cpu ?? 0).toFixed(1)}%</div>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-pink-500" 
            animate={{ width: `${systemStats.cpu ?? 0}%` }}
          />
        </div>
      </motion.div>

      {/* RAM Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="md:col-span-1 md:row-span-1 glass-dark p-6 rounded-3xl flex flex-col justify-between"
      >
        <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest">Memory</h3>
        <div className="text-2xl font-bold text-emerald-400">{(systemStats.ram ?? 0).toFixed(1)}%</div>
      </motion.div>

      {/* Temp Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="md:col-span-1 md:row-span-1 glass-dark p-6 rounded-3xl flex flex-col justify-between"
      >
        <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest">Temp</h3>
        <div className="text-2xl font-bold text-amber-400">{(systemStats.temp ?? 0).toFixed(1)}°C</div>
      </motion.div>

      {/* Node Status */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="md:col-span-2 md:row-span-1 glass-dark p-6 rounded-3xl flex items-center justify-between"
      >
        <div>
          <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest">Node Status</h3>
          <div className={`text-xl font-bold ${statusColor}`}>{statusText}</div>
        </div>
        <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
      </motion.div>

      {/* Network Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="md:col-span-2 md:row-span-2 glass-dark p-6 rounded-3xl flex flex-col justify-between"
      >
        <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest">Network Traffic</h3>
        <div className="flex-1 flex items-end gap-1">
          {[...Array(20)].map((_, i) => (
            <motion.div 
              key={i}
              className="flex-1 bg-indigo-500/40 rounded-t-sm"
              animate={{ height: `${20 + Math.random() * 80}%` }}
              transition={{ repeat: Infinity, duration: 1 + Math.random(), repeatType: 'reverse' }}
            />
          ))}
        </div>
      </motion.div>

      {/* Uptime */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="md:col-span-1 md:row-span-1 glass-dark p-6 rounded-3xl flex flex-col justify-between"
      >
        <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest">Uptime</h3>
        <div className="text-xl font-bold text-white">{uptime}</div>
      </motion.div>
    </div>
  );
};

export default BentoDashboard;
