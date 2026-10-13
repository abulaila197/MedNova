// Builds src/features/info/licences.json: every package the app ships (dependencies, followed
// down the tree) with its licence and copyright line, plus one full text per licence.
// Run after adding or updating packages: node scripts/build-licences.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const seen = new Map();
const texts = {};

function findPkg(name, from) {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const p = path.join(dir, 'node_modules', name, 'package.json');
    if (fs.existsSync(p)) return p;
    if (path.dirname(dir) === dir) return null;
  }
}
function licenceOf(j) {
  if (typeof j.license === 'string') return j.license;
  if (j.license?.type) return j.license.type;
  if (Array.isArray(j.licenses)) return j.licenses.map((x) => x.type).join(' OR ');
  return 'See package';
}
function readLicenceFile(dir) {
  const f = fs.readdirSync(dir).find((x) => /^(licen[cs]e|copying)(\.|$)/i.test(x));
  return f ? fs.readFileSync(path.join(dir, f), 'utf8') : '';
}
function walk(name, from) {
  const p = findPkg(name, from);
  if (!p) return;
  const dir = fs.realpathSync(path.dirname(p));
  if (seen.has(dir)) return;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const lic = licenceOf(j);
  const file = readLicenceFile(dir);
  const copy = (file.match(/^.*copyright\s*(\(c\)|©)?\s*\d{4}.*$/im)?.[0] ?? '').trim().slice(0, 160);
  const author = typeof j.author === 'string' ? j.author : j.author?.name;
  const font = path.join(dir, 'LICENSE_FONT');
  const ofl = fs.existsSync(font) ? fs.readFileSync(font, 'utf8') : '';
  // Google Fonts packages: the code is MIT, the font itself is OFL with its own copyright line.
  const fontCopy = ofl ? ofl.split('\n')[0].trim() : '';
  if (ofl && !texts['OFL-1.1']) texts['OFL-1.1'] = ofl.slice(ofl.indexOf('This Font Software')).trim();
  seen.set(dir, { n: j.name, v: j.version, l: lic, c: copy || (author ? `Copyright ${author.replace(/\s*[<(].*$/, '')}` : ''), ...(fontCopy ? { f: fontCopy } : {}) });
  // Keep one full text per licence, from the first package that ships it.
  if (file && !texts[lic]) texts[lic] = file.trim();
  for (const d of Object.keys(j.dependencies ?? {})) walk(d, dir);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const d of Object.keys(pkg.dependencies)) walk(d, root);
const list = [...seen.values()].sort((a, b) => a.n.localeCompare(b.n));
fs.writeFileSync(path.join(root, 'src/features/info/licences.json'), JSON.stringify({ packages: list, texts }));
console.log(`${list.length} packages, ${Object.keys(texts).length} licence texts`);
