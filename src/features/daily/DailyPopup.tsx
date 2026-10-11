import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Keyframe, ZoomIn, ZoomOut } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { TokenCoin } from '@/components/PulseStar';
import { useTheme } from '@/state/app';
import { u, useScreen } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

import { CALENDAR_DAYS, dayPrize } from './prizes';

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

/**
 * Daily login pop-up (DL1-DL4), locked look B "Pill organiser": the month is a blister pack of 30 doses.
 * Taken doses leave an empty dashed blister; Collect pops today's capsule and a token flies out.
 */
export function DailyPopup({ day, collected, signedIn, busy, error, onCollect, onSignIn, onClose }: Props) {
  const t = useTheme();
  const { width } = useScreen();
  const lt = t.mode === 'light';
  const cardW = Math.min(width - u(32), u(340));
  const inner = cardW - u(36);
  const gap = u(5);
  const cell = (inner - u(26) - gap * (COLS - 1)) / COLS; // u(26) = the week number column
  const prize = dayPrize(day);
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
              backgroundColor: lt ? 'rgba(40,34,24,0.35)' : 'rgba(5,6,16,0.6)',
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
            shadowColor: lt ? 'rgba(60,50,30,0.45)' : '#000',
          },
        ]}
      >
        <View style={s.top}>
          <Text style={[s.kick, { color: t.kick }]}>{`MONTHLY PACK · DOSE ${day} OF 30`}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Text style={{ color: t.mute, fontSize: u(15) }}>×</Text>
          </Pressable>
        </View>
        <Text style={[s.title, { color: t.fg }]}>
          {"Today's "}
          <Text style={[s.title, { color: t.accent, fontFamily: F.displayItalic }]}>dose</Text>
        </Text>

        <View style={[s.grid, s.pack, { borderColor: t.panelLine }]}>
          <LinearGradient
            colors={lt ? ['#f4f1ea', '#e3ded3', '#f2efe8'] : ['#20264a', '#151a36', '#1d2244']}
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
                  const w = wide ? cell * (COLS - 1) + gap * (COLS - 2) : cell;
                  return <Blister key={d} t={t} d={d} w={w} h={cell * 1.45} st={state(d)} wide={wide} popped={collected && d === day} />;
                })}
            </View>
          ))}
        </View>

        {signedIn ? (
          collected ? (
            <Animated.View entering={FadeIn.duration(300).delay(250)}>
              <Text style={[s.note, { color: t.soft }]}>{`+${prize} collected. Tomorrow's dose pays ${nextPrize}.`}</Text>
            </Animated.View>
          ) : (
            <Pressable
              onPress={busy ? undefined : onCollect}
              accessibilityRole="button"
              accessibilityState={{ busy: !!busy }}
              style={[s.btnWrap, busy && { opacity: 0.6 }]}
            >
              <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.btn}>
                <TokenCoin size={u(16)} progress={0} light={lt} track="transparent" />
                <Text style={[s.btnT, { color: t.onGrad }]}>{`Collect ${prize} token${prize === 1 ? '' : 's'}`}</Text>
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
        {error ? <Text style={[s.small, { color: t.red }]}>{error}</Text> : null}
        <Text style={[s.small, { color: t.mute }]}>
          {signedIn ? 'Missed a day? Your pack just waits for you.' : 'Daily doses are saved on your account.'}
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
};

/** One blister: the capsule sits low in its bubble, away from the top edge; taken doses leave it empty and dashed. */
function Blister({ t, d, w, h, st, wide, popped }: CellP) {
  const lt = t.mode === 'light';
  const prize = dayPrize(d);
  const big = prize >= 3 && !wide;
  const today = st === 'today';
  const done = st === 'done';
  const capW = wide ? w * 0.6 : big ? w * 0.74 : w * 0.6;
  const capH = wide ? h * 0.26 : big ? h * 0.28 : h * 0.22;
  const half = lt ? ['#e5833a', '#ffffff'] : ['#6fd6ff', '#eef0ff'];
  return (
    <View
      style={[
        s.blister,
        {
          width: w,
          height: h,
          borderColor: lt ? 'rgba(40,36,28,0.16)' : 'rgba(255,255,255,0.12)',
          backgroundColor: lt ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.04)',
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
        <Animated.Text entering={FadeIn.duration(250)} style={[s.num, { color: t.dim, opacity: 0.6 }]}>
          {d}
        </Animated.Text>
      ) : (
        <Animated.View exiting={ZoomOut.duration(260)} style={s.dose}>
          <View style={s.capArea}>
            <View
              style={[
                s.cap,
                {
                  width: capW,
                  height: capH,
                  borderRadius: capH / 2,
                  transform: [{ rotate: wide ? '0deg' : '-28deg' }],
                },
                lt && { borderWidth: 0.6, borderColor: 'rgba(40,36,28,0.25)' },
              ]}
            >
              {wide ? (
                <LinearGradient colors={['#f6d77a', '#d9a23a']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
              ) : big ? (
                <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
              ) : (
                <>
                  <View style={[s.half, { backgroundColor: half[0] }]} />
                  <View style={[s.half, { backgroundColor: half[1] }]} />
                </>
              )}
              <View style={[s.shine, { borderRadius: capH / 2 }]} />
            </View>
          </View>
          <Text style={[s.amt, { color: today ? t.accent : big || wide ? t.fg : t.soft }, (big || wide) && { fontFamily: F.bodyBold }]}>
            {wide ? 'Day 30 · +10' : `+${prize}`}
          </Text>
        </Animated.View>
      )}
      {popped ? (
        <Animated.View entering={fly} style={[s.fly, { opacity: 0 }]} pointerEvents="none">
          <TokenCoin size={u(18)} progress={0} light={lt} track="transparent" />
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
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
    width: u(21),
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
    paddingTop: u(9),
    paddingBottom: u(4),
  },
  capArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cap: { overflow: 'hidden', flexDirection: 'row' },
  half: { flex: 1 },
  shine: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: '14%',
    height: '26%',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
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
