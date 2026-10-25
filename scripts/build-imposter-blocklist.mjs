// Builds Imposter's clue blocklist from the open-source `badwords-list` package (MIT, dev-time only;
// Yazan's pick 2026-10-25). Clues are one word of letters, so only entries that are plain letters are kept
// (stripping symbols from "ar5e" or "s.o.b" would block everyday words such as "are").
// The medical allowlist (src/games/imposter/engine/medicalAllowlist.ts) still wins over this list.
// Run: node scripts/build-imposter-blocklist.mjs
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { array } = createRequire(import.meta.url)('badwords-list');

const words = [...new Set(array.map((w) => w.toLowerCase()).filter((w) => /^[a-z]{2,}$/.test(w)))].sort();
writeFileSync(join(root, 'src/games/imposter/data/blocklist.json'), JSON.stringify(words));
console.log(`${words.length} words`);
