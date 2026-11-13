import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, type ReactNode } from 'react';
import { type ImageStyle, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Svg, { Defs, Image as SvgImage, LinearGradient as SvgLinear, Mask, RadialGradient, Rect, Stop } from 'react-native-svg';

import { DESIGN_W, TABLET, u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { BAKED, BAKED_ART } from './baked';
import { cssAngle } from './ease';
import { NAVY, Sky, Stars } from './Sky';
import { tr, isAr } from '@/i18n';

// Onboarding is always dark (Nebula). Colours from the prototype (ob.html).
const FG = '#eef0ff';
const ACCENT = '#6fd6ff';
const CYAN = '#4fc8ff';
const VIOLET = '#8f75ff';
const ROSE = '#ff7aa8';
const BODY = '#d5d8f0';
const BAR = '#c3c7e4';

const IMG_RATIO = 1376 / 768;

/** Tablet (2026-11-12): the slides fill the whole screen, so their words and buttons are drawn a size larger. */
const Z = TABLET ? 1.3 : 1;
const z = (n: number) => u(n * Z);

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
    src: require('@/assets/onboarding/games.webp'),
    size: 186,
    pos: [-76, -15],
    veil: [[0, 1], [0.3, 1], [0.46, 0], [0.8, 0], [0.96, 1]],
    fade: null,
    shift: 24,
  },
  {
    src: require('@/assets/onboarding/learning-space.webp'),
    size: 174,
    pos: [-63.5, -61],
    veil: [[0, 0.6], [0.12, 0], [0.54, 0], [0.7, 1]],
    fade: null,
    shift: 16,
  },
  {
    src: require('@/assets/onboarding/nova-community.webp'),
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
  if (BAKED_ART) {
    // Same picture from still images: the photo (slide 3 with its top fade already in its alpha) and the veil,
    // a full-height gradient stretched to the screen.
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image source={d.fade === 'top' ? BAKED.communityFade : d.src} style={{ position: 'absolute', start: x, top: y, width: iw, height: ih }} contentFit="fill" transition={0} accessibilityIgnoresInvertColors />
        <Image source={BAKED.veils[si]} style={StyleSheet.absoluteFill} contentFit="fill" transition={0} accessibilityIgnoresInvertColors />
      </View>
    );
  }
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

/**
 * A slide's photo on a tablet: the whole picture across the full width (the phone zooms into part of it), anchored
 * where its subject sits, under the same top-to-bottom veil.
 */
const TAB_POS = ['bottom', 'top', 'bottom'] as const;
/** Slide 2's heart and book sit low in the photo: zoom in and bring them up into the clear band above the words. */
const TAB_FOCUS: (null | { zoom: number; fx: number; fy: number; tx: number; ty: number })[] = [null, { zoom: 1.5, fx: 0.62, fy: 0.65, tx: 0.55, ty: 0.36 }, null];
function TabletScene({ si, w, h }: { si: number; w: number; h: number }) {
  const d = SCENES[si];
  const tf = TAB_FOCUS[si];
  // Small phones are shorter for their width: lift slide 2's book a little higher so it clears the words.
  const f = tf && !TABLET ? { ...tf, ty: tf.ty - 0.07 } : tf;
  const src = d.fade === 'top' ? BAKED.communityFade : d.src;
  let box: ImageStyle = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 };
  if (f) {
    const iw = w * f.zoom;
    const ih = iw * IMG_RATIO;
    box = { position: 'absolute', width: iw, height: ih, left: w * f.tx - iw * f.fx, top: h * f.ty - ih * f.fy };
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={src} style={box} contentFit={f ? 'fill' : 'cover'} contentPosition={TAB_POS[si]} transition={0} accessibilityIgnoresInvertColors />
      <Image source={BAKED.veils[si]} style={StyleSheet.absoluteFill} contentFit="fill" transition={0} accessibilityIgnoresInvertColors />
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barTxt: { fontFamily: F.mono, fontSize: z(9.5), lineHeight: z(13), letterSpacing: z(1.71), color: BAR, textTransform: 'uppercase' },
  copy: { gap: z(8) },
  p: { fontFamily: F.body, fontSize: z(12), lineHeight: z(17.4), color: BODY },
  dots: { flexDirection: 'row', gap: z(6) },
  dot: { width: z(6), height: z(6), borderRadius: z(6), backgroundColor: 'rgba(255,255,255,0.3)' },
  cta: {
    // tablet: a fixed-width button in the middle instead of edge to edge
    ...(TABLET ? { alignSelf: 'center' as const, width: z(300) } : null),
    height: z(52),
    borderRadius: z(18),
    borderWidth: 1,
    paddingHorizontal: z(18),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'visible',
  },
  ctaTxt: { fontFamily: F.bodySemi, fontSize: z(13.5) },
  arr: { fontFamily: F.display, fontSize: z(20), lineHeight: z(20) },
});

function Dots({ on }: { on: number }) {
  return (
    <View style={st.dots}>
      {[0, 1, 2].map((i) =>
        i === on ? (
          <LinearGradient key={i} colors={[VIOLET, CYAN]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[st.dot, { width: z(24) }]} />
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
          ? { borderColor: 'transparent', boxShadow: `0px ${z(14)}px ${z(34)}px ${z(-10)}px rgba(120,140,255,0.95)` }
          : { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(7,10,28,0.55)' },
      ]}>
      {live ? <LinearGradient colors={['#a48bff', '#6fd6ff']} start={LIVE.start} end={LIVE.end} style={[StyleSheet.absoluteFill, { borderRadius: z(18) }]} /> : null}
      <Text style={[st.ctaTxt, { color: live ? '#0b0b26' : 'rgba(238,240,255,0.35)' }]}>{tr('Get Started')}</Text>
      <Text style={[st.arr, { color: live ? '#0b0b26' : 'rgba(238,240,255,0.35)' }]}>{isAr ? '←' : '→'}</Text>
    </Pressable>
  );
}

function Skip({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={z(12)} accessibilityRole="button" accessibilityLabel={tr('Skip')}>
      <Text style={st.barTxt}>{tr('Skip')}</Text>
    </Pressable>
  );
}

/** Glass band behind the centred copy of slide 3 (copy::before, radial closest-side). */
function Band() {
  return (
    <Svg width={z(326)} height={z(261)} style={{ position: 'absolute', start: z(-40), top: z(-50) }} pointerEvents="none">
      <Defs>
        <RadialGradient id="obBand" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset={0} stopColor={NAVY} stopOpacity={0.82} />
          <Stop offset={0.6} stopColor={NAVY} stopOpacity={0.5} />
          <Stop offset={1} stopColor={NAVY} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={z(326)} height={z(261)} fill="url(#obBand)" />
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
      {/* Only the still art is cached as one GPU picture, so a swipe moves it without redrawing the photo and
          masks. The twinkling stars sit outside it: their opacity changes every frame and would redraw the cache
          each frame (DEF-071). Same order and place, so nothing looks different. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill} renderToHardwareTextureAndroid shouldRasterizeIOS>
        <Sky w={w} h={h} />
        {/* Small phones (2026-11-12) are wider than the phone design at their size: the photo fills the screen as on tablets. */}
        {TABLET || w > u(DESIGN_W) + 1 ? <TabletScene si={si} w={w} h={h} /> : <Scene si={si} w={w} h={h} padTop={padTop} padBottom={padBottom} />}
      </View>
      <Stars si={si} hd={hd} wd={w / u(1)} />
      <View style={{ flex: 1, paddingTop: padTop, paddingBottom: padBottom, paddingHorizontal: TABLET ? u(40) : u(18), gap: z(14) }}>{children}</View>
    </View>
  );
}

/** 01 / Ten games: scene on top, copy at the top-left. */
export function SlideGames(p: SlideProps) {
  return (
    <Frame {...p}>
      <View style={st.bar}>
        <Text style={[st.barTxt, { color: CYAN }]}>{tr('01 / Ten games')}</Text>
        <Skip onPress={p.onSkip} />
      </View>
      <View style={st.copy}>
        <View>
          <Text style={{ fontFamily: F.display, fontSize: z(76), lineHeight: z(60.8), letterSpacing: z(-2.28), color: FG }}>{tr('Play')}</Text>
          <Text
            style={{ fontFamily: F.displayItalic, fontSize: z(34), lineHeight: z(34), letterSpacing: z(-2.28), color: ACCENT, textAlign: 'center', marginTop: z(10) }}>
            {tr('the case')}
          </Text>
        </View>
        <Text style={[st.p, { maxWidth: z(208) }]}>{tr('Hunt the diagnosis like a detective, solo or against smart rivals.')}</Text>
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
        <Text style={[st.barTxt, { color: CYAN }]}>{tr('02 / Learning Space')}</Text>
      </View>
      <View style={{ flex: 1 }} />
      <View style={st.copy}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ fontFamily: F.display, fontSize: z(44), lineHeight: z(38.72), letterSpacing: z(-1.32), color: FG }}>{tr('Every ')}</Text>
            <View>
              <Text style={{ fontFamily: F.displayItalic, fontSize: z(44), lineHeight: z(38.72), letterSpacing: z(-1.32), color: ROSE }}>{tr('miss')}</Text>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  start: z(-3),
                  end: z(-3),
                  top: z(21.16),
                  height: z(2),
                  backgroundColor: ROSE,
                  transform: [{ rotate: '-6deg' }],
                  boxShadow: `0px 0px ${z(10)}px ${ROSE}`,
                }}
              />
            </View>
          </View>
          <Text style={{ fontFamily: F.displayItalic, fontSize: z(54), lineHeight: z(47.52), letterSpacing: z(-1.32), color: ACCENT }}>{tr('becomes\na star')}</Text>
        </View>
        <Text style={[st.p, { maxWidth: z(208) }]}>{tr('Every disease or term you get wrong lands in your dossier, ready to review.')}</Text>
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
      <View style={[st.copy, { marginTop: z(28), alignItems: 'center' }]}>
        <Band />
        <Text style={{ fontFamily: F.mono, fontSize: z(9), lineHeight: z(12), letterSpacing: z(2.7), color: CYAN }}>{tr('NOVA COMMUNITY')}</Text>
        <Text style={{ fontFamily: F.display, fontSize: z(40), lineHeight: z(36), letterSpacing: z(-1.2), color: FG, textAlign: 'center' }}>
          {tr('Never the\nonly one\n')}
          <Text style={{ fontFamily: F.displayItalic, color: ACCENT }}>{tr('on call')}</Text>
        </Text>
        <Text style={[st.p, { maxWidth: z(194), textAlign: 'center' }]}>{tr('Share cases, challenge friends and read the MedNova newspaper.')}</Text>
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
