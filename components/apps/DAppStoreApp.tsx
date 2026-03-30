
import React, { useEffect, useState, useRef } from 'react';
import type { InstalledDApp, DAppManifest, DAppKind } from '../../types/dapp';
import { dappService } from '../../services/dappService';
import { AppId } from '../../types';

interface DAppStoreAppProps {
  onOpenDApp: (id: AppId) => void;
}

/**
 * DApp Store — browse, install, and manage both next-gen TypeScript DApps
 * and classic Minima MiniDapps.
 */
const DAppStoreApp: React.FC<DAppStoreAppProps> = ({ onOpenDApp }) => {
  const [dapps, setDapps] = useState<readonly InstalledDApp[]>(dappService.dapps);
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<'installed' | 'add'>('installed');
  const [sideloadMode, setSideloadMode] = useState(false);

  // Sideload manifest fields
  const [slName, setSlName] = useState('');
  const [slId, setSlId] = useState('');
  const [slDesc, setSlDesc] = useState('');
  const [slAuthor, setSlAuthor] = useState('');
  const [slVersion, setSlVersion] = useState('1.0.0');
  const [slKind, setSlKind] = useState<DAppKind>('typescript');
  const [slEntry, setSlEntry] = useState('index.html');
  const [slEntryUrl, setSlEntryUrl] = useState('');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    dappService.start();
    const unsub = dappService.subscribe(() => {
      setDapps([...dappService.dapps]);
    });
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const clearMessages = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 5000);
  };

  const handleInstallUrl = async () => {
    if (!installUrl.trim()) return;
    setInstalling(true);
    setError(null);
    setSuccess(null);
    const result = await dappService.installFromUrl(installUrl.trim());
    setInstalling(false);
    if (result) {
      setSuccess(`Installed "${result.manifest.name}" successfully!`);
      setInstallUrl('');
    } else {
      setError('Installation failed — check the URL and try again.');
    }
    clearMessages();
  };

  const handleSideload = async () => {
    if (!slName || !slId || !slEntryUrl) {
      setError('Name, ID, and Entry URL are required.');
      clearMessages();
      return;
    }
    setInstalling(true);
    setError(null);
    setSuccess(null);
    const manifest: DAppManifest = {
      id: slId.trim(),
      name: slName.trim(),
      description: slDesc.trim(),
      version: slVersion.trim() || '1.0.0',
      author: slAuthor.trim(),
      kind: slKind,
      entryPoint: slEntry.trim() || 'index.html',
      permissions: [],
    };
    const result = await dappService.installFromManifest(manifest, slEntryUrl.trim());
    setInstalling(false);
    if (result) {
      setSuccess(`Sideloaded "${result.manifest.name}" successfully!`);
      setSlName('');
      setSlId('');
      setSlDesc('');
      setSlAuthor('');
      setSlEntryUrl('');
    } else {
      setError('Sideload failed.');
    }
    clearMessages();
  };

  const handleUninstall = async (id: string) => {
    setError(null);
    const ok = await dappService.uninstall(id);
    if (ok) {
      setSuccess('DApp removed.');
      clearMessages();
    } else {
      setError('Failed to uninstall.');
      clearMessages();
    }
  };

  const getKindLabel = (kind: DAppKind) => kind === 'typescript' ? 'TypeScript DApp' : kind === 'react-dashboard' ? 'React Dashboard' : 'Classic MiniDapp';
  const getKindColor = (kind: DAppKind) => kind === 'typescript' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : kind === 'react-dashboard' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

  return (
    <div className="p-8 h-full overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">DApp Store</h1>
          <p className="text-slate-400">Install and manage TypeScript DApps, React Dashboards &amp; Classic Minima MiniDapps</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('installed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${tab === 'installed' ? 'bg-white/10 text-white border border-white/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            Installed ({dapps.length})
          </button>
          <button
            onClick={() => setTab('add')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${tab === 'add' ? 'bg-white/10 text-white border border-white/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            + Add DApp
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>
      )}

      {/* Installed Tab */}
      {tab === 'installed' && (
        <div className="space-y-4">
          {dapps.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-slate-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">No DApps Installed</h3>
              <p className="text-slate-400 text-sm">Click &quot;+ Add DApp&quot; to install a TypeScript DApp or classic MiniDapp.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dapps.map(dapp => (
                <div key={dapp.manifest.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: dapp.manifest.color ? `${dapp.manifest.color}20` : 'rgba(59,130,246,0.1)' }}
                    >
                      {dapp.manifest.icon ? (
                        <img src={dapp.manifest.icon} alt="" className="w-8 h-8 rounded" />
                      ) : (
                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                      )}
                    </div>
                    <span className={`px-2 py-1 text-[8px] font-bold rounded-md border ${getKindColor(dapp.manifest.kind)}`}>
                      {getKindLabel(dapp.manifest.kind)}
                    </span>
                  </div>
                  <h3 className="text-white font-bold text-sm mb-1">{dapp.manifest.name}</h3>
                  <p className="text-slate-400 text-xs mb-1 line-clamp-2">{dapp.manifest.description}</p>
                  <p className="text-slate-500 text-[10px] mb-3">v{dapp.manifest.version} • by {dapp.manifest.author}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onOpenDApp(`dapp:${dapp.manifest.id}`)}
                      className="flex-1 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all border border-blue-500/20"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => handleUninstall(dapp.manifest.id)}
                      className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all border border-red-500/20"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add DApp Tab */}
      {tab === 'add' && (
        <div className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSideloadMode(false)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!sideloadMode ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              Install from URL
            </button>
            <button
              onClick={() => setSideloadMode(true)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${sideloadMode ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              Sideload Manifest
            </button>
          </div>

          {!sideloadMode ? (
            /* URL Install */
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <h3 className="text-white font-bold text-sm">Install from Archive URL</h3>
              <p className="text-slate-400 text-xs">
                Provide a URL to a <code className="text-blue-400">.zip</code>, <code className="text-blue-400">.tar.gz</code>, or classic Minima <code className="text-amber-400">.mds.zip</code> archive.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={installUrl}
                  onChange={e => setInstallUrl(e.target.value)}
                  placeholder="https://example.com/my-dapp.zip"
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={handleInstallUrl}
                  disabled={installing || !installUrl.trim()}
                  className="px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {installing ? 'Installing…' : 'Install'}
                </button>
              </div>
            </div>
          ) : (
            /* Sideload Manifest */
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <h3 className="text-white font-bold text-sm">Sideload DApp with Manifest</h3>
              <p className="text-slate-400 text-xs">
                Manually specify the DApp manifest and the URL where it is hosted.
                Use this for locally-developed TypeScript DApps or external hosted apps.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="DApp ID *" placeholder="com.example.my-dapp" value={slId} onChange={setSlId} />
                <InputField label="Name *" placeholder="My Cool DApp" value={slName} onChange={setSlName} />
                <InputField label="Description" placeholder="A short description" value={slDesc} onChange={setSlDesc} />
                <InputField label="Author" placeholder="Your Name" value={slAuthor} onChange={setSlAuthor} />
                <InputField label="Version" placeholder="1.0.0" value={slVersion} onChange={setSlVersion} />
                <InputField label="Entry Point" placeholder="index.html" value={slEntry} onChange={setSlEntry} />
                <div className="col-span-2">
                  <InputField label="Entry URL *" placeholder="https://my-dapp.example.com/" value={slEntryUrl} onChange={setSlEntryUrl} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Kind</label>
                  <select
                    value={slKind}
                    onChange={e => setSlKind(e.target.value as DAppKind)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="typescript">TypeScript DApp</option>
                    <option value="react-dashboard">React Dashboard</option>
                    <option value="minidapp">Classic MiniDapp</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleSideload}
                disabled={installing || !slName || !slId || !slEntryUrl}
                className="mt-2 px-6 py-3 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {installing ? 'Sideloading…' : 'Sideload DApp'}
              </button>
            </div>
          )}

          {/* Information Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-2">
              <h4 className="text-blue-400 font-bold text-xs uppercase tracking-wider">TypeScript DApps</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Next-gen DApps built with TypeScript/React. They run in a sandboxed iframe and
                communicate with PiNet OS via the PostMessage bridge API. Full access to wallet,
                Minima RPC, Maxima messaging, cluster state, and system metrics.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 space-y-2">
              <h4 className="text-cyan-400 font-bold text-xs uppercase tracking-wider">React Dashboards</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Integrate external React dashboard applications (e.g. Grafana, custom monitoring
                dashboards) as DApps on PiNet. They load via URL with full SPA routing support
                and can communicate with PiNet via the bridge API.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-2">
              <h4 className="text-amber-400 font-bold text-xs uppercase tracking-wider">Classic MiniDapps</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Traditional Minima MiniDapps packaged as .mds.zip archives. They integrate
                seamlessly into PiNet OS and can call the Minima node directly. Upload the
                archive URL and PiNet handles extraction and serving.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Helper Components ────────────────────────────────────────────────────── */

const InputField: React.FC<{
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, placeholder, value, onChange }) => (
  <div>
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
    />
  </div>
);

export default DAppStoreApp;
