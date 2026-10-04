#!/bin/sh
# Compiles the pure engine modules to a temp folder and runs them with Node's built-in test runner.
set -e
OUT=$(mktemp -d)
npx tsc --outDir "$OUT" --module commonjs --moduleResolution node10 --ignoreDeprecations 6.0 --target es2022 --strict \
  --skipLibCheck --esModuleInterop --types node --ignoreConfig \
  src/games/engine/__tests__/*.test.ts src/games/diagnostic/__tests__/*.test.ts src/games/medicordle/__tests__/*.test.ts src/games/streak/__tests__/*.test.ts src/games/riddler/__tests__/*.test.ts src/components/__tests__/*.test.ts
node --test $(find "$OUT" -name "*.test.js")
rm -rf "$OUT"
