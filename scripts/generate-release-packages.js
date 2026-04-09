import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

const rootDir = path.resolve(import.meta.dirname, '..');

const packages = [
  {
    source: 'PiNetOS',
    output: 'PiNetOS-Enterprise.zip',
    targetFolder: 'PiNetOS'
  },
  {
    source: 'build-system',
    output: 'PiNetOS-Build-System.zip',
    targetFolder: 'build-system'
  },
  {
    source: 'build-system/docs',
    output: 'PiNetOS-Documentation.zip',
    targetFolder: 'docs'
  },
  {
    source: 'k8s',
    output: 'PiNetOS-K3s-Manifests.zip',
    targetFolder: 'k8s'
  }
];

const ensureExists = (relativePath) => {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required path: ${relativePath}`);
  }
  return absolutePath;
};

const zipFolder = ({ source, output, targetFolder }) => {
  const sourcePath = ensureExists(source);
  const outputPath = path.join(rootDir, output);

  const zip = new AdmZip();
  zip.addLocalFolder(sourcePath, targetFolder);
  zip.writeZip(outputPath);

  const sizeMb = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
  console.log(`Created ${output} (${sizeMb} MB)`);
};

const packageElectronDesktop = () => {
  const output = 'PiNetOS-Electron-Desktop.zip';
  const outputPath = path.join(rootDir, output);

  const excludedRootEntries = new Set([
    '.git',
    'node_modules',
    'dist',
    'dist-electron',
    'dist-electron-build'
  ]);

  const zip = new AdmZip();
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (excludedRootEntries.has(entry.name) || entry.name.endsWith('.zip')) {
      continue;
    }

    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      zip.addLocalFolder(entryPath, entry.name);
    } else {
      zip.addLocalFile(entryPath);
    }
  }

  zip.writeZip(outputPath);
  const sizeMb = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
  console.log(`Created ${output} (${sizeMb} MB)`);
};

console.log('Generating release package artifacts...');
for (const config of packages) {
  zipFolder(config);
}
packageElectronDesktop();
console.log('Release package artifacts generated successfully.');
