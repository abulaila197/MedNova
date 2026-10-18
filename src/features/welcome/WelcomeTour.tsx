import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { characterOf } from '@/games/shell/characters';
import { Face } from '@/games/shell/Face';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tapped } from '@/lib/sound';
import { useBack } from '@/lib/useBack';

import { TOUR } from './tour';

/** Types a line out letter by letter; a tap on the panel finishes it at once. */
function useTyping(text: string, done: boolean) {
  const [st, setSt] = useState({ text, n: 0 });
  const n = st.text === text ? st.n : 0;
  useEffect(() => {
    if (done || n >= text.length) return;
    const id = setTimeout(() => setSt({ text, n: Math.min(text.length, n + 2) }), 18);
    return () => clearTimeout(id);
  }, [n, text, done]);
  return done ? text.length : n;
}

/**
 * The welcome tour as a space chat (Yazan, 2026-10-13): the speaking character's face appears and their message
 * types out. Next hands over to the next character; the last one closes it and the daily reward follows.
 */
export function WelcomeTour({ onClose }: { onClose: () => void }) {
  // Android back skips the tour, like its close button (PB3).
  useBack(true, onClose);
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const stop = TOUR[i];
  const shown = useTyping(stop.text, full);
  const typed = shown >= stop.text.length;
  const last = i === TOUR.length - 1;
  const next = () => {
    if (!typed) return setFull(true);
    if (last) return onClose();
    setFull(false);
    setI(i + 1);
  };
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 30 }]}>
      <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,5,14,0.55)' }]} />
      <Transmission i={i} shown={shown} typed={typed} last={last} onNext={next} onSkip={onClose} />
    </View>
  );
}

type BodyProps = { i: number; shown: number; typed: boolean; last: boolean; onNext: () => void; onSkip: () => void };

function NextBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={tapped(onPress)} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.next}>
        <Text style={[s.nextT, { color: t.onGrad }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/** "Incoming transmission" (Yazan's pick, 2026-10-13): a comms panel low on the screen; the face pops into a signal ring. */
function Transmission({ i, shown, typed, last, onNext, onSkip }: BodyProps) {
  const t = useTheme();
  const stop = TOUR[i];
  const c = characterOf(stop.who);
  const ring = c?.ring ?? t.accent;
  return (
    <View style={s.lowWrap} pointerEvents="box-none">
      <Animated.View entering={FadeInDown.duration(320)} style={[s.panel, { backgroundColor: t.panel2, borderColor: t.panelLine }]}>
        <View style={s.panelTop}>
          <View style={[s.live, { backgroundColor: ring }]} />
          <Text style={[s.kick, { color: t.kick }]}>{`INCOMING · ${(c?.name ?? 'Nova').toUpperCase()}`}</Text>
          <View style={{ flex: 1 }} />
          <Text style={[s.kick, { color: t.mute }]}>{`${i + 1} / ${TOUR.length}`}</Text>
        </View>
        <Pressable onPress={onNext} style={s.row} accessibilityRole="button" accessibilityLabel={stop.text}>
          <View style={s.portrait}>
            <View style={[s.signal, { borderColor: ring, opacity: 0.25, transform: [{ scale: 1.32 }] }]} />
            <View style={[s.signal, { borderColor: ring, opacity: 0.5, transform: [{ scale: 1.15 }] }]} />
            <Animated.View key={i} entering={ZoomIn.springify().damping(13)}>
              <Face slug={stop.who} size={u(64)} />
            </Animated.View>
          </View>
          <View style={{ flex: 1, minHeight: u(96) }}>
            <Text style={[s.title, { color: t.white }]}>{stop.title}</Text>
            <Text style={[s.body, { color: t.soft }]}>
              {stop.text.slice(0, shown)}
              {typed ? '' : '▍'}
            </Text>
          </View>
        </Pressable>
        <View style={s.foot}>
          <Pressable onPress={onSkip} hitSlop={10} accessibilityRole="button">
            <Text style={[s.skip, { color: t.mute }]}>Skip tour</Text>
          </Pressable>
          <Dots i={i} color={ring} />
          <NextBtn label={last ? 'Daily reward' : 'Next'} onPress={onNext} />
        </View>
      </Animated.View>
    </View>
  );
}

function Dots({ i, color }: { i: number; color: string }) {
  const t = useTheme();
  return (
    <View style={s.dots}>
      {TOUR.map((_, k) => (
        <View key={k} style={[s.dot, { backgroundColor: k === i ? color : t.hair, width: k === i ? u(12) : u(4) }]} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  lowWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', paddingHorizontal: u(16), paddingBottom: u(118) },
  panel: { borderWidth: 1, borderRadius: u(20), padding: u(16), gap: u(12), boxShadow: '0 18px 40px rgba(0,0,0,0.45)' },
  panelTop: { flexDirection: 'row', alignItems: 'center', gap: u(7) },
  live: { width: u(7), height: u(7), borderRadius: u(4) },
  kick: { fontFamily: F.mono, fontSize: u(10.5), letterSpacing: u(1.2) },
  row: { flexDirection: 'row', gap: u(16), alignItems: 'flex-start' },
  portrait: { width: u(76), height: u(76), alignItems: 'center', justifyContent: 'center', marginTop: u(2) },
  signal: { position: 'absolute', width: u(64), height: u(64), borderRadius: u(32), borderWidth: 1.5 },
  title: { fontFamily: F.display, fontSize: u(19), lineHeight: u(23), marginBottom: u(4) },
  body: { fontFamily: F.body, fontSize: u(14), lineHeight: u(20) },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: u(10) },
  skip: { fontFamily: F.bodyMedium, fontSize: u(13) },
  next: { paddingHorizontal: u(18), paddingVertical: u(9), borderRadius: u(14) },
  nextT: { fontFamily: F.bodySemi, fontSize: u(14) },
  dots: { flexDirection: 'row', gap: u(4), alignItems: 'center', flex: 1, justifyContent: 'center' },
  dot: { height: u(4), borderRadius: u(2) },
});
