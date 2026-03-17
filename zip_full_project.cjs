const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream(path.join(__dirname, 'Minima-PiNet-Os-Full.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 }
});

output.on('close', function() {
  console.log(archive.pointer() + ' total bytes');
  console.log('Successfully created Minima-PiNet-Os-Full.zip');
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

// Zip the entire directory, excluding node_modules, .git, and existing zips
archive.glob('**/*', {
  cwd: __dirname,
  ignore: ['node_modules/**', '.git/**', '*.zip', 'dist/**', '.next/**']
});

archive.finalize();
