/**
 * PiNet-OS Network Manager Service
 * Manages network interfaces, routing, DNS, firewall rules, and VPN connections.
 * Provides a unified network stack management layer.
 */

import os from 'os';
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

    for (const [name, addrs] of Object.entries(osInterfaces)) {
      if (!addrs) continue;

      const addresses: NetworkAddress[] = addrs.map(a => ({
        family: a.family === 'IPv4' ? 'inet' : 'inet6',
        address: a.address,
        netmask: a.netmask,
        scope: a.internal ? 'host' : 'global',
      }));

      const iface: NetworkInterface = {
        name,
        index: idx++,
        state: 'up',
        mac: addrs[0]?.mac ?? '00:00:00:00:00:00',
        mtu: 1500,
        type: name === 'lo' ? 'loopback' : name.startsWith('wlan') ? 'wifi' : name.startsWith('wg') ? 'wireguard' : name.startsWith('br') ? 'bridge' : name.startsWith('veth') ? 'virtual' : 'ethernet',
        addresses,
        rxBytes: Math.floor(Math.random() * 1024 * 1024 * 1024),
        txBytes: Math.floor(Math.random() * 512 * 1024 * 1024),
        rxPackets: Math.floor(Math.random() * 1000000),
        txPackets: Math.floor(Math.random() * 500000),
        rxErrors: 0,
        txErrors: 0,
        speed: name.startsWith('eth') ? 1000 : name.startsWith('wlan') ? 867 : undefined,
        duplex: name.startsWith('eth') ? 'full' : undefined,
        carrier: true,
      };

      this.interfaces.set(name, iface);
    }

    // Add simulated Pi network interfaces if not present
    if (!this.interfaces.has('eth0')) {
      this.interfaces.set('eth0', {
        name: 'eth0', index: idx++, state: 'up',
        mac: 'dc:a6:32:12:34:56', mtu: 1500, type: 'ethernet',
        addresses: [
          { family: 'inet', address: '192.168.1.100', netmask: '255.255.255.0', broadcast: '192.168.1.255', scope: 'global' },
          { family: 'inet6', address: 'fe80::dea6:32ff:fe12:3456', netmask: 'ffff:ffff:ffff:ffff::', scope: 'link' },
        ],
        rxBytes: 1024 * 1024 * 850, txBytes: 1024 * 1024 * 320,
        rxPackets: 650000, txPackets: 280000, rxErrors: 0, txErrors: 0,
        speed: 1000, duplex: 'full', carrier: true,
      });
    }
    if (!this.interfaces.has('wlan0')) {
      this.interfaces.set('wlan0', {
        name: 'wlan0', index: idx++, state: 'up',
        mac: 'dc:a6:32:78:9a:bc', mtu: 1500, type: 'wifi',
        addresses: [
          { family: 'inet', address: '192.168.1.101', netmask: '255.255.255.0', broadcast: '192.168.1.255', scope: 'global' },
        ],
        rxBytes: 1024 * 1024 * 120, txBytes: 1024 * 1024 * 45,
        rxPackets: 95000, txPackets: 42000, rxErrors: 2, txErrors: 0,
        speed: 867, carrier: true,
      });
    }
    if (!this.interfaces.has('wg0')) {
      this.interfaces.set('wg0', {
        name: 'wg0', index: idx++, state: 'up',
        mac: '(none)', mtu: 1420, type: 'wireguard',
        addresses: [
          { family: 'inet', address: '10.0.0.1', netmask: '255.255.255.0', scope: 'global' },
        ],
        rxBytes: 1024 * 1024 * 50, txBytes: 1024 * 1024 * 30,
        rxPackets: 40000, txPackets: 25000, rxErrors: 0, txErrors: 0,
        carrier: true,
      });
    }

    // Default routes
    this.routes = [
      { destination: 'default', gateway: '192.168.1.1', interface: 'eth0', metric: 100, scope: 'global', protocol: 'dhcp', flags: ['UP', 'GATEWAY'] },
      { destination: '192.168.1.0/24', gateway: '0.0.0.0', interface: 'eth0', metric: 100, scope: 'link', protocol: 'kernel', flags: ['UP'] },
      { destination: '10.0.0.0/24', gateway: '0.0.0.0', interface: 'wg0', metric: 50, scope: 'link', protocol: 'kernel', flags: ['UP'] },
      { destination: '169.254.0.0/16', gateway: '0.0.0.0', interface: 'eth0', metric: 1000, scope: 'link', protocol: 'kernel', flags: ['UP'] },
    ];
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
    this.wireguardInterfaces.set('wg0', {
      name: 'wg0',
      publicKey: 'pinet-node-pubkey-base64==',
      listenPort: 51820,
      address: '10.0.0.1/24',
      peers: [
        { publicKey: 'peer1-pubkey-base64==', endpoint: '192.168.1.102:51820', allowedIPs: ['10.0.0.2/32'], latestHandshake: Date.now() - 30000, transferRx: 1024 * 1024 * 10, transferTx: 1024 * 1024 * 8, persistentKeepalive: 25 },
        { publicKey: 'peer2-pubkey-base64==', endpoint: '192.168.1.103:51820', allowedIPs: ['10.0.0.3/32'], latestHandshake: Date.now() - 60000, transferRx: 1024 * 1024 * 5, transferTx: 1024 * 1024 * 3, persistentKeepalive: 25 },
      ],
    });
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
