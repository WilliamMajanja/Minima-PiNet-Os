/**
 * PiNetOS GPIO Controller
 * =======================
 * Provides a clean TypeScript interface to the Linux GPIO character device
 * (/dev/gpiochip0) on Raspberry Pi 5 (BCM2712).
 *
 * Uses the standard `/sys/class/gpio` sysfs interface as a fallback when
 * the `libgpiod` binding is unavailable, making it runnable in both native
 * RPi and simulation environments.
 */

import * as fs from 'fs';
import * as path from 'path';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GpioDirection = 'in' | 'out';
export type GpioPull      = 'none' | 'up' | 'down';
export type GpioEdge      = 'none' | 'rising' | 'falling' | 'both';

export interface GpioPinConfig {
  direction:  GpioDirection;
  pull?:      GpioPull;
  edge?:      GpioEdge;
  activeLow?: boolean;
}

export interface GpioPinStatus {
  pin:       number;
  direction: GpioDirection;
  value:     boolean;
  pull:      GpioPull;
}

type EdgeCallback = (pin: number, value: boolean) => void;

// ---------------------------------------------------------------------------
// BCM2712 GPIO Map (physical pin → BCM GPIO number)
// ---------------------------------------------------------------------------
export const RPi5_PIN_MAP: Record<string, number> = {
  PIN3:  2,  PIN5:  3,  PIN7:  4,  PIN8:  14, PIN10: 15,
  PIN11: 17, PIN12: 18, PIN13: 27, PIN15: 22, PIN16: 23,
  PIN18: 24, PIN19: 10, PIN21: 9,  PIN22: 25, PIN23: 11,
  PIN24: 8,  PIN26: 7,  PIN27: 0,  PIN28: 1,  PIN29: 5,
  PIN31: 6,  PIN32: 12, PIN33: 13, PIN35: 19, PIN36: 16,
  PIN37: 26, PIN38: 20, PIN40: 21,
};

// ---------------------------------------------------------------------------
// GPIO Controller
// ---------------------------------------------------------------------------
export class GpioController {
  private readonly sysfsBase = '/sys/class/gpio';
  private readonly gpiochip  = '/dev/gpiochip0';
  private exportedPins       = new Set<number>();
  private callbacks          = new Map<number, EdgeCallback>();
  private watchers           = new Map<number, fs.FSWatcher>();

  constructor() {
    if (!fs.existsSync(this.gpiochip) && !fs.existsSync(this.sysfsBase)) {
      console.warn('[GPIO] GPIO hardware not found — GPIO operations will be no-ops until hardware is available');
    }
  }

  async init(): Promise<void> {
    if (fs.existsSync(this.sysfsBase)) {
      const stat = fs.statSync(this.sysfsBase);
      if (!stat) throw new Error('[GPIO] Cannot access sysfs GPIO interface');
    }
  }

  private get hardwareAvailable(): boolean {
    return fs.existsSync(this.gpiochip) || fs.existsSync(this.sysfsBase);
  }

  // ---- Export / unexport ---------------------------------------------------

  async export(pin: number, config: GpioPinConfig): Promise<void> {
    if (!this.hardwareAvailable) {
      this.exportedPins.add(pin);
      console.debug(`[GPIO] Pin ${pin} export deferred — no GPIO hardware`);
      return;
    }
    const pinPath = path.join(this.sysfsBase, `gpio${pin}`);
    if (!fs.existsSync(pinPath)) {
      fs.writeFileSync(path.join(this.sysfsBase, 'export'), String(pin));
      await this.waitForPinExport(pin);
    }
    // Direction
    fs.writeFileSync(path.join(pinPath, 'direction'), config.direction);
    // Active low
    if (config.activeLow !== undefined) {
      fs.writeFileSync(path.join(pinPath, 'active_low'), config.activeLow ? '1' : '0');
    }
    // Edge for interrupts
    if (config.edge && config.direction === 'in') {
      fs.writeFileSync(path.join(pinPath, 'edge'), config.edge);
    }
    this.exportedPins.add(pin);
  }

  async unexport(pin: number): Promise<void> {
    if (!this.hardwareAvailable) { this.exportedPins.delete(pin); return; }
    const pinPath = path.join(this.sysfsBase, `gpio${pin}`);
    this.removeWatcher(pin);
    if (fs.existsSync(pinPath)) {
      fs.writeFileSync(path.join(this.sysfsBase, 'unexport'), String(pin));
    }
    this.exportedPins.delete(pin);
  }

  // ---- Read / Write --------------------------------------------------------

  async write(pin: number, value: boolean): Promise<void> {
    if (!this.hardwareAvailable) {
      console.debug(`[GPIO] Pin ${pin} write deferred — no GPIO hardware`);
      return;
    }
    const valuePath = path.join(this.sysfsBase, `gpio${pin}`, 'value');
    fs.writeFileSync(valuePath, value ? '1' : '0');
  }

  async read(pin: number): Promise<boolean> {
    if (!this.hardwareAvailable) return false;
    const valuePath = path.join(this.sysfsBase, `gpio${pin}`, 'value');
    const raw = fs.readFileSync(valuePath, 'utf8').trim();
    return raw === '1';
  }

  async toggle(pin: number): Promise<boolean> {
    const current = await this.read(pin);
    await this.write(pin, !current);
    return !current;
  }

  // ---- PWM (software via /sys/class/pwm) -----------------------------------

  async setPwm(gpioPin: number, frequencyHz: number, dutyCycle: number): Promise<void> {
    const pwmChip   = '/sys/class/pwm/pwmchip0';
    const periodNs  = Math.round(1_000_000_000 / frequencyHz);
    const dutyNs    = Math.round(periodNs * Math.min(1, Math.max(0, dutyCycle)));

    if (!fs.existsSync(pwmChip)) {
      console.warn('[GPIO] Hardware PWM not available');
      return;
    }
    const pwmPath = path.join(pwmChip, 'pwm0');
    if (!fs.existsSync(pwmPath)) {
      fs.writeFileSync(path.join(pwmChip, 'export'), '0');
      await new Promise(r => setTimeout(r, 50));
    }
    fs.writeFileSync(path.join(pwmPath, 'period'),    String(periodNs));
    fs.writeFileSync(path.join(pwmPath, 'duty_cycle'), String(dutyNs));
    fs.writeFileSync(path.join(pwmPath, 'enable'),    '1');
  }

  // ---- Interrupt / edge detection -----------------------------------------

  watch(pin: number, callback: EdgeCallback): void {
    this.callbacks.set(pin, callback);
    if (!this.hardwareAvailable) return;
    const valuePath = path.join(this.sysfsBase, `gpio${pin}`, 'value');
    if (!fs.existsSync(valuePath)) return;
    const watcher = fs.watch(valuePath, () => {
      const val = fs.readFileSync(valuePath, 'utf8').trim() === '1';
      callback(pin, val);
    });
    this.watchers.set(pin, watcher);
  }

  unwatch(pin: number): void {
    this.callbacks.delete(pin);
    this.removeWatcher(pin);
  }

  // ---- Utility -------------------------------------------------------------

  getExportedPins(): number[] {
    return Array.from(this.exportedPins);
  }

  async getStatus(pin: number): Promise<GpioPinStatus> {
    const dirPath = path.join(this.sysfsBase, `gpio${pin}`, 'direction');
    const direction = !this.hardwareAvailable
      ? 'out'
      : (fs.existsSync(dirPath) ? fs.readFileSync(dirPath, 'utf8').trim() as GpioDirection : 'out');
    return {
      pin,
      direction,
      value: await this.read(pin),
      pull:  'none',
    };
  }

  async shutdown(): Promise<void> {
    for (const pin of this.exportedPins) {
      await this.unexport(pin).catch(() => {});
    }
  }

  // ---- Private helpers -----------------------------------------------------

  private removeWatcher(pin: number): void {
    const w = this.watchers.get(pin);
    if (w) { w.close(); this.watchers.delete(pin); }
  }

  private waitForPinExport(pin: number, timeoutMs = 1000): Promise<void> {
    return new Promise((resolve, reject) => {
      const pinPath = path.join(this.sysfsBase, `gpio${pin}`);
      const start   = Date.now();
      const poll    = () => {
        if (fs.existsSync(pinPath)) return resolve();
        if (Date.now() - start > timeoutMs) return reject(new Error(`GPIO ${pin} export timed out`));
        setTimeout(poll, 20);
      };
      poll();
    });
  }
}
