
import React, { useState, useEffect, useRef } from 'react';
import { ClusterNode, HatType, AppId } from '../../types';
import { systemService } from '../../services/systemService';

interface BootSplashScreenProps {
  onComplete: (nodes: ClusterNode[], autoOpenApps: AppId[]) => void;
}

const BootSplashScreen: React.FC<BootSplashScreenProps> = ({ onComplete }) => {
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'initializing' | 'detecting' | 'configuring' | 'ready'>('initializing');
  const [progress, setProgress] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setBootLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [bootLogs]);

  useEffect(() => {
    const runBootSequence = async () => {
      // Phase 1: Initializing
      addLog("PiNet Web3 OS v1.0.35-STABLE loading...");
      addLog("Kernel: Linux raspberrypi 6.6.20+rpt-rpi-v8");
      addLog("Initializing MDS (MiniDapp System) Layer...");
      await new Promise(r => setTimeout(r, 800));
      setProgress(20);

      // Phase 2: Detecting Hardware
      setStatus('detecting');
      addLog("Scanning Hardware Bus (I2C/SPI/PCIe)...");
      await new Promise(r => setTimeout(r, 1000));
      
      // Simulate hardware detection based on what systemService finds
      const foundNodes = await systemService.scanSubnet('192.168.1.0', (log) => {
        addLog(log);
      });
      
      const localNode = foundNodes.find(n => n.id === 'n1');
      const detectedHat: HatType = localNode?.hat || 'NONE';
      
      addLog(`Hardware Detected: ${detectedHat}`);
      if (detectedHat === 'AI_NPU') {
        addLog("NPU Detected: Hailo-8 AI Accelerator found on PCIe.");
      } else if (detectedHat === 'SSD_NVME') {
        addLog("Storage Detected: NVMe SSD found on PCIe Gen 3.");
      }
      
      setProgress(60);
      await new Promise(r => setTimeout(r, 800));

      // Phase 3: Configuring
      setStatus('configuring');
      addLog("Configuring Application Compatibility Matrix...");
      
      const autoOpenApps: AppId[] = [];
      
      addLog("Finalizing System State...");
      setProgress(90);
      await new Promise(r => setTimeout(r, 1200));

      // Phase 4: Ready
      setStatus('ready');
      setProgress(100);
      addLog("System Ready. Launching PiNet Compositor.");
      await new Promise(r => setTimeout(r, 1000));
      
      onComplete(foundNodes, autoOpenApps);
    };

    runBootSequence();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 font-mono text-white overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(circle_at_50%_50%,rgba(197,26,74,0.2),rgba(0,0,0,0))]" />
      
      <div className="w-full max-w-3xl space-y-8 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20 animate-pulse">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M19 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="m8 10 3-3"/><path d="m13 7 3 3"/><path d="m13 18-1-12"/><path d="m17 11-4 7"/><path d="m7 11 4 7"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic text-pink-500">PiNet Web3 OS</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Official Bootloader v2.4</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-slate-400 uppercase mb-1">{status}...</div>
            <div className="text-xl font-bold text-white">{progress}%</div>
          </div>
        </div>

        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div 
            className="h-full bg-gradient-to-r from-pink-600 to-purple-600 transition-all duration-500 shadow-[0_0_15px_rgba(219,39,119,0.5)]" 
            style={{ width: `${progress}%` }} 
          />
        </div>

        <div className="bg-black/60 rounded-2xl border border-white/10 p-6 h-80 overflow-y-auto shadow-inner relative group">
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-20 opacity-30" />
          <div className="space-y-1">
            {bootLogs.map((log, i) => (
              <div key={i} className="text-[11px] leading-relaxed flex gap-3">
                <span className="text-slate-600 shrink-0">[{ (0.45 + (i * 0.12)).toFixed(6) }]</span>
                <span className={`${log.includes('Hardware Detected') ? 'text-emerald-400 font-bold' : log.includes('Optimizing') ? 'text-purple-400' : 'text-slate-300'}`}>
                  {log.split('] ')[1]}
                </span>
              </div>
            ))}
            <div ref={logEndRef} className="h-4 flex items-center">
              <div className="w-2 h-4 bg-pink-500 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-[9px] font-bold text-slate-600 uppercase tracking-widest">
          <span>AARCH64 (v8.1) • 16GB RAM • BCM2712</span>
          <span>© 2026 MINIMA GLOBAL</span>
        </div>
      </div>
    </div>
  );
};

export default BootSplashScreen;
