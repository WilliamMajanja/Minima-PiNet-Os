import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
const version = process.argv[2] || pkg.version;
const outputName = 'RMPE-2-PROVENANCE.json';
const outputPath = path.join(projectRoot, outputName);

const explicitArtifacts = process.argv.slice(3);
const releaseArtifactPattern = /^(Minima-PiNet-Os-v.+\.(zip|tar\.gz)|PiNetOS-RaspberryPi\.img|PiNetOS-RaspberryPi-Package-v.+\.zip|PiNetOS-(Enterprise|Build-System|Documentation|K3s-Manifests)\.zip|SHA256SUMS\.txt)$/;

const hashFile = (absolutePath) => {
  const hash = createHash('sha256');
  hash.update(readFileSync(absolutePath));
  return `sha256:${hash.digest('hex')}`;
};

const gitValue = (command) => {
  try {
    return execFileSync('git', command, { cwd: projectRoot, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

const canonicalJson = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const collectArtifacts = () => {
  if (explicitArtifacts.length > 0) {
    return explicitArtifacts;
  }
  return readdirSync(projectRoot).filter((entry) => releaseArtifactPattern.test(entry));
};

const artifacts = collectArtifacts()
  .filter((artifact) => artifact !== outputName && existsSync(path.join(projectRoot, artifact)))
  .sort()
  .map((artifact) => {
    const absolutePath = path.join(projectRoot, artifact);
    const stat = statSync(absolutePath);
    if (!stat.isFile()) {
      throw new Error(`Release artifact is not a file: ${artifact}`);
    }
    return {
      name: artifact,
      sizeBytes: stat.size,
      digest: hashFile(absolutePath),
    };
  });

if (artifacts.length === 0) {
  throw new Error('No release artifacts found for RMPE-2 provenance generation.');
}

const manifest = {
  schemaVersion: 'RMPE-2',
  type: 'pinet-release-provenance',
  subject: 'Minima-PiNet-Os',
  version,
  generatedAt: new Date().toISOString(),
  builder: {
    id: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : 'local',
    workflow: process.env.GITHUB_WORKFLOW || null,
    runner: process.env.RUNNER_OS || process.platform,
  },
  source: {
    repository: process.env.GITHUB_REPOSITORY
      ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY}`
      : 'local',
    ref: process.env.GITHUB_REF_NAME || null,
    commit: process.env.GITHUB_SHA || gitValue(['rev-parse', 'HEAD']),
    dirty: gitValue(['status', '--porcelain', '--untracked-files=no']) ? true : false,
  },
  materials: [
    { uri: 'pkg:npm/pinet-web3-os', version: pkg.version },
    { uri: 'file:package-lock.json', digest: existsSync(path.join(projectRoot, 'package-lock.json')) ? hashFile(path.join(projectRoot, 'package-lock.json')) : null },
  ],
  artifacts,
};

const unsigned = canonicalJson(manifest);
const envelopeDigest = createHash('sha256').update(unsigned).digest('hex');
const envelope = {
  ...manifest,
  provenanceId: `rmpe2:${envelopeDigest.slice(0, 16)}`,
  rmpeHash: `sha256:${envelopeDigest}`,
};

writeFileSync(outputPath, `${JSON.stringify(envelope, null, 2)}\n`);
writeFileSync(`${outputPath}.sha256`, `${envelopeDigest}  ${outputName}\n`);

console.log(`Generated ${outputName} with ${artifacts.length} artifact(s).`);
console.log(`RMPE-2 hash: sha256:${envelopeDigest}`);
