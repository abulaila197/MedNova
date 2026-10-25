import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Keyframe, ZoomIn, ZoomOut } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Text, MAX_FONT_SCALE } from '@/components/AppText';
import { TokenCoin } from '@/components/PulseStar';
import { useTheme } from '@/state/app';
import { u, useScreen } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

import { Bolt, SPARK } from '@/features/sparks/Bolt';

import { CALENDAR_DAYS, dayPrize, daySparks } from './prizes';

type Props = {
  /** Calendar day (1-30) today's claim lands on. */
  day: number;
  /** Today's prize already collected. */
  collected: boolean;
  signedIn: boolean;
  /** Waiting for the server to pay. */
  busy?: boolean;
  error?: string | null;
  onCollect: () => void;
  onSignIn: () => void;
  onClose: () => void;
};

const COLS = 7;
/** How much wider the 7th column is than the others. */
const LAST = 1.4;

/**
 * Daily login pop-up (DL1-DL4), locked look B "Pill organiser": the month is a blister pack of 30 doses.
 * Each dose is our token coin (Yazan, 2026-10-25). Taken doses leave an empty dashed blister; Collect pops today's
 * coin and a token flies out.
 */
export function DailyPopup({ day, collected, signedIn, busy, error, onCollect, onSignIn, onClose }: Props) {
  const t = useTheme();
  const { width } = useScreen();
  const cardW = Math.min(width - u(32), u(340));
  const inner = cardW - u(36);
  const gap = u(5);
  // u(16) = the week number column; the 7th column (the Sparks days) is wider so its two lines have room.
  const cell = (inner - u(16) - gap * (COLS - 1)) / (COLS - 1 + LAST);
  const prize = dayPrize(day);
  // Today's Sparks know today's date (the weekend Sparks); later days show only the big days' Sparks.
  const sparks = daySparks(day, new Date());
  const and = sparks ? ` + ${sparks} Sparks` : '';
  const rows = Array.from({ length: Math.ceil(CALENDAR_DAYS / COLS) }, (_, r) => r);
  const nextPrize = dayPrize((day % CALENDAR_DAYS) + 1);
  const state = (d: number) => (d < day || (d === day && collected) ? 'done' : d === day ? 'today' : 'later');

  return (
    <View style={[StyleSheet.absoluteFill, s.wrap]}>
      <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: 'rgba(5,6,16,0.6)',
            },
          ]}
          onPress={onClose}
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Animated.View
        entering={ZoomIn.duration(320)}
        exiting={FadeOut.duration(200)}
        style={[
          s.card,
          {
            width: cardW,
            backgroundColor: t.panel2,
            borderColor: t.panelLine,
            shadowColor: '#000',
          },
        ]}
      >
        <View style={s.top}>
          <Text style={[s.kick, { color: t.kick }]}>{`DAY ${day} OF 30`}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Text style={{ color: t.mute, fontSize: u(15) }}>×</Text>
          </Pressable>
        </View>
        <Text style={[s.title, { color: t.fg }]}>
          {"Today's "}
          <Text style={[s.title, { color: t.accent, fontFamily: F.displayItalic }]}>reward</Text>
        </Text>

        <View style={[s.grid, s.pack, { borderColor: t.panelLine }]}>
          <LinearGradient
            colors={['#20264a', '#151a36', '#1d2244']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: u(16) }]}
          />
          {rows.map((r) => (
            <View key={r} style={[s.row, { gap }]}>
              <Text style={[s.wk, { color: t.dim }]}>{r + 1}</Text>
              {Array.from({ length: COLS }, (_, c) => r * COLS + c + 1)
                .filter((d) => d <= CALENDAR_DAYS)
                .map((d) => {
                  const wide = d === CALENDAR_DAYS;
                  const w = wide ? cell * (COLS - 2 + LAST) + gap * (COLS - 2) : d % COLS === 0 ? cell * LAST : cell;
                  return <Blister key={d} t={t} d={d} w={w} h={cell * 1.45} st={state(d)} wide={wide} popped={collected && d === day} sparks={d === day ? sparks : daySparks(d)} />;
                })}
            </View>
          ))}
        </View>

        {signedIn ? (
          collected ? (
            <Animated.View entering={FadeIn.duration(300).delay(250)}>
              <Text style={[s.note, { color: t.soft }]}>{`+${prize} tokens${and} added! Come back tomorrow for ${nextPrize} more.`}</Text>
            </Animated.View>
          ) : (
            <Pressable
              onPress={busy ? undefined : onCollect}
              accessibilityRole="button"
              accessibilityState={{ busy: !!busy }}
              style={[s.btnWrap, busy && { opacity: 0.6 }]}
            >
              <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.btn}>
                <TokenCoin size={u(16)} progress={0} track="transparent" />
                <Text style={[s.btnT, { color: t.onGrad }]}>{`Collect ${prize} tokens${and}`}</Text>
              </LinearGradient>
            </Pressable>
          )
        ) : (
          <Pressable onPress={onSignIn} accessibilityRole="button" style={s.btnWrap}>
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.btn}>
              <Text style={[s.btnT, { color: t.onGrad }]}>Sign in to collect</Text>
            </LinearGradient>
          </Pressable>
        )}
        {error ? <Text style={[s.small, { color: t.error }]}>{error}</Text> : null}
        <Text style={[s.small, { color: t.mute }]}>
          {signedIn ? 'Missed a day? No problem, you pick up where you left off.' : 'Your rewards are saved to your account.'}
        </Text>
      </Animated.View>
    </View>
  );
}

// The token rising out of a just-popped blister.
const fly = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 0.6 }] },
  40: { opacity: 1, transform: [{ translateY: -u(18) }, { scale: 1.1 }] },
  100: { opacity: 0, transform: [{ translateY: -u(46) }, { scale: 1 }] },
}).duration(900);

type CellP = {
  t: Theme;
  d: number;
  w: number;
  h: number;
  st: 'done' | 'today' | 'later';
  wide: boolean;
  popped: boolean;
  /** Sparks this day gives too (0 for none). */
  sparks: number;
};

/** One blister: the coin sits low in its bubble, away from the top edge; taken doses leave it empty and dashed. */
function Blister({ t, d, w, h, st, wide, popped, sparks }: CellP) {
  const prize = dayPrize(d);
  const big = prize >= 3 && !wide;
  const today = st === 'today';
  const done = st === 'done';
  return (
    <View
      style={[
        s.blister,
        {
          width: w,
          height: h,
          borderColor: 'rgba(255,255,255,0.12)',
          backgroundColor: 'rgba(255,255,255,0.04)',
        },
        done && { borderStyle: 'dashed', backgroundColor: 'transparent' },
        today && {
          borderColor: t.accent,
          borderWidth: 1.5,
          shadowColor: t.accent,
          shadowOpacity: 0.7,
          shadowRadius: u(9),
          shadowOffset: { width: 0, height: 0 },
        },
      ]}
    >
      {done ? (
        <Animated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} entering={FadeIn.duration(250)} style={[s.num, { color: t.dim, opacity: 0.6 }]}>
          {d}
        </Animated.Text>
      ) : wide ? (
        <Animated.View exiting={ZoomOut.duration(260)} style={s.month}>
          <Envelope size={h * 0.5} t={t} />
          <Text style={[s.amtBig, { color: today ? t.accent : t.fg }]}>{`Day 30 · +${prize}`}</Text>
          {sparks ? <SparkTag n={sparks} big /> : null}
        </Animated.View>
      ) : (
        <Animated.View exiting={ZoomOut.duration(260)} style={s.dose}>
          {sparks ? (
            // A Sparks day: tokens and Sparks as two short lines, each with its own mark.
            <View style={[s.capArea, { gap: u(3) }]}>
              <View style={s.spark}>
                <TokenCoin size={u(9)} progress={0} track="transparent" />
                <Text style={[s.amt, { color: today ? t.accent : t.fg, fontFamily: F.bodyBold }]}>{String(prize)}</Text>
              </View>
              <SparkTag n={sparks} />
            </View>
          ) : (
            <>
              <View style={s.capArea}>
                <TokenCoin size={w * 0.8} progress={0} track="transparent" />
              </View>
              <Text style={[s.amt, { color: today ? t.accent : big ? t.fg : t.soft }, big && { fontFamily: F.bodyBold }]}>{`+${prize}`}</Text>
            </>
          )}
        </Animated.View>
      )}
      {popped ? (
        <Animated.View entering={fly} style={[s.fly, { opacity: 0 }]} pointerEvents="none">
          <TokenCoin size={u(18)} progress={0} track="transparent" />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** The Sparks a day gives on top of its tokens: a gold bolt and the count. */
function SparkTag({ n, big }: { n: number; big?: boolean }) {
  return (
    <View style={s.spark}>
      <Bolt size={u(big ? 11 : 7)} />
      <Text style={[big ? s.amtBig : s.amt, { color: SPARK[0] }]}>{String(n)}</Text>
    </View>
  );
}

/** Sealed envelope for the month-end prize (cream paper, wax in the accent colour), from look A. */
function Envelope({ size, t }: { size: number; t: Theme }) {
  return (
    <Svg width={size * 1.4} height={size} viewBox="0 0 28 20">
      <Path d="M1.5 2.5h25v15h-25z" fill="#efe6d2" stroke="rgba(0,0,0,0.25)" strokeWidth={0.6} />
      <Path d="M1.5 2.5l12.5 9 12.5-9" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={0.7} />
      <Path d="M14 9.2a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2z" fill={t.accent} />
    </Svg>
  );
}

const s = StyleSheet.create({
  spark: { flexDirection: 'row', alignItems: 'center', gap: u(1) },
  month: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: u(8) },
  amtBig: { fontFamily: F.bodyBold, fontSize: u(11) },
  wrap: { zIndex: 30, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: u(26),
    borderWidth: 1,
    padding: u(18),
    gap: u(12),
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 1,
    shadowRadius: 30,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kick: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.4) },
  title: {
    fontFamily: F.display,
    fontSize: u(26),
    lineHeight: u(28),
    letterSpacing: u(-0.3),
    marginTop: u(-4),
  },
  grid: { gap: u(5) },
  pack: {
    borderWidth: 1,
    borderRadius: u(16),
    padding: u(8),
    marginHorizontal: u(-8),
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  wk: {
    width: u(11),
    fontFamily: F.mono,
    fontSize: u(6.5),
    letterSpacing: u(0.6),
  },
  num: { fontFamily: F.mono, fontSize: u(7), textAlign: 'center' },
  amt: { fontFamily: F.bodySemi, fontSize: u(8), lineHeight: u(10) },
  blister: {
    borderRadius: u(10),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dose: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    paddingTop: u(4),
    paddingBottom: u(4),
  },
  capArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fly: { position: 'absolute', alignSelf: 'center' },
  btnWrap: { alignSelf: 'stretch' },
  btn: {
    height: u(40),
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: u(8),
  },
  btnT: { fontFamily: F.bodyBold, fontSize: u(12) },
  note: { fontFamily: F.bodyMedium, fontSize: u(11), textAlign: 'center' },
  small: {
    fontFamily: F.body,
    fontSize: u(9),
    textAlign: 'center',
    marginTop: u(-4),
  },
});
