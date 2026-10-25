#!/bin/sh
# Builds the Imposter online referee: Yazan's engine, the word bank and the bad-word list in one bundled file,
# to deploy as the 'imposter' edge function (verify_jwt on). Rebuild and redeploy whenever the bank changes.
set -e
cd "$(dirname "$0")/.."
OUT=supabase/functions/imposter
npx -y esbuild@0.24.0 "$OUT/index.ts" --bundle --format=esm --platform=neutral --target=es2022 --external:'npm:*' --log-level=warning --outfile="$OUT/dist/index.js"
wc -c "$OUT/dist/index.js"
