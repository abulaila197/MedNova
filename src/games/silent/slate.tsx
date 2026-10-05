import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { loadFonts } from '@/features/loading/fonts';
import { u } from '@/theme/scale';

import { GameScreen } from '../shell/ui';
import type { HintView } from './core';

// The Silent Artist's own design language (SA9): "Classroom slate". A green chalkboard in a worn wooden
// frame, chalk sticks on the ledge as colours, chalk lettering. Nothing here comes from the app's look or
// another game's; only the game header is shared. One look in both app themes, like the loading page.

export const SL = {
  page: ['#1a2e26', '#0e1a15'] as [string, string],
  board: '#22392f',
  boardDeep: '#1b3027',
  frame: '#6e4b2c',
  frameDark: '#4d331d',
  frameW: 9,
  chalk: '#f1eedf',
  soft: '#b9c4b4',
  dim: '#7f8f84',
  yellow: '#f2df8a',
  pink: '#f3a6b6',
  blue: '#9fd3ef',
  red: '#f08a7e',
  inks: ['#f4f1e6', '#f2df8a', '#f3a6b6', '#9fd3ef'],
  inkNames: ['White chalk', 'Yellow chalk', 'Pink chalk', 'Blue chalk'],
  sizes: [9, 20] as [number, number],
  card: 'rgba(15,28,22,0.78)',
  line: 'rgba(241,238,223,0.35)',
  head: 'CabinSketch_700Bold',
  headLight: 'CabinSketch_400Regular',
  body: 'PatrickHand_400Regular',
};
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
  return (
    <GameScreen scroll={scroll} under={<LinearGradient colors={SL.page} style={StyleSheet.absoluteFill} />} bodyStyle={[s.body, { paddingBottom: u(14) + ins.bottom }]}>
      {children}
    </GameScreen>
  );
}

export function Kicker({ children, color = SL.soft }: { children: ReactNode; color?: string }) {
  return <Text style={[s.kick, { color }]}>{typeof children === 'string' ? children.toUpperCase() : children}</Text>;
}

export function ChalkTitle({ children, size = 26, color = SL.chalk, style }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ fontFamily: SL.head, fontSize: u(size), lineHeight: u(size * 1.15), color }, style]}>{children}</Text>;
}

export function Note({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.note, style]}>{children}</Text>;
}

/** A small slate panel with a dashed chalk border. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.panel, style]}>{children}</View>;
}

/** The big board in its wooden frame, with the soft inner shadow of a real slate. */
export function Frame({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.frame, style]}>
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { boxShadow: 'inset 0 0 28px rgba(0,0,0,0.45)' }]} />
    </View>
  );
}

/** Chalk-yellow main button; `ghost` is the chalk-outline one. */
export function ChalkBtn({ label, onPress, ghost, disabled, style, color = SL.yellow }: { label: string; onPress?: () => void; ghost?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; color?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.btn, ghost ? { borderWidth: 1.5, borderColor: SL.line, borderStyle: 'dashed' } : { backgroundColor: color }, { opacity: disabled ? 0.4 : pressed ? 0.85 : 1 }, style]}>
      <Text style={[s.btnT, { color: ghost ? SL.chalk : '#1d2b22' }]}>{label}</Text>
    </Pressable>
  );
}

/** The turn clock: a chalk circle that rubs away, seconds in the middle; it turns pink in the last 10 s. */
export function ChalkTimer({ leftMs, totalMs, size = 46 }: { leftMs: number; totalMs: number; size?: number }) {
  const d = u(size);
  const r = d / 2 - u(3);
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, leftMs / totalMs));
  const col = leftMs <= 10_000 ? SL.pink : SL.chalk;
  return (
    <View style={{ width: d, height: d }} accessibilityRole="timer" accessibilityLabel={`${Math.ceil(leftMs / 1000)} seconds left`}>
      <Svg width={d} height={d}>
        <Circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke={SL.chalk} strokeOpacity={0.18} strokeWidth={u(3)} />
        <Circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke={col} strokeWidth={u(3)} strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform={`rotate(-90 ${d / 2} ${d / 2})`} />
      </Svg>
      <Text style={[StyleSheet.absoluteFill, s.timeIn, { color: col, lineHeight: d, fontSize: u(size * 0.37) }]}>{Math.ceil(leftMs / 1000)}</Text>
    </View>
  );
}

/** The hint ladder for the room (SA5): word count, field, then the blanks filling in. */
export function HintCard({ hint }: { hint: HintView }) {
  return (
    <Panel>
      <View style={s.hintRow}>
        <Text style={s.hintK}>{`${hint.words} ${hint.words === 1 ? 'word' : 'words'}`}</Text>
        <Text style={[s.hintK, { opacity: hint.field ? 1 : 0.45 }]}>{hint.field ?? 'Field soon'}</Text>
      </View>
      <Text style={s.mask} numberOfLines={2} adjustsFontSizeToFit>
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
  return (
    <Pressable onPressIn={() => setOn(true)} onPressOut={() => setOn(false)} style={s.peek} accessibilityRole="button" accessibilityLabel="Hold to see the disease">
      <Text style={[s.peekT, on && { color: SL.yellow }]} numberOfLines={1} adjustsFontSizeToFit>
        {on ? word : 'Hold to peek'}
      </Text>
    </Pressable>
  );
}

/** The chalk-outlined pause button that sits by the timer. */
export function PauseBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={u(8)} style={s.pause} accessibilityRole="button" accessibilityLabel="Pause">
      <Text style={s.pauseT}>❚❚</Text>
    </Pressable>
  );
}

/** Page top: a small chalk kicker, the big line (a name, "Who got it?"), and the timer or pause on the right. */
export function TopRow({ kicker, title, color = SL.chalk, right }: { kicker: string; title: string; color?: string; right?: ReactNode }) {
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
export function ChalkChip({ label, on, dot, onPress, big }: { label: string; on?: boolean; dot?: string; onPress: () => void; big?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }} style={({ pressed }) => [s.chip, big && s.chipBig, on && { backgroundColor: SL.chalk, borderStyle: 'solid', borderColor: SL.chalk }, pressed && { opacity: 0.8 }]}>
      {dot ? <View style={[s.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[s.chipT, big && { fontSize: u(17) }, { color: on ? '#1d2b22' : SL.chalk }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Chalk scoreboard rows, highest first. */
export function Scores({ rows }: { rows: { key: string | number; name: string; score: number; color?: string; mark?: string }[] }) {
  return (
    <View style={{ gap: u(5) }}>
      {rows.map((r, i) => (
        <View key={r.key} style={s.scoreRow}>
          <Text style={s.place}>{i + 1}</Text>
          <View style={[s.dot, { backgroundColor: r.color ?? SL.soft }]} />
          <Text style={s.scoreName} numberOfLines={1}>
            {r.name}
          </Text>
          {r.mark ? <Text style={s.mark}>{r.mark}</Text> : null}
          <Text style={s.score}>{r.score}</Text>
        </View>
      ))}
    </View>
  );
}

/** Covers the board while paused, so nobody studies the drawing (rule: pause + hide). */
export function PausedCover() {
  return (
    <View style={[StyleSheet.absoluteFill, s.cover]}>
      <ChalkTitle size={24} color={SL.soft}>
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
  note: { fontFamily: SL.body, fontSize: u(14), lineHeight: u(19), color: SL.soft },
  panel: { backgroundColor: SL.card, borderColor: SL.line, borderWidth: 1, borderStyle: 'dashed', borderRadius: u(10), paddingVertical: u(8), paddingHorizontal: u(12), gap: u(4) },
  frame: { backgroundColor: SL.board, borderWidth: SL.frameW, borderColor: SL.frame, borderRadius: u(4), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.45)', overflow: 'hidden' },
  btn: { borderRadius: u(12), paddingVertical: u(11), paddingHorizontal: u(16), alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: SL.head, fontSize: u(16) },
  timeIn: { textAlign: 'center', fontFamily: SL.head },
  hintRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hintK: { fontFamily: SL.body, fontSize: u(13), color: SL.chalk },
  mask: { fontFamily: SL.head, fontSize: u(17), letterSpacing: u(3), color: SL.chalk },
  ledge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: SL.frame, borderRadius: u(3), paddingVertical: u(6), paddingHorizontal: u(8), boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.35)' },
  tool: { paddingVertical: u(4), paddingHorizontal: u(2), alignItems: 'center', justifyContent: 'center' },
  stick: { width: u(26), height: u(8), borderRadius: u(4), boxShadow: '0 1px 1px rgba(0,0,0,0.4)' },
  toolT: { fontFamily: SL.body, fontSize: u(12), color: SL.chalk },
  sep: { width: 1, height: u(18), backgroundColor: 'rgba(0,0,0,0.25)' },
  peek: { flex: 1.15, justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: SL.line, borderRadius: u(10), paddingVertical: u(10), paddingHorizontal: u(10) },
  pause: { width: u(34), height: u(34), borderRadius: u(17), borderWidth: 1.5, borderStyle: 'dashed', borderColor: SL.line, alignItems: 'center', justifyContent: 'center' },
  pauseT: { fontFamily: SL.body, fontSize: u(11), color: SL.chalk },
  top: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: u(6), borderWidth: 1.5, borderStyle: 'dashed', borderColor: SL.line, borderRadius: u(20), paddingVertical: u(6), paddingHorizontal: u(12) },
  chipBig: { paddingVertical: u(11), paddingHorizontal: u(16), borderRadius: u(14) },
  chipT: { fontFamily: SL.body, fontSize: u(14) },
  dot: { width: u(8), height: u(8), borderRadius: u(4) },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  place: { width: u(14), fontFamily: SL.head, fontSize: u(14), color: SL.dim },
  scoreName: { flex: 1, fontFamily: SL.body, fontSize: u(15), color: SL.chalk },
  mark: { fontFamily: SL.body, fontSize: u(12), color: SL.yellow },
  score: { minWidth: u(34), textAlign: 'right', fontFamily: SL.head, fontSize: u(16), color: SL.chalk },
  cover: { backgroundColor: SL.boardDeep, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  peekT: { fontFamily: SL.body, fontSize: u(14), textAlign: 'center', color: SL.soft },
});
