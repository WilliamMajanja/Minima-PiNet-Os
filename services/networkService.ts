/**
 * PiNet-OS Network Manager Service
 * Manages network interfaces, routing, DNS, firewall rules, and VPN connections.
 * Provides a unified network stack management layer.
 */

import os from 'os';
import * as fs from 'fs';
import { execFileSync } from 'child_process';
import type {
  NetworkInterface,
  NetworkAddress,
  Route,
  DNSConfig,
  FirewallRule,
  WireGuardInterface,
  WireGuardPeer,
} from '../types/kernel.js';

// ─── Network Service ────────────────────────────────────────────────────────

class NetworkService {
  private interfaces = new Map<string, NetworkInterface>();
  private routes: Route[] = [];
  private dns: DNSConfig = { nameservers: ['8.8.8.8', '8.8.4.4', '1.1.1.1'], search: ['local'], options: ['edns0', 'trust-ad'] };
  private firewallRules: FirewallRule[] = [];
  private wireguardInterfaces = new Map<string, WireGuardInterface>();
  private listeners: Array<() => void> = [];

  constructor() {
    this.initFromSystem();
    this.initDefaultFirewall();
    this.initWireGuard();
  }

  /** Detect and populate network interfaces from the actual OS. */
  private initFromSystem(): void {
    const osInterfaces = os.networkInterfaces();
    let idx = 1;

    // Read real network stats from /proc/net/dev if available
    const procNetStats = this.readProcNetDev();

    for (const [name, addrs] of Object.entries(osInterfaces)) {
      if (!addrs) continue;

      const addresses: NetworkAddress[] = addrs.map(a => ({
        family: a.family === 'IPv4' ? 'inet' : 'inet6',
        address: a.address,
        netmask: a.netmask,
        scope: a.internal ? 'host' : 'global',
      }));

      const stats = procNetStats.get(name);

      const iface: NetworkInterface = {
        name,
        index: idx++,
        state: 'up',
        mac: addrs[0]?.mac ?? '00:00:00:00:00:00',
        mtu: 1500,
        type: name === 'lo' ? 'loopback' : name.startsWith('wlan') ? 'wifi' : name.startsWith('wg') ? 'wireguard' : name.startsWith('br') ? 'bridge' : name.startsWith('veth') ? 'virtual' : 'ethernet',
        addresses,
        rxBytes: stats?.rxBytes ?? 0,
        txBytes: stats?.txBytes ?? 0,
        rxPackets: stats?.rxPackets ?? 0,
        txPackets: stats?.txPackets ?? 0,
        rxErrors: stats?.rxErrors ?? 0,
        txErrors: stats?.txErrors ?? 0,
        speed: name.startsWith('eth') ? 1000 : name.startsWith('wlan') ? 867 : undefined,
        duplex: name.startsWith('eth') ? 'full' : undefined,
        carrier: true,
      };

      this.interfaces.set(name, iface);
    }

    // Populate routes from real system if possible
    this.routes = this.readSystemRoutes();
  }

  /** Read real network interface statistics from /proc/net/dev */
  private readProcNetDev(): Map<string, { rxBytes: number; txBytes: number; rxPackets: number; txPackets: number; rxErrors: number; txErrors: number }> {
    const result = new Map<string, { rxBytes: number; txBytes: number; rxPackets: number; txPackets: number; rxErrors: number; txErrors: number }>();
    try {
      const raw = fs.readFileSync('/proc/net/dev', 'utf8');
      const lines = raw.trim().split('\n').slice(2); // skip header lines
      for (const line of lines) {
        const parts = line.trim().split(/[:\s]+/);
        if (parts.length >= 11) {
          const name = parts[0];
          result.set(name, {
            rxBytes: parseInt(parts[1], 10) || 0,
            rxPackets: parseInt(parts[2], 10) || 0,
            rxErrors: parseInt(parts[3], 10) || 0,
            txBytes: parseInt(parts[9], 10) || 0,
            txPackets: parseInt(parts[10], 10) || 0,
            txErrors: parseInt(parts[11], 10) || 0,
          });
        }
      }
    } catch {
      // /proc/net/dev not available — return empty
    }
    return result;
  }

  /** Read real routing table from `ip route` */
  private readSystemRoutes(): Route[] {
    try {
      const raw = execFileSync('ip', ['-j', 'route'], { stdio: 'pipe' }).toString();
      const routes = JSON.parse(raw) as Array<{ dst: string; gateway?: string; dev: string; metric?: number; scope?: string; protocol?: string; flags?: string[] }>;
      return routes.map(r => ({
        destination: r.dst || 'default',
        gateway: r.gateway || '0.0.0.0',
        interface: r.dev,
        metric: r.metric ?? 0,
        scope: (r.scope || 'global') as Route['scope'],
        protocol: (r.protocol || 'kernel') as Route['protocol'],
        flags: r.flags || ['UP'],
      }));
    } catch {
      // Fallback: return default routes
      return [
        { destination: 'default', gateway: '192.168.1.1', interface: 'eth0', metric: 100, scope: 'global', protocol: 'dhcp', flags: ['UP', 'GATEWAY'] },
        { destination: '192.168.1.0/24', gateway: '0.0.0.0', interface: 'eth0', metric: 100, scope: 'link', protocol: 'kernel', flags: ['UP'] },
      ];
    }
  }

  private initDefaultFirewall(): void {
    this.firewallRules = [
      { id: 'fw-1', chain: 'INPUT', action: 'ACCEPT', protocol: 'all', interface: 'lo', comment: 'Allow loopback', enabled: true, order: 1 },
      { id: 'fw-2', chain: 'INPUT', action: 'ACCEPT', protocol: 'tcp', destinationPort: 22, comment: 'SSH', enabled: true, order: 10 },
      { id: 'fw-3', chain: 'INPUT', action: 'ACCEPT', protocol: 'tcp', destinationPort: 3000, comment: 'PiNet Desktop', enabled: true, order: 20 },
      { id: 'fw-4', chain: 'INPUT', action: 'ACCEPT', protocol: 'tcp', destinationPort: 9001, comment: 'Minima P2P', enabled: true, order: 30 },
      { id: 'fw-5', chain: 'INPUT', action: 'ACCEPT', protocol: 'tcp', destinationPort: 9002, comment: 'Minima RPC', enabled: true, order: 31 },
      { id: 'fw-6', chain: 'INPUT', action: 'ACCEPT', protocol: 'tcp', destinationPort: 9090, comment: 'Cluster API', enabled: true, order: 40 },
      { id: 'fw-7', chain: 'INPUT', action: 'ACCEPT', protocol: 'udp', destinationPort: 51820, comment: 'WireGuard VPN', enabled: true, order: 50 },
      { id: 'fw-8', chain: 'INPUT', action: 'ACCEPT', protocol: 'icmp', comment: 'Allow ICMP', enabled: true, order: 60 },
      { id: 'fw-9', chain: 'INPUT', action: 'DROP', protocol: 'all', comment: 'Default deny inbound', enabled: true, order: 9999 },
      { id: 'fw-10', chain: 'FORWARD', action: 'ACCEPT', protocol: 'all', interface: 'wg0', comment: 'Allow WireGuard forwarding', enabled: true, order: 10 },
      { id: 'fw-11', chain: 'OUTPUT', action: 'ACCEPT', protocol: 'all', comment: 'Allow all outbound', enabled: true, order: 1 },
    ];
  }

  private initWireGuard(): void {
    // Read real WireGuard interfaces from `wg show` if available
    try {
      const raw = execFileSync('wg', ['show', 'all', 'dump'], { stdio: 'pipe' }).toString().trim();
      if (!raw) return;

      const lines = raw.split('\n');
      let currentIface: WireGuardInterface | null = null;

      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length === 4) {
          // Interface line: <iface> <private-key> <public-key> <listen-port>
          if (currentIface) {
            this.wireguardInterfaces.set(currentIface.name, currentIface);
          }
          currentIface = {
            name: parts[0],
            publicKey: parts[2],
            listenPort: parseInt(parts[3], 10) || 51820,
            address: '', // populated from interface addresses
            peers: [],
          };
          // Get address from OS interfaces
          const osIface = this.interfaces.get(parts[0]);
          if (osIface) {
            const addr = osIface.addresses.find(a => a.family === 'inet');
            if (addr) currentIface.address = `${addr.address}/${addr.netmask}`;
          }
        } else if (parts.length >= 8 && currentIface) {
          // Peer line: <iface> <public-key> <preshared-key> <endpoint> <allowed-ips> <latest-handshake> <transfer-rx> <transfer-tx> <persistent-keepalive>
          currentIface.peers.push({
            publicKey: parts[1],
            endpoint: parts[3] !== '(none)' ? parts[3] : undefined,
            allowedIPs: parts[4] ? parts[4].split(',') : [],
            latestHandshake: parseInt(parts[5], 10) * 1000 || 0,
            transferRx: parseInt(parts[6], 10) || 0,
            transferTx: parseInt(parts[7], 10) || 0,
            persistentKeepalive: parts[8] ? parseInt(parts[8], 10) : undefined,
          });
        }
      }
      if (currentIface) {
        this.wireguardInterfaces.set(currentIface.name, currentIface);
      }
    } catch {
      // WireGuard not available — no VPN interfaces
    }
  }

  // ─── Interface Management ─────────────────────────────────────────────

  getInterface(name: string): NetworkInterface | undefined { return this.interfaces.get(name); }

  listInterfaces(): NetworkInterface[] { return Array.from(this.interfaces.values()); }

  setInterfaceState(name: string, state: 'up' | 'down'): boolean {
    const iface = this.interfaces.get(name);
    if (!iface) return false;
    iface.state = state;
    this.notify();
    return true;
  }

  setInterfaceAddress(name: string, address: string, netmask: string): boolean {
    const iface = this.interfaces.get(name);
    if (!iface) return false;
    const existing = iface.addresses.find(a => a.family === 'inet');
    if (existing) { existing.address = address; existing.netmask = netmask; }
    else { iface.addresses.push({ family: 'inet', address, netmask, scope: 'global' }); }
    this.notify();
    return true;
  }

  setMTU(name: string, mtu: number): boolean {
    const iface = this.interfaces.get(name);
    if (!iface) return false;
    iface.mtu = mtu;
    this.notify();
    return true;
  }

  // ─── Routing ──────────────────────────────────────────────────────────

  getRoutes(): Route[] { return [...this.routes]; }

  addRoute(route: Route): void {
    this.routes.push(route);
    this.notify();
  }

  removeRoute(destination: string): boolean {
    const idx = this.routes.findIndex(r => r.destination === destination);
    if (idx < 0) return false;
    this.routes.splice(idx, 1);
    this.notify();
    return true;
  }

  // ─── DNS ──────────────────────────────────────────────────────────────

  getDNSConfig(): DNSConfig { return { ...this.dns }; }

  setDNSConfig(config: Partial<DNSConfig>): void {
    if (config.nameservers) this.dns.nameservers = config.nameservers;
    if (config.search) this.dns.search = config.search;
    if (config.options) this.dns.options = config.options;
    this.notify();
  }

  // ─── Firewall ─────────────────────────────────────────────────────────

  getFirewallRules(): FirewallRule[] { return [...this.firewallRules]; }

  addFirewallRule(rule: FirewallRule): void {
    this.firewallRules.push(rule);
    this.firewallRules.sort((a, b) => a.order - b.order);
    this.notify();
  }

  removeFirewallRule(id: string): boolean {
    const idx = this.firewallRules.findIndex(r => r.id === id);
    if (idx < 0) return false;
    this.firewallRules.splice(idx, 1);
    this.notify();
    return true;
  }

  toggleFirewallRule(id: string, enabled: boolean): boolean {
    const rule = this.firewallRules.find(r => r.id === id);
    if (!rule) return false;
    rule.enabled = enabled;
    this.notify();
    return true;
  }

  // ─── WireGuard ────────────────────────────────────────────────────────

  getWireGuardInterfaces(): WireGuardInterface[] { return Array.from(this.wireguardInterfaces.values()); }

  getWireGuardInterface(name: string): WireGuardInterface | undefined { return this.wireguardInterfaces.get(name); }

  addWireGuardPeer(ifaceName: string, peer: WireGuardPeer): boolean {
    const iface = this.wireguardInterfaces.get(ifaceName);
    if (!iface) return false;
    iface.peers.push(peer);
    this.notify();
    return true;
  }

  removeWireGuardPeer(ifaceName: string, publicKey: string): boolean {
    const iface = this.wireguardInterfaces.get(ifaceName);
    if (!iface) return false;
    iface.peers = iface.peers.filter(p => p.publicKey !== publicKey);
    this.notify();
    return true;
  }

  // ─── Statistics ───────────────────────────────────────────────────────

  getNetworkStats(): { interfaces: number; totalRxBytes: number; totalTxBytes: number; totalRxPackets: number; totalTxPackets: number; firewallRules: number; vpnPeers: number } {
    let totalRxBytes = 0, totalTxBytes = 0, totalRxPackets = 0, totalTxPackets = 0, vpnPeers = 0;
    for (const iface of this.interfaces.values()) {
      totalRxBytes += iface.rxBytes; totalTxBytes += iface.txBytes;
      totalRxPackets += iface.rxPackets; totalTxPackets += iface.txPackets;
    }
    for (const wg of this.wireguardInterfaces.values()) vpnPeers += wg.peers.length;
    return { interfaces: this.interfaces.size, totalRxBytes, totalTxBytes, totalRxPackets, totalTxPackets, firewallRules: this.firewallRules.length, vpnPeers };
  }

  // ─── Observer ─────────────────────────────────────────────────────────

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private notify(): void {
    for (const l of this.listeners) { try { l(); } catch { /* noop */ } }
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const networkService = new NetworkService();
