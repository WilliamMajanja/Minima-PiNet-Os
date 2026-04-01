# API Reference

Complete reference for all REST API endpoints exposed by the PiNet OS server.

**Base URL:** `http://<host>:3000`

---

## Health & System (5 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check — returns `{ status: "ok" }` |
| GET | `/api/system-stats` | CPU, RAM, temperature, disk usage metrics |
| GET | `/api/os-info` | OS name, version, kernel, architecture, uptime |
| POST | `/api/system/switch-os` | Switch between OS modes (rate-limited) |
| GET | `/api/system/scan-subnet` | Scan local subnet for devices (rate-limited) |

---

## File Management (4 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/files/list` | List files in the virtual filesystem |
| GET | `/api/files/read` | Read file content by path |
| POST | `/api/files/write` | Write content to a file |
| DELETE | `/api/files/delete` | Delete a file (rate-limited) |

---

## Settings (2 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/settings` | Retrieve current system settings |
| POST | `/api/settings` | Update system settings |

---

## Minima Blockchain (2 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/minima/status` | Node status: blockHeight, peers, status, uptime, version |
| POST | `/api/minima/cmd` | Execute Minima RPC command (rate-limited) |

---

## PiNet2 Enterprise (5 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/pinet2/status` | Hypervisor and LXC container status |
| POST | `/api/pinet2/lxc-init` | Initialize LXC container environment |
| POST | `/api/pinet2/switch` | Switch between OS environments |
| POST | `/api/pinet2/ai-detect` | Detect AI hardware accelerators |
| POST | `/api/pinet2/health-check` | Run comprehensive health checks |

---

## Build & Release (2 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/build/image` | Build a PiNet OS disk image |
| POST | `/api/build/release` | Generate release packages |

---

## Cluster Management (8 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/cluster/state` | Full cluster topology and state |
| GET | `/api/cluster/nodes` | List all cluster nodes with metrics |
| POST | `/api/cluster/join` | Join a cluster as worker (rate-limited) |
| POST | `/api/cluster/exec` | Execute command across cluster (rate-limited) |
| POST | `/api/cluster/exec-local` | Execute command on local node (rate-limited) |
| POST | `/api/cluster/provision` | Provision a new node (rate-limited) |
| GET | `/api/cluster/provenance` | Query provenance/audit records |
| GET | `/api/cluster/events` | Stream cluster event log |

---

## Maxima P2P (3 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/maxima/contacts` | List Maxima contacts |
| POST | `/api/maxima/send` | Send encrypted P2P message (rate-limited) |
| GET | `/api/maxima/messages` | Retrieve received messages |

---

## Provenance (1 endpoint)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/provenance/record` | Record an auditable provenance event |

---

## DApp Platform (5 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dapps` | List installed DApps |
| GET | `/api/dapps/:id` | Get metadata for a specific DApp |
| POST | `/api/dapps/install` | Install a DApp from manifest or ZIP |
| POST | `/api/dapps/:id/uninstall` | Uninstall a DApp (rate-limited) |
| GET | `/api/dapps/:id/serve/*` | Serve static files for a DApp |

---

## Kernel — Processes (5 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/kernel/processes` | List all running processes |
| GET | `/api/kernel/processes/tree` | Process hierarchy tree |
| GET | `/api/kernel/processes/top` | Top processes sorted by CPU usage |
| POST | `/api/kernel/processes/:pid/signal` | Send signal (SIGHUP, SIGKILL, SIGTERM, etc.) |
| POST | `/api/kernel/processes/spawn` | Spawn a new process |

---

## Kernel — Memory (2 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/kernel/memory` | System-wide memory statistics |
| GET | `/api/kernel/memory/:pid` | Per-process memory usage |

---

## Kernel — Scheduler (3 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/kernel/scheduler` | Scheduler statistics and run queue |
| GET | `/api/kernel/scheduler/cron` | List scheduled cron jobs |
| POST | `/api/kernel/scheduler/cron` | Create a new cron job |

---

## Kernel — Services (5 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/kernel/services` | List all system services |
| GET | `/api/kernel/services/:name` | Status of a specific service |
| POST | `/api/kernel/services/:name/:action` | Control service (start/stop/restart/reload) |
| GET | `/api/kernel/targets` | List init targets and runlevels |
| GET | `/api/kernel/services-log` | Service log entries |

---

## Kernel — Syscalls (1 endpoint)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/kernel/syscalls` | List available syscall interfaces |

---

## Syslog (3 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/syslog` | Retrieve system log entries (filterable) |
| GET | `/api/syslog/stats` | Log statistics and severity breakdown |
| GET | `/api/syslog/processes` | Per-process log entries |

---

## User Management (4 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | List system users |
| GET | `/api/users/:uid` | User details by UID |
| POST | `/api/users` | Create a new user |
| DELETE | `/api/users/:uid` | Delete a user |

---

## Authentication (1 endpoint)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Authenticate with username and password |

---

## IPC (2 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/ipc/services` | List IPC services (D-Bus, message queues) |
| GET | `/api/ipc/messages` | Retrieve IPC message log |

---

## Device Management (4 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/devices` | List all detected hardware devices |
| GET | `/api/devices/:id` | Device details and driver info |
| GET | `/api/devices/events/recent` | Recent device hotplug events |
| GET | `/api/devices/rules/list` | Device management rules (udev-style) |

---

## Security (6 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/security/dashboard` | Security overview and score |
| GET | `/api/security/policies` | Active security policies |
| GET | `/api/security/audit` | Security audit log |
| GET | `/api/security/profiles` | Security profiles (AppArmor, etc.) |
| GET | `/api/security/integrity` | File integrity check results |
| GET | `/api/security/threats` | Threat detection alerts |

---

## Network (6 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/network/interfaces` | Network interface list and stats |
| GET | `/api/network/routes` | Routing table |
| GET | `/api/network/dns` | DNS resolver configuration |
| GET | `/api/network/firewall` | UFW firewall rules |
| GET | `/api/network/wireguard` | WireGuard tunnel status |
| POST | `/api/network/interfaces/:name` | Configure a network interface |

---

## Power (4 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/power` | Power state, CPU governor, battery/PSU info |
| POST | `/api/power/state` | Change power state (shutdown, reboot, suspend) |
| POST | `/api/power/governor` | Set CPU frequency governor |
| POST | `/api/power/schedule` | Schedule a power action |

---

## Downloads (6 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/download-full-project` | Download full project ZIP |
| GET | `/api/download-pinetos` | Download PiNetOS configuration ZIP |
| GET | `/api/download-electron` | Download Electron desktop client ZIP |
| GET | `/api/download-os-build` | Download build system ZIP |
| GET | `/api/download-os-docs` | Download documentation ZIP |
| GET | `/api/download-os-image` | Download Raspberry Pi OS image |

---

## WebSocket Endpoints

| Path | Description |
|---|---|
| `ws://<host>:3000/terminal` | Interactive terminal (node-pty + xterm.js) |
| `ws://<host>:3000/cluster/events` | Real-time cluster events stream |

---

## Rate Limiting

Rate limiting is applied **per IP address** on sensitive endpoints:

| Category | Limit |
|---|---|
| Cluster join/exec | 10 requests per minute |
| Minima RPC commands | 20 requests per minute |
| File delete | 10 requests per minute |
| DApp install/uninstall | 5 requests per minute |
| System switch | 3 requests per minute |

Exceeded requests return HTTP `429 Too Many Requests`.

---

## Security

- **Input Validation**: All request bodies and query parameters are validated and sanitized
- **Path Allowlists**: File operations are restricted to safe directories
- **Command Allowlists**: Shell execution uses `execFile` with explicit argument arrays — no shell interpolation
- **CORS**: Configurable origin restrictions
- **Authentication**: Session-based authentication via `/api/auth/login`

---

## See Also

- [CLI Reference](CLI-Reference) — Command-line interface
- [DApp Development](DApp-Development) — DApp bridge API
- [Cluster Management](Cluster-Management) — Cluster operations
