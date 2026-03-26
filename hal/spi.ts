/**
 * PiNetOS SPI Controller
 * ======================
 * TypeScript interface to Linux SPI devices via `/dev/spidev0.N` on RPi 5.
 * Supports full-duplex transfers, configurable clock polarity/phase,
 * and common SPI device helpers.
 *
 * Requires the `spidev` kernel module and `dtparam=spi=on` in /boot/config.txt.
 */

import * as fs from 'fs';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpiMode = 0 | 1 | 2 | 3;  // CPOL/CPHA combination

export interface SpiDeviceConfig {
  /** SPI bus number (0 or 1 on RPi 5) */
  bus:         number;
  /** Chip-select number */
  cs:          number;
  /** Max clock speed in Hz (default: 500_000) */
  maxSpeedHz:  number;
  /** SPI mode: CPOL/CPHA (default: 0) */
  mode:        SpiMode;
  /** Bits per word (default: 8) */
  bitsPerWord: number;
  /** CS active high (default: false) */
  csHigh:      boolean;
  /** LSB first (default: false) */
  lsbFirst:    boolean;
}

const DEFAULT_CONFIG: SpiDeviceConfig = {
  bus:         0,
  cs:          0,
  maxSpeedHz:  500_000,
  mode:        0,
  bitsPerWord: 8,
  csHigh:      false,
  lsbFirst:    false,
};

// SPI ioctl constants for Linux
const SPI_IOC_MAGIC = 'k'.charCodeAt(0);

// ---------------------------------------------------------------------------
// SPI Controller
// ---------------------------------------------------------------------------
export class SpiController {
  private readonly devBase = '/dev/spidev';
  private useSimulation    = false;

  constructor() {
    this.useSimulation = !fs.existsSync(`${this.devBase}0.0`);
    if (this.useSimulation) {
      console.warn('[SPI] SPI hardware not found — running in simulation mode');
    }
  }

  async init(): Promise<void> {
    if (!this.useSimulation) {
      try { execSync('modprobe spidev 2>/dev/null', { stdio: 'ignore' }); } catch {}
    }
  }

  // ---- Transfer -----------------------------------------------------------

  /**
   * Perform a full-duplex SPI transfer.
   * Returns the received data buffer (same length as `txData`).
   */
  async transfer(
    txData: Buffer,
    config: Partial<SpiDeviceConfig> = {}
  ): Promise<Buffer> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const devPath = `${this.devBase}${cfg.bus}.${cfg.cs}`;

    if (this.useSimulation) {
      console.debug(`[SPI-SIM] Transfer ${txData.length} bytes on ${devPath}`);
      return Buffer.alloc(txData.length, 0x00);
    }

    if (!fs.existsSync(devPath)) {
      throw new Error(`[SPI] Device ${devPath} not found. Check dtparam=spi=on in /boot/config.txt`);
    }

    // Use Python spidev as a bridge (avoids native N-API binary for portability).
    // Pass TX bytes via stdin to avoid any shell-injection risk.
    const hexTx = Array.from(txData).map(b => b.toString(16).padStart(2, '0')).join('');

    // All spidev parameters are numeric or boolean — safe to embed after validation.
    const bus         = Math.trunc(cfg.bus)         & 0xFF;
    const cs          = Math.trunc(cfg.cs)          & 0xFF;
    const maxSpeedHz  = Math.trunc(cfg.maxSpeedHz);
    const mode        = (cfg.mode & 3) as SpiMode;
    const bitsPerWord = Math.trunc(cfg.bitsPerWord) || 8;
    const csHigh      = cfg.csHigh  ? 'True' : 'False';
    const lsbFirst    = cfg.lsbFirst ? 'True' : 'False';

    // TX hex is passed via stdin; the script reads it there — no user data in the script string.
    const script = [
      'import spidev, sys',
      'spi = spidev.SpiDev()',
      `spi.open(${bus}, ${cs})`,
      `spi.max_speed_hz = ${maxSpeedHz}`,
      `spi.mode = ${mode}`,
      `spi.bits_per_word = ${bitsPerWord}`,
      `spi.cshigh = ${csHigh}`,
      `spi.lsbfirst = ${lsbFirst}`,
      'tx = bytes.fromhex(sys.stdin.readline().strip())',
      'rx = spi.xfer2(list(tx))',
      'spi.close()',
      'print("".join(f"{b:02x}" for b in rx))',
    ].join('\n');

    const result = execSync(`python3 -c '${script}'`, { input: hexTx }).toString().trim();
    return Buffer.from(result, 'hex');
  }

  /**
   * Write-only transfer (transmit `txData`, ignore received bytes).
   */
  async write(txData: Buffer, config: Partial<SpiDeviceConfig> = {}): Promise<void> {
    await this.transfer(txData, config);
  }

  /**
   * Read-only transfer (send `length` zero bytes, collect response).
   */
  async read(length: number, config: Partial<SpiDeviceConfig> = {}): Promise<Buffer> {
    return this.transfer(Buffer.alloc(length, 0x00), config);
  }

  // ---- Common device helpers ----------------------------------------------

  /** MCP3008 / MCP3204 — 8-channel 10-bit ADC */
  async mcp3008Read(channel: number, config: Partial<SpiDeviceConfig> = {}): Promise<number> {
    if (channel < 0 || channel > 7) throw new RangeError('MCP3008 channel must be 0–7');
    const tx = Buffer.from([0x01, (0x80 | (channel << 4)), 0x00]);
    const rx = await this.transfer(tx, { ...config, maxSpeedHz: 1_350_000 });
    return ((rx[1] & 0x03) << 8) | rx[2];
  }

  async shutdown(): Promise<void> {}
}
