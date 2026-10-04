const fs = require('fs');
const path = require('path');
const { assert } = require('./assert');

const core = path.join(__dirname, '..', 'src', 'core');
for (const name of fs.readdirSync(core)) {
  const text = fs.readFileSync(path.join(core, name), 'utf8');
  assert(!/require\('vscode'\)/.test(text), 'src/core/' + name + ' must not depend on vscode');
  assert(!/require\('\.\.\/editor\//.test(text), 'src/core/' + name + ' must not depend on src/editor');
}

console.log('PASS: core modules stay free of the editor');
