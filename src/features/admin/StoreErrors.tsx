import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import type { useInfo } from '@/features/info/ui';
import { ADMIN_PAGE as PAGE, ShowMore } from '@/features/admin/ShowMore';
import { supabase } from '@/lib/supabase';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

type Row = { id: number; at: string; stage: string; product: string | null; platform: string | null; app: string | null; device: string | null; storefront: string | null; found: number | null; code: string | null; message: string | null; underlying: string | null; user_id: string };

/**
 * Admin: what Apple or Google answered when a purchase, a restore or loading the products went wrong, newest first
 * (store_errors, 2026-11-16). Each row has the store's own error, the store country, the phone and the app build.
 * Ten at a time (ShowMore): each tap fetches the next ten; Refresh starts again from the newest.
 */
export function StoreErrors({ c }: { c: ReturnType<typeof useInfo> }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Puts a fetched page in: from 0 replaces the list, later pages go under it. */
  const take = useCallback((from: number, p: Page) => {
    setBusy(false);
    setErr(p.error);
    if (p.error) return;
    setMore(p.more);
    setRows((was) => (from === 0 ? p.rows : [...(was ?? []), ...p.rows]));
  }, []);
  const load = (from: number) => {
    if (busy) return;
    setBusy(true);
    void fetchPage(from).then((p) => take(from, p));
  };
  useEffect(() => {
    let live = true;
    void fetchPage(0).then((p) => live && take(0, p));
    return () => {
      live = false;
    };
  }, [take]);
  return (
    <View style={[s.box, { backgroundColor: c.surf, borderColor: c.line }]}>
      <View style={s.head}>
        <Text style={[s.k, { color: c.kick }]}>STORE ERRORS</Text>
        <Pressable onPress={() => load(0)} hitSlop={u(8)} accessibilityRole="button">
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
      {more ? <ShowMore c={c} busy={busy} onPress={() => load(rows?.length ?? 0)} /> : null}
    </View>
  );
}

type Page = { rows: Row[]; more: boolean; error: string | null };

/** PAGE rows from `from`, newest first; asks for one extra to know whether there are more. */
async function fetchPage(from: number): Promise<Page> {
  const { data, error } = await supabase
    .from('store_errors')
    .select('*')
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + PAGE);
  if (error) return { rows: [], more: false, error: error.message };
  return { rows: (data as Row[]).slice(0, PAGE), more: data.length > PAGE, error: null };
}

const s = StyleSheet.create({
  box: { marginTop: u(14), borderWidth: 1, borderRadius: u(14), padding: u(12), gap: u(8) },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  k: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.5) },
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: u(8), gap: u(3) },
  name: { fontFamily: F.bodySemi, fontSize: u(11) },
  sub: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13) },
});
