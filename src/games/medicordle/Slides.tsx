import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '@/components/AppText';
import Animated, {
  FadeIn, FadeInDown, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/state/app';
import { TABLET, u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { GameScreen, HelperButton } from '../shell/ui';
import { keyStates, marksFor, surgeonGuess, trayOf, type Mark, type Way } from './core';
import { slideColors, type SlideColors } from './palette';
import type { HelperProp } from './helpers';
import { tr, LTR, LTR_WEB } from '@/i18n';

// Nova Medicordle's own design language (NM20, NM21): "Specimen slides".
// Each letter is a glass slide on a lightbox; a sheen passes over a played slide, then it glows
// green (right place), yellow (wrong place) or goes grey. The title is a slide label, the streak a
// stack of slides, the definition a specimen note, and the keys are small glass slides.

const GAP = 5;
const NOTE_H = u(44);
/** #9 (Yazan 2026-11-04): the hurry red of the timer and the note, bright enough to read on navy. */
export const HURRY = '#ff4d5e';
const HURRY_BG = 'rgba(255,77,94,0.14)';
/** The timer turns red in the last 20 s of every Medicordle clock. */
export const HURRY_MS = 20_000;
const ROWS_KB = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/** One played row on the board; `word` null = a turn that timed out (Offline). `color` = the player's colour. */
export type PlayedRow = { word: string | null; color?: string };

export type TableProps = {
  label: { no: string; title: string; sub: ReactNode; right?: ReactNode };
  answer: string;
  played: PlayedRow[];
  rows: number;
  /** Columns shown by a paid hint: their letters appear faintly in the row being typed (NM3). */
  revealed?: number[];
  /** Whose turn colour edges the row being typed (Offline). */
  activeColor?: string;
  rowSeq: number;
  /** Shown on the last try and after the word (NM19); null shows the waiting note. */
  definition: string | null;
  /** #9 (Yazan 2026-11-04): the note opened in the hurry moment (last 20 s online, last guess offline): it turns red. */
  noteHot?: boolean;
  /** What the empty note says before the definition opens. */
  noteWait?: string;
  /** The keyboard takes input only while true. */
  live: boolean;
  /** Checks a typed guess; returns a short reason when it can't be played (costs no try). */
  onSubmit: (word: string) => string | null;
  maxLen: number;
  minLen: number;
  /** Paid helpers above the keyboard (Endless, Vs rivals). */
  helpers?: HelperProp[];
  /** Letters a Clear helper greyed out on the keyboard. */
  cleared?: string[];
  /** Word Surgeon: the word's own letters in a tray instead of the keyboard; green letters stay put. */
  way?: Way;
  onPause: () => void;
  /** Replaces the keyboard: the result card, or whose turn it is. */
  dock?: ReactNode;
  notice?: string | null;
  hidden?: boolean;
  /** Vs rivals: the rivals' mini boards, between the label and the board. */
  extra?: ReactNode;
  children?: ReactNode;
};

export function SlideTable(p: TableProps) {
  const t = useTheme();
  const c = slideColors(t.mode);
  const [input, setInput] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const guesses = useMemo(() => p.played.filter((r) => r.word).map((r) => r.word as string), [p.played]);
  const surgeon = p.way === 'surgeon';
  // Surgeon: nothing locks (Yazan 2026-11-18): each try starts from the whole word scrambled again. Only a slot a paid
  // Letter helper showed keeps its letter.
  const revealedCols = p.revealed;
  const locked = useMemo(() => new Set<number>(surgeon ? (revealedCols ?? []) : []), [surgeon, revealedCols]);
  const tray = useMemo(() => (surgeon ? trayOf(p.answer, locked, hashOf(p.answer) + guesses.length * 977) : []), [surgeon, p.answer, locked, guesses.length]);
  const maxLen = surgeon ? p.answer.length - locked.size : p.maxLen;
  const cleared = p.cleared;
  const keys = useMemo(() => {
    const k = keyStates(guesses, p.answer);
    for (const ch of cleared ?? []) k[ch] ??= 'off';
    return k;
  }, [guesses, p.answer, cleared]);

  // A new row or a new word clears what was typed.
  const row = `${p.played.length}|${p.answer}`;
  const [typedFor, setTypedFor] = useState(row);
  if (typedFor !== row) {
    setTypedFor(row);
    setInput('');
  }
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(id);
  }, [toast]);

  const press = (k: string) => {
    if (!p.live) return;
    if (k === 'ENTER') {
      const why = surgeon && input.length < maxLen ? tr('Fill every slot') : p.onSubmit(surgeon ? surgeonGuess(p.answer, locked, input) : input);
      if (why) {
        setToast(why);
        setShake((n) => n + 1);
      }
      return;
    }
    if (k === 'DEL') return setInput((v) => v.slice(0, -1));
    // Surgeon: only a letter still in the tray can be placed.
    if (surgeon && left(tray, input).indexOf(k) < 0) return;
    setInput((v) => (v.length < maxLen ? v + k : v));
  };

  // A hardware keyboard works too (web preview, tablets).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Enter must submit the guess, not re-press a focused button (e.g. the hint just tapped).
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        (document.activeElement as HTMLElement | null)?.blur?.();
        press('ENTER');
      }
      else if (e.key === 'Backspace') press('DEL');
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toUpperCase());
    };
    // Capture phase, so this runs before a focused button's own Enter handling.
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  });

  return (
    <GameScreen scroll={false}>
      <SlideLabel {...p.label} onPause={p.onPause} />
      {p.extra}
      <Board
        c={c}
        answer={p.answer}
        played={p.played}
        rows={p.rows}
        input={p.live ? input : ''}
        revealed={p.revealed ?? []}
        locked={locked}
        way={p.way ?? 'tries'}
        activeColor={p.activeColor}
        rowSeq={p.rowSeq}
        shake={shake}
        hidden={p.hidden}
        toast={toast ?? p.notice ?? null}
        note={<SpecimenNote c={c} text={p.hidden ? null : p.definition} hot={!!p.noteHot && !p.hidden && p.definition != null} wait={p.noteWait} />}
      />
      {p.dock ? (
        <Animated.View entering={FadeInDown.duration(260)} style={s.dock}>
          {p.dock}
        </Animated.View>
      ) : (
        <View style={{ gap: u(6) }}>
          {p.helpers?.length ? (
            <View style={s.helpers}>
              {p.helpers.map((h) => (
                <HelperButton key={h.tone} label={h.label} tone={h.tone} onPress={h.onPress} disabled={h.disabled} style={s.helper} compact />
              ))}
            </View>
          ) : null}
          {surgeon ? <Tray c={c} letters={left(tray, input)} onKey={press} /> : <Keys c={c} keys={keys} onKey={press} />}
        </View>
      )}
      {p.children}
    </GameScreen>
  );
}

/** Title as a slide label: frosted end strip in the accent, number in mono, title in Gabarito. */
export function SlideLabel({ no, title, sub, right, onPause }: TableProps['label'] & { onPause: () => void }) {
  const t = useTheme();
  const c = slideColors(t.mode);
  return (
    <View style={[s.label, { backgroundColor: c.boxA, borderColor: c.line }]}>
      <View style={[s.labelL, { borderStartColor: t.accent }]}>
        <Text style={[s.no, { color: t.dim }]}>{no}</Text>
        <Text style={[s.ttl, { color: t.white }]}>{title}</Text>
        <Text style={[s.sub, { color: t.mute }]}>{sub}</Text>
      </View>
      <View style={s.labelR}>
        {right}
        <Pressable onPress={onPause} hitSlop={u(8)} style={[s.pause, { borderColor: c.line, backgroundColor: c.key }]} accessibilityRole="button" accessibilityLabel={tr('Pause')}>
          <View style={[s.bar, { backgroundColor: t.fg }]} />
          <View style={[s.bar, { backgroundColor: t.fg }]} />
        </Pressable>
      </View>
    </View>
  );
}

/** The daily streak (NM7): a framed chip with a flame, the number and a label (Yazan 2026-11-17, look B). */
export function SlideStack({ n }: { n: number }) {
  const t = useTheme();
  const c = slideColors(t.mode);
  return (
    <View style={[s.stB, { borderColor: t.accent, backgroundColor: c.boxA }]} accessibilityLabel={tr('Streak {n}', { n })}>
      <Flame size={u(12)} color={t.accent} />
      <View>
        <Text style={[s.stBN, { color: t.fg }]}>{n}</Text>
        <Text style={[s.stBL, { color: t.accent }]}>{tr('STREAK')}</Text>
      </View>
    </View>
  );
}

/** A small flame for the streak. */
function Flame({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5c.6 3.2 3.9 5.1 4.9 8.4.9 3.1-.6 7.1-4.9 8.6-4.3-1.5-5.8-5.4-4.9-8.3.4-1.4 1.3-2.4 2.1-3.4.2 1.6.9 2.7 2 3.3-.3-3 .2-6.1.8-8.6z" fill={color} />
      <Path d="M12 21.5c-2.6-.9-3.7-3.2-3.1-5.2.3 1 .9 1.7 1.7 2 .1-1.8.8-3.2 1.9-4.5.5 2.1 2.6 3.2 2.6 5.2 0 1.2-1.1 2.1-3.1 2.5z" fill={color} opacity={0.55} />
    </Svg>
  );
}

/** Turn countdown for Offline: a small ring of slides would be busy, so a mono figure that warms near zero. */
export function TurnClock({ ms, warn }: { ms: number; warn: boolean }) {
  const t = useTheme();
  return (
    <View style={s.clock}>
      <Text style={[s.clockN, { color: warn ? HURRY : t.white }]}>{Math.ceil(ms / 1000)}</Text>
      <Text style={[s.clockL, { color: t.dim }]}>{tr('SEC')}</Text>
    </View>
  );
}

function Board(p: {
  c: SlideColors; answer: string; played: PlayedRow[]; rows: number; input: string; revealed: number[]; activeColor?: string;
  rowSeq: number; shake: number; hidden?: boolean; toast: string | null; note: ReactNode; locked: Set<number>; way: Way;
}) {
  const mark = marksFor(p.way);
  const t = useTheme();
  const cols = p.answer.length;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const pad = u(9);
  // Room left for the board once the specimen note (about NOTE_H tall) and the gap under the board are kept.
  const tile = Math.max(0, Math.min((box.w - pad * 2 - GAP * (cols - 1)) / cols, (box.h - NOTE_H - u(10) - pad * 2 - GAP * (p.rows - 1)) / p.rows, u(TABLET ? 64 : 40)));
  const activeRow = p.played.length < p.rows ? p.played.length : -1;

  return (
    <View {...LTR_WEB} style={[s.boardWrap, LTR]} onLayout={onLayout}>
      <LinearGradient colors={[p.c.beigeA, p.c.beigeB]} style={[s.board, { borderColor: p.c.beigeLine, padding: pad }]}>
        {tile > 0 && !p.hidden
          ? Array.from({ length: p.rows }, (_, r) => {
              const row = p.played[r];
              if (row) {
                if (!row.word) return <PassedRow key={r} c={p.c} cols={cols} tile={tile} color={row.color} />;
                const marks = mark(row.word, p.answer);
                const fresh = r === p.played.length - 1;
                return (
                  <View key={r} style={s.row}>
                    {marks.map((m, i) => (
                      <Tile key={`${r}:${i}:${fresh ? p.rowSeq : 0}`} c={p.c} size={tile} letter={row.word![i] ?? ''} mark={m} delay={fresh ? i : -1} edge={i === 0 ? row.color : undefined} />
                    ))}
                  </View>
                );
              }
              if (r === activeRow)
                return <ActiveRow key={r} c={p.c} cols={cols} tile={tile} input={p.input} answer={p.answer} revealed={p.revealed} locked={p.way === 'surgeon' ? p.locked : null} color={p.activeColor} shake={p.shake} />;
              return (
                <View key={r} style={s.row}>
                  {Array.from({ length: cols }, (_, i) => (
                    <Tile key={i} c={p.c} size={tile} letter="" mark={null} delay={-1} />
                  ))}
                </View>
              );
            })
          : null}
        {p.hidden ? <Text style={[s.hiddenT, { color: t.mute }]}>{tr('Board hidden while paused')}</Text> : null}
      </LinearGradient>
      {p.note}
      {p.toast ? (
        <Animated.View entering={FadeIn.duration(140)} style={[s.toast, { backgroundColor: t.white }]} pointerEvents="none">
          <Text style={[s.toastT, { color: t.sky }]}>{p.toast}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function ActiveRow({ c, cols, tile, input, answer, revealed, locked, color, shake }: { c: SlideColors; cols: number; tile: number; input: string; answer: string; revealed: number[]; locked: Set<number> | null; color?: string; shake: number }) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (!shake) return;
    const d = u(5);
    x.value = withSequence(withTiming(-d, { duration: 50 }), withTiming(d, { duration: 70 }), withTiming(-d / 2, { duration: 60 }), withTiming(0, { duration: 50 }));
  }, [shake, x]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Animated.View style={[s.row, st]}>
      {Array.from({ length: cols }, (_, i) => {
        // Surgeon: a slot shown by the Letter helper keeps its letter; the placed letters fill the other slots in order.
        if (locked?.has(i)) return <Tile key={i} c={c} size={tile} letter={answer[i]} mark="ok" delay={-1} edge={i === 0 ? color : undefined} />;
        const typed = locked ? input[[...Array(i).keys()].filter((j) => !locked.has(j)).length] : input[i];
        const ghost = !typed && revealed.includes(i) ? answer[i] : undefined;
        return <Tile key={i} c={c} size={tile} letter={typed ?? ''} ghost={ghost} mark={null} delay={-1} typed={!!typed} edge={i === 0 ? color : undefined} />;
      })}
    </Animated.View>
  );
}

function PassedRow({ c, cols, tile, color }: { c: SlideColors; cols: number; tile: number; color?: string }) {
  return (
    <View style={[s.row, { opacity: 0.55 }]} accessibilityLabel={tr('Turn timed out')}>
      {Array.from({ length: cols }, (_, i) => (
        <Tile key={i} c={c} size={tile} letter={i === Math.floor((cols - 1) / 2) ? '·' : ''} mark={null} delay={-1} edge={i === 0 ? color : undefined} />
      ))}
    </View>
  );
}

const MARK_BG = (c: SlideColors, m: Mark) => (m === 'ok' ? c.ok : m === 'near' ? c.near : c.off);

/** One glass slide. `delay` >= 0 plays the reveal: sheen first, then the colour glows in, slide by slide. */
function Tile({ c, size, letter, mark, delay, ghost, typed, edge }: { c: SlideColors; size: number; letter: string; mark: Mark | null; delay: number; ghost?: string; typed?: boolean; edge?: string }) {
  const t = useTheme();
  const p = useSharedValue(delay >= 0 ? 0 : 1);
  useEffect(() => {
    if (delay >= 0) p.value = withDelay(delay * 140, withTiming(1, { duration: 620 }));
  }, [delay, p]);
  const colour = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.38, 1], [0, 1], 'clamp') }));
  const sheen = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(p.value, [0, 0.55], [-size * 1.4, size * 1.4], 'clamp') }, { rotate: '20deg' }] }));
  const lit = mark === 'ok' || mark === 'near';
  const bg = mark ? MARK_BG(c, mark) : null;
  const fs = Math.max(9, size * 0.46);
  const missing = mark === 'missing';
  return (
    <View
      style={[
        s.tile,
        { width: size, height: size, borderColor: typed ? t.soft : c.line, backgroundColor: c.tileSolid, borderRadius: Math.max(3, size * 0.11) },
        lit ? { boxShadow: `0 0 ${Math.round(size * 0.3)}px ${bg}88` } : null,
      ]}>
      {bg && missing ? <View style={[StyleSheet.absoluteFill, { backgroundColor: bg, opacity: 0.5 }]} /> : bg ? <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: bg }, colour]} /> : null}
      <LinearGradient colors={[c.fadeTop, 'transparent']} style={[s.slideTop, { height: size * 0.5 }]} pointerEvents="none" />
      {edge ? <View style={[s.edge, { backgroundColor: edge }]} /> : null}
      {delay >= 0 ? <Animated.View style={[s.sheen, { width: size * 0.5, height: size * 2, top: -size * 0.5, backgroundColor: c.sheen }, sheen]} /> : null}
      <Text style={[s.tileT, { fontSize: fs, color: mark === 'off' || mark === 'missing' ? c.offText : lit ? c.onTile : ghost ? c.ghost : t.fg }]}>{letter || ghost || (mark === 'missing' ? '–' : '')}</Text>
    </View>
  );
}

/** The definition as a specimen note (dashed card, accent border so it stands out: Yazan 2026-11-17). */
function SpecimenNote({ c, text, hot, wait }: { c: SlideColors; text: string | null; hot?: boolean; wait?: string }) {
  const t = useTheme();
  return (
    <View style={[s.note, hot ? { borderColor: HURRY, backgroundColor: HURRY_BG, borderStyle: 'solid' } : { borderColor: t.accent, backgroundColor: c.boxA }]}>
      <Text style={[s.noteL, { color: hot ? HURRY : t.accent }]}>{tr('SPECIMEN NOTE')}</Text>
      <Text style={[s.noteT, { color: text ? t.fg : t.mute }]}>{text ?? wait ?? tr('The definition appears on your last guess.')}</Text>
    </View>
  );
}

/** A stable number from a word, so its tray shuffles the same way on every render. */
const hashOf = (w: string) => [...w].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
/** The tray's letters not placed yet (each placed letter takes one copy out). */
function left(tray: string[], placed: string): string[] {
  const out = [...tray];
  for (const ch of placed) {
    const i = out.indexOf(ch);
    if (i >= 0) out.splice(i, 1);
  }
  return out;
}

/** Word Surgeon's tray (Yazan 2026-11-18): the scrambled letters still to place, then Back and Check. */
function Tray({ c, letters, onKey }: { c: SlideColors; letters: string[]; onKey: (k: string) => void }) {
  return (
    <View {...LTR_WEB} style={[s.kb, LTR]}>
      <View style={[s.krow, s.tray]}>
        {letters.map((ch, i) => (
          <Key key={`${ch}${i}`} label={ch} c={c} big onPress={() => onKey(ch)} />
        ))}
        {!letters.length ? <Text style={[s.trayDone, { color: c.offText }]}>{tr('Every slot is filled')}</Text> : null}
      </View>
      <View style={s.krow}>
        <Key label="⌫" a11y={tr('Delete')} act c={c} onPress={() => onKey('DEL')} />
        <Key label={tr('Check')} act c={c} onPress={() => onKey('ENTER')} />
      </View>
    </View>
  );
}

/** Glass key slides; each letter shows its best result in green, yellow or grey (NM21). */
function Keys({ c, keys, onKey }: { c: SlideColors; keys: Record<string, 'ok' | 'near' | 'off'>; onKey: (k: string) => void }) {
  const t = useTheme();
  return (
    <View {...LTR_WEB} style={[s.kb, LTR]}>
      {ROWS_KB.map((row, n) => (
        <View key={row} style={s.krow}>
          {n === 2 ? <Key label={tr('Enter')} wide c={c} onPress={() => onKey('ENTER')} /> : null}
          {[...row].map((ch) => {
            const st = keys[ch];
            const bg = st === 'ok' ? c.ok : st === 'near' ? c.near : st === 'off' ? c.off : c.key;
            const fg = st === 'ok' || st === 'near' ? c.onTile : st === 'off' ? c.offText : t.fg;
            return <Key key={ch} label={ch} c={c} bg={bg} fg={fg} onPress={() => onKey(ch)} />;
          })}
          {n === 2 ? <Key label="⌫" a11y={tr('Delete')} wide c={c} onPress={() => onKey('DEL')} /> : null}
        </View>
      ))}
    </View>
  );
}

function Key({ label, a11y, wide, big, act, c, bg, fg, onPress }: { label: string; a11y?: string; wide?: boolean; big?: boolean; act?: boolean; c: SlideColors; bg?: string; fg?: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.key, wide && s.keyWide, big && s.keyBig, act && s.keyAct, { backgroundColor: bg ?? c.key, borderColor: c.line, opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button" accessibilityLabel={a11y ?? label}>
      <LinearGradient colors={[c.fadeTop, 'transparent']} style={s.keyTop} pointerEvents="none" />
      <Text style={[s.keyT, wide && s.keyTW, { color: fg ?? t.fg }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  label: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch', borderWidth: 1, borderRadius: u(6), overflow: 'hidden' },
  labelL: { borderStartWidth: u(5), paddingVertical: u(6), paddingHorizontal: u(9), gap: u(1), flexShrink: 1 },
  no: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.1) },
  ttl: { fontFamily: F.display, fontSize: u(18), lineHeight: u(21) },
  sub: { fontFamily: F.body, fontSize: u(9.5) },
  labelR: { flexDirection: 'row', alignItems: 'center', gap: u(10), paddingEnd: u(9) },
  pause: { width: u(26), height: u(26), borderRadius: u(13), borderWidth: 1, flexDirection: 'row', gap: u(3), alignItems: 'center', justifyContent: 'center' },
  bar: { width: u(2.5), height: u(9), borderRadius: u(1) },
  stB: { flexDirection: 'row', alignItems: 'center', gap: u(5), borderWidth: 1, borderRadius: u(10), paddingVertical: u(4), paddingHorizontal: u(8) },
  stBN: { fontFamily: F.bodyBold, fontSize: u(12), lineHeight: u(14) },
  stBL: { fontFamily: F.mono, fontSize: u(5.5), letterSpacing: u(1) },
  clock: { alignItems: 'center' },
  clockN: { fontFamily: F.mono, fontSize: u(16), lineHeight: u(18) },
  clockL: { fontFamily: F.mono, fontSize: u(6.5), letterSpacing: u(1) },
  boardWrap: { flex: 1, minHeight: u(120), justifyContent: 'center', gap: u(10) },
  board: { borderWidth: 1, borderRadius: u(14), gap: GAP, alignItems: 'center', alignSelf: 'center' },
  row: { flexDirection: 'row', gap: GAP },
  tile: { borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  slideTop: { position: 'absolute', left: 0, right: 0, top: 0 },
  edge: { position: 'absolute', start: 0, top: 0, bottom: 0, width: 3 },
  sheen: { position: 'absolute' },
  tileT: { fontFamily: F.bodyBold },
  hiddenT: { fontFamily: F.body, fontSize: u(11), padding: u(24) },
  toast: { position: 'absolute', top: u(6), alignSelf: 'center', borderRadius: u(10), paddingVertical: u(6), paddingHorizontal: u(12) },
  toastT: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  note: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: u(10), paddingVertical: u(6), paddingHorizontal: u(10), gap: u(2) },
  noteL: { fontFamily: F.bodyBold, fontSize: u(7), letterSpacing: u(1.3) },
  noteT: { fontFamily: F.body, fontSize: u(10.5), lineHeight: u(14) },
  // Up to three helpers share one row; each shrinks, never wraps the keyboard down.
  helpers: { flexDirection: 'row', gap: u(5), justifyContent: 'center' },
  helper: { flexShrink: 1, paddingVertical: u(7), paddingHorizontal: u(8) },
  kb: { gap: u(4.5) },
  tray: { flexWrap: 'wrap', minHeight: u(40), alignItems: 'center' },
  trayDone: { fontFamily: F.body, fontSize: u(10.5) },
  krow: { flexDirection: 'row', justifyContent: 'center', gap: u(3.5) },
  // tablet (Yazan 2026-11-12): the phone's keyboard, just bigger keys across the wider screen
  // flexGrow/flexShrink/flexBasis spelled out, never the flex shorthand: on Android a key's flex: 1 keeps its basis at 0
  // even when a style after it sets flexBasis auto and a width, so the Word Surgeon letters and Check drew as thin lines
  // (Yazan 2026-11-22). Spelled out, keyBig and keyAct can override each part.
  key: { flexGrow: 1, flexShrink: 1, flexBasis: 0, maxWidth: u(TABLET ? 38 : 23), height: u(TABLET ? 44 : 34), borderRadius: u(3), borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  keyWide: { flexGrow: 1.6, maxWidth: u(TABLET ? 62 : 38) },
  // Surgeon tray tiles: fixed size, so up to 15 letters wrap into neat rows.
  keyBig: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: u(TABLET ? 44 : 30), maxWidth: u(TABLET ? 44 : 30), height: u(TABLET ? 48 : 38) },
  // Surgeon's Back and Check: wide enough to read and hit.
  keyAct: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: u(TABLET ? 120 : 92), maxWidth: u(TABLET ? 120 : 92) },
  keyTop: { position: 'absolute', left: 0, right: 0, top: 0, height: '50%' },
  keyT: { fontFamily: F.bodySemi, fontSize: u(TABLET ? 14 : 11) },
  keyTW: { fontSize: u(9) },
  dock: { gap: u(8) },
});
