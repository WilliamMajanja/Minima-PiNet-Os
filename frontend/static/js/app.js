/**
 * PiNet-OS Main Application — Python Frontend
 * Handles boot sequence, app registry, desktop icons, stats polling, clock.
 */

/* ─── App Registry ─────────────────────────── */
const PiNetApps = {
    apps: [
        { id: 'minima-node', name: 'Node Core', icon: '⬡', color: '#3b82f6', category: 'blockchain' },
        { id: 'wallet', name: 'Wallet', icon: '💰', color: '#8b5cf6', category: 'blockchain' },
        { id: 'maxima-messenger', name: 'Maxima', icon: '💬', color: '#06b6d4', category: 'blockchain' },
        { id: 'cluster-manager', name: 'Cluster', icon: '🔗', color: '#ec4899', category: 'system' },
        { id: 'system-monitor', name: 'Monitor', icon: '📊', color: '#22c55e', category: 'system' },
        { id: 'terminal', name: 'Terminal', icon: '⌨️', color: '#1e293b', category: 'system' },
        { id: 'file-explorer', name: 'Files', icon: '📁', color: '#6366f1', category: 'system' },
        { id: 'process-manager', name: 'Processes', icon: '⚙️', color: '#f59e0b', category: 'system' },
        { id: 'network-manager', name: 'Network', icon: '🌐', color: '#14b8a6', category: 'system' },
        { id: 'security-center', name: 'Security', icon: '🛡️', color: '#ef4444', category: 'system' },
        { id: 'user-manager', name: 'Users', icon: '👥', color: '#8b5cf6', category: 'system' },
        { id: 'device-manager', name: 'Devices', icon: '🔌', color: '#f97316', category: 'system' },
        { id: 'power-manager', name: 'Power', icon: '🔋', color: '#22c55e', category: 'system' },
        { id: 'log-viewer', name: 'Logs', icon: '📜', color: '#6b7280', category: 'system' },
        { id: 'settings', name: 'Settings', icon: '⚙️', color: '#475569', category: 'config' },
        { id: 'dapp-store', name: 'DApp Store', icon: '🏪', color: '#8b5cf6', category: 'apps' },
        { id: 'ai-assistant', name: 'PiNet AI', icon: '🤖', color: '#a855f7', category: 'apps' },
        { id: 'depai-executor', name: 'DePAi', icon: '🧠', color: '#ec4899', category: 'apps' },
        { id: 'imager-utility', name: 'Pi Imager', icon: '💿', color: '#10b981', category: 'apps' },
        { id: 'visual-studio', name: 'Studio', icon: '🎨', color: '#db2777', category: 'apps' },
    ],

    getApp(id) {
        return this.apps.find(a => a.id === id);
    },
};

/* ─── App Content Generators ───────────────── */
const AppContent = {
    'minima-node': () => `
        <div class="app-panel">
            <h3>⬡ Minima Node Status</h3>
            <div id="minima-status">Loading...</div>
        </div>
        <div class="app-panel">
            <h3>RPC Console</h3>
            <div class="flex gap-2">
                <input type="text" id="minima-cmd" placeholder="Enter Minima command...">
                <button class="btn btn-primary" onclick="AppActions.minimaCmd()">Run</button>
            </div>
            <pre id="minima-output" class="mt-2 text-xs mono" style="max-height:200px;overflow:auto"></pre>
        </div>
    `,

    'wallet': () => `
        <div class="app-panel">
            <h3>💰 Wallet</h3>
            <div id="wallet-info">Loading...</div>
        </div>
    `,

    'maxima-messenger': () => `
        <div class="app-panel">
            <h3>💬 Maxima Messenger</h3>
            <div id="maxima-contacts">Loading contacts...</div>
        </div>
        <div class="app-panel">
            <h3>Messages</h3>
            <div id="maxima-messages">No messages</div>
        </div>
    `,

    'cluster-manager': () => `
        <div class="app-panel">
            <h3>🔗 Cluster Nodes</h3>
            <div id="cluster-nodes">Loading...</div>
        </div>
        <div class="app-panel">
            <h3>Events</h3>
            <div id="cluster-events">No events</div>
        </div>
    `,

    'system-monitor': () => `
        <div class="grid-2">
            <div class="app-panel">
                <h3>CPU Usage</h3>
                <div class="stat-bar"><div class="stat-bar-fill cpu" id="bar-cpu" style="width:0%"></div></div>
                <span class="text-xs text-muted" id="val-cpu">0%</span>
            </div>
            <div class="app-panel">
                <h3>RAM Usage</h3>
                <div class="stat-bar"><div class="stat-bar-fill ram" id="bar-ram" style="width:0%"></div></div>
                <span class="text-xs text-muted" id="val-ram">0%</span>
            </div>
            <div class="app-panel">
                <h3>Temperature</h3>
                <div class="stat-bar"><div class="stat-bar-fill temp" id="bar-temp" style="width:0%"></div></div>
                <span class="text-xs text-muted" id="val-temp">0°C</span>
            </div>
            <div class="app-panel">
                <h3>Disk Usage</h3>
                <div class="stat-bar"><div class="stat-bar-fill disk" id="bar-disk" style="width:0%"></div></div>
                <span class="text-xs text-muted" id="val-disk">0%</span>
            </div>
        </div>
    `,

    'terminal': () => `<div id="term-container" style="width:100%;height:100%"></div>`,

    'file-explorer': () => `
        <div class="app-panel">
            <div class="flex gap-2 mb-2">
                <input type="text" id="file-path" value="/" placeholder="Path...">
                <button class="btn btn-secondary" onclick="AppActions.browseFiles()">Browse</button>
            </div>
            <div id="file-list">Click Browse to list files</div>
        </div>
        <div class="app-panel">
            <h3>File Content</h3>
            <textarea id="file-content" rows="10" placeholder="Select a file to view..."></textarea>
        </div>
    `,

    'process-manager': () => `
        <div class="app-panel">
            <h3>⚙️ Running Processes</h3>
            <div id="process-list">Loading...</div>
        </div>
    `,

    'network-manager': () => `
        <div class="app-panel">
            <h3>🌐 Network Interfaces</h3>
            <div id="network-ifaces">Loading...</div>
        </div>
    `,

    'security-center': () => `
        <div class="app-panel">
            <h3>🛡️ Security Dashboard</h3>
            <div id="security-info">Loading...</div>
        </div>
    `,

    'user-manager': () => `
        <div class="app-panel">
            <h3>👥 User Accounts</h3>
            <div id="user-list">Loading...</div>
        </div>
    `,

    'device-manager': () => `
        <div class="app-panel">
            <h3>🔌 Connected Devices</h3>
            <div id="device-list">Loading...</div>
        </div>
    `,

    'power-manager': () => `
        <div class="app-panel">
            <h3>🔋 Power Management</h3>
            <div id="power-info">Loading...</div>
        </div>
    `,

    'log-viewer': () => `
        <div class="app-panel">
            <h3>📜 System Logs</h3>
            <div id="log-entries">Loading...</div>
        </div>
    `,

    'settings': () => `
        <div class="app-panel">
            <h3>⚙️ Settings</h3>
            <div class="app-stat"><span class="label">Node Alias</span>
                <input type="text" id="setting-alias" style="width:200px">
            </div>
            <div class="app-stat"><span class="label">Wallpaper</span>
                <select id="setting-wallpaper" style="width:200px">
                    <option value="carbon">Carbon</option>
                    <option value="nebula">Nebula</option>
                    <option value="minimal">Minimal</option>
                </select>
            </div>
            <button class="btn btn-primary mt-4" onclick="AppActions.saveSettings()">Save Settings</button>
        </div>
    `,

    'dapp-store': () => `
        <div class="app-panel">
            <h3>🏪 Installed DApps</h3>
            <div id="dapp-list">Loading...</div>
        </div>
        <div class="app-panel">
            <h3>Install DApp</h3>
            <div class="flex gap-2">
                <input type="text" id="dapp-url" placeholder="Enter DApp URL...">
                <button class="btn btn-primary" onclick="AppActions.installDapp()">Install</button>
            </div>
        </div>
    `,

    'ai-assistant': () => `
        <div class="app-panel">
            <h3>🤖 PiNet AI Assistant</h3>
            <div id="ai-chat" style="height:300px;overflow:auto;margin-bottom:12px"></div>
            <div class="flex gap-2">
                <input type="text" id="ai-input" placeholder="Ask PiNet AI...">
                <button class="btn btn-primary" onclick="AppActions.aiChat()">Send</button>
            </div>
        </div>
    `,

    'depai-executor': () => `
        <div class="app-panel">
            <h3>🧠 Distributed AI Executor</h3>
            <p class="text-muted text-sm">Submit AI workloads to the cluster for distributed execution.</p>
        </div>
    `,

    'imager-utility': () => `
        <div class="app-panel">
            <h3>💿 Pi Imager</h3>
            <p class="text-muted text-sm">Build and flash OS images for Raspberry Pi.</p>
            <button class="btn btn-primary mt-2" onclick="AppActions.buildImage()">Build Image</button>
        </div>
    `,

    'visual-studio': () => `
        <div class="app-panel">
            <h3>🎨 Visual Asset Studio</h3>
            <p class="text-muted text-sm">Create icons, images, and visual assets.</p>
        </div>
    `,
};

/* ─── App Actions (event handlers) ─────────── */
const AppActions = {
    async minimaCmd() {
        const cmd = document.getElementById('minima-cmd')?.value;
        if (!cmd) return;
        const output = document.getElementById('minima-output');
        if (output) output.textContent = 'Executing...';
        const result = await PiNetAPI.minimaCmd(cmd);
        if (output) output.textContent = JSON.stringify(result, null, 2);
    },

    async browseFiles() {
        const path = document.getElementById('file-path')?.value || '/';
        const list = document.getElementById('file-list');
        if (!list) return;
        list.innerHTML = 'Loading...';
        const files = await PiNetAPI.filesList(path);
        if (!files) { list.innerHTML = 'Error loading files'; return; }
        list.innerHTML = files.map(f =>
            `<div class="app-stat" style="cursor:pointer" onclick="AppActions.openFile('${f.name}', '${f.type}')">
                <span class="label">${f.type === 'dir' ? '📁' : '📄'} ${f.name}</span>
                <span class="value">${f.type === 'dir' ? '' : (f.size / 1024).toFixed(1) + ' KB'}</span>
            </div>`
        ).join('');
    },

    async openFile(name, type) {
        const basePath = document.getElementById('file-path')?.value || '/';
        const fullPath = basePath.endsWith('/') ? basePath + name : basePath + '/' + name;
        if (type === 'dir') {
            document.getElementById('file-path').value = fullPath;
            this.browseFiles();
        } else {
            const data = await PiNetAPI.filesRead(fullPath);
            if (data && document.getElementById('file-content')) {
                document.getElementById('file-content').value = data.content || '';
            }
        }
    },

    async saveSettings() {
        const alias = document.getElementById('setting-alias')?.value;
        const wallpaper = document.getElementById('setting-wallpaper')?.value;
        await PiNetAPI.saveSettings({ nodeAlias: alias, wallpaper });
    },

    async installDapp() {
        const url = document.getElementById('dapp-url')?.value;
        if (!url) return;
        await PiNetAPI.post('/api/dapps/install', { url });
        AppActions.loadDapps();
    },

    async loadDapps() {
        const list = document.getElementById('dapp-list');
        if (!list) return;
        const data = await PiNetAPI.dapps();
        if (!data || !data.dapps) { list.innerHTML = 'No DApps installed'; return; }
        list.innerHTML = data.dapps.map(d =>
            `<div class="app-stat">
                <span class="label">${d.manifest.name} (${d.manifest.version})</span>
                <span class="value">${d.status}</span>
            </div>`
        ).join('') || 'No DApps installed';
    },

    async buildImage() {
        await PiNetAPI.post('/api/build/image');
    },

    async aiChat() {
        const input = document.getElementById('ai-input');
        const chat = document.getElementById('ai-chat');
        if (!input || !chat) return;
        const msg = input.value.trim();
        if (!msg) return;

        const userRow = document.createElement('div');
        userRow.className = 'mb-2';
        const userLabel = document.createElement('strong');
        userLabel.textContent = 'You:';
        userRow.appendChild(userLabel);
        userRow.appendChild(document.createTextNode(` ${msg}`));
        chat.appendChild(userRow);

        input.value = '';

        const aiRow = document.createElement('div');
        aiRow.className = 'mb-2 text-muted';
        const aiLabel = document.createElement('strong');
        aiLabel.textContent = 'AI:';
        aiRow.appendChild(aiLabel);
        aiRow.appendChild(document.createTextNode(' AI integration requires Gemini API key configuration.'));
        chat.appendChild(aiRow);

        chat.scrollTop = chat.scrollHeight;
    },
};

/* ─── App Initializers ─────────────────────── */
const AppInitializers = {
    'minima-node': async () => {
        const el = document.getElementById('minima-status');
        if (!el) return;
        const data = await PiNetAPI.minimaStatus();
        if (data) {
            el.innerHTML = `
                <div class="app-stat"><span class="label">Status</span><span class="value">${data.status || 'Offline'}</span></div>
                <div class="app-stat"><span class="label">Block Height</span><span class="value mono">${data.blockHeight || 0}</span></div>
                <div class="app-stat"><span class="label">Peers</span><span class="value">${data.peers || 0}</span></div>
                <div class="app-stat"><span class="label">Balance</span><span class="value mono">${data.balance || 0} MINIMA</span></div>
            `;
        }
    },

    'wallet': async () => {
        const el = document.getElementById('wallet-info');
        if (!el) return;
        const data = await PiNetAPI.minimaStatus();
        if (data) {
            el.innerHTML = `
                <div class="app-stat"><span class="label">Balance</span><span class="value mono">${data.balance || 0} MINIMA</span></div>
                <div class="app-stat"><span class="label">Status</span><span class="value">${data.status || 'Offline'}</span></div>
            `;
        }
    },

    'maxima-messenger': async () => {
        const el = document.getElementById('maxima-contacts');
        if (!el) return;
        const data = await PiNetAPI.maximaContacts();
        if (data && data.contacts && data.contacts.length) {
            el.innerHTML = data.contacts.map(c =>
                `<div class="app-stat"><span class="label">${c.name}</span><span class="value">${c.status}</span></div>`
            ).join('');
        } else {
            el.innerHTML = '<span class="text-muted text-sm">No contacts found</span>';
        }
    },

    'cluster-manager': async () => {
        const el = document.getElementById('cluster-nodes');
        if (!el) return;
        const data = await PiNetAPI.clusterNodes();
        if (data && data.length) {
            el.innerHTML = data.map(n =>
                `<div class="app-stat">
                    <span class="label">${n.name} (${n.ip})</span>
                    <span class="value" style="color:${n.status === 'online' ? '#22c55e' : '#ef4444'}">${n.status}</span>
                </div>`
            ).join('');
        }
    },

    'system-monitor': async () => {
        const update = async () => {
            const data = await PiNetAPI.systemStats();
            if (!data) return;
            const set = (id, val) => {
                const bar = document.getElementById(`bar-${id}`);
                const txt = document.getElementById(`val-${id}`);
                if (bar) bar.style.width = `${Math.min(100, val)}%`;
                if (txt) txt.textContent = id === 'temp' ? `${val.toFixed(1)}°C` : `${val.toFixed(1)}%`;
            };
            set('cpu', data.cpu);
            set('ram', data.ram);
            set('temp', data.temp);
            set('disk', data.disk);
        };
        update();
        const interval = setInterval(update, 5000);
        // Store interval for cleanup
        const win = document.getElementById('win-system-monitor');
        if (win) win._interval = interval;
    },

    'terminal': (appId) => {
        Terminal.connect('term-container');
    },

    'file-explorer': () => { AppActions.browseFiles(); },

    'process-manager': async () => {
        const el = document.getElementById('process-list');
        if (!el) return;
        const data = await PiNetAPI.processes();
        if (data && data.processes) {
            el.innerHTML = `<div class="text-xs text-muted mb-2">${data.count} processes</div>` +
                data.processes.slice(0, 50).map(p =>
                    `<div class="app-stat"><span class="label">${p.name} (PID ${p.pid})</span><span class="value">${p.status}</span></div>`
                ).join('');
        }
    },

    'network-manager': async () => {
        const el = document.getElementById('network-ifaces');
        if (!el) return;
        const data = await PiNetAPI.networkInterfaces();
        if (data && data.interfaces) {
            el.innerHTML = data.interfaces.map(i =>
                `<div class="app-stat"><span class="label">${i.name}</span><span class="value" style="color:${i.isUp ? '#22c55e' : '#ef4444'}">${i.isUp ? 'UP' : 'DOWN'}</span></div>`
            ).join('');
        }
    },

    'security-center': async () => {
        const el = document.getElementById('security-info');
        if (!el) return;
        const data = await PiNetAPI.securityDashboard();
        if (data) {
            el.innerHTML = `
                <div class="app-stat"><span class="label">Score</span><span class="value">${data.overallScore}/100</span></div>
                <div class="app-stat"><span class="label">Active Policies</span><span class="value">${data.activePolicies}</span></div>
                <div class="app-stat"><span class="label">Threats</span><span class="value">${data.threats}</span></div>
                <div class="app-stat"><span class="label">Firewall</span><span class="value">${data.firewallStatus}</span></div>
            `;
        }
    },

    'user-manager': async () => {
        const el = document.getElementById('user-list');
        if (!el) return;
        const data = await PiNetAPI.users();
        if (data && data.users) {
            el.innerHTML = data.users.map(u =>
                `<div class="app-stat"><span class="label">${u.username} (UID ${u.uid})</span><span class="value">${u.fullName}</span></div>`
            ).join('');
        }
    },

    'device-manager': async () => {
        const el = document.getElementById('device-list');
        if (!el) return;
        const data = await PiNetAPI.devices();
        if (data && data.devices) {
            el.innerHTML = data.devices.map(d =>
                `<div class="app-stat"><span class="label">${d.name}</span><span class="value">${d.status}</span></div>`
            ).join('');
        }
    },

    'power-manager': async () => {
        const el = document.getElementById('power-info');
        if (!el) return;
        const data = await PiNetAPI.powerInfo();
        if (data && data.info) {
            el.innerHTML = `
                <div class="app-stat"><span class="label">State</span><span class="value">${data.info.state}</span></div>
                <div class="app-stat"><span class="label">Governor</span><span class="value">${data.info.governor}</span></div>
                <div class="app-stat"><span class="label">CPU Freq</span><span class="value mono">${data.info.cpuFreq || 0} MHz</span></div>
            `;
        }
    },

    'log-viewer': async () => {
        const el = document.getElementById('log-entries');
        if (!el) return;
        const data = await PiNetAPI.syslog(50);
        if (data && data.logs && data.logs.length) {
            el.innerHTML = data.logs.map(l => `<div class="text-xs mono">${l}</div>`).join('');
        } else {
            el.innerHTML = '<span class="text-muted text-sm">No log entries available</span>';
        }
    },

    'settings': async () => {
        const data = await PiNetAPI.settings();
        if (data) {
            const alias = document.getElementById('setting-alias');
            const wp = document.getElementById('setting-wallpaper');
            if (alias) alias.value = data.nodeAlias || '';
            if (wp) wp.value = data.wallpaper || 'carbon';
        }
    },

    'dapp-store': () => { AppActions.loadDapps(); },
};

/* ─── Desktop Icon Rendering ───────────────── */
function renderDesktop() {
    const grid = document.getElementById('app-grid');
    if (!grid) return;
    grid.innerHTML = '';
    PiNetApps.apps.forEach(app => {
        const icon = document.createElement('div');
        icon.className = 'app-icon';
        icon.innerHTML = `
            <div class="app-icon-circle" style="background:${app.color}">${app.icon}</div>
            <span class="app-icon-label">${app.name}</span>
        `;
        icon.addEventListener('dblclick', () => openApp(app.id));
        // Touch support
        let tapTimeout;
        icon.addEventListener('touchend', (e) => {
            if (tapTimeout) { clearTimeout(tapTimeout); tapTimeout = null; openApp(app.id); }
            else { tapTimeout = setTimeout(() => { tapTimeout = null; }, 300); }
        });
        grid.appendChild(icon);
    });
}

/* ─── Open App ─────────────────────────────── */
function openApp(appId) {
    const app = PiNetApps.getApp(appId);
    if (!app) return;
    const contentFn = AppContent[appId];
    const content = contentFn ? contentFn() : `<div class="text-muted p-4">App: ${app.name}</div>`;

    WindowManager.open(appId, app.name, content, {
        onInit: () => {
            const init = AppInitializers[appId];
            if (init) init(appId);
        },
        onClose: () => {
            // Cleanup intervals
            const win = document.getElementById(`win-${appId}`);
            if (win && win._interval) clearInterval(win._interval);
        },
    });
}

/* ─── Stats Polling ────────────────────────── */
async function pollStats() {
    const data = await PiNetAPI.systemStats();
    if (data) {
        document.getElementById('stat-cpu').textContent = `${data.cpu.toFixed(1)}%`;
        document.getElementById('stat-ram').textContent = `${data.ram.toFixed(1)}%`;
        document.getElementById('stat-temp').textContent = `${data.temp.toFixed(0)}°C`;
        document.getElementById('stat-disk').textContent = `${data.disk.toFixed(1)}%`;
    }
    const minima = await PiNetAPI.minimaStatus();
    if (minima) {
        document.getElementById('stat-block').textContent = minima.blockHeight || '0';
        document.getElementById('stat-peers').textContent = minima.peers || '0';
    }
}

/* ─── Clock ────────────────────────────────── */
function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent =
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ─── Boot Sequence ────────────────────────── */
async function boot() {
    const progress = document.getElementById('boot-progress');
    const status = document.getElementById('boot-status');
    const splash = document.getElementById('boot-splash');

    const steps = [
        [10, 'Loading kernel modules...'],
        [25, 'Initializing system services...'],
        [40, 'Starting network stack...'],
        [55, 'Connecting to Minima node...'],
        [70, 'Loading desktop environment...'],
        [85, 'Mounting filesystems...'],
        [95, 'Starting PiNet Desktop...'],
        [100, 'Ready.'],
    ];

    for (const [pct, msg] of steps) {
        progress.style.width = pct + '%';
        status.textContent = msg;
        await new Promise(r => setTimeout(r, 250));
    }

    await new Promise(r => setTimeout(r, 300));
    splash.classList.add('fade-out');
    setTimeout(() => splash.style.display = 'none', 500);

    // Initialize desktop
    renderDesktop();
    updateClock();
    setInterval(updateClock, 1000);
    pollStats();
    setInterval(pollStats, 5000);
}

/* ─── Start ────────────────────────────────── */
document.addEventListener('DOMContentLoaded', boot);
