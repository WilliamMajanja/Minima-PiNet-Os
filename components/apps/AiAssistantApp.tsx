
import React, { useState, useRef, useEffect } from 'react';
import { getAiResponse, generateVeoVideo } from '../../services/geminiService';
import { AIProvider } from '../../types';

interface AiAssistantAppProps {
  context: any;
}

type Mode = 'fast' | 'complex' | 'thinking' | 'maps';

const AiAssistantApp: React.FC<AiAssistantAppProps> = ({ context }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; type?: 'text' | 'video' | 'image' }[]>([
    { role: 'assistant', content: "Hello! I'm your PiNet OS intelligence. I can leverage Google's Cloud models or your Local AirLLM cluster nodes for free inference. How can I help?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('fast');
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [localUrl, setLocalUrl] = useState('http://localhost:11434/v1/chat/completions');
  const [mediaToUpload, setMediaToUpload] = useState<{ data: string, mimeType: string, preview: string }[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = (ev.target?.result as string).split(',')[1];
        setMediaToUpload(prev => [...prev, { 
          data: base64, 
          mimeType: file.type,
          preview: URL.createObjectURL(file)
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVeoGen = async () => {
    if (!input.trim() || isLoading) return;
    if (provider === 'airllm') {
      setMessages(prev => [...prev, { role: 'assistant', content: "Video generation is only supported on Gemini cloud providers." }]);
      return;
    }
    
    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Veo generation requires a paid API key. Please use the button below to select one." }]);
      return;
    }

    const prompt = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: `Generate video: ${prompt}` }]);
    setIsLoading(true);

    const videoUrl = await generateVeoVideo(prompt);
    if (videoUrl) {
      setMessages(prev => [...prev, { role: 'assistant', content: videoUrl, type: 'video' }]);
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: "Failed to generate video. Ensure your project has billing enabled." }]);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && mediaToUpload.length === 0) || isLoading) return;

    const userText = input.trim();
    setInput('');
    const currentMedia = [...mediaToUpload];
    setMediaToUpload([]);

    setMessages(prev => [...prev, { role: 'user', content: userText || "Analyzing media..." }]);
    setIsLoading(true);

    const response = await getAiResponse(userText, { 
      context, 
      mode, 
      provider,
      localEndpoint: localUrl,
      media: currentMedia.map(m => ({ data: m.data, mimeType: m.mimeType }))
    });

    if (response === "ERROR_KEY_REQUIRED") {
        setMessages(prev => [...prev, { role: 'assistant', content: "Advanced models require a paid API key. Click 'Select API Key' in settings." }]);
    } else {
        setMessages(prev => [...prev, { role: 'assistant', content: response || "I couldn't process that request." }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-sm relative">
      {/* Provider & Mode Controls */}
      <div className="p-4 border-b border-white/5 flex flex-wrap gap-4 items-center bg-black/20">
        <div className="flex bg-white/5 rounded-lg p-1 border border-white/10 items-center gap-2">
            <span className="text-[9px] font-bold text-slate-500 uppercase px-2">Provider</span>
            <button 
                onClick={() => setProvider('gemini')}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${provider === 'gemini' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
                Gemini
            </button>
            <button 
                onClick={() => setProvider('airllm')}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${provider === 'airllm' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
                AirLLM
            </button>
        </div>

        {provider === 'gemini' && (
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/10 items-center gap-1">
             <span className="text-[9px] font-bold text-slate-500 uppercase px-2">Mode</span>
            {(['fast', 'complex', 'thinking', 'maps'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                  mode === m ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {provider === 'airllm' && (
            <div className="flex-1 max-w-xs relative">
                <input 
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                    placeholder="Local Endpoint..."
                    value={localUrl}
                    onChange={e => setLocalUrl(e.target.value)}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
            </div>
        )}
        
        {window.aistudio && provider === 'gemini' && (
           <button 
             onClick={() => window.aistudio.openSelectKey()}
             className="ml-auto px-3 py-1.5 bg-pink-600/20 border border-pink-500/40 text-pink-400 rounded-md text-[9px] font-bold uppercase tracking-widest hover:bg-pink-600 hover:text-white transition-all"
           >
             Select API Key
           </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-6">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
              m.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'glass border border-white/5 text-slate-300 rounded-bl-none shadow-xl'
            }`}>
              {m.type === 'video' ? (
                <div className="space-y-2">
                  <video src={m.content} controls className="w-full rounded-lg shadow-2xl border border-white/10" />
                  <p className="text-[10px] text-slate-400 italic">Veo 3.1 Fast Generated Cluster Concept</p>
                </div>
              ) : m.content.startsWith('http') && m.type === 'image' ? (
                <img src={m.content} className="max-w-full rounded-lg" />
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                   {m.content.split('\n').map((line, li) => <p key={li}>{line}</p>)}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="glass border border-white/5 p-4 rounded-2xl rounded-bl-none flex flex-col gap-3">
              <div className="flex gap-1.5">
                <div className={`w-2 h-2 ${provider === 'airllm' ? 'bg-emerald-500' : 'bg-purple-500'} rounded-full animate-bounce`} />
                <div className={`w-2 h-2 ${provider === 'airllm' ? 'bg-emerald-500' : 'bg-purple-500'} rounded-full animate-bounce [animation-delay:-0.15s]`} />
                <div className={`w-2 h-2 ${provider === 'airllm' ? 'bg-emerald-500' : 'bg-purple-500'} rounded-full animate-bounce [animation-delay:-0.3s]`} />
              </div>
              <span className={`text-[9px] font-mono ${provider === 'airllm' ? 'text-emerald-400' : 'text-purple-400'} animate-pulse tracking-widest uppercase`}>
                  {provider === 'airllm' ? 'Local Cluster Sharding & Inference...' : 'Initializing Neural Reasoning...'}
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 space-y-4">
        {mediaToUpload.length > 0 && (
          <div className="flex gap-2 p-2 bg-white/5 rounded-xl border border-white/10 overflow-x-auto">
            {mediaToUpload.map((m, i) => (
              <div key={i} className="relative group shrink-0">
                <img src={m.preview} className="w-16 h-16 object-cover rounded-lg border border-white/20" />
                <button 
                  type="button"
                  onClick={() => setMediaToUpload(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,video/*" 
              multiple 
              onChange={handleFileUpload} 
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-white/5 border border-white/10 text-slate-400 rounded-xl hover:bg-white/10 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z"/></svg>
            </button>

            <div className="relative flex-1">
                <input
                className={`w-full glass-dark border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors pr-12 ${provider === 'airllm' ? 'focus:border-emerald-500/50' : 'focus:border-purple-500/50'}`}
                placeholder={provider === 'airllm' ? "Asking local Llama cluster..." : "Querying Gemini cloud..."}
                value={input}
                onChange={e => setInput(e.target.value)}
                />
                {provider === 'gemini' && (
                    <button 
                      type="button"
                      onClick={handleVeoGen}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-500 hover:text-pink-400 transition-colors p-1"
                      title="Generate Veo Video"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    </button>
                )}
            </div>
            
            <button 
              type="submit"
              disabled={isLoading}
              className={`p-3 disabled:opacity-50 text-white rounded-xl transition-all active:scale-95 shadow-lg flex items-center gap-2 ${provider === 'airllm' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-purple-600 hover:bg-purple-500'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
        </div>
      </form>
    </div>
  );
};

export default AiAssistantApp;
