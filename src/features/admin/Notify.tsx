import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text, TextInput } from '@/components/AppText';
import { GradBtn, s as ui, type useInfo } from '@/features/info/ui';
import { supabase } from '@/lib/supabase';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

type C = ReturnType<typeof useInfo>;
type Kind = 'update' | 'news';
type Log = { kind: Kind; title: string; body: string; phones: number; at: string };

const UPDATE = { title: 'A new MedNova is here', body: 'Update now for the newest games and fixes. Tap to open the store.' };
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const WHY: Record<string, string> = {
  too_soon: 'Wait a minute between sends.',
  empty: 'Write a title and a text first.',
};

/**
 * Push notifications to every phone (Yazan 2026-11-12). Announce update: a fixed note whose tap opens the store page
 * (Google Play or the App Store). Send notification: your own title and text; it skips players who switched
 * reminders off in Settings. Both ask for a second tap, and the server allows one send a minute.
 */
export function Notify({ c }: { c: C }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sure, setSure] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [log, setLog] = useState<Log[] | null>(null);
  // Bumped after a send, so the list below reloads.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void supabase.rpc('admin_push_sent').then(({ data }) => {
      if (live) setLog((data as Log[]) ?? []);
    });
    return () => {
      live = false;
    };
  }, [tick]);

  const send = async (kind: Kind) => {
    if (busy) return;
    const t = kind === 'update' ? UPDATE.title : title.trim();
    const b = kind === 'update' ? UPDATE.body : body.trim();
    if (!t || !b) return setMsg({ text: WHY.empty, bad: true });
    if (sure !== kind) return setSure(kind);
    setSure(null);
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_push_all', { kind, title: t, body: b });
    setBusy(false);
    if (error) {
      const why = Object.keys(WHY).find((k) => error.message?.includes(k));
      return setMsg({ text: why ? WHY[why] : 'Not sent. Check the connection.', bad: true });
    }
    const n = Number((data as { phones?: number } | null)?.phones ?? 0);
    setMsg({ text: `Sent to ${n} phone${n === 1 ? '' : 's'}.` });
    if (kind === 'news') {
      setTitle('');
      setBody('');
    }
    setTick((x) => x + 1);
  };

  const field = [s.in, { backgroundColor: c.surf, borderColor: c.line, color: c.fg }];
  return (
    <>
      <Text style={[ui.H, s.H, s.gapL, { color: c.fg }]}>Push notifications</Text>
      <Text style={[ui.p, { color: c.mute }]}>Goes to every phone that allowed notifications. Tap twice to send.</Text>

      <View style={[s.card, s.gap, { borderColor: c.line }]}>
        <Text style={[s.name, { color: c.fg }]}>Announce update</Text>
        <Text style={[s.small, { color: c.mute }]}>{`“${UPDATE.title}” · ${UPDATE.body}`}</Text>
        <Text style={[s.small, { color: c.mute }]}>Reaches everyone, even with reminders off. Send it once the new version is live in both stores.</Text>
        <GradBtn label={sure === 'update' ? 'Tap again to announce the update' : 'Announce update'} onPress={() => void send('update')} style={s.gapS} />
      </View>

      <View style={[s.card, s.gap, { borderColor: c.line }]}>
        <Text style={[s.name, { color: c.fg }]}>Send notification</Text>
        <TextInput value={title} onChangeText={(v) => (setTitle(v), setSure(null))} placeholder="Title" placeholderTextColor={c.mute} maxLength={60} style={[field, s.gapS]} />
        <TextInput value={body} onChangeText={(v) => (setBody(v), setSure(null))} placeholder="Text (up to 160 letters)" placeholderTextColor={c.mute} maxLength={160} multiline style={[field, s.gapS, s.multi]} />
        <Text style={[s.small, { color: c.mute }]}>{`${body.length}/160 · skips players who switched reminders off`}</Text>
        <GradBtn label={sure === 'news' ? 'Tap again to send to every phone' : 'Send to all players'} onPress={() => void send('news')} style={s.gapS} />
      </View>
      {msg ? <Text style={[ui.p, s.gapS, { color: msg.bad ? c.t.error : c.fg }]}>{msg.text}</Text> : null}

      {log?.length ? (
        <View style={s.list}>
          {log.map((l, i) => (
            <View key={i} style={[s.card, { borderColor: c.line }]}>
              <Text style={[s.small, { color: c.mute }]}>{`${when(l.at)} · ${l.kind === 'update' ? 'Update' : 'Notification'} · ${l.phones} phone${l.phones === 1 ? '' : 's'}`}</Text>
              <Text style={[s.name, { color: c.fg }]}>{l.title}</Text>
              <Text style={[s.small, { color: c.fg }]}>{l.body}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {sure ? (
        <Pressable onPress={() => setSure(null)} accessibilityRole="button" style={s.gapS}>
          <Text style={[s.small, { color: c.mute }]}>Cancel</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  H: { fontFamily: F.display },
  gap: { marginTop: u(16) },
  gapS: { marginTop: u(8) },
  gapL: { marginTop: u(32) },
  card: { borderWidth: 1, borderRadius: u(14), paddingVertical: u(10), paddingHorizontal: u(12), gap: u(4) },
  in: { borderWidth: 1, borderRadius: u(14), paddingHorizontal: u(12), height: u(38), fontFamily: F.body, fontSize: u(11) },
  multi: { height: u(70), paddingTop: u(10), textAlignVertical: 'top' },
  list: { gap: u(6), marginTop: u(10) },
  name: { fontFamily: F.bodyBold, fontSize: u(12) },
  small: { fontFamily: F.body, fontSize: u(10), lineHeight: u(14) },
});
