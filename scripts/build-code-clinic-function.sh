#!/bin/sh
# Builds the Code Clinic online referee: Yazan's engine, the room rules (src/games/codeclinic/online.ts) and the word
# bank in one file, deployed as the 'code-clinic' edge function (verify_jwt on). Rebuild and redeploy when the bank changes.
set -e
cd "$(dirname "$0")/.."
OUT=supabase/functions/code-clinic
npx -y esbuild@0.24.0 "$OUT/index.ts" --bundle --minify-syntax --minify-identifiers --format=esm --platform=neutral --target=es2022 --external:'npm:*' --log-level=warning --outfile="$OUT/dist/index.js"
wc -c "$OUT/dist/index.js"
