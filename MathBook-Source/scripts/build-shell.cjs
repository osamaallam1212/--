#!/usr/bin/env node
/*
 * يبني واجهة التطبيق (web/src) في ملف HTML واحد بدون أي اتصال بالإنترنت:
 *   dist/index.html        ← نسخة ويندوز (Electron)
 *   native/shellHtml.js    ← نسخة أندرويد (داخل التطبيق)
 * بيشتغل لوحده أثناء build-windows.bat و build-android.bat.
 * المكتبات (pdf.js و JSZip) والخطوط داخل web/lib و web/fonts وتتدمج جوه الملف.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'web', 'src');
const LIB = path.join(ROOT, 'web', 'lib');
const FONTS = path.join(ROOT, 'web', 'fonts');

const read = (p) => fs.readFileSync(p, 'utf8');
function writeIfChanged(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  try {
    const old = fs.readFileSync(p);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    if (old.equals(buf)) return false;
  } catch (e) { /* جديد */ }
  fs.writeFileSync(p, data);
  return true;
}
// يمنع إغلاق وسم script بالغلط داخل الملفات المدمجة
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

function build(opts) {
  opts = opts || {};
  const log = opts.quiet ? () => {} : (...a) => console.log('[mathbook]', ...a);
  const pkg = JSON.parse(read(path.join(ROOT, 'package.json')));

  const css = fs.readdirSync(path.join(SRC, 'css')).filter((f) => f.endsWith('.css')).sort()
    .map((f) => read(path.join(SRC, 'css', f))).join('\n');
  const jsFiles = fs.readdirSync(path.join(SRC, 'js')).filter((f) => f.endsWith('.js')).sort();
  const js = jsFiles.map((f) => '/* ---- ' + f + ' ---- */\n' + read(path.join(SRC, 'js', f))).join('\n;\n');
  if (js.indexOf('</script') >= 0) throw new Error('JS contains </script');

  const fontDefs = [['arabic', 'U+0600-06FF,U+0750-077F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF,U+200C-200F'], ['latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212']];
  let fonts = '';
  [400, 700, 900].forEach((w) => fontDefs.forEach(([name, range]) => {
    const p = path.join(FONTS, 'cairo-' + name + '-' + w + '-normal.woff2');
    if (!fs.existsSync(p)) return;
    fonts += '@font-face{font-family:"Cairo";font-style:normal;font-display:swap;font-weight:' + w +
      ';src:url(data:font/woff2;base64,' + fs.readFileSync(p).toString('base64') + ') format("woff2");unicode-range:' + range + '}\n';
  }));

  const libs = ['jszip.min.js', 'pdf.min.js'].map((f) => safe(read(path.join(LIB, f)))).join('\n;\n');
  const worker = safe(read(path.join(LIB, 'pdf.worker.min.js')));

  let html = read(path.join(SRC, 'index.html'));
  const rep = { FONTS: fonts, CSS: css, LIBS: libs, WORKER: worker, JS: js, VERSION: pkg.version };
  html = html.replace(/\/\*@@([A-Z]+)@@\*\//g, (m, k) => (k in rep ? rep[k] : m));

  // 1) ويندوز
  const dist = path.join(ROOT, 'dist');
  writeIfChanged(path.join(dist, 'index.html'), html);
  const iconPng = path.join(ROOT, 'assets', 'images', 'icon.png');
  if (fs.existsSync(iconPng)) writeIfChanged(path.join(dist, 'icon.png'), fs.readFileSync(iconPng));

  // 2) أندرويد
  writeIfChanged(path.join(ROOT, 'native', 'shellHtml.js'),
    '// ملف مولّد تلقائياً من web/src بواسطة scripts/build-shell.cjs — لا تعدّله يدوياً\nmodule.exports = ' + JSON.stringify(html) + ';\n');

  log('shell built:', (html.length / 1024).toFixed(0) + ' KB,', jsFiles.length, 'scripts');
  return { size: html.length };
}

module.exports = { build };
if (require.main === module) build();
