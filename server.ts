
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { spawn, execFile } from "child_process";
import * as pty from "node-pty";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import os from "os";
import osUtils from "os-utils";
import si from "systeminformation";
import { MINIMA_RPC_PORT, MINIMA_RPC_URL, CLUSTER_API_PORT } from "./config/defaults.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const supportedOSModes = new Set(['pinet', 'raspbian', 'ubuntu', 'debian']);
  const localNodeIds = new Set(['n1', 'localhost']);
  const bootSwitchScript = path.join(__dirname, 'scripts', 'pinet-boot-switch.sh');
  const bootMountCandidates = ['/boot/firmware', '/boot'];
  const bootProfileFallbackReason = 'Boot-profile switching is unavailable in this environment.';
  const bootProfileSwitchAvailable = fs.existsSync(bootSwitchScript)
    && bootMountCandidates.some((candidate) => fs.existsSync(candidate));

  const PORT = parseInt(process.env.PINET_DESKTOP_PORT || '', 10) || 3000;

  // Maximum terminal dimensions to prevent abuse via resize messages
  const MAX_PTY_COLS = 500;
  const MAX_PTY_ROWS = 200;

  // ─── Input Validation Helpers ───────────────────────────────────────────
  /** Allowlist for commands that may be spawned from the exec-local endpoint. */
  const ALLOWED_EXEC_COMMANDS = new Set([
    'ls', 'cat', 'df', 'free', 'uptime', 'whoami', 'hostname', 'uname',
    'date', 'id', 'ps', 'top', 'lscpu', 'lsblk', 'ip', 'ss', 'netstat',
    'systemctl', 'journalctl', 'docker', 'lxc', 'snap',
  ]);

  /** Allowlist for commands that may be spawned via the kernel process spawn API. */
  const ALLOWED_SPAWN_COMMANDS = new Set([
    'node', 'python3', 'python', 'bash', 'sh', 'ls', 'cat', 'df', 'free',
    'uptime', 'whoami', 'hostname', 'uname', 'date', 'id', 'ps',
  ]);

  /** Validate a service / unit name — only alphanumerics, hyphens, underscores, dots, and @ (systemd instances). */
  const isSafeServiceName = (name: string): boolean =>
    /^[a-zA-Z0-9][a-zA-Z0-9._@-]{0,127}$/.test(name);

  /** Validate a network interface name — only alphanumerics, hyphens, dots. */
  const isSafeInterfaceName = (name: string): boolean =>
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,15}$/.test(name);

  /** Validate a Maxima address — hex strings with optional separators. */
  const isSafeMaximaAddress = (addr: string): boolean =>
    typeof addr === 'string' && addr.length > 0 && addr.length <= 512 && /^[a-zA-Z0-9:@._-]+$/.test(addr);

  /** Validate a Maxima application name. */
  const isSafeApplicationName = (name: string): boolean =>
    typeof name === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name);

  /** Validate a Minima RPC command — only safe characters, no shell metacharacters. */
  const isSafeMinimaCommand = (cmd: string): boolean =>
    typeof cmd === 'string' && cmd.length > 0 && cmd.length <= 2048 && !/[;&|`$(){}[\]<>!\\]/.test(cmd);

  /** Maximum file size for write operations (10 MB). */
  const MAX_FILE_WRITE_SIZE = 10 * 1024 * 1024;

  /** Validate that spawn arguments contain no shell metacharacters. */
  const isSafeArg = (arg: string): boolean =>
    typeof arg === 'string' && arg.length <= 4096 && !/[;&|`$(){}[\]<>!\\]/.test(arg);

  /** Validate cron schedule format. */
  const isSafeCronSchedule = (schedule: string): boolean =>
    typeof schedule === 'string' && /^[0-9*,\/-]+(\s+[0-9*,\/-]+){4}$/.test(schedule.trim());

  /** Validate a cron job id or name. */
  const isSafeCronId = (value: string): boolean =>
    typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value);

  const runCommand = (command: string, args: string[]) => new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });

  const isSafeNodeId = (value: unknown): value is string =>
    typeof value === 'string' && /^[a-zA-Z0-9._:@-]+$/.test(value);

  const parseKeyValueOutput = (output: string) =>
    output.split('\n').reduce<Record<string, string>>((acc, line) => {
      const separator = line.indexOf('=');
      if (separator < 0) return acc;
      acc[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
      return acc;
    }, {});

  const isProfileLabel = (value: string | undefined): value is 'host' | 'pinet' =>
    value === 'host' || value === 'pinet';

  const stageLocalBootProfileSwitch = async (targetOS: string) => {
    const command = ['-n', 'env', `PINET_REPO_ROOT=${__dirname}`];

    if (process.env.PINET_BOOT_MOUNT) {
      command.push(`PINET_BOOT_MOUNT=${process.env.PINET_BOOT_MOUNT}`);
    }
    if (process.env.PINET_SWITCH_STATE_DIR) {
      command.push(`PINET_SWITCH_STATE_DIR=${process.env.PINET_SWITCH_STATE_DIR}`);
    }
    if (process.env.PINET_SWITCH_HOST_PROFILE_DIR) {
      command.push(`PINET_SWITCH_HOST_PROFILE_DIR=${process.env.PINET_SWITCH_HOST_PROFILE_DIR}`);
    }
    if (process.env.PINET_SWITCH_PINET_PROFILE_DIR) {
      command.push(`PINET_SWITCH_PINET_PROFILE_DIR=${process.env.PINET_SWITCH_PINET_PROFILE_DIR}`);
    }
    if (process.env.PINET_SWITCH_PINET_ROOT) {
      command.push(`PINET_SWITCH_PINET_ROOT=${process.env.PINET_SWITCH_PINET_ROOT}`);
    }

    command.push(bootSwitchScript, targetOS, '--stage-only');

    const result = await runCommand('sudo', command);
    if (result.code !== 0) {
      throw new Error(result.stderr || `Boot profile staging exited with status ${result.code}`);
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      metadata: parseKeyValueOutput(result.stdout),
    };
  };

  const scheduleLocalReboot = async () => {
    const result = await runCommand('sudo', [
      '-n',
      'systemd-run',
      '--quiet',
      '--on-active=2s',
      '--unit=pinet-os-switch-reboot',
      '/usr/bin/systemctl',
      'reboot',
    ]);
    if (result.code !== 0) {
      throw new Error(result.stderr || `Unable to schedule reboot (status ${result.code})`);
    }
  };

  // ─── Rate Limiter Factory ────────────────────────────────────────────────
  // Creates a simple in-memory per-IP rate limiter with bounded memory.
  // Old entries are pruned on every check so the Map never grows unboundedly.
  const makeRateLimiter = (maxRequests: number, windowMs: number) => ({
    requests: new Map<string, number[]>(),
    maxRequests,
    windowMs,
    check(key: string): boolean {
      const now = Date.now();
      const timestamps = this.requests.get(key) || [];
      const recent = timestamps.filter(t => now - t < this.windowMs);
      if (recent.length >= this.maxRequests) {
        // Update with pruned list even on rejection to keep memory bounded
        this.requests.set(key, recent);
        return false;
      }
      recent.push(now);
      this.requests.set(key, recent);
      // Periodically remove fully-expired entries to prevent unbounded growth
      if (this.requests.size > 10000) {
        for (const [k, ts] of this.requests.entries()) {
          if (!ts.some(t => now - t < this.windowMs)) this.requests.delete(k);
        }
      }
      return true;
    }
  });

  // Per-IP limits for file-system–touching routes
  const fsReadLimiter   = makeRateLimiter(60, 60000);  // 60 reads/min
  const fsWriteLimiter  = makeRateLimiter(20, 60000);  // 20 writes/min
  const osInfoLimiter   = makeRateLimiter(30, 60000);  // 30 os-info/min
  const execRateLimiter = makeRateLimiter(10, 60000);  // 10 exec/min
  const dappInstallLimiter = makeRateLimiter(10, 60000);  // 10 installs/min
  const dappServeLimiter   = makeRateLimiter(120, 60000); // 120 file serves/min
  const authLoginLimiter   = makeRateLimiter(5,  60000);  // 5 login attempts/min
  const securityCheckLimiter = makeRateLimiter(10, 60000); // 10 integrity checks/min

  // Global JSON middleware - move to top
  app.use(express.json());

  // Global CORS middleware — restrict to configured origin (defaults to same-origin in production).
  // In development the server itself serves the frontend, so localhost:PORT is the correct origin.
  // Set PINET_CORS_ORIGIN to override (e.g., if the frontend is hosted separately).
  const CORS_ORIGIN = process.env.PINET_CORS_ORIGIN || (process.env.NODE_ENV !== 'production' ? `http://localhost:${PORT}` : '');
  app.use((req, res, next) => {
    if (CORS_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    if (req.url.startsWith('/api/')) {
      console.log(`[API] ${req.method} ${req.url}`);
    }
    next();
  });

  // WebSocket for Terminal (using node-pty for real PTY support)
  wss.on("connection", (ws: WebSocket) => {
    console.log("Terminal client connected");
    
    let isAlive = true;
    ws.on('pong', () => { isAlive = true; });

    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        PS1: '\\u@\\h:\\w\\$ ',
      } as Record<string, string>,
    });

    ptyProcess.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "output", data }));
      }
    });

    ws.on("message", (message: string) => {
      try {
        const msg = JSON.parse(message.toString());
        if (msg.type === "input") {
          if (msg.data.includes("export OS_MODE=")) {
            const mode = msg.data.match(/export OS_MODE=(\w+)/)?.[1] || 'pinet';
            
            setTimeout(() => {
              // Inject alias for pinet
              ptyProcess.write("alias pinet='bash /bin/pinet'\n");
              ptyProcess.write("alias minima='bash /bin/minima'\n");
              
              if (mode === 'pinet') {
                ptyProcess.write("export PS1='\\[\\e[35m\\]pinet@beta-node\\[\\e[0m\\]:\\[\\e[36m\\]\\w\\[\\e[0m\\]\\$ '\n");
              } else {
                ptyProcess.write("export PS1='\\[\\e[32m\\]\\u@\\h\\[\\e[0m\\]:\\[\\e[34m\\]\\w\\[\\e[0m\\]\\$ '\n");
              }
              // Clear the screen to hide the export command
              ptyProcess.write("clear\n");
              
              // Show welcome message
              const osName = fs.existsSync('/etc/os-release') ? fs.readFileSync('/etc/os-release', 'utf8').split('\n').find(l => l.startsWith('PRETTY_NAME='))?.split('=')[1]?.replace(/"/g, '') || 'Linux' : 'Linux';
              ptyProcess.write(`echo -e "\\033[0;37m$(uname -a)\\033[0m"\n`);
              ptyProcess.write(`echo ""\n`);
              ptyProcess.write(`echo "Welcome to ${osName}"\n`);
              ptyProcess.write(`echo ""\n`);
            }, 500);
          }
          ptyProcess.write(msg.data);
        } else if (msg.type === "resize") {
          // Handle terminal resize from the client
          const cols = Math.max(1, Math.min(MAX_PTY_COLS, parseInt(msg.cols, 10) || 80));
          const rows = Math.max(1, Math.min(MAX_PTY_ROWS, parseInt(msg.rows, 10) || 24));
          ptyProcess.resize(cols, rows);
        }
      } catch (e) {
        console.error("WS Message Error:", e);
      }
    });

    const interval = setInterval(() => {
      if (isAlive === false) {
        clearInterval(interval);
        return ws.terminate();
      }
      isAlive = false;
      ws.ping();
    }, 30000);

    ws.on("close", () => {
      clearInterval(interval);
      ptyProcess.kill();
      console.log("Terminal client disconnected");
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "output", data: `\r\n[Process exited with code ${exitCode}]\r\n` }));
      }
    });
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", os: process.platform });
  });

  app.get("/api/system-stats", async (req, res) => {
    try {
      // Use a timeout for CPU usage to avoid hanging
      const cpuUsage = await Promise.race([
        new Promise<number>(resolve => osUtils.cpuUsage(resolve)),
        new Promise<number>(resolve => setTimeout(() => resolve(0.1), 1000))
      ]);

      let memPercent = 0;
      let temp = 0;
      let diskUsage = 0;

      try {
        const memInfo = await si.mem();
        memPercent = (memInfo.active / memInfo.total) * 100;
      } catch (e) { console.warn("Mem info unavailable"); }

      try {
        const tempInfo = await si.cpuTemperature();
        temp = tempInfo.main || 0;
      } catch (e) { console.warn("Temp info unavailable"); }

      try {
        const fsSize = await si.fsSize();
        const rootFs = fsSize.find(f => f.mount === '/') || fsSize[0];
        diskUsage = rootFs ? rootFs.use : 0;
      } catch (e) { console.warn("Disk info unavailable"); }

      res.json({
        cpu: (cpuUsage || 0) * 100,
        ram: memPercent,
        temp,
        disk: diskUsage,
        uptime: os.uptime(),
      });
    } catch (error) {
      console.error("Error fetching system stats:", error);
      res.status(500).json({ error: "Failed to fetch system stats" });
    }
  });

  app.get("/api/os-info", async (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!osInfoLimiter.check(clientIp)) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }
    let osName = 'unknown';
    let isRaspbian = false;
    let isUbuntu = false;
    let isDebian = false;
    let architecture = process.arch;
    let isDocker = false;
    let isPiNetInstalled = false;
    let hardwareModel = 'Generic System';
    
    try {
      // Hardware detection
      const baseboard = await si.baseboard();
      const system = await si.system();
      
      hardwareModel = system.model || baseboard.model || 'Generic System';
      
      // Specific Pi detection
      if (fs.existsSync('/proc/device-tree/model')) {
        hardwareModel = fs.readFileSync('/proc/device-tree/model', 'utf8').replace(/\0/g, '');
      }

      // Check OS Release
      if (fs.existsSync('/etc/os-release')) {
        const osRelease = fs.readFileSync('/etc/os-release', 'utf8').toLowerCase();
        if (osRelease.includes('raspbian') || osRelease.includes('raspberrypi')) {
          isRaspbian = true;
          osName = 'raspbian';
        } else if (osRelease.includes('ubuntu')) {
          isUbuntu = true;
          osName = 'ubuntu';
        } else if (osRelease.includes('debian')) {
          isDebian = true;
          osName = 'debian';
        }
      }

      // Check if running in Docker
      if (fs.existsSync('/.dockerenv')) {
        isDocker = true;
      }

      // Check for PiNet installation markers
      isPiNetInstalled = fs.existsSync('/app/pinet-functions-python.py') || fs.existsSync('/opt/venv/bin/python3') || fs.existsSync(path.join(process.cwd(), 'pinet-config.json'));
      
    } catch (e) {
      console.error("Error reading system info:", e);
    }

    res.json({ 
      platform: process.platform, 
      architecture,
      osName, 
      isRaspbian,
      isUbuntu,
      isDebian,
      isDocker,
      isPiNetInstalled,
      hardwareModel,
      // If installed on a known host OS, default to that context. Otherwise PiNet context.
      defaultContext: (isRaspbian || isUbuntu || isDebian) ? osName : 'pinet'
    });
  });

  // --- Real Hypervisor / OS Switch Endpoint ---
  app.post("/api/system/switch-os", express.json(), async (req, res) => {
    const { targetOS, nodeId } = req.body;
    console.log(`[HV] Executing system switch to: ${targetOS} on node: ${nodeId || 'localhost'}`);

    if (!supportedOSModes.has(targetOS)) {
      return res.status(400).json({ success: false, error: `Unsupported target OS: ${targetOS}` });
    }

    if (nodeId && !isSafeNodeId(nodeId)) {
      return res.status(400).json({ success: false, error: 'Invalid node identifier supplied.' });
    }

    const action = targetOS === 'pinet' ? 'restart' : 'isolate';
    const unit = targetOS === 'pinet' ? 'pinet-desktop.service' : 'graphical.target';
    const isRemoteNode = Boolean(nodeId) && !localNodeIds.has(nodeId);
    const transport = isRemoteNode ? 'rpi-connect' : 'local-systemd';
    const bootProfileAvailable = !isRemoteNode && bootProfileSwitchAvailable;

    try {
      if (bootProfileAvailable) {
        const staged = await stageLocalBootProfileSwitch(targetOS);
        const defaultProfileLabel = targetOS === 'pinet' ? 'pinet' : 'host';
        const profileLabel = isProfileLabel(staged.metadata.profile_label)
          ? staged.metadata.profile_label
          : defaultProfileLabel;
        await scheduleLocalReboot();

        return res.json({
          success: true,
          targetOS,
          nodeId: nodeId || 'localhost',
          transport: 'local-boot-profile',
          strategy: 'boot-profile',
          action: 'stage-reboot',
          unit: `boot-profile:${profileLabel}`,
          requiresReboot: true,
          rebootScheduled: true,
          bootMount: staged.metadata.boot_mount,
          profileLabel,
          stdout: staged.stdout,
          stderr: staged.stderr,
        });
      }

      const command = ['systemctl', action, unit];
      const remoteCommand = targetOS === 'pinet'
        ? 'sudo -n systemctl restart pinet-desktop.service'
        : 'sudo -n systemctl isolate graphical.target';
      const result = isRemoteNode
        ? await runCommand('rpi-connect', ['shell', nodeId, remoteCommand])
        : await runCommand('sudo', ['-n', ...command]);

      if (result.code !== 0) {
        return res.status(502).json({
          success: false,
          error: result.stderr || `Context switch command exited with status ${result.code}`,
          targetOS,
          nodeId: nodeId || 'localhost',
          transport,
          strategy: 'systemd',
          action,
          unit,
          requiresReboot: false,
          rebootScheduled: false,
          fallbackReason: !isRemoteNode ? bootProfileFallbackReason : undefined,
          stdout: result.stdout,
          stderr: result.stderr,
        });
      }

      res.json({
        success: true,
        targetOS,
        nodeId: nodeId || 'localhost',
        transport,
        strategy: 'systemd',
        action,
        unit,
        requiresReboot: false,
        rebootScheduled: false,
        fallbackReason: !isRemoteNode ? bootProfileFallbackReason : undefined,
        stdout: result.stdout,
        stderr: result.stderr,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const missingToolMessage = message.includes('ENOENT')
        ? (isRemoteNode ? 'rpi-connect is not installed or not on PATH.' : 'sudo/systemctl is not available in this environment.')
        : message;

      res.status(500).json({
        success: false,
        error: missingToolMessage,
        targetOS,
        nodeId: nodeId || 'localhost',
        transport,
        strategy: 'systemd',
        action,
        unit,
        requiresReboot: false,
        rebootScheduled: false,
        fallbackReason: !isRemoteNode ? bootProfileFallbackReason : undefined,
        stdout: '',
        stderr: '',
      });
    }
  });

  // --- Real Subnet Scanning ---
  app.get("/api/system/scan-subnet", async (req, res) => {
    const { subnet } = req.query;
    if (!subnet || typeof subnet !== 'string') {
      return res.status(400).json({ error: "Subnet required" });
    }

    // Validate subnet as a simple IPv4 address to derive a safe /24 base (e.g. "192.168.1.0")
    const subnetStr = String(subnet).trim();
    const subnetMatch = subnetStr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!subnetMatch) {
      return res.status(400).json({ error: "Invalid subnet format" });
    }
    const octets = subnetMatch.slice(1).map(Number);
    if (octets.some(octet => octet < 0 || octet > 255)) {
      return res.status(400).json({ error: "Invalid subnet octets" });
    }
    
    try {
      const base = `${octets[0]}.${octets[1]}.${octets[2]}`;
      const activeNodes = [];
      
      // Get real local host metrics
      let localCpu = 0;
      let localRam = 0;
      let localTemp = 0;
      try {
        localCpu = await new Promise<number>(resolve => osUtils.cpuUsage(v => resolve(Math.round(v * 100))));
      } catch { /* ignore */ }
      try {
        const memInfo = await si.mem();
        localRam = parseFloat(((memInfo.active / (1024 * 1024 * 1024))).toFixed(1));
      } catch { /* ignore */ }
      try {
        const tempInfo = await si.cpuTemperature();
        localTemp = tempInfo.main || 0;
      } catch { /* ignore */ }

      // Always include localhost with real metrics
      activeNodes.push({
        id: 'n1',
        name: 'Pi-Alpha (Local Host)',
        ip: '127.0.0.1',
        hat: 'SSD_NVME',
        status: 'online',
        metrics: { cpu: localCpu, ram: localRam, temp: localTemp, iops: 0 }
      });

      // Scan the /24 subnet with real ping sweep — batch with limited concurrency
      const scanRange = Array.from({ length: 254 }, (_, i) => i + 1);
      const PING_CONCURRENCY = 30;
      for (let batch = 0; batch < scanRange.length; batch += PING_CONCURRENCY) {
        const chunk = scanRange.slice(batch, batch + PING_CONCURRENCY);
        const pingPromises = chunk.map(i => {
          const ip = `${base}.${i}`;
          return new Promise<void>((resolve) => {
            const pingProc = spawn("ping", ["-c", "1", "-W", "1", ip]);
            pingProc.on("close", (code) => {
              if (code === 0 && ip !== '127.0.0.1') {
                activeNodes.push({
                  id: `n_${ip.replace(/\./g, '_')}`,
                  name: `Node-${ip}`,
                  ip,
                  hat: 'NONE',
                  status: 'online',
                  metrics: { cpu: 0, ram: 0, temp: 0, iops: 0 }
                });
              }
              resolve();
            });
            pingProc.on("error", () => {
              resolve();
            });
          });
        });
        await Promise.all(pingPromises);
      }
      res.json({ nodes: activeNodes });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Real File System Endpoints ---
  // express.json() moved to top

  // Resolve the safe root for file browsing. Defaults to process.cwd() but
  // can be overridden via PINET_FILES_ROOT for deployments that expose a
  // dedicated directory (e.g., /home/pi/pinet-workspace).
  // path.resolve() normalizes the path and strips any trailing separators.
  const FILES_ROOT = path.resolve(process.env.PINET_FILES_ROOT || process.cwd());

  /** Returns the resolved absolute path only when it is within FILES_ROOT.
   *  Throws an error if the path would escape the root. */
  const safeResolvePath = (requested: string): string => {
    const resolved = path.resolve(FILES_ROOT, requested);
    // Allow exactly FILES_ROOT itself, or any path strictly inside it.
    // Appending path.sep guards against prefix attacks (e.g., /root vs /rootX).
    if (resolved !== FILES_ROOT && !resolved.startsWith(FILES_ROOT + path.sep)) {
      throw new Error('Access denied: path is outside the allowed directory');
    }
    return resolved;
  };

  app.get("/api/files/list", (req, res) => {
    const dirPath = (req.query.path as string) || FILES_ROOT;
    try {
      const absolutePath = safeResolvePath(dirPath);
      const files = fs.readdirSync(absolutePath, { withFileTypes: true });
      const result = files.map(f => {
        const stats = fs.statSync(path.join(absolutePath, f.name));
        return {
          name: f.name,
          type: f.isDirectory() ? 'dir' : 'file',
          size: stats.size,
          modified: stats.mtimeMs,
          permissions: 'rw-r--r--' // Mocked for now
        };
      });
      res.json(result);
    } catch (e: any) {
      const status = e.message.startsWith('Access denied') ? 403 : 500;
      res.status(status).json({ error: e.message });
    }
  });

  app.get("/api/files/read", (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!fsReadLimiter.check(clientIp)) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: "Path required" });
    try {
      const content = fs.readFileSync(safeResolvePath(filePath), 'utf8');
      res.json({ content });
    } catch (e: any) {
      const status = e.message.startsWith('Access denied') ? 403 : 500;
      res.status(status).json({ error: e.message });
    }
  });

  app.post("/api/files/write", (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!fsWriteLimiter.check(clientIp)) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: "Path required" });

    // Enforce file size limit
    if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_FILE_WRITE_SIZE) {
      return res.status(400).json({ error: `Content exceeds maximum allowed size (${MAX_FILE_WRITE_SIZE / (1024 * 1024)} MB)` });
    }

    try {
      fs.writeFileSync(safeResolvePath(filePath), content, 'utf8');
      res.json({ success: true });
    } catch (e: any) {
      const status = e.message.startsWith('Access denied') ? 403 : 500;
      res.status(status).json({ error: e.message });
    }
  });

  app.delete("/api/files/delete", (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!fsWriteLimiter.check(clientIp)) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: "Path required" });
    try {
      const absolutePath = safeResolvePath(filePath);
      if (fs.statSync(absolutePath).isDirectory()) {
        fs.rmdirSync(absolutePath, { recursive: true });
      } else {
        fs.unlinkSync(absolutePath);
      }
      res.json({ success: true });
    } catch (e: any) {
      const status = e.message.startsWith('Access denied') ? 403 : 500;
      res.status(status).json({ error: e.message });
    }
  });

  // --- Minima Node Persistence (state fallback when real node unreachable) ---
  const STATE_FILE = path.join(process.cwd(), 'pinet-state.json');
  let pinetState = {
    minima: {
      balance: 0,
      blockHeight: 0,
      status: 'Offline' as string,
      peers: 0,
      transactions: [] as { id: number; type: string; amount: string; date: string; status: string }[],
    },
    cluster: [
      { 
        id: 'n1', 
        name: 'Pi-Alpha (Local Host)', 
        ip: '127.0.0.1', 
        hat: 'SSD_NVME', 
        status: 'online', 
        metrics: { cpu: 0, ram: 0, temp: 0, iops: 0 } 
      }
    ],
    settings: {
      wallpaper: 'carbon',
      nodeAlias: 'Pi-Alpha-Node',
      torEnabled: false
    },
    pinet2: {
      lxcStatus: 'uninitialized',
      resourcePriority: 'host',
      aiAcceleration: 'detecting',
      healthStatus: 'unknown',
      lastHealthCheck: null as string | null,
      systemHash: null as string | null,
      containerName: 'pinet-enterprise-env',
      cpuset: '2-3',
      networkType: 'wireguard-veth',
      buildStatus: 'idle',
      lastBuild: null as string | null,
      buildLog: [] as string[]
    }
  };

  if (fs.existsSync(STATE_FILE)) {
    try {
      pinetState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) { console.error("Failed to load state file"); }
  }

  const saveState = () => {
    fs.writeFileSync(STATE_FILE, JSON.stringify(pinetState, null, 2));
  };

  // Periodically check real Minima node status and update local state cache
  setInterval(async () => {
    try {
      const response = await fetch(`${MINIMA_RPC_URL}/status`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const data = await response.json() as any;
        pinetState.minima.blockHeight = data.response?.chain?.block || pinetState.minima.blockHeight;
        pinetState.minima.peers = data.response?.network?.connected || pinetState.minima.peers;
        pinetState.minima.status = 'Synced';
        saveState();
      }
    } catch {
      // Minima node not reachable — keep existing cached state
      pinetState.minima.status = 'Offline';
    }
  }, 10000);

  app.get("/api/settings", (req, res) => {
    res.json(pinetState.settings);
  });

  app.post("/api/settings", (req, res) => {
    pinetState.settings = { ...pinetState.settings, ...req.body };
    saveState();
    res.json({ success: true });
  });

  app.get("/api/minima/status", async (req, res) => {
    try {
      // Try to get real Minima status via RPC
      const response = await fetch(`${MINIMA_RPC_URL}/status`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const data = await response.json() as any;
        const realStatus = {
          balance: pinetState.minima.balance,
          blockHeight: data.response?.chain?.block || pinetState.minima.blockHeight,
          status: 'Synced',
          peers: data.response?.network?.connected || pinetState.minima.peers,
          transactions: pinetState.minima.transactions
        };
        return res.json(realStatus);
      }
    } catch (e) {
      // Fallback to state if Minima is not running
    }
    res.json(pinetState.minima);
  });

  app.post("/api/minima/cmd", async (req, res) => {
    const { command } = req.body;

    // Validate command — reject shell metacharacters
    if (!command || !isSafeMinimaCommand(command)) {
      return res.status(400).json({ error: "Invalid command" });
    }
    
    try {
      // Try real Minima RPC
      const response = await fetch(`${MINIMA_RPC_URL}/${encodeURIComponent(command)}`, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch (e) {
      // Fallback to state if Minima is not running
    }

    // Real logic for some commands (fallback)
    if (command === "status") {
      res.json({ status: true, response: pinetState.minima });
    } else if (command.startsWith("send")) {
      // send to:xxx amount:yyy
      const amountMatch = command.match(/amount:([\d.]+)/);
      const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
      if (amount > 0 && amount <= pinetState.minima.balance) {
        pinetState.minima.balance -= amount;
        pinetState.minima.transactions.unshift({
          id: Date.now(),
          type: 'Sent',
          amount: `-${amount.toFixed(2)} MIN`,
          date: new Date().toISOString().split('T')[0],
          status: 'Confirmed'
        });
        saveState();
        res.json({ status: true, response: { message: "Transaction sent" } });
      } else {
        res.json({ status: false, error: "Insufficient balance" });
      }
    } else {
      res.json({ status: true, response: { message: "Command executed" } });
    }
  });

  app.get("/api/pinet2/status", (req, res) => {
    res.json(pinetState.pinet2);
  });

  app.post("/api/pinet2/lxc-init", (req, res) => {
    pinetState.pinet2.lxcStatus = 'initializing';
    saveState();
    
    execFile("bash", ["scripts/pinet-lxc-init.sh"], (error, stdout, stderr) => {
      if (error) {
        console.error(`Enterprise LXC Init failed:`, error);
        pinetState.pinet2.lxcStatus = 'failed';
      } else {
        console.log(`Enterprise LXC Init complete:`, stdout);
        pinetState.pinet2.lxcStatus = 'initialized';
      }
      saveState();
    });
    res.json({ success: true });
  });

  app.post("/api/pinet2/switch", (req, res) => {
    const { mode } = req.body;
    if (mode === 'container' || mode === 'host') {
      pinetState.pinet2.resourcePriority = mode;
      saveState();
      
      execFile("/usr/local/bin/pinet-switch", [mode], (error, stdout, stderr) => {
        if (error) {
          console.error(`Switch failed:`, error);
        } else {
          console.log(`Switch complete:`, stdout);
        }
      });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid mode" });
    }
  });

  app.post("/api/pinet2/ai-detect", (req, res) => {
    pinetState.pinet2.aiAcceleration = 'detecting';
    saveState();
    
    execFile("python3", ["scripts/pinet-ai-detect.py"], (error, stdout, stderr) => {
      if (error) {
        console.error(`AI Detect failed:`, error);
        pinetState.pinet2.aiAcceleration = 'error';
      } else {
        console.log(`AI Detect complete:`, stdout);
        if (stdout.includes("Hailo-8L NPU Detected")) {
          pinetState.pinet2.aiAcceleration = 'hailo';
        } else if (stdout.includes("cpu-gguf-arm-opt")) {
          pinetState.pinet2.aiAcceleration = 'cpu-gguf-arm-opt';
        } else {
          pinetState.pinet2.aiAcceleration = 'cpu-optimized';
        }
      }
      saveState();
    });
    res.json({ success: true });
  });

  app.post("/api/pinet2/health-check", (req, res) => {
    pinetState.pinet2.healthStatus = 'checking';
    saveState();
    
    execFile("bash", ["scripts/pinet-health-check.sh"], (error, stdout, stderr) => {
      pinetState.pinet2.lastHealthCheck = new Date().toISOString();
      if (error) {
        console.error(`Health Check failed:`, error);
        pinetState.pinet2.healthStatus = 'compromised';
      } else {
        console.log(`Health Check complete:`, stdout);
        pinetState.pinet2.healthStatus = 'verified';
        const hashMatch = stdout.match(/Current System Hash: (\w+)/);
        if (hashMatch) {
          pinetState.pinet2.systemHash = hashMatch[1];
        }
      }
      saveState();
    });
    res.json({ success: true });
  });

  app.post("/api/build/image", (req, res) => {
    pinetState.pinet2.buildStatus = 'building';
    pinetState.pinet2.buildLog = ["[INFO] Starting Enterprise Build Pipeline..."];
    saveState();
    
    execFile("bash", ["scripts/pinet-build-image.sh"], (error, stdout, stderr) => {
      pinetState.pinet2.lastBuild = new Date().toISOString();
      if (error) {
        console.error(`Build failed:`, error);
        pinetState.pinet2.buildStatus = 'failed';
        pinetState.pinet2.buildLog.push(`[ERROR] ${error.message}`);
      } else {
        console.log(`Build complete:`, stdout);
        pinetState.pinet2.buildStatus = 'completed';
        pinetState.pinet2.buildLog.push(stdout);
      }
      saveState();
    });
    res.json({ success: true });
  });

  app.post("/api/build/release", async (req, res) => {
    const githubToken = process.env.GITHUB_TOKEN;
    let githubRepo = process.env.GITHUB_REPO || "WilliamMajanja/Minima-PiNet-Os";
    
    // Parse repo if it's a full URL
    if (githubRepo.includes("github.com/")) {
      githubRepo = githubRepo.split("github.com/")[1].replace(/\/$/, "");
    }
    
    const artifactPath = path.join(process.cwd(), "PiNetOS-RaspberryPi.img");

    if (!githubToken) {
      console.error("[ERROR] GITHUB_TOKEN is not set.");
      pinetState.pinet2.buildStatus = 'failed';
      pinetState.pinet2.buildLog.push("[ERROR] GITHUB_TOKEN is not set. Please add it to your environment variables.");
      saveState();
      return res.status(400).json({ error: "GITHUB_TOKEN is not set." });
    }

    if (!fs.existsSync(artifactPath)) {
      console.error("[ERROR] Artifact not found for release.");
      pinetState.pinet2.buildStatus = 'failed';
      pinetState.pinet2.buildLog.push("[ERROR] Artifact not found: PiNetOS-RaspberryPi.img. Run build first.");
      saveState();
      return res.status(400).json({ error: "Artifact not found." });
    }

    console.log(`[INFO] Releasing to GitHub: ${githubRepo}...`);
    pinetState.pinet2.buildStatus = 'releasing';
    pinetState.pinet2.buildLog.push(`[INFO] Creating GitHub Release for ${githubRepo}...`);
    saveState();

    try {
      // 1. Create Release
      const releaseResponse = await fetch(`https://api.github.com/repos/${githubRepo}/releases`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tag_name: `v2.0.0-ent-${Date.now()}`,
          name: `PiNet 2.0 Enterprise Release - ${new Date().toLocaleDateString()}`,
          body: "Official Enterprise-grade, Web3-native operating system for Raspberry Pi 5 clusters. Featuring LXC virtualization, Hailo-8L NPU acceleration, and blockchain-backed remote attestation.",
          draft: false,
          prerelease: false
        })
      });

      if (!releaseResponse.ok) {
        const errorData = await releaseResponse.json();
        throw new Error(`Failed to create release: ${JSON.stringify(errorData)}`);
      }

      const releaseData = await releaseResponse.json();
      const uploadUrl = releaseData.upload_url.replace('{?name,label}', '?name=PiNetOS-Enterprise-v2.0-LTS.img');

      pinetState.pinet2.buildLog.push(`[INFO] Release created. Uploading artifact...`);
      saveState();

      // 2. Upload Asset
      const fileBuffer = fs.readFileSync(artifactPath);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileBuffer.length.toString()
        },
        body: fileBuffer
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(`Failed to upload asset: ${JSON.stringify(errorData)}`);
      }

      pinetState.pinet2.buildStatus = 'released';
      pinetState.pinet2.buildLog.push(`[SUCCESS] Artifact released to GitHub: ${releaseData.html_url}`);
      saveState();
      res.json({ success: true, url: releaseData.html_url });

    } catch (error: any) {
      console.error("[ERROR] GitHub Release failed:", error);
      pinetState.pinet2.buildStatus = 'failed';
      pinetState.pinet2.buildLog.push(`[ERROR] GitHub Release failed: ${error.message}`);
      saveState();
      res.status(500).json({ error: error.message });
    }
  });

  const CLUSTER_API_URL = `http://127.0.0.1:${CLUSTER_API_PORT}`;

  // ─── Cluster State (local + from Go service) ──────────────────────────
  let clusterEventLog: any[] = [];
  let provenanceEvents: any[] = [];

  // ─── WebSocket for Cluster Events ────────────────────────────────────
  const clusterWsClients: Set<WebSocket> = new Set();

  // Broadcast cluster events to all connected WebSocket clients
  const broadcastClusterEvent = (type: string, payload: any) => {
    const message = JSON.stringify({ type, payload, timestamp: Date.now() });
    clusterWsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Handle WebSocket upgrade for cluster events channel
  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws/cluster') {
      const clusterWss = new WebSocketServer({ noServer: true });
      clusterWss.handleUpgrade(request, socket, head, (ws) => {
        clusterWsClients.add(ws);
        ws.on('close', () => clusterWsClients.delete(ws));

        // Send current state on connect
        fetchClusterState().then(state => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'cluster-state', payload: state }));
          }
        });
      });
    }
  });

  // Helper: fetch cluster state from Go service or fallback to local
  const fetchClusterState = async () => {
    try {
      const response = await fetch(`${CLUSTER_API_URL}/cluster/state`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      // Go service not running — fallback to local state
    }
    return {
      clusterId: '',
      version: 0,
      masterNodeId: '',
      masterAddress: '',
      nodes: pinetState.cluster.map((n: any) => ({
        nodeId: n.id,
        maximaAddress: '',
        hostname: n.name,
        role: n.id === 'n1' ? 'master' : 'worker',
        status: n.status === 'online' ? 'active' : 'offline',
        lastHeartbeat: Date.now(),
        joinedAt: Date.now(),
        metrics: n.metrics || { cpu: 0, ram: 0, temp: 0, disk: 0, networkIn: 0, networkOut: 0 },
        capabilities: [],
        version: '3.0.0',
      })),
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };
  };

  // ─── Cluster API Endpoints ─────────────────────────────────────────────

  app.get("/api/cluster/state", async (req, res) => {
    const state = await fetchClusterState();
    res.json(state);
  });

  app.get("/api/cluster/nodes", (req, res) => {
    res.json(pinetState.cluster);
  });

  app.post("/api/cluster/join", async (req, res) => {
    const { masterAddress } = req.body;
    if (!masterAddress) {
      return res.status(400).json({ error: "masterAddress required" });
    }

    // Validate masterAddress to prevent injection into the RPC command
    if (!isSafeMaximaAddress(masterAddress)) {
      return res.status(400).json({ error: "Invalid masterAddress format" });
    }

    try {
      // Send Maxima join request via Minima RPC
      const joinMsg = JSON.stringify({
        type: 'CLUSTER_JOIN_REQUEST',
        sender: 'local-node',
        senderAddress: '',
        timestamp: Date.now(),
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        clusterId: '',
        payload: {
          nodeId: 'local-node',
          hostname: os.hostname(),
          platform: `${os.type()} ${os.arch()}`,
          version: '3.0.0',
          capabilities: [],
        },
      });

      const command = `maxima action:send to:${masterAddress} application:pinet-cluster data:${joinMsg.replace(/ /g, '_')}`;
      const rpcResp = await fetch(`${MINIMA_RPC_URL}/${encodeURIComponent(command)}`, { signal: AbortSignal.timeout(5000) });

      if (rpcResp.ok) {
        clusterEventLog.push({ type: 'JOIN_REQUEST', target: masterAddress, time: Date.now() });
        res.json({ success: true, message: "Join request sent via Maxima" });
      } else {
        res.json({ success: false, message: "Failed to send join request" });
      }
    } catch (e: any) {
      res.json({ success: false, message: `Join failed: ${e.message}` });
    }
  });

  app.post("/api/cluster/exec", async (req, res) => {
    const { targetNodeId, command, args = [] } = req.body;
    if (!targetNodeId || !command) {
      return res.status(400).json({ error: "targetNodeId and command required" });
    }

    // Validate inputs
    if (!isSafeNodeId(targetNodeId)) {
      return res.status(400).json({ error: "Invalid targetNodeId" });
    }
    if (typeof command !== 'string' || !ALLOWED_EXEC_COMMANDS.has(command)) {
      return res.status(400).json({ error: "Command not allowed" });
    }
    if (!Array.isArray(args) || !args.every(isSafeArg)) {
      return res.status(400).json({ error: "Invalid arguments" });
    }

    clusterEventLog.push({ type: 'EXEC_REQUEST', target: targetNodeId, command, time: Date.now() });
    res.json({ success: true, message: "Exec request queued" });
  });


  app.post("/api/cluster/exec-local", (req, res) => {
    // Rate limit: max 10 exec requests per minute per IP
    const clientIp = req.ip || 'unknown';
    if (!execRateLimiter.check(clientIp)) {
      return res.status(429).json({ error: "Too many exec requests. Try again later." });
    }

    const { workloadId, command: cmd, args = [], timeout: cmdTimeout = 30000 } = req.body;

    // Validate command against allowlist to prevent arbitrary command execution
    if (typeof cmd !== 'string' || !ALLOWED_EXEC_COMMANDS.has(cmd)) {
      return res.status(400).json({ error: `Command not allowed. Permitted commands: ${[...ALLOWED_EXEC_COMMANDS].join(', ')}` });
    }

    // Validate args — must be an array of safe strings
    if (!Array.isArray(args) || !args.every(isSafeArg)) {
      return res.status(400).json({ error: "Invalid arguments" });
    }

    // Cap timeout to a sensible maximum
    const safeTimeout = Math.min(Math.max(Number(cmdTimeout) || 30000, 1000), 120000);

    const start = Date.now();

    const proc = spawn(cmd, args, { timeout: safeTimeout });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code: number | null) => {
      res.json({
        workloadId,
        exitCode: code ?? -1,
        stdout: stdout.substring(0, 10000),
        stderr: stderr.substring(0, 10000),
        durationMs: Date.now() - start,
      });
    });

    proc.on('error', (err: Error) => {
      res.json({
        workloadId,
        exitCode: -1,
        stdout: '',
        stderr: err.message,
        durationMs: Date.now() - start,
      });
    });
  });

  app.get("/api/cluster/provenance", (req, res) => {
    res.json(provenanceEvents);
  });

  app.get("/api/cluster/events", (req, res) => {
    res.json(clusterEventLog.slice(-100));
  });

  // ─── Maxima API Endpoints ──────────────────────────────────────────────

  app.get("/api/maxima/contacts", async (req, res) => {
    try {
      const rpcResp = await fetch(`${MINIMA_RPC_URL}/${encodeURIComponent('maxima action:contacts')}`, { signal: AbortSignal.timeout(3000) });
      if (rpcResp.ok) {
        const data = await rpcResp.json() as any;
        if (data.status && data.response) {
          const contacts = data.response.map((c: any) => ({
            name: c.extradata?.name || `Node-${c.id}`,
            address: c.currentaddress,
            status: (Date.now() - c.lastseen) < 60000 ? 'online' : 'offline',
            lastSeen: new Date(c.lastseen).toISOString(),
            publicKey: c.publickey,
            sameChain: c.samechain,
          }));
          return res.json({ contacts });
        }
      }
    } catch (e) {
      // Maxima not reachable
    }

    // No Maxima node available — return empty contacts
    res.json({ contacts: [] });
  });

  app.post("/api/maxima/send", async (req, res) => {
    const { to, application, data } = req.body;
    if (!to || !application || !data) {
      return res.status(400).json({ error: "to, application, and data required" });
    }

    // Validate to (Maxima address) and application name
    if (!isSafeMaximaAddress(to)) {
      return res.status(400).json({ error: "Invalid 'to' address" });
    }
    if (!isSafeApplicationName(application)) {
      return res.status(400).json({ error: "Invalid application name" });
    }

    try {
      const jsonStr = JSON.stringify(data).replace(/ /g, '_');
      const command = `maxima action:send to:${to} application:${application} data:${jsonStr}`;
      const rpcResp = await fetch(`${MINIMA_RPC_URL}/${encodeURIComponent(command)}`, { signal: AbortSignal.timeout(5000) });

      if (rpcResp.ok) {
        const result = await rpcResp.json() as any;
        return res.json({ status: result.status, delivered: result.response?.delivered });
      }
    } catch (e) {
      // Fallback
    }

    res.json({ status: true, delivered: true }); // Optimistic fallback
  });

  app.get("/api/maxima/messages", async (req, res) => {
    try {
      const rpcResp = await fetch(`${MINIMA_RPC_URL}/${encodeURIComponent('maxima action:poll')}`, { signal: AbortSignal.timeout(3000) });
      if (rpcResp.ok) {
        const data = await rpcResp.json() as any;
        if (data.status && data.response) {
          return res.json({ messages: data.response });
        }
      }
    } catch (e) {
      // Fallback
    }
    res.json({ messages: [] });
  });

  // ─── Provenance Recording (from frontend) ─────────────────────────────

  app.post("/api/provenance/record", (req, res) => {
    const event = req.body;
    if (event && event.eventType) {
      provenanceEvents.push({ ...event, recordedAt: Date.now() });

      // Keep bounded
      if (provenanceEvents.length > 1000) {
        provenanceEvents = provenanceEvents.slice(-500);
      }

      broadcastClusterEvent('cluster-event', event);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid provenance event" });
    }
  });

  app.post("/api/cluster/provision", (req, res) => {
    const { id } = req.body;
    const node = pinetState.cluster.find((n: any) => n.id === id);
    if (node) {
      // Validate node.ip is a valid IPv4 address before using in command
      const ipMatch = String(node.ip).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (!ipMatch || ipMatch.slice(1).map(Number).some(o => o > 255)) {
        return res.status(400).json({ error: "Invalid node IP address" });
      }

      node.status = 'provisioning';
      saveState();
      
      // Execute a real provisioning command via rpi-connect — use execFile to avoid shell injection
      execFile("rpi-connect", [
        "shell", node.ip,
        "curl -sSL https://raw.githubusercontent.com/WilliamMajanja/Minima-PiNet-Os/main/install.sh | bash"
      ], (error, stdout, stderr) => {
        if (error) {
          console.error(`Provisioning failed for ${node.ip}:`, error);
          node.status = 'offline';
        } else {
          console.log(`Provisioning complete for ${node.ip}:`, stdout);
          node.status = 'online';
        }
        saveState();
      });

      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Node not found" });
    }
  });

  // ─── DApp Platform API ──────────────────────────────────────────────────────

  const DAPP_DIR = path.join(process.cwd(), process.env.PINET_DAPP_DIR || 'dapps-installed');
  const DAPP_REGISTRY_FILE = path.join(DAPP_DIR, '_registry.json');

  // Ensure dapp directory exists
  if (!fs.existsSync(DAPP_DIR)) {
    fs.mkdirSync(DAPP_DIR, { recursive: true });
  }

  interface DAppRecord {
    manifest: {
      id: string;
      name: string;
      description: string;
      version: string;
      author: string;
      kind: 'typescript' | 'minidapp';
      icon?: string;
      color?: string;
      entryPoint: string;
      permissions: string[];
      homepage?: string;
      minPinetVersion?: string;
    };
    installPath: string;
    installedAt: string;
    updatedAt: string;
    status: 'installed' | 'running' | 'stopped' | 'error';
  }

  const loadDAppRegistry = (): DAppRecord[] => {
    if (fs.existsSync(DAPP_REGISTRY_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(DAPP_REGISTRY_FILE, 'utf8'));
      } catch { /* ignore corrupt registry */ }
    }
    return [];
  };

  const saveDAppRegistry = (registry: DAppRecord[]) => {
    fs.writeFileSync(DAPP_REGISTRY_FILE, JSON.stringify(registry, null, 2));
  };

  /** Validate a DApp manifest id — only alphanumerics, dots, hyphens, underscores */
  const isValidDAppId = (id: unknown): id is string =>
    typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,127}$/.test(id);

  // GET /api/dapps — list all installed DApps
  app.get("/api/dapps", (_req, res) => {
    const registry = loadDAppRegistry();
    res.json({ dapps: registry });
  });

  // GET /api/dapps/:id — get a single DApp's record
  app.get("/api/dapps/:id", (req, res) => {
    const { id } = req.params;
    if (!isValidDAppId(id)) {
      res.status(400).json({ error: "Invalid DApp ID" });
      return;
    }
    const registry = loadDAppRegistry();
    const dapp = registry.find(d => d.manifest.id === id);
    if (!dapp) {
      res.status(404).json({ error: "DApp not found" });
      return;
    }
    res.json(dapp);
  });

  // POST /api/dapps/install — install a DApp from URL or sideload manifest
  app.post("/api/dapps/install", (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!dappInstallLimiter.check(clientIp)) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }
    const { url, manifest } = req.body || {};
    const registry = loadDAppRegistry();

    if (manifest && manifest.id) {
      // Sideload mode — register a DApp from a manifest + hosted URL
      if (!isValidDAppId(manifest.id)) {
        res.status(400).json({ error: "Invalid manifest id" });
        return;
      }

      if (registry.find(d => d.manifest.id === manifest.id)) {
        res.status(409).json({ error: "DApp already installed" });
        return;
      }

      const dappDir = path.join(DAPP_DIR, manifest.id);
      if (!fs.existsSync(dappDir)) {
        fs.mkdirSync(dappDir, { recursive: true });
      }

      // Write a small index.html that redirects / proxies to the hosted URL
      const entryUrl = typeof url === 'string' ? url : '';
      const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const safeName = escapeHtml(String(manifest.name || 'DApp'));
      const safeUrl = escapeHtml(entryUrl);
      const indexContent = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${safeName}</title></head>
<body style="margin:0;overflow:hidden">
<iframe src="${safeUrl}" style="border:0;width:100vw;height:100vh" sandbox="allow-scripts allow-forms allow-popups"></iframe>
<script>
// PiNet Bridge Relay — forward postMessage from inner iframe to parent host
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'pinet-bridge-request') {
    window.parent.postMessage(e.data, '*');
  }
});
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'pinet-bridge-response') {
    var f = document.querySelector('iframe');
    if (f && f.contentWindow) f.contentWindow.postMessage(e.data, '*');
  }
});
</script>
</body></html>`;
      fs.writeFileSync(path.join(dappDir, 'index.html'), indexContent);

      // Write the manifest as dapp.json
      fs.writeFileSync(path.join(dappDir, 'dapp.json'), JSON.stringify(manifest, null, 2));

      const record: DAppRecord = {
        manifest: {
          id: manifest.id,
          name: manifest.name || manifest.id,
          description: manifest.description || '',
          version: manifest.version || '1.0.0',
          author: manifest.author || 'Unknown',
          kind: manifest.kind === 'minidapp' ? 'minidapp' : 'typescript',
          icon: manifest.icon,
          color: manifest.color,
          entryPoint: manifest.entryPoint || 'index.html',
          permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
          homepage: manifest.homepage,
          minPinetVersion: manifest.minPinetVersion,
        },
        installPath: dappDir,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'installed',
      };

      registry.push(record);
      saveDAppRegistry(registry);
      res.json(record);
      return;
    }

    if (typeof url === 'string' && url.trim()) {
      // URL install mode — for now register with a generated manifest from the URL
      // A full implementation would download and extract the archive here
      const urlObj = new URL(url);
      const fileName = path.basename(urlObj.pathname);
      const baseName = fileName.replace(/\.(zip|tar\.gz|mds\.zip)$/i, '');
      const dappId = baseName.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();

      if (!isValidDAppId(dappId)) {
        res.status(400).json({ error: "Could not derive a valid DApp ID from the URL" });
        return;
      }

      if (registry.find(d => d.manifest.id === dappId)) {
        res.status(409).json({ error: "DApp already installed" });
        return;
      }

      const isMiniDapp = url.endsWith('.mds.zip');
      const dappDir = path.join(DAPP_DIR, dappId);
      if (!fs.existsSync(dappDir)) {
        fs.mkdirSync(dappDir, { recursive: true });
      }

      // Create a placeholder index.html pointing to the source
      const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const safeBaseName = escHtml(baseName);
      const safeUrlStr = escHtml(url);
      const indexContent = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${safeBaseName}</title></head>
<body style="margin:0;font-family:sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh">
<div style="text-align:center;max-width:400px">
<h1 style="font-size:1.5rem">${safeBaseName}</h1>
<p style="color:#94a3b8;font-size:0.875rem">DApp installed from: ${safeUrlStr}</p>
<p style="color:#64748b;font-size:0.75rem;margin-top:1rem">Archive extraction pending. The full DApp content will be available once the archive is downloaded and extracted.</p>
</div></body></html>`;
      fs.writeFileSync(path.join(dappDir, 'index.html'), indexContent);

      const record: DAppRecord = {
        manifest: {
          id: dappId,
          name: baseName,
          description: `Installed from ${url}`,
          version: '1.0.0',
          author: 'Unknown',
          kind: isMiniDapp ? 'minidapp' : 'typescript',
          entryPoint: 'index.html',
          permissions: [],
        },
        installPath: dappDir,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'installed',
      };

      registry.push(record);
      saveDAppRegistry(registry);
      res.json(record);
      return;
    }

    res.status(400).json({ error: "Provide a 'url' or a 'manifest' in the request body" });
  });

  // POST /api/dapps/:id/uninstall — remove a DApp
  app.post("/api/dapps/:id/uninstall", (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!dappInstallLimiter.check(clientIp)) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }
    const { id } = req.params;
    if (!isValidDAppId(id)) {
      res.status(400).json({ error: "Invalid DApp ID" });
      return;
    }
    const registry = loadDAppRegistry();
    const idx = registry.findIndex(d => d.manifest.id === id);
    if (idx === -1) {
      res.status(404).json({ error: "DApp not found" });
      return;
    }

    const dapp = registry[idx];

    // Remove files — only within the DAPP_DIR
    const installDir = dapp.installPath;
    const resolvedInstallDir = path.resolve(installDir);
    const resolvedDappDir = path.resolve(DAPP_DIR);
    if (resolvedInstallDir.startsWith(resolvedDappDir) && fs.existsSync(installDir)) {
      fs.rmSync(installDir, { recursive: true, force: true });
    }

    registry.splice(idx, 1);
    saveDAppRegistry(registry);
    res.json({ success: true });
  });

  // GET /api/dapps/:id/serve/* — serve DApp static files
  app.get("/api/dapps/:id/serve/*", (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!dappServeLimiter.check(clientIp)) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }
    const { id } = req.params;
    if (!isValidDAppId(id)) {
      res.status(400).json({ error: "Invalid DApp ID" });
      return;
    }

    const registry = loadDAppRegistry();
    const dapp = registry.find(d => d.manifest.id === id);
    if (!dapp) {
      res.status(404).json({ error: "DApp not found" });
      return;
    }

    // Extract the wildcard portion — Express 5 provides it as req.params[0]
    const wildcardParam = (req.params as Record<string, string>)[0] || 'index.html';
    // Strip query strings and decode
    const cleanPath = decodeURIComponent(wildcardParam.split('?')[0]);
    const filePath = path.join(dapp.installPath, cleanPath);
    const resolvedPath = path.resolve(filePath);
    const resolvedInstall = path.resolve(dapp.installPath);

    // Path traversal prevention
    if (!resolvedPath.startsWith(resolvedInstall + path.sep) && resolvedPath !== resolvedInstall) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.sendFile(resolvedPath);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OS Kernel & System Management API Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  // Lazy-load OS services to avoid circular imports at startup
  const getKernelModules = async () => {
    const [
      { processManager },
      { memoryManager },
      { scheduler },
      { initSystem },
      { syslog },
      { userService },
      { ipcService },
      { deviceManager },
      { securityService },
      { networkService },
      { powerManager },
      { listSyscalls, getSyscallCount },
    ] = await Promise.all([
      import('./kernel/processManager.js'),
      import('./kernel/memoryManager.js'),
      import('./kernel/scheduler.js'),
      import('./kernel/init.js'),
      import('./services/syslogService.js'),
      import('./services/userService.js'),
      import('./services/ipcService.js'),
      import('./services/deviceManager.js'),
      import('./services/securityService.js'),
      import('./services/networkService.js'),
      import('./services/powerService.js'),
      import('./kernel/syscalls.js'),
    ]);
    return { processManager, memoryManager, scheduler, initSystem, syslog, userService, ipcService, deviceManager, securityService, networkService, powerManager, listSyscalls, getSyscallCount };
  };

  // ─── Process Manager API ──────────────────────────────────────────────

  app.get("/api/kernel/processes", async (_req, res) => {
    try {
      const { processManager } = await getKernelModules();
      res.json({ processes: processManager.listProcesses(), count: processManager.getProcessCount() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/kernel/processes/tree", async (_req, res) => {
    try {
      const { processManager } = await getKernelModules();
      res.json(processManager.getProcessTree(0));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/kernel/processes/top", async (req, res) => {
    try {
      const { processManager } = await getKernelModules();
      const sortBy = req.query.sort === 'memory' ? 'memory' : 'cpu';
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
      const procs = sortBy === 'memory' ? processManager.getTopByMemory(limit) : processManager.getTopByCpu(limit);
      res.json({ processes: procs, sortBy, limit });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/kernel/processes/:pid/signal", async (req, res) => {
    try {
      const { processManager } = await getKernelModules();
      const pid = parseInt(req.params.pid, 10);
      const { signal } = req.body;
      if (!signal || isNaN(pid)) { res.status(400).json({ error: "Missing pid or signal" }); return; }

      // Validate signal — only allow known POSIX signal names
      const ALLOWED_SIGNALS = new Set(['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGHUP', 'SIGUSR1', 'SIGUSR2', 'SIGSTOP', 'SIGCONT']);
      if (typeof signal !== 'string' || !ALLOWED_SIGNALS.has(signal.toUpperCase())) {
        res.status(400).json({ error: `Invalid signal. Allowed: ${[...ALLOWED_SIGNALS].join(', ')}` }); return;
      }

      const ok = processManager.sendSignal(pid, signal);
      res.json({ success: ok, pid, signal });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/kernel/processes/spawn", async (req, res) => {
    try {
      const { processManager } = await getKernelModules();
      const { name, command, args: cmdArgs, cwd: procCwd } = req.body;
      if (!name || !command) { res.status(400).json({ error: "Missing name or command" }); return; }

      // Validate command against allowlist
      if (typeof command !== 'string' || !ALLOWED_SPAWN_COMMANDS.has(command)) {
        res.status(400).json({ error: `Command not allowed. Permitted: ${[...ALLOWED_SPAWN_COMMANDS].join(', ')}` }); return;
      }

      // Validate name
      if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name)) {
        res.status(400).json({ error: "Invalid process name" }); return;
      }

      // Validate args
      const safeArgs = Array.isArray(cmdArgs) ? cmdArgs : [];
      if (!safeArgs.every(isSafeArg)) {
        res.status(400).json({ error: "Invalid arguments" }); return;
      }

      // Validate cwd — must be an absolute path with no shell metacharacters
      const safeCwd = typeof procCwd === 'string' && /^\/[a-zA-Z0-9/_.-]*$/.test(procCwd) ? procCwd : '/';

      const proc = processManager.spawn(1, name, command, safeArgs, {}, safeCwd);
      res.json({ success: true, process: proc });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Memory Manager API ───────────────────────────────────────────────

  app.get("/api/kernel/memory", async (_req, res) => {
    try {
      const { memoryManager } = await getKernelModules();
      res.json(memoryManager.getMemoryStats());
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/kernel/memory/:pid", async (req, res) => {
    try {
      const { memoryManager } = await getKernelModules();
      const pid = parseInt(req.params.pid, 10);
      res.json(memoryManager.getProcessMemory(pid));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Scheduler API ────────────────────────────────────────────────────

  app.get("/api/kernel/scheduler", async (_req, res) => {
    try {
      const { scheduler } = await getKernelModules();
      res.json({ stats: scheduler.getStats(), entries: scheduler.getAllEntries() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/kernel/scheduler/cron", async (_req, res) => {
    try {
      const { scheduler } = await getKernelModules();
      res.json({ jobs: scheduler.getCronJobs() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/kernel/scheduler/cron", async (req, res) => {
    try {
      const { scheduler } = await getKernelModules();
      const { id, name, schedule: cronSchedule, command, args: cronArgs, uid } = req.body;
      if (!id || !name || !cronSchedule || !command) { res.status(400).json({ error: "Missing required fields" }); return; }

      // Validate cron job fields
      if (!isSafeCronId(id) || !isSafeCronId(name)) {
        res.status(400).json({ error: "Invalid id or name" }); return;
      }
      if (!isSafeCronSchedule(cronSchedule)) {
        res.status(400).json({ error: "Invalid cron schedule format" }); return;
      }
      if (typeof command !== 'string' || !ALLOWED_SPAWN_COMMANDS.has(command)) {
        res.status(400).json({ error: "Command not allowed" }); return;
      }
      const safeArgs = Array.isArray(cronArgs) ? cronArgs : [];
      if (!safeArgs.every(isSafeArg)) {
        res.status(400).json({ error: "Invalid arguments" }); return;
      }

      scheduler.addCronJob({ id, name, schedule: cronSchedule, command, args: safeArgs, uid: uid ?? 0, enabled: true });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Init System / Services API ───────────────────────────────────────

  app.get("/api/kernel/services", async (_req, res) => {
    try {
      const { initSystem } = await getKernelModules();
      res.json({ services: initSystem.listServices(), runLevel: initSystem.getRunLevel(), uptime: initSystem.getUptime() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/kernel/services/:name", async (req, res) => {
    try {
      const { initSystem } = await getKernelModules();
      const { name } = req.params;
      if (!isSafeServiceName(name)) { res.status(400).json({ error: "Invalid service name" }); return; }
      const svc = initSystem.getService(name);
      if (!svc) { res.status(404).json({ error: "Service not found" }); return; }
      res.json(svc);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/kernel/services/:name/:action", async (req, res) => {
    try {
      const { initSystem } = await getKernelModules();
      const { name, action: svcAction } = req.params;

      // Validate service name to prevent injection
      if (!isSafeServiceName(name)) {
        res.status(400).json({ error: "Invalid service name" }); return;
      }

      let result;
      switch (svcAction) {
        case 'start': result = await initSystem.startService(name); break;
        case 'stop': result = await initSystem.stopService(name); break;
        case 'restart': result = await initSystem.restartService(name); break;
        case 'reload': result = await initSystem.reloadService(name); break;
        case 'enable': initSystem.enableService(name, true); result = { success: true }; break;
        case 'disable': initSystem.enableService(name, false); result = { success: true }; break;
        default: res.status(400).json({ error: `Unknown action: ${svcAction}` }); return;
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/kernel/targets", async (_req, res) => {
    try {
      const { initSystem } = await getKernelModules();
      res.json({ targets: initSystem.listTargets(), currentRunLevel: initSystem.getRunLevel() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/kernel/services-log", async (req, res) => {
    try {
      const { initSystem } = await getKernelModules();
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
      res.json({ logs: initSystem.getAllLogs(limit) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Syscall API ──────────────────────────────────────────────────────

  app.get("/api/kernel/syscalls", async (_req, res) => {
    try {
      const { listSyscalls, getSyscallCount } = await getKernelModules();
      res.json({ syscalls: listSyscalls(), totalExecuted: getSyscallCount() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Syslog API ───────────────────────────────────────────────────────

  app.get("/api/syslog", async (req, res) => {
    try {
      const { syslog } = await getKernelModules();
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
      const facility = req.query.facility as string | undefined;
      const severity = req.query.severity as string | undefined;
      const process = req.query.process as string | undefined;
      const search = req.query.search as string | undefined;
      res.json({ logs: syslog.query({ facility: facility as any, severity: severity as any, process, search, limit }) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/syslog/stats", async (_req, res) => {
    try {
      const { syslog } = await getKernelModules();
      res.json(syslog.getStats());
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/syslog/processes", async (_req, res) => {
    try {
      const { syslog } = await getKernelModules();
      res.json({ processes: syslog.getProcesses() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── User Management API ──────────────────────────────────────────────

  app.get("/api/users", async (_req, res) => {
    try {
      const { userService } = await getKernelModules();
      res.json({ users: userService.listUsers(), groups: userService.listGroups(), sessions: userService.getActiveSessions() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/users/:uid", async (req, res) => {
    try {
      const { userService } = await getKernelModules();
      const uid = parseInt(req.params.uid, 10);
      const user = userService.getUser(uid);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }
      res.json(user);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const { userService } = await getKernelModules();
      const { username, fullName, password, shell: userShell, groups: userGroups, sudoer } = req.body;
      if (!username || !fullName || !password) { res.status(400).json({ error: "Missing required fields" }); return; }
      const user = userService.createUser(username, fullName, password, { shell: userShell, groups: userGroups, sudoer });
      if (!user) { res.status(409).json({ error: "User already exists" }); return; }
      res.json({ success: true, user });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/users/:uid", async (req, res) => {
    try {
      const { userService } = await getKernelModules();
      const uid = parseInt(req.params.uid, 10);
      const ok = userService.deleteUser(uid);
      res.json({ success: ok });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
      if (!authLoginLimiter.check(ip)) { res.status(429).json({ error: "Too many login attempts. Try again later." }); return; }
      const { userService } = await getKernelModules();
      const { username, password } = req.body;
      if (!username || !password) { res.status(400).json({ error: "Missing credentials" }); return; }
      const result = userService.authenticate(username, password);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── IPC / D-Bus API ──────────────────────────────────────────────────

  app.get("/api/ipc/services", async (_req, res) => {
    try {
      const { ipcService } = await getKernelModules();
      res.json({ services: ipcService.listBusServices(), channels: ipcService.listChannels(), stats: ipcService.getStats() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/ipc/messages", async (req, res) => {
    try {
      const { ipcService } = await getKernelModules();
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      res.json({ messages: ipcService.getRecentMessages(limit) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Device Manager API ───────────────────────────────────────────────

  app.get("/api/devices", async (_req, res) => {
    try {
      const { deviceManager } = await getKernelModules();
      res.json({ devices: deviceManager.listDevices(), tree: deviceManager.getDeviceTree(), stats: deviceManager.getStats() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/devices/:id", async (req, res) => {
    try {
      const { deviceManager } = await getKernelModules();
      const dev = deviceManager.getDevice(req.params.id);
      if (!dev) { res.status(404).json({ error: "Device not found" }); return; }
      res.json(dev);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/devices/events/recent", async (req, res) => {
    try {
      const { deviceManager } = await getKernelModules();
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      res.json({ events: deviceManager.getEvents(limit) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/devices/rules/list", async (_req, res) => {
    try {
      const { deviceManager } = await getKernelModules();
      res.json({ rules: deviceManager.listRules() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Security API ─────────────────────────────────────────────────────

  app.get("/api/security/dashboard", async (_req, res) => {
    try {
      const { securityService } = await getKernelModules();
      res.json(securityService.getDashboard());
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/security/policies", async (_req, res) => {
    try {
      const { securityService } = await getKernelModules();
      res.json({ policies: securityService.listPolicies() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/security/audit", async (req, res) => {
    try {
      const { securityService } = await getKernelModules();
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
      const type = req.query.type as string | undefined;
      res.json({ events: securityService.queryAudit({ type: type as any, limit }) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/security/profiles", async (_req, res) => {
    try {
      const { securityService } = await getKernelModules();
      res.json({ profiles: securityService.listProfiles() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/security/integrity", async (req, res) => {
    try {
      const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
      if (!securityCheckLimiter.check(ip)) { res.status(429).json({ error: "Rate limit exceeded" }); return; }
      const { securityService } = await getKernelModules();
      res.json(securityService.verifyIntegrity());
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/security/threats", async (_req, res) => {
    try {
      const { securityService } = await getKernelModules();
      res.json({ threats: securityService.getThreats(), open: securityService.getOpenThreats().length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Network Manager API ──────────────────────────────────────────────

  app.get("/api/network/interfaces", async (_req, res) => {
    try {
      const { networkService } = await getKernelModules();
      res.json({ interfaces: networkService.listInterfaces(), stats: networkService.getNetworkStats() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/network/routes", async (_req, res) => {
    try {
      const { networkService } = await getKernelModules();
      res.json({ routes: networkService.getRoutes() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/network/dns", async (_req, res) => {
    try {
      const { networkService } = await getKernelModules();
      res.json(networkService.getDNSConfig());
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/network/firewall", async (_req, res) => {
    try {
      const { networkService } = await getKernelModules();
      res.json({ rules: networkService.getFirewallRules() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/network/wireguard", async (_req, res) => {
    try {
      const { networkService } = await getKernelModules();
      res.json({ interfaces: networkService.getWireGuardInterfaces() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/network/interfaces/:name", async (req, res) => {
    try {
      const { networkService } = await getKernelModules();
      const name = req.params.name;

      // Validate interface name
      if (!isSafeInterfaceName(name)) {
        res.status(400).json({ error: "Invalid interface name" }); return;
      }

      const { state: ifaceState, address, netmask, mtu } = req.body;
      if (ifaceState) networkService.setInterfaceState(name, ifaceState);
      if (address && netmask) networkService.setInterfaceAddress(name, address, netmask);
      if (mtu) networkService.setMTU(name, mtu);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Power Manager API ────────────────────────────────────────────────

  app.get("/api/power", async (_req, res) => {
    try {
      const { powerManager } = await getKernelModules();
      res.json({
        info: powerManager.getPowerInfo(),
        watchdog: powerManager.getWatchdogStatus(),
        scheduledShutdown: powerManager.getScheduledShutdown(),
        governors: powerManager.getAvailableGovernors(),
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/power/state", async (req, res) => {
    try {
      const { powerManager } = await getKernelModules();
      const { state: pwrState } = req.body;
      if (!pwrState) { res.status(400).json({ error: "Missing state" }); return; }
      const result = await powerManager.requestStateChange(pwrState);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/power/governor", async (req, res) => {
    try {
      const { powerManager } = await getKernelModules();
      const { governor } = req.body;
      const ok = powerManager.setGovernor(governor);
      res.json({ success: ok });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/power/schedule", async (req, res) => {
    try {
      const { powerManager } = await getKernelModules();
      const { action: schedAction, delayMs } = req.body;
      if (!schedAction || !delayMs) { res.status(400).json({ error: "Missing action or delay" }); return; }
      const result = powerManager.scheduleShutdown(schedAction, delayMs);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // End of OS Kernel & System Management API
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/download-full-project", (req, res) => {
    const zipPath = path.join(process.cwd(), "Minima-PiNet-Os-Full.zip");
    if (fs.existsSync(zipPath)) {
      res.download(zipPath, "Minima-PiNet-Os-Full.zip");
    } else {
      res.status(404).send("File not found");
    }
  });

  app.get("/api/download-pinetos", (req, res) => {
    const zipPath = path.join(process.cwd(), "PiNetOS-Enterprise.zip");
    if (fs.existsSync(zipPath)) {
      res.download(zipPath, "PiNetOS-Enterprise.zip");
    } else {
      res.status(404).send("File not found");
    }
  });

  app.get("/api/download-electron", (req, res) => {
    const zipPath = path.join(process.cwd(), "PiNetOS-Electron-Desktop.zip");
    if (fs.existsSync(zipPath)) {
      res.download(zipPath, "PiNetOS-Electron-Desktop.zip");
    } else {
      res.status(404).send("File not found");
    }
  });

  app.get("/api/download-os-build", (req, res) => {
    const zipPath = path.join(process.cwd(), "PiNetOS-Build-System.zip");
    if (fs.existsSync(zipPath)) {
      res.download(zipPath, "PiNetOS-Build-System.zip");
    } else {
      res.status(404).send("File not found");
    }
  });

  app.get("/api/download-os-docs", (req, res) => {
    const zipPath = path.join(process.cwd(), "PiNetOS-Documentation.zip");
    if (fs.existsSync(zipPath)) {
      res.download(zipPath, "PiNetOS-Documentation.zip");
    } else {
      res.status(404).send("File not found");
    }
  });

  app.get("/api/download-os-image", (req, res) => {
    const imgPath = path.join(process.cwd(), "PiNetOS-RaspberryPi.img");
    if (fs.existsSync(imgPath)) {
      res.download(imgPath, "PiNetOS-RaspberryPi.img");
    } else {
      res.status(404).send("File not found");
    }
  });

  // Global API Error Handler
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[API Error] ${req.method} ${req.url}:`, err);
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      path: req.url
    });
  });

  // 404 for API routes
  app.use('/api', (req, res) => {
    console.warn(`[API 404] ${req.method} ${req.url}`);
    res.status(404).json({ error: "Not Found", path: req.url });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
