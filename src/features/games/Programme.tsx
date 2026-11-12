import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { Fade } from '@/components/Fade';
import { Screen } from '@/components/Screen';
import { NemesisButton } from '@/bots/NemesisButton';
import { type Game, GAMES } from '@/data/games';
import { ChestButton } from '@/features/chests/ChestButton';
import { DailyButton } from '@/features/daily/DailyButton';
import { InboxButton } from '@/features/inbox/InboxButton';
import { useLoading } from '@/features/loading/store';
import { sfx } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { TABLET, u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { useGamesFocus } from './focus';
import { openGames } from './gate';
import { GameTagSheet } from './GameTag';

/** A wide strip cut from each game's poster (assets/games/full, the band around 38% down). */
const STRIP: Record<string, number> = {
  'the-diagnostic-pursuit': require('@/assets/games/strips/the-diagnostic-pursuit.webp'),
  'the-silent-artist': require('@/assets/games/strips/the-silent-artist.webp'),
  'nova-crossword': require('@/assets/games/strips/nova-crossword.webp'),
  'the-quiz-parade': require('@/assets/games/strips/the-quiz-parade.webp'),
  'the-riddler': require('@/assets/games/strips/the-riddler.webp'),
  'nova-medicordle': require('@/assets/games/strips/nova-medicordle.webp'),
  'the-streak-master': require('@/assets/games/strips/the-streak-master.webp'),
  'case-files-unsolved': require('@/assets/games/strips/case-files-unsolved.webp'),
  'the-wheels-of-chaos': require('@/assets/games/strips/the-wheels-of-chaos.webp'),
  imposter: require('@/assets/games/strips/imposter.webp'),
  'tilt-and-tell': require('@/assets/games/strips/tilt-and-tell.webp'),
};

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen'];
const COUNT = WORDS[GAMES.length] ?? String(GAMES.length);
const num = (j: number) => String(j + 1).padStart(2, '0');

// Phone strip geometry, design px (preview C).
const ROW_H = 70;
const ROW_GAP = 8;
const SET_H = GAMES.length * (ROW_H + ROW_GAP);
/** One full turn of the list: the preview's 34 s for ten games, kept at the same speed as the list grows. */
const TURN_MS = Math.round((34000 * GAMES.length) / 10);

/**
 * The Games entrance page, "The programme" (option C, Yazan 2026-11-11): every game as a numbered strip, like a show's
 * running order. On a phone the list rolls slowly upward and no game can be tapped: the one Start opens the swipe pages.
 * On an Android tablet (Yazan 2026-11-12) all of them fit at once, standing still, and a tap on one opens that game.
 */
export function Programme() {
  return TABLET ? <TabletProgramme /> : <PhoneProgramme />;
}

function Side() {
  return (
    <>
      <InboxButton />
      <DailyButton />
      <ChestButton />
      <NemesisButton />
    </>
  );
}

function Head({ end }: { end: string }) {
  const t = useTheme();
  return (
    <View style={s.head}>
      <Text style={[s.k, { color: t.accent }]}>TONIGHT ON THE WARD</Text>
      <Text style={[s.h, { color: t.white }]}>
        {`${COUNT} games, `}
        <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{end}</Text>
      </Text>
    </View>
  );
}

/** Number, name and sub name over the poster strip, the poster dimmed from the left so the words stay readable. */
function StripBody({ g, j, big }: { g: Game; j: number; big?: boolean }) {
  const t = useTheme();
  return (
    <>
      <Image source={STRIP[g.key]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={big ? 'right center' : 'center'} transition={0} cachePolicy="memory-disk" accessible={false} />
      <LinearGradient colors={['rgba(13,23,56,0.95)', 'rgba(13,23,56,0.35)', 'rgba(13,23,56,0.1)']} locations={[0.3, 0.75, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <Text style={[s.n, big && s.nBig, { color: t.accent }]}>{num(j)}</Text>
      <View style={[s.rt, big && s.rtBig]}>
        <Text style={[s.name, big && s.nameBig, { color: t.white }]} numberOfLines={1}>
          {`${g.lead} `}
          <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{g.em}</Text>
        </Text>
        <Text style={[s.sub, big && s.subBig, { color: t.soft }]} numberOfLines={1}>
          {g.sub.toUpperCase()}
        </Text>
        {big ? (
          <Text style={[s.desc, { color: '#c9cde8' }]} numberOfLines={2}>
            {g.desc}
          </Text>
        ) : null}
      </View>
    </>
  );
}

function PhoneProgramme() {
  const t = useTheme();
  const y = useSharedValue(0);
  const ring = useSharedValue(0);
  useEffect(() => {
    y.set(withRepeat(withTiming(-u(SET_H), { duration: TURN_MS, easing: Easing.linear }), -1, false));
    ring.set(withRepeat(withSequence(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })), -1, false));
    return () => {
      cancelAnimation(y);
      cancelAnimation(ring);
    };
  }, [y, ring]);
  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const pulse = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - ring.value), transform: [{ scaleX: 0.96 + 0.12 * ring.value }, { scaleY: 0.96 + 0.4 * ring.value }] }));
  const start = () => {
    void sfx('tap');
    openGames();
  };
  return (
    <Screen tab="games" glow={0}>
      <View style={s.fill}>
        <Head end="one Start" />
        {/* the list is drawn twice, so when the first copy has rolled out of sight the second is in its place */}
        {/* A real mask, not the still veil: the veil's flat page colour drew lines against the shaded backdrop. */}
        <Fade stops={[[0, 0], [0.08, 1], [0.72, 1], [0.94, 0], [1, 0]]} style={s.reel}>
          <View style={s.reelIn} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Animated.View style={roll}>
              {[0, 1].map((c) =>
                GAMES.map((g, j) => (
                  <View key={`${c}${g.key}`} style={[s.row, { borderColor: t.panelLine }]}>
                    <StripBody g={g} j={j} />
                  </View>
                )),
              )}
            </Animated.View>
          </View>
        </Fade>
        <View style={s.startBox}>
          <Animated.View pointerEvents="none" style={[s.startRing, { borderColor: 'rgba(111,214,255,0.5)' }, pulse]} />
          <Pressable onPress={start} accessibilityRole="button" accessibilityLabel="Start" style={s.startTap}>
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.start}>
              <Text style={[s.startT, { color: t.onGrad }]}>Start</Text>
            </LinearGradient>
          </Pressable>
        </View>
        <Side />
      </View>
      <GameTagSheet />
    </Screen>
  );
}

function TabletStrip({ g, j }: { g: Game; j: number }) {
  const t = useTheme();
  const box = useRef<View>(null);
  const [down, setDown] = useState(false);
  const go = () => {
    void sfx('tap');
    // "Back to games" after a round shows this game's place in the list.
    useGamesFocus.setState((st) => ({ j, n: st.n + 1 }));
    const b = box.current;
    if (!b) return useLoading.getState().start(g.key, 0);
    b.measureInWindow((_x, top, _w, h) => useLoading.getState().start(g.key, top + h / 2));
  };
  return (
    <Pressable
      ref={box}
      onPress={go}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      accessibilityRole="button"
      accessibilityLabel={`Play ${g.lead} ${g.em}`}
      style={[s.row, s.tRow, { borderColor: down ? t.accent : t.panelLine, transform: [{ scale: down ? 0.98 : 1 }] }]}>
      <StripBody g={g} j={j} />
    </Pressable>
  );
}

function TabletProgramme() {
  return (
    <Screen tab="games" glow={0} wide>
      <View style={s.fill}>
        <Head end="tap one to play" />
        {/* rows of two; an odd last game sits alone on the left */}
        <View style={s.tGrid}>
          {Array.from({ length: Math.ceil(GAMES.length / 2) }, (_, r) => (
            <View key={r} style={s.tLine}>
              {[0, 1].map((c) => {
                const j = r * 2 + c;
                const g = GAMES[j];
                return g ? <TabletStrip key={g.key} g={g} j={j} /> : <View key={c} style={s.tGap} />;
              })}
            </View>
          ))}
        </View>
        <Side />
      </View>
      <GameTagSheet />
    </Screen>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  head: { paddingTop: u(10), paddingLeft: u(16), paddingRight: u(44), paddingBottom: u(8), gap: u(2) },
  k: { fontFamily: F.mono, fontSize: u(9), lineHeight: u(12), letterSpacing: u(1.44) },
  h: { fontFamily: F.display, fontSize: u(24), lineHeight: u(26), letterSpacing: u(-0.4) },
  reel: { position: 'absolute', top: u(74), left: 0, right: 0, bottom: u(66) },
  reelIn: { flex: 1, overflow: 'hidden', paddingLeft: u(14), paddingRight: u(42) },
  row: { height: u(ROW_H), marginBottom: u(ROW_GAP), borderRadius: u(12), borderWidth: 1, overflow: 'hidden', justifyContent: 'center', backgroundColor: '#0b1331' },
  n: { position: 'absolute', left: u(10), fontFamily: F.mono, fontSize: u(13), lineHeight: u(16) },
  nBig: { left: u(14), top: u(14), fontSize: u(15), lineHeight: u(18) },
  rt: { paddingLeft: u(40), paddingRight: u(10), gap: u(2) },
  rtBig: { paddingLeft: u(14), paddingTop: u(36), paddingRight: u(12), gap: u(3) },
  name: { fontFamily: F.display, fontSize: u(15), lineHeight: u(18) },
  nameBig: { fontSize: u(18), lineHeight: u(21) },
  sub: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(11), letterSpacing: u(0.85) },
  subBig: { fontSize: u(8.5), lineHeight: u(11) },
  desc: { marginTop: u(3), marginRight: u(58), fontFamily: F.body, fontSize: u(10.5), lineHeight: u(14) },
  startBox: { position: 'absolute', left: u(22), right: u(22), bottom: u(14), height: u(44) },
  startRing: { position: 'absolute', left: -u(6), right: -u(6), top: -u(6), bottom: -u(6), borderRadius: u(28), borderWidth: u(1.5) },
  startTap: { flex: 1, borderRadius: u(22), overflow: 'hidden' },
  start: { flex: 1, borderRadius: u(22), alignItems: 'center', justifyContent: 'center' },
  startT: { fontFamily: F.display, fontSize: u(16), lineHeight: u(20) },
  // tablet (Yazan 2026-11-12): the phone's own strips, two to a row, each one a button
  tGrid: { gap: u(ROW_GAP), paddingLeft: u(16), paddingRight: u(52), paddingTop: u(6) },
  tLine: { flexDirection: 'row', gap: u(10) },
  tGap: { flex: 1 },
  tRow: { flex: 1, minWidth: 0, marginBottom: 0 },
});
