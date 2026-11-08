// Builds the names The Conqueror suggests as you type (CQ: 4 letters, 3 suggestions) from the question bank:
// every Category rush answer grouped by field, and every Clue ladder answer. The phone ships only these names,
// never the questions, so a suggestion never tells which name is in the current list. Re-run when the bank changes.
import { readFileSync, writeFileSync } from 'node:fs';

const bank = JSON.parse(readFileSync('src/games/conqueror/data/bank.json', 'utf8'));
const slim = (n) => (n.aliases?.length ? { label: n.label, aliases: n.aliases.slice(0, 2) } : { label: n.label });
const add = (list, seen, n) => {
  if (seen.has(n.label)) return;
  seen.add(n.label);
  list.push(slim(n));
};
const rush = {};
const rushSeen = {};
const clue = [];
const clueSeen = new Set();
for (const q of bank) {
  if (q.style === 'rush') for (const a of q.answers) add((rush[q.field] ??= []), (rushSeen[q.field] ??= new Set()), a);
  if (q.style === 'clue') add(clue, clueSeen, q.answer);
}
writeFileSync('src/games/conqueror/data/names.json', JSON.stringify({ rush, clue }) + '\n');
console.log('rush', Object.values(rush).reduce((a, l) => a + l.length, 0), 'clue', clue.length);
