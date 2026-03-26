/**
 * PiNetOS Storage Manager
 * =======================
 * Provides TypeScript interfaces for:
 *   - Listing block devices (SD card, NVMe, USB)
 *   - Mount / unmount operations
 *   - Disk usage statistics
 *   - Partition information
 *   - Filesystem health checks
 */

import * as fs   from 'fs';
import * as path from 'path';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlockDevice {
  name:       string;   // e.g. "mmcblk0", "nvme0n1", "sda"
  path:       string;   // e.g. "/dev/mmcblk0"
  size:       number;   // bytes
  type:       'disk' | 'part' | 'rom' | 'loop';
  fstype:     string;   // e.g. "ext4", "vfat", ""
  mountpoint: string;   // "" if unmounted
  label:      string;
  removable:  boolean;
  readonly:   boolean;
  children?:  BlockDevice[];
}

export interface DiskUsage {
  device:      string;
  mountpoint:  string;
  fstype:      string;
  totalBytes:  number;
  usedBytes:   number;
  freeBytes:   number;
  usePercent:  number;
}

export interface MountResult {
  success:  boolean;
  message:  string;
}

// ---------------------------------------------------------------------------
// Storage Manager
// ---------------------------------------------------------------------------
export class StorageManager {
  private useSimulation = false;

  constructor() {
    this.useSimulation = !fs.existsSync('/proc/partitions');
  }

  async init(): Promise<void> {}

  // ---- Device listing -----------------------------------------------------

  /** List all block devices using `lsblk --json` */
  async listDevices(): Promise<BlockDevice[]> {
    if (this.useSimulation) {
      return [
        {
          name: 'mmcblk0', path: '/dev/mmcblk0', size: 32 * 1024 * 1024 * 1024,
          type: 'disk', fstype: '', mountpoint: '', label: 'SD Card',
          removable: true, readonly: false,
          children: [
            {
              name: 'mmcblk0p1', path: '/dev/mmcblk0p1', size: 256 * 1024 * 1024,
              type: 'part', fstype: 'vfat', mountpoint: '/boot', label: 'BOOT',
              removable: true, readonly: false,
            },
            {
              name: 'mmcblk0p2', path: '/dev/mmcblk0p2', size: 31 * 1024 * 1024 * 1024,
              type: 'part', fstype: 'ext4', mountpoint: '/', label: 'rootfs',
              removable: true, readonly: false,
            },
          ],
        },
      ];
    }

    try {
      const raw = execSync('lsblk -J -b -o NAME,PATH,SIZE,TYPE,FSTYPE,MOUNTPOINT,LABEL,RM,RO 2>/dev/null').toString();
      const data = JSON.parse(raw) as { blockdevices: any[] };
      return data.blockdevices.map(this.mapDevice.bind(this));
    } catch {
      return this.parseFromProc();
    }
  }

  /** List mounted filesystems and their usage (similar to `df`) */
  async getDiskUsage(): Promise<DiskUsage[]> {
    if (this.useSimulation) {
      return [
        { device: '/dev/mmcblk0p1', mountpoint: '/boot', fstype: 'vfat',
          totalBytes: 256e6, usedBytes: 50e6, freeBytes: 206e6, usePercent: 20 },
        { device: '/dev/mmcblk0p2', mountpoint: '/', fstype: 'ext4',
          totalBytes: 31e9, usedBytes: 4e9, freeBytes: 27e9, usePercent: 13 },
      ];
    }

    try {
      const raw = execSync('df -B1 --output=source,target,fstype,size,used,avail 2>/dev/null').toString();
      const lines = raw.trim().split('\n').slice(1);
      return lines.map(line => {
        const [device, mountpoint, fstype, total, used, avail] = line.trim().split(/\s+/);
        const totalBytes = parseInt(total, 10);
        const usedBytes  = parseInt(used, 10);
        const freeBytes  = parseInt(avail, 10);
        return {
          device, mountpoint, fstype, totalBytes, usedBytes, freeBytes,
          usePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0,
        };
      }).filter(d => d.device.startsWith('/dev'));
    } catch {
      return [];
    }
  }

  // ---- Mount / unmount ----------------------------------------------------

  async mount(device: string, mountpoint: string, fstype?: string): Promise<MountResult> {
    if (this.useSimulation) {
      return { success: true, message: `[SIM] Mounted ${device} at ${mountpoint}` };
    }
    try {
      if (!fs.existsSync(mountpoint)) fs.mkdirSync(mountpoint, { recursive: true });
      const typeFlag = fstype ? `-t ${fstype}` : '';
      execSync(`mount ${typeFlag} ${device} ${mountpoint} 2>&1`);
      return { success: true, message: `Mounted ${device} at ${mountpoint}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  async unmount(mountpointOrDevice: string): Promise<MountResult> {
    if (this.useSimulation) {
      return { success: true, message: `[SIM] Unmounted ${mountpointOrDevice}` };
    }
    try {
      execSync(`umount ${mountpointOrDevice} 2>&1`);
      return { success: true, message: `Unmounted ${mountpointOrDevice}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ---- Filesystem health --------------------------------------------------

  /** Run fsck on an unmounted partition */
  async checkFilesystem(device: string): Promise<{ healthy: boolean; output: string }> {
    if (this.useSimulation) return { healthy: true, output: '[SIM] Filesystem OK' };
    try {
      const output = execSync(`fsck -n ${device} 2>&1 || true`).toString();
      const healthy = !output.includes('ERROR') && !output.includes('CORRUPTED');
      return { healthy, output };
    } catch (e: any) {
      return { healthy: false, output: e.message };
    }
  }

  async shutdown(): Promise<void> {}

  // ---- Private helpers ----------------------------------------------------

  private mapDevice(d: any): BlockDevice {
    return {
      name:       d.NAME  || '',
      path:       d.PATH  || `/dev/${d.NAME}`,
      size:       parseInt(d.SIZE || '0', 10),
      type:       d.TYPE  || 'disk',
      fstype:     d.FSTYPE || '',
      mountpoint: d.MOUNTPOINT || '',
      label:      d.LABEL || '',
      removable:  d.RM === '1' || d.RM === true,
      readonly:   d.RO === '1' || d.RO === true,
      children:   d.children?.map(this.mapDevice.bind(this)),
    };
  }

  private parseFromProc(): BlockDevice[] {
    try {
      const raw = fs.readFileSync('/proc/partitions', 'utf8');
      const lines = raw.trim().split('\n').slice(2);
      return lines.map(line => {
        const [,, size, name] = line.trim().split(/\s+/);
        return {
          name, path: `/dev/${name}`, size: parseInt(size, 10) * 1024,
          type: 'disk', fstype: '', mountpoint: '', label: '',
          removable: false, readonly: false,
        };
      });
    } catch { return []; }
  }
}
