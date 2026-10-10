import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Glow } from '@/components/Glow';
import { Grain } from '@/components/Grain';
import { loadFonts } from '@/features/loading/fonts';
import { useApp } from '@/state/app';
import { u, useScreen } from '@/theme/scale';
import { THEMES } from '@/theme/tokens';

import { GameScreen } from '../shell/ui';
import type { HintView } from './core';

// The Silent Artist's own design language (SA9): "Classroom slate". A chalkboard in a worn wooden frame,
// chalk sticks on the ledge as colours, chalk lettering. The room follows the app (SA10, SA11, Yazan 2026-10-05):
// the Nebula sky and a navy slate in dark mode, the Warm Stone sky and a dark slate board in light mode.

/** Colours that stay the same in both themes: the wood, the chalk on the board, fonts. */
export const SL = {
  frame: '#6e4b2c',
  frameDark: '#4d331d',
  frameW: 9,
  chalk: '#f1eedf',
  yellow: '#f2df8a',
  pink: '#f3a6b6',
  blue: '#9fd3ef',
  red: '#f08a7e',
  inks: ['#f4f1e6', '#f2df8a', '#f3a6b6', '#9fd3ef'],
  inkNames: ['White chalk', 'Yellow chalk', 'Pink chalk', 'Blue chalk'],
  sizes: [9, 20] as [number, number],
  head: 'CabinSketch_700Bold',
  headLight: 'CabinSketch_400Regular',
  body: 'PatrickHand_400Regular',
};
/** Colours that follow the app theme. `ink`/`soft`/`dim`/`mark` are text on the page; `boardSoft`/`boardDim` on the board. */
const ROOMS = {
  dark: {
    board: '#10153a', boardDeep: '#0b0f2a', boardSoft: '#b6bdd8', boardDim: '#7d86a6',
    ink: '#f1eedf', soft: '#b6bdd8', dim: '#7d86a6', mark: '#f2df8a', alarm: '#f3a6b6',
    card: 'rgba(12,16,40,0.8)', line: 'rgba(241,238,223,0.35)', btn: '#f2df8a', btnText: '#1d2b22', onInk: '#1d2b22',
  },
  light: {
    board: '#262b38', boardDeep: '#1d212c', boardSoft: '#b9bdc8', boardDim: '#8a8f9c',
    ink: '#1d2230', soft: '#6f695f', dim: '#9a9385', mark: '#c4602a', alarm: '#c8445a',
    card: 'rgba(250,247,241,0.92)', line: 'rgba(29,34,48,0.3)', btn: '#262b38', btnText: '#f1eedf', onInk: '#f6f2ea',
  },
};
export type Room = (typeof ROOMS)['dark'];
export const useRoom = (): Room => ROOMS[useApp((st) => st.mode)];

export const SLATE_FONTS = ['CabinSketch_700Bold', 'CabinSketch_400Regular', 'PatrickHand_400Regular'];

/** Loads the chalk fonts once; screens render after. */
export function useSlateFonts() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    loadFonts(SLATE_FONTS).finally(() => setOk(true));
  }, []);
  return ok;
}

/** A Silent Artist page: the game header over the dark slate room. `scroll` for long pages (pick, reveal). */
export function SlateScreen({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  const ins = useSafeAreaInsets();
  const { width, height } = useScreen();
  const mode = useApp((st) => st.mode);
  const room = (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: THEMES[mode].sky }]} pointerEvents="none">
      <Glow delay={1} w={width} h={height} mode={mode} />
      <Grain />
    </View>
  );
  return (
    <GameScreen scroll={scroll} under={room} bodyStyle={[s.body, { paddingBottom: u(14) + ins.bottom }]}>
      {children}
    </GameScreen>
  );
}

export function Kicker({ children, color }: { children: ReactNode; color?: string }) {
  const R = useRoom();
  color ??= R.soft;
  return <Text style={[s.kick, { color }]}>{typeof children === 'string' ? children.toUpperCase() : children}</Text>;
}

export function ChalkTitle({ children, size = 26, color, style }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const R = useRoom();
  color ??= R.ink;
  return <Text style={[{ fontFamily: SL.head, fontSize: u(size), lineHeight: u(size * 1.15), color }, style]}>{children}</Text>;
}

export function Note({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.note, { color: useRoom().soft }, style]}>{children}</Text>;
}

/** A small slate panel with a dashed chalk border. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const R = useRoom();
  return <View style={[s.panel, { backgroundColor: R.card, borderColor: R.line }, style]}>{children}</View>;
}

/** The big board in its wooden frame, with the soft inner shadow of a real slate. */
export function Frame({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.frame, { backgroundColor: useRoom().board }, style]}>
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { boxShadow: 'inset 0 0 28px rgba(0,0,0,0.45)' }]} />
    </View>
  );
}

/** Chalk-yellow main button; `ghost` is the chalk-outline one. */
export function ChalkBtn({ label, onPress, ghost, disabled, style, color }: { label: string; onPress?: () => void; ghost?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; color?: string }) {
  const R = useRoom();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.btn, ghost ? { borderWidth: 1.5, borderColor: R.line, borderStyle: 'dashed' } : { backgroundColor: color ?? R.btn }, { opacity: disabled ? 0.4 : pressed ? 0.85 : 1 }, style]}>
      <Text style={[s.btnT, { color: ghost ? R.ink : color ? '#1d2b22' : R.btnText }]}>{label}</Text>
    </Pressable>
  );
}

/** The turn clock: a chalk circle that rubs away, seconds in the middle; it turns pink in the last 10 s. */
export function ChalkTimer({ leftMs, totalMs, size = 46 }: { leftMs: number; totalMs: number; size?: number }) {
  const d = u(size);
  const r = d / 2 - u(3);
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, leftMs / totalMs));
  const R = useRoom();
  const col = leftMs <= 10_000 ? R.alarm : R.ink;
  return (
    <View style={{ width: d, height: d }} accessibilityRole="timer" accessibilityLabel={`${Math.ceil(leftMs / 1000)} seconds left`}>
      <Svg width={d} height={d}>
        <Circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke={R.ink} strokeOpacity={0.18} strokeWidth={u(3)} />
        <Circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke={col} strokeWidth={u(3)} strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform={`rotate(-90 ${d / 2} ${d / 2})`} />
      </Svg>
      <Text style={[StyleSheet.absoluteFill, s.timeIn, { color: col, lineHeight: d, fontSize: u(size * 0.37) }]}>{Math.ceil(leftMs / 1000)}</Text>
    </View>
  );
}

/** The hint ladder for the room (SA5): word count, field, then the blanks filling in. */
export function HintCard({ hint }: { hint: HintView }) {
  const ink = { color: useRoom().ink };
  return (
    <Panel>
      <View style={s.hintRow}>
        <Text style={[s.hintK, ink]}>{`${hint.words} ${hint.words === 1 ? 'word' : 'words'}`}</Text>
        <Text style={[s.hintK, ink, { opacity: hint.field ? 1 : 0.45 }]}>{hint.field ?? 'Field soon'}</Text>
      </View>
      <Text style={[s.mask, ink]} numberOfLines={2} adjustsFontSizeToFit>
        {hint.mask ? hint.mask.replace(/ /g, '    ') : '· · ·'}
      </Text>
    </Panel>
  );
}

/** Chalk sticks and actions on the wooden ledge under the board. */
export function Ledge({ ink, size, erase, onInk, onSize, onErase, onUndo, onClear }: { ink: number; size: number; erase: boolean; onInk: (i: number) => void; onSize: () => void; onErase: () => void; onUndo: () => void; onClear: () => void }) {
  const tool = (key: string, on: boolean, child: ReactNode, onPress: () => void, label: string) => (
    <Pressable key={key} onPress={onPress} hitSlop={u(4)} style={[s.tool, on && { transform: [{ translateY: -u(4) }] }]} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }}>
      {child}
    </Pressable>
  );
  const word = (t: string, on = false) => <Text style={[s.toolT, on && { color: SL.yellow }]}>{t}</Text>;
  return (
    <View style={s.ledge}>
      {SL.inks.map((c, i) => tool(`i${i}`, !erase && ink === i, <View style={[s.stick, { backgroundColor: c, opacity: !erase && ink === i ? 1 : 0.72 }]} />, () => onInk(i), SL.inkNames[i]))}
      <View style={s.sep} />
      {tool('size', false, word(size ? 'Thick' : 'Thin'), onSize, 'Line size')}
      {tool('erase', erase, word('Erase', erase), onErase, 'Eraser')}
      {tool('undo', false, word('Undo'), onUndo, 'Undo')}
      {tool('clear', false, word('Clear'), onClear, 'Clear the board')}
    </View>
  );
}

/** "Hold to peek": the performer sees the disease again only while holding. */
export function Peek({ word }: { word: string }) {
  const [on, setOn] = useState(false);
  const R = useRoom();
  return (
    <Pressable onPressIn={() => setOn(true)} onPressOut={() => setOn(false)} style={[s.peek, { borderColor: R.line }]} accessibilityRole="button" accessibilityLabel="Hold to see the disease">
      <Text style={[s.peekT, { color: on ? R.mark : R.soft }]} numberOfLines={1} adjustsFontSizeToFit>
        {on ? word : 'Hold to peek'}
      </Text>
    </Pressable>
  );
}

/** The chalk-outlined pause button that sits by the timer. */
export function PauseBtn({ onPress }: { onPress: () => void }) {
  const R = useRoom();
  return (
    <Pressable onPress={onPress} hitSlop={u(8)} style={[s.pause, { borderColor: R.line }]} accessibilityRole="button" accessibilityLabel="Pause">
      <Text style={[s.pauseT, { color: R.ink }]}>❚❚</Text>
    </Pressable>
  );
}

/** Page top: a small chalk kicker, the big line (a name, "Who got it?"), and the timer or pause on the right. */
export function TopRow({ kicker, title, color, right }: { kicker: string; title: string; color?: string; right?: ReactNode }) {
  return (
    <View style={s.top}>
      <View style={{ flex: 1, gap: u(2) }}>
        <Kicker>{kicker}</Kicker>
        <ChalkTitle size={22} color={color} style={{ lineHeight: u(26) }}>
          {title}
        </ChalkTitle>
      </View>
      {right ? <View style={s.topRight}>{right}</View> : null}
    </View>
  );
}

/** A chalk chip: fields in Solo, players on "Who got it?". `on` fills it with chalk. */
export function ChalkChip({ label, on, dot, onPress, big, small }: { label: string; on?: boolean; dot?: string; onPress: () => void; big?: boolean; small?: boolean }) {
  const R = useRoom();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }} style={({ pressed }) => [s.chip, { borderColor: R.line }, big && s.chipBig, small && s.chipSmall, on && { backgroundColor: R.ink, borderStyle: 'solid', borderColor: R.ink }, pressed && { opacity: 0.8 }]}>
      {dot ? <View style={[s.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[s.chipT, big && { fontSize: u(17) }, small && { fontSize: u(11.5) }, { color: on ? R.onInk : R.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Chalk scoreboard rows, highest first. */
export function Scores({ rows }: { rows: { key: string | number; name: string; score: number; color?: string; mark?: string }[] }) {
  const R = useRoom();
  return (
    <View style={{ gap: u(5) }}>
      {rows.map((r, i) => (
        <View key={r.key} style={s.scoreRow}>
          <Text style={[s.place, { color: R.dim }]}>{i + 1}</Text>
          <View style={[s.dot, { backgroundColor: r.color ?? R.soft }]} />
          <Text style={[s.scoreName, { color: R.ink }]} numberOfLines={1}>
            {r.name}
          </Text>
          {r.mark ? <Text style={[s.mark, { color: R.mark }]}>{r.mark}</Text> : null}
          <Text style={[s.score, { color: R.ink }]}>{r.score}</Text>
        </View>
      ))}
    </View>
  );
}

/** Covers the board while paused, so nobody studies the drawing (rule: pause + hide). */
export function PausedCover() {
  const R = useRoom();
  return (
    <View style={[StyleSheet.absoluteFill, s.cover, { backgroundColor: R.boardDeep }]}>
      <ChalkTitle size={24} color={R.boardSoft}>
        Paused
      </ChalkTitle>
    </View>
  );
}

export const clock = (ms: number) => {
  const t = Math.round(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

const s = StyleSheet.create({
  body: { paddingHorizontal: u(14), paddingTop: u(12), gap: u(10) },
  kick: { fontFamily: SL.body, fontSize: u(11), letterSpacing: u(1.2) },
  note: { fontFamily: SL.body, fontSize: u(14), lineHeight: u(19) },
  panel: { borderWidth: 1, borderStyle: 'dashed', borderRadius: u(10), paddingVertical: u(8), paddingHorizontal: u(12), gap: u(4) },
  frame: { borderWidth: SL.frameW, borderColor: SL.frame, borderRadius: u(4), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.45)', overflow: 'hidden' },
  btn: { borderRadius: u(12), paddingVertical: u(11), paddingHorizontal: u(16), alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: SL.head, fontSize: u(16) },
  timeIn: { textAlign: 'center', fontFamily: SL.head },
  hintRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hintK: { fontFamily: SL.body, fontSize: u(13) },
  mask: { fontFamily: SL.head, fontSize: u(17), letterSpacing: u(3) },
  ledge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: SL.frame, borderRadius: u(3), paddingVertical: u(6), paddingHorizontal: u(8), boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.35)' },
  tool: { paddingVertical: u(4), paddingHorizontal: u(2), alignItems: 'center', justifyContent: 'center' },
  stick: { width: u(26), height: u(8), borderRadius: u(4), boxShadow: '0 1px 1px rgba(0,0,0,0.4)' },
  toolT: { fontFamily: SL.body, fontSize: u(12), color: SL.chalk },
  sep: { width: 1, height: u(18), backgroundColor: 'rgba(0,0,0,0.25)' },
  peek: { flex: 1.15, justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: u(10), paddingVertical: u(10), paddingHorizontal: u(10) },
  pause: { width: u(34), height: u(34), borderRadius: u(17), borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  pauseT: { fontFamily: SL.body, fontSize: u(11) },
  top: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: u(6), borderWidth: 1.5, borderStyle: 'dashed', borderRadius: u(20), paddingVertical: u(6), paddingHorizontal: u(12) },
  chipBig: { paddingVertical: u(11), paddingHorizontal: u(16), borderRadius: u(14) },
  chipSmall: { paddingVertical: u(3), paddingHorizontal: u(8), borderWidth: 1 },
  chipT: { fontFamily: SL.body, fontSize: u(14) },
  dot: { width: u(8), height: u(8), borderRadius: u(4) },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  place: { width: u(14), fontFamily: SL.head, fontSize: u(14) },
  scoreName: { flex: 1, fontFamily: SL.body, fontSize: u(15) },
  mark: { fontFamily: SL.body, fontSize: u(12) },
  score: { minWidth: u(34), textAlign: 'right', fontFamily: SL.head, fontSize: u(16) },
  cover: { alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  peekT: { fontFamily: SL.body, fontSize: u(14), textAlign: 'center' },
});
