/**
 * PiNet-OS Device Manager
 * Udev-like device detection, hotplug management, and driver association.
 * Tracks all hardware devices and provides a unified device tree.
 */

import type {
  DeviceDescriptor,
  DeviceEvent,
  DeviceClass,
  DeviceState,
  UdevRule,
} from '../types/kernel.js';

// ─── Device Manager ─────────────────────────────────────────────────────────

class DeviceManager {
  private devices = new Map<string, DeviceDescriptor>();
  private eventLog: DeviceEvent[] = [];
  private rules: UdevRule[] = [];
  private listeners: Array<(event: DeviceEvent) => void> = [];
  private changeListeners: Array<() => void> = [];

  constructor() {
    this.initSystemDevices();
    this.initDefaultRules();
  }

  /** Populate the device tree from the real system (/sys), with Pi 5 fallback. */
  private initSystemDevices(): void {
    let fsModule: typeof import('fs') | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      fsModule = require('fs') as typeof import('fs');
    } catch { /* not in Node.js env */ }

    const now = Date.now();
    const discovered: DeviceDescriptor[] = [];

    if (fsModule) {
      // Enumerate block devices from /sys/block
      try {
        const blockDevs = fsModule.readdirSync('/sys/block');
        for (const dev of blockDevs) {
          const sysPath = `/sys/block/${dev}`;
          let size = 0;
          try { size = parseInt(fsModule.readFileSync(`${sysPath}/size`, 'utf8').trim(), 10) * 512; } catch { /* ignore */ }
          discovered.push({
            id: dev,
            name: dev,
            deviceClass: 'block' as DeviceClass,
            driver: '',
            subsystem: 'block',
            path: sysPath,
            devNode: `/dev/${dev}`,
            major: 0,
            minor: 0,
            state: 'attached' as DeviceState,
            attachedAt: now,
            properties: { size: String(size) },
          });
        }
      } catch { /* /sys/block unavailable */ }

      // Enumerate network interfaces from /sys/class/net
      try {
        const netDevs = fsModule.readdirSync('/sys/class/net');
        for (const dev of netDevs) {
          const sysPath = `/sys/class/net/${dev}`;
          let mac = '';
          let carrier = false;
          try { mac = fsModule.readFileSync(`${sysPath}/address`, 'utf8').trim(); } catch { /* ignore */ }
          try { carrier = fsModule.readFileSync(`${sysPath}/carrier`, 'utf8').trim() === '1'; } catch { /* ignore */ }
          discovered.push({
            id: `net_${dev}`,
            name: dev,
            deviceClass: 'net' as DeviceClass,
            driver: '',
            subsystem: 'net',
            path: sysPath,
            state: carrier ? 'attached' as DeviceState : 'detached' as DeviceState,
            attachedAt: now,
            properties: { mac, carrier: carrier ? 'yes' : 'no' },
          });
        }
      } catch { /* /sys/class/net unavailable */ }

      // Enumerate I2C buses
      try {
        const i2cDevs = fsModule.readdirSync('/sys/class/i2c-adapter');
        for (const dev of i2cDevs) {
          discovered.push({
            id: dev,
            name: dev,
            deviceClass: 'i2c' as DeviceClass,
            driver: '',
            subsystem: 'i2c',
            path: `/sys/class/i2c-adapter/${dev}`,
            devNode: `/dev/${dev}`,
            state: 'attached' as DeviceState,
            attachedAt: now,
            properties: {},
          });
        }
      } catch { /* not available */ }

      // Enumerate GPIO chips
      try {
        const gpioDevs = fsModule.readdirSync('/sys/class/gpio').filter(d => d.startsWith('gpiochip'));
        for (const dev of gpioDevs) {
          const sysPath = `/sys/class/gpio/${dev}`;
          let ngpio = '';
          let label = '';
          try { ngpio = fsModule.readFileSync(`${sysPath}/ngpio`, 'utf8').trim(); } catch { /* ignore */ }
          try { label = fsModule.readFileSync(`${sysPath}/label`, 'utf8').trim(); } catch { /* ignore */ }
          discovered.push({
            id: dev,
            name: label || dev,
            deviceClass: 'gpio' as DeviceClass,
            driver: '',
            subsystem: 'gpio',
            path: sysPath,
            devNode: `/dev/${dev}`,
            state: 'attached' as DeviceState,
            attachedAt: now,
            properties: { ngpio, label },
          });
        }
      } catch { /* not available */ }

      // Enumerate thermal zones
      try {
        const thermalDevs = fsModule.readdirSync('/sys/class/thermal').filter(d => d.startsWith('thermal_zone'));
        for (const dev of thermalDevs) {
          const sysPath = `/sys/class/thermal/${dev}`;
          let type = '';
          let temp = '';
          try { type = fsModule.readFileSync(`${sysPath}/type`, 'utf8').trim(); } catch { /* ignore */ }
          try { temp = fsModule.readFileSync(`${sysPath}/temp`, 'utf8').trim(); } catch { /* ignore */ }
          discovered.push({
            id: dev,
            name: type || dev,
            deviceClass: 'thermal' as DeviceClass,
            driver: '',
            subsystem: 'thermal',
            path: sysPath,
            state: 'attached' as DeviceState,
            attachedAt: now,
            properties: { type, temp },
          });
        }
      } catch { /* not available */ }
    }

    if (discovered.length > 0) {
      for (const d of discovered) {
        this.devices.set(d.id, d);
      }
      return;
    }

    // Fallback: typical Raspberry Pi 5 device inventory
    const devs: DeviceDescriptor[] = [
      { id: 'mmcblk0', name: 'MicroSD Card', deviceClass: 'block', driver: 'mmc_block', subsystem: 'block', path: '/sys/block/mmcblk0', devNode: '/dev/mmcblk0', major: 179, minor: 0, vendor: 'SanDisk', product: 'Ultra 64GB', state: 'attached', attachedAt: now, properties: { size: '64000000000', type: 'sd' } },
      { id: 'mmcblk0p1', name: 'Boot Partition', deviceClass: 'block', driver: 'mmc_block', subsystem: 'block', path: '/sys/block/mmcblk0/mmcblk0p1', devNode: '/dev/mmcblk0p1', major: 179, minor: 1, state: 'attached', attachedAt: now, properties: { fstype: 'vfat', mountpoint: '/boot', size: '536870912' } },
      { id: 'mmcblk0p2', name: 'Root Partition', deviceClass: 'block', driver: 'mmc_block', subsystem: 'block', path: '/sys/block/mmcblk0/mmcblk0p2', devNode: '/dev/mmcblk0p2', major: 179, minor: 2, state: 'attached', attachedAt: now, properties: { fstype: 'ext4', mountpoint: '/', size: '63460000000' } },
      { id: 'nvme0n1', name: 'NVMe SSD', deviceClass: 'block', driver: 'nvme', subsystem: 'block', path: '/sys/block/nvme0n1', devNode: '/dev/nvme0n1', major: 259, minor: 0, vendor: 'Samsung', product: '980 PRO 256GB', state: 'attached', attachedAt: now, properties: { size: '256000000000', type: 'nvme', pcie: 'gen3x1' } },
      { id: 'eth0', name: 'Ethernet (BCM54213PE)', deviceClass: 'net', driver: 'bcmgenet', subsystem: 'net', path: '/sys/class/net/eth0', state: 'attached', attachedAt: now, properties: { mac: 'dc:a6:32:xx:xx:xx', speed: '1000', carrier: 'yes' } },
      { id: 'wlan0', name: 'Wi-Fi (BCM43455)', deviceClass: 'net', driver: 'brcmfmac', subsystem: 'net', path: '/sys/class/net/wlan0', state: 'attached', attachedAt: now, properties: { mac: 'dc:a6:32:yy:yy:yy', mode: 'managed' } },
      { id: 'usb1', name: 'USB 3.0 Host Controller', deviceClass: 'usb', driver: 'xhci_hcd', subsystem: 'usb', path: '/sys/bus/usb/devices/usb1', state: 'attached', attachedAt: now, vendor: 'Linux Foundation', product: 'xHCI Root Hub', properties: { speed: '5000', version: '3.0' } },
      { id: 'gpiochip0', name: 'GPIO Controller (RP1)', deviceClass: 'gpio', driver: 'pinctrl-rp1', subsystem: 'gpio', path: '/sys/class/gpio/gpiochip0', devNode: '/dev/gpiochip0', state: 'attached', attachedAt: now, properties: { ngpio: '54', base: '0', label: 'pinctrl-rp1' } },
      { id: 'i2c-1', name: 'I2C Bus 1', deviceClass: 'i2c', driver: 'bcm2835-i2c', subsystem: 'i2c', path: '/sys/class/i2c-adapter/i2c-1', devNode: '/dev/i2c-1', state: 'attached', attachedAt: now, properties: { frequency: '100000' } },
      { id: 'thermal0', name: 'CPU Thermal Zone', deviceClass: 'thermal', driver: 'bcm2712-thermal', subsystem: 'thermal', path: '/sys/class/thermal/thermal_zone0', state: 'attached', attachedAt: now, properties: { type: 'cpu-thermal', temp: '42000' } },
      { id: 'video0', name: 'VideoCore VII GPU', deviceClass: 'video', driver: 'vc4-drm', subsystem: 'drm', path: '/sys/class/drm/card0', devNode: '/dev/dri/card0', state: 'attached', attachedAt: now, properties: { driver: 'vc4', memory: '256M' } },
    ];

    for (const d of devs) {
      this.devices.set(d.id, d);
    }
  }

  /** Initialize default udev rules. */
  private initDefaultRules(): void {
    this.rules = [
      { id: 'rule-gpio', name: 'GPIO Access', match: { subsystem: 'gpio' }, action: { permissions: '0660', group: 'gpio' }, priority: 10, enabled: true },
      { id: 'rule-i2c', name: 'I2C Access', match: { subsystem: 'i2c' }, action: { permissions: '0660', group: 'i2c' }, priority: 10, enabled: true },
      { id: 'rule-spi', name: 'SPI Access', match: { subsystem: 'spi' }, action: { permissions: '0660', group: 'spi' }, priority: 10, enabled: true },
      { id: 'rule-usb-storage', name: 'USB Storage Mount', match: { subsystem: 'usb', driver: 'usb-storage' }, action: { runCommand: '/opt/pinet/auto-mount.sh' }, priority: 20, enabled: true },
      { id: 'rule-hailo', name: 'Hailo NPU Access', match: { vendor: 'Hailo' }, action: { permissions: '0666', symlink: 'npu0' }, priority: 15, enabled: true },
      { id: 'rule-serial', name: 'Serial Port Access', match: { deviceClass: 'serial' }, action: { permissions: '0660', group: 'dialout' }, priority: 10, enabled: true },
    ];
  }

  // ─── Device Lifecycle ─────────────────────────────────────────────────

  /** Add a device (hotplug). */
  addDevice(device: DeviceDescriptor): void {
    this.devices.set(device.id, device);
    const event: DeviceEvent = { type: 'add', device, timestamp: Date.now() };
    this.eventLog.push(event);
    this.applyRules(device);
    for (const l of this.listeners) { try { l(event); } catch { /* noop */ } }
    this.notifyChange();
  }

  /** Remove a device (unplug). */
  removeDevice(id: string): boolean {
    const device = this.devices.get(id);
    if (!device) return false;
    device.state = 'detached';
    const event: DeviceEvent = { type: 'remove', device, timestamp: Date.now() };
    this.eventLog.push(event);
    this.devices.delete(id);
    for (const l of this.listeners) { try { l(event); } catch { /* noop */ } }
    this.notifyChange();
    return true;
  }

  /** Update device state. */
  updateDeviceState(id: string, state: DeviceState, properties?: Record<string, string>): boolean {
    const device = this.devices.get(id);
    if (!device) return false;
    device.state = state;
    if (properties) Object.assign(device.properties, properties);
    const event: DeviceEvent = { type: 'change', device, timestamp: Date.now() };
    this.eventLog.push(event);
    for (const l of this.listeners) { try { l(event); } catch { /* noop */ } }
    this.notifyChange();
    return true;
  }

  /** Apply udev rules to a device. */
  private applyRules(device: DeviceDescriptor): void {
    for (const rule of this.rules.sort((a, b) => a.priority - b.priority)) {
      if (!rule.enabled) continue;
      const m = rule.match;
      if (m.subsystem && device.subsystem !== m.subsystem) continue;
      if (m.vendor && device.vendor !== m.vendor) continue;
      if (m.product && device.product !== m.product) continue;
      if (m.driver && device.driver !== m.driver) continue;
      if (m.deviceClass && device.deviceClass !== m.deviceClass) continue;
      // Rule matches — apply actions
      if (rule.action.env) Object.assign(device.properties, rule.action.env);
    }
  }

  // ─── Udev Rules ───────────────────────────────────────────────────────

  addRule(rule: UdevRule): void {
    this.rules.push(rule);
    this.notifyChange();
  }

  removeRule(id: string): boolean {
    const idx = this.rules.findIndex(r => r.id === id);
    if (idx < 0) return false;
    this.rules.splice(idx, 1);
    this.notifyChange();
    return true;
  }

  listRules(): UdevRule[] {
    return [...this.rules];
  }

  // ─── Queries ──────────────────────────────────────────────────────────

  getDevice(id: string): DeviceDescriptor | undefined {
    return this.devices.get(id);
  }

  listDevices(): DeviceDescriptor[] {
    return Array.from(this.devices.values());
  }

  listByClass(deviceClass: DeviceClass): DeviceDescriptor[] {
    return this.listDevices().filter(d => d.deviceClass === deviceClass);
  }

  getEvents(limit = 50): DeviceEvent[] {
    return this.eventLog.slice(-limit);
  }

  getDeviceTree(): Record<string, DeviceDescriptor[]> {
    const tree: Record<string, DeviceDescriptor[]> = {};
    for (const dev of this.devices.values()) {
      if (!tree[dev.deviceClass]) tree[dev.deviceClass] = [];
      tree[dev.deviceClass].push(dev);
    }
    return tree;
  }

  getStats(): { total: number; byClass: Record<string, number>; byState: Record<string, number> } {
    const byClass: Record<string, number> = {};
    const byState: Record<string, number> = {};
    for (const d of this.devices.values()) {
      byClass[d.deviceClass] = (byClass[d.deviceClass] || 0) + 1;
      byState[d.state] = (byState[d.state] || 0) + 1;
    }
    return { total: this.devices.size, byClass, byState };
  }

  // ─── Observers ────────────────────────────────────────────────────────

  /** Subscribe to device events (add/remove/change). */
  onDeviceEvent(listener: (event: DeviceEvent) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  /** Subscribe to any device manager changes. */
  subscribe(listener: () => void): () => void {
    this.changeListeners.push(listener);
    return () => { this.changeListeners = this.changeListeners.filter(l => l !== listener); };
  }

  private notifyChange(): void {
    for (const l of this.changeListeners) { try { l(); } catch { /* noop */ } }
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const deviceManager = new DeviceManager();
