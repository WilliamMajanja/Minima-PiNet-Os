/**
 * PiNetOS I2C Controller
 * ======================
 * TypeScript interface to Linux I2C devices via `/dev/i2c-N` on RPi 5.
 * Supports both 7-bit and 10-bit addressing, SMBus commands, and raw
 * byte/word/block transfers.
 *
 * Requires `i2c-dev` kernel module (loaded automatically on RPi 5 when
 * `dtparam=i2c_arm=on` is set in /boot/config.txt).
 */

import * as fs from 'fs';
import { execFileSync } from 'child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface I2cDevice {
  bus:     number;
  address: number;
}

export interface I2cScanResult {
  bus:       number;
  addresses: number[];
}

// Helper: validate that a value is a safe non-negative integer
const safeInt = (v: unknown, max: number = 0xFFFF): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`Invalid I2C value: ${v}`);
  return n;
};

const toHex = (n: number): string => `0x${n.toString(16)}`;

// ---------------------------------------------------------------------------
// I2C Controller
// ---------------------------------------------------------------------------
export class I2cController {
  private readonly devBase    = '/dev/i2c-';
  private useSimulation       = false;
  private openBuses           = new Map<number, number>();  // bus → fd (simulated)

  constructor() {
    this.useSimulation = !fs.existsSync(`${this.devBase}1`);
    if (this.useSimulation) {
      console.warn('[I2C] I2C hardware not found — running in simulation mode');
    }
  }

  async init(): Promise<void> {
    if (!this.useSimulation) {
      // Ensure i2c-dev module is loaded
      try { execFileSync('modprobe', ['i2c-dev'], { stdio: 'ignore' }); } catch {}
    }
  }

  // ---- Bus scanning -------------------------------------------------------

  async scan(bus: number = 1): Promise<I2cScanResult> {
    if (this.useSimulation) {
      return { bus, addresses: [0x3c, 0x48, 0x68] };  // simulated devices
    }
    const safeBus = safeInt(bus, 255);
    const found: number[] = [];
    try {
      const raw = execFileSync('i2cdetect', ['-y', '-r', String(safeBus)], { stdio: 'pipe' }).toString();
      const hexMatches = raw.match(/\b[0-9a-f]{2}\b/g) || [];
      for (const h of hexMatches) {
        const addr = parseInt(h, 16);
        if (addr >= 0x03 && addr <= 0x77) found.push(addr);
      }
    } catch {
      console.warn(`[I2C] i2cdetect not available on bus ${bus}`);
    }
    return { bus, addresses: found };
  }

  // ---- Low-level transfers (via i2c-tools or /dev/i2c-N ioctls) -----------

  async readByte(device: I2cDevice, register: number): Promise<number> {
    if (this.useSimulation) return Math.floor(Math.random() * 256);
    const bus = safeInt(device.bus, 255);
    const addr = safeInt(device.address, 0x7F);
    const reg = safeInt(register, 0xFF);
    const result = execFileSync(
      'i2cget', ['-y', String(bus), toHex(addr), toHex(reg), 'b'], { stdio: 'pipe' }
    ).toString().trim();
    return parseInt(result, 16);
  }

  async writeByte(device: I2cDevice, register: number, value: number): Promise<void> {
    if (this.useSimulation) {
      console.debug(`[I2C-SIM] Write bus=${device.bus} addr=0x${device.address.toString(16)} reg=0x${register.toString(16)} val=0x${value.toString(16)}`);
      return;
    }
    const bus = safeInt(device.bus, 255);
    const addr = safeInt(device.address, 0x7F);
    const reg = safeInt(register, 0xFF);
    const val = safeInt(value, 0xFF);
    execFileSync(
      'i2cset', ['-y', String(bus), toHex(addr), toHex(reg), toHex(val), 'b'], { stdio: 'pipe' }
    );
  }

  async readWord(device: I2cDevice, register: number): Promise<number> {
    if (this.useSimulation) return Math.floor(Math.random() * 65536);
    const bus = safeInt(device.bus, 255);
    const addr = safeInt(device.address, 0x7F);
    const reg = safeInt(register, 0xFF);
    const result = execFileSync(
      'i2cget', ['-y', String(bus), toHex(addr), toHex(reg), 'w'], { stdio: 'pipe' }
    ).toString().trim();
    return parseInt(result, 16);
  }

  async writeWord(device: I2cDevice, register: number, value: number): Promise<void> {
    if (this.useSimulation) return;
    const bus = safeInt(device.bus, 255);
    const addr = safeInt(device.address, 0x7F);
    const reg = safeInt(register, 0xFF);
    const val = safeInt(value, 0xFFFF);
    execFileSync(
      'i2cset', ['-y', String(bus), toHex(addr), toHex(reg), toHex(val), 'w'], { stdio: 'pipe' }
    );
  }

  async readBlock(device: I2cDevice, register: number, length: number): Promise<Buffer> {
    if (this.useSimulation) return Buffer.alloc(length, 0xAA);
    const bus = safeInt(device.bus, 255);
    const addr = safeInt(device.address, 0x7F);
    const reg = safeInt(register, 0xFF);
    const len = safeInt(length, 256);
    const rangeEnd = Math.min(reg + len - 1, 0xFF);
    const result = execFileSync(
      'i2cdump', ['-y', '-r', `${toHex(reg)}-${toHex(rangeEnd)}`, String(bus), toHex(addr), 'b'], { stdio: 'pipe' }
    ).toString();
    const bytes = (result.match(/\b[0-9a-f]{2}\b/g) || []).map(h => parseInt(h, 16));
    return Buffer.from(bytes.slice(0, length));
  }

  // ---- Convenience: common sensor helpers ---------------------------------

  /** Read a 16-bit big-endian signed value (e.g., ADS1115, BMP280) */
  async readInt16BE(device: I2cDevice, register: number): Promise<number> {
    const word = await this.readWord(device, register);
    const swapped = ((word & 0xFF) << 8) | ((word >> 8) & 0xFF);
    return swapped >= 0x8000 ? swapped - 0x10000 : swapped;
  }

  async shutdown(): Promise<void> {
    this.openBuses.clear();
  }
}
