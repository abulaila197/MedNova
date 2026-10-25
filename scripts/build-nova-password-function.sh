#!/bin/sh
# Builds the Nova Password online referee: Yazan's engine, the room rules (src/games/password/online.ts) and the term
# bank in one file, deployed as the 'nova-password' edge function (verify_jwt on). Rebuild and redeploy when the bank changes.
set -e
cd "$(dirname "$0")/.."
OUT=supabase/functions/nova-password
npx -y esbuild@0.24.0 "$OUT/index.ts" --bundle --minify-syntax --minify-identifiers --format=esm --platform=neutral --target=es2022 --external:'npm:*' --log-level=warning --outfile="$OUT/dist/index.js"
wc -c "$OUT/dist/index.js"
