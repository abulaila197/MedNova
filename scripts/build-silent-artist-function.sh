#!/bin/sh
# Builds the Silent Artist online guess check: one bundled file (the matcher; words come from sa_words) to deploy as the
# 'silent-artist' edge function (verify_jwt on). Re-run and redeploy whenever guess.ts changes (and update sa_words when words.json changes).
set -e
cd "$(dirname "$0")/.."
OUT=supabase/functions/silent-artist
npx -y esbuild@0.24.0 "$OUT/index.ts" --bundle --format=esm --platform=neutral --target=es2022 --external:'npm:*' --log-level=warning --outfile="$OUT/dist/index.js"
wc -c "$OUT/dist/index.js"
