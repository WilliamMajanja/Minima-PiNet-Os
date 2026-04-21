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
    source: 'k3s',
    output: 'PiNetOS-K3s-Manifests.zip',
    targetFolder: 'k3s'
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

console.log('Generating release package artifacts...');
for (const config of packages) {
  zipFolder(config);
}
console.log('Release package artifacts generated successfully.');
