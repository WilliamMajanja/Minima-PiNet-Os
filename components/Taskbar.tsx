
import React from 'react';
import { AppId, WindowState } from '../types';

interface TaskbarProps {
  windows: WindowState[];
  activeId: AppId;
  onAppClick: (id: AppId) => void;
}

const Taskbar: React.FC<TaskbarProps> = ({ windows, activeId, onAppClick }) => {
  return (
    <footer className="h-14 fixed bottom-2 left-1/2 -translate-x-1/2 glass-dark z-50 rounded-2xl flex items-center px-2 gap-1 border border-white/10 shadow-2xl">
      {windows.map(win => (
        <button
          key={win.id}
          onClick={() => onAppClick(win.id)}
          className={`relative group w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 ${
            activeId === win.id ? 'bg-white/10 scale-105' : 'hover:bg-white/5'
          }`}
        >
          {win.id === 'minima-node' && <MinimaIcon />}
          {win.id === 'cluster-manager' && <ClusterIcon />}
          {win.id === 'imager-utility' && <ImagerIcon />}
          {win.id === 'depai-executor' && <DePAIIcon />}
          {win.id === 'system-monitor' && <MonitorIcon />}
          {win.id === 'terminal' && <TerminalIcon />}
          {win.id === 'ai-assistant' && <AiIcon />}
          {win.id === 'wallet' && <WalletIcon />}
          {win.id === 'maxima-messenger' && <MaximaIcon />}
          {win.id === 'file-explorer' && <ExplorerIcon />}
          {win.id === 'settings' && <SettingsIcon />}

          {win.isOpen && (
              <div className={`absolute -bottom-1 w-1 h-1 rounded-full ${activeId === win.id ? 'bg-blue-400 w-3' : 'bg-slate-500'} transition-all`} />
          )}

          <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10">
            {win.title}
          </div>
        </button>
      ))}
      <div className="w-px h-6 bg-white/10 mx-1" />
      <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors">
        <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
      </button>
    </footer>
  );
};

const MinimaIcon = () => <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>;
const ClusterIcon = () => <svg className="w-5 h-5 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M19 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="m8 10 3-3"/><path d="m13 7 3 3"/><path d="m13 18-1-12"/><path d="m17 11-4 7"/><path d="m7 11 4 7"/></svg>;
const DePAIIcon = () => <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const MonitorIcon = () => <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
const TerminalIcon = () => <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 17l6-6-6-6M12 19h8"/></svg>;
const AiIcon = () => <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
const WalletIcon = () => <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-3.33M21 12H12"/></svg>;
const MaximaIcon = () => <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M8 9h8"/><path d="M8 13h6"/></svg>;
const ExplorerIcon = () => <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>;
const ImagerIcon = () => <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4z"/><path d="M7 12h.01"/><path d="M11 12h.01"/><path d="M15 12h.01"/><path d="M22 15V9"/></svg>;
const SettingsIcon = () => <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>;

export default Taskbar;
