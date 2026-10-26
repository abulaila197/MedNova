#!/bin/sh
# Builds the Imposter online referee: Yazan's engine and the bad-word list in one file, deployed as the 'imposter'
# edge function (verify_jwt on). The word bank is read from the repo at the commit pinned in its index.ts.
set -e
cd "$(dirname "$0")/.."
OUT=supabase/functions/imposter
npx -y esbuild@0.24.0 "$OUT/index.ts" --bundle --minify-syntax --minify-identifiers --format=esm --platform=neutral --target=es2022 --external:'npm:*' --log-level=warning --outfile="$OUT/dist/index.js"
wc -c "$OUT/dist/index.js"
