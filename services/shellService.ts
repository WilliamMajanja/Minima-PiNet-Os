
import { VFSNode } from '../types';

class ShellService {
  private vfs: VFSNode;
  private currentPath: string = '/home/pi';
  private user: string = 'pi';

  constructor() {
    this.vfs = {
      name: '/',
      type: 'dir',
      modified: Date.now(),
      permissions: 'drwxr-xr-x',
      children: [
        {
          name: 'bin',
          type: 'dir',
          modified: Date.now(),
          permissions: 'drwxr-xr-x',
          children: [
            { name: 'minima', type: 'file', content: 'BINARY_DATA', modified: Date.now(), permissions: '-rwxr-xr-x' },
            { name: 'cluster', type: 'file', content: 'BINARY_DATA', modified: Date.now(), permissions: '-rwxr-xr-x' },
            { name: 'ai-gateway', type: 'file', content: 'BINARY_DATA', modified: Date.now(), permissions: '-rwxr-xr-x' },
          ]
        },
        {
          name: 'etc',
          type: 'dir',
          modified: Date.now(),
          permissions: 'drwxr-xr-x',
          children: [
            { name: 'cluster.json', type: 'file', content: '{"nodes": ["n1", "n2", "n3"], "master": "n1"}', modified: Date.now(), permissions: '-rw-r--r--' },
            { 
              name: 'os-release', 
              type: 'file', 
              content: `PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nNAME="Debian GNU/Linux"\nVERSION_CODENAME=bookworm\nID=debian\nHOME_URL="https://www.debian.org/"\nSUPPORT_URL="https://www.debian.org/support"\nBUG_REPORT_URL="https://bugs.debian.org/"`, 
              modified: Date.now(), 
              permissions: '-rw-r--r--' 
            },
            {
                name: 'hostname',
                type: 'file',
                content: 'raspberrypi',
                modified: Date.now(),
                permissions: '-rw-r--r--'
            },
            {
                name: 'systemd',
                type: 'dir',
                modified: Date.now(),
                permissions: 'drwxr-xr-x',
                children: [
                    {
                        name: 'system',
                        type: 'dir',
                        modified: Date.now(),
                        permissions: 'drwxr-xr-x',
                        children: [
                            {
                                name: 'minima.service',
                                type: 'file',
                                content: `[Unit]\nDescription=Minima\nAfter=network.target\n[Service]\nUser=pi\nGroup=pi\nType=simple\nExecStart=/usr/bin/java -jar /home/pi/minima.jar -data /home/pi/.minima -rpcenable -port 9001 -rpcport 9002\nRestart=always\nRestartSec=10\n[Install]\nWantedBy=multi-user.target`,
                                modified: Date.now(),
                                permissions: '-rw-r--r--'
                            }
                        ]
                    }
                ]
            }
          ]
        },
        {
          name: 'home',
          type: 'dir',
          modified: Date.now(),
          permissions: 'drwxr-xr-x',
          children: [
            {
              name: 'pi',
              type: 'dir',
              modified: Date.now(),
              permissions: 'drwxr-xr-x',
              children: [
                {
                    name: '.minima',
                    type: 'dir',
                    modified: Date.now(),
                    permissions: 'drwxr-xr-x',
                    children: [
                        {
                            name: 'minima.conf',
                            type: 'file',
                            content: 'host=0.0.0.0\nrpcenable=true\nport=9001\nrpcport=9002\nmdsenable=true\n',
                            modified: Date.now(),
                            permissions: '-rw-r--r--'
                        },
                        {
                            name: 'mds',
                            type: 'dir',
                            modified: Date.now(),
                            permissions: 'drwxr-xr-x',
                            children: []
                        }
                    ]
                },
                { name: 'minima.jar', type: 'file', content: 'BINARY_JAR', modified: Date.now(), permissions: '-rwxr-xr-x' },
                { name: 'README.txt', type: 'file', content: 'Welcome to PiNet Web3 OS\n\nThis node is part of a decentralized cluster.', modified: Date.now(), permissions: '-rw-r--r--' },
                { name: '.bashrc', type: 'file', content: '# ~/.bashrc: executed by bash(1) for non-login shells.', modified: Date.now(), permissions: '-rw-------' },
                { 
                  name: 'pinet-os', 
                  type: 'dir', 
                  modified: Date.now(), 
                  permissions: 'drwxr-xr-x', 
                  children: [
                    {
                      name: 'build.sh',
                      type: 'file',
                      content: '#!/bin/bash\nset -e\necho "🚀 Building PiNetOS..."\nmkdir -p tools/output\nsudo ./raspi-image-gen/build.sh \\\n  -c images/pinetos/config \\\n  -o tools/output \\\n  -n PiNetOS\necho "✅ Image built: tools/output/PiNetOS.img"',
                      modified: Date.now(),
                      permissions: '-rwxr-xr-x'
                    },
                    {
                      name: 'README.md',
                      type: 'file',
                      content: '# PiNetOS\n\nPiNetOS is a hardened Raspberry Pi Operating System designed for kiosk, wallet, and fleet deployments.\n\nFeatures:\n- Secure boot + measured boot\n- A/B OTA rollback\n- Signed updates\n- Encrypted persistent storage\n- GPU-accelerated Chromium kiosk\n- Wallet subsystem',
                      modified: Date.now(),
                      permissions: '-rw-r--r--'
                    },
                    {
                      name: 'docker',
                      type: 'dir',
                      modified: Date.now(),
                      permissions: 'drwxr-xr-x',
                      children: [
                        {
                          name: 'Dockerfile',
                          type: 'file',
                          content: 'FROM raspbian/bookworm\nRUN apt update && apt install -y \\\n git curl rsync xz-utils parted \\\n qemu-user-static debootstrap \\\n genisoimage squashfs-tools \\\n docker.io chromium \\\n network-manager \\\n mesa-vulkan-drivers \\\n cryptsetup tpm2-tools openssl && apt clean\nWORKDIR /build',
                          modified: Date.now(),
                          permissions: '-rw-r--r--'
                        }
                      ]
                    },
                    {
                      name: 'overlay',
                      type: 'dir',
                      modified: Date.now(),
                      permissions: 'drwxr-xr-x',
                      children: [
                        {
                          name: 'rootfs',
                          type: 'dir',
                          modified: Date.now(),
                          permissions: 'drwxr-xr-x',
                          children: [
                             {
                               name: 'etc',
                               type: 'dir',
                               modified: Date.now(),
                               permissions: 'drwxr-xr-x',
                               children: [
                                 {
                                   name: 'systemd',
                                   type: 'dir',
                                   modified: Date.now(),
                                   permissions: 'drwxr-xr-x',
                                   children: [
                                      { name: 'pinetos-shell.service', type: 'file', content: '[Unit]\nDescription=PiNetOS Kiosk Shell\nAfter=graphical.target\n[Service]\nExecStart=/usr/local/bin/pinetos-shell', modified: Date.now(), permissions: '-rw-r--r--' },
                                      { name: 'wallet.service', type: 'file', content: '[Unit]\nDescription=PiNetOS Wallet\n[Service]\nExecStart=/usr/local/bin/walletd.sh', modified: Date.now(), permissions: '-rw-r--r--' },
                                      { name: 'ota.service', type: 'file', content: '[Unit]\nDescription=PiNetOS OTA\n[Service]\nExecStart=/usr/local/bin/ota-client.sh', modified: Date.now(), permissions: '-rw-r--r--' }
                                   ]
                                 }
                               ]
                             }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          name: 'var',
          type: 'dir',
          modified: Date.now(),
          permissions: 'drwxr-xr-x',
          children: [
            {
              name: 'minima',
              type: 'dir',
              modified: Date.now(),
              permissions: 'drwxr-xr-x',
              children: [
                { name: 'chain.db', type: 'file', content: 'BINARY_CHAIN_DATA', modified: Date.now(), permissions: '-rw-r--r--', size: 12400000 },
                { name: 'wallet.db', type: 'file', content: 'BINARY_WALLET_DATA', modified: Date.now(), permissions: '-rw-------', size: 52000 },
              ]
            }
          ]
        }
      ]
    };
  }

  getCurrentPath(): string {
    return this.currentPath;
  }

  getUser(): string {
    return this.user;
  }

  // Public method for UI components
  getVFS(): VFSNode {
      return this.vfs;
  }

  // Helper to find a node from a path
  resolvePath(path: string): VFSNode | null {
    let effectivePath = path;
    if (effectivePath === '~') {
        effectivePath = `/home/${this.user}`;
    } else if (effectivePath.startsWith('~/')) {
        effectivePath = effectivePath.replace('~', `/home/${this.user}`);
    }

    const parts = effectivePath.startsWith('/') 
      ? effectivePath.split('/').filter(Boolean) 
      : [...this.currentPath.split('/').filter(Boolean), ...effectivePath.split('/').filter(Boolean)];
    
    let current: VFSNode = this.vfs;
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        continue; 
      }
      const found = current.children?.find(c => c.name === part);
      if (!found) return null;
      current = found;
    }
    return current;
  }

  execute(rawInput: string): { output: { text: string; type: any }[]; newPath?: string } {
    const trimmed = rawInput.trim();
    if (!trimmed) return { output: [] };

    const output: { text: string; type: any }[] = [];
    
    // Command parsing
    const parts = trimmed.split(/\s+/);
    let cmd = parts[0];
    let args = parts.slice(1);
    
    // Sudo simulation
    if (cmd === 'sudo') {
        if (args.length === 0) {
            output.push({ text: 'usage: sudo -h | -K | -k | -V', type: 'info' });
            output.push({ text: 'usage: sudo -v [-AknS] [-g group] [-h host] [-p prompt] [-u user]', type: 'info' });
            return { output };
        }
        cmd = args[0];
        args = args.slice(1);
        // Sudo logic: we just allow it and proceed as if we have permissions
    }

    switch (cmd.toLowerCase()) {
      case 'ls':
        const target = args[0] ? this.resolvePath(args[0]) : this.resolvePath(this.currentPath);
        if (target && target.type === 'dir' && target.children) {
          target.children.forEach(child => {
            const style = child.type === 'dir' ? 'header' : 'info';
            // Mimic ls -F output slightly
            output.push({ text: `${child.name}${child.type === 'dir' ? '/' : ''}`, type: style });
          });
        } else {
          output.push({ text: `ls: cannot access '${args[0] || '.'}': No such file or directory`, type: 'error' });
        }
        break;

      case 'cd':
        if (!args[0]) {
            this.currentPath = '/home/pi';
        } else if (args[0] === '..') {
            const parts = this.currentPath.split('/').filter(Boolean);
            parts.pop();
            this.currentPath = '/' + parts.join('/');
        } else {
            const newTarget = this.resolvePath(args[0]);
            if (newTarget && newTarget.type === 'dir') {
                 // Check path manually because resolvePath returns the node, not the string path
                 let targetPath = args[0];
                 if (targetPath === '~') targetPath = `/home/${this.user}`;
                 else if (targetPath.startsWith('~/')) targetPath = targetPath.replace('~', `/home/${this.user}`);
                 
                 if (targetPath.startsWith('/')) this.currentPath = targetPath;
                 else this.currentPath = `${this.currentPath === '/' ? '' : this.currentPath}/${targetPath}`.replace(/\/+/g, '/');
            } else {
                output.push({ text: `cd: ${args[0]}: No such file or directory`, type: 'error' });
            }
        }
        break;

      case 'mkdir':
        if (args[0]) {
            const currentDir = this.resolvePath(this.currentPath);
            if (currentDir && currentDir.type === 'dir' && currentDir.children) {
                currentDir.children.push({
                    name: args[0],
                    type: 'dir',
                    modified: Date.now(),
                    permissions: 'drwxr-xr-x',
                    children: []
                });
                // Silent success in linux usually
            } else {
                output.push({ text: `mkdir: cannot create directory '${args[0]}': No such file or directory`, type: 'error' });
            }
        }
        break;

      case 'touch':
        if (args[0]) {
            const currentDir = this.resolvePath(this.currentPath);
            if (currentDir && currentDir.type === 'dir' && currentDir.children) {
                currentDir.children.push({
                    name: args[0],
                    type: 'file',
                    content: '',
                    modified: Date.now(),
                    permissions: '-rw-r--r--',
                    size: 0
                });
            }
        }
        break;

      case 'pwd':
        output.push({ text: this.currentPath, type: 'info' });
        break;

      case 'cat':
        const file = this.resolvePath(args[0]);
        if (file && file.type === 'file') {
          output.push({ text: file.content || '(empty)', type: 'info' });
        } else {
          output.push({ text: `cat: ${args[0]}: No such file or directory`, type: 'error' });
        }
        break;

      case 'whoami':
        output.push({ text: this.user, type: 'info' });
        break;

      case 'uname':
        if (args[0] === '-a') {
          output.push({ text: 'Linux raspberrypi 6.6.20+rpt-rpi-v8 #1 SMP PREEMPT Debian 12 (bookworm) aarch64 GNU/Linux', type: 'info' });
        } else if (args[0] === '-r') {
           output.push({ text: '6.6.20+rpt-rpi-v8', type: 'info' });
        } else {
          output.push({ text: 'Linux', type: 'info' });
        }
        break;

      case 'neofetch':
          output.push({ text: `
       _,met$$$$$gg.          pi@raspberrypi
    ,g$$$$$$$$$$$$$$$P.       --------------
  ,g$$P"     """Y$$.".        OS: Debian GNU/Linux 12 (bookworm) aarch64
 ,$$P'              \`$$$.     Host: Raspberry Pi 5 Model B Rev 1.0
',$$P       ,ggs.     \`$$b:   Kernel: 6.6.20+rpt-rpi-v8
\`d$$'     ,$P"'   .    $$$    Uptime: 2 hours, 14 mins
 $$P      d$'     ,    $$P    Packages: 1402 (dpkg)
 $$:      $$.   -    ,d$$'    Shell: bash 5.2.15
 $$;      Y$b._   _,d$P'      Resolution: 1920x1080
 Y$$.    \`.\`"Y$$$$P"'         DE: PiNet-Web3
 \`$$b      "-.__              Terminal: pinet-term
  \`Y$$                        CPU: Cortex-A76 (4) @ 2.400GHz
   \`Y$$.                      GPU: Broadcom VideoCore VII
     \`$$b.                    Memory: 1224MiB / 8096MiB
       \`Y$$b.
          \`"Y$b._
              \`"""
`, type: 'success' });
        break;

      case 'apt':
      case 'apt-get':
        if (args[0] === 'update') {
            output.push(
                { text: 'Hit:1 http://deb.debian.org/debian bookworm InRelease', type: 'info' },
                { text: 'Hit:2 http://deb.debian.org/debian bookworm-updates InRelease', type: 'info' },
                { text: 'Hit:3 http://security.debian.org/debian-security bookworm-security InRelease', type: 'info' },
                { text: 'Hit:4 http://archive.raspberrypi.com/debian bookworm InRelease', type: 'info' },
                { text: 'Reading package lists... Done', type: 'info' }
            );
        } else if (args[0] === 'upgrade') {
            output.push(
                { text: 'Reading package lists... Done', type: 'info' },
                { text: 'Building dependency tree... Done', type: 'info' },
                { text: 'Reading state information... Done', type: 'info' },
                { text: '0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.', type: 'info' }
            );
        } else if (args[0] === 'install') {
            if (!args[1]) {
                output.push({ text: 'apt: option requires an argument', type: 'error' });
            } else {
                output.push(
                    { text: `Reading package lists... Done`, type: 'info' },
                    { text: `Building dependency tree... Done`, type: 'info' },
                    { text: `${args[1]} is already the newest version.`, type: 'info' },
                    { text: '0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.', type: 'info' }
                );
            }
        } else {
             output.push({ text: 'apt 2.7.3 (aarch64)', type: 'info' });
             output.push({ text: 'Usage: apt [options] command', type: 'info' });
        }
        break;

      case 'help':
        // Overridden to standard bash-like help or specific tools
        output.push(
          { text: 'GNU bash, version 5.2.15(1)-release (aarch64-unknown-linux-gnu)', type: 'info' },
          { text: 'These shell commands are defined internally.  Type `help` to see this list.', type: 'info' },
          { text: 'Type `help name` to find out more about the function `name`.', type: 'info' },
          { text: '', type: 'info' },
          { text: 'A star (*) next to a name means that the command is disabled.', type: 'info' },
          { text: '', type: 'info' },
          { text: ' ls, cd, pwd, cat, mkdir, touch, whoami, uname, clear, neofetch, apt, sudo, reboot', type: 'info' },
          { text: ' minima, cluster, top', type: 'info' }
        );
        break;

      case 'minima':
        if (args[0] === 'status') {
          output.push(
            { text: 'Minima v1.0.35 [Mainnet]', type: 'success' },
            { text: 'Block Height: 1,245,091', type: 'info' },
            { text: 'Wallet Sync: COMPLETE', type: 'success' }
          );
        } else if (args[0] === 'peers') {
          output.push({ text: 'Connected: 14 Nodes | Outbound: 8 | Inbound: 6', type: 'info' });
        } else {
          output.push({ text: 'Usage: minima [status|peers|info]', type: 'warning' });
        }
        break;

      case 'cluster':
        if (args[0] === 'list') {
          output.push(
            { text: 'ID   ROLE    HAT       STATUS', type: 'header' },
            { text: 'n1   Alpha   SSD_NVME  ONLINE', type: 'success' },
            { text: 'n2   Beta    AI_NPU    ONLINE', type: 'success' },
            { text: 'n3   Gamma   SENSE     ONLINE', type: 'success' }
          );
        } else {
          output.push({ text: 'Usage: cluster [list|health|provision]', type: 'warning' });
        }
        break;

      case 'top':
        output.push(
          { text: 'top - 14:22:15 up 2 days, 14:12,  1 user,  load average: 0.12, 0.08, 0.02', type: 'header' },
          { text: 'Tasks: 142 total,   2 running, 140 sleeping,   0 stopped,   0 zombie', type: 'info' },
          { text: '%Cpu(s):  8.2 us,  2.1 sy,  0.0 ni, 89.2 id,  0.1 wa,  0.0 hi,  0.4 si,  0.0 st', type: 'info' },
          { text: 'MiB Mem :   8096.0 total,   4122.4 free,   1262.2 used,   2711.4 buff/cache', type: 'info' },
          { text: '', type: 'info' },
          { text: '  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND', type: 'header' },
          { text: ' 1042 pi        20   0  1.2g  842m  120m S  12.4   5.1   4:12.14 minima', type: 'success' },
          { text: ' 2401 pi        20   0  2.4g  1.2g  240m R   8.2   7.3   2:45.09 airllm-sh', type: 'success' },
          { text: '  901 root      20   0  242m   42m   12m S   1.2   0.3   0:12.45 pinet-os', type: 'info' }
        );
        break;
      
      case 'reboot':
          output.push({ text: 'Rebooting system...', type: 'warning' });
          break;

      default:
        output.push({ text: `bash: ${cmd}: command not found`, type: 'error' });
    }

    return { output };
  }
}

export const shell = new ShellService();
