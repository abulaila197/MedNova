import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text, TextInput } from '@/components/AppText';
import { s as ui, type useInfo } from '@/features/info/ui';
import { gameLabel } from '@/features/learn/NewWord';
import { call } from '@/online/api';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

type C = ReturnType<typeof useInfo>;
type Value = string | number | string[] | null;
type Sub = { kind: 'case' | 'word'; id: string; game: string; status: 'waiting' | 'approved' | 'declined'; note: string | null; created_at: string; username: string | null; data: Record<string, Value> };

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
// Fields Admin may not change (the case's picked answer and the patient's gender stay as written).
const FIXED = ['answer_id', 'gender'];
const LABEL: Record<string, string> = { stem: 'Question', answer: 'Right choice (0 = first)', a: 'Disease 1', b: 'Disease 2', category: 'Field', aliases: 'Other names', forbidden: 'Forbidden words' };
const label = (k: string) => LABEL[k] ?? k[0].toUpperCase() + k.slice(1).replace('_', ' ');

/**
 * My diseases on the Admin page (Yazan 2026-10-26, #26): every case and word players sent, newest first. Edit any
 * field, add a note the player sees, then approve (pays them 10 tokens once, 5 a day at most) or decline.
 */
export function Submissions({ c, show }: { c: C; show: 'open' | 'all' }) {
  const [items, setItems] = useState<Sub[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    setItems(null);
    call<Sub[]>('admin_submissions', { show: show === 'open' ? 'waiting' : 'all' })
      .then((r) => live && setItems(r ?? []))
      .catch(() => live && (setErr('Could not load. Check the connection.'), setItems([])));
    return () => {
      live = false;
    };
  }, [show]);
  const done = (id: string, status: Sub['status'], note: string | null, data: Sub['data']) =>
    setItems((l) => (l ?? []).flatMap((x) => (x.id !== id ? [x] : show === 'open' ? [] : [{ ...x, status, note, data }])));
  return (
    <>
      {err ? <Text style={[s.small, { color: c.t.error }]}>{err}</Text> : null}
      {items && !items.length ? <Text style={[s.small, { color: c.mute, marginTop: u(8) }]}>{show === 'open' ? 'Nothing waiting.' : 'Nothing yet.'}</Text> : null}
      <View style={s.list}>
        {(items ?? []).map((it) => (
          <One key={it.id} c={c} it={it} onDone={done} onErr={setErr} />
        ))}
      </View>
    </>
  );
}

function One({ c, it, onDone, onErr }: { c: C; it: Sub; onDone: (id: string, st: Sub['status'], note: string | null, data: Sub['data']) => void; onErr: (m: string) => void }) {
  const [data, setData] = useState(it.data);
  const [note, setNote] = useState(it.note ?? '');
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState('');
  const changed = JSON.stringify(data) !== JSON.stringify(it.data);
  const field = [s.in, { backgroundColor: c.surf, borderColor: c.line, color: c.fg }];
  const set = (k: string, v: Value) => setData((d) => ({ ...d, [k]: v }));
  const review = async (status: 'approved' | 'declined') => {
    setBusy(true);
    onErr('');
    try {
      const edit = changed ? { ...data, age: data.age == null ? undefined : Number(data.age), answer: data.answer == null ? undefined : Number(data.answer) } : null;
      const r = await call<{ ok: boolean; paid?: boolean }>('admin_review', { kind: it.kind, item: it.id, status, note: note.trim() || null, edit });
      if (r?.paid) setPaid('Approved and 10 tokens paid.');
      onDone(it.id, status, note.trim() || null, data);
    } catch (e) {
      onErr(String((e as { message?: string })?.message ?? '').includes('missing') ? 'An edited field is empty or wrong; fix it and try again.' : 'Not saved. Check the connection.');
    }
    setBusy(false);
  };
  const shut = it.status !== 'waiting';
  return (
    <View style={[s.rep, { borderColor: c.line, opacity: shut ? 0.6 : 1 }]}>
      <Text style={[s.small, { color: c.mute }]}>
        {`${it.kind === 'case' ? 'DP CASE' : `${gameLabel(it.game).toUpperCase()} WORD`} · ${when(it.created_at)} · ${it.username ? '@' + it.username : 'Player'}${shut ? ' · ' + it.status.toUpperCase() : ''}`}
      </Text>
      {Object.entries(data).map(([k, v]) =>
        FIXED.includes(k) ? (
          <Text key={k} style={[s.small, { color: c.mute }]}>{`${label(k)}: ${v ?? '-'}`}</Text>
        ) : Array.isArray(v) ? (
          <View key={k} style={{ gap: u(4) }}>
            <Text style={[s.small, { color: c.mute }]}>{label(k)}</Text>
            {v.map((x, i) => (
              <TextInput key={i} value={x} onChangeText={(t) => set(k, v.map((y, j) => (j === i ? t : y)))} editable={!shut} style={field} />
            ))}
          </View>
        ) : (
          <View key={k} style={{ gap: u(4) }}>
            <Text style={[s.small, { color: c.mute }]}>{label(k)}</Text>
            <TextInput value={v == null ? '' : String(v)} onChangeText={(t) => set(k, typeof it.data[k] === 'number' ? t.replace(/\D/g, '') : t)} editable={!shut} multiline={String(v ?? '').length > 50} style={[field, String(v ?? '').length > 50 && s.big]} keyboardType={typeof it.data[k] === 'number' ? 'number-pad' : 'default'} />
          </View>
        ),
      )}
      {!shut ? (
        <>
          <TextInput value={note} onChangeText={setNote} placeholder="Note to the player (optional)" placeholderTextColor={c.mute} maxLength={300} style={field} />
          <View style={s.acts}>
            <Pressable disabled={busy} onPress={() => review('approved')} accessibilityRole="button">
              <Text style={[s.act, { color: c.t.accent }]}>{changed ? 'Save edits and approve' : 'Approve'}</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={() => review('declined')} accessibilityRole="button">
              <Text style={[s.act, { color: c.mute }]}>Decline</Text>
            </Pressable>
          </View>
        </>
      ) : it.note ? (
        <Text style={[ui.p, { color: c.mute }]}>{`Note: ${it.note}`}</Text>
      ) : null}
      {paid ? <Text style={[s.small, { color: c.t.accent }]}>{paid}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  rep: { borderWidth: 1, borderRadius: u(14), paddingVertical: u(10), paddingHorizontal: u(12), gap: u(6) },
  list: { gap: u(6), marginTop: u(8) },
  small: { fontFamily: F.body, fontSize: u(9), marginTop: u(2) },
  in: { borderWidth: 1, borderRadius: u(10), paddingHorizontal: u(10), minHeight: u(32), fontFamily: F.body, fontSize: u(10.5) },
  big: { minHeight: u(64), paddingTop: u(7), textAlignVertical: 'top' },
  acts: { flexDirection: 'row', gap: u(16), marginTop: u(2) },
  act: { fontFamily: F.bodySemi, fontSize: u(10) },
});
