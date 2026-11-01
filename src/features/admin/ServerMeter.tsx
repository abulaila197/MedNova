import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { GAMES } from '@/data/games';
import { useInfo } from '@/features/info/ui';
import { supabase } from '@/lib/supabase';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

type Meter = {
  open: boolean;
  resumes_at: string;
  resumes_day?: string;
  month_end: string;
  month_online_mb: number;
  week_share_mb: number;
  allowed_so_far_mb: number;
  used_month_mb: number;
  used_week_mb: number;
  left_mb: number;
  left_hours: number;
  playing: number;
  watching: number;
  in_lobby: number;
  live_matches: number;
  busy_limit: number;
  in_line: number;
  by_game: Record<string, number>;
};

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const gameName = (k: string) => {
  const g = GAMES.find((x) => x.key === k);
  return g ? `${g.lead} ${g.em}`.trim() : k;
};

/**
 * Admin: the live online meter (Yazan 2026-11-01). Players online right now and this week's online data share,
 * refreshed every 10 s while the page is open. The data numbers are the server's own estimate; Supabase's
 * Usage page has the real total.
 */
export function ServerMeter() {
  const c = useInfo();
  const [m, setM] = useState<Meter | null>(null);
  const [off, setOff] = useState(false);
  useFocusEffect(
    useCallback(() => {
      const load = () =>
        supabase.rpc('online_admin').then(({ data, error }) => {
          if (error) {
            setOff(true);
            return;
          }
          setM(data as Meter);
          setOff(false);
        });
      load();
      const id = setInterval(load, 10000);
      return () => clearInterval(id);
    }, []),
  );
  const box = [s.box, { borderColor: c.line }];
  if (!m) {
    return (
      <View style={box}>
        <Text style={[s.k, { color: c.mute }]}>ONLINE SERVER</Text>
        <Text style={[s.small, { color: c.mute }]}>{off ? 'The meter isn’t on the server yet (paste the Group 10 SQL).' : 'Loading…'}</Text>
      </View>
    );
  }
  const pct = m.allowed_so_far_mb ? Math.min(1, m.used_month_mb / m.allowed_so_far_mb) : 1;
  const games = Object.entries(m.by_game).sort((a, b) => b[1] - a[1]);
  return (
    <View style={box}>
      <Text style={[s.k, { color: c.mute }]}>ONLINE SERVER · LIVE</Text>
      <View style={s.nums}>
        <Num c={c} n={m.playing} l="playing" />
        <Num c={c} n={m.watching} l="watching" />
        <Num c={c} n={m.in_lobby} l="in lobbies" />
        <Num c={c} n={m.live_matches} l="matches" />
      </View>
      <Text style={[s.small, { color: c.mute }]}>
        {`Busy line starts at ${m.busy_limit} players · ${m.in_line ? `${m.in_line} room${m.in_line > 1 ? 's' : ''} waiting` : 'nobody waiting'}`}
      </Text>
      {games.length ? <Text style={[s.small, { color: c.mute }]}>{games.map(([k, n]) => `${gameName(k)} ${n}`).join(' · ')}</Text> : null}

      <Text style={[s.k, s.gap, { color: c.mute }]}>{m.open ? 'ONLINE DATA · OPEN' : `ONLINE DATA · RESTING UNTIL ${(m.resumes_day ?? day(m.resumes_at)).toUpperCase()}`}</Text>
      <View style={[s.bar, { backgroundColor: c.line }]}>
        <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: pct > 0.85 ? '#ff6b6b' : '#6fd3a4' }]} />
      </View>
      <Text style={[s.line, { color: c.fg }]}>{`${m.left_mb} MB left until ${m.resumes_day ?? day(m.resumes_at)} (about ${m.left_hours} player-hours)`}</Text>
      <Text style={[s.small, { color: c.mute }]}>
        {`This week ${m.used_week_mb} MB used of a ${m.week_share_mb} MB share (plus what earlier weeks didn’t use). This month ${m.used_month_mb} of ${m.month_online_mb} MB for online; the month restarts ${day(m.month_end)}. Estimate; Supabase’s Usage page has the real total.`}
      </Text>
    </View>
  );
}

function Num({ c, n, l }: { c: ReturnType<typeof useInfo>; n: number; l: string }) {
  return (
    <View style={s.num}>
      <Text style={[s.n, { color: c.fg }]}>{n}</Text>
      <Text style={[s.small, { color: c.mute }]}>{l}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: u(14), padding: u(12), gap: u(6), marginTop: u(10) },
  k: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.2) },
  gap: { marginTop: u(8) },
  nums: { flexDirection: 'row', justifyContent: 'space-between' },
  num: { alignItems: 'center', flex: 1 },
  n: { fontFamily: F.display, fontSize: u(20) },
  small: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13) },
  line: { fontFamily: F.bodySemi, fontSize: u(11.5) },
  bar: { height: u(6), borderRadius: u(3), overflow: 'hidden' },
  fill: { height: '100%', borderRadius: u(3) },
});
