/**
 * PiNetOS Hardware Abstraction Layer (HAL)
 * =========================================
 * Unified entry-point for all Raspberry Pi 5 hardware interfaces.
 * Runs on Node.js inside the Electron shell or as a standalone server process.
 *
 * Usage:
 *   import { hal } from './hal';
 *   await hal.gpio.write(18, true);
 *   const temp = await hal.thermal.getCpuTemp();
 */

import { GpioController } from './gpio';
import { I2cController } from './i2c';
import { SpiController } from './spi';
import { ThermalMonitor } from './thermal';
import { StorageManager } from './storage';

export interface HardwareAbstractionLayer {
  gpio:    GpioController;
  i2c:     I2cController;
  spi:     SpiController;
  thermal: ThermalMonitor;
  storage: StorageManager;
  /** Initialise all subsystems */
  init(): Promise<void>;
  /** Gracefully release hardware resources */
  shutdown(): Promise<void>;
}

class HAL implements HardwareAbstractionLayer {
  public gpio:    GpioController;
  public i2c:     I2cController;
  public spi:     SpiController;
  public thermal: ThermalMonitor;
  public storage: StorageManager;

  constructor() {
    this.gpio    = new GpioController();
    this.i2c     = new I2cController();
    this.spi     = new SpiController();
    this.thermal = new ThermalMonitor();
    this.storage = new StorageManager();
  }

  async init(): Promise<void> {
    console.log('[HAL] Initialising PiNetOS Hardware Abstraction Layer...');
    await Promise.all([
      this.gpio.init(),
      this.i2c.init(),
      this.spi.init(),
      this.thermal.init(),
      this.storage.init(),
    ]);
    console.log('[HAL] All subsystems ready.');
  }

  async shutdown(): Promise<void> {
    console.log('[HAL] Shutting down hardware subsystems...');
    await Promise.all([
      this.gpio.shutdown(),
      this.i2c.shutdown(),
      this.spi.shutdown(),
      this.thermal.shutdown(),
      this.storage.shutdown(),
    ]);
    console.log('[HAL] Hardware shutdown complete.');
  }
}

/** Singleton HAL instance */
export const hal: HardwareAbstractionLayer = new HAL();

// Re-export individual controllers for direct use
export { GpioController } from './gpio';
export { I2cController }  from './i2c';
export { SpiController }  from './spi';
export { ThermalMonitor } from './thermal';
export { StorageManager } from './storage';
