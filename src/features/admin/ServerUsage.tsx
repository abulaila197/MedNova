import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import type { useInfo } from '@/features/info/ui';
import { supabase } from '@/lib/supabase';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

type Usage = {
  stop_at: number;
  checked_at: string | null;
  db_mb: number;
  db_limit_mb: number;
  files_mb: number;
  files_limit_mb: number;
  signins: number;
  signins_limit: number;
  month_start: string;
  month_end: string;
  players: number;
  new_players: number;
  plays: number;
};

const USAGE_PAGE = 'https://supabase.com/dashboard/project/exzpezkqlxeceexkjibl/usage';
const RED = '#ff6b6b';
const GREEN = '#6fd3a4';
const AMBER = '#f5b041';
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * Admin: the whole server's use of the free plan this usage month (Yazan 2026-11-11; it starts on the 6th).
 * Real numbers, read fresh when the page opens. Past 95% of any limit it turns red and the server sends you a
 * notification. Data transfer can't be read by the server, so it links to Supabase's own Usage page.
 */
export function ServerUsage({ c }: { c: ReturnType<typeof useInfo> }) {
  const [m, setM] = useState<Usage | null>(null);
  const [off, setOff] = useState(false);
  useFocusEffect(
    useCallback(() => {
      supabase.rpc('admin_server_usage').then(({ data, error }) => {
        if (error) return setOff(true);
        setM(data as Usage);
        setOff(false);
      });
    }, []),
  );
  const box = [s.box, { borderColor: c.line }];
  if (!m) {
    return (
      <View style={box}>
        <Text style={[s.k, { color: c.mute }]}>SERVER THIS MONTH</Text>
        <Text style={[s.small, { color: c.mute }]}>{off ? 'Not on the server yet (paste the 2026-11-11 SQL).' : 'Loading…'}</Text>
      </View>
    );
  }
  const rows = [
    { l: 'Database', a: m.db_mb, b: m.db_limit_mb, unit: ' MB' },
    { l: 'Stored files', a: m.files_mb, b: m.files_limit_mb, unit: ' MB' },
    { l: 'Signed-in players', a: m.signins, b: m.signins_limit, unit: '' },
  ];
  const hit = rows.some((r) => r.b && r.a / r.b >= m.stop_at);
  return (
    <View style={box}>
      <Text style={[s.k, { color: hit ? RED : c.mute }]}>
        {hit ? `SERVER THIS MONTH · ${Math.round(m.stop_at * 100)}% REACHED` : `SERVER THIS MONTH · ${day(m.month_start)} TO ${day(m.month_end)}`}
      </Text>
      {rows.map((r) => {
        const pct = r.b ? Math.min(1, r.a / r.b) : 0;
        const col = pct >= m.stop_at ? RED : pct >= 0.75 ? AMBER : GREEN;
        return (
          <View key={r.l} style={s.row}>
            <View style={s.rowTop}>
              <Text style={[s.line, { color: c.fg }]}>{r.l}</Text>
              <Text style={[s.line, { color: c.fg }]}>{`${r.a.toLocaleString('en-GB')} of ${r.b.toLocaleString('en-GB')}${r.unit} · ${Math.round(pct * 1000) / 10}%`}</Text>
            </View>
            <View style={[s.bar, { backgroundColor: c.line }]}>
              <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: col }]} />
            </View>
          </View>
        );
      })}
      <Text style={[s.small, { color: c.mute }]}>
        {`${m.players.toLocaleString('en-GB')} players in all · ${m.new_players.toLocaleString('en-GB')} new this month · ${m.plays.toLocaleString('en-GB')} games finished this month.`}
      </Text>
      <Text style={[s.small, { color: c.mute }]}>
        {`Warning at ${Math.round(m.stop_at * 100)}%: you get a notification. Checked every hour${m.checked_at ? ` (now ${new Date(m.checked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })})` : ''}.`}
      </Text>
      <Pressable onPress={() => Linking.openURL(USAGE_PAGE)} accessibilityRole="link">
        <Text style={[s.small, { color: c.t.accent }]}>Data transfer: open Supabase’s Usage page</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: u(14), padding: u(12), gap: u(8), marginTop: u(10) },
  k: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.2) },
  row: { gap: u(4) },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: u(8) },
  small: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13) },
  line: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  bar: { height: u(6), borderRadius: u(3), overflow: 'hidden' },
  fill: { height: '100%', borderRadius: u(3) },
});
