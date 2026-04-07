# CLI Reference

The `pinet` CLI is the primary interface for managing PiNet OS from the command line.

---

## Synopsis

```bash
pinet <command> [options]
```

---

## Commands

### Lifecycle Management

#### `pinet setup`
One-time initialization of the PiNet OS runtime.

- Checks and installs Java 17+ (for Minima blockchain node)
- Checks and installs Node.js 18+
- Downloads the Minima JAR file
- Installs npm dependencies
- Generates node identity

```bash
pinet setup
```

#### `pinet start [--role <role>] [--master <address>]`
Start the PiNet OS runtime.

| Option | Description |
|---|---|
| `--role master` | Start as cluster master (coordinator) |
| `--role worker` | Start as cluster worker |
| `--master <address>` | Minima address of the master node to join |

```bash
# Start as standalone master
pinet start --role master

# Start as worker and join a cluster
pinet start --role worker --master MX_0x...
```

#### `pinet stop`
Gracefully stop all PiNet OS services.

```bash
pinet stop
```

#### `pinet status [--json]`
Show the current runtime status.

| Option | Description |
|---|---|
| `--json` | Output machine-readable JSON with service and port fields |

```bash
# Human-readable output
pinet status

# JSON output for scripting
pinet status --json
```

JSON output includes service states and port mappings for programmatic consumption.

---

### Cluster Operations

#### `pinet join <master_address>`
Join an existing cluster by connecting to the master node.

```bash
pinet join MX_0xABC123...
```

#### `pinet cluster`
Display cluster topology and node health information.

```bash
pinet cluster
```

---

### Application Management

#### `pinet open [app_id]`
List available apps or open a specific desktop application.

```bash
# List all available apps
pinet open

# Open a specific app
pinet open terminal
pinet open system-monitor
```

**Available App IDs:**

| App ID | Application |
|---|---|
| `minima-node` | Minima blockchain dashboard |
| `system-monitor` | System performance monitoring |
| `terminal` | Interactive web terminal |
| `ai-assistant` | AI assistant (Gemini) |
| `wallet` | Web3 wallet |
| `maxima-messenger` | Maxima P2P messenger |
| `cluster-manager` | Cluster orchestrator |
| `depai-executor` | DePAI workload executor |
| `imager-utility` | Pi Imager utility |
| `file-explorer` | File system browser |
| `settings` | System settings |
| `visual-studio` | Visual asset studio |

---

### Diagnostics

#### `pinet logs [--follow]`
View service logs.

| Option | Description |
|---|---|
| `--follow` | Stream logs in real-time (like `tail -f`) |

```bash
pinet logs
pinet logs --follow
```

#### `pinet shell`
Attach to the PiNet OS interactive shell session.

```bash
pinet shell
```

---

### Information

#### `pinet version`
Display version information for PiNet OS and the Minima node.

```bash
pinet version
```

#### `pinet help`
Display the full command reference.

```bash
pinet help
```

---

## Node Roles

| Role | Description |
|---|---|
| `master` | Cluster coordinator — accepts join requests, distributes workloads, aggregates metrics |
| `worker` | Cluster member — executes workloads, reports health via heartbeats |

---

## Runtime Directory

After `pinet setup`, the runtime lives at `~/.pinet/`:

```
~/.pinet/
├── config.json              # Node configuration
├── pinet.pid                # Master process ID
├── bin/minima.jar           # Minima blockchain JAR
├── minima-data/             # Blockchain data
├── logs/                    # Service logs
├── state/
│   ├── cluster.json         # Cluster state cache
│   └── identity.json        # Node identity
└── modules/                 # Plugin modules
```

---

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments |

---

## Production Deployment (systemd)

```bash
# Copy service units
sudo cp PiNetOS/services/*.service /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable --now minima pinet-cluster-manager pinet-desktop

# Verify
sudo systemctl status pinet-desktop
```

---

## Companion CLI: `minima`

The `minima` CLI provides direct access to the Minima blockchain node:

```bash
minima status          # Block height, peers, version
minima peers           # Peer count
minima balance         # Token balance
minima maxima          # Maxima identity info
minima contacts        # Contact list
minima cmd <command>   # Execute raw Minima RPC command
```

---

## See Also

- [Getting Started](Getting-Started) — Quick setup guide
- [API Reference](API-Reference) — REST API endpoints
- [Cluster Management](Cluster-Management) — Multi-node operations
