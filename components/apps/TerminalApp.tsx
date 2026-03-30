
import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { motion } from 'motion/react';

interface TerminalAppProps {
  osMode?: 'pinet' | 'raspbian' | 'ubuntu' | 'debian';
  onOpenApp?: (appId: string) => void;
  onGuiSwitch?: () => void;
}

const TerminalApp: React.FC<TerminalAppProps> = ({ osMode = 'pinet', onOpenApp, onGuiSwitch }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (window.electron) {
      if (!xtermRef.current) return;
      window.electron.terminalStart();
      window.electron.onTerminalData((data) => {
        if (xtermRef.current) xtermRef.current.write(data);
      });
      xtermRef.current.onData((data) => {
        window.electron!.terminalInput(data);
      });
      return;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      if (xtermRef.current) {
        socket.send(JSON.stringify({ type: 'input', data: `export OS_MODE=${osMode}\n` }));
        // Send initial terminal dimensions
        const cols = xtermRef.current.cols;
        const rows = xtermRef.current.rows;
        if (cols && rows) {
          socket.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output' && xtermRef.current) {
          // Handle PINET_CMD: commands
          if (msg.data.includes('PINET_CMD:')) {
            const lines = msg.data.split(/[\r\n]+/);
            for (const line of lines) {
              if (line.includes('PINET_CMD:OPEN:')) {
                const match = line.match(/PINET_CMD:OPEN:([a-zA-Z0-9-]+)/);
                if (match && match[1] && onOpenApp) {
                  onOpenApp(match[1]);
                }
              } else if (line.includes('PINET_CMD:GUI_SWITCH')) {
                if (onGuiSwitch) {
                  onGuiSwitch();
                }
              } else if (line.trim()) {
                xtermRef.current.write(line + '\r\n');
              }
            }
          } else {
            xtermRef.current.write(msg.data);
          }
        }
      } catch (e) {
        if (xtermRef.current) xtermRef.current.write(event.data);
      }
    };

    socket.onclose = () => {
      if (xtermRef.current) {
        xtermRef.current.write('\r\n\x1b[1;31mConnection lost. Retrying...\x1b[0m\r\n');
      }
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      lineHeight: 1.2,
      theme: {
        background: 'transparent',
        foreground: '#e2e8f0',
        cursor: '#f43f5e', // Rose 500
        cursorAccent: '#000000',
        selectionBackground: 'rgba(244, 63, 94, 0.3)',
        black: '#0f172a',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#f8fafc',
      },
      allowTransparency: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    const tryFit = () => {
      try {
        if (terminalRef.current && terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
          // Check if xterm is fully initialized before fitting to prevent 'dimensions' error
          const core = (term as any)._core;
          if (core && !core._isDisposed && core._renderService && core._renderService._renderer && core._renderService._renderer.value) {
            fitAddon.fit();
          }
        }
      } catch (e) {
        console.warn('xterm fit failed', e);
      }
    };

    // Initial fit with a small delay to ensure container is ready
    const fitTimeout = setTimeout(tryFit, 100);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    connect();

    term.onData((data) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Signal terminal resize to the server so the PTY adjusts cols/rows
    term.onResize(({ cols, rows }) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    const handleResize = () => {
      tryFit();
    };
    
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      clearTimeout(fitTimeout);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      
      // Clear refs before closing to prevent handlers from firing on disposed terminal
      xtermRef.current = null;
      
      if (socketRef.current) {
        socketRef.current.onclose = null; // Prevent reconnect loop on unmount
        socketRef.current.close();
      }
      
      // Hack to prevent xterm.js from throwing if animation frames fire after dispose
      try {
        const core = (term as any)._core;
        if (core && core._renderService) {
          Object.defineProperty(core._renderService, 'dimensions', {
            get: () => ({
              css: { canvas: { width: 0, height: 0 }, cell: { width: 0, height: 0 } },
              device: { canvas: { width: 0, height: 0 }, cell: { width: 0, height: 0 }, char: { width: 0, height: 0, left: 0, top: 0 } }
            })
          });
        }
      } catch (e) {}

      term.dispose();
    };
  }, [osMode]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-full glass-dark rounded-b-lg overflow-hidden p-4"
    >
      <div ref={terminalRef} className="w-full h-full" />
    </motion.div>
  );
};

export default TerminalApp;
