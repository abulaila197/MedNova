#!/bin/sh
# Builds the Code Clinic online referee: Yazan's engine and the room rules (src/games/codeclinic/online.ts) in one file,
# deployed as the 'code-clinic' edge function (verify_jwt on). The word bank is read from the repo at the commit pinned
# in its index.ts.
set -e
cd "$(dirname "$0")/.."
OUT=supabase/functions/code-clinic
npx -y esbuild@0.24.0 "$OUT/index.ts" --bundle --minify --format=esm --platform=neutral --target=es2022 --external:'npm:*' --log-level=warning --outfile="$OUT/dist/index.js"
wc -c "$OUT/dist/index.js"
