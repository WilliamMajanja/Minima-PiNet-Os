# Desktop Applications

PiNet OS includes a suite of built-in desktop applications rendered by a Jinja2-templated, server-rendered desktop shell served from the Pi. The desktop is plain HTML/CSS/JS — no client-side framework — and is driven by a small in-browser window manager backed by FastAPI WebSockets and REST endpoints.

---

## Application Inventory

| App Name | App ID | Description |
|---|---|---|
| Minima Node | `minima-node` | Blockchain dashboard — block height, peers, sync status |
| System Monitor | `system-monitor` | Real-time CPU, RAM, temperature, disk metrics |
| Terminal | `terminal` | Full interactive terminal (PTY over WebSocket + xterm.js) |
| AI Assistant | `ai-assistant` | Gemini-powered AI assistant with local LLM fallback |
| Wallet | `wallet` | Minima token wallet — balance, send, receive |
| Maxima Messenger | `maxima-messenger` | Encrypted P2P messaging via Maxima protocol |
| Cluster Manager | `cluster-manager` | Multi-node cluster orchestration dashboard |
| DePAI Executor | `depai-executor` | Decentralized AI workload execution |
| Settings | `settings` | System configuration panel |
| Imager Utility | `imager-utility` | Raspberry Pi disk image flashing tool |
| File Explorer | `file-explorer` | Virtual filesystem browser |
| DApp Store | `dapp-store` | Browse, install, and manage DApps |
| Process Manager | `process-manager` | Process list, tree, signals, resource usage |
| User Manager | `user-manager` | User and group management |
| Network Manager | `network-manager` | Network interfaces, routes, DNS, firewall, WireGuard |
| Security Center | `security-center` | Security policies, audit log, threat detection |
| Log Viewer | `log-viewer` | Syslog viewer with filtering and search |
| Device Manager | `device-manager` | Hardware device enumeration and management |
| Power Manager | `power-manager` | Power state, CPU governor, scheduled actions |

---

## Window Management

PiNet OS implements a full windowing system in the browser:

| Feature | Description |
|---|---|
| **Drag** | Click and drag the title bar to reposition |
| **Resize** | Drag window edges or corners to resize |
| **Maximize** | Double-click title bar or click maximize button |
| **Minimize** | Click minimize button — window goes to taskbar |
| **Close** | Click close button or use keyboard shortcut |
| **Cascading** | New windows open offset from the previous window |
| **Z-Index** | Click a window to bring it to front |
| **Taskbar** | All open apps appear in the taskbar for quick switching |

### Window State

Each window tracks:
```js
// frontend/static/js/window-manager.js
{
  id,            // app id
  title,         // window title
  isOpen,
  isMinimized,
  isMaximized,
  zIndex,
  x, y,
  width, height,
}
```

---

## Key Applications

### System Monitor

Real-time dashboard for system health:

- **CPU**: Per-core utilization, frequency, governor
- **Memory**: Used, free, cached, swap
- **Temperature**: CPU thermal zone with throttle detection
- **Disk**: Per-mount usage, I/O stats
- **Network**: Interface throughput (rx/tx bytes)

Data refreshes every 2 seconds via polling `/api/system-stats`.

### Terminal

Full interactive terminal powered by:

| Layer | Technology |
|---|---|
| Backend PTY | Python `pty` + `asyncio` — spawns a real shell process |
| Transport | WebSocket at `ws://<host>:3000/terminal` |
| Frontend | `xterm.js` — terminal emulator in the browser |

Supports colors, cursor movement, tab completion, and all standard terminal features.

### Minima Node

Blockchain node dashboard showing:

- Block height and sync progress
- Connected peer count
- Node status (running, syncing, stopped)
- Uptime and version
- Direct RPC command execution

### Wallet

Minima token wallet:

- View token balance
- Send tokens to Minima addresses
- Transaction history
- Address management

### Maxima Messenger

Encrypted peer-to-peer messaging:

- Contact management (add by Maxima address)
- Real-time message delivery via Maxima protocol
- End-to-end encryption
- Message history

### Cluster Manager

Multi-node cluster dashboard:

- Visual topology map of all nodes
- Per-node health metrics (CPU, RAM, temp, NPU)
- Node status indicators (online, offline, processing, provisioning)
- Workload execution across the cluster
- Join/deregister node operations
- Provenance audit trail

### File Explorer

Virtual filesystem browser:

- Directory tree navigation
- File content viewer
- Create, rename, delete operations
- File upload and download

### DApp Store

Decentralized application marketplace:

- Browse available DApps
- Install from manifest URL or ZIP upload
- Manage installed DApps (start, stop, uninstall)
- DApp details and permissions review

### AI Assistant

AI-powered assistant:

- Gemini API integration for cloud inference
- Local LLM fallback (GGUF models via llama.cpp)
- Context-aware system queries
- Natural language interface for system administration

### Security Center

Comprehensive security dashboard:

- Security score and overview
- Active policies (AppArmor, firewall)
- Audit log viewer
- File integrity monitoring
- Threat detection alerts
- Security profile management
- **CPIP ITF Defense**: probe blocking status (HTTP 418), blacklisted IPs, detected pentest tools
- **CPIP Crypto Status**: CoffeeCipher v3, ECDSA P-256, RSA-KEM-2048 key material and rotation
- **CPIP Incident Chain**: tamper-evident SHA-256 audit log (`GET /cpip/incident`)
- **CPIP Emergency Mode**: key rotation, secure wipe, stealth activation (`POST /cpip/emergency`)

---

## UI Framework

| Component | File | Purpose |
|---|---|---|
| Desktop Shell | `frontend/templates/desktop.html` | Server-rendered desktop layout |
| Base Layout | `frontend/templates/base.html` | HTML scaffold, fonts, global styles |
| Window Manager | `frontend/static/js/window-manager.js` | Drag, resize, z-index, taskbar wiring |
| App Shell | `frontend/static/js/app.js` | App registry, launchers, polling |
| Terminal | `frontend/static/js/terminal.js` | xterm.js bridge to the PTY WebSocket |
| API Client | `frontend/static/js/api.js` | Thin fetch wrapper around the FastAPI routes |

---

## Opening Apps

### From the Desktop
Click an app icon in the taskbar or desktop grid.

### From the CLI
```bash
pinet open terminal
pinet open system-monitor
pinet open cluster-manager
```

### From the API
Apps are launched client-side by the desktop shell — there is no server-side API to open them directly.

---

## See Also

- [DApp Development](DApp-Development) — Build custom applications
- [API Reference](API-Reference) — Backend API endpoints
- [CLI Reference](CLI-Reference) — `pinet open` command
