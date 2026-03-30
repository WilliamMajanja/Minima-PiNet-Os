/**
 * PiNet-OS IPC / Message Bus Service
 * D-Bus-like inter-process communication system.
 * Provides signal broadcasting, method calls, and named services.
 */

import crypto from 'crypto';
import type { IPCChannel, IPCType, DBusMessage, DBusService } from '../types/kernel.js';

// ─── IPC Service ────────────────────────────────────────────────────────────

class IPCService {
  private channels = new Map<string, IPCChannel>();
  private busServices = new Map<string, DBusService>();
  private messageLog: DBusMessage[] = [];
  private subscriptions = new Map<string, Array<(msg: DBusMessage) => void>>();
  private nextSerial = 1;
  private maxMessages = 5000;
  private listeners: Array<() => void> = [];

  constructor() {
    this.registerSystemBusServices();
  }

  private registerSystemBusServices(): void {
    // Register core system bus services
    const services: Array<Omit<DBusService, 'pid'> & { pid: number }> = [
      { name: 'org.freedesktop.systemd1', pid: 1, interfaces: ['org.freedesktop.systemd1.Manager', 'org.freedesktop.systemd1.Unit'], objectPaths: ['/org/freedesktop/systemd1'] },
      { name: 'org.freedesktop.login1', pid: 9, interfaces: ['org.freedesktop.login1.Manager', 'org.freedesktop.login1.Session'], objectPaths: ['/org/freedesktop/login1'] },
      { name: 'org.freedesktop.NetworkManager', pid: 12, interfaces: ['org.freedesktop.NetworkManager', 'org.freedesktop.NetworkManager.Device'], objectPaths: ['/org/freedesktop/NetworkManager'] },
      { name: 'org.freedesktop.UDisks2', pid: 8, interfaces: ['org.freedesktop.UDisks2.Manager', 'org.freedesktop.UDisks2.Drive'], objectPaths: ['/org/freedesktop/UDisks2'] },
      { name: 'org.freedesktop.UPower', pid: 0, interfaces: ['org.freedesktop.UPower', 'org.freedesktop.UPower.Device'], objectPaths: ['/org/freedesktop/UPower'] },
      { name: 'org.pinet.Desktop', pid: 14, interfaces: ['org.pinet.Desktop.WindowManager', 'org.pinet.Desktop.Notifications'], objectPaths: ['/org/pinet/Desktop'] },
      { name: 'org.pinet.ClusterManager', pid: 15, interfaces: ['org.pinet.ClusterManager', 'org.pinet.ClusterManager.Node'], objectPaths: ['/org/pinet/ClusterManager'] },
      { name: 'org.pinet.HAL', pid: 16, interfaces: ['org.pinet.HAL.GPIO', 'org.pinet.HAL.I2C', 'org.pinet.HAL.SPI', 'org.pinet.HAL.Thermal'], objectPaths: ['/org/pinet/HAL'] },
      { name: 'org.pinet.Minima', pid: 13, interfaces: ['org.pinet.Minima.Node', 'org.pinet.Minima.Wallet', 'org.pinet.Minima.Maxima'], objectPaths: ['/org/pinet/Minima'] },
    ];

    for (const s of services) {
      this.busServices.set(s.name, s);
    }
  }

  // ─── Channel Management ───────────────────────────────────────────────

  /** Create an IPC channel. */
  createChannel(name: string, type: IPCType, ownerPid: number): IPCChannel {
    const id = `ipc-${crypto.randomBytes(4).toString('hex')}`;
    const channel: IPCChannel = {
      id, type, name, ownerPid,
      readerPids: [ownerPid], writerPids: [ownerPid],
      createdAt: Date.now(), messageCount: 0,
      bytesSent: 0, bytesReceived: 0,
    };
    this.channels.set(id, channel);
    this.notify();
    return channel;
  }

  /** Close an IPC channel. */
  closeChannel(id: string): boolean {
    const ok = this.channels.delete(id);
    if (ok) this.notify();
    return ok;
  }

  /** Attach a process to a channel. */
  attachToChannel(channelId: string, pid: number, mode: 'read' | 'write' | 'both'): boolean {
    const ch = this.channels.get(channelId);
    if (!ch) return false;
    if (mode === 'read' || mode === 'both') {
      if (!ch.readerPids.includes(pid)) ch.readerPids.push(pid);
    }
    if (mode === 'write' || mode === 'both') {
      if (!ch.writerPids.includes(pid)) ch.writerPids.push(pid);
    }
    this.notify();
    return true;
  }

  /** Get all channels. */
  listChannels(): IPCChannel[] {
    return Array.from(this.channels.values());
  }

  /** Get channels for a specific process. */
  getProcessChannels(pid: number): IPCChannel[] {
    return this.listChannels().filter(ch =>
      ch.ownerPid === pid || ch.readerPids.includes(pid) || ch.writerPids.includes(pid)
    );
  }

  // ─── D-Bus Message Bus ────────────────────────────────────────────────

  /** Register a service on the bus. */
  registerService(name: string, pid: number, interfaces: string[], objectPaths: string[]): boolean {
    if (this.busServices.has(name)) return false;
    this.busServices.set(name, { name, pid, interfaces, objectPaths });
    this.emit({
      type: 'signal', sender: 'org.freedesktop.DBus', destination: undefined,
      interface: 'org.freedesktop.DBus', member: 'NameOwnerChanged',
      path: '/org/freedesktop/DBus', body: { name, oldOwner: '', newOwner: `${pid}` },
    });
    this.notify();
    return true;
  }

  /** Unregister a service from the bus. */
  unregisterService(name: string): boolean {
    const ok = this.busServices.delete(name);
    if (ok) this.notify();
    return ok;
  }

  /** List all bus services. */
  listBusServices(): DBusService[] {
    return Array.from(this.busServices.values());
  }

  /** Get a bus service by name. */
  getBusService(name: string): DBusService | undefined {
    return this.busServices.get(name);
  }

  /** Emit a D-Bus message/signal. */
  emit(msg: Omit<DBusMessage, 'id' | 'timestamp' | 'serial'>): DBusMessage {
    const full: DBusMessage = {
      ...msg,
      id: `msg-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: Date.now(),
      serial: this.nextSerial++,
    };

    this.messageLog.push(full);
    if (this.messageLog.length > this.maxMessages) {
      this.messageLog = this.messageLog.slice(-Math.floor(this.maxMessages * 0.8));
    }

    // Deliver to subscribers
    const key = `${msg.interface}.${msg.member}`;
    const subs = this.subscriptions.get(key);
    if (subs) {
      for (const cb of subs) { try { cb(full); } catch { /* noop */ } }
    }

    // Wildcard subscribers
    const wildcardSubs = this.subscriptions.get('*');
    if (wildcardSubs) {
      for (const cb of wildcardSubs) { try { cb(full); } catch { /* noop */ } }
    }

    return full;
  }

  /** Call a method on a bus service. Returns a response message. */
  async callMethod(
    sender: string,
    destination: string,
    iface: string,
    member: string,
    path: string,
    body: unknown,
  ): Promise<DBusMessage> {
    const svc = this.busServices.get(destination);
    if (!svc) {
      return this.emit({
        type: 'error', sender: 'org.freedesktop.DBus', destination: sender,
        interface: 'org.freedesktop.DBus.Error', member: 'ServiceUnknown',
        path, body: { message: `Service '${destination}' not found` },
      });
    }

    const request = this.emit({
      type: 'method_call', sender, destination, interface: iface,
      member, path, body,
    });

    // Simulate response
    return this.emit({
      type: 'method_return', sender: destination, destination: sender,
      interface: iface, member, path,
      body: { success: true, requestSerial: request.serial },
      replySerial: request.serial,
    });
  }

  /** Subscribe to messages matching an interface.member pattern. Use '*' for all messages. */
  subscribeToMessages(pattern: string, callback: (msg: DBusMessage) => void): () => void {
    if (!this.subscriptions.has(pattern)) this.subscriptions.set(pattern, []);
    this.subscriptions.get(pattern)!.push(callback);
    return () => {
      const subs = this.subscriptions.get(pattern);
      if (subs) {
        this.subscriptions.set(pattern, subs.filter(cb => cb !== callback));
      }
    };
  }

  /** Get recent messages. */
  getRecentMessages(limit = 50): DBusMessage[] {
    return this.messageLog.slice(-limit);
  }

  /** Get message statistics. */
  getStats(): { totalMessages: number; services: number; channels: number; subscriptions: number } {
    let subCount = 0;
    for (const subs of this.subscriptions.values()) subCount += subs.length;
    return {
      totalMessages: this.messageLog.length,
      services: this.busServices.size,
      channels: this.channels.size,
      subscriptions: subCount,
    };
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

export const ipcService = new IPCService();
