#!/bin/sh
# Builds The Conqueror online referee into one bundled file to deploy as the 'conqueror' edge function (verify_jwt
# on). The function copies the question bank from the repository at the last commit that changed it, so push that
# commit before deploying.
set -e
cd "$(dirname "$0")/.."
OUT=supabase/functions/conqueror
V=$(git log -1 --format=%H -- src/games/conqueror/data/bank.json)
npx -y esbuild@0.24.0 "$OUT/index.ts" --bundle --format=esm --platform=neutral --target=es2022 --external:'npm:*' \
  --define:CQ_BANK="\"$V\"" --log-level=warning --outfile="$OUT/dist/index.js"
echo "bank $V"
wc -c "$OUT/dist/index.js"
