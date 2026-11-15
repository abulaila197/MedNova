import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import type { useInfo } from '@/features/info/ui';
import { supabase } from '@/lib/supabase';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

type Row = { id: number; at: string; stage: string; product: string | null; platform: string | null; app: string | null; device: string | null; storefront: string | null; found: number | null; code: string | null; message: string | null; underlying: string | null; user_id: string };

/**
 * Admin: what Apple or Google answered when a purchase, a restore or loading the products went wrong, newest first
 * (store_errors, 2026-11-16). Each row has the store's own error, the store country, the phone and the app build.
 */
export function StoreErrors({ c }: { c: ReturnType<typeof useInfo> }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    setErr(null);
    const { data, error } = await supabase.from('store_errors').select('*').order('at', { ascending: false }).limit(30);
    if (error) setErr(error.message);
    else setRows(data as Row[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <View style={[s.box, { backgroundColor: c.surf, borderColor: c.line }]}>
      <View style={s.head}>
        <Text style={[s.k, { color: c.kick }]}>STORE ERRORS</Text>
        <Pressable onPress={load} hitSlop={u(8)} accessibilityRole="button">
          <Text style={[s.k, { color: c.t.accent }]}>REFRESH</Text>
        </Pressable>
      </View>
      {err ? <Text style={[s.sub, { color: c.t.error }]}>{err}</Text> : null}
      {rows && !rows.length ? <Text style={[s.sub, { color: c.mute }]}>No store errors.</Text> : null}
      {(rows ?? []).map((r) => (
        <View key={r.id} style={[s.row, { borderTopColor: c.line }]}>
          <Text style={[s.name, { color: c.fg }]}>
            {r.stage} · {r.product ?? '–'} · {r.storefront ?? 'no country'}
            {r.found != null ? ` · ${r.found} found` : ''}
          </Text>
          <Text style={[s.sub, { color: c.fg }]} selectable>
            {[r.code, r.message].filter(Boolean).join(': ')}
          </Text>
          {r.underlying ? (
            <Text style={[s.sub, { color: c.mute }]} selectable>
              {r.underlying}
            </Text>
          ) : null}
          <Text style={[s.sub, { color: c.mute }]} selectable>
            {new Date(r.at).toLocaleString()} · {r.platform} · {r.device} · app {r.app} · {r.user_id.slice(0, 8)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  box: { marginTop: u(14), borderWidth: 1, borderRadius: u(14), padding: u(12), gap: u(8) },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  k: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.5) },
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: u(8), gap: u(3) },
  name: { fontFamily: F.bodySemi, fontSize: u(11) },
  sub: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13) },
});
