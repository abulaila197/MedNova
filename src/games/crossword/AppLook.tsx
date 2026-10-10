import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Svg, { Path, Polyline } from 'react-native-svg';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { slideColors } from '../medicordle/palette';
import { cellKey, CW, indexOf, lockedCells, QWERTY_ROWS, type CellPos, type PuzzleDef, type Slot, type Typed, type WordDef } from './core';
import { IMAGES } from './data/images';

// Nova Crossword's look (Yazan picked D, 2026-10-05): the app's own look in dark and light, built like Nova Medicordle's slides:
// glass tiles with a soft top sheen on a navy (or warm stone) board, Fraunces titles, Inter Tight text.
// Solved words glow green, hint letters sit on blue tiles (Yazan 2026-10-05), the chosen word is edged in the accent.

const HEART = 'M10 17.5 C4 13 1.5 10 1.5 6.6 C1.5 4 3.5 2 6 2 C7.6 2 9 2.9 10 4.2 C11 2.9 12.4 2 14 2 C16.5 2 18.5 4 18.5 6.6 C18.5 10 16 13 10 17.5 Z';
const STAR = 'M10 1.8 L12.5 7.2 L18.3 7.8 L13.9 11.7 L15.2 17.5 L10 14.5 L4.8 17.5 L6.1 11.7 L1.7 7.8 L7.5 7.2 Z';

function Icon({ d, on, color, off, size }: { d: string; on: boolean; color: string; off: string; size: number }) {
  return (
    <Svg width={u(size)} height={u(size)} viewBox="0 0 20 20">
      <Path d={d} fill={on ? color : 'none'} stroke={on ? color : off} strokeWidth={1.3} strokeLinejoin="round" />
    </Svg>
  );
}

/** Title strip like Medicordle's slide label: accent end strip, kicker, Fraunces title, hearts and stars (Solo) or a score (Offline). */
export function AppTopBar({ kicker, title = 'Nova Crossword', titleColor, sub, hearts, stars, score, onPause }: {
  kicker: string; title?: string; titleColor?: string; sub: string; hearts: number; stars?: number; score?: number; onPause?: () => void;
}) {
  const t = useTheme();
  const c = slideColors(t.mode);
  return (
    <View style={[s.label, { backgroundColor: c.boxA, borderColor: c.line }]}>
      <View style={[s.labelL, { borderLeftColor: titleColor ?? t.accent, flex: 1 }]}>
        <Text style={[s.no, { color: t.dim }]}>{kicker.toUpperCase()}</Text>
        <Text style={[s.ttl, { color: titleColor ?? t.white }]} numberOfLines={1}>{title}</Text>
        <Text style={[s.sub, { color: t.mute }]}>{sub}</Text>
      </View>
      <View style={s.labelR}>
        <View style={{ flexDirection: 'row', gap: u(2) }} accessibilityLabel={`${hearts} hearts`}>{Array.from({ length: CW.hearts }, (_, i) => <Icon key={i} d={HEART} on={i < hearts} color="#ff6b7d" off={t.dim} size={13} />)}</View>
        {stars != null ? <View style={{ flexDirection: 'row', gap: u(1) }} accessibilityLabel={`${stars} of 3 stars`}>{[0, 1, 2].map((i) => <Icon key={i} d={STAR} on={i < stars} color={c.near} off={t.dim} size={13} />)}</View> : null}
        {score != null ? <Text style={[s.sub, { color: t.fg, fontFamily: F.bodySemi }]}>{`${score} pts`}</Text> : null}
      </View>
      {onPause ? (
        <Pressable onPress={onPause} hitSlop={u(8)} accessibilityRole="button" accessibilityLabel="Pause" style={[s.pause, { borderLeftColor: c.line }]}>
          <Text style={{ color: t.fg, fontFamily: F.bodyBold, fontSize: u(11), letterSpacing: u(1) }}>❚❚</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const HINT_DARK = '#5b8cff';
const HINT_LIGHT = '#4a72d9';
/** Tap to zoom (Yazan 2026-10-05): the first tap zooms into that part of the grid so a square is finger-sized. */
export const ZOOM = 2.2;

/**
 * The grid of glass tiles. `zoom` is the square the view is zoomed onto (null = whole grid); `claims` colours a
 * solved word by who claimed it (Offline). Taps on squares go to `onCell`, taps on the gaps to `onBlank`.
 */
export function AppGrid({ puzzle, solved, revealed = [], selected, width, zoom = null, claims, onCell, onBlank }: {
  puzzle: PuzzleDef; solved: string[]; revealed?: string[]; selected?: string | null; width: number; zoom?: CellPos | null;
  claims?: Record<string, string>; onCell?: (cell: CellPos) => void; onBlank?: (cell: CellPos) => void;
}) {
  const t = useTheme();
  const c = slideColors(t.mode);
  const idx = indexOf(puzzle);
  const pad = u(8);
  const gap = 2;
  const size = Math.floor((width - pad * 2 - gap * (puzzle.cols - 1)) / puzzle.cols);
  const step = size + gap;
  const W = step * puzzle.cols - gap;
  const H = step * puzzle.rows - gap;
  const done = lockedCells(idx, solved);
  const shown = lockedCells(idx, solved, revealed);
  const sel = new Set((selected ? idx.cellsOf.get(selected)! : []).map(cellKey));
  const solvedSet = new Set(solved);
  // Zoom: scale about the tapped square, clamped so the grid always fills the view.
  const z = useSharedValue(zoom ? 1 : 0);
  const fx = useSharedValue(W / 2);
  const fy = useSharedValue(H / 2);
  useEffect(() => {
    if (zoom) {
      fx.value = withTiming(zoom.c * step + size / 2, { duration: 260 });
      fy.value = withTiming(zoom.r * step + size / 2, { duration: 260 });
    }
    z.value = withTiming(zoom ? 1 : 0, { duration: 260 });
  }, [zoom, step, size, z, fx, fy]);
  const zs = useAnimatedStyle(() => {
    const k = 1 + (ZOOM - 1) * z.value;
    const tx = Math.min(0, Math.max(W - W * k, W / 2 - fx.value * k));
    const ty = Math.min(0, Math.max(H - H * k, H / 2 - fy.value * k));
    return { transform: [{ translateX: tx + (W / 2) * (k - 1) }, { translateY: ty + (H / 2) * (k - 1) }, { scale: k }] };
  });
  const cells = [];
  for (let r = 0; r < puzzle.rows; r++)
    for (let col = 0; col < puzzle.cols; col++) {
      const k = `${r},${col}`;
      const ids = idx.wordsAt.get(k);
      if (!ids) continue;
      const ok = done.has(k);
      const hint = !ok && shown.has(k);
      const claim = ok && claims ? claims[ids.find((id) => solvedSet.has(id))!] : undefined;
      const bg = ok ? (claim ?? c.ok) : hint ? (t.mode === 'dark' ? HINT_DARK : HINT_LIGHT) : null;
      const picked = sel.has(k);
      cells.push(
        <Pressable
          key={k}
          onPress={() => onCell?.({ r, c: col })}
          accessibilityLabel={`Row ${r + 1}, column ${col + 1}${shown.has(k) ? `, ${idx.letterAt.get(k)}` : ''}`}
          style={[s.tile, { left: col * step, top: r * step, width: size, height: size, borderRadius: Math.max(2, size * 0.14), backgroundColor: c.glass, borderColor: picked ? t.accent : c.line, borderWidth: picked ? 1.5 : 1 }, bg ? { boxShadow: `0 0 ${Math.round(size * 0.35)}px ${bg}66` } : null]}
        >
          {bg ? <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} /> : null}
          {picked && !bg ? <View style={[StyleSheet.absoluteFill, { backgroundColor: t.accent, opacity: 0.16 }]} /> : null}
          <LinearGradient colors={[c.fadeTop, 'transparent']} style={[s.top, { height: size * 0.5 }]} pointerEvents="none" />
          {shown.has(k) ? <Text style={{ fontFamily: F.bodyBold, fontSize: size * 0.52, color: c.onTile }}>{idx.letterAt.get(k)}</Text> : null}
        </Pressable>,
      );
    }
  return (
    <View style={[s.board, { backgroundColor: c.boxB, borderColor: c.line, padding: pad }]}>
      <View style={{ width: W, height: H, overflow: 'hidden' }}>
        <Animated.View style={[{ width: W, height: H }, zs]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessible={false}
            onPress={(e) => onBlank?.({ r: Math.min(puzzle.rows - 1, Math.floor(e.nativeEvent.locationY / step)), c: Math.min(puzzle.cols - 1, Math.floor(e.nativeEvent.locationX / step)) })}
          />
          {cells}
        </Animated.View>
      </View>
    </View>
  );
}

/** The answer card: a specimen-note style card with the clue, glass slots and Medicordle's glass keys. */
export function AppPopup({ word, slots, typed, tokens, width, notice, shake = 0, foot, onKey, onSlot, onHint, onClose }: {
  word: WordDef; slots: Slot[]; typed: Typed; tokens?: number; width: number; notice?: string | null; shake?: number;
  /** Replaces the hint row (Offline has no hints). */
  foot?: ReactNode;
  onKey?: (k: string) => void; onSlot?: (i: number) => void; onHint?: () => void; onClose?: () => void;
}) {
  const sx = useSharedValue(0);
  useEffect(() => {
    if (shake) sx.value = withSequence(withTiming(-u(8), { duration: 50 }), withTiming(u(8), { duration: 70 }), withTiming(-u(5), { duration: 60 }), withTiming(0, { duration: 60 }));
  }, [shake, sx]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sx.value }] }));
  const t = useTheme();
  const c = slideColors(t.mode);
  const inner = width - u(28);
  const n = slots.length;
  const slotW = Math.min(u(34), Math.floor((inner - (n - 1) * u(4)) / n));
  const keyW = Math.floor((inner - 9 * u(4)) / 10);
  return (
    <View style={[s.sheet, { backgroundColor: t.mode === 'dark' ? '#0c1130' : '#f7f3ec', borderColor: c.line }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[s.kick, { color: t.accent }]}>{`${word.direction === 'across' ? 'ACROSS' : 'DOWN'}  ·  ${word.category.toUpperCase()}`}</Text>
        <Pressable onPress={onClose} hitSlop={u(10)} accessibilityRole="button" accessibilityLabel="Close" style={[s.close, { borderColor: c.line, backgroundColor: c.key }]}>
          <Text style={{ color: t.fg, fontFamily: F.bodySemi, fontSize: u(13), lineHeight: u(15) }}>×</Text>
        </Pressable>
      </View>
      {word.question.kind === 'image' ? (
        <View style={[s.photo, { borderColor: c.line }]}>
          <Image source={IMAGES[word.question.imageKey]} contentFit="contain" style={{ width: '100%', height: '100%' }} />
        </View>
      ) : (
        <Text style={[s.clue, { color: t.fg }]}>{word.question.text}</Text>
      )}
      <Animated.View style={[{ flexDirection: 'row', justifyContent: 'center', gap: u(4), marginTop: u(4) }, shakeStyle]}>
        {slots.map((sl, i) => {
          const ch = sl.locked ? sl.letter : typed[i];
          return (
            <Pressable key={i} onPress={() => onSlot?.(i)} accessibilityLabel={`Letter ${i + 1}`} style={[s.tile, s.slot, { width: slotW, height: slotW * 1.12, borderRadius: u(5), backgroundColor: sl.locked ? c.ok : c.glass, borderColor: !sl.locked && ch ? t.soft : c.line }]}>
              <LinearGradient colors={[c.fadeTop, 'transparent']} style={[s.top, { height: '50%' }]} pointerEvents="none" />
              <Text style={{ fontFamily: F.bodyBold, fontSize: u(17), color: sl.locked ? c.onTile : t.fg }}>{ch ?? ''}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
      <Text style={[s.notice, { color: t.mute }]} numberOfLines={1}>{notice ?? ' '}</Text>
      <View style={{ gap: u(5) }}>
        {QWERTY_ROWS.map((row) => (
          <View key={row} style={{ flexDirection: 'row', justifyContent: 'center', gap: u(4) }}>
            {row.split('').map((k) => (
              <Pressable key={k} onPress={() => onKey?.(k)} accessibilityRole="button" accessibilityLabel={k} style={({ pressed }) => [s.key, { width: keyW, backgroundColor: c.key, borderColor: c.line, opacity: pressed ? 0.7 : 1 }]}>
                <LinearGradient colors={[c.fadeTop, 'transparent']} style={[s.top, { height: '50%' }]} pointerEvents="none" />
                <Text style={{ fontFamily: F.bodySemi, fontSize: u(14), color: t.fg }}>{k}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      {foot ?? (
        <Pressable onPress={onHint} accessibilityRole="button" accessibilityLabel="Reveal letters" style={[s.hint, { borderColor: c.line }]}>
          <Text style={{ fontFamily: F.bodySemi, fontSize: u(12.5), color: t.accent }}>{`Reveal letters · ${CW.hintPrice} token`}</Text>
          <Text style={{ fontFamily: F.body, fontSize: u(11), color: t.mute }}>{`You have ${tokens ?? 0}`}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Level map: numbered glass slides in a snake, green when 3 stars, accent edge on the next one. */
export function AppLevelMap({ best, count = 31, action, onOpen }: { best: Record<number, number>; count?: number; action?: ReactNode; onOpen?: (level: number) => void }) {
  const t = useTheme();
  const c = slideColors(t.mode);
  const [w, setW] = useState(0);
  const per = 5;
  const box = u(42);
  const levels = Array.from({ length: count }, (_, i) => i + 1);
  const rows: number[][] = [];
  for (let i = 0; i < levels.length; i += per) rows.push(levels.slice(i, i + per));
  const rowH = box + u(4) + u(11) + u(14);
  const xs = Array.from({ length: per }, (_, i) => box / 2 + (i * (w - box)) / (per - 1));
  const trail = levels.map((_, i) => {
    const ri = Math.floor(i / per);
    const ci = ri % 2 ? per - 1 - (i % per) : i % per;
    return `${xs[ci]},${ri * rowH + box / 2}`;
  }).join(' ');
  const open = (l: number) => l <= 1 || (best[l - 1] ?? 0) >= 1;
  return (
    <View style={{ gap: u(12) }}>
      <View style={[s.label, { backgroundColor: c.boxA, borderColor: c.line }]}>
        <View style={[s.labelL, { borderLeftColor: t.accent, paddingVertical: u(10) }]}>
          <Text style={[s.no, { color: t.dim }]}>{`${Object.values(best).reduce((a, b) => a + b, 0)} OF ${count * 3} STARS`}</Text>
          <Text style={[s.ttl, { color: t.white, fontSize: u(24), lineHeight: u(28) }]}>Nova Crossword</Text>
          <Text style={[s.sub, { color: t.mute }]}>One star opens the next puzzle.</Text>
        </View>
        {action ? <View style={{ justifyContent: 'center', paddingRight: u(10) }}>{action}</View> : null}
      </View>
      <View style={[s.board, { alignSelf: 'stretch', backgroundColor: c.boxB, borderColor: c.line, padding: u(14) }]}>
        <View style={{ gap: u(14) }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          {w ? (
            <Svg width={w} height={rows.length * rowH} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Polyline points={trail} fill="none" stroke={c.line} strokeWidth={2} strokeDasharray="4 6" strokeLinecap="round" />
            </Svg>
          ) : null}
          {rows.map((row, ri) => (
            <View key={ri} style={{ flexDirection: ri % 2 ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
              {row.map((l) => {
                const on = open(l);
                const st = best[l] ?? 0;
                const now = on && !st;
                const bg = st === 3 ? c.ok : st ? c.near : null;
                return (
                  <Pressable key={l} disabled={!on} onPress={() => onOpen?.(l)} accessibilityRole="button" accessibilityLabel={on ? `Puzzle ${l}, ${st} of 3 stars` : `Puzzle ${l}, locked`} style={{ alignItems: 'center', gap: u(4) }}>
                    <View style={[s.tile, { position: 'relative', width: box, height: box, borderRadius: u(8), backgroundColor: t.mode === 'dark' ? '#121839' : '#f3eee5', borderColor: now ? t.accent : c.line, borderWidth: now ? 1.5 : 1 }, bg ? { boxShadow: `0 0 ${u(12)}px ${bg}55` } : null]}>
                      {bg ? <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} /> : null}
                      <LinearGradient colors={[c.fadeTop, 'transparent']} style={[s.top, { height: '50%' }]} pointerEvents="none" />
                      <Text style={{ fontFamily: F.bodyBold, fontSize: u(17), color: bg ? c.onTile : on ? t.fg : t.dim }}>{on ? l : '·'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row' }}>{[0, 1, 2].map((i) => <Icon key={i} d={STAR} on={i < st} color={c.near} off={t.dim} size={9} />)}</View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch', borderWidth: 1, borderRadius: u(6), overflow: 'hidden' },
  labelL: { borderLeftWidth: u(5), paddingVertical: u(7), paddingHorizontal: u(10), gap: u(1), flexShrink: 1 },
  labelR: { alignItems: 'flex-end', justifyContent: 'center', gap: u(5), paddingRight: u(10) },
  no: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.2) },
  ttl: { fontFamily: F.display, fontSize: u(20), lineHeight: u(24) },
  sub: { fontFamily: F.body, fontSize: u(11) },
  board: { borderWidth: 1, borderRadius: u(14), alignSelf: 'center' },
  tile: { position: 'absolute', borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 0, right: 0, top: 0 },
  sheet: { borderTopWidth: 1, borderTopLeftRadius: u(18), borderTopRightRadius: u(18), padding: u(14), gap: u(8) },
  kick: { fontFamily: F.bodyBold, fontSize: u(10), letterSpacing: u(1.4) },
  close: { width: u(26), height: u(26), borderRadius: u(13), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  clue: { fontFamily: F.body, fontSize: u(14.5), lineHeight: u(21) },
  photo: { alignSelf: 'center', width: u(220), height: u(150), borderRadius: u(10), borderWidth: 1, overflow: 'hidden', backgroundColor: '#fff' },
  slot: { position: 'relative' },
  key: { height: u(40), borderRadius: u(4), borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  notice: { fontFamily: F.body, fontSize: u(11.5), textAlign: 'center', minHeight: u(15) },
  pause: { width: u(40), borderLeftWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: u(9), marginTop: u(2) },
});
