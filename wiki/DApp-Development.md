# DApp Development

Build and publish decentralized applications for PiNet OS using the DApp SDK.

---

## Quick Start

```bash
# 1. Create a DApp manifest
cat > manifest.json << 'EOF'
{
  "id": "com.example.hello",
  "name": "Hello World",
  "version": "1.0.0",
  "kind": "typescript",
  "description": "A simple Hello World DApp",
  "author": "Your Name",
  "entry": "index.html",
  "permissions": ["system.read"],
  "icon": "icon.png"
}
EOF

# 2. Create the entry point
cat > index.html << 'EOF'
<!DOCTYPE html>
<html>
<body>
  <h1>Hello from PiNet OS!</h1>
  <script src="bridge.js"></script>
  <script>
    PiNet.system.getStats().then(stats => {
      document.body.innerHTML += `<p>CPU: ${stats.cpu}%</p>`;
    });
  </script>
</body>
</html>
EOF

# 3. Install via API
curl -X POST http://localhost:3000/api/dapps/install \
  -H "Content-Type: application/json" \
  -d '{"url": "file:///path/to/manifest.json"}'
```

---

## DApp Manifest Format

Every DApp requires a `manifest.json`:

```json
{
  "id": "com.example.myapp",
  "name": "My Application",
  "version": "1.0.0",
  "kind": "typescript",
  "description": "A description of the DApp",
  "author": "Author Name",
  "entry": "index.html",
  "permissions": ["system.read", "wallet.read"],
  "icon": "icon.png",
  "minPinetVersion": "1.1.0",
  "repository": "https://github.com/user/repo",
  "license": "MIT"
}
```

### Manifest Fields

| Field | Required | Description |
|---|---|---|
| `id` | ✅ | Unique reverse-domain identifier (e.g., `com.example.myapp`) |
| `name` | ✅ | Human-readable display name |
| `version` | ✅ | Semantic version string |
| `kind` | ✅ | DApp type: `typescript`, `react-dashboard`, or `minidapp` |
| `description` | ✅ | Short description for the DApp Store |
| `author` | ✅ | Author name or organization |
| `entry` | ✅ | Entry point file (e.g., `index.html`) |
| `permissions` | ✅ | Array of required permissions |
| `icon` | ❌ | Path to app icon (PNG, 256×256 recommended) |
| `minPinetVersion` | ❌ | Minimum compatible PiNet OS version |
| `repository` | ❌ | Source code URL |
| `license` | ❌ | License identifier |

---

## DApp Kinds

### `typescript`
Plain TypeScript/JavaScript web application. Served as static files inside a sandboxed iframe. Best for simple tools and utilities.

### `react-dashboard`
React-based dashboard component. Has access to the PiNet UI component library. Best for data-rich monitoring and management interfaces.

### `minidapp`
Classic Minima MiniDapp format. Compatible with the existing Minima MiniDapp ecosystem. Runs in a sandboxed iframe with bridge access to Minima RPC.

---

## Permissions

DApps must declare required permissions in the manifest. Users approve permissions at install time.

| Permission | Description |
|---|---|
| `wallet.read` | Read wallet balance and address |
| `wallet.send` | Send tokens (requires user confirmation) |
| `minima.rpc` | Execute Minima RPC commands |
| `maxima.send` | Send Maxima P2P messages |
| `maxima.read` | Read received Maxima messages |
| `cluster.read` | Read cluster topology and node status |
| `system.read` | Read system stats (CPU, RAM, temp, disk) |
| `files.read` | Read files from the virtual filesystem |
| `files.write` | Write files to the virtual filesystem |
| `notifications` | Display desktop notifications |

---

## Bridge API

DApps communicate with PiNet OS through a **PostMessage bridge** (`DAppBridge`). The bridge runs inside a sandboxed iframe and proxies requests to the host.

### Protocol

```
DApp iframe  ──PostMessage──►  Host window (DAppHostFrame)
                                    │
                                    ▼
                              DAppBridge service
                                    │
                                    ▼
                              PiNet OS APIs
```

### Methods

Include `bridge.js` in your DApp to access the `PiNet` global object:

```html
<script src="bridge.js"></script>
```

#### System

```javascript
// Get system stats
const stats = await PiNet.system.getStats();
// { cpu: 23.5, ram: 62.1, temp: 54.2, disk: 45.0 }

// Get OS info
const info = await PiNet.system.getInfo();
// { name: "PiNet OS", version: "1.1.0", kernel: "6.1.0-rpi5", arch: "aarch64" }
```

#### Wallet

```javascript
// Read balance (requires wallet.read)
const balance = await PiNet.wallet.getBalance();

// Send tokens (requires wallet.send — prompts user confirmation)
const tx = await PiNet.wallet.send({ to: "Mx...", amount: "1.0", token: "0x00" });
```

#### Minima RPC

```javascript
// Execute Minima command (requires minima.rpc)
const result = await PiNet.minima.cmd("status");
const peers = await PiNet.minima.cmd("peers list");
```

#### Maxima Messaging

```javascript
// Send message (requires maxima.send)
await PiNet.maxima.send({ to: "MX_0x...", app: "myapp", data: "hello" });

// Read messages (requires maxima.read)
const messages = await PiNet.maxima.getMessages();
```

#### Cluster

```javascript
// Read cluster state (requires cluster.read)
const cluster = await PiNet.cluster.getState();
const nodes = await PiNet.cluster.getNodes();
```

#### Files

```javascript
// Read file (requires files.read)
const content = await PiNet.files.read("/data/config.json");

// Write file (requires files.write)
await PiNet.files.write("/data/config.json", JSON.stringify(config));

// List directory (requires files.read)
const files = await PiNet.files.list("/data/");
```

#### Notifications

```javascript
// Show notification (requires notifications)
PiNet.notify({ title: "Task Complete", body: "Processing finished successfully" });
```

### Push Events

DApps can subscribe to real-time events:

```javascript
PiNet.on("cluster:nodeJoined", (node) => { /* ... */ });
PiNet.on("cluster:nodeLeft", (node) => { /* ... */ });
PiNet.on("maxima:message", (msg) => { /* ... */ });
PiNet.on("system:statsUpdate", (stats) => { /* ... */ });
PiNet.on("wallet:transaction", (tx) => { /* ... */ });
```

---

## REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dapps` | List installed DApps |
| GET | `/api/dapps/:id` | Get DApp metadata |
| POST | `/api/dapps/install` | Install a DApp |
| POST | `/api/dapps/:id/uninstall` | Uninstall a DApp |
| GET | `/api/dapps/:id/serve/*` | Serve DApp static files |

---

## Architecture

```
┌─────────────────────────────────────────┐
│          PiNet OS Desktop (React)        │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │     DAppHostFrame (iframe)         │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │   DApp (sandboxed)           │  │  │
│  │  │   - bridge.js loaded         │  │  │
│  │  │   - PostMessage to host      │  │  │
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
│       ▲ PostMessage                      │
│       ▼                                  │
│  ┌────────────────────────────────────┐  │
│  │  DAppBridge Service               │  │
│  │  - Permission enforcement         │  │
│  │  - API proxying                   │  │
│  │  - Event forwarding               │  │
│  └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## Security Model

- **Iframe Sandbox**: DApps run in iframes with `sandbox="allow-scripts"` — no direct DOM access to the host
- **Permission Enforcement**: Every bridge call checks against the DApp's declared permissions
- **Origin Isolation**: Each DApp is served from a unique path (`/api/dapps/:id/serve/`)
- **Content Security Policy**: Strict CSP headers prevent unauthorized resource loading
- **Size Limits**: Maximum DApp upload size is 50 MB; maximum 50 installed DApps
- **User Consent**: Sensitive operations (wallet.send) require explicit user confirmation dialogs

---

## Classic MiniDapp Support

PiNet OS is compatible with existing Minima MiniDapps:

1. Set `"kind": "minidapp"` in the manifest
2. MiniDapps use the standard Minima `MDS` JavaScript API
3. The bridge translates MDS calls to PiNet OS APIs
4. Existing MiniDapps work without modification

---

## See Also

- [API Reference](API-Reference) — Full REST API
- [Desktop Applications](Desktop-Applications) — Built-in apps
- [Security](Security) — Security architecture
