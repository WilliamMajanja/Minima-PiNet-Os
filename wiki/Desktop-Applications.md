# Desktop Applications

PiNet OS includes **22 built-in desktop applications** rendered as a React single-page application served from the Pi.

---

## Application Inventory

| App Name | App ID | Description |
|---|---|---|
| Minima Node | `minima-node` | Blockchain dashboard — block height, peers, sync status |
| System Monitor | `system-monitor` | Real-time CPU, RAM, temperature, disk metrics |
| Terminal | `terminal` | Full interactive terminal (node-pty + xterm.js) |
| AI Assistant | `ai-assistant` | Gemini-powered AI assistant with local LLM fallback |
| Wallet | `wallet` | Minima token wallet — balance, send, receive |
| Maxima Messenger | `maxima-messenger` | Encrypted P2P messaging via Maxima protocol |
| Cluster Manager | `cluster-manager` | Multi-node cluster orchestration dashboard |
| DePAI Executor | `depai-executor` | Decentralized AI workload execution |
| Settings | `settings` | System configuration panel |
| Setup Wizard | `setup-wizard` | First-boot setup and configuration |
| Imager Utility | `imager-utility` | Raspberry Pi disk image flashing tool |
| File Explorer | `file-explorer` | Virtual filesystem browser |
| Visual Studio | `visual-studio` | Visual asset design studio |
| DApp Store | `dapp-store` | Browse, install, and manage DApps |
| Process Manager | `process-manager` | Process list, tree, signals, resource usage |
| User Manager | `user-manager` | User and group management |
| Network Manager | `network-manager` | Network interfaces, routes, DNS, firewall, WireGuard |
| Security Center | `security-center` | Security policies, audit log, threat detection |
| Log Viewer | `log-viewer` | Syslog viewer with filtering and search |
| Device Manager | `device-manager` | Hardware device enumeration and management |
| Power Manager | `power-manager` | Power state, CPU governor, scheduled actions |
| Boot Splash | `boot-splash` | Animated boot splash screen |

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
```typescript
interface WindowState {
  id: AppId;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
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
| Backend PTY | `node-pty` — spawns a real shell process |
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

---

## UI Framework

| Component | File | Purpose |
|---|---|---|
| Desktop Shell | `App.tsx` | Main layout, window manager, app registry |
| Taskbar | `Taskbar.tsx` | App launcher and window switcher |
| Top Bar | `components/TopBar.tsx` | Clock, status indicators, notifications |
| Bento Dashboard | `components/BentoDashboard.tsx` | Grid dashboard layout |

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
Apps are client-side React components — there is no server-side API to open them directly.

---

## See Also

- [DApp Development](DApp-Development) — Build custom applications
- [API Reference](API-Reference) — Backend API endpoints
- [CLI Reference](CLI-Reference) — `pinet open` command
