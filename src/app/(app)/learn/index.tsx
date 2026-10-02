import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { interpolateColor, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { BASIC_SHELF, CLINICAL_SHELVES, DOSSIER_TOTAL, MY_CASES, REVIEW } from '@/features/learn/data';
import { Fade } from '@/features/learn/Fade';
import { FlipCard } from '@/features/learn/FlipCard';
import { useLearnColors } from '@/features/learn/palette';
import { Shelf } from '@/features/learn/Shelf';
import { PageTitle } from '@/features/learn/Title';
import { Toggle } from '@/features/learn/Toggle';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

const NAMES = ['Review', 'Dossiers', 'My cases'];
const CLINICAL_H = [132, 124, 140, 124, 132];
const BASIC_H = [142, 134];

/** Learn: three pages swiped sideways (Today's review, Disease dossiers, My cases) under a fixed row of page names. */
export default function Learn() {
  const { width: W } = useWindowDimensions();
  const x = useSharedValue(0);
  const pager = useRef<Animated.ScrollView>(null);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });
  const [H, setH] = useState(0);
  const go = (i: number) => pager.current?.scrollTo({ x: i * W, animated: true });
  return (
    <Screen tab="learn" glow={6}>
      <View style={s.wds}>
        {NAMES.map((n, i) => (
          <PageName key={n} i={i} label={n} x={x} W={W} onPress={() => go(i)} />
        ))}
      </View>
      <View style={s.pgs} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
        <Animated.ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16} style={s.flex}>
          <View style={{ width: W, height: H }}>
            <ReviewPage />
          </View>
          <View style={{ width: W, height: H }}>
            <DossiersPage />
          </View>
          <View style={{ width: W, height: H }}>
            <CasesPage />
          </View>
        </Animated.ScrollView>
      </View>
    </Screen>
  );
}

function PageName({ i, label, x, W, onPress }: { i: number; label: string; x: SharedValue<number>; W: number; onPress: () => void }) {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const on = t.fg;
  const off = c.nameOff;
  const st = useAnimatedStyle(() => ({
    color: interpolateColor(Math.min(1, Math.abs(x.value / W - i)), [0, 1], [on, off]),
  }));
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" hitSlop={u(6)}>
      <Animated.Text style={[s.name, st]}>{label}</Animated.Text>
    </Pressable>
  );
}

function ReviewPage() {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const [flipped, setFlipped] = useState(false);
  const back = () => setFlipped(false);
  return (
    <View style={[s.pg, s.flex]}>
      <PageTitle first="Today's" em="review" small={`${REVIEW.index} of ${REVIEW.total}`} />
      <View style={[s.lpg, { backgroundColor: c.track }]}>
        <View
          style={[
            s.lpgFill,
            {
              width: `${(REVIEW.index / REVIEW.total) * 100}%`,
              backgroundColor: t.accent,
            },
          ]}
        />
      </View>
      <FlipCard flipped={flipped} onPress={() => setFlipped((f) => !f)} />
      <View style={s.lrow}>
        <Pressable onPress={back} style={[s.btn, s.again, { borderColor: c.againLine }]} accessibilityRole="button">
          <Text style={[s.btnT, { color: c.againText }]}>Again</Text>
        </Pressable>
        <Pressable onPress={back} style={s.btnWrap} accessibilityRole="button">
          <LinearGradient colors={[c.gotA, c.gotB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
            <Text style={[s.btnT, { color: c.gotText }]}>Got it</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

/** A page that scrolls vertically; when its content runs past the page it fades out at the bottom, clear of the dock. */
function ScrollPage({ children }: { children: ReactNode }) {
  const [box, setBox] = useState(0);
  const [content, setContent] = useState(0);
  // Overflow of less than a row's bottom padding (12) only trims empty space, so it does not count.
  const over = box > 0 && content - u(36) > box + u(12);
  return (
    <Fade from={0.9} to={1} off={!over} style={s.flex} onLayout={(e) => setBox(e.nativeEvent.layout.height)}>
      <ScrollView nestedScrollEnabled scrollEnabled={over} showsVerticalScrollIndicator={false} onContentSizeChange={(_, h) => setContent(h)} contentContainerStyle={[s.pg, s.pgEnd]}>
        {children}
      </ScrollView>
    </Fade>
  );
}

function DossiersPage() {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const [mine, setMine] = useState(0);
  const open = () => router.push('/learn/shelf');
  return (
    <ScrollPage>
      <PageTitle first="Disease" em="dossiers" small={`${DOSSIER_TOTAL}`} />
      <View style={[s.srch, { backgroundColor: c.srchBg, borderColor: c.srchLine }]}>
        <Text style={[s.srchT, { color: c.srchText }]}>Search a disease</Text>
      </View>
      <Toggle options={[{ label: 'My misses' }, { label: 'All' }]} value={mine} onChange={setMine} />
      {CLINICAL_SHELVES.map((row, i) => (
        <Shelf key={i} spines={row} heights={CLINICAL_H} onOpen={open} />
      ))}
      <View style={s.bs}>
        <Shelf spines={BASIC_SHELF} heights={BASIC_H} onOpen={open} />
      </View>
    </ScrollPage>
  );
}

function CasesPage() {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  return (
    <ScrollPage>
      <PageTitle first="My" em="cases" small={`${MY_CASES.length}`} />
      <Pressable style={[s.newc, { borderColor: c.newcLine, backgroundColor: c.newcBg }]} accessibilityRole="button">
        <Text style={[s.newcT, { color: t.accent }]}>+ Write a new case</Text>
      </Pressable>
      <View>
        {MY_CASES.map((k, i) => (
          <View key={k.title} style={[s.cs, i < MY_CASES.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.rowLine }]}>
            <View style={s.csL}>
              <Text style={[s.csB, { color: t.fg }]}>{k.title}</Text>
              <Text style={[s.csA, { color: c.mute }]}>{k.area}</Text>
            </View>
            <Text style={[s.csE, { color: t.accent }]}>{k.state.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </ScrollPage>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  wds: {
    flexDirection: 'row',
    gap: u(16),
    paddingTop: u(14),
    paddingHorizontal: u(14),
    paddingBottom: u(6),
  },
  name: { fontFamily: F.display, fontSize: u(12), lineHeight: u(15) },
  pg: { paddingTop: u(2), paddingHorizontal: u(14), gap: u(9) },
  // The pages stop 84 design px above the dock (the reference's .pgs padding), clear of the raised Games button.
  pgs: { flex: 1, marginBottom: u(84) },
  // Scrolling pages get a little run-out so their last row can rise clear of the bottom fade.
  pgEnd: { paddingBottom: u(36) },
  lpg: { height: u(3), borderRadius: u(3), overflow: 'hidden' },
  lpgFill: { height: '100%', borderRadius: u(3) },
  lrow: { flexDirection: 'row', gap: u(7) },
  btnWrap: { flex: 1 },
  btn: {
    flex: 1,
    height: u(30),
    borderRadius: u(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  again: { borderWidth: 1 },
  btnT: { fontFamily: F.bodySemi, fontSize: u(11.5), lineHeight: u(14) },
  srch: {
    height: u(34),
    borderWidth: 1,
    borderRadius: u(12),
    paddingHorizontal: u(12),
    justifyContent: 'center',
  },
  srchT: { fontFamily: F.body, fontSize: u(11), lineHeight: u(14) },
  bs: {},
  newc: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: u(14),
    padding: u(11),
  },
  newcT: { fontFamily: F.bodySemi, fontSize: u(12), lineHeight: u(15) },
  cs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(10),
    paddingVertical: u(12),
    paddingHorizontal: u(2),
  },
  csL: { flexShrink: 1, gap: u(3) },
  csB: { fontFamily: F.display, fontSize: u(15), lineHeight: u(18) },
  csA: { fontFamily: F.body, fontSize: u(10), lineHeight: u(12) },
  csE: {
    marginLeft: 'auto',
    flexShrink: 0,
    fontFamily: F.mono,
    fontSize: u(8.5),
    lineHeight: u(12),
    letterSpacing: u(0.68),
  },
});
