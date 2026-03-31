/**
 * PiNetOS Release Image Packager
 *
 * Creates a distributable zip package containing:
 *   - PiNetOS-RaspberryPi.img   (the flashable disk image)
 *   - README.md                 (flashing & first-boot instructions)
 *   - SHA256SUMS.txt            (cryptographic checksum for verification)
 *   - RELEASE_NOTES.md          (release notes from the repo root)
 *
 * Usage:
 *   node scripts/package-img-release.js [version]
 *
 * If version is omitted it is read from package.json.
 */

import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, existsSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));
const version = process.argv[2] || pkg.version;
const imgName = 'PiNetOS-RaspberryPi.img';
const imgPath = path.join(PROJECT_ROOT, imgName);
const outName = `PiNetOS-RaspberryPi-Package-v${version}.zip`;
const outPath = path.join(PROJECT_ROOT, outName);

// ---------------------------------------------------------------------------
// Validate that the .img file exists
// ---------------------------------------------------------------------------

if (!existsSync(imgPath)) {
  console.error(`ERROR: ${imgName} not found at ${imgPath}`);
  console.error('Run scripts/create-release-img.sh first to generate the image.');
  process.exit(1);
}

const imgStat = statSync(imgPath);
console.log(`Packaging ${imgName} (${(imgStat.size / (1024 * 1024)).toFixed(1)} MB) into ${outName}`);

// ---------------------------------------------------------------------------
// Compute SHA-256 checksum using streaming to handle large images
// ---------------------------------------------------------------------------

const hash = createHash('sha256');
await pipeline(createReadStream(imgPath), hash);
const sha256 = hash.digest('hex');
const checksumContent = `${sha256}  ${imgName}\n`;
console.log(`SHA-256: ${sha256}`);

// ---------------------------------------------------------------------------
// Build README for the package
// ---------------------------------------------------------------------------

const readmeContent = `# PiNetOS Raspberry Pi Image — v${version}

This package contains the official PiNetOS flashable disk image for Raspberry Pi.

## Contents

| File | Description |
| :--- | :--- |
| \`${imgName}\` | Flashable Raspberry Pi disk image |
| \`SHA256SUMS.txt\` | SHA-256 checksum for image verification |
| \`RELEASE_NOTES.md\` | Full release notes for v${version} |
| \`README.md\` | This file |

## Verify Image Integrity

Before flashing, verify the checksum:

\`\`\`bash
sha256sum --check SHA256SUMS.txt
\`\`\`

## Flashing Instructions

### Using Raspberry Pi Imager (Recommended)

1. Download and install [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
2. Open Raspberry Pi Imager.
3. Click **CHOOSE OS** → scroll down → **Use custom**.
4. Select the \`${imgName}\` file from this package.
5. Click **CHOOSE STORAGE** and select your MicroSD card (16 GB minimum).
6. Click **WRITE** and wait for the process to complete.
7. Insert the SD card into your Raspberry Pi and power it on.

### Using BalenaEtcher

1. Download and install [BalenaEtcher](https://balena.io/etcher/).
2. Click **Flash from file** → select \`${imgName}\`.
3. Click **Select target** → choose your MicroSD card.
4. Click **Flash!** and wait for completion.

### Using dd (Linux / macOS)

\`\`\`bash
# Identify your SD card device (e.g. /dev/sdX or /dev/disk#)
lsblk

# Unmount any mounted partitions
sudo umount /dev/sdX*

# Flash the image (DOUBLE-CHECK the target device!)
sudo dd if=${imgName} of=/dev/sdX bs=4M status=progress conv=fsync
\`\`\`

## First Boot

On the first boot, PiNetOS will:
1. Display the custom Plymouth boot splash.
2. Perform first-boot provisioning (~2 minutes).
3. Start the PiNetOS desktop environment.
4. Start the Minima blockchain node in the background.

**Access the web interface:** \`http://<pi-ip>:3000\`
**Default credentials:** \`pinet\` / \`pinet\` — change immediately.

## Hardware Requirements

| Component | Minimum | Recommended |
| :--- | :--- | :--- |
| Platform | Raspberry Pi 4 (4 GB) | **Raspberry Pi 5 (8 GB)** |
| AI Accelerator | ARM NEON (CPU) | **Hailo-8L NPU (13 TOPS)** |
| Storage | 16 GB MicroSD | 128 GB NVMe SSD (PCIe Gen 3) |
| Network | Gigabit Ethernet | Gigabit Ethernet + WireGuard mesh |

## Building a Full Image From Source

To build a full-size (4 GB) production image with a complete root filesystem:

1. Download \`PiNetOS-Build-System.zip\` from the release.
2. Extract and run:
   \`\`\`bash
   sudo apt-get install debootstrap qemu-user-static parted dosfstools
   sudo ./build-all.sh
   \`\`\`

## Support

- Repository: https://github.com/WilliamMajanja/Minima-PiNet-Os
- Issues: https://github.com/WilliamMajanja/Minima-PiNet-Os/issues
- Security: See SECURITY.md in the repository

*PiNetOS is MIT licensed. Architected by William Majanja.*
`;

// ---------------------------------------------------------------------------
// Create the zip package
// ---------------------------------------------------------------------------

const zip = new AdmZip();
const prefix = `PiNetOS-RaspberryPi-v${version}/`;

zip.addLocalFile(imgPath, prefix);
zip.addFile(`${prefix}SHA256SUMS.txt`, Buffer.from(checksumContent, 'utf-8'));
zip.addFile(`${prefix}README.md`, Buffer.from(readmeContent, 'utf-8'));

// Include release notes if available
const releaseNotesPath = path.join(PROJECT_ROOT, 'RELEASE_NOTES.md');
if (existsSync(releaseNotesPath)) {
  zip.addFile(`${prefix}RELEASE_NOTES.md`, readFileSync(releaseNotesPath));
}

zip.writeZip(outPath);

const outStat = statSync(outPath);
console.log(`\nPackage created: ${outName} (${(outStat.size / (1024 * 1024)).toFixed(1)} MB)`);
