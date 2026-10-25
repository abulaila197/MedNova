#!/bin/sh
# Builds the Imposter online referee: the word bank packed small (bank.json), then Yazan's engine, the bank and the
# bad-word list in one file, deployed with bank.json beside it as the 'imposter' edge function (verify_jwt on).
# Rebuild and redeploy whenever the bank changes.
set -e
cd "$(dirname "$0")/.."
OUT=supabase/functions/imposter
TMP=$(mktemp -d)
cat > scripts/.imposter-bank.tmp.ts <<'TS'
import { readFileSync, writeFileSync } from 'node:fs';
import { packBank } from '../src/games/imposter/bankCodec';
const bank = JSON.parse(readFileSync('src/games/imposter/data/pairs.json', 'utf8'));
const b = packBank(bank);
// One pair per line, so the file stays readable and diffs stay small.
writeFileSync('supabase/functions/imposter/bank.json', `{"c":${JSON.stringify(b.c)},"p":[\n${b.p.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`);
TS
npx -y esbuild@0.24.0 scripts/.imposter-bank.tmp.ts --bundle --platform=node --log-level=warning --outfile="$TMP/bank.js"
rm scripts/.imposter-bank.tmp.ts
node "$TMP/bank.js"
npx -y esbuild@0.24.0 "$OUT/index.ts" --bundle --minify-syntax --minify-identifiers --format=esm --platform=neutral --target=es2022 --external:'npm:*' --external:./bank.json --log-level=warning --outfile="$OUT/dist/index.js"
# Deno reads a JSON module only with its type attribute, which esbuild drops from an external import.
sed -i 's#^import \([A-Za-z_$]*\) from "./bank.json";#import \1 from "./bank.json" with { type: "json" };#' "$OUT/dist/index.js"
rm -rf "$TMP"
wc -c "$OUT/bank.json" "$OUT/dist/index.js"
