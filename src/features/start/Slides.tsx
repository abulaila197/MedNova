import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Image as SvgImage, LinearGradient as SvgLinear, Mask, RadialGradient, Rect, Stop } from 'react-native-svg';

import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { cssAngle } from './ease';
import { NAVY, Sky, Stars } from './Sky';

// Onboarding is always dark (Nebula). Colours from the prototype (ob.html).
const FG = '#eef0ff';
const ACCENT = '#6fd6ff';
const CYAN = '#4fc8ff';
const VIOLET = '#8f75ff';
const ROSE = '#ff7aa8';
const BODY = '#d5d8f0';
const BAR = '#c3c7e4';

const IMG_RATIO = 1376 / 768;

type Stop3 = [number, number]; // [offset 0..1, opacity of #070a1c]
type SceneDef = {
  src: number;
  /** background-size in cqw (width of the content box / 100) */
  size: number;
  /** background-position: lengths in cqw / cqh, or null for "50% 100%" */
  pos: [number, number] | null;
  /** the scene::after veil over the photo */
  veil: Stop3[];
  /** which photo edge needs a soft fade (the prototype leaves a hard edge there) */
  fade: 'top' | null;
  /** extra horizontal shift in design px that centres the artwork and makes the photo cover the full width */
  shift?: number;
};

const SCENES: SceneDef[] = [
  {
    src: require('@/assets/onboarding/games.jpg'),
    size: 186,
    pos: [-76, -15],
    veil: [[0, 1], [0.3, 1], [0.46, 0], [0.8, 0], [0.96, 1]],
    fade: null,
    shift: 24,
  },
  {
    src: require('@/assets/onboarding/learning-space.jpg'),
    size: 174,
    pos: [-63.5, -61],
    veil: [[0, 0.6], [0.12, 0], [0.54, 0], [0.7, 1]],
    fade: null,
    shift: 16,
  },
  {
    src: require('@/assets/onboarding/nova-community.jpg'),
    size: 118,
    pos: null,
    veil: [[0, 1], [0.08, 1], [0.3, 0], [0.7, 0], [1, 0.75]],
    fade: 'top',
  },
];

/** Full-bleed illustrated scene of a slide, positioned exactly like the CSS background (cq units of the padded box). */
function Scene({ si, w, h, padTop, padBottom }: { si: number; w: number; h: number; padTop: number; padBottom: number }) {
  const d = SCENES[si];
  const cw = (w - u(36)) / 100;
  const ch = (h - padTop - padBottom) / 100;
  const iw = d.size * cw;
  const ih = iw * IMG_RATIO;
  const x = (d.pos ? d.pos[0] * cw : (w - iw) * 0.5) + u(d.shift ?? 0);
  const y = d.pos ? d.pos[1] * ch : h - ih;
  const id = `ob${si}`;
  const soft = u(26);
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {d.fade === 'top' ? (
          <>
            <SvgLinear id={`${id}e`} gradientUnits="userSpaceOnUse" x1={0} y1={y} x2={0} y2={y + soft * 1.4}>
              <Stop offset={0} stopColor="#fff" stopOpacity={0} />
              <Stop offset={1} stopColor="#fff" stopOpacity={1} />
            </SvgLinear>
            <Mask id={`${id}m`} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
              <Rect x={0} y={0} width={w} height={h} fill={`url(#${id}e)`} />
            </Mask>
          </>
        ) : null}
        <SvgLinear id={`${id}v`} x1={0} y1={0} x2={0} y2={1}>
          {d.veil.map(([o, a], i) => (
            <Stop key={i} offset={o} stopColor={NAVY} stopOpacity={a} />
          ))}
        </SvgLinear>
      </Defs>
      <SvgImage href={d.src} x={x} y={y} width={iw} height={ih} preserveAspectRatio="none" mask={d.fade ? `url(#${id}m)` : undefined} />
      <Rect x={0} y={0} width={w} height={h} fill={`url(#${id}v)`} />
    </Svg>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barTxt: { fontFamily: F.mono, fontSize: u(9.5), lineHeight: u(13), letterSpacing: u(1.71), color: BAR, textTransform: 'uppercase' },
  copy: { gap: u(8) },
  p: { fontFamily: F.body, fontSize: u(12), lineHeight: u(17.4), color: BODY },
  dots: { flexDirection: 'row', gap: u(6) },
  dot: { width: u(6), height: u(6), borderRadius: u(6), backgroundColor: 'rgba(255,255,255,0.3)' },
  cta: {
    height: u(52),
    borderRadius: u(18),
    borderWidth: 1,
    paddingHorizontal: u(18),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'visible',
  },
  ctaTxt: { fontFamily: F.bodySemi, fontSize: u(13.5) },
  arr: { fontFamily: F.display, fontSize: u(20), lineHeight: u(20) },
});

function Dots({ on }: { on: number }) {
  return (
    <View style={st.dots}>
      {[0, 1, 2].map((i) =>
        i === on ? (
          <LinearGradient key={i} colors={[VIOLET, CYAN]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[st.dot, { width: u(24) }]} />
        ) : (
          <View key={i} style={st.dot} />
        ),
      )}
    </View>
  );
}

const LIVE = cssAngle(100, 246, 52);

function Cta({ live, onPress }: { live: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        st.cta,
        live
          ? { borderColor: 'transparent', boxShadow: `0px ${u(14)}px ${u(34)}px ${u(-10)}px rgba(120,140,255,0.95)` }
          : { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(7,10,28,0.55)' },
      ]}>
      {live ? <LinearGradient colors={['#a48bff', '#6fd6ff']} start={LIVE.start} end={LIVE.end} style={[StyleSheet.absoluteFill, { borderRadius: u(18) }]} /> : null}
      <Text style={[st.ctaTxt, { color: live ? '#0b0b26' : 'rgba(238,240,255,0.35)' }]}>Get Started</Text>
      <Text style={[st.arr, { color: live ? '#0b0b26' : 'rgba(238,240,255,0.35)' }]}>→</Text>
    </Pressable>
  );
}

function Skip({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={u(12)} accessibilityRole="button" accessibilityLabel="Skip">
      <Text style={st.barTxt}>Skip</Text>
    </Pressable>
  );
}

/** Glass band behind the centred copy of slide 3 (copy::before, radial closest-side). */
function Band() {
  return (
    <Svg width={u(326)} height={u(261)} style={{ position: 'absolute', left: u(-40), top: u(-50) }} pointerEvents="none">
      <Defs>
        <RadialGradient id="obBand" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset={0} stopColor={NAVY} stopOpacity={0.82} />
          <Stop offset={0.6} stopColor={NAVY} stopOpacity={0.5} />
          <Stop offset={1} stopColor={NAVY} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={u(326)} height={u(261)} fill="url(#obBand)" />
    </Svg>
  );
}

export type SlideProps = {
  si: number;
  w: number;
  h: number;
  padTop: number;
  padBottom: number;
  onNext: () => void;
  onSkip: () => void;
};

function Frame({ si, w, h, padTop, padBottom, children }: Omit<SlideProps, 'onNext' | 'onSkip'> & { children: ReactNode }) {
  const hd = h / u(1);
  return (
    <View style={{ width: w, height: h, overflow: 'hidden', backgroundColor: NAVY }}>
      <Sky w={w} h={h} />
      <Scene si={si} w={w} h={h} padTop={padTop} padBottom={padBottom} />
      <Stars si={si} hd={hd} />
      <View style={{ flex: 1, paddingTop: padTop, paddingBottom: padBottom, paddingHorizontal: u(18), gap: u(14) }}>{children}</View>
    </View>
  );
}

/** 01 / Eight games: scene on top, copy at the top-left. */
export function SlideGames(p: SlideProps) {
  return (
    <Frame {...p}>
      <View style={st.bar}>
        <Text style={[st.barTxt, { color: CYAN }]}>01 / Eight games</Text>
        <Skip onPress={p.onSkip} />
      </View>
      <View style={st.copy}>
        <View>
          <Text style={{ fontFamily: F.display, fontSize: u(76), lineHeight: u(60.8), letterSpacing: u(-2.28), color: FG }}>Play</Text>
          <Text
            style={{ fontFamily: F.displayItalic, fontSize: u(34), lineHeight: u(34), letterSpacing: u(-2.28), color: ACCENT, textAlign: 'center', marginTop: u(10) }}>
            the case
          </Text>
        </View>
        <Text style={[st.p, { maxWidth: u(208) }]}>Hunt the diagnosis like a detective, solo or online against friends.</Text>
      </View>
      <View style={{ flex: 1 }} />
      <Dots on={0} />
      <Cta live={false} onPress={p.onNext} />
    </Frame>
  );
}

/** 02 / Learning Space: copy at the bottom-left, scene rising behind. */
export function SlideLearn(p: SlideProps) {
  return (
    <Frame {...p}>
      <View style={st.bar}>
        <Skip onPress={p.onSkip} />
        <Text style={[st.barTxt, { color: CYAN }]}>02 / Learning Space</Text>
      </View>
      <View style={{ flex: 1 }} />
      <View style={st.copy}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ fontFamily: F.display, fontSize: u(44), lineHeight: u(38.72), letterSpacing: u(-1.32), color: FG }}>{'Every '}</Text>
            <View>
              <Text style={{ fontFamily: F.displayItalic, fontSize: u(44), lineHeight: u(38.72), letterSpacing: u(-1.32), color: ROSE }}>miss</Text>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: u(-3),
                  right: u(-3),
                  top: u(21.16),
                  height: u(2),
                  backgroundColor: ROSE,
                  transform: [{ rotate: '-6deg' }],
                  boxShadow: `0px 0px ${u(10)}px ${ROSE}`,
                }}
              />
            </View>
          </View>
          <Text style={{ fontFamily: F.displayItalic, fontSize: u(54), lineHeight: u(47.52), letterSpacing: u(-1.32), color: ACCENT }}>{'becomes\na star'}</Text>
        </View>
        <Text style={[st.p, { maxWidth: u(208) }]}>Every disease or term you get wrong lands in your dossier, ready to review.</Text>
      </View>
      <Dots on={1} />
      <Cta live={false} onPress={p.onNext} />
    </Frame>
  );
}

/** Nova Community: copy centred in a glass band at the top, full scene behind. */
export function SlideCommunity(p: SlideProps) {
  return (
    <Frame {...p}>
      <View style={[st.copy, { marginTop: u(28), alignItems: 'center' }]}>
        <Band />
        <Text style={{ fontFamily: F.mono, fontSize: u(9), lineHeight: u(12), letterSpacing: u(2.7), color: CYAN }}>NOVA COMMUNITY</Text>
        <Text style={{ fontFamily: F.display, fontSize: u(40), lineHeight: u(36), letterSpacing: u(-1.2), color: FG, textAlign: 'center' }}>
          {'Never the\nonly one\n'}
          <Text style={{ fontFamily: F.displayItalic, color: ACCENT }}>on call</Text>
        </Text>
        <Text style={[st.p, { maxWidth: u(194), textAlign: 'center' }]}>Share cases, challenge friends and read the MedNova newspaper.</Text>
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ alignItems: 'center' }}>
        <Dots on={2} />
      </View>
      <Cta live onPress={p.onNext} />
    </Frame>
  );
}

export const SLIDES = [SlideGames, SlideLearn, SlideCommunity];

/** Memoised list of the three slides laid side by side. */
export function useSlides(props: Omit<SlideProps, 'si'>) {
  const { w, h, padTop, padBottom, onNext, onSkip } = props;
  return useMemo(
    () => SLIDES.map((S, si) => <S key={si} si={si} w={w} h={h} padTop={padTop} padBottom={padBottom} onNext={onNext} onSkip={onSkip} />),
    [w, h, padTop, padBottom, onNext, onSkip],
  );
}
