
import React, { useState } from 'react';
import { shell } from '../../services/shellService';

const FileExplorerApp: React.FC = () => {
  const [currentPath, setCurrentPath] = useState(shell.getCurrentPath());
  
  // For the demo, we just get a static directory list from the current path
  const nodes = [
    { name: 'bin', type: 'dir', modified: '2024-05-22', size: '--' },
    { name: 'etc', type: 'dir', modified: '2024-05-22', size: '--' },
    { name: 'home', type: 'dir', modified: '2024-05-22', size: '--' },
    { name: 'var', type: 'dir', modified: '2024-05-22', size: '--' },
    { name: 'README.md', type: 'file', modified: '2024-05-21', size: '2KB' },
    { name: 'minima.conf', type: 'file', modified: '2024-05-22', size: '1KB' },
  ];

  return (
    <div className="flex h-full flex-col bg-slate-900/40">
      <div className="flex items-center gap-4 p-4 border-b border-white/5 bg-black/20">
        <div className="flex gap-2">
            <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            </button>
            <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </button>
        </div>
        <div className="flex-1">
            <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono text-slate-300 flex items-center gap-2">
                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                {currentPath}
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <table className="w-full text-left text-xs text-slate-400">
            <thead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">
                <tr>
                    <th className="pb-3 pl-4">Name</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Modified</th>
                    <th className="pb-3">Size</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                {nodes.map((node, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors cursor-pointer group">
                        <td className="py-3 pl-4 flex items-center gap-3">
                            <div className={node.type === 'dir' ? 'text-blue-400' : 'text-slate-400'}>
                                {node.type === 'dir' ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                                )}
                            </div>
                            <span className="text-white font-medium group-hover:text-blue-400 transition-colors">{node.name}</span>
                        </td>
                        <td className="py-3 font-mono opacity-60 uppercase">{node.type}</td>
                        <td className="py-3 opacity-60">{node.modified}</td>
                        <td className="py-3 opacity-60 font-mono">{node.size}</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileExplorerApp;
