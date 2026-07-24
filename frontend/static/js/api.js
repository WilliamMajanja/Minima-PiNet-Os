/**
 * PiNet-OS API Client — Python Backend
 * Supports all Raspberry Pi models (Pi 5/4/3/2/1/Zero/CM)
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

    // ─── Health & System ──────────────────────────────────────────────────
    health: () => PiNetAPI.get('/api/health'),
    systemStats: () => PiNetAPI.get('/api/system-stats'),
    osInfo: () => PiNetAPI.get('/api/os-info'),
    settings: () => PiNetAPI.get('/api/settings'),
    saveSettings: (data) => PiNetAPI.post('/api/settings', data),

    // ─── Minima Blockchain ─────────────────────────────────────────────────
    minimaStatus: () => PiNetAPI.get('/api/minima/status'),
    minimaBalance: () => PiNetAPI.get('/api/minima/balance'),
    minimaCmd: (command) => PiNetAPI.post('/api/minima/cmd', { command }),
    minimaPeers: () => PiNetAPI.get('/api/minima/peers'),
    minimaNetwork: () => PiNetAPI.get('/api/minima/network'),
    minimaNewAddress: () => PiNetAPI.get('/api/minima/newaddress'),
    minimaGetAddress: () => PiNetAPI.get('/api/minima/getaddress'),
    minimaSend: (address, amount, tokenId) => PiNetAPI.post('/api/minima/send', { address, amount, tokenId }),
    minimaConnect: (host, port) => PiNetAPI.post('/api/minima/connect', { host, port }),
    minimaBlock: (blockNumber) => PiNetAPI.get(`/api/minima/block/${blockNumber}`),
    minimaMempool: () => PiNetAPI.get('/api/minima/mempool'),
    minimaAutomine: (enable) => PiNetAPI.post('/api/minima/automine', { enable }),
    minimaBackup: () => PiNetAPI.post('/api/minima/backup'),
    minimaTokens: () => PiNetAPI.get('/api/minima/tokens'),

    // ─── Maxima P2P Messaging ──────────────────────────────────────────────
    maximaContacts: () => PiNetAPI.get('/api/maxima/contacts'),
    maximaSend: (to, app, data) => PiNetAPI.post('/api/maxima/send', { to, application: app, data }),
    maximaMessages: () => PiNetAPI.get('/api/maxima/messages'),
    maximaInfo: () => PiNetAPI.get('/api/maxima/info'),

    // ─── Provenance ────────────────────────────────────────────────────────
    rmpStateProof: (keys) => PiNetAPI.get(`/api/minima/rmp/state-proof${keys ? '?keys=' + keys : ''}`),
    rmpVerify: (proof) => PiNetAPI.post('/api/minima/rmp/verify', { proof }),
    rnpe2Status: () => PiNetAPI.get('/api/minima/rnpe2/status'),
    rnpe2Request: (peerHeight, peerAddress, peerRoot) => PiNetAPI.post('/api/minima/rnpe2/request', { peerHeight, peerAddress, peerRoot }),
    rnpe2Verify: (peerProof, localProof) => PiNetAPI.post('/api/minima/rnpe2/verify', { peerProof, localProof }),

    // ─── Cluster ──────────────────────────────────────────────────────────
    clusterState: () => PiNetAPI.get('/api/cluster/state'),
    clusterNodes: () => PiNetAPI.get('/api/cluster/nodes'),
    clusterJoin: (masterAddress) => PiNetAPI.post('/api/cluster/join', { masterAddress }),

    // ─── System ────────────────────────────────────────────────────────────
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

    // ─── v3.0.0: Confidential Computing Enclaves ────────────────────────────
    enclaves: () => PiNetAPI.get('/api/enclaves'),
    enclaveCreate: (data) => PiNetAPI.post('/api/enclaves', data),
    enclaveStop: (id) => PiNetAPI.post(`/api/enclaves/${id}/stop`),
    enclaveDelete: (id) => PiNetAPI.del(`/api/enclaves/${id}`),
    enclaveAttest: (id) => PiNetAPI.post(`/api/enclaves/${id}/attest`),

    // ─── v3.0.0: Verifiable Compute Proofs ──────────────────────────────────
    zkProofs: () => PiNetAPI.get('/api/zk/proofs'),
    zkProofCreate: (data) => PiNetAPI.post('/api/zk/proofs', data),
    zkProofVerify: (id, data) => PiNetAPI.post(`/api/zk/proofs/${id}/verify`, data),
    zkProofDelete: (id) => PiNetAPI.del(`/api/zk/proofs/${id}`),

    // ─── v3.0.0: Decentralized Marketplace ──────────────────────────────────
    marketplaceListings: (params) => PiNetAPI.get(`/api/marketplace/listings${params ? '?' + new URLSearchParams(params) : ''}`),
    marketplaceListingCreate: (data) => PiNetAPI.post('/api/marketplace/listings', data),
    marketplaceListingDelete: (id) => PiNetAPI.del(`/api/marketplace/listings/${id}`),
    marketplaceOrders: (nodeId) => PiNetAPI.get(`/api/marketplace/orders${nodeId ? '?node_id=' + encodeURIComponent(nodeId) : ''}`),
    marketplaceOrderCreate: (data) => PiNetAPI.post('/api/marketplace/orders', data),
    marketplaceOrderComplete: (id) => PiNetAPI.post(`/api/marketplace/orders/${id}/complete`),
    marketplaceOrderCancel: (id) => PiNetAPI.post(`/api/marketplace/orders/${id}/cancel`),
    marketplaceRatingCreate: (data) => PiNetAPI.post('/api/marketplace/ratings', data),

    // ─── v3.0.0: SSL/TLS Management ────────────────────────────────────────
    sslStatus: () => PiNetAPI.get('/api/ssl/status'),
    sslGenerate: (hosts) => PiNetAPI.post('/api/ssl/generate', { hosts }),
    sslCertsDelete: () => PiNetAPI.del('/api/ssl/certs'),
    sslInstallCa: () => PiNetAPI.post('/api/ssl/install-ca'),
    sslCertDownload: () => PiNetAPI.get('/api/ssl/cert'),
};