#!/bin/sh
# Compiles the pure engine modules to a temp folder and runs them with Node's built-in test runner.
set -e
OUT=$(mktemp -d)
npx tsc --outDir "$OUT" --module commonjs --moduleResolution node10 --ignoreDeprecations 6.0 --target es2022 --strict \
  --skipLibCheck --esModuleInterop --types node --ignoreConfig \
  $(find src -path "*/__tests__/*.test.ts")
node --test $(find "$OUT" -name "*.test.js")
rm -rf "$OUT"
# UI-thread code must only call worklets (a plain call crashes the phone, not the web preview).
node scripts/check-worklets.mjs
