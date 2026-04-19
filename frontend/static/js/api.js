/**
 * PiNet-OS API Client — Python Frontend
 */
const PiNetAPI = {
    baseUrl: '',

    async get(path) {
        try {
            const resp = await fetch(this.baseUrl + path);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (err) {
            console.error(`[API GET] ${path}:`, err);
            return null;
        }
    },

    async post(path, body = {}) {
        try {
            const resp = await fetch(this.baseUrl + path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (err) {
            console.error(`[API POST] ${path}:`, err);
            return null;
        }
    },

    async del(path) {
        try {
            const resp = await fetch(this.baseUrl + path, { method: 'DELETE' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (err) {
            console.error(`[API DELETE] ${path}:`, err);
            return null;
        }
    },

    // Convenience methods
    health: () => PiNetAPI.get('/api/health'),
    systemStats: () => PiNetAPI.get('/api/system-stats'),
    osInfo: () => PiNetAPI.get('/api/os-info'),
    settings: () => PiNetAPI.get('/api/settings'),
    saveSettings: (data) => PiNetAPI.post('/api/settings', data),
    minimaStatus: () => PiNetAPI.get('/api/minima/status'),
    minimaCmd: (command) => PiNetAPI.post('/api/minima/cmd', { command }),
    maximaContacts: () => PiNetAPI.get('/api/maxima/contacts'),
    maximaSend: (to, app, data) => PiNetAPI.post('/api/maxima/send', { to, application: app, data }),
    maximaMessages: () => PiNetAPI.get('/api/maxima/messages'),
    clusterState: () => PiNetAPI.get('/api/cluster/state'),
    clusterNodes: () => PiNetAPI.get('/api/cluster/nodes'),
    clusterJoin: (masterAddress) => PiNetAPI.post('/api/cluster/join', { masterAddress }),
    processes: () => PiNetAPI.get('/api/kernel/processes'),
    memory: () => PiNetAPI.get('/api/kernel/memory'),
    users: () => PiNetAPI.get('/api/users'),
    securityDashboard: () => PiNetAPI.get('/api/security/dashboard'),
    networkInterfaces: () => PiNetAPI.get('/api/network/interfaces'),
    powerInfo: () => PiNetAPI.get('/api/power'),
    devices: () => PiNetAPI.get('/api/devices'),
    dapps: () => PiNetAPI.get('/api/dapps'),
    syslog: (limit = 100) => PiNetAPI.get(`/api/syslog?limit=${limit}`),
    filesList: (path = '') => PiNetAPI.get(`/api/files/list?path=${encodeURIComponent(path)}`),
    filesRead: (path) => PiNetAPI.get(`/api/files/read?path=${encodeURIComponent(path)}`),
    filesWrite: (path, content) => PiNetAPI.post('/api/files/write', { path, content }),
    pinet2Status: () => PiNetAPI.get('/api/pinet2/status'),
};
