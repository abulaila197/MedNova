// Builds Trust Me Not's question files from the writers' banks (750 basic + 750 clinical):
//   src/games/trustmenot/data/questions.json  what phones show (text, choices, Learn topic and dossier)
//   supabase/functions/trust-me-not/bank.json what the referee needs (id, right choice, season, field)
// Usage: node scripts/build-tmn-questions.mjs <basic.json> <clinical.json>
import { readFileSync, writeFileSync } from 'node:fs';

const [basic, clinical] = process.argv.slice(2);
if (!basic || !clinical) throw new Error('usage: build-tmn-questions.mjs <basic.json> <clinical.json>');
const all = [basic, clinical].flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
const seen = new Set();
for (const x of all) {
  if (seen.has(x.id)) throw new Error(`duplicate id ${x.id}`);
  seen.add(x.id);
  if (x.choices.length !== 3 || ![0, 1, 2].includes(x.answer) || ![1, 2, 3, 4].includes(x.difficulty)) throw new Error(`bad item ${x.id}`);
}
const phone = Object.fromEntries(all.map((x) => [x.id, { q: x.q, c: x.choices, t: x.topic, ...(x.dossier ? { d: x.dossier } : {}) }]));
writeFileSync('src/games/trustmenot/data/questions.json', JSON.stringify(phone));
const server = all.map((x) => [x.id, x.answer, x.difficulty, x.field === 'basic' ? 0 : 1]);
writeFileSync('supabase/functions/trust-me-not/bank.json', JSON.stringify(server));
console.log(`${all.length} questions`);
