#!/bin/sh
# Builds the Wheels online referee: the answer keys from the bank (keys.json: insert a new row into wc_keys
# whenever the bank changes), then one bundled file to deploy as the 'wheels' edge function (verify_jwt on).
set -e
cd "$(dirname "$0")/.."
OUT=supabase/functions/wheels
TMP=$(mktemp -d)
cat > "$TMP/keys.ts" <<'TS'
import { readFileSync, writeFileSync } from 'node:fs';
import { encodeKeys } from '../src/games/wheels/keys';
const bank = JSON.parse(readFileSync('src/games/wheels/data/bank.json', 'utf8'));
writeFileSync('supabase/functions/wheels/keys.json', JSON.stringify(encodeKeys(bank)) + '\n');
TS
cp "$TMP/keys.ts" scripts/.wheels-keys.tmp.ts
npx -y esbuild@0.24.0 scripts/.wheels-keys.tmp.ts --bundle --platform=node --log-level=warning --outfile="$TMP/keys.js"
rm scripts/.wheels-keys.tmp.ts
node "$TMP/keys.js"
npx -y esbuild@0.24.0 "$OUT/index.ts" --bundle --format=esm --platform=neutral --target=es2022 --external:'npm:*' --log-level=warning --outfile="$OUT/dist/index.js"
rm -rf "$TMP"
wc -c "$OUT/keys.json" "$OUT/dist/index.js"
