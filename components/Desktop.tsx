
import React from 'react';
import { AppId } from '../types';

interface DesktopProps {
  openApp: (id: AppId) => void;
}

const Desktop: React.FC<DesktopProps> = ({ openApp }) => {
  const apps: { id: AppId; name: string; icon: React.ReactNode; color: string }[] = [
    { 
        id: 'minima-node', 
        name: 'Node Core', 
        color: 'bg-blue-600',
        icon: <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
    },
    { 
        id: 'cluster-manager', 
        name: 'Cluster', 
        color: 'bg-[#C51A4A]',
        icon: <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M19 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="m8 10 3-3"/><path d="m13 7 3 3"/><path d="m13 18-1-12"/><path d="m17 11-4 7"/><path d="m7 11 4 7"/></svg>
    },
    { 
        id: 'file-explorer', 
        name: 'Explorer', 
        color: 'bg-indigo-600',
        icon: <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
    },
    { 
        id: 'imager-utility', 
        name: 'Pi Imager', 
        color: 'bg-emerald-600',
        icon: <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4z"/><path d="M7 12h.01"/><path d="M11 12h.01"/><path d="M15 12h.01"/><path d="M22 15V9"/></svg>
    },
    { 
        id: 'maxima-messenger', 
        name: 'Maxima', 
        color: 'bg-cyan-600',
        icon: (
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
    },
    { 
        id: 'ai-assistant', 
        name: 'PiNet AI', 
        color: 'bg-purple-600',
        icon: <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    },
    { 
        id: 'settings', 
        name: 'Settings', 
        color: 'bg-slate-600',
        icon: <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 w-fit h-fit z-10 relative">
      {apps.map(app => (
        <button 
          key={app.id} 
          onDoubleClick={() => openApp(app.id)}
          onClick={() => {
              if (window.matchMedia('(pointer: coarse)').matches) openApp(app.id);
          }}
          className="group flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-white/10 transition-all outline-none"
        >
          <div className={`${app.color} p-5 rounded-2xl shadow-2xl app-icon-shadow group-hover:scale-110 group-active:scale-90 transition-transform`}>
            {app.icon}
          </div>
          <span className="text-sm font-semibold text-slate-300 drop-shadow-lg group-hover:text-white transition-colors">{app.name}</span>
        </button>
      ))}
    </div>
  );
};

export default Desktop;
