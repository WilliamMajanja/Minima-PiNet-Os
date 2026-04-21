/**
 * PiNet-OS Terminal — WebSocket PTY client
 */
const Terminal = {
    connect(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.host}/ws`;
        const ws = new WebSocket(wsUrl);

        let buffer = '';
        const output = document.createElement('div');
        output.className = 'terminal-container';
        output.tabIndex = 0;
        container.innerHTML = '';
        container.appendChild(output);

        ws.onopen = () => {
            output.textContent = 'Connected to terminal.\r\n';
            // Send initial OS mode
            ws.send(JSON.stringify({ type: 'input', data: 'export OS_MODE=pinet\n' }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'output') {
                    output.textContent += msg.data;
                    output.scrollTop = output.scrollHeight;
                }
            } catch (e) {
                output.textContent += event.data;
            }
        };

        ws.onclose = () => {
            output.textContent += '\r\n[Connection closed]\r\n';
        };

        ws.onerror = () => {
            output.textContent += '\r\n[Connection error]\r\n';
        };

        // Keyboard input
        output.addEventListener('keydown', (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            let data = '';
            if (e.key === 'Enter') data = '\r';
            else if (e.key === 'Backspace') data = '\x7f';
            else if (e.key === 'Tab') { data = '\t'; e.preventDefault(); }
            else if (e.key === 'ArrowUp') data = '\x1b[A';
            else if (e.key === 'ArrowDown') data = '\x1b[B';
            else if (e.key === 'ArrowRight') data = '\x1b[C';
            else if (e.key === 'ArrowLeft') data = '\x1b[D';
            else if (e.key === 'Escape') data = '\x1b';
            else if (e.ctrlKey && e.key === 'c') data = '\x03';
            else if (e.ctrlKey && e.key === 'd') data = '\x04';
            else if (e.ctrlKey && e.key === 'l') data = '\x0c';
            else if (e.key.length === 1) data = e.key;

            if (data) {
                ws.send(JSON.stringify({ type: 'input', data }));
                e.preventDefault();
            }
        });

        output.focus();

        return {
            ws,
            send(data) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data })); },
            resize(cols, rows) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows })); },
            close() { ws.close(); },
        };
    },
};
