import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { create } from 'zustand';

import { Text } from '@/components/AppText';
import { Fade } from '@/components/Fade';
import { Sheet } from '@/components/Sheet';
import { type Game } from '@/data/games';
import { useLoading } from '@/features/loading/store';
import { sfx } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { LISTED, useGamesFocus } from './focus';
import { knowOf, openKnowSheet, openTagSheet, tagOf } from './GameTag';
import { STRIP } from './strips';
import { isAr, tr } from '@/i18n';

const FLIP = { transform: [{ scaleX: -1 }] };


/** One strip and its gap, design px. */
const STEP = 78;
/** The strip's own navy, the colour the art fades into. */
const BG = '#0b1331';
const alpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

const useInfo = create<{ j: number | null }>(() => ({ j: null }));

/** Tap a box: the game's loading page, its bar starting from the box. */
function useOpen(g: Game, j: number) {
  const box = useRef<View>(null);
  const go = () => {
    void sfx('tap');
    useGamesFocus.setState((st) => ({ j, n: st.n + 1 }));
    const b = box.current;
    if (!b) return useLoading.getState().start(g.key, 0);
    b.measureInWindow((_x, top, _w, h) => useLoading.getState().start(g.key, top + h / 2));
  };
  return { box, go };
}

function Ask({ j, style }: { j: number; style: object }) {
  const t = useTheme();
  const g = LISTED[j];
  return (
    <Pressable
      onPress={() => {
        void sfx('tap');
        useInfo.setState({ j });
      }}
      hitSlop={u(8)}
      style={[s.ask, { borderColor: alpha(t.accent, 0.55) }, style]}
      accessibilityRole="button"
      accessibilityLabel={tr('What is {lead} {em}?', { lead: g.lead, em: g.em })}>
      <Text style={[s.askT, { color: t.accent }]}>?</Text>
    </Pressable>
  );
}

/** The game's two tags side by side: what it is for, and what it asks about (Yazan 2026-11-17). Tap one for what it means. */
function Tag({ game, small }: { game: string; small?: boolean }) {
  const tag = tagOf(game);
  const know = knowOf(game);
  if (!tag && !know) return null;
  return (
    <View style={s.tags}>
      {tag ? (
        <Pressable onPress={() => openTagSheet(game)} hitSlop={u(6)} style={[s.tag, small ? s.tagS : null, { borderColor: alpha(tag.color, 0.45), backgroundColor: alpha(tag.color, 0.14) }]} accessibilityRole="button" accessibilityLabel={tr('{label}: what this means', { label: tag.label })}>
          <Text style={[s.tagT, small ? s.tagTS : null, { color: tag.color }]}>{tag.label}</Text>
        </Pressable>
      ) : null}
      {know ? (
        <Pressable onPress={() => openKnowSheet(game)} hitSlop={u(6)} style={[s.tag, small ? s.tagS : null, { borderColor: alpha(know.color, 0.45), backgroundColor: alpha(know.color, 0.14) }]} accessibilityRole="button" accessibilityLabel={tr('{label}: what this means', { label: know.label })}>
          <Text style={[s.tagT, small ? s.tagTS : null, { color: know.color }]}>{know.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Look C: the programme's strip (2026-11-11, numbers dropped 2026-11-13), standing still, each one a button. */
export function Strip({ g, j, onTop }: { g: Game; j: number; onTop: (j: number, y: number) => void }) {
  const t = useTheme();
  const { box, go } = useOpen(g, j);
  const [down, setDown] = useState(false);
  // Where the name ends: the art is veiled up to just past it, so a long name never sits on the drawing.
  const [end, setEnd] = useState(0);
  const stripW = useRef(0);
  const veil = end + u(56);
  return (
    <Pressable ref={box} onPress={go} onPressIn={() => setDown(true)} onPressOut={() => setDown(false)} accessibilityRole="button" accessibilityLabel={tr('Play {lead} {em}', { lead: g.lead, em: g.em })}
      onLayout={(e) => { stripW.current = e.nativeEvent.layout.width; onTop(j, e.nativeEvent.layout.y); }}
      style={[s.strip, { borderColor: down ? t.accent : t.panelLine, transform: [{ scale: down ? 0.98 : 1 }] }]}>
      {/* The art fades in from clear (baked into each picture, Yazan 2026-11-13), so the drawing never runs under the name. */}
      {/* In Arabic the strip mirrors: the art (and its baked fade) flips to the left, the veil runs from the right. */}
      <Image source={STRIP[g.key]} style={[s.stripArt, isAr && FLIP]} contentFit="cover" contentPosition="center" transition={0} cachePolicy="memory-disk" accessible={false} />
      {end ? <LinearGradient colors={[BG, BG, alpha(BG, 0)]} locations={[0, (end + u(10)) / veil, 1]} start={{ x: isAr ? 1 : 0, y: 0.5 }} end={{ x: isAr ? 0 : 1, y: 0.5 }} style={[s.veil, { width: veil }]} /> : null}
      <View style={s.stripTxt} onLayout={(e) => setEnd(isAr ? stripW.current - e.nativeEvent.layout.x : e.nativeEvent.layout.x + e.nativeEvent.layout.width)}>
        {/* The game's tag above its name (Yazan 2026-11-13); tap it for what it means. */}
        <Tag game={g.key} small />
        <Text style={[s.name, { color: t.white }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {g.lead ? `${g.lead} ` : ''}
          <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{g.em}</Text>
        </Text>
        <Text style={[s.sub, { color: t.soft }]} numberOfLines={1}>{g.sub.toUpperCase()}</Text>
      </View>
      <Ask j={j} style={s.askC} />
    </Pressable>
  );
}

/** Look C (Yazan 2026-11-13): the programme's strips in a still list. "Back to games" scrolls to the game just played. */
export function GameList({ top }: { top: number }) {
  const list = useRef<ScrollView>(null);
  const focus = useGamesFocus((f) => f.n);
  // Where each strip really starts: a strip grows when a phone draws its text taller, so steps aren't fixed.
  const tops = useRef<number[]>([]);
  const onTop = useCallback((j: number, y: number) => { tops.current[j] = y; }, []);
  useEffect(() => {
    const j = Math.max(0, useGamesFocus.getState().j - 1);
    list.current?.scrollTo({ y: tops.current[j] ?? j * u(STEP), animated: false });
  }, [focus]);
  return (
    // veil, not a mask (2026-11-15, lag): a mask over the scrolling list redraws all 13 strips through an extra layer.
    // Softer, longer edges (Yazan 2026-11-16, option A): cards dissolve into the page under the title and above the bar.
    <Fade veil stops={[[0, 0], [0.06, 1], [0.86, 1], [1, 0]]} style={[s.list, { top }]}>
      <ScrollView ref={list} style={s.fill} contentContainerStyle={s.inC} showsVerticalScrollIndicator={false}>
        {LISTED.map((g, j) => <Strip key={g.key} g={g} j={j} onTop={onTop} />)}
      </ScrollView>
    </Fade>
  );
}

/** The ? pop-up: what the game is, its tag, and Play. */
export function GameInfoSheet() {
  const t = useTheme();
  const j = useInfo((x) => x.j);
  const g = j == null ? null : LISTED[j];
  const close = () => useInfo.setState({ j: null });
  return (
    <Sheet open={!!g} onClose={close}>
      {g ? (
        <View style={s.body}>
          <Text style={[s.sheetT, { color: t.white }]}>
            {g.lead ? `${g.lead} ` : ''}
            <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{g.em}</Text>
          </Text>
          <Tag game={g.key} />
          {/* What the game is, in plain words; the per-mode steps are on the mode page's ? (Yazan 2026-11-22). */}
          <Text style={[s.p, { color: t.soft }]}>{g.about ?? g.desc}</Text>
          <Pressable
            onPress={() => {
              close();
              useGamesFocus.setState((st) => ({ j: j!, n: st.n + 1 }));
              useLoading.getState().start(g.key, 0);
            }}
            accessibilityRole="button"
            style={s.playTap}>
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.play}>
              <Text style={[s.playT, { color: t.onGrad }]}>{tr('Play')}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  list: { position: 'absolute', start: 0, end: 0, bottom: 0 },
  fill: { flex: 1 },
  inC: { paddingHorizontal: u(14), paddingTop: u(6), paddingBottom: u(40), gap: u(8) },
  // minHeight, not height (2026-11-17): a phone that draws the name taller (Galaxy S9+ in Arabic) grows the strip
  // instead of cutting the tag off at the top.
  strip: { minHeight: u(70), paddingVertical: u(6), borderRadius: u(12), borderWidth: 1, overflow: 'hidden', justifyContent: 'center', backgroundColor: BG },
  stripArt: { position: 'absolute', top: 0, bottom: 0, end: 0, width: '80%' },
  stripTxt: { alignSelf: 'flex-start', maxWidth: '84%', marginStart: u(14), gap: u(2) },
  veil: { position: 'absolute', top: 0, bottom: 0, start: 0 },
  name: { fontFamily: F.display, fontSize: u(15), lineHeight: u(18) },
  sub: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(11), letterSpacing: u(0.85) },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: u(5), alignSelf: 'flex-start' },
  tag: { alignSelf: 'flex-start', marginTop: u(3), borderWidth: 1, borderRadius: u(7), paddingVertical: u(2), paddingHorizontal: u(7) },
  // Card tags 20% smaller, box and words (Yazan 2026-11-22).
  tagS: { marginTop: 0, marginBottom: u(1), paddingVertical: u(1 * 0.8), paddingHorizontal: u(6 * 0.8), borderRadius: u(6 * 0.8) },
  tagTS: { fontSize: u(7 * 0.8), lineHeight: u(9 * 0.8), letterSpacing: u(0.4) },
  tagT: { fontFamily: F.bodyBold, fontSize: u(8), lineHeight: u(10), letterSpacing: u(0.5), textTransform: 'uppercase' },
  ask: { position: 'absolute', width: u(26), height: u(26), borderRadius: u(13), borderWidth: 1, backgroundColor: 'rgba(8,16,41,0.75)', alignItems: 'center', justifyContent: 'center' },
  askT: { fontFamily: F.display, fontSize: u(14), lineHeight: u(17) },
  askC: { end: u(8), bottom: u(8) },
  body: { gap: u(8), paddingTop: u(2) },
  sheetT: { fontFamily: F.display, fontSize: u(21), lineHeight: u(25) },
  p: { fontFamily: F.body, fontSize: u(12), lineHeight: u(17) },
  playTap: { marginTop: u(6), height: u(42), borderRadius: u(21), overflow: 'hidden' },
  play: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playT: { fontFamily: F.display, fontSize: u(15), lineHeight: u(19) },
});
