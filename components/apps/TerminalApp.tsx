
import React, { useState, useEffect, useRef } from 'react';
import { shell } from '../../services/shellService';

type LineType = 'header' | 'prompt' | 'info' | 'success' | 'error' | 'command' | 'code' | 'warning';

interface TerminalLine {
  text: string;
  type: LineType;
}

const TerminalApp: React.FC = () => {
  const [history, setHistory] = useState<TerminalLine[]>([
    { text: 'PiNet Web3 OS Shell [Version 1.0.35]', type: 'header' },
    { text: '(c) 2024 Minima Global. Decentralized Node Environment.', type: 'info' },
    { text: `Current User: ${shell.getUser()}`, type: 'info' },
    { text: 'Type "help" to see available commands.', type: 'info' },
    { text: '', type: 'info' }
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const rawInput = input.trim();
    if (!rawInput) return;

    if (rawInput === 'clear') {
        setHistory([]);
        setInput('');
        return;
    }

    const promptLine: TerminalLine = { 
        text: `${shell.getUser()}@raspberrypi:${shell.getCurrentPath()}$ ${rawInput}`, 
        type: 'prompt' 
    };
    
    const result = shell.execute(rawInput);
    
    setHistory(prev => [...prev, promptLine, ...result.output]);
    setInput('');
  };

  const getLineStyles = (type: LineType) => {
    switch (type) {
      case 'header': return 'text-white font-bold tracking-tight border-l-2 border-white/20 pl-2 my-1';
      case 'prompt': return 'text-blue-400 font-bold';
      case 'info': return 'text-slate-400';
      case 'success': return 'text-emerald-400';
      case 'error': return 'text-rose-400 font-medium italic';
      case 'warning': return 'text-amber-400 italic';
      case 'code': return 'text-indigo-400 bg-indigo-500/5 px-1 rounded font-mono';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#020617] font-mono text-xs sm:text-sm p-6 overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-auto space-y-1 relative z-10 selection:bg-blue-500/30">
        {history.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap leading-relaxed animate-in fade-in slide-in-from-left-1 ${getLineStyles(line.type)}`}>
            {line.text}
          </div>
        ))}
      </div>

      <form onSubmit={handleCommand} className="mt-4 flex gap-2 border-t border-white/5 pt-4 group relative z-10">
        <span className="text-blue-400 shrink-0 font-bold select-none">
            {shell.getUser()}@raspberrypi:{shell.getCurrentPath()}$
        </span>
        <input 
          autoFocus
          className="flex-1 bg-transparent border-none outline-none text-white caret-pink-500"
          value={input}
          onChange={e => setInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </form>
    </div>
  );
};

export default TerminalApp;
