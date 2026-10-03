/// <reference types="node" />
// Guards the locked header: the Pulse star, the report button and the token coin are drawn in one place only,
// and game pages always use the game header (GH1-GH3) while other pages keep the app header.
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

const header = () => code.find((f) => f.path === 'src/components/Header.tsx')!.text;

test('the report button is the solid red "!" (decision 60) in both header versions', () => {
  const h = header();
  assert.match(h, /style=\{\[z\.rp, \{ backgroundColor: t\.red \}\]\}/);
  assert.match(h, /<Text style=\{z\.rpT\}>!<\/Text>/);
  assert.match(h, /<PulseStar /);
});

test('the game header (GH1-GH3): smaller parts, token coin last on the right, no bigger than the report button', () => {
  const h = header();
  assert.match(h, /variant = 'app'/);
  assert.match(h, /const z = g \? gs : s;/);
  // the coin comes after Sign in, i.e. it is the right-most item
  assert.ok(h.indexOf('{g ? <Coin') > h.indexOf('>Sign in<'), 'coin must be the last item on the right');
  const rp = h.match(/rp: \{ \.\.\.s\.rp, width: u\((\d+(?:\.\d+)?)\)/);
  const coin = h.match(/<TokenCoin size=\{u\((\d+(?:\.\d+)?)\)\}/);
  assert.ok(rp && coin, 'game report button and coin sizes must be readable');
  assert.ok(Number(coin![1]) <= Number(rp![1]), 'coin + EXP ring must not exceed the report button');
});

test('the token coin is drawn only in PulseStar.tsx, from the Pulse star outline', () => {
  assert.deepEqual(where(/export function TokenCoin/), ['src/components/PulseStar.tsx']);
  assert.deepEqual(where(/<TokenCoin /), ['src/components/Header.tsx']);
  const ps = code.find((f) => f.path === 'src/components/PulseStar.tsx')!.text;
  assert.match(ps, /starAt\(12, 12, 5\.6\)/);
});

test('every game page uses the game header; the rest of the app keeps the app header', () => {
  assert.deepEqual(where(/<Header /), ['src/components/Screen.tsx']);
  const scr = code.find((f) => f.path === 'src/components/Screen.tsx')!.text;
  assert.match(scr, /<Header variant=\{game \? 'game' : 'app'\} \/>/);
  const ui = code.find((f) => f.path === 'src/games/shell/ui.tsx')!.text;
  assert.match(ui, /<Screen [^>]*\bgame\b/);
  // game screens never build their own page: they go through GameScreen
  const gamePages = code.filter((f) => f.path.startsWith('src/games/') || f.path.startsWith('src/app/(app)/play/'));
  assert.deepEqual(gamePages.filter((f) => /<Screen\b/.test(f.text)).map((f) => f.path), ['src/games/shell/ui.tsx']);
});
