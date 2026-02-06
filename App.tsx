
import React, { useState, useEffect } from 'react';
import Desktop from './components/Desktop';
import Taskbar from './components/Taskbar';
import TopBar from './components/TopBar';
import SetupWizard from './components/apps/SetupWizard';
import { AppId, WindowState, NodeStats, SystemStats, ClusterNode } from './types';
import MinimaNodeApp from './components/apps/MinimaNodeApp';
import SystemMonitorApp from './components/apps/SystemMonitorApp';
import TerminalApp from './components/apps/TerminalApp';
import AiAssistantApp from './components/apps/AiAssistantApp';
import WalletApp from './components/apps/WalletApp';
import MaximaMessengerApp from './components/apps/MaximaMessengerApp';
import ClusterManagerApp from './components/apps/ClusterManagerApp';
import DePAiExecutor from './components/apps/DePAiExecutor';
import ImagerUtility from './components/apps/ImagerUtility';
import FileExplorerApp from './components/apps/FileExplorerApp';
import SettingsApp from './components/apps/SettingsApp';

const App: React.FC = () => {
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [windows, setWindows] = useState<WindowState[]>([
    { id: 'minima-node', title: 'Minima Node', isOpen: true, isMinimized: false, zIndex: 10 },
    { id: 'system-monitor', title: 'System Monitor', isOpen: false, isMinimized: false, zIndex: 1 },
    { id: 'terminal', title: 'PiNet Shell', isOpen: false, isMinimized: false, zIndex: 1 },
    { id: 'ai-assistant', title: 'PiNet AI Assistant', isOpen: false, isMinimized: false, zIndex: 1 },
    { id: 'wallet', title: 'Web3 Wallet', isOpen: false, isMinimized: false, zIndex: 1 },
    { id: 'maxima-messenger', title: 'Maxima Messenger', isOpen: false, isMinimized: false, zIndex: 1 },
    { id: 'cluster-manager', title: 'Cluster Hub', isOpen: false, isMinimized: false, zIndex: 1 },
    { id: 'depai-executor', title: 'DePAI Executor', isOpen: false, isMinimized: false, zIndex: 1 },
    { id: 'imager-utility', title: 'Pi Imager Config', isOpen: false, isMinimized: false, zIndex: 1 },
    { id: 'file-explorer', title: 'File Explorer', isOpen: false, isMinimized: false, zIndex: 1 },
    { id: 'settings', title: 'System Settings', isOpen: false, isMinimized: false, zIndex: 1 },
  ]);

  const [activeId, setActiveId] = useState<AppId>('minima-node');
  const [nodeStats, setNodeStats] = useState<NodeStats>({
    blockHeight: 1245091,
    peers: 14,
    status: 'Synced',
    uptime: '14d 05h 22m',
    version: '1.0.35'
  });

  // Initial state reflects the local device (Alpha) which is the primary deployment target
  const [clusterNodes, setClusterNodes] = useState<ClusterNode[]>([
    { 
        id: 'n1', 
        name: 'Pi-Alpha (Local Host)', 
        ip: '127.0.0.1', 
        hat: 'SSD_NVME', 
        status: 'online', 
        metrics: { cpu: 12, ram: 2.1, temp: 45, iops: 12500 } 
    }
  ]);

  const [sysStats, setSysStats] = useState<SystemStats>({
    cpu: 24, ram: 45, temp: 42, disk: 12
  });

  // Handle completion of setup wizard with detected nodes
  const handleSetupComplete = (nodes: ClusterNode[]) => {
      setClusterNodes(nodes);
      setIsSetupComplete(true);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setSysStats(prev => ({
        cpu: Math.max(10, Math.min(95, prev.cpu + (Math.random() * 10 - 5))),
        ram: Math.max(40, Math.min(60, prev.ram + (Math.random() * 2 - 1))),
        temp: Math.max(38, Math.min(65, prev.temp + (Math.random() * 4 - 2))),
        disk: prev.disk
      }));
      
      setClusterNodes(prev => prev.map(node => ({
        ...node,
        metrics: {
          ...node.metrics,
          cpu: Math.random() * 30 + 5,
          temp: Math.random() * 10 + 40,
          npu: node.hat === 'AI_NPU' ? Math.random() * 100 : undefined,
          iops: node.hat === 'SSD_NVME' ? Math.random() * 8000 + 12000 : undefined,
        }
      })));

      setNodeStats(prev => ({ ...prev, blockHeight: prev.blockHeight + 1 }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const openApp = (id: AppId) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        return { ...w, isOpen: true, isMinimized: false, zIndex: Math.max(...prev.map(x => x.zIndex)) + 1 };
      }
      return w;
    }));
    setActiveId(id);
  };

  const closeApp = (id: AppId) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isOpen: false } : w));
  };

  const minimizeApp = (id: AppId) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
  };

  const bringToFront = (id: AppId) => {
    const maxZ = Math.max(...windows.map(w => w.zIndex));
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: maxZ + 1, isMinimized: false } : w));
    setActiveId(id);
  };

  if (!isSetupComplete) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 flex flex-col font-sans select-none">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_50%,rgba(197,26,74,0.1),rgba(0,0,0,0))]" />
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
      
      <TopBar nodeStats={nodeStats} systemStats={sysStats} />

      <main className="flex-1 relative overflow-hidden p-6 mt-10 mb-16">
        <Desktop openApp={openApp} />
        
        {windows.map(win => {
          if (!win.isOpen) return null;
          
          return (
            <div 
              key={win.id}
              style={{ zIndex: win.zIndex, display: win.isMinimized ? 'none' : 'block' }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl h-[75vh]"
            >
              <WindowContainer 
                title={win.title} 
                onClose={() => closeApp(win.id)}
                onMinimize={() => minimizeApp(win.id)}
                onFocus={() => bringToFront(win.id)}
                isActive={activeId === win.id}
              >
                {win.id === 'minima-node' && <MinimaNodeApp stats={nodeStats} />}
                {win.id === 'system-monitor' && <SystemMonitorApp stats={sysStats} />}
                {win.id === 'terminal' && <TerminalApp />}
                {win.id === 'ai-assistant' && (
                  <AiAssistantApp 
                    context={{ 
                      node: nodeStats, 
                      cluster: clusterNodes, 
                      telemetry: sysStats,
                      timestamp: new Date().toISOString()
                    }} 
                  />
                )}
                {win.id === 'wallet' && <WalletApp />}
                {win.id === 'maxima-messenger' && <MaximaMessengerApp />}
                {win.id === 'cluster-manager' && <ClusterManagerApp nodes={clusterNodes} />}
                {win.id === 'depai-executor' && <DePAiExecutor nodes={clusterNodes} />}
                {win.id === 'imager-utility' && <ImagerUtility />}
                {win.id === 'file-explorer' && <FileExplorerApp />}
                {win.id === 'settings' && <SettingsApp />}
              </WindowContainer>
            </div>
          );
        })}
      </main>

      <Taskbar 
        windows={windows} 
        activeId={activeId} 
        onAppClick={(id) => {
          const win = windows.find(w => w.id === id);
          if (win?.isMinimized || !win?.isOpen) {
            openApp(id);
          } else if (activeId === id) {
            minimizeApp(id);
          } else {
            bringToFront(id);
          }
        }} 
      />
    </div>
  );
};

interface WindowContainerProps {
  title: string;
  onClose: () => void;
  onMinimize: () => void;
  onFocus: () => void;
  isActive: boolean;
  children: React.ReactNode;
}

const WindowContainer: React.FC<WindowContainerProps> = ({ title, onClose, onMinimize, onFocus, isActive, children }) => {
  return (
    <div 
      className={`flex flex-col w-full h-full glass-dark rounded-2xl overflow-hidden shadow-2xl transition-all duration-200 border-2 ${isActive ? 'border-blue-500/40 shadow-blue-500/10' : 'border-white/10'}`}
      onClick={onFocus}
    >
      <div className={`h-11 flex items-center justify-between px-5 border-b ${isActive ? 'bg-white/10 border-white/20' : 'bg-transparent border-white/5'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-sm font-semibold text-slate-200 tracking-wide uppercase">{title}</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={(e) => { e.stopPropagation(); onMinimize(); }} className="hover:text-white text-slate-500 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="hover:text-red-500 text-slate-500 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-slate-900/60">
        {children}
      </div>
    </div>
  );
};

export default App;
