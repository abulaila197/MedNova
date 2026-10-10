#!/bin/sh
# Builds The Conqueror online referee into one bundled file to deploy as the 'conqueror' edge function (verify_jwt
# on). The function reads the question bank from table cq_bank, row v = first 12 hex of bank.json's sha256 (a
# content hash, like tmn_keys, so it survives history rewrites), so load that row before deploying.
set -e
cd "$(dirname "$0")/.."
OUT=supabase/functions/conqueror
V=$(node -e "process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync('src/games/conqueror/data/bank.json')).digest('hex').slice(0, 12))")
npx -y esbuild@0.24.0 "$OUT/index.ts" --bundle --format=esm --platform=neutral --target=es2022 --external:'npm:*' \
  --define:CQ_BANK="\"$V\"" --log-level=warning --outfile="$OUT/dist/index.js"
echo "bank $V"
wc -c "$OUT/dist/index.js"
