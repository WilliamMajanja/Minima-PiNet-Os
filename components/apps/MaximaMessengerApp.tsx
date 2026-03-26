
import React, { useState, useEffect, useCallback } from 'react';
import { MinimaService } from '../../services/minimaService';
import { MaximaContact, MaximaMessage } from '../../types';

const MaximaMessengerApp: React.FC = () => {
  const [contacts, setContacts] = useState<MaximaContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<MaximaContact | null>(null);
  const [messages, setMessages] = useState<MaximaMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch real Maxima contacts from the backend
  const fetchContacts = useCallback(async () => {
    try {
      const contactList = await MinimaService.getMaximaContacts();
      if (contactList.length > 0) {
        setContacts(contactList);
        if (!selectedContact) {
          setSelectedContact(contactList[0]);
        }
      } else {
        // Fallback demo contacts
        setContacts([
          { name: 'Alice Node', address: 'MX_0x7123...A1F', status: 'online', lastSeen: '2m ago' },
          { name: 'Bob Cluster', address: 'MX_0x9922...B3D', status: 'offline', lastSeen: '1h ago' },
          { name: 'Charlie Pi', address: 'MX_0x4455...C8E', status: 'online', lastSeen: 'Now' },
        ]);
      }
    } catch (e) {
      console.error('Failed to fetch contacts:', e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedContact]);

  useEffect(() => {
    fetchContacts();
    const interval = setInterval(fetchContacts, 15000);
    return () => clearInterval(interval);
  }, [fetchContacts]);

  const handleSend = async () => {
    if (!input.trim() || !selectedContact) return;

    const newMessage: MaximaMessage = {
      id: Math.random().toString(36).slice(2, 11),
      from: 'me',
      to: selectedContact.address,
      text: input,
      timestamp: Date.now(),
      application: 'pinet-os-messenger',
      delivered: false,
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');

    // Send via Maxima protocol
    const success = await MinimaService.sendMaximaMessage(
      selectedContact.address,
      "pinet-os-messenger",
      { text: input }
    );

    if (success) {
      // Update delivery status
      setMessages(prev => prev.map(m =>
        m.id === newMessage.id ? { ...m, delivered: true } : m
      ));
    }
  };

  return (
    <div className="flex h-full bg-slate-950/20">
      {/* Sidebar Contacts */}
      <div className="w-64 border-r border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Maxima Contacts</h2>
          <p className="text-[9px] text-slate-600 mt-1">Encrypted P2P via Minima</p>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 text-xs text-slate-500">Loading contacts...</div>
          ) : contacts.map(contact => (
            <button
              key={contact.address}
              onClick={() => setSelectedContact(contact)}
              className={`w-full p-4 flex items-center gap-3 transition-colors hover:bg-white/5 ${selectedContact?.address === contact.address ? 'bg-white/10' : ''}`}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-cyan-600/20 flex items-center justify-center text-cyan-400 font-bold">
                  {contact.name[0]}
                </div>
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${contact.status === 'online' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
              </div>
              <div className="text-left overflow-hidden">
                <div className="text-sm font-bold text-white truncate">{contact.name}</div>
                <div className="text-[10px] text-slate-500 truncate">{contact.address}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-white/5">
          <button
            onClick={fetchContacts}
            className="w-full px-3 py-2 text-[10px] font-bold text-slate-400 bg-white/5 hover:bg-white/10 rounded-lg transition-colors uppercase tracking-wider"
          >
            ↻ Refresh Contacts
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">{selectedContact.name}</div>
                <div className="text-[10px] text-slate-400">Maxima Information Transport Layer • {selectedContact.sameChain ? 'Same Chain' : 'Cross Chain'}</div>
              </div>
              <div className="flex gap-2 items-center">
                <span className={`text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${selectedContact.status === 'online' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                  {selectedContact.status}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                    <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                    <p className="text-xs">Send a decentralized message via Maxima.</p>
                    <p className="text-[9px] text-slate-700">End-to-end encrypted • No central server</p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${msg.from === 'me' ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}`}>
                    {msg.text}
                    <div className="text-[9px] opacity-50 mt-1 text-right flex items-center justify-end gap-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.from === 'me' && (
                        <span>{msg.delivered ? '✓✓' : '✓'}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/5">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                  placeholder="Type a Maxima message..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <button
                  onClick={handleSend}
                  className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Select a contact to start messaging over Maxima
          </div>
        )}
      </div>
    </div>
  );
};

export default MaximaMessengerApp;
