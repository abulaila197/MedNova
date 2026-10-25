import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/AppText';
import { Image } from 'expo-image';

import { Congrats } from '@/components/Congrats';
import { TokenCoin } from '@/components/PulseStar';
import { Screen } from '@/components/Screen';
import { Glyph } from '@/features/games/Glyph';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { CHESTS } from '@/features/chests/data';
import { Bolt } from '@/features/sparks/Bolt';
import { useSession } from '@/games/shell/session';
import type { Theme } from '@/theme/tokens';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { Beat } from './Ribbon';
import { aboutGames, CHEST_NAME, claimRounds, CYCLE_WEEKS, loadRounds, useRoundsStore, weekGoal, weekName, type Week } from './useRounds';
import { useLock } from '@/lib/useLock';

/** A mode week's stamp sign: a phone for Pass, a single figure for Solo, linked dots for Online. */
function ModeSign({ mode, px, color }: { mode: 'online' | 'solo' | 'offline'; px: number; color: string }) {
  const line = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={px} height={px} viewBox="0 0 24 24">
      {mode === 'online' ? (
        <>
          <Circle cx={6} cy={7} r={2.4} {...line} />
          <Circle cx={18} cy={7} r={2.4} {...line} />
          <Circle cx={12} cy={18} r={2.4} {...line} />
          <Path d="M8 8.5 L10.5 16 M16 8.5 L13.5 16 M8.5 7 H15.5" {...line} />
        </>
      ) : mode === 'solo' ? (
        <>
          <Circle cx={12} cy={7.5} r={3.2} {...line} />
          <Path d="M5.5 20 C6.5 15 9 13 12 13 C15 13 17.5 15 18.5 20" {...line} />
        </>
      ) : (
        <>
          <Path d="M8 3.5 H16 A1.5 1.5 0 0 1 17.5 5 V19 A1.5 1.5 0 0 1 16 20.5 H8 A1.5 1.5 0 0 1 6.5 19 V5 A1.5 1.5 0 0 1 8 3.5 Z" {...line} />
          <Path d="M3 12 H9 M7 10 L9 12 L7 14 M21 12 H15 M17 10 L15 12 L17 14" {...line} />
        </>
      )}
    </Svg>
  );
}

function WeekSign({ w, px, t, dim }: { w: Week; px: number; t: Theme; dim?: boolean }) {
  return (
    <View style={{ opacity: dim ? 0.4 : 1 }}>
      {w.kind === 'game' ? <Glyph k={w.game} mode={t.mode} px={px} id={`gr-${w.slot}`} /> : <ModeSign mode={w.mode} px={px} color={t.accent} />}
    </View>
  );
}

// The same order as rounds_week on the server.
const CYCLE: Week[] = [
  ...['the-diagnostic-pursuit', 'the-silent-artist', 'the-quiz-parade', 'the-wheels-of-chaos', 'the-riddler', 'the-conqueror', 'case-files-unsolved', 'nova-medicordle', 'the-streak-master', 'nova-crossword', 'imposter', 'code-clinic', 'nova-password'].map(
    (game, slot) => ({ kind: 'game' as const, slot, game }),
  ),
  { kind: 'mode', slot: 13, mode: 'online' },
  { kind: 'mode', slot: 14, mode: 'solo' },
  { kind: 'mode', slot: 15, mode: 'offline' },
];
const slotOf = (week: number) => ((week % CYCLE_WEEKS) + CYCLE_WEEKS) % CYCLE_WEEKS;

/** Grand Rounds (Yazan 2026-10-13, missions 2026-10-25): this week's 3 missions and their chests, your stamps and the cycle prize. */
export function RoundsPage() {
  const c = useInfo();
  const t = c.t;
  const r = useRoundsStore((x) => x.r);
  const failed = useRoundsStore((x) => x.failed);
  const signedIn = !!useSession((x) => x.userId);
  const [busy, setBusy] = useState(false);
  const lock = useLock();
  const [said, setSaid] = useState('');
  const [won, setWon] = useState(0);
  useFocusEffect(
    useCallback(() => {
      void loadRounds(true);
    }, []),
  );
  // Offline before the week was ever read: say so instead of an empty page (AP8).
  if (!r)
    return (
      <Screen tab={null} glow={21}>
        {failed ? (
          <InfoScroll>
            <Kicker>Grand Rounds</Kicker>
            <Text style={[ui.p, { color: c.mute }]}>Can’t reach MedNova right now. Check your connection and try again.</Text>
          </InfoScroll>
        ) : null}
      </Screen>
    );
  const cycleStart = r.week - slotOf(r.week);
  const stamped = new Set(r.stamps);

  const collect = (tier: number) =>
    lock(async () => {
      setBusy(true);
      const x = await claimRounds(tier);
      setBusy(false);
      if (x.ok && x.prize) setWon(x.prize);
      setSaid(
        x.ok ? `${CHEST_NAME[x.chest ?? 'wooden']} collected${x.stamp ? ' and this week is stamped' : ''}. Open it from the chest button on the Games page.`
        : 'Not saved yet: your plays are still reaching your account. Try again in a moment.',
      );
    });

  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>{`Week ${slotOf(r.week) + 1} of ${CYCLE_WEEKS}`}</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {'Grand '}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>Rounds</Text>
        </Text>

        <View style={[s.card, { backgroundColor: c.surf, borderColor: c.line }]}>
          <View style={s.head}>
            <WeekSign w={r.this} px={u(34)} t={t} />
            <View style={{ flex: 1 }}>
              <Text style={[s.wk, { color: c.fg }]}>{weekName(r.this)}</Text>
              <Text style={[s.goal, { color: c.mute }]}>{weekGoal(r.this)}</Text>
            </View>
          </View>
          <View style={{ marginTop: u(12) }}>
            <Beat r={r} more={false} />
          </View>
          <View style={{ gap: u(10), marginTop: u(14) }}>
            {r.missions.map((m, i) => {
              const reached = r.used >= m.of;
              const about = aboutGames(r.this, m.of);
              return (
                <View key={m.chest} style={s.mRow}>
                  <Image source={CHESTS[m.chest].art} style={[s.mChest, !reached && !m.claimed && { opacity: 0.45 }]} contentFit="contain" accessibilityLabel={CHEST_NAME[m.chest]} />
                  <View style={{ flex: 1 }}>
                    <View style={s.pRow}>
                      <Text style={[s.pN, { color: c.fg, flex: 1 }]} numberOfLines={1}>{`Mission ${i + 1}`}</Text>
                      <Text style={[s.pC, { color: reached ? t.accent : c.mute }]}>{`${Math.min(r.used, m.of)}/${m.of}`}</Text>
                    </View>
                    <View style={[s.track, { backgroundColor: t.chip }]}>
                      <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.fill, { width: `${Math.min(1, r.used / m.of) * 100}%` }]} />
                    </View>
                    <Text style={[s.mS, { color: c.mute }]}>{`${CHEST_NAME[m.chest]}${about ? ` · ${about}` : ''}${i === 2 ? ' · stamps the week' : ''}`}</Text>
                  </View>
                  {m.claimed ? (
                    <Text style={[s.mDone, { color: t.accent }]}>✓</Text>
                  ) : reached && signedIn ? (
                    <Btn t={t} label="Collect" tiny busy={busy} onPress={() => collect(i + 1)} />
                  ) : null}
                </View>
              );
            })}
          </View>
          <View style={[s.foot, { borderColor: c.line }]}>
            <View style={s.prize}>
              <Bolt size={u(13)} />
              <Text style={[s.prizeN, { color: c.fg }]}>{r.used}</Text>
              <Text style={[s.prizeS, { color: c.mute }]}>Sparks used this week</Text>
            </View>
          </View>
          {!signedIn ? (
            <Btn t={t} label="Sign in to take part" onPress={() => router.navigate('/auth')} />
          ) : r.claimed ? (
            <Text style={[s.done, { color: t.accent }]}>All 3 missions done. See you next week!</Text>
          ) : null}
        </View>

        {said ? <Text style={[s.said, { color: c.fg, borderColor: c.line, backgroundColor: c.surf }]}>{said}</Text> : null}

        <Kicker inSec>Your stamps</Kicker>
        <View style={s.stamps}>
          {CYCLE.map((w, i) => {
            const week = cycleStart + i;
            const got = stamped.has(week);
            const now = week === r.week;
            return (
              <View key={w.slot} style={[s.stamp, { borderColor: got ? t.accent : now ? c.chipOnLine : c.line, backgroundColor: got ? c.chipOnFill : 'transparent' }]}>
                <WeekSign w={w} px={u(20)} t={t} dim={!got && !now} />
                {got ? <Text style={[s.tick, { color: t.accent }]}>✓</Text> : null}
              </View>
            );
          })}
        </View>
        <Text style={[ui.p, { color: c.mute }]}>
          {`${r.cycle.have} of ${r.cycle.of} different weeks stamped: a stamp from every one pays ${r.cycle.prize} tokens. ${r.stamps.length} week${r.stamps.length === 1 ? '' : 's'} stamped in all; 13 earn the Grand Rounds frame.`}
        </Text>

        <Kicker inSec>Next week</Kicker>
        <View style={[s.head, { marginTop: u(6) }]}>
          <WeekSign w={r.next} px={u(26)} t={t} />
          <Text style={[s.nx, { color: c.fg }]}>{weekName(r.next)}</Text>
        </View>
        <Text style={[ui.p, { color: c.mute, marginTop: u(14) }]}>
          {'Weeks start Saturday 00:00 UTC. Every Spark you use on the week’s game counts, in any mode (in a mode week, on any game in that mode), once your phone has synced. Subscribers’ plays count at their usual price.'}
        </Text>
        <View style={{ height: u(30) }} />
      </InfoScroll>
      <Congrats open={won > 0} tokens={won} title="Every week stamped" line="A stamp from all 16 Grand Rounds weeks. Your tokens are in your wallet, and a new count starts now." onClose={() => setWon(0)} />
    </Screen>
  );
}

function Btn({ t, label, onPress, busy, coin, small, tiny }: { t: Theme; label: string; onPress: () => void; busy?: boolean; coin?: boolean; small?: boolean; tiny?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={[!small && !tiny && { marginTop: u(12) }, busy && { opacity: 0.6 }]}>
      <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={[s.btn, small && s.btnS, tiny && s.btnXS]}>
        <Text style={[s.btnT, tiny && s.btnXT, { color: t.onGrad }]}>{label}</Text>
        {coin ? <TokenCoin size={u(11)} progress={0} track="transparent" /> : null}
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: u(20), padding: u(14), marginTop: u(14) },
  head: { flexDirection: 'row', alignItems: 'center', gap: u(12) },
  wk: { fontFamily: F.display, fontSize: u(20), lineHeight: u(24) },
  goal: { fontFamily: F.body, fontSize: u(10.5), marginTop: u(2) },
  pRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: u(4) },
  pN: { fontFamily: F.bodySemi, fontSize: u(11) },
  pC: { fontFamily: F.mono, fontSize: u(9), letterSpacing: u(0.2), marginLeft: u(6) },
  track: { height: u(5), borderRadius: u(3), overflow: 'hidden' },
  fill: { height: '100%', borderRadius: u(3) },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, marginTop: u(14), paddingTop: u(10) },
  prize: { flexDirection: 'row', alignItems: 'center', gap: u(4) },
  prizeN: { fontFamily: F.display, fontSize: u(20) },
  prizeS: { fontFamily: F.body, fontSize: u(10.5), marginLeft: u(2) },
  done: { fontFamily: F.bodySemi, fontSize: u(11.5), textAlign: 'center', marginTop: u(12) },
  said: { fontFamily: F.bodyMedium, fontSize: u(11), lineHeight: u(15), marginTop: u(10), borderWidth: 1, borderRadius: u(12), paddingVertical: u(8), paddingHorizontal: u(12), overflow: 'hidden' },
  mRow: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  mChest: { width: u(40), height: u(40) },
  mS: { fontFamily: F.body, fontSize: u(9.5), marginTop: u(3) },
  mDone: { fontFamily: F.bodyBold, fontSize: u(16), width: u(24), textAlign: 'center' },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8), marginTop: u(8) },
  stamp: { width: u(44), height: u(44), borderRadius: u(22), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tick: { position: 'absolute', right: u(-2), top: u(-4), fontFamily: F.bodyBold, fontSize: u(11) },
  nx: { fontFamily: F.display, fontSize: u(16) },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: u(4), height: u(40), borderRadius: 999, paddingHorizontal: u(16) },
  btnS: { height: u(32), paddingHorizontal: u(14) },
  btnXS: { height: u(26), paddingHorizontal: u(10) },
  btnXT: { fontSize: u(10.5) },
  btnT: { fontFamily: F.bodyBold, fontSize: u(12.5) },
});
