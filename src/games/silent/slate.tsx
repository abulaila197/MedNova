import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@/components/AppText';
import Svg, { Circle } from 'react-native-svg';

import { loadFonts } from '@/features/loading/fonts';
import { u } from '@/theme/scale';

import { useClock, type Clock } from '../engine/useTicker';
import { GameScreen } from '../shell/ui';
import type { HintView } from './core';

// The Silent Artist's own design language (SA9): "Classroom slate". A chalkboard in a worn wooden frame,
// chalk sticks on the ledge as colours, chalk lettering. The room follows the app (SA10, SA11, Yazan 2026-10-05):
// the Nebula sky and a navy slate.

/** Fixed colours: the wood, the chalk on the board, fonts. */
export const SL = {
  frame: '#6e4b2c',
  frameDark: '#4d331d',
  frameW: 9,
  chalk: '#f1eedf',
  yellow: '#f2df8a',
  pink: '#f3a6b6',
  blue: '#9fd3ef',
  red: '#f08a7e',
  // #11 (Yazan 2026-10-26): 24 colours. The first 4 are the chalk sticks on the ledge; the palette holds all 24.
  // Strokes carry the colour itself, so every phone draws the same whatever its palette.
  // Beige board (Yazan 2026-11-02): the ledge sticks are black (the default), red, blue, green; the chalk pastels
  // that showed on the navy slate move into the palette.
  inks: [
    '#111111', '#ef4444', '#3b82f6', '#22c55e', '#f97316', '#f5b82e',
    '#84cc16', '#14b8a6', '#38bdf8', '#6366f1', '#8b5cf6', '#d946ef',
    '#f43f5e', '#92400e', '#7f1d1d', '#1e3a8a', '#9ca3af', '#f1c27d',
    '#f4f1e6', '#f2df8a', '#f3a6b6', '#9fd3ef', '#a8e6c1', '#c9b6f2',
  ],
  inkNames: [
    'Black', 'Red', 'Blue', 'Green', 'Orange', 'Amber',
    'Lime', 'Teal', 'Sky blue', 'Indigo', 'Violet', 'Magenta',
    'Rose', 'Brown', 'Dark red', 'Navy', 'Grey', 'Skin',
    'White chalk', 'Yellow chalk', 'Pink chalk', 'Blue chalk', 'Mint', 'Lilac',
  ],
  sizes: [9, 20] as [number, number],
  head: 'CabinSketch_700Bold',
  headLight: 'CabinSketch_400Regular',
  body: 'PatrickHand_400Regular',
};
/** Colours that follow the app theme. `ink`/`soft`/`dim`/`mark` are text on the page; `boardSoft`/`boardDim` on the board. */
const ROOMS = {
  dark: {
    board: '#10153a', boardDeep: '#0b0f2a', boardSoft: '#b6bdd8', boardDim: '#7d86a6',
    // The drawing surface (Yazan 2026-11-02): the soft beige of Streak Master's boxes, dark brown text on it.
    paper: '#efe4cb', paperDeep: '#e3d4b2', paperInk: '#3b2f1c', paperSoft: '#6b5a3e',
    ink: '#f1eedf', soft: '#b6bdd8', dim: '#7d86a6', mark: '#f2df8a', alarm: '#f3a6b6',
    card: 'rgba(12,16,40,0.8)', line: 'rgba(241,238,223,0.35)', btn: '#f2df8a', btnText: '#1d2b22', onInk: '#1d2b22',
  },
};
export type Room = (typeof ROOMS)['dark'];
export const useSlateRoom = (): Room => ROOMS.dark;

export const SLATE_FONTS = ['CabinSketch_700Bold', 'CabinSketch_400Regular', 'PatrickHand_400Regular'];

/** Loads the chalk fonts once; screens render after. */
export function useSlateFonts() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    loadFonts(SLATE_FONTS).finally(() => setOk(true));
  }, []);
  return ok;
}

/** A Silent Artist page: the game header over the dark slate room. `scroll` for long pages (pick, reveal). `panel`: tablet side panel. */
export function SlateScreen({ children, scroll = false, panel }: { children: ReactNode; scroll?: boolean; panel?: ReactNode }) {
  return (
    <GameScreen scroll={scroll} panel={panel} bodyStyle={[s.body, { paddingBottom: u(14) }]}>
      {children}
    </GameScreen>
  );
}

export function Kicker({ children, color }: { children: ReactNode; color?: string }) {
  const R = useSlateRoom();
  color ??= R.soft;
  return <Text style={[s.kick, { color }]}>{typeof children === 'string' ? children.toUpperCase() : children}</Text>;
}

export function ChalkTitle({ children, size = 26, color, style, numberOfLines }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const R = useSlateRoom();
  color ??= R.ink;
  return <Text numberOfLines={numberOfLines} style={[{ fontFamily: SL.head, fontSize: u(size), lineHeight: u(size * 1.15), color }, style]}>{children}</Text>;
}

export function Note({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.note, { color: useSlateRoom().soft }, style]}>{children}</Text>;
}

/** A small slate panel with a dashed chalk border. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const R = useSlateRoom();
  return <View style={[s.panel, { backgroundColor: R.card, borderColor: R.line }, style]}>{children}</View>;
}

/**
 * The framed board sized to the space actually left (Yazan 2026-11-02): the board keeps its shape (height = width x
 * ratio) and shrinks on short screens, so the hint above and the guess box or chalk ledge below never overlap it.
 */
export function FitFrame({ ratio, maxW, children }: { ratio: number; maxW: number; children: ReactNode }) {
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  const fw = SL.frameW * 2;
  const width = area ? Math.max(0, Math.min(area.w, maxW, (area.h - fw) / ratio + fw)) : 0;
  return (
    <View style={s.fit} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {area ? <Frame style={{ width }}>{children}</Frame> : null}
    </View>
  );
}

/** The big board in its wooden frame, with the soft inner shadow of a real slate. */
export function Frame({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.frame, { backgroundColor: useSlateRoom().paper }, style]}>
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { boxShadow: 'inset 0 0 28px rgba(0,0,0,0.45)' }]} />
    </View>
  );
}

/** Chalk-yellow main button; `ghost` is the chalk-outline one. */
export function ChalkBtn({ label, onPress, ghost, disabled, style, color }: { label: string; onPress?: () => void; ghost?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; color?: string }) {
  const R = useSlateRoom();
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
  const R = useSlateRoom();
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

/**
 * ChalkTimer that follows its clock on every tick by itself (`leftAt` turns the clock's time into ms left), so the
 * screen around it redraws only when something else on it changes.
 */
export function ClockChalkTimer({ clock, leftAt, totalMs, size }: { clock: Clock; leftAt: (now: number) => number; totalMs: number; size?: number }) {
  const now = useClock(clock);
  return <ChalkTimer leftMs={leftAt(now)} totalMs={totalMs} size={size} />;
}

/** The hint ladder for the room (SA5): word count, field, then the blanks filling in. */
export function HintCard({ hint }: { hint: HintView }) {
  const ink = { color: useSlateRoom().ink };
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

/** #38/#40: the same hint in one tight strip, shown right above the guess box while the keyboard is open. */
export function HintLine({ hint }: { hint: HintView }) {
  const ink = { color: useSlateRoom().ink };
  return (
    <Panel style={{ paddingVertical: u(5), gap: u(2) }}>
      <Text style={[s.hintK, ink, { fontSize: u(12), opacity: 0.85 }]} numberOfLines={1}>
        {`${hint.words} ${hint.words === 1 ? 'word' : 'words'} · ${hint.field ?? 'Field soon'}`}
      </Text>
      <Text style={[s.mask, ink, { fontSize: u(16), textAlign: 'center' }]} numberOfLines={1} adjustsFontSizeToFit>
        {hint.mask ? hint.mask.replace(/ /g, '    ') : '· · ·'}
      </Text>
    </Panel>
  );
}

/** Chalk sticks and actions on the wooden ledge under the board; the palette opens all 24 colours above it (#11). */
export function Ledge({ ink, size, erase, onInk, onSize, onErase, onUndo, onClear }: { ink: number; size: number; erase: boolean; onInk: (i: number) => void; onSize: () => void; onErase: () => void; onUndo: () => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const tool = (key: string, on: boolean, child: ReactNode, onPress: () => void, label: string) => (
    <Pressable key={key} onPress={onPress} hitSlop={u(4)} style={[s.tool, on && { transform: [{ translateY: -u(4) }] }]} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }}>
      {child}
    </Pressable>
  );
  const word = (t: string, on = false) => <Text style={[s.toolT, on && { color: SL.yellow }]}>{t}</Text>;
  const pick = (i: number) => {
    onInk(i);
    setOpen(false);
  };
  const extra = !erase && ink >= QUICK;
  return (
    <View style={{ zIndex: 10 }}>
      {open ? (
        <View style={s.paletteWrap} pointerEvents="box-none">
          <View style={s.palette}>
            {SL.inks.map((c, i) => (
              <Pressable key={c} onPress={() => pick(i)} style={[s.swatch, { backgroundColor: c }, !erase && ink === i ? s.swatchOn : null]} accessibilityRole="button" accessibilityLabel={SL.inkNames[i]} accessibilityState={{ selected: !erase && ink === i }} />
            ))}
          </View>
        </View>
      ) : null}
      <View style={s.ledge}>
        {SL.inks.slice(0, QUICK).map((c, i) => tool(`i${i}`, !erase && ink === i, <View style={[s.stick, { backgroundColor: c, opacity: !erase && ink === i ? 1 : 0.72 }, !erase && ink === i ? s.swatchOn : null]} />, () => pick(i), SL.inkNames[i]))}
        {tool(
          'palette',
          extra || open,
          <View style={[s.wheel, extra ? { backgroundColor: SL.inks[ink] } : null]}>
            {extra ? null : PALETTE_DOTS.map((c) => <View key={c} style={[s.wheelDot, { backgroundColor: c }]} />)}
          </View>,
          () => setOpen(!open),
          'All colours',
        )}
        <View style={s.sep} />
        {tool('size', false, word(size ? 'Thick' : 'Thin'), onSize, 'Line size')}
        {tool('erase', erase, word('Erase', erase), onErase, 'Eraser')}
        {tool('undo', false, word('Undo'), onUndo, 'Undo')}
        {tool('clear', false, word('Clear'), onClear, 'Clear the board')}
      </View>
    </View>
  );
}
const QUICK = 4;
/** Palette box width, height, gap and padding. */
const SW = 34;
const SH = 26;
const SG = 6;
const SP = 8;
const PALETTE_DOTS = ['#ef4444', '#f5b82e', '#22c55e', '#3b82f6'];

/** "Hold to peek": the performer sees the disease again only while holding. */
export function Peek({ word }: { word: string }) {
  const [on, setOn] = useState(false);
  const R = useSlateRoom();
  return (
    <Pressable onPressIn={() => setOn(true)} onPressOut={() => setOn(false)} style={[s.peek, { borderColor: R.line }]} accessibilityRole="button" accessibilityLabel="Hold to see the word">
      <Text style={[s.peekT, { color: on ? R.mark : R.soft }]} numberOfLines={1} adjustsFontSizeToFit>
        {on ? word : 'Hold to peek'}
      </Text>
    </Pressable>
  );
}

/** The chalk-outlined pause button that sits by the timer. */
export function PauseBtn({ onPress, small }: { onPress: () => void; small?: boolean }) {
  const R = useSlateRoom();
  return (
    <Pressable onPress={onPress} hitSlop={u(8)} style={[s.pause, small && s.pauseSmall, { borderColor: R.line }]} accessibilityRole="button" accessibilityLabel="Pause">
      <Text style={[s.pauseT, small && { fontSize: u(9) }, { color: R.ink }]}>❚❚</Text>
    </Pressable>
  );
}

/** Page top: a small chalk kicker, the big line (a name, "Who got it?"), and the timer or pause on the right. */
export function TopRow({ kicker, title, color, right, small }: { kicker: string; title: string; color?: string; right?: ReactNode; small?: boolean }) {
  return (
    <View style={s.top}>
      <View style={{ flex: 1, gap: u(2), minWidth: 0 }}>
        <Kicker>{kicker}</Kicker>
        {/* small: one line in online play, so the board gets the room (Yazan 2026-11-02). */}
        <ChalkTitle size={small ? 13 : 22} color={color} style={{ lineHeight: u(small ? 17 : 26) }} numberOfLines={small ? 1 : undefined}>
          {title}
        </ChalkTitle>
      </View>
      {right ? <View style={s.topRight}>{right}</View> : null}
    </View>
  );
}

/** A chalk chip: fields in Solo, players on "Who got it?". `on` fills it with chalk. */
export function ChalkChip({ label, on, dot, onPress, big, small }: { label: string; on?: boolean; dot?: string; onPress: () => void; big?: boolean; small?: boolean }) {
  const R = useSlateRoom();
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
  const R = useSlateRoom();
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
  const R = useSlateRoom();
  return (
    <View style={[StyleSheet.absoluteFill, s.cover, { backgroundColor: R.paperDeep }]}>
      <ChalkTitle size={24} color={R.paperSoft}>
        Paused
      </ChalkTitle>
    </View>
  );
}

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
  // #17/#38 (Yazan 2026-11-01): the ledge colours are boxes like the grid's.
  stick: { width: u(24), height: u(18), borderRadius: u(3), borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)', boxShadow: '0 1px 1px rgba(0,0,0,0.4)' },
  wheel: { width: u(18), height: u(18), borderRadius: u(9), flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden', borderWidth: 1.5, borderColor: SL.chalk },
  wheelDot: { width: '50%', height: '50%' },
  // #17/#38 (Yazan 2026-11-01): 24 fixed boxes, 6 a row, in a panel sized to them (a % width with aspectRatio
  // collapsed into thin lines on Android).
  paletteWrap: { position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: u(6), alignItems: 'center' },
  palette: { width: u(SW * 6 + SG * 5 + SP * 2), flexDirection: 'row', flexWrap: 'wrap', gap: u(SG), padding: u(SP), backgroundColor: SL.frameDark, borderRadius: u(6), boxShadow: '0 4px 12px rgba(0,0,0,0.45)' },
  swatch: { width: u(SW), height: u(SH), borderRadius: u(4), borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)' },
  swatchOn: { borderWidth: 2.5, borderColor: SL.chalk },
  toolT: { fontFamily: SL.body, fontSize: u(12), color: SL.chalk },
  sep: { width: 1, height: u(18), backgroundColor: 'rgba(0,0,0,0.25)' },
  peek: { flex: 1.15, justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: u(10), paddingVertical: u(10), paddingHorizontal: u(10) },
  pause: { width: u(34), height: u(34), borderRadius: u(17), borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  pauseSmall: { width: u(22), height: u(22), borderRadius: u(11) },
  pauseT: { fontFamily: SL.body, fontSize: u(11) },
  fit: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: u(90) },
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
