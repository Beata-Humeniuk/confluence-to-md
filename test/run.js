const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const files = fs.readdirSync(__dirname).filter((name) => /-test\.js$/.test(name)).sort();
let failed = 0;
for (const name of files) {
  const run = spawnSync(process.execPath, [path.join(__dirname, name)], { stdio: 'inherit' });
  if (run.status !== 0) {
    failed += 1;
    console.error('FAIL: ' + name + ' exited with ' + run.status);
  }
}
console.log(failed ? failed + ' of ' + files.length + ' test files failed' : 'PASS: ' + files.length + ' test files');
process.exit(failed ? 1 : 0);
