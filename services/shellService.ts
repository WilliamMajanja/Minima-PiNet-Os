
import { VFSNode } from '../types';

class ShellService {
  private vfs: VFSNode;
  private currentPath: string = '/home/pinet';
  private user: string = 'pinet';

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
            { name: 'minima.conf', type: 'file', content: 'rpcenable=true\nport=9001\nhost=0.0.0.0', modified: Date.now(), permissions: '-rw-r--r--' },
            { name: 'cluster.json', type: 'file', content: '{"nodes": ["n1", "n2", "n3"], "master": "n1"}', modified: Date.now(), permissions: '-rw-r--r--' },
          ]
        },
        {
          name: 'home',
          type: 'dir',
          modified: Date.now(),
          permissions: 'drwxr-xr-x',
          children: [
            {
              name: 'pinet',
              type: 'dir',
              modified: Date.now(),
              permissions: 'drwxr-xr-x',
              children: [
                { name: 'README.md', type: 'file', content: '# Welcome to PiNet Web3 OS\n\nThis cluster is now decentralized.', modified: Date.now(), permissions: '-rw-r--r--' },
                { name: 'secret_seed.txt', type: 'file', content: 'ENCRYPTED_DATA_REDACTED', modified: Date.now(), permissions: '-rw-------' },
                { name: 'projects', type: 'dir', modified: Date.now(), permissions: 'drwxr-xr-x', children: [] },
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

  private resolvePath(path: string): VFSNode | null {
    const parts = path.startsWith('/') 
      ? path.split('/').filter(Boolean) 
      : [...this.currentPath.split('/').filter(Boolean), ...path.split('/').filter(Boolean)];
    
    let current: VFSNode = this.vfs;
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        // Simple parent resolution logic would go here
        // For simplicity, we just keep current for root or go up if we tracked parents
        continue; 
      }
      const found = current.children?.find(c => c.name === part);
      if (!found) return null;
      current = found;
    }
    return current;
  }

  execute(rawInput: string): { output: { text: string; type: any }[]; newPath?: string } {
    const [cmd, ...args] = rawInput.trim().split(/\s+/);
    const output: { text: string; type: any }[] = [];

    switch (cmd.toLowerCase()) {
      case 'ls':
        const target = args[0] ? this.resolvePath(args[0]) : this.resolvePath(this.currentPath);
        if (target && target.type === 'dir' && target.children) {
          target.children.forEach(child => {
            const style = child.type === 'dir' ? 'header' : 'info';
            output.push({ text: `${child.permissions}  ${child.name}${child.type === 'dir' ? '/' : ''}`, type: style });
          });
        } else {
          output.push({ text: `ls: cannot access '${args[0] || '.'}': No such file or directory`, type: 'error' });
        }
        break;

      case 'cd':
        if (!args[0] || args[0] === '~') {
          this.currentPath = '/home/pinet';
        } else if (args[0] === '/') {
          this.currentPath = '/';
        } else {
          const newTarget = this.resolvePath(args[0]);
          if (newTarget && newTarget.type === 'dir') {
            // Very basic path string building
            if (args[0].startsWith('/')) this.currentPath = args[0];
            else this.currentPath = `${this.currentPath === '/' ? '' : this.currentPath}/${args[0]}`.replace(/\/+/g, '/');
          } else {
            output.push({ text: `cd: ${args[0]}: No such file or directory`, type: 'error' });
          }
        }
        break;

      case 'pwd':
        output.push({ text: this.currentPath, type: 'info' });
        break;

      case 'cat':
        const file = this.resolvePath(args[0]);
        if (file && file.type === 'file') {
          output.push({ text: file.content || '(empty)', type: 'code' });
        } else {
          output.push({ text: `cat: ${args[0]}: No such file`, type: 'error' });
        }
        break;

      case 'whoami':
        output.push({ text: this.user, type: 'info' });
        break;

      case 'uname':
        if (args[0] === '-a') {
          output.push({ text: 'Linux pinet-alpha 6.1.0-rpi7-rpi-v8 #1 SMP PREEMPT Debian 12.2.0-14 (2024-05-22) aarch64 GNU/Linux', type: 'info' });
        } else {
          output.push({ text: 'Linux', type: 'info' });
        }
        break;

      case 'help':
        output.push(
          { text: 'PiNet SHELL UTILITIES:', type: 'header' },
          { text: 'ls, cd, pwd, cat, mkdir, touch, whoami, uname, clear', type: 'info' },
          { text: 'SYSTEM UTILITIES:', type: 'header' },
          { text: 'minima status    - Show local node health', type: 'info' },
          { text: 'minima peers     - Show P2P network status', type: 'info' },
          { text: 'cluster list     - Show sharded Pi nodes', type: 'info' },
          { text: 'top              - Real-time cluster load', type: 'info' }
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
          { text: 'tasks: 142 total, 2 running, 140 sleeping', type: 'header' },
          { text: '%Cpu(s):  8.2 us,  2.1 sy,  0.0 ni, 89.2 id', type: 'info' },
          { text: 'MiB Mem :  16384 total,  4122 free,  12262 used', type: 'info' },
          { text: '', type: 'info' },
          { text: '  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND', type: 'header' },
          { text: ' 1042 pinet     20   0  1.2g  842m  120m S  12.4   5.1   4:12.14 minima', type: 'success' },
          { text: ' 2401 pinet     20   0  2.4g  1.2g  240m R   8.2   7.3   2:45.09 airllm-sh', type: 'success' },
          { text: '  901 root      20   0  242m   42m   12m S   1.2   0.3   0:12.45 pinet-os', type: 'info' }
        );
        break;

      default:
        output.push({ text: `pinet: command not found: ${cmd}`, type: 'error' });
    }

    return { output };
  }
}

export const shell = new ShellService();
