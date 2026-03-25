
import React, { useState, useEffect } from 'react';
import { NodeStats, SystemStats } from '../types';
import { motion } from 'motion/react';
import { getApiUrl } from '../utils/api';

interface TopBarProps {
  nodeStats: NodeStats;
  systemStats: SystemStats;
  onSwitchOS?: () => void;
  currentOS?: 'pinet' | 'raspbian';
}

const TopBar: React.FC<TopBarProps> = ({ nodeStats, systemStats, onSwitchOS, currentOS }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>, url: string, filename: string) => {
    e.preventDefault();
    const target = e.currentTarget;
    
    try {
      target.style.opacity = '0.5';
      target.style.pointerEvents = 'none';
      
      // Construct absolute URL to ensure fetch works correctly in iframe
      const downloadUrl = getApiUrl(url);
      
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: try direct link if fetch fails
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank'; // Try opening in new tab to avoid top-level navigation error
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      target.style.opacity = '1';
      target.style.pointerEvents = 'auto';
    }
  };

  return (
    <motion.header 
      initial={{ y: -40 }}
      animate={{ y: 0 }}
      className="h-10 fixed top-0 left-0 right-0 glass-dark z-50 flex items-center justify-between px-4 border-b border-white/5"
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#C51A4A] rounded flex items-center justify-center shadow-lg">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
          </div>
          <span className="text-sm font-bold tracking-tight text-white">PiNet<span className="text-[#C51A4A]">OS</span></span>
        </div>
        
        <div className="hidden md:flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${nodeStats.status === 'Synced' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                <span>Node: {nodeStats.status}</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <span>Peers: {nodeStats.peers}</span>
            <div className="w-px h-3 bg-white/10" />
            <span>H: {nodeStats.blockHeight.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-medium">
        <a 
          href="/api/download-os-build"
          onClick={(e) => handleDownload(e, '/api/download-os-build', 'PiNetOS-Build-System.zip')}
          className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-full transition-colors border border-emerald-500/30"
          title="Download PiNetOS Build System"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="font-bold tracking-wider text-[10px] uppercase">OS Build System</span>
        </a>
        <a 
          href="/api/download-os-image"
          onClick={(e) => handleDownload(e, '/api/download-os-image', 'PiNetOS-RaspberryPi.img')}
          className="hidden md:flex items-center gap-2 px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-full transition-colors border border-purple-500/30"
          title="Download PiNetOS Raspberry Pi Image"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="font-bold tracking-wider text-[10px] uppercase">Pi Image</span>
        </a>
        <a 
          href="/api/download-electron"
          onClick={(e) => handleDownload(e, '/api/download-electron', 'PiNetOS-Electron-Desktop.zip')}
          className="hidden md:flex items-center gap-2 px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-full transition-colors border border-blue-500/30"
          title="Download PiNetOS Electron Desktop"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="font-bold tracking-wider text-[10px] uppercase">Desktop App</span>
        </a>
        <a 
          href="/api/download-os-docs"
          onClick={(e) => handleDownload(e, '/api/download-os-docs', 'PiNetOS-Documentation.zip')}
          className="hidden lg:flex items-center gap-2 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-full transition-colors border border-amber-500/30"
          title="Download PiNetOS Documentation"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="font-bold tracking-wider text-[10px] uppercase">Docs</span>
        </a>
        <a 
          href="/api/download-pinetos"
          onClick={(e) => handleDownload(e, '/api/download-pinetos', 'PiNetOS-Enterprise.zip')}
          className="hidden md:flex items-center gap-2 px-3 py-1 bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 rounded-full transition-colors border border-pink-500/30"
          title="Download PiNetOS Build Artifacts"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="font-bold tracking-wider text-[10px] uppercase">Export OS</span>
        </a>
        {onSwitchOS && (
            <button 
                onClick={onSwitchOS}
                className="hidden sm:flex items-center p-1 bg-black/40 border border-white/10 rounded-full transition-all hover:bg-black/60 active:scale-95 relative group"
                title={`Switch to ${currentOS === 'pinet' ? 'Raspbian' : 'PiNet'} OS`}
            >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className={`flex items-center justify-center w-24 h-6 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all z-10 ${currentOS === 'pinet' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400'}`}>
                  PiNet OS
                </div>
                <div className={`flex items-center justify-center w-24 h-6 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all z-10 ${currentOS === 'raspbian' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400'}`}>
                  Raspbian
                </div>
            </button>
        )}

        <div className="hidden sm:flex items-center gap-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          <div className="flex items-center gap-1.5 hover:text-white transition-colors cursor-help" title="System Load">
            <svg className="w-3 h-3 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span>{Math.round(systemStats?.cpu ?? 0)}%</span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-white transition-colors cursor-help" title="Core Temperature">
            <svg className="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M5 5l14 14M19 5L5 19"/></svg>
            <span>{Math.round(systemStats?.temp ?? 0)}°C</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-200 font-bold tabular-nums">
          <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="hidden xs:inline opacity-30">|</span>
          <span className="hidden xs:inline text-slate-400">{time.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
    </motion.header>
  );
};

export default TopBar;
