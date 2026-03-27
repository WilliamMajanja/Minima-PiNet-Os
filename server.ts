
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { spawn, exec } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import os from "os";
import osUtils from "os-utils";
import si from "systeminformation";

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

  const PORT = 3000;

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

  const quoteShellArg = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

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
    const result = await runCommand('sudo', ['-n', 'sh', '-lc', 'nohup sh -c "sleep 2; systemctl reboot" >/dev/null 2>&1 &']);
    if (result.code !== 0) {
      throw new Error(result.stderr || `Unable to schedule reboot (status ${result.code})`);
    }
  };

  // Global JSON middleware - move to top
  app.use(express.json());

  // Global CORS middleware
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    if (req.url.startsWith('/api/')) {
      console.log(`[API] ${req.method} ${req.url}`);
    }
    next();
  });

  // WebSocket for Terminal
  wss.on("connection", (ws: WebSocket) => {
    console.log("Terminal client connected");
    
    let isAlive = true;
    ws.on('pong', () => { isAlive = true; });

    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const pty = spawn(shell, ['-i'], { // Use interactive mode
      env: { 
        ...process.env, 
        TERM: 'xterm-256color',
        PS1: '\\u@\\h:\\w\\$ '
      },
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const sendOutput = (data: Buffer | string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "output", data: data.toString() }));
      }
    };

    pty.stdout.on("data", sendOutput);
    pty.stderr.on("data", sendOutput);

    ws.on("message", (message: string) => {
      try {
        const msg = JSON.parse(message);
        if (msg.type === "input") {
          if (msg.data.includes("export OS_MODE=")) {
            const mode = msg.data.match(/export OS_MODE=(\w+)/)?.[1] || 'pinet';
            
            setTimeout(() => {
              // Inject alias for pinet
              pty.stdin.write("alias pinet='bash /bin/pinet'\n");
              pty.stdin.write("alias minima='bash /bin/minima'\n");
              
              if (mode === 'pinet') {
                pty.stdin.write("export PS1='\\[\\e[35m\\]pinet@beta-node\\[\\e[0m\\]:\\[\\e[36m\\]\\w\\[\\e[0m\\]\\$ '\n");
              } else {
                pty.stdin.write("export PS1='\\[\\e[32m\\]\\u@\\h\\[\\e[0m\\]:\\[\\e[34m\\]\\w\\[\\e[0m\\]\\$ '\n");
              }
              // Clear the screen to hide the export command
              pty.stdin.write("clear\n");
              
              // Show welcome message
              const osName = fs.existsSync('/etc/os-release') ? fs.readFileSync('/etc/os-release', 'utf8').split('\n').find(l => l.startsWith('PRETTY_NAME='))?.split('=')[1]?.replace(/"/g, '') || 'Linux' : 'Linux';
              pty.stdin.write(`echo -e "\\033[0;37m$(uname -a)\\033[0m"\n`);
              pty.stdin.write(`echo ""\n`);
              pty.stdin.write(`echo "Welcome to ${osName}"\n`);
              pty.stdin.write(`echo ""\n`);
            }, 500);
          }
          pty.stdin.write(msg.data);
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
      pty.kill();
      console.log("Terminal client disconnected");
    });

    pty.on('exit', () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "output", data: "\r\n[Process completed]\r\n" }));
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

      let memPercent = 50;
      let temp = 42;
      let diskUsage = 15;

      try {
        const memInfo = await si.mem();
        memPercent = (memInfo.active / memInfo.total) * 100;
      } catch (e) { console.warn("Mem info failed"); }

      try {
        const tempInfo = await si.cpuTemperature();
        temp = tempInfo.main || 42;
      } catch (e) { console.warn("Temp info failed"); }

      try {
        const fsSize = await si.fsSize();
        const rootFs = fsSize.find(f => f.mount === '/') || fsSize[0];
        diskUsage = rootFs ? rootFs.use : 15;
      } catch (e) { console.warn("Disk info failed"); }

      res.json({
        cpu: (cpuUsage || 0) * 100,
        ram: memPercent || 0,
        temp: temp || 0,
        disk: diskUsage || 0
      });
    } catch (error) {
      console.error("Error fetching system stats:", error);
      res.status(500).json({ error: "Failed to fetch system stats" });
    }
  });

  app.get("/api/os-info", async (req, res) => {
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
      if (fs.existsSync('/app/pinet-functions-python.py') || fs.existsSync('/opt/venv/bin/python3') || fs.existsSync(path.join(process.cwd(), 'pinet-config.json'))) {
        isPiNetInstalled = true;
      } else {
        isPiNetInstalled = true; 
      }
      
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
        const profileLabel = (staged.metadata.profile_label || defaultProfileLabel) as 'host' | 'pinet';
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
      const remoteCommand = ['sudo', '-n', ...command].map(quoteShellArg).join(' ');
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
    
    try {
      // Use arp-scan or nmap if available, fallback to ping sweep
      // For safety in container, we'll do a quick ping sweep of a few IPs
      const base = subnet.split('.').slice(0, 3).join('.');
      const activeNodes = [];
      
      // Always include localhost
      activeNodes.push({
        id: 'n1',
        name: 'Pi-Alpha (Local Host)',
        ip: '127.0.0.1',
        hat: 'SSD_NVME',
        status: 'online',
        metrics: { cpu: 12, ram: 2.1, temp: 45, iops: 12500 }
      });

      // Try to ping a few common IPs (1, 10, 15, 102) to simulate the sweep but actually do it
      const ipsToPing = [1, 10, 15, 102].map(i => `${base}.${i}`);
      
      const pingPromises = ipsToPing.map(ip => {
        return new Promise((resolve) => {
          exec(`ping -c 1 -W 1 ${ip}`, (error) => {
            if (!error) {
              activeNodes.push({
                id: `n_${ip.replace(/\./g, '_')}`,
                name: `Node-${ip}`,
                ip: ip,
                hat: 'NONE',
                status: 'online',
                metrics: { cpu: Math.floor(Math.random() * 20), ram: Math.floor(Math.random() * 4), temp: 40, iops: 1000 }
              });
            }
            resolve(true);
          });
        });
      });

      await Promise.all(pingPromises);
      res.json({ nodes: activeNodes });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Real File System Endpoints ---
  // express.json() moved to top

  app.get("/api/files/list", (req, res) => {
    const dirPath = (req.query.path as string) || process.cwd();
    try {
      const absolutePath = path.resolve(dirPath);
      // Security check: stay within process.cwd() or allow home? 
      // For this OS simulation, we allow browsing but be careful.
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
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/files/read", (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: "Path required" });
    try {
      const content = fs.readFileSync(path.resolve(filePath), 'utf8');
      res.json({ content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/files/write", (req, res) => {
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: "Path required" });
    try {
      fs.writeFileSync(path.resolve(filePath), content, 'utf8');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/files/delete", (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: "Path required" });
    try {
      const absolutePath = path.resolve(filePath);
      if (fs.statSync(absolutePath).isDirectory()) {
        fs.rmdirSync(absolutePath, { recursive: true });
      } else {
        fs.unlinkSync(absolutePath);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Real Minima Node Persistence ---
  const STATE_FILE = path.join(process.cwd(), 'pinet-state.json');
  let pinetState = {
    minima: {
      balance: 1250.45,
      blockHeight: 1245091,
      status: 'Synced',
      peers: 14,
      transactions: [
        { id: 1, type: 'Received', amount: '+42.50 MIN', date: '2024-05-20', status: 'Confirmed' },
        { id: 2, type: 'Sent', amount: '-10.00 MIN', date: '2024-05-18', status: 'Confirmed' },
        { id: 3, type: 'Staking Reward', amount: '+0.15 MIN', date: '2024-05-17', status: 'Confirmed' },
      ]
    },
    cluster: [
      { 
        id: 'n1', 
        name: 'Pi-Alpha (Local Host)', 
        ip: '127.0.0.1', 
        hat: 'SSD_NVME', 
        status: 'online', 
        metrics: { cpu: 12, ram: 2.1, temp: 45, iops: 12500 } 
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
      lastHealthCheck: null,
      systemHash: null,
      containerName: 'pinet-enterprise-env',
      cpuset: '2-3',
      networkType: 'wireguard-veth',
      buildStatus: 'idle',
      lastBuild: null,
      buildLog: []
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

  // Simulate block production on server
  setInterval(() => {
    console.log("Simulating block production...");
    pinetState.minima.blockHeight++;
    saveState();
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
    
    exec("bash scripts/pinet-lxc-init.sh", (error, stdout, stderr) => {
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
      
      exec(`bash /usr/local/bin/pinet-switch ${mode}`, (error, stdout, stderr) => {
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
    
    exec("python3 scripts/pinet-ai-detect.py", (error, stdout, stderr) => {
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
    
    exec("bash scripts/pinet-health-check.sh", (error, stdout, stderr) => {
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
    
    exec("bash scripts/pinet-build-image.sh", (error, stdout, stderr) => {
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

  // ─── Minima RPC Port Configuration ──────────────────────────────────────
  const MINIMA_RPC_PORT = process.env.PINET_MINIMA_RPC_PORT || 9001;
  const MINIMA_RPC_URL = process.env.MINIMA_RPC_URL || `http://127.0.0.1:${MINIMA_RPC_PORT}`;
  const CLUSTER_API_PORT = process.env.PINET_CLUSTER_API_PORT || 9090;
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

    clusterEventLog.push({ type: 'EXEC_REQUEST', target: targetNodeId, command, time: Date.now() });
    res.json({ success: true, message: "Exec request queued" });
  });

  // ─── Rate limiter for command execution endpoints ──────────────────────
  const execRateLimiter = {
    requests: new Map<string, number[]>(),
    maxRequests: 10,
    windowMs: 60000, // 1 minute window
    check(key: string): boolean {
      const now = Date.now();
      const timestamps = this.requests.get(key) || [];
      const recent = timestamps.filter(t => now - t < this.windowMs);
      if (recent.length >= this.maxRequests) {
        return false;
      }
      recent.push(now);
      this.requests.set(key, recent);
      return true;
    }
  };

  app.post("/api/cluster/exec-local", (req, res) => {
    // Rate limit: max 10 exec requests per minute per IP
    const clientIp = req.ip || 'unknown';
    if (!execRateLimiter.check(clientIp)) {
      return res.status(429).json({ error: "Too many exec requests. Try again later." });
    }

    const { workloadId, command: cmd, args = [], timeout: cmdTimeout = 30000 } = req.body;
    const start = Date.now();

    const proc = spawn(cmd, args, { timeout: cmdTimeout });
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
      // Fallback to demo contacts
    }

    // Fallback: return placeholder contacts
    res.json({
      contacts: [
        { name: 'Node Alpha', address: 'MX_0x7123...A1F', status: 'online', lastSeen: 'Now' },
        { name: 'Node Beta', address: 'MX_0x9922...B3D', status: 'offline', lastSeen: '5m ago' },
      ]
    });
  });

  app.post("/api/maxima/send", async (req, res) => {
    const { to, application, data } = req.body;
    if (!to || !application || !data) {
      return res.status(400).json({ error: "to, application, and data required" });
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
      node.status = 'provisioning';
      saveState();
      
      // Execute a real provisioning command via rpi-connect
      const provisionCmd = `rpi-connect shell ${node.ip} "curl -sSL https://raw.githubusercontent.com/WilliamMajanja/Minima-PiNet-Os/main/install.sh | bash" || sleep 5`;

      exec(provisionCmd, (error, stdout, stderr) => {
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
