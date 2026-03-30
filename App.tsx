
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Desktop from './components/Desktop';
import Taskbar from './components/Taskbar';
import TopBar from './components/TopBar';
import BootSplashScreen from './components/apps/BootSplashScreen';
import { AppId, WindowState, NodeStats, SystemStats, ClusterNode, HypervisorSwitchResult, OSMode, isDAppId, extractDAppId } from './types';
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
import VisualAssetStudio from './components/apps/VisualAssetStudio';
import DAppStoreApp from './components/apps/DAppStoreApp';
import DAppHostFrame from './components/apps/DAppHostFrame';
import ProcessManagerApp from './components/apps/ProcessManagerApp';
import UserManagerApp from './components/apps/UserManagerApp';
import NetworkManagerApp from './components/apps/NetworkManagerApp';
import SecurityCenterApp from './components/apps/SecurityCenterApp';
import LogViewerApp from './components/apps/LogViewerApp';
import DeviceManagerApp from './components/apps/DeviceManagerApp';
import PowerManagerApp from './components/apps/PowerManagerApp';
import { minimaService } from './services/minimaService';
import { clusterService } from './services/clusterService';
import { settingsService } from './services/settingsService';
import { systemService } from './services/systemService';
import { dappService } from './services/dappService';
import { ExceptionFilter } from './utils/core';
import { getApiUrl } from './utils/api';

type TransitionState = 'idle' | 'shutting-down' | 'booting';

/* ─── Default window dimensions & cascade offset ─────────────────────────── */
const DEFAULT_WIN_W = 900;
const DEFAULT_WIN_H = 560;
const CASCADE_X = 30;
const CASCADE_Y = 30;
const MIN_WIN_W = 420;
const MIN_WIN_H = 260;
const TOPBAR_H = 40;   // px reserved for TopBar
const TASKBAR_H = 80;  // px reserved for Taskbar

/** Return a cascaded position for the Nth window. */
const cascadePos = (index: number) => {
  const maxX = Math.max(0, window.innerWidth - DEFAULT_WIN_W - 40);
  const maxY = Math.max(0, window.innerHeight - DEFAULT_WIN_H - TOPBAR_H - TASKBAR_H);
  return {
    x: Math.min(80 + index * CASCADE_X, maxX),
    y: Math.min(TOPBAR_H + 20 + index * CASCADE_Y, maxY + TOPBAR_H),
  };
};

/* ─── WindowContainer ─────────────────────────────────────────────────────── */
interface WindowContainerProps {
  title: string;
  children: React.ReactNode;
  win: WindowState;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  isActive: boolean;
}

const WindowContainer: React.FC<WindowContainerProps> = ({
  title, children, win, onClose, onMinimize, onMaximize, onFocus, onMove, onResize, isActive,
}) => {
  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  /* ── Drag (title bar) ─────────────────────────────────────── */
  const onDragStart = (e: React.MouseEvent) => {
    if (win.isMaximized) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, winX: win.x, winY: win.y };
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      onMove(dragRef.current.winX + dx, Math.max(TOPBAR_H, dragRef.current.winY + dy));
    };
    const onMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  /* ── Resize (bottom-right handle) ─────────────────────────── */
  const onResizeStart = (e: React.MouseEvent) => {
    if (win.isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: win.width, startH: win.height };
    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dw = ev.clientX - resizeRef.current.startX;
      const dh = ev.clientY - resizeRef.current.startY;
      onResize(
        Math.max(MIN_WIN_W, resizeRef.current.startW + dw),
        Math.max(MIN_WIN_H, resizeRef.current.startH + dh),
      );
    };
    const onMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      onMouseDown={onFocus}
      style={
        win.isMaximized
          ? { position: 'absolute', top: TOPBAR_H, left: 0, right: 0, bottom: TASKBAR_H, zIndex: win.zIndex }
          : { position: 'absolute', left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.zIndex }
      }
      className={`flex flex-col rounded-2xl overflow-hidden shadow-2xl border transition-shadow duration-200 ${
        isActive ? 'border-white/20 shadow-pink-500/10' : 'border-white/5 shadow-none'
      }`}
    >
      {/* Title bar — draggable */}
      <div
        onMouseDown={onDragStart}
        onDoubleClick={onMaximize}
        className={`h-10 shrink-0 ${isActive ? 'bg-slate-800' : 'bg-slate-900'} border-b border-white/5 flex items-center justify-between px-4 select-none cursor-move`}
      >
        <div className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 pointer-events-none">
          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />}
          {title}
        </div>
        <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); onMinimize(); }}
            className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M18 12H6" /></svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMaximize(); }}
            className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            {win.isMaximized
              ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M9 2h10a2 2 0 012 2v10" /></svg>
              : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
            }
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="w-6 h-6 rounded-lg hover:bg-red-500/20 flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 bg-slate-900/90 backdrop-blur-md relative overflow-hidden">
        {children}
      </div>
      {/* Resize handle (bottom-right corner) */}
      {!win.isMaximized && (
        <div
          onMouseDown={onResizeStart}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10"
          style={{ touchAction: 'none' }}
        >
          <svg className="w-4 h-4 text-white/20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14 14H10L14 10V14ZM14 8V6L6 14H8L14 8Z" />
          </svg>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [currentOS, setCurrentOS] = useState<OSMode>('pinet');
  const [osInfo, setOsInfo] = useState<any>(null);
  const [transitionState, setTransitionState] = useState<TransitionState>('idle');
  const [bootLog, setBootLog] = useState<string[]>([]);
  
  // Raspbian State
  const [raspMenuOpen, setRaspMenuOpen] = useState(false);
  const [termPos, setTermPos] = useState({ x: 320, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Raspbian Terminal Interactive State
  const [raspTermOpen, setRaspTermOpen] = useState(false);
  const raspTermEndRef = useRef<HTMLDivElement>(null);
  const raspTermInputRef = useRef<HTMLInputElement>(null);

  const mkWin = (id: AppId, title: string, index: number): WindowState => {
    const pos = cascadePos(index);
    return { id, title, isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1, x: pos.x, y: pos.y, width: DEFAULT_WIN_W, height: DEFAULT_WIN_H };
  };

  const [windows, setWindows] = useState<WindowState[]>([
    mkWin('minima-node', 'Minima Node', 0),
    mkWin('system-monitor', 'System Monitor', 1),
    mkWin('terminal', 'PiNet Shell', 2),
    mkWin('ai-assistant', 'PiNet AI Assistant', 3),
    mkWin('wallet', 'Web3 Wallet', 4),
    mkWin('maxima-messenger', 'Maxima Messenger', 5),
    mkWin('cluster-manager', 'Cluster Hub', 6),
    mkWin('depai-executor', 'DePAI Executor', 7),
    mkWin('imager-utility', 'Pi Imager Config', 8),
    mkWin('file-explorer', 'File Explorer', 9),
    mkWin('settings', 'System Settings', 10),
    mkWin('visual-studio', 'Visual Asset Studio', 11),
    mkWin('dapp-store', 'DApp Store', 12),
    mkWin('process-manager', 'Process Manager', 13),
    mkWin('user-manager', 'User Manager', 14),
    mkWin('network-manager', 'Network Manager', 15),
    mkWin('security-center', 'Security Center', 16),
    mkWin('log-viewer', 'System Logs', 17),
    mkWin('device-manager', 'Device Manager', 18),
    mkWin('power-manager', 'Power Manager', 19),
  ]);

  const [activeId, setActiveId] = useState<AppId>('minima-node');
  const [nodeStats, setNodeStats] = useState<NodeStats>(minimaService.stats);
  const [clusterNodes, setClusterNodes] = useState<ClusterNode[]>(clusterService.nodes);
  const [wallpaper, setWallpaper] = useState(settingsService.wallpaper);

  const [sysStats, setSysStats] = useState<SystemStats>({
    cpu: 24, ram: 45, temp: 42, disk: 12
  });

  // Fetch OS Info on mount
  useEffect(() => {
    fetch(getApiUrl('/api/os-info'))
      .then(res => res.json())
      .then(data => {
        setOsInfo(data);
        if (data.defaultContext) {
          setCurrentOS(data.defaultContext as OSMode);
        }
      })
      .catch(err => ExceptionFilter.handle(err, 'App.fetchOsInfo'));
  }, []);

  // Subscriptions to services
  useEffect(() => {
    const unsubMinima = minimaService.subscribe(() => {
        setNodeStats({...minimaService.stats});
    });
    const unsubCluster = clusterService.subscribe(() => {
        setClusterNodes([...clusterService.nodes]);
    });
    const unsubSettings = settingsService.subscribe(() => {
        setWallpaper(settingsService.wallpaper);
    });

    // Start DApp service polling
    dappService.start();

    return () => {
        unsubMinima();
        unsubCluster();
        unsubSettings();
        dappService.stop();
    };
  }, []);
  
  // Auto-scroll Raspbian Terminal
  useEffect(() => {
    if (raspTermOpen) {
        raspTermEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [raspTermOpen]);

  // Handle completion of boot sequence with detected nodes and compatible apps
  const handleSetupComplete = (nodes: ClusterNode[], autoOpenApps: AppId[]) => {
      setIsSetupComplete(true);
      
      // Auto-open apps based on hardware compatibility
      setTimeout(() => {
        autoOpenApps.forEach(appId => {
          openApp(appId);
        });
      }, 500);
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(getApiUrl('/api/system-stats'));
        if (res.ok) {
          const data = await res.json() as SystemStats;
          setSysStats(data);
        } else {
          throw new Error(`System stats fetch failed with status: ${res.status}`);
        }
      } catch (err) {
        ExceptionFilter.handle(err, 'App.fetchSystemStats');
      }
    };

    // Initial delay to allow server to start
    const initialTimeout = setTimeout(fetchStats, 2000);
    const interval = setInterval(fetchStats, 5000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const openApp = (id: AppId) => {
    setWindows(prev => {
      const maxZ = Math.max(...prev.map(x => x.zIndex), 0);
      const exists = prev.find(w => w.id === id);
      if (exists) {
        // Window already registered — open / un-minimise it
        return prev.map(w => {
          if (w.id === id) {
            return { ...w, isOpen: true, isMinimized: false, zIndex: maxZ + 1 };
          }
          return w;
        });
      }
      // Dynamic DApp window — create a new WindowState on the fly
      if (isDAppId(id)) {
        const dappId = extractDAppId(id);
        const dapp = dappService.getDapp(dappId);
        const title = dapp?.manifest.name || dappId;
        const pos = cascadePos(prev.length);
        return [
          ...prev,
          { id, title, isOpen: true, isMinimized: false, isMaximized: false, zIndex: maxZ + 1, x: pos.x, y: pos.y, width: DEFAULT_WIN_W, height: DEFAULT_WIN_H },
        ];
      }
      return prev;
    });
    setActiveId(id);
  };

  const closeApp = (id: AppId) => {
    if (isDAppId(id)) {
      // Remove dynamic DApp windows entirely when closed
      setWindows(prev => prev.filter(w => w.id !== id));
    } else {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, isOpen: false } : w));
    }
  };

  const minimizeApp = (id: AppId) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
  };

  const maximizeApp = (id: AppId) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w));
  };

  const moveWindow = useCallback((id: AppId, x: number, y: number) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, x, y } : w));
  }, []);

  const resizeWindow = useCallback((id: AppId, width: number, height: number) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, width, height } : w));
  }, []);

  const bringToFront = (id: AppId) => {
    const maxZ = Math.max(...windows.map(w => w.zIndex), 0);
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: maxZ + 1, isMinimized: false } : w));
    setActiveId(id);
  };

  const getWallpaperUrl = () => {
      switch(wallpaper) {
          case 'neon': return "url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670')";
          case 'space': return "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672')";
          case 'mesh': return "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564')";
          default: return "url('https://www.transparenttextures.com/patterns/carbon-fibre.png')";
      }
  };

  const switchOS = async (target: OSMode) => {
    if (currentOS === target) return;
    const targetLabel = target === 'pinet' ? 'PiNet' : target;

    // 1. Initiate Shutdown Sequence
    setTransitionState('shutting-down');
    setBootLog([
      `ORCH: Preparing ${targetLabel} context switch`,
    ]);
    await new Promise(r => setTimeout(r, 1000));

    // 2. Execute real orchestration
    setTransitionState('booting');
    setBootLog([
      `ORCH: Requesting ${targetLabel} switch strategy`,
      target === 'pinet'
        ? 'BOOT: Staging PiNet boot profile or runtime desktop context'
        : `BOOT: Restoring ${targetLabel} host profile or graphical target`,
    ]);

    let switched = false;
    try {
      const result = await systemService.executeHypervisorSwitch(target);
      const profileLabel = result.profileLabel || (target === 'pinet' ? 'pinet' : 'host');
      const bootMount = result.bootMount || '/boot';
      setBootLog(prev => [
        ...prev,
        result.transport === 'rpi-connect'
          ? `RPIC: Remote shell executed on ${result.nodeId}`
          : result.transport === 'local-boot-profile'
            ? `BOOT: Profile ${profileLabel} staged on ${bootMount}`
            : 'LOCAL: systemd command executed on localhost',
        result.strategy === 'boot-profile'
          ? `BOOT: ${result.action} ${result.unit} complete`
          : `SYSTEMD: ${result.action} ${result.unit} completed`,
        result.requiresReboot
          ? `SYSTEM: Reboot scheduled into ${targetLabel}`
          : `ORCH: ${targetLabel} context is now active`,
      ]);

      setCurrentOS(target);
      setRaspMenuOpen(false);
      setRaspTermOpen(target !== 'pinet');
      switched = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hypervisor switch failed';
      setBootLog(prev => [...prev, `ERROR: ${message}`]);
      ExceptionFilter.handle(error, 'App.switchOS');
    }

    await new Promise(r => setTimeout(r, switched ? 600 : 1600));
    setTransitionState('idle');
    setBootLog([]);
  };

  const toggleOS = () => {
    const target = currentOS === 'pinet' ? (osInfo?.osName || 'raspbian') as OSMode : 'pinet';
    switchOS(target);
  };

  // Raspbian Drag Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
        x: e.clientX - termPos.x,
        y: e.clientY - termPos.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
        setTermPos({
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y
        });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  if (!isSetupComplete) {
    return <BootSplashScreen onComplete={handleSetupComplete} />;
  }

  // Hypervisor Switching State
  if (transitionState !== 'idle') {
      return (
          <div className="w-screen h-screen bg-black flex flex-col items-center justify-center font-mono text-white p-10 relative overflow-hidden">
             {/* CRT shutdown effect simulation */}
             {transitionState === 'shutting-down' && (
               <div className="absolute inset-0 bg-black z-50 animate-out fade-out duration-1000 flex items-center justify-center">
                   <div className="w-full h-0.5 bg-white shadow-[0_0_20px_10px_rgba(255,255,255,0.8)] animate-[ping_0.5s_ease-out_reverse]" />
               </div>
             )}
             
             {transitionState === 'booting' && (
                <div className="w-full max-w-2xl space-y-2 z-40">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-8 h-8 bg-white/10 animate-spin" />
                        <h2 className="text-xl font-bold tracking-widest text-pink-500">
                          {osInfo?.hardwareModel?.toUpperCase() || 'RPI5'} HYPERVISOR // BOOTLOADER v2.4
                        </h2>
                    </div>
                    {bootLog.map((log, i) => (
                    <div key={i} className="text-sm text-slate-400 border-l-2 border-slate-700 pl-3">
                        <span className="text-slate-600 mr-4">[{ (0.45 + (i * 0.3)).toFixed(6) }]</span>
                        {log}
                    </div>
                    ))}
                    <div className="animate-pulse text-pink-500 mt-4">_</div>
                </div>
             )}
          </div>
      );
  }

  // Host OS Desktop Render
  if (currentOS !== 'pinet') {
    const isUbuntu = currentOS === 'ubuntu';
    const isDebian = currentOS === 'debian';
    const hostName = isUbuntu ? 'Ubuntu' : isDebian ? 'Debian' : 'Raspbian';
    const hostUser = isUbuntu ? 'user@ubuntu' : isDebian ? 'user@debian' : 'pi@raspberrypi';
    
    return (
        <div className="w-screen h-screen bg-[#f8f9fa] flex flex-col font-sans">
            {/* Raspberry Pi Connect Header */}
            <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-50 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#C51A4A] flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-gray-900">Raspberry Pi Connect</h1>
                        <div className="text-xs text-gray-500 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            Connected to {osInfo?.hostname || 'pinet-alpha'} • Screen Sharing
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-3 py-1 bg-gray-100 rounded-md text-xs font-mono text-gray-500 border border-gray-200">
                        {sysStats.cpu.toFixed(1)}% CPU • {sysStats.temp.toFixed(1)}°C
                    </div>
                    <div className="w-px h-6 bg-gray-200"></div>
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors" title="Fullscreen">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    </button>
                    <button onClick={toggleOS} className="px-4 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors border border-gray-300 shadow-sm flex items-center gap-2">
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Disconnect
                    </button>
                </div>
            </div>

            {/* Remote Desktop Area */}
            <div className="flex-1 relative overflow-hidden bg-[#1e1e1e] flex items-center justify-center p-4 sm:p-8">
                <div className="w-full h-full max-w-[1280px] max-h-[720px] relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                    <div 
                        className="w-full h-full bg-slate-300 relative overflow-hidden font-sans selection:bg-red-200 cursor-default animate-in fade-in duration-1000"
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                    >
                         {/* Wallpaper */}
                        <div className={`absolute inset-0 bg-center bg-no-repeat bg-white opacity-10 pointer-events-none ${isUbuntu ? 'bg-[url("https://assets.ubuntu.com/v1/29985a98-ubuntu-logo32.png")]' : isDebian ? 'bg-[url("https://www.debian.org/logos/openlogo-nd-100.png")]' : 'bg-[url("https://www.raspberrypi.com/app/uploads/2018/03/RPi-Logo-Reg-SCREEN.png")]'}`} />
                        <div className={`absolute inset-0 bg-cover opacity-90 ${isUbuntu ? 'bg-[url("https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=2400")]' : isDebian ? 'bg-[url("https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?q=80&w=2400")]' : 'bg-[url("https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=2400")]'}`} />

                        {/* Top Panel */}
                        <div className="absolute top-0 w-full h-8 bg-slate-200 shadow-md flex items-center justify-between px-2 z-50">
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => setRaspMenuOpen(!raspMenuOpen)}
                                    className={`flex items-center gap-2 px-2 py-1 hover:bg-slate-300 rounded transition-colors ${raspMenuOpen ? 'bg-slate-300 shadow-inner' : ''}`}
                                >
                                    {isUbuntu ? (
                                      <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white text-[10px] font-bold">U</div>
                                    ) : isDebian ? (
                                      <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-white text-[10px] font-bold">D</div>
                                    ) : (
                                      <img src="https://assets.raspberrypi.com/static/raspberry-pi-logo-f6334c9c27b0b8d5a1900115d7f1c9c8.svg" className="w-5 h-5" alt="Pi" />
                                    )}
                                    <span className="text-sm font-bold text-slate-700">Menu</span>
                                </button>
                                <div className="w-px h-4 bg-slate-400" />
                                <button className="p-1 hover:bg-slate-300 rounded" title="Web Browser">
                                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
                                </button>
                                <button className="p-1 hover:bg-slate-300 rounded" title="File Manager">
                                    <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
                                </button>
                                <button 
                                    onClick={() => setRaspTermOpen(!raspTermOpen)}
                                    className={`p-1 hover:bg-slate-300 rounded ${raspTermOpen ? 'bg-slate-300' : ''}`} 
                                    title="Terminal"
                                >
                                    <svg className="w-4 h-4 text-slate-800" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 18V6h16v12H4z"/><path d="M6 10l4 4-4 4v-8zm6 6h6v2h-6v-2z"/></svg>
                                </button>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-slate-700">{new Date().toLocaleTimeString()}</span>
                            </div>
                        </div>

                        {/* Start Menu Overlay */}
                        {raspMenuOpen && (
                            <div className="absolute top-9 left-2 w-56 bg-slate-100 rounded-lg shadow-xl border border-slate-300 z-50 flex flex-col py-1 text-sm text-slate-700">
                                <div className="px-3 py-2 hover:bg-blue-500 hover:text-white cursor-pointer flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                                    <span>Programming</span>
                                </div>
                                <div className="px-3 py-2 hover:bg-blue-500 hover:text-white cursor-pointer flex items-center gap-2">
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
                                    <span>Internet</span>
                                </div>
                                <div className="px-3 py-2 hover:bg-blue-500 hover:text-white cursor-pointer flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                                    <span>Sound & Video</span>
                                </div>
                                <div className="px-3 py-2 hover:bg-blue-500 hover:text-white cursor-pointer flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                                    <span>Accessories</span>
                                </div>
                                <div className="h-px bg-slate-300 my-1" />
                                <div className="px-3 py-2 hover:bg-blue-500 hover:text-white cursor-pointer flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                                    <span>Shutdown</span>
                                </div>
                            </div>
                        )}

                        {/* Desktop Icons */}
                        <div className="p-6 mt-8 grid gap-6 w-fit absolute top-0 left-0">
                            <div 
                                onDoubleClick={() => setRaspTermOpen(true)}
                                className="flex flex-col items-center gap-1 group cursor-pointer hover:bg-white/10 p-2 rounded"
                            >
                                <div className="w-12 h-12 bg-slate-800 rounded p-2 shadow border border-slate-600 group-hover:bg-slate-700 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 17l6-6-6-6M12 19h8" /></svg>
                                </div>
                                <span className="text-xs text-white font-bold drop-shadow-md bg-slate-900/50 px-1 rounded">Terminal</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 group cursor-pointer hover:bg-white/10 p-2 rounded">
                                <div className="w-12 h-12 bg-slate-200 rounded p-2 shadow border border-slate-300 group-hover:bg-slate-100">
                                    <svg className="w-full h-full text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                                </div>
                                <span className="text-xs text-white font-bold drop-shadow-md bg-slate-900/50 px-1 rounded">Trash</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 group cursor-pointer hover:bg-white/10 p-2 rounded">
                                <div className="w-12 h-12 bg-slate-200 rounded p-2 shadow border border-slate-300 group-hover:bg-slate-100">
                                    <svg className="w-full h-full text-amber-600" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                                </div>
                                <span className="text-xs text-white font-bold drop-shadow-md bg-slate-900/50 px-1 rounded">Documents</span>
                            </div>
                        </div>

                        {/* Interactive Terminal Window */}
                        {raspTermOpen && (
                            <div 
                                style={{ left: termPos.x, top: termPos.y }}
                                className="absolute w-[600px] h-[400px] bg-black rounded-t-lg shadow-2xl border border-slate-600 font-mono text-sm flex flex-col"
                            >
                                <div 
                                    onMouseDown={handleMouseDown}
                                    className="bg-slate-300 px-2 py-1 flex justify-between items-center rounded-t-lg cursor-move select-none active:bg-slate-400 transition-colors"
                                >
                                    <span className="text-xs font-bold text-slate-700">{hostUser}: ~</span>
                                    <div className="flex gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
                                        <button 
                                            onClick={() => setRaspTermOpen(false)}
                                            className="w-3 h-3 rounded-full bg-slate-400 hover:bg-slate-500" 
                                        />
                                        <button className="w-3 h-3 rounded-full bg-slate-400 hover:bg-slate-500" />
                                        <button 
                                            onClick={() => setRaspTermOpen(false)}
                                            className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500" 
                                        />
                                    </div>
                                </div>
                                <div className="p-0 flex-1 overflow-hidden">
                                    <TerminalApp osMode={currentOS} onOpenApp={(appId) => openApp(appId as AppId)} onGuiSwitch={() => switchOS((osInfo?.osName || 'raspbian') as OSMode)} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
  }

  // PiNet Desktop
  return (
    <>
      <AnimatePresence>
        {transitionState !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 font-mono"
          >
            <div className="max-w-2xl w-full">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
                <div>
                  <h2 className="text-pink-500 text-xl font-bold tracking-tighter uppercase">
                    {transitionState === 'shutting-down' ? 'System Suspend' : 'Hypervisor Boot'}
                  </h2>
                  <p className="text-slate-500 text-xs">PI-NET HYPERVISOR v4.2.0-LTS</p>
                </div>
              </div>
              
              <div className="space-y-1">
                {bootLog.map((log, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-emerald-500/80 text-xs"
                  >
                    <span className="text-slate-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                    {log}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-screen h-screen overflow-hidden bg-slate-950 flex flex-col font-sans select-none transition-all duration-700 animate-in fade-in zoom-in-95 duration-700"
         style={{ 
             backgroundImage: wallpaper !== 'carbon' ? getWallpaperUrl() : 'none',
             backgroundSize: 'cover',
             backgroundPosition: 'center'
         }}>
      {wallpaper === 'carbon' && (
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
      )}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_50%,rgba(197,26,74,0.1),rgba(0,0,0,0))]" />
      
      <TopBar nodeStats={nodeStats} systemStats={sysStats} onSwitchOS={toggleOS} currentOS={currentOS} />

      <main className="flex-1 relative overflow-hidden mt-10 mb-16">
        <div className="absolute inset-0 p-6">
          <Desktop openApp={openApp} systemStats={sysStats} nodeStats={nodeStats} osMode={currentOS} />
        </div>
        
        {windows.map(win => {
          if (!win.isOpen || win.isMinimized) return null;
          
          return (
            <WindowContainer 
              key={win.id}
              win={win}
              title={win.title} 
              onClose={() => closeApp(win.id)}
              onMinimize={() => minimizeApp(win.id)}
              onMaximize={() => maximizeApp(win.id)}
              onFocus={() => bringToFront(win.id)}
              onMove={(x, y) => moveWindow(win.id, x, y)}
              onResize={(w, h) => resizeWindow(win.id, w, h)}
              isActive={activeId === win.id}
            >
              {win.id === 'minima-node' && <MinimaNodeApp stats={nodeStats} />}
              {win.id === 'system-monitor' && <SystemMonitorApp stats={sysStats} />}
              {win.id === 'terminal' && <TerminalApp osMode={currentOS} onOpenApp={(appId) => openApp(appId as AppId)} onGuiSwitch={() => switchOS((osInfo?.osName || 'raspbian') as OSMode)} />}
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
              {win.id === 'visual-studio' && <VisualAssetStudio />}
              {win.id === 'dapp-store' && <DAppStoreApp onOpenDApp={(id) => openApp(id)} />}
              {win.id === 'process-manager' && <ProcessManagerApp />}
              {win.id === 'user-manager' && <UserManagerApp />}
              {win.id === 'network-manager' && <NetworkManagerApp />}
              {win.id === 'security-center' && <SecurityCenterApp />}
              {win.id === 'log-viewer' && <LogViewerApp />}
              {win.id === 'device-manager' && <DeviceManagerApp />}
              {win.id === 'power-manager' && <PowerManagerApp />}
              {isDAppId(win.id) && (() => {
                const dapp = dappService.getDapp(extractDAppId(win.id));
                return dapp ? <DAppHostFrame manifest={dapp.manifest} /> : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">DApp not found</div>
                );
              })()}
            </WindowContainer>
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
    </>
  );
};

export default App;
