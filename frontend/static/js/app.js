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
        { id: 'sensors', name: 'Sensors', icon: '🌡️', color: '#0ea5e9', category: 'system' },
        { id: 'llm-gateway', name: 'LLM Gateway', icon: '🧠', color: '#8b5cf6', category: 'apps' },
        { id: 'lxc-quotas', name: 'LXC Quotas', icon: '📦', color: '#f59e0b', category: 'system' },
        { id: 'attestation', name: 'Attestation', icon: '🔐', color: '#ef4444', category: 'system' },
        { id: 'enclaves', name: 'Enclaves', icon: '🔲', color: '#06b6d4', category: 'system' },
        { id: 'zk-prover', name: 'ZK Prover', icon: '🧾', color: '#a855f7', category: 'apps' },
        { id: 'marketplace', name: 'Marketplace', icon: '🏪', color: '#10b981', category: 'apps' },
        { id: 'ssl-manager', name: 'SSL/TLS', icon: '🔒', color: '#06b6d4', category: 'system' },
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
            <p class="text-muted text-sm">Submit a shell workload to a peer node over the Maxima cluster bus.</p>
            <div class="flex gap-2 mt-2">
                <select id="depai-node" aria-label="Target node" style="flex:1"><option value="">Loading nodes…</option></select>
                <input type="text" id="depai-cmd" aria-label="Command to execute" placeholder="command (e.g. uname -a)" style="flex:2">
                <button class="btn btn-primary" onclick="AppActions.depaiSubmit()">Submit</button>
            </div>
            <pre id="depai-output" class="mono text-sm mt-2" style="max-height:240px;overflow:auto"></pre>
        </div>
    `,

    'imager-utility': () => `
        <div class="app-panel">
            <h3>💿 Pi Imager</h3>
            <p class="text-muted text-sm">Build and flash OS images for Raspberry Pi.</p>
            <button class="btn btn-primary mt-2" onclick="AppActions.buildImage()">Build Image</button>
        </div>
    `,

    'sensors': () => `
        <div class="app-panel">
            <h3>🌡️ Custom Sensors</h3>
            <p class="text-muted text-sm">User-built sensors on I2C / GPIO / SPI / 1-Wire / UART. Pi Zero 2 W optimized (max 4 sensors, 15s min poll).</p>
            <div id="sensor-platform" class="mb-2"></div>
            <div id="sensor-list" class="mb-2">Loading sensors...</div>
            <details class="mt-2">
                <summary class="text-sm cursor-pointer">Register new sensor</summary>
                <div class="mt-2" style="display:grid;gap:6px;max-width:360px">
                    <input id="sensor-id" class="input" placeholder="Sensor ID (e.g. bme280-living)">
                    <input id="sensor-name" class="input" placeholder="Name (e.g. Living Room Temp)">
                    <select id="sensor-kind" class="input">
                        <option value="temperature">Temperature</option>
                        <option value="humidity">Humidity</option>
                        <option value="pressure">Pressure</option>
                        <option value="light">Light</option>
                        <option value="soil_moisture">Soil Moisture</option>
                        <option value="air_quality">Air Quality</option>
                        <option value="proximity">Proximity</option>
                        <option value="custom">Custom</option>
                    </select>
                    <select id="sensor-bus" class="input">
                        <option value="i2c">I2C</option>
                        <option value="gpio">GPIO</option>
                        <option value="spi">SPI</option>
                        <option value="1-wire">1-Wire</option>
                        <option value="adc">ADC</option>
                        <option value="uart">UART</option>
                    </select>
                    <input id="sensor-address" class="input" placeholder="I2C address (e.g. 0x76) or 1-Wire ID">
                    <input id="sensor-pin" class="input" type="number" placeholder="GPIO pin (e.g. 4)">
                    <input id="sensor-unit" class="input" placeholder="Unit (e.g. °C, %, hPa)">
                    <input id="sensor-poll" class="input" type="number" value="15" placeholder="Poll interval (seconds)">
                    <button class="btn btn-primary" onclick="AppActions.addSensor()">Register Sensor</button>
                </div>
            </details>
            <button class="btn btn-secondary mt-2" onclick="AppActions.readAllSensors()">Read All Sensors</button>
            <div id="sensor-readings" class="mt-2"></div>
        </div>
    `,

    'llm-gateway': () => `
        <div class="app-panel">
            <h3>🧠 On-Device LLM Gateway</h3>
            <p class="text-muted text-sm">Local LLM inference via Ollama (llama.cpp/GGUF) with Hailo-8L acceleration. Falls back to Gemini cloud.</p>
            <div id="llm-status" class="mb-2">Loading status...</div>
            <div id="llm-models" class="mb-2"></div>
            <div style="display:grid;gap:6px;max-width:500px">
                <input id="llm-prompt" class="input" placeholder="Enter your prompt..." style="min-height:60px">
                <input id="llm-model" class="input" placeholder="Model (default: llama3.2:3b)">
                <input id="llm-system" class="input" placeholder="System prompt (optional)">
                <div style="display:flex;gap:8px">
                    <input id="llm-temp" class="input" type="number" value="0.7" step="0.1" style="max-width:80px" placeholder="Temp">
                    <input id="llm-max-tokens" class="input" type="number" value="512" style="max-width:100px" placeholder="Max tokens">
                </div>
                <button class="btn btn-primary" onclick="AppActions.llmChat()">Generate</button>
            </div>
            <div id="llm-output" class="mt-2" style="white-space:pre-wrap;font-family:monospace;font-size:13px;max-height:300px;overflow-y:auto"></div>
        </div>
    `,

    'lxc-quotas': () => `
        <div class="app-panel">
            <h3>📦 Multi-Tenant LXC Quotas</h3>
            <p class="text-muted text-sm">Per-tenant resource limits for LXC containers (CPU, RAM, disk, IO, processes).</p>
            <div id="lxc-status" class="mb-2">Loading status...</div>
            <div id="lxc-tenants" class="mb-2"></div>
            <details class="mt-2">
                <summary class="text-sm cursor-pointer">Create new tenant</summary>
                <div class="mt-2" style="display:grid;gap:6px;max-width:360px">
                    <input id="lxc-tenant-id" class="input" placeholder="Tenant ID (e.g. team-alpha)">
                    <input id="lxc-cpu" class="input" type="number" value="50" placeholder="CPU limit (%)">
                    <input id="lxc-ram" class="input" type="number" value="512" placeholder="RAM limit (MB)">
                    <input id="lxc-disk" class="input" type="number" value="10" placeholder="Disk limit (GB)">
                    <input id="lxc-io" class="input" type="number" value="1000" placeholder="IO IOPS">
                    <input id="lxc-procs" class="input" type="number" value="512" placeholder="Max processes">
                    <button class="btn btn-primary" onclick="AppActions.createTenant()">Create Tenant</button>
                </div>
            </details>
            <button class="btn btn-secondary mt-2" onclick="AppActions.loadLXCUsage()">Refresh Usage</button>
            <div id="lxc-usage" class="mt-2"></div>
        </div>
    `,

    'attestation': () => `
        <div class="app-panel">
            <h3>🔐 Formal Remote Attestation</h3>
            <p class="text-muted text-sm">TPM 2.0 PCR-based attestation anchored to the Minima blockchain (v2.0.0).</p>
            <div id="attestation-status" class="mb-2">Loading status...</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-primary" onclick="AppActions.createAttestation()">Create Attestation</button>
                <button class="btn btn-secondary" onclick="AppActions.loadAttestations()">Load Records</button>
            </div>
            <div id="attestation-records" class="mt-2"></div>
        </div>
    `,

    'enclaves': () => `
        <div class="app-panel">
            <h3>🔲 Confidential Enclaves</h3>
            <p class="text-muted text-sm">Arm CCA / RISC-V AP-TEE confidential computing enclaves (v3.0.0).</p>
            <div id="enclave-list">Loading...</div>
        </div>
        <div class="app-panel">
            <div class="flex gap-2"><input type="text" id="enclave-name" placeholder="Enclave name" style="flex:1"><input type="number" id="enclave-mem" placeholder="MB" value="1024" style="width:80px"><button class="btn btn-primary" onclick="AppActions.createEnclave()">Create</button></div>
        </div>
    `,

    'zk-prover': () => `
        <div class="app-panel">
            <h3>🧾 ZK Prover</h3>
            <p class="text-muted text-sm">Generate and verify zero-knowledge proofs (zkVM, v3.0.0).</p>
            <div id="zk-proof-list">Loading...</div>
        </div>
        <div class="app-panel">
            <div class="flex gap-2"><textarea id="zk-program" placeholder="Program source (e.g. risc0 guest code)..." style="width:100%;height:80px;font-family:monospace;font-size:12px"></textarea></div>
            <div class="flex gap-2"><button class="btn btn-primary" onclick="AppActions.createProof()">Generate Proof</button><button class="btn btn-secondary" onclick="AppActions.refreshProofs()">Refresh</button></div>
            <div id="zk-result" class="mt-2 text-sm"></div>
        </div>
    `,

    'ssl-manager': () => `
        <div class="app-panel">
            <h3>🔒 SSL/TLS Manager</h3>
            <p class="text-muted text-sm">Manage TLS certificates, HSTS, and security headers (v3.0.0).</p>
            <div id="ssl-status">Loading...</div>
        </div>
        <div class="app-panel">
            <h3>Certificate Management</h3>
            <div class="flex gap-2"><input type="text" id="ssl-hosts" placeholder="Hosts (comma-separated)" value="localhost,127.0.0.1,::1" style="flex:1"><button class="btn btn-primary" onclick="AppActions.sslGenerate()">Generate Certificates</button></div>
            <div class="flex gap-2 mt-2"><button class="btn btn-secondary" onclick="AppActions.sslInstallCa()">Install CA to System</button><button class="btn btn-danger" onclick="AppActions.sslDelete()">Delete Certificates</button><button class="btn btn-secondary" onclick="AppActions.refreshSsl()">Refresh</button></div>
            <div id="ssl-result" class="mt-2 text-sm"></div>
        </div>
    `,

    'marketplace': () => `
        <div class="app-panel">
            <h3>🏪 Edge Compute Marketplace</h3>
            <p class="text-muted text-sm">Publish and lease edge compute resources on the decentralized marketplace (v3.0.0).</p>
            <div id="marketplace-listings">Loading...</div>
        </div>
        <div class="app-panel">
            <div class="flex gap-2"><input type="text" id="mp-name" placeholder="Listing name" style="flex:1"><input type="text" id="mp-price" placeholder="Price/hr" value="0.01" style="width:80px"><input type="number" id="mp-cpu" placeholder="CPUs" value="4" style="width:60px"><input type="number" id="mp-ram" placeholder="RAM GB" value="8" style="width:70px"><button class="btn btn-primary" onclick="AppActions.createListing()">Publish</button></div>
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

    async loadSensors() {
        const platform = await PiNetAPI.get('/api/sensors/platform');
        const plEl = document.getElementById('sensor-platform');
        if (plEl && platform) {
            plEl.innerHTML = `<div class="app-stat"><span class="label">Platform: ${platform.label || platform.platform}</span><span class="value">Max ${platform.maxSensors} sensors · min ${platform.minPollInterval}s poll</span></div>`;
        }
        const result = await PiNetAPI.get('/api/sensors');
        const list = document.getElementById('sensor-list');
        if (!list) return;
        if (!result || !result.sensors || result.sensors.length === 0) {
            list.innerHTML = '<p class="text-muted text-sm">No custom sensors registered.</p>';
            return;
        }
        list.innerHTML = result.sensors.map(s =>
            `<div class="app-stat" style="cursor:pointer" onclick="AppActions.readSensor('${s.id}')">
                <span class="label">🌡️ ${s.name} (${s.kind}, ${s.bus})</span>
                <span class="value">${s.enabled ? '✅' : '⛔'} ${s.pollInterval}s</span>
            </div>`
        ).join('');
    },

    async addSensor() {
        const payload = {
            id: document.getElementById('sensor-id')?.value,
            name: document.getElementById('sensor-name')?.value,
            kind: document.getElementById('sensor-kind')?.value,
            bus: document.getElementById('sensor-bus')?.value,
            address: document.getElementById('sensor-address')?.value || null,
            pin: parseInt(document.getElementById('sensor-pin')?.value) || null,
            unit: document.getElementById('sensor-unit')?.value || '',
            pollInterval: parseInt(document.getElementById('sensor-poll')?.value) || 15,
        };
        if (!payload.id || !payload.name) { alert('Sensor ID and name are required'); return; }
        const result = await PiNetAPI.post('/api/sensors', payload);
        if (result && result.success) {
            AppActions.loadSensors();
        } else {
            alert('Failed to register sensor: ' + (result?.detail || 'unknown error'));
        }
    },

    async readSensor(sensorId) {
        const reading = await PiNetAPI.get(`/api/sensors/${sensorId}/reading`);
        const el = document.getElementById('sensor-readings');
        if (el && reading) {
            el.innerHTML = `<div class="app-stat"><span class="label">${reading.sensorId}</span><span class="value">${reading.value} ${reading.unit || ''}</span></div>`;
        }
    },

    async readAllSensors() {
        const result = await PiNetAPI.get('/api/sensors/readings/all');
        const el = document.getElementById('sensor-readings');
        if (!el || !result) return;
        if (!result.readings || result.readings.length === 0) {
            el.innerHTML = '<p class="text-muted text-sm">No enabled sensors to read.</p>';
            return;
        }
        el.innerHTML = result.readings.map(r =>
            `<div class="app-stat"><span class="label">${r.sensorId}</span><span class="value">${r.value} ${r.unit || ''}${r.error ? ' ⚠️ ' + r.error : ''}</span></div>`
        ).join('');
    },

    async llmChat() {
        const prompt = document.getElementById('llm-prompt')?.value;
        if (!prompt) return;
        const output = document.getElementById('llm-output');
        if (output) output.textContent = 'Generating...';
        const payload = {
            prompt,
            model: document.getElementById('llm-model')?.value || '',
            system: document.getElementById('llm-system')?.value || '',
            temperature: parseFloat(document.getElementById('llm-temp')?.value || '0.7'),
            maxTokens: parseInt(document.getElementById('llm-max-tokens')?.value || '512'),
        };
        const result = await PiNetAPI.post('/api/llm/chat', payload);
        if (output) {
            if (result && result.text) {
                output.textContent = result.text;
            } else {
                output.textContent = 'Error: ' + (result?.detail || 'No response');
            }
        }
    },

    async createTenant() {
        const payload = {
            tenantId: document.getElementById('lxc-tenant-id')?.value,
            cpuLimit: parseInt(document.getElementById('lxc-cpu')?.value || '50'),
            ramLimitMb: parseInt(document.getElementById('lxc-ram')?.value || '512'),
            diskLimitGb: parseInt(document.getElementById('lxc-disk')?.value || '10'),
            ioIops: parseInt(document.getElementById('lxc-io')?.value || '1000'),
            processesMax: parseInt(document.getElementById('lxc-procs')?.value || '512'),
        };
        if (!payload.tenantId) { alert('Tenant ID is required'); return; }
        const result = await PiNetAPI.post('/api/lxc/tenants', payload);
        if (result && result.success) {
            AppActions.loadLXCTenants();
        } else {
            alert('Failed: ' + (result?.detail || 'unknown error'));
        }
    },

    async loadLXCTenants() {
        const result = await PiNetAPI.get('/api/lxc/tenants');
        const el = document.getElementById('lxc-tenants');
        if (!el || !result) return;
        if (!result.tenants || result.tenants.length === 0) {
            el.innerHTML = '<p class="text-muted text-sm">No LXC tenants created.</p>';
            return;
        }
        el.innerHTML = result.tenants.map(t =>
            `<div class="app-stat"><span class="label">📦 ${t.tenantId}</span><span class="value">CPU ${t.cpuLimit}% · RAM ${t.ramLimitMb}MB · Disk ${t.diskLimitGb}GB</span></div>`
        ).join('');
    },

    async loadLXCUsage() {
        const result = await PiNetAPI.get('/api/lxc/usage');
        const el = document.getElementById('lxc-usage');
        if (!el || !result) return;
        if (!result.usages || result.usages.length === 0) {
            el.innerHTML = '<p class="text-muted text-sm">No tenant usage data.</p>';
            return;
        }
        el.innerHTML = result.usages.map(u =>
            `<div class="app-stat"><span class="label">${u.tenantId}</span><span class="value">CPU ${u.cpuPercent.toFixed(1)}% · RAM ${u.ramUsedMb.toFixed(1)}MB · Procs ${u.processes}</span></div>`
        ).join('');
    },

    async createAttestation() {
        const result = await PiNetAPI.post('/api/attestation/create', { nodeId: 'pinet-alpha' });
        const el = document.getElementById('attestation-records');
        if (el && result) {
            el.innerHTML = `<div class="app-stat"><span class="label">🔐 ${result.attestationId}</span><span class="value">${result.timestamp}</span></div>`;
        }
    },

    async loadAttestations() {
        const result = await PiNetAPI.get('/api/attestation');
        const el = document.getElementById('attestation-records');
        if (!el || !result) return;
        if (!result.attestations || result.attestations.length === 0) {
            el.innerHTML = '<p class="text-muted text-sm">No attestation records.</p>';
            return;
        }
        el.innerHTML = result.attestations.map(a =>
            `<div class="app-stat"><span class="label">🔐 ${a.attestationId}</span><span class="value">${a.verified ? '✅' : '⏳'} ${a.timestamp}</span></div>`
        ).join('');
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
        input.disabled = true;

        const aiRow = document.createElement('div');
        aiRow.className = 'mb-2';
        const aiLabel = document.createElement('strong');
        aiLabel.textContent = 'AI:';
        aiRow.appendChild(aiLabel);
        const aiText = document.createTextNode(' …');
        aiRow.appendChild(aiText);
        chat.appendChild(aiRow);
        chat.scrollTop = chat.scrollHeight;

        try {
            const resp = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: msg }),
            });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok && data && typeof data.text === 'string') {
                aiText.nodeValue = ` ${data.text}`;
            } else {
                aiRow.classList.add('text-muted');
                aiText.nodeValue = ` Error: ${(data && data.detail) || `HTTP ${resp.status}`}`;
            }
        } catch (err) {
            aiRow.classList.add('text-muted');
            aiText.nodeValue = ` Error: ${err.message || err}`;
        } finally {
            input.disabled = false;
            chat.scrollTop = chat.scrollHeight;
        }
    },

    async depaiSubmit() {
        const sel = document.getElementById('depai-node');
        const cmdEl = document.getElementById('depai-cmd');
        const out = document.getElementById('depai-output');
        if (!sel || !cmdEl || !out) return;
        const targetNodeId = sel.value;
        const command = (cmdEl.value || '').trim();
        if (!targetNodeId || !command) {
            out.textContent = 'Select a node and enter a command.';
            return;
        }
        out.textContent = 'Submitting…';
        const data = await PiNetAPI.post('/api/cluster/exec', { targetNodeId, command });
        out.textContent = data ? JSON.stringify(data, null, 2) : 'Failed to submit workload.';
    },

    // ─── v3.0.0: Enclaves ─────────────────────────────────────────────────
    async createEnclave() {
        const name = document.getElementById('enclave-name')?.value;
        const mem = parseInt(document.getElementById('enclave-mem')?.value) || 1024;
        if (!name) { alert('Enclave name required'); return; }
        const result = await PiNetAPI.enclaveCreate({ name, memoryMb: mem, teeType: 'cca' });
        if (result) { AppActions.refreshEnclaves(); }
    },

    async refreshEnclaves() {
        const data = await PiNetAPI.enclaves();
        const el = document.getElementById('enclave-list');
        if (!el) return;
        if (!data || !data.enclaves || !data.enclaves.length) {
            el.innerHTML = '<p class="text-muted text-sm">No enclaves. Create one above.</p>';
            return;
        }
        el.innerHTML = data.enclaves.map(e =>
            `<div class="app-stat"><span class="label">🔲 ${e.name} (${e.enclaveId.slice(0,16)}...)</span><span class="value" style="color:${e.status === 'running' || e.status === 'attested' ? '#22c55e' : '#ef4444'}">${e.status}</span></div>`
        ).join('');
    },

    async attestEnclave(enclaveId) {
        const result = await PiNetAPI.enclaveAttest(enclaveId);
        if (result) AppActions.refreshEnclaves();
    },

    async stopEnclave(enclaveId) {
        await PiNetAPI.enclaveStop(enclaveId);
        AppActions.refreshEnclaves();
    },

    // ─── v3.0.0: ZK Proofs ──────────────────────────────────────────────────
    async createProof() {
        const program = document.getElementById('zk-program')?.value;
        if (!program) { alert('Program source required'); return; }
        const result = await PiNetAPI.zkProofCreate({ programSource: program, proverBackend: 'risc0' });
        const el = document.getElementById('zk-result');
        if (el && result) {
            el.innerHTML = `<div class="text-xs mono">Proof: ${result.proofId}<br>Hash: ${result.programHash.slice(0,32)}...</div>`;
        }
        AppActions.refreshProofs();
    },

    async refreshProofs() {
        const data = await PiNetAPI.zkProofs();
        const el = document.getElementById('zk-proof-list');
        if (!el) return;
        if (!data || !data.proofs || !data.proofs.length) {
            el.innerHTML = '<p class="text-muted text-sm">No proofs generated.</p>';
            return;
        }
        el.innerHTML = data.proofs.map(p =>
            `<div class="app-stat"><span class="label">🧾 ${p.proofId.slice(0,24)}...</span><span class="value">${p.verified ? '✅ Verified' : '⏳ Pending'}</span></div>`
        ).join('');
    },

    // ─── v3.0.0: Marketplace ────────────────────────────────────────────────
    async createListing() {
        const name = document.getElementById('mp-name')?.value;
        const price = document.getElementById('mp-price')?.value || '0.01';
        const cpu = parseInt(document.getElementById('mp-cpu')?.value) || 4;
        const ram = parseInt(document.getElementById('mp-ram')?.value) || 8;
        if (!name) { alert('Listing name required'); return; }
        await PiNetAPI.marketplaceListingCreate({ name, pricePerHour: price, cpuCores: cpu, ramGb: ram, nodeId: 'localhost' });
        AppActions.refreshListings();
    },

    // ─── v3.0.0: SSL/TLS Manager ─────────────────────────────────────────────
    async sslGenerate() {
        const hosts = document.getElementById('ssl-hosts')?.value || 'localhost,127.0.0.1,::1';
        const el = document.getElementById('ssl-result');
        if (el) el.textContent = 'Generating certificates...';
        const data = await PiNetAPI.sslGenerate(hosts.split(',').map(h => h.trim()));
        if (el) el.textContent = data ? `Certificates generated: ${data.cert_path || 'success'}` : 'Generation failed';
        AppActions.refreshSsl();
    },

    async sslInstallCa() {
        const el = document.getElementById('ssl-result');
        if (el) el.textContent = 'Installing CA to system trust store...';
        const data = await PiNetAPI.sslInstallCa();
        if (el) el.textContent = data ? (data.message || 'CA installed') : 'Install failed';
    },

    async sslDelete() {
        if (!confirm('Delete all SSL certificates? This will disable HTTPS.')) return;
        const data = await PiNetAPI.sslCertsDelete();
        const el = document.getElementById('ssl-result');
        if (el) el.textContent = data ? 'Certificates deleted' : 'Delete failed';
        AppActions.refreshSsl();
    },

    async refreshSsl() {
        const data = await PiNetAPI.sslStatus();
        const el = document.getElementById('ssl-status');
        if (!el) return;
        if (!data) {
            el.innerHTML = '<p class="text-muted text-sm">Could not load SSL status.</p>';
            return;
        }
        const hsts = data.hsts || {};
        const cert = data.certificate || {};
        el.innerHTML = `
            <div class="app-stat"><span class="label">SSL/TLS</span><span class="value">${data.ssl_enabled ? '✅ Enabled' : '❌ Disabled'}</span></div>
            <div class="app-stat"><span class="label">HSTS</span><span class="value">${hsts.enabled ? '✅ Enabled' : '❌ Disabled'}</span></div>
            <div class="app-stat"><span class="label">HSTS Max-Age</span><span class="value mono">${hsts.max_age || 31536000}s</span></div>
            <div class="app-stat"><span class="label">Provider</span><span class="value">${data.provider || 'none'}</span></div>
            <div class="app-stat"><span class="label">Certificate</span><span class="value mono">${cert.subject || 'Not generated'}</span></div>
            <div class="app-stat"><span class="label">Issuer</span><span class="value">${cert.issuer || 'N/A'}</span></div>
            <div class="app-stat"><span class="label">Valid Until</span><span class="value">${cert.not_after || 'N/A'}</span></div>
            <div class="app-stat"><span class="label">SANs</span><span class="value mono text-sm">${(cert.subject_alt_names || []).join(', ') || 'N/A'}</span></div>
        `;
    },

    async refreshListings() {
        const data = await PiNetAPI.marketplaceListings();
        const el = document.getElementById('marketplace-listings');
        if (!el) return;
        if (!data || !data.listings || !data.listings.length) {
            el.innerHTML = '<p class="text-muted text-sm">No listings. Publish your compute above.</p>';
            return;
        }
        el.innerHTML = data.listings.map(l =>
            `<div class="app-stat"><span class="label">🏪 ${l.name} (${l.cpuCores} CPU / ${l.ramGb} GB RAM)</span><span class="value">${l.pricePerHour}/hr · ${l.status}</span></div>`
        ).join('');
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

    'depai-executor': async () => {
        const sel = document.getElementById('depai-node');
        if (!sel) return;
        const data = await PiNetAPI.clusterNodes();
        const list = (data && Array.isArray(data.nodes)) ? data.nodes : [];
        sel.innerHTML = '';
        if (!list.length) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No peer nodes discovered';
            sel.appendChild(opt);
            return;
        }
        for (const n of list) {
            const opt = document.createElement('option');
            opt.value = n.id || '';
            opt.textContent = `${n.name || n.id || 'node'} (${n.ip || 'IP unavailable'})`;
            sel.appendChild(opt);
        }
    },

    'enclaves': async () => { AppActions.refreshEnclaves(); },
    'zk-prover': async () => { AppActions.refreshProofs(); },
    'marketplace': async () => { AppActions.refreshListings(); },
    'ssl-manager': async () => { AppActions.refreshSsl(); },
};

/* ─── Desktop Icon Rendering ───────────────── */
const CATEGORY_ORDER = [
    { id: 'blockchain', label: 'Web3 & Minima' },
    { id: 'system',     label: 'System' },
    { id: 'apps',       label: 'Apps' },
    { id: 'config',     label: 'Settings' },
];

function renderDesktop() {
    const grid = document.getElementById('app-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const byCategory = {};
    for (const cat of CATEGORY_ORDER) byCategory[cat.id] = [];
    for (const app of PiNetApps.apps) {
        const bucket = byCategory[app.category] || (byCategory[app.category] = []);
        bucket.push(app);
    }

    for (const cat of CATEGORY_ORDER) {
        const apps = byCategory[cat.id];
        if (!apps || !apps.length) continue;

        const section = document.createElement('section');
        section.className = 'app-category';
        section.setAttribute('aria-label', cat.label);

        const heading = document.createElement('h2');
        heading.className = 'app-category-title';
        heading.textContent = cat.label;
        section.appendChild(heading);

        const row = document.createElement('div');
        // reuse the grid layout class for inner rows
        row.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,88px);gap:16px;justify-content:start';

        for (const app of apps) {
            const icon = document.createElement('button');
            icon.type = 'button';
            icon.className = 'app-icon';
            icon.setAttribute('aria-label', `Open ${app.name}`);
            icon.innerHTML = `
                <span class="app-icon-circle" style="background:${app.color}" aria-hidden="true">${app.icon}</span>
                <span class="app-icon-label">${app.name}</span>
            `;
            // Single-click and keyboard activation open the app.
            // Double-click also works for users who expect it.
            icon.addEventListener('click', () => openApp(app.id));
            icon.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openApp(app.id);
                }
            });
            // Touch support
            let tapTimeout;
            icon.addEventListener('touchend', () => {
                if (tapTimeout) { clearTimeout(tapTimeout); tapTimeout = null; openApp(app.id); }
                else { tapTimeout = setTimeout(() => { tapTimeout = null; }, 300); }
            });
            row.appendChild(icon);
        }
        section.appendChild(row);
        grid.appendChild(section);
    }
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

/* ─── Global Keyboard Shortcuts ────────────── */
function setupGlobalKeys() {
    document.addEventListener('keydown', (e) => {
        // Escape closes the front-most window (when focus is not in an editable field)
        if (e.key === 'Escape') {
            const tag = (e.target && e.target.tagName) || '';
            const editable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable);
            if (editable) return;
            const top = WindowManager.topActiveAppId();
            if (top) {
                e.preventDefault();
                WindowManager.close(top);
            }
        }
    });
}

/* ─── Boot Sequence ────────────────────────── */
async function boot() {
    const progress = document.getElementById('boot-progress');
    const progressbar = document.getElementById('boot-progressbar');
    const status = document.getElementById('boot-status');
    const splash = document.getElementById('boot-splash');

    const steps = [
        [10, 'Loading kernel modules...'],
        [25, 'Starting Python runtime...'],
        [40, 'Initializing FastAPI services...'],
        [55, 'Connecting to Minima node...'],
        [70, 'Mounting filesystems...'],
        [85, 'Loading Jinja desktop...'],
        [95, 'Starting PiNet Desktop...'],
        [100, 'Ready.'],
    ];

    for (const [pct, msg] of steps) {
        progress.style.width = pct + '%';
        if (progressbar) progressbar.setAttribute('aria-valuenow', String(pct));
        status.textContent = msg;
        await new Promise(r => setTimeout(r, 250));
    }

    await new Promise(r => setTimeout(r, 300));
    splash.classList.add('fade-out');
    setTimeout(() => splash.style.display = 'none', 500);

    // Initialize desktop
    renderDesktop();
    setupGlobalKeys();
    updateClock();
    setInterval(updateClock, 1000);
    pollStats();
    setInterval(pollStats, 5000);
}

/* ─── Start ────────────────────────────────── */
document.addEventListener('DOMContentLoaded', boot);
