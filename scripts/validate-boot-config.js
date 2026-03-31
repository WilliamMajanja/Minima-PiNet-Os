import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const bootDir = path.join(projectRoot, 'boot');

const requiredFiles = ['config.txt', 'cmdline.txt', 'uboot/uboot.env'];

const readRequired = (relativePath) => {
  const absolutePath = path.join(bootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required boot file: boot/${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
};

const assertContains = (content, needle, message) => {
  if (!content.includes(needle)) {
    throw new Error(message);
  }
};

const assertRegex = (content, regex, message) => {
  if (!regex.test(content)) {
    throw new Error(message);
  }
};

console.log('Validating Raspberry Pi boot configuration...');

for (const file of requiredFiles) {
  readRequired(file);
}

const configTxt = readRequired('config.txt');
const cmdlineTxt = readRequired('cmdline.txt').trim();
const ubootEnv = readRequired('uboot/uboot.env');

assertRegex(configTxt, /^\s*arm_64bit=1\s*$/m, 'boot/config.txt must set arm_64bit=1');
assertRegex(configTxt, /^\s*kernel=kernel8\.img\s*$/m, 'boot/config.txt must set kernel=kernel8.img');
assertRegex(configTxt, /^\s*enable_uart=1\s*$/m, 'boot/config.txt must enable UART for serial recovery');

assertContains(cmdlineTxt, 'root=', 'boot/cmdline.txt must include root= kernel argument');
assertContains(cmdlineTxt, 'rootwait', 'boot/cmdline.txt must include rootwait');
assertContains(cmdlineTxt, 'console=ttyAMA0,115200', 'boot/cmdline.txt must include serial console');
assertContains(cmdlineTxt, 'systemd.unified_cgroup_hierarchy=1', 'boot/cmdline.txt must include cgroup v2 setting');

assertRegex(ubootEnv, /^\s*arch=arm64\s*$/m, 'boot/uboot/uboot.env must set arch=arm64');
assertRegex(ubootEnv, /^\s*kernel_name=kernel8\.img\s*$/m, 'boot/uboot/uboot.env must set kernel_name=kernel8.img');
assertContains(ubootEnv, 'boot_targets=mmc0 usb0 pxe', 'boot/uboot/uboot.env must include SD/USB/PXE boot fallback order');
assertContains(ubootEnv, 'run mmc_boot || run usb_boot || run pxe_boot', 'boot/uboot/uboot.env must define fallback bootcmd');

console.log('Boot configuration validation passed.');
