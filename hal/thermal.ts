/**
 * PiNetOS Thermal & Power Monitor
 * ================================
 * Reads CPU temperature, core voltages, and throttle status from the
 * Raspberry Pi 5 hardware via:
 *   - /sys/class/thermal/thermal_zone0/temp  (CPU temp in millidegrees)
 *   - vcgencmd measure_temp                  (VideoCore firmware)
 *   - vcgencmd measure_volts                 (PMIC voltages)
 *   - vcgencmd get_throttled                 (throttle bits)
 */

import * as fs from 'fs';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThermalReading {
  cpuTempC:       number;  // CPU temperature in °C
  gpuTempC:       number;  // GPU/VideoCore temperature in °C
  ambientTempC:   number;  // Ambient if HAT sensor is connected
  timestamp:      number;  // Unix timestamp (ms)
}

export interface PowerReading {
  coreVoltage:    number;  // V (ARM core)
  sdramIVoltage:  number;  // V (SDRAM I/O)
  sdramPVoltage:  number;  // V (SDRAM PLL)
  sdramCVoltage:  number;  // V (SDRAM core)
  timestamp:      number;
}

export interface ThrottleStatus {
  /** Full 32-bit throttled register from vcgencmd */
  raw:                      number;
  underVoltageDetected:     boolean;
  armFrequencyCapped:       boolean;
  currentlyThrottled:       boolean;
  softTempLimitActive:      boolean;
  underVoltageOccurred:     boolean;
  armFrequencyCapOccurred:  boolean;
  throttlingOccurred:       boolean;
  softTempLimitOccurred:    boolean;
}

export interface SystemHealth {
  thermal:  ThermalReading;
  power:    PowerReading;
  throttle: ThrottleStatus;
}

// ---------------------------------------------------------------------------
// Thermal Monitor
// ---------------------------------------------------------------------------
export class ThermalMonitor {
  private readonly thermalZone = '/sys/class/thermal/thermal_zone0/temp';
  private useSimulation        = false;
  private pollingInterval?: ReturnType<typeof setInterval>;
  private subscribers          = new Set<(h: SystemHealth) => void>();

  constructor() {
    this.useSimulation = !fs.existsSync(this.thermalZone);
    if (this.useSimulation) {
      console.warn('[THERMAL] Thermal hardware not found — running in simulation mode');
    }
  }

  async init(): Promise<void> {}

  // ---- Single readings ----------------------------------------------------

  async getCpuTemp(): Promise<number> {
    if (this.useSimulation) return 45 + Math.random() * 10;
    const raw = fs.readFileSync(this.thermalZone, 'utf8').trim();
    return parseInt(raw, 10) / 1000;
  }

  async getGpuTemp(): Promise<number> {
    if (this.useSimulation) return 42 + Math.random() * 8;
    try {
      const raw = execSync('vcgencmd measure_temp 2>/dev/null').toString();
      const m   = raw.match(/temp=([\d.]+)/);
      return m ? parseFloat(m[1]) : 0;
    } catch {
      return await this.getCpuTemp();  // fallback
    }
  }

  async getThermalReading(): Promise<ThermalReading> {
    const [cpuTempC, gpuTempC] = await Promise.all([
      this.getCpuTemp(),
      this.getGpuTemp(),
    ]);
    return { cpuTempC, gpuTempC, ambientTempC: 0, timestamp: Date.now() };
  }

  // ---- Power / voltage ----------------------------------------------------

  async getPowerReading(): Promise<PowerReading> {
    if (this.useSimulation) {
      return {
        coreVoltage:   1.1, sdramIVoltage: 1.1,
        sdramPVoltage: 1.1, sdramCVoltage: 1.1, timestamp: Date.now(),
      };
    }
    const read = (param: string): number => {
      try {
        const raw = execSync(`vcgencmd measure_volts ${param} 2>/dev/null`).toString();
        const m   = raw.match(/volt=([\d.]+)/);
        return m ? parseFloat(m[1]) : 0;
      } catch { return 0; }
    };
    return {
      coreVoltage:   read('core'),
      sdramIVoltage: read('sdram_i'),
      sdramPVoltage: read('sdram_p'),
      sdramCVoltage: read('sdram_c'),
      timestamp:     Date.now(),
    };
  }

  // ---- Throttle status ----------------------------------------------------

  async getThrottleStatus(): Promise<ThrottleStatus> {
    if (this.useSimulation) {
      return {
        raw: 0, underVoltageDetected: false, armFrequencyCapped: false,
        currentlyThrottled: false, softTempLimitActive: false,
        underVoltageOccurred: false, armFrequencyCapOccurred: false,
        throttlingOccurred: false, softTempLimitOccurred: false,
      };
    }
    let raw = 0;
    try {
      const output = execSync('vcgencmd get_throttled 2>/dev/null').toString();
      const m      = output.match(/throttled=0x([0-9a-fA-F]+)/);
      if (m) raw = parseInt(m[1], 16);
    } catch {}

    return {
      raw,
      underVoltageDetected:    !!(raw & 0x00001),
      armFrequencyCapped:      !!(raw & 0x00002),
      currentlyThrottled:      !!(raw & 0x00004),
      softTempLimitActive:     !!(raw & 0x00008),
      underVoltageOccurred:    !!(raw & 0x10000),
      armFrequencyCapOccurred: !!(raw & 0x20000),
      throttlingOccurred:      !!(raw & 0x40000),
      softTempLimitOccurred:   !!(raw & 0x80000),
    };
  }

  // ---- Aggregated health --------------------------------------------------

  async getSystemHealth(): Promise<SystemHealth> {
    const [thermal, power, throttle] = await Promise.all([
      this.getThermalReading(),
      this.getPowerReading(),
      this.getThrottleStatus(),
    ]);
    return { thermal, power, throttle };
  }

  // ---- Polling / subscriptions --------------------------------------------

  /**
   * Subscribe to continuous health updates every `intervalMs` (default 5 s).
   * Returns an unsubscribe function.
   */
  subscribe(callback: (h: SystemHealth) => void, intervalMs = 5000): () => void {
    this.subscribers.add(callback);
    if (!this.pollingInterval) {
      this.pollingInterval = setInterval(async () => {
        try {
          const health = await this.getSystemHealth();
          this.subscribers.forEach(cb => cb(health));
        } catch (e) {
          console.error('[THERMAL] Polling error:', e);
        }
      }, intervalMs);
    }
    return () => {
      this.subscribers.delete(callback);
      if (this.subscribers.size === 0 && this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = undefined;
      }
    };
  }

  async shutdown(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
    this.subscribers.clear();
  }
}
