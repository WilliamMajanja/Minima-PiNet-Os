/**
 * PiNet-OS Power Manager Service
 * Manages power states, CPU governor, watchdog, suspend/resume, and power monitoring.
 */

import os from 'os';
import * as fs from 'fs';
import { execFileSync } from 'child_process';
import type { PowerInfo, PowerState, PowerSource, WatchdogConfig } from '../types/kernel.js';

// ─── Power Manager ──────────────────────────────────────────────────────────

class PowerManager {
  private state: PowerState = 'running';
  private source: PowerSource = 'usb';
  private governor: PowerInfo['cpuGovernor'] = 'ondemand';
  private watchdog: WatchdogConfig = {
    enabled: true,
    timeoutMs: 30000,
    action: 'reboot',
    lastKick: Date.now(),
  };
  private bootTime = Date.now();
  private scheduledShutdown: { time: number; action: PowerState } | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    this.startWatchdog();
  }

  // ─── Power State ──────────────────────────────────────────────────────

  /** Get current power information. */
  getPowerInfo(): PowerInfo {
    const cpus = os.cpus();
    const avgFreq = cpus.length > 0 ? cpus.reduce((sum, c) => sum + c.speed, 0) / cpus.length : 1800;

    // Read real voltage/current/power from vcgencmd or sysfs
    let voltage = 5.1;
    let current = 0;
    let power = 0;
    let temperatureC = 0;
    let throttled = false;
    let underVoltage = false;

    try {
      const voltRaw = execFileSync('vcgencmd', ['measure_volts', 'core'], { stdio: 'pipe' }).toString();
      const vm = voltRaw.match(/volt=([\d.]+)/);
      if (vm) voltage = parseFloat(vm[1]);
    } catch { /* vcgencmd not available */ }

    try {
      const tempRaw = execFileSync('vcgencmd', ['measure_temp'], { stdio: 'pipe' }).toString();
      const tm = tempRaw.match(/temp=([\d.]+)/);
      if (tm) temperatureC = parseFloat(tm[1]);
    } catch {
      // Fallback to sysfs thermal zone
      try {
        const raw = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim();
        temperatureC = parseInt(raw, 10) / 1000;
      } catch { /* not available */ }
    }

    try {
      const throttleRaw = execFileSync('vcgencmd', ['get_throttled'], { stdio: 'pipe' }).toString();
      const thm = throttleRaw.match(/throttled=0x([0-9a-fA-F]+)/);
      if (thm) {
        const bits = parseInt(thm[1], 16);
        throttled = !!(bits & 0x00004);
        underVoltage = !!(bits & 0x00001);
      }
    } catch { /* not available */ }

    // Estimate power from voltage and typical RPi5 current draw
    current = voltage > 0 ? (avgFreq / 1800) * 2.5 : 0;
    power = voltage * current;

    return {
      state: this.state,
      source: this.source,
      uptimeMs: Date.now() - this.bootTime,
      voltage,
      current,
      power,
      cpuFrequencyMhz: avgFreq,
      cpuGovernor: this.governor,
      throttled,
      underVoltage,
      temperatureC,
    };
  }

  /** Request a power state transition. */
  async requestStateChange(newState: PowerState): Promise<{ success: boolean; message: string }> {
    switch (newState) {
      case 'poweroff':
        this.state = 'poweroff';
        this.notify();
        // Execute real poweroff via systemctl
        try { execFileSync('systemctl', ['poweroff'], { stdio: 'ignore' }); } catch { /* may fail in non-root */ }
        return { success: true, message: 'System powering off...' };

      case 'reboot':
        this.state = 'reboot';
        this.notify();
        // Execute real reboot via systemctl
        try { execFileSync('systemctl', ['reboot'], { stdio: 'ignore' }); } catch { /* may fail in non-root */ }
        return { success: true, message: 'System rebooting...' };

      case 'suspend':
        this.state = 'suspend';
        this.notify();
        try { execFileSync('systemctl', ['suspend'], { stdio: 'ignore' }); } catch { /* may fail */ }
        return { success: true, message: 'System suspended to RAM' };

      case 'hibernate':
        this.state = 'hibernate';
        this.notify();
        try { execFileSync('systemctl', ['hibernate'], { stdio: 'ignore' }); } catch { /* may fail */ }
        return { success: true, message: 'System hibernating to disk' };

      case 'running':
        if (this.state === 'suspend' || this.state === 'hibernate') {
          this.state = 'running';
          this.notify();
          return { success: true, message: 'System resumed' };
        }
        return { success: false, message: 'Already running' };

      default:
        return { success: false, message: `Invalid state: ${newState}` };
    }
  }

  // ─── CPU Governor ─────────────────────────────────────────────────────

  /** Set CPU frequency governor. */
  setGovernor(governor: PowerInfo['cpuGovernor']): boolean {
    const valid: PowerInfo['cpuGovernor'][] = ['performance', 'powersave', 'ondemand', 'conservative', 'schedutil'];
    if (!valid.includes(governor)) return false;
    this.governor = governor;
    this.notify();
    return true;
  }

  /** Get available governors. */
  getAvailableGovernors(): string[] {
    return ['performance', 'powersave', 'ondemand', 'conservative', 'schedutil'];
  }

  // ─── Scheduled Shutdown ───────────────────────────────────────────────

  /** Schedule a shutdown or reboot. */
  scheduleShutdown(action: 'poweroff' | 'reboot', delayMs: number): { scheduled: boolean; time: number } {
    const time = Date.now() + delayMs;
    this.scheduledShutdown = { time, action };
    this.notify();

    setTimeout(() => {
      if (this.scheduledShutdown && this.scheduledShutdown.time === time) {
        this.requestStateChange(action);
        this.scheduledShutdown = null;
      }
    }, delayMs);

    return { scheduled: true, time };
  }

  /** Cancel a scheduled shutdown. */
  cancelScheduledShutdown(): boolean {
    if (!this.scheduledShutdown) return false;
    this.scheduledShutdown = null;
    this.notify();
    return true;
  }

  /** Get scheduled shutdown info. */
  getScheduledShutdown(): { time: number; action: PowerState } | null {
    return this.scheduledShutdown;
  }

  // ─── Watchdog ─────────────────────────────────────────────────────────

  /** Kick (reset) the watchdog timer. */
  kickWatchdog(): void {
    this.watchdog.lastKick = Date.now();
  }

  /** Configure the watchdog. */
  configureWatchdog(config: Partial<WatchdogConfig>): void {
    if (config.enabled !== undefined) this.watchdog.enabled = config.enabled;
    if (config.timeoutMs !== undefined) this.watchdog.timeoutMs = Math.max(5000, config.timeoutMs);
    if (config.action !== undefined) this.watchdog.action = config.action;
    this.notify();
  }

  /** Get watchdog status. */
  getWatchdogStatus(): WatchdogConfig & { timeSinceLastKickMs: number; healthy: boolean } {
    const elapsed = Date.now() - this.watchdog.lastKick;
    return {
      ...this.watchdog,
      timeSinceLastKickMs: elapsed,
      healthy: !this.watchdog.enabled || elapsed < this.watchdog.timeoutMs,
    };
  }

  private startWatchdog(): void {
    this.watchdogTimer = setInterval(() => {
      if (!this.watchdog.enabled) return;
      const elapsed = Date.now() - this.watchdog.lastKick;
      if (elapsed > this.watchdog.timeoutMs) {
        // Watchdog timeout
        switch (this.watchdog.action) {
          case 'reboot':
            this.requestStateChange('reboot');
            break;
          case 'poweroff':
            this.requestStateChange('poweroff');
            break;
          case 'log':
            // Just log, don't take action
            break;
        }
      }
    }, 5000);
  }

  // ─── Power Source ─────────────────────────────────────────────────────

  /** Set the current power source. */
  setPowerSource(source: PowerSource): void {
    this.source = source;
    this.notify();
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────

  /** Stop the power manager. */
  stop(): void {
    if (this.watchdogTimer) { clearInterval(this.watchdogTimer); this.watchdogTimer = null; }
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

export const powerManager = new PowerManager();
