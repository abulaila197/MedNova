import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { OfflineLine } from '@/components/OfflineLine';
import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { TokenCoin } from '@/components/PulseStar';

/** `say` is the task as a phrase for a locked card, e.g. 'play 12 games'. */
export type Task = { label: string; say: string; n: number; of: number; share?: boolean };
export type ChallengesView = {
  /** 1-3: the one counting now; 4: all done today. */
  step: 1 | 2 | 3 | 4;
  tasks: [Task[], Task[], Task[]];
  /** Warm-up, Full Shift, Overtime and their token prizes (10 / 30 / 50). */
  names: string[];
  prizes: number[];
  resetIn: string;
  /** Not signed in: nothing counts yet. */
  guest?: boolean;
  /** Today's challenges could not be read (no connection). */
  offline?: boolean;
  /** Shown from the saved copy read then (#59). */
  savedAt?: number | null;
  onShare?: () => void;
};

/**
 * Daily missions (Yazan 2026-10-18, reworked 2026-10-26): one after the other, the next only starts counting when the
 * last is done; each pays tokens. Opened from the Achievements page.
 */
export function ChallengesPage({ v }: { v: ChallengesView }) {
  const c = useInfo();
  const t = c.t;
  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>{v.resetIn ? `New missions in ${v.resetIn}` : 'Every day'}</Kicker>
        <OfflineLine at={v.savedAt} style={{ marginTop: 0 }} />
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {'Daily '}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>missions</Text>
        </Text>

        {v.tasks.map((tasks, i) => {
          const step = (i + 1) as 1 | 2 | 3;
          const done = v.step > step;
          const locked = v.step < step;
          const name = v.names[i] ?? `Mission ${step}`;
          return (
            <View key={step} style={[s.card, { backgroundColor: locked ? c.surf2 : c.surf, borderColor: v.step === step ? t.accent : c.line }]}>
              <View style={s.head}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.k, { color: done ? '#5fd38a' : locked ? c.mute : c.kick }]}>{done ? `DONE · +${v.prizes[i]} TOKENS` : locked ? 'LOCKED' : 'NOW COUNTING'}</Text>
                  <Text style={[s.h, { color: locked ? c.mute : c.fg }]}>{name}</Text>
                </View>
                <View style={[s.prize, locked && { opacity: 0.45 }]}>
                  <TokenCoin size={u(14)} progress={0} track="transparent" />
                  <Text style={[s.prizeT, { color: c.fg }]}>{v.prizes[i]}</Text>
                </View>
              </View>
              {locked ? (
                <Text style={[s.lock, { color: c.mute }]}>{`Starts after ${v.names[i - 1] ?? `mission ${step - 1}`}: ${tasks.map((x) => x.say).join(', ')}.`}</Text>
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
        {v.guest ? <Text style={[s.foot, { color: t.accent }]}>Sign in to start counting your missions.</Text> : null}
        {v.offline ? <Text style={[s.foot, { color: t.accent }]}>Can’t reach MedNova right now, so your progress isn’t shown. Check your connection.</Text> : null}
        <Text style={[s.foot, { color: c.mute }]}>Only games that use Sparks count, each game once per mission. A share counts when you pick an app to send the link to. An ad counts when you watch it to the end. With nothing to review, the review task is already done.</Text>
      </InfoScroll>
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: u(16), paddingHorizontal: u(12), paddingTop: u(10), paddingBottom: u(12), marginTop: u(12) },
  head: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3) },
  h: { fontFamily: F.display, fontSize: u(15), marginTop: u(2) },
  prize: { flexDirection: 'row', alignItems: 'center', gap: u(4) },
  prizeT: { fontFamily: F.display, fontSize: u(16) },
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
