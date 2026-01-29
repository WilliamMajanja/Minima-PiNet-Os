
import React, { useState, useEffect } from 'react';
import { ClusterNode, M402Session } from '../../types';
import { MinimaService } from '../../services/minimaService';

interface DePAiExecutorProps {
  nodes: ClusterNode[];
}

const DePAiExecutor: React.FC<DePAiExecutorProps> = ({ nodes }) => {
  const [activeSessions, setActiveSessions] = useState<M402Session[]>([]);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>(["DePAI Shell ready.", "Waiting for agent deployment..."]);

  const tasks = [
    { 
        id: 'airllm-infer', 
        name: 'AirLLM Free Llama', 
        description: 'Sharded cluster-wide inference worker.', 
        rate: 0.03,
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
    },
    { 
        id: 'env-analyze', 
        name: 'Env Observer Agent', 
        description: 'Fuses Sense Hat & NPU telemetry.', 
        rate: 0.01,
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
    },
    { 
        id: 'local-llm', 
        name: 'Llama-3-Pi Node', 
        description: 'Localized NPU-accelerated inference.', 
        rate: 0.05,
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.989-2.386l-.548-.547z"/></svg>
    },
    { 
        id: 'data-shard', 
        name: 'SSD Data Sharder', 
        description: 'Cluster-wide NVMe persistence agent.', 
        rate: 0.02,
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
    },
  ];

  const startTask = async (task: typeof tasks[0]) => {
    setActiveTask(task.name);
    setOutput(prev => [...prev, `[INIT] Deploying ${task.name}...`, `[M.402] Establishing Stream: ${task.rate} MIN/sec...`]);
    
    const sessionId = await MinimaService.initiateM402Stream(task.rate);
    const newSession: M402Session = { 
      sessionId, 
      ratePerSecond: task.rate, 
      totalBurned: 0, 
      isActive: true, 
      startTime: Date.now() 
    };
    
    setActiveSessions(prev => [...prev, newSession]);
    setOutput(prev => [...prev, `[LINK] Distributed AirLLM cluster handshake complete.`, `[EXEC] Agentic session live: ${sessionId}`]);
  };

  const terminateSession = async (sessionId: string) => {
    await MinimaService.stopM402Stream(sessionId);
    const sessionToStop = activeSessions.find(s => s.sessionId === sessionId);
    
    setOutput(prev => [
      ...prev, 
      `[EXIT] Stream Terminated. Session: ${sessionId}`, 
      `[COST] Final usage: ${sessionToStop?.totalBurned.toFixed(4)} MIN`
    ]);
    
    setActiveSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    if (activeSessions.length <= 1) setActiveTask(null);
  };

  useEffect(() => {
    if (activeSessions.length > 0) {
      const timer = setInterval(() => {
        setActiveSessions(prev => prev.map(s => ({
            ...s,
            totalBurned: s.totalBurned + s.ratePerSecond
        })));
        
        if (Math.random() > 0.9) {
            setOutput(prev => [...prev.slice(-15), `[AGENT] Distributed inference heartbeat - Sharding verified`]);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [activeSessions.length]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-96 border-r border-white/5 p-8 flex flex-col gap-8 bg-slate-900/40">
        <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">DePAI Agent Marketplace</h3>
            <div className="space-y-4">
              {tasks.map(t => {
                const isRunning = activeSessions.some(s => activeSessions.length > 0 && activeTask === t.name); 
                return (
                  <button
                    key={t.id}
                    onClick={() => startTask(t)}
                    className={`w-full p-5 rounded-[1.5rem] border text-left transition-all group ${
                      isRunning 
                        ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10' 
                        : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'
                    } active:scale-95`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-xl ${isRunning ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                          {t.icon}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                          {t.rate} MIN/s
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">{t.name}</div>
                    <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">{t.description}</div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                        Deploy Agent
                        <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7-7 7"/></svg>
                    </div>
                  </button>
                );
              })}
            </div>
        </div>

        <div className="mt-auto space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
            Active M.402 Sessions
            <span className="bg-white/10 px-2 py-0.5 rounded text-[9px]">{activeSessions.length}</span>
          </h3>
          <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
            {activeSessions.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-[10px] italic border border-dashed border-white/10 rounded-2xl">
                No active billing streams
              </div>
            ) : (
              activeSessions.map(session => (
                <div key={session.sessionId} className="p-4 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 relative group/session">
                   <div className="flex justify-between items-start mb-2">
                     <div className="text-[9px] font-mono text-indigo-400 truncate w-32">{session.sessionId}</div>
                     <button 
                        onClick={() => terminateSession(session.sessionId)}
                        className="opacity-0 group-hover/session:opacity-100 p-1 text-rose-400 hover:text-rose-300 transition-all hover:bg-rose-500/10 rounded"
                     >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                     </button>
                   </div>
                   <div className="flex justify-between items-end">
                      <div className="text-xl font-mono font-bold text-white tracking-tighter">
                         {session.totalBurned.toFixed(4)} 
                         <span className="text-[10px] font-normal text-indigo-400 ml-1 uppercase">MIN</span>
                      </div>
                      <div className="text-[9px] text-emerald-400 font-bold font-mono">
                        {session.ratePerSecond} s⁻¹
                      </div>
                   </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-slate-950/40">
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-black/20">
            <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <div className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">DePAI Execution Log</div>
            </div>
            {activeSessions.length > 0 && (
                <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-emerald-500/10 rounded-lg flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Distributed Inference Active</span>
                    </div>
                </div>
            )}
        </div>
        <div className="flex-1 p-8 font-mono text-[11px] text-slate-300 overflow-auto selection:bg-indigo-500/30">
            {output.map((line, i) => (
                <div key={i} className="mb-2 flex gap-4 hover:bg-white/5 rounded px-2 transition-colors">
                    <span className="text-slate-600 shrink-0">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                    <span className={line.includes('[AGENT]') ? 'text-indigo-400' : line.includes('[M.402]') ? 'text-emerald-400' : line.includes('[EXIT]') ? 'text-rose-400' : 'text-slate-300'}>
                        {line}
                    </span>
                </div>
            ))}
            {activeSessions.length > 0 && <div className="animate-pulse text-indigo-500 inline-block">_</div>}
        </div>
      </div>
    </div>
  );
};

export default DePAiExecutor;
