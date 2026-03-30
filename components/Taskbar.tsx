
import React from 'react';
import { AppId, WindowState, isDAppId } from '../types';
import { motion } from 'motion/react';

interface TaskbarProps {
  windows: WindowState[];
  activeId: AppId;
  onAppClick: (id: AppId) => void;
}

const Taskbar: React.FC<TaskbarProps> = ({ windows, activeId, onAppClick }) => {
  return (
    <motion.footer 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="h-16 fixed bottom-4 left-1/2 -translate-x-1/2 glass-dark z-50 rounded-3xl flex items-center px-3 gap-2 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
    >
      {windows.map(win => (
        <motion.button
          key={win.id}
          onClick={() => onAppClick(win.id)}
          whileHover={{ y: -5, scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className={`relative group w-11 h-11 flex items-center justify-center rounded-2xl transition-all duration-300 ${
            activeId === win.id ? 'bg-white/15 shadow-lg shadow-white/5' : 'hover:bg-white/5'
          }`}
        >
          <div className="w-7 h-7 flex items-center justify-center">
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
            {win.id === 'visual-studio' && <VisualIcon />}
            {win.id === 'dapp-store' && <DAppStoreIcon />}
            {isDAppId(win.id) && <DAppIcon />}
          </div>

          {win.isOpen && (
              <motion.div 
                layoutId="active-dot"
                className={`absolute -bottom-1.5 w-1 h-1 rounded-full ${activeId === win.id ? 'bg-pink-500 w-4 shadow-[0_0_8px_rgba(236,72,153,0.8)]' : 'bg-slate-500'} transition-all`} 
              />
          )}

          <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap border border-white/10 shadow-xl translate-y-2 group-hover:translate-y-0">
            {win.title}
          </div>
        </motion.button>
      ))}
    </motion.footer>
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
const VisualIcon = () => <svg className="w-5 h-5 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z"/></svg>;
const DAppStoreIcon = () => <svg className="w-5 h-5 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
const DAppIcon = () => <svg className="w-5 h-5 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><path d="M7.5 4.21l4.5 2.6 4.5-2.6" /><path d="M7.5 19.79V14.6L3 12" /><path d="M21 12l-4.5 2.6v5.19" /><path d="M3.27 6.96L12 12.01l8.73-5.05" /><path d="M12 22.08V12" /></svg>;

export default Taskbar;
