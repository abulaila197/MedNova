#!/bin/sh
# Builds the Trust Me Not online referee into one minified file to deploy as the 'trust-me-not' edge function
# (verify_jwt on). The question bank it needs (ids and right choices) is read from table tmn_keys at run time.
set -e
cd "$(dirname "$0")/.."
OUT=supabase/functions/trust-me-not
npx -y esbuild@0.24.0 "$OUT/index.ts" --bundle --minify --format=esm --platform=neutral --target=es2022 --external:'npm:*' \
  --alias:@=./src --log-level=warning --outfile="$OUT/dist/index.js"
wc -c "$OUT/dist/index.js"
