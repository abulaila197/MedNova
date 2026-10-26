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
  assert.ok(h.indexOf('<Coin g={g}') > h.indexOf('>Sign in<'), 'coin must be the last item on the right');
  const rp = h.match(/rp: \{ \.\.\.s\.rp, width: [uh]\((\d+(?:\.\d+)?)\)/);
  const coin = h.match(/<TokenCoin size=\{[uh]\(g \? (\d+(?:\.\d+)?) :/); // the game header's size
  assert.ok(rp && coin, 'game report button and coin sizes must be readable');
  assert.ok(Number(coin![1]) <= Number(rp![1]), 'coin + EXP ring must not exceed the report button');
});

test('signed in, the header shows look A (photo, level ring, Sparks) in place of the logo; guests keep the logo', () => {
  const h = header();
  assert.match(h, /\{signedIn \? \(\s*<Me g=\{g\} \/>\s*\) : \(\s*<View style=\{z\.lk\}>\s*<PulseStar /);
  assert.match(h, /router\.navigate\('\/profile'\)/); // the photo opens the Profile
  assert.match(h, /onPress=\{tapped\(openSparks\)\}/); // the Sparks open Recharge
  assert.match(h, /<TokenCoin size=\{h\(g \? 17 : 20\)\} progress=\{0\}/); // the coin lost its level ring
});

test('the token coin is drawn only in PulseStar.tsx, from the Pulse star outline', () => {
  assert.deepEqual(where(/export function TokenCoin/), ['src/components/PulseStar.tsx']);
  assert.deepEqual(where(/<TokenCoin /), ['src/components/Congrats.tsx', 'src/components/Header.tsx', 'src/features/daily/DailyPopup.tsx', 'src/features/level/LevelCounter.tsx', 'src/features/level/LevelUpHost.tsx', 'src/features/rounds/RoundsPage.tsx', 'src/features/store/StorePage.tsx', 'src/features/style/StylePage.tsx']); // the daily pop-up (DL1), the Store (MN7), the redeem pop-up, the level counter and pop-up, Grand Rounds and the Style shop reuse it
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

// The faded-box line (Yazan 2026-10-14, after it came back on the landings): art must never be "faded" by painting a
// gradient from a solid page colour to clear over it. The page behind has glow and grain, so the painted colour never
// matches it and the box edge shows as a hard line. Fade art with FeatherArt (real transparency masks) instead.
test('art is never faded by a gradient painted in a solid colour (use FeatherArt)', () => {
  const clear = /^(?:'transparent'|'rgba\([^)]*,\s*0\)'|'#[0-9a-f]{6}00')$/i;
  const solid = /^(?:t\.(?:sky|bg|page|card|ground)|'#[0-9a-f]{6}'|'rgba\([^)]*,\s*1\)')$/i;
  const bad = code
    .filter((f) => /<Image\b/.test(f.text) && /from 'expo-linear-gradient'/.test(f.text))
    .flatMap((f) =>
      [...f.text.matchAll(/<LinearGradient\b[^>]*?colors=\{\[([^\]]*)\]/gs)]
        .map((m) => m[1].match(/'[^']*'|[\w.]+/g) ?? [])
        .filter((stops) => stops.some((x) => clear.test(x)) && stops.some((x) => solid.test(x)))
        .map(() => f.path),
    );
  assert.deepEqual(bad, []);
  assert.match(code.find((f) => f.path === 'src/components/FeatherArt.tsx')!.text, /<Fade stops=\{down\}/);
});
