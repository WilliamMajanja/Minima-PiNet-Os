
import React, { useState } from 'react';

const SettingsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('system');
  const [nodeAlias, setNodeAlias] = useState('Pi-Alpha-Node');
  const [p2pEnabled, setP2pEnabled] = useState(true);
  const [torEnabled, setTorEnabled] = useState(false);
  const [wallpaper, setWallpaper] = useState('carbon');

  return (
    <div className="flex h-full bg-slate-900/40">
      <div className="w-56 bg-black/20 border-r border-white/5 p-4 flex flex-col gap-2">
        <NavButton active={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={<SystemIcon />} label="System" />
        <NavButton active={activeTab === 'network'} onClick={() => setActiveTab('network')} icon={<NetworkIcon />} label="Network" />
        <NavButton active={activeTab === 'display'} onClick={() => setActiveTab('display')} icon={<DisplayIcon />} label="Display" />
        <NavButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={<SecurityIcon />} label="Security" />
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-2xl font-bold text-white mb-6 uppercase tracking-tight">{activeTab} Configuration</h1>

        {activeTab === 'system' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <Section title="Node Identity">
                    <Input label="Node Alias" value={nodeAlias} onChange={(e) => setNodeAlias(e.target.value)} />
                    <p className="text-[10px] text-slate-500 mt-2">This alias is broadcast to peers on the Minima network.</p>
                </Section>
                <Section title="Power Management">
                     <Toggle label="Eco Mode (Low Power)" checked={false} />
                     <Toggle label="Auto-Reboot on Kernel Panic" checked={true} />
                </Section>
                <Section title="Storage">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                        <div>
                            <div className="text-xs font-bold text-white mb-1">NVMe Cache Clean</div>
                            <div className="text-[10px] text-slate-400">Clear temporary chain data</div>
                        </div>
                        <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase rounded-lg border border-white/10 transition-all">Execute</button>
                    </div>
                </Section>
            </div>
        )}

        {activeTab === 'network' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <Section title="P2P Configuration">
                    <Toggle label="Enable P2P Discovery" checked={p2pEnabled} onChange={() => setP2pEnabled(!p2pEnabled)} />
                    <div className="mt-4">
                         <Input label="Port Forwarding" value="9001" disabled />
                    </div>
                </Section>
                <Section title="Bandwidth">
                     <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-2">
                                <span>Max Upload</span>
                                <span>Unlimited</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full">
                                <div className="h-full w-full bg-blue-500 rounded-full opacity-50"></div>
                            </div>
                        </div>
                     </div>
                </Section>
            </div>
        )}

        {activeTab === 'display' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <Section title="Desktop Appearance">
                    <div className="grid grid-cols-2 gap-4">
                        <WallpaperOption label="Carbon Fibre" active={wallpaper === 'carbon'} onClick={() => setWallpaper('carbon')} />
                        <WallpaperOption label="Neon City" active={wallpaper === 'neon'} onClick={() => setWallpaper('neon')} />
                        <WallpaperOption label="Deep Space" active={wallpaper === 'space'} onClick={() => setWallpaper('space')} />
                        <WallpaperOption label="Abstract Mesh" active={wallpaper === 'mesh'} onClick={() => setWallpaper('mesh')} />
                    </div>
                </Section>
                <Section title="Interface">
                    <Toggle label="Reduce Motion" checked={false} />
                    <Toggle label="High Contrast Mode" checked={false} />
                </Section>
             </div>
        )}

        {activeTab === 'security' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <Section title="Privacy">
                    <Toggle label="Route via Tor" checked={torEnabled} onChange={() => setTorEnabled(!torEnabled)} />
                    <p className="text-[10px] text-slate-500 mt-2">Anonymize all node traffic through the Tor network (Latency will increase).</p>
                    <div className="mt-4">
                        <Toggle label="Share Telemetry" checked={true} />
                    </div>
                </Section>
                <Section title="Access Control">
                    <button className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold uppercase transition-all">
                        Reset Wallet Seed
                    </button>
                </Section>
             </div>
        )}
      </div>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
        <div className={active ? 'text-white' : 'text-slate-400'}>{icon}</div>
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
    </button>
);

const Section = ({ title, children }: any) => (
    <div className="glass p-6 rounded-2xl border border-white/5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">{title}</h3>
        {children}
    </div>
);

const Input = ({ label, value, onChange, disabled }: any) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
        <input 
            value={value} 
            onChange={onChange} 
            disabled={disabled}
            className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
        />
    </div>
);

const Toggle = ({ label, checked, onChange }: any) => (
    <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <button 
            onClick={onChange}
            className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}
        >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'left-6' : 'left-1'}`} />
        </button>
    </div>
);

const WallpaperOption = ({ label, active, onClick }: any) => (
    <button onClick={onClick} className={`p-4 rounded-xl border transition-all text-left ${active ? 'bg-white/10 border-blue-500' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
        <div className={`w-full h-16 rounded-lg mb-2 ${active ? 'bg-blue-500/20' : 'bg-slate-800'}`}></div>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'text-white' : 'text-slate-400'}`}>{label}</span>
    </button>
);

const SystemIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>;
const NetworkIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/></svg>;
const DisplayIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>;
const SecurityIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>;

export default SettingsApp;
