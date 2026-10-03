// Builds Nova Medicordle's accepted-guess list (decision NM24): the open-source `word-list`
// package (MIT, dev-time only) + data/medical-terms.txt + every answer, kept to 6-15 letters.
// Output: one sorted, fixed-width string per length, so the app checks a guess by binary search
// with no start-up cost. Run: node scripts/build-medicordle-guesses.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import wordsTxt from 'word-list';

const root = join(dirname(new URL(import.meta.url).pathname), '..');
const data = join(root, 'src/games/medicordle/data');

const english = readFileSync(wordsTxt, 'utf8').split('\n');
const medical = readFileSync(join(data, 'medical-terms.txt'), 'utf8').split('\n').filter((l) => !l.startsWith('#'));
const answers = JSON.parse(readFileSync(join(data, 'words.json'), 'utf8')).map((w) => w.word);

const byLen = {};
for (const raw of [...english, ...medical, ...answers]) {
  const w = raw.trim().toUpperCase();
  if (!/^[A-Z]{6,15}$/.test(w)) continue;
  (byLen[w.length] ??= new Set()).add(w);
}
const out = {};
let total = 0;
for (const len of Object.keys(byLen).sort((a, b) => a - b)) {
  const list = [...byLen[len]].sort();
  total += list.length;
  out[len] = list.join('');
}
writeFileSync(join(data, 'guesses.json'), JSON.stringify(out));
console.log(`guesses.json: ${total} words`);
