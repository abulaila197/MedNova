/// <reference types="node" />
// Guards the locked header: the Pulse star and the report button are drawn in one place only.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

const SRC = join(process.cwd(), 'src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : files(p);
    return /\.(tsx?|jsx?)$/.test(n) ? [p] : [];
  });
const code = files(SRC).map((p) => ({ path: relative(process.cwd(), p).split('\\').join('/'), text: readFileSync(p, 'utf8') }));
const where = (re: RegExp) => code.filter((f) => re.test(f.text)).map((f) => f.path);

test('the Pulse star outline exists only in PulseStar.tsx', () => {
  assert.deepEqual(where(/M512 138/), ['src/components/PulseStar.tsx']);
});

test('star gradients are never tied to the text colour', () => {
  assert.deepEqual(where(/stopColor=["']currentColor|stop-color=["']currentColor/), []);
});

test('the report button lives only in Header.tsx', () => {
  assert.deepEqual(where(/setReport\(true\)/), ['src/components/Header.tsx']);
  assert.deepEqual(where(/Report a problem/), ['src/components/Header.tsx']);
});

test('the report button is the solid red "!" (decision 60)', () => {
  const h = code.find((f) => f.path === 'src/components/Header.tsx')!.text;
  assert.match(h, /style=\{\[s\.rp, \{ backgroundColor: t\.red \}\]\}/);
  assert.match(h, /<Text style=\{s\.rpT\}>!<\/Text>/);
  assert.match(h, /<PulseStar /);
});
