import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { CHESTS, type ChestKind } from './data';

/** `say` is the task as a phrase for a locked card, e.g. 'play 12 games'. */
export type Task = { label: string; say: string; n: number; of: number; share?: boolean };
export type ChallengesView = {
  /** 1-3: the one counting now; 4: all done today. */
  step: 1 | 2 | 3 | 4;
  tasks: [Task[], Task[], Task[]];
  /** Days in a row with all 3 done (0-5). */
  streak: number;
  resetIn: string;
  /** Not signed in: nothing counts yet. */
  guest?: boolean;
  /** Today's challenges could not be read (no connection). */
  offline?: boolean;
  onShare?: () => void;
};

const REWARD: ChestKind[] = ['wooden', 'golden', 'diamond'];

/** Daily challenges (Yazan 2026-10-18): one after the other; the next only starts counting when the last is done. */
export function ChallengesPage({ v }: { v: ChallengesView }) {
  const c = useInfo();
  const t = c.t;
  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>{v.resetIn ? `New challenges in ${v.resetIn}` : 'Daily rewards'}</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {'Daily '}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>challenges</Text>
        </Text>

        <View style={[s.streak, { backgroundColor: c.surf, borderColor: c.line }]}>
          <Image source={CHESTS.epic.art} style={s.epic} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <Text style={[s.sT, { color: c.fg }]}>Epic chest</Text>
            <Text style={[s.sS, { color: c.mute }]}>Finish all 3 challenges 5 days in a row.</Text>
            <View style={s.days}>
              {[0, 1, 2, 3, 4].map((d) => {
                const on = d < v.streak;
                return (
                  <View key={d} style={[s.day, { borderColor: on ? '#b07cff' : c.line, backgroundColor: on ? 'rgba(176,124,255,0.18)' : 'transparent' }]}>
                    <Text style={[s.dayT, { color: on ? '#d9c4ff' : c.mute }]}>{on ? '✓' : `${d + 1}`}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {v.tasks.map((tasks, i) => {
          const step = (i + 1) as 1 | 2 | 3;
          const done = v.step > step;
          const locked = v.step < step;
          const chest = CHESTS[REWARD[i]];
          return (
            <View key={step} style={[s.card, { backgroundColor: locked ? c.surf2 : c.surf, borderColor: v.step === step ? t.accent : c.line }]}>
              <View style={s.head}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.k, { color: done ? '#5fd38a' : locked ? c.mute : c.kick }]}>{done ? 'DONE · CHEST ADDED' : locked ? 'LOCKED' : 'NOW COUNTING'}</Text>
                  <Text style={[s.h, { color: locked ? c.mute : c.fg }]}>{`Challenge ${step}`}</Text>
                </View>
                <Image source={chest.art} style={[s.chest, locked && { opacity: 0.45 }]} contentFit="contain" />
              </View>
              {locked ? (
                <Text style={[s.lock, { color: c.mute }]}>{`Starts after challenge ${step - 1}: ${tasks.map((x) => x.say).join(', ')}.`}</Text>
              ) : (
                <View style={{ gap: u(7), marginTop: u(10) }}>
                  {tasks.map((x) => {
                    const n = done ? x.of : x.n;
                    return (
                      <View key={x.label}>
                        <View style={s.pRow}>
                          <Text style={[s.pN, { color: c.fg }]}>{x.label}</Text>
                          <Text style={[s.pC, { color: n >= x.of ? t.accent : c.mute }]}>{`${n} / ${x.of}`}</Text>
                        </View>
                        <View style={[s.track, { backgroundColor: t.chip }]}>
                          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.fill, { width: `${Math.min(1, n / x.of) * 100}%` }]} />
                        </View>
                      </View>
                    );
                  })}
                  {!done && tasks.some((x) => x.share && x.n < x.of) ? (
                    <Pressable onPress={v.onShare} style={[s.share, { borderColor: t.accent }]} accessibilityRole="button">
                      <Text style={[s.shareT, { color: t.accent }]}>Share the app</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          );
        })}
        {v.guest ? <Text style={[s.foot, { color: t.accent }]}>Sign in to start counting your challenges.</Text> : null}
        {v.offline ? <Text style={[s.foot, { color: t.accent }]}>Can’t reach MedNova right now, so your progress isn’t shown. Check your connection.</Text> : null}
        <Text style={[s.foot, { color: c.mute }]}>A share counts when you pick an app to send the link to. An ad counts when you watch it to the end.</Text>
      </InfoScroll>
    </Screen>
  );
}

const s = StyleSheet.create({
  streak: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: u(16), padding: u(12), marginTop: u(16), gap: u(10) },
  epic: { width: u(54), height: u(54) },
  sT: { fontFamily: F.display, fontSize: u(14) },
  sS: { fontFamily: F.body, fontSize: u(8.5), marginTop: u(2) },
  days: { flexDirection: 'row', gap: u(5), marginTop: u(7) },
  day: { width: u(20), height: u(20), borderRadius: u(10), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayT: { fontFamily: F.bodyBold, fontSize: u(8.5) },
  card: { borderWidth: 1, borderRadius: u(16), paddingHorizontal: u(12), paddingTop: u(10), paddingBottom: u(12), marginTop: u(12) },
  head: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3) },
  h: { fontFamily: F.display, fontSize: u(15), marginTop: u(2) },
  chest: { width: u(40), height: u(40) },
  lock: { fontFamily: F.body, fontSize: u(9), lineHeight: u(13), marginTop: u(6) },
  pRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: u(3) },
  pN: { fontFamily: F.bodySemi, fontSize: u(9.5) },
  pC: { fontFamily: F.mono, fontSize: u(8.5) },
  track: { height: u(5), borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  share: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: u(12), paddingVertical: u(5), marginTop: u(3) },
  shareT: { fontFamily: F.bodyBold, fontSize: u(9.5) },
  foot: { fontFamily: F.body, fontSize: u(8.5), lineHeight: u(12.5), marginTop: u(12) },
});
