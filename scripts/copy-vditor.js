const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', 'vditor');
const target = path.join(__dirname, '..', 'out', 'vditor');

// Only the parts the visual editor loads; the rest of Vditor's renderers stay out of the VSIX.
const FILES = [
  'LICENSE',
  'dist/index.min.js',
  'dist/index.css',
  'dist/js/lute/lute.min.js',
  'dist/js/mermaid/mermaid.min.js',
  'dist/js/highlight.js/highlight.min.js',
  'dist/js/highlight.js/third-languages.js',
  'dist/js/highlight.js/LICENSE',
  'dist/js/highlight.js/styles/github.min.css',
  'dist/js/highlight.js/styles/github-dark.min.css',
  'dist/js/i18n/en_US.js',
  'dist/js/icons/ant.js',
  'dist/css/content-theme/light.css',
  'dist/css/content-theme/dark.css'
];

fs.rmSync(target, { recursive: true, force: true });
for (const file of FILES) {
  const to = path.join(target, file);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(source, file), to);
}
console.log('Copied ' + FILES.length + ' Vditor files to out/vditor');
