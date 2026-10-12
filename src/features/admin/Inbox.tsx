import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Text, TextInput } from '@/components/AppText';
import { GradBtn, Kicker, s as ui, type useInfo } from '@/features/info/ui';
import { PROMPTS } from '@/features/store/FreeTokens';
import { call } from '@/online/api';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

type C = ReturnType<typeof useInfo>;
type What = 'contact' | 'feedback' | 'stories' | 'ambassador' | 'cases';
type Item = Record<string, unknown> & { id: string; status: string; created_at: string; username: string | null };

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const str = (v: unknown) => (v == null ? '' : String(v));

const KINDS: { key: What; label: string; open: string; note: string }[] = [
  { key: 'contact', label: 'Contact', open: 'new', note: 'Messages from the Contact page.' },
  { key: 'feedback', label: 'Feedback', open: 'new', note: 'Feedback from the Store free tokens row.' },
  { key: 'stories', label: 'Stories', open: 'new', note: 'Stories are anonymous unless the player ticked "Credit me".' },
  { key: 'ambassador', label: 'Ambassador', open: 'pending', note: 'Approving a video pays the player 50 tokens once.' },
  { key: 'cases', label: 'Cases', open: 'waiting', note: 'Approved cases become playable, only by their maker, as practice.' },
];

/** Admin inbox: everything players send in (besides reports), with mark done or approve / decline. */
export function Inbox({ c }: { c: C }) {
  const [what, setWhat] = useState<What>('contact');
  const [show, setShow] = useState<'open' | 'all'>('open');
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState(false);
  const kind = KINDS.find((k) => k.key === what)!;
  useEffect(() => {
    setItems(null);
    setErr(false);
    call<Item[]>('admin_inbox', { what, show })
      .then((r) => setItems(r ?? []))
      .catch(() => (setErr(true), setItems([])));
  }, [what, show]);
  const decide = async (it: Item, ok: boolean) => {
    try {
      await call('admin_decide', { what, item: it.id, ok });
    } catch {
      return setErr(true);
    }
    const status = what === 'cases' ? (ok ? 'approved' : 'declined') : what === 'ambassador' ? (ok ? 'approved' : 'rejected') : ok ? 'done' : 'new';
    setItems((l) => (l ?? []).flatMap((x) => (x.id !== it.id ? [x] : show === 'open' ? [] : [{ ...x, status }])));
  };
  const twoWay = what === 'cases' || what === 'ambassador';
  return (
    <>
      <Text style={[ui.H, s.H, s.gapL, { color: c.fg }]}>Inbox</Text>
      <Text style={[ui.p, { color: c.mute }]}>{kind.note}</Text>
      <View style={[s.tabs, s.gapS]}>
        {KINDS.map((k) => (
          <Pressable key={k.key} onPress={() => setWhat(k.key)} accessibilityRole="tab" accessibilityState={{ selected: what === k.key }}>
            <Text style={[s.tab, { color: what === k.key ? c.t.accent : c.mute }]}>{k.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[s.tabs, s.gapS]}>
        {(['open', 'all'] as const).map((k) => (
          <Pressable key={k} onPress={() => setShow(k)} accessibilityRole="tab" accessibilityState={{ selected: show === k }}>
            <Text style={[s.sub, { color: show === k ? c.t.accent : c.mute }]}>{k === 'open' ? (twoWay ? 'Waiting' : 'New') : 'All'}</Text>
          </Pressable>
        ))}
      </View>
      {err ? <Text style={[s.small, { color: c.t.red }]}>Could not load or save. Check the connection.</Text> : null}
      {items && !items.length ? <Text style={[s.small, s.gapS, { color: c.mute }]}>{show === 'open' ? 'Nothing waiting.' : 'Nothing yet.'}</Text> : null}
      <View style={s.list}>
        {(items ?? []).map((it) => {
          const shut = it.status !== kind.open;
          return (
            <View key={it.id} style={[s.rep, { borderColor: c.line, opacity: shut ? 0.55 : 1 }]}>
              <Text style={[s.small, { color: c.mute }]}>{`${head(what, it)} · ${when(it.created_at)} · ${it.username ? '@' + it.username : 'Guest'}${shut ? ' · ' + it.status.toUpperCase() : ''}`}</Text>
              <Body c={c} what={what} it={it} />
              <View style={s.acts}>
                {twoWay ? (
                  !shut ? (
                    <>
                      <Act c={c} label="Approve" onPress={() => decide(it, true)} />
                      <Act c={c} label="Decline" mute onPress={() => decide(it, false)} />
                    </>
                  ) : null
                ) : (
                  <Act c={c} label={shut ? 'Mark new' : 'Mark done'} onPress={() => decide(it, !shut)} />
                )}
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}

function head(what: What, it: Item) {
  if (what === 'contact') return str(it.kind).toUpperCase();
  if (what === 'stories') return (PROMPTS[Number(it.prompt)] ?? 'Story').toUpperCase() + (it.credit ? ` · CREDIT ${str(it.display_name)}` : ' · ANONYMOUS');
  if (what === 'ambassador') return 'VIDEO';
  if (what === 'cases') return 'CASE';
  return 'FEEDBACK';
}

function Body({ c, what, it }: { c: C; what: What; it: Item }) {
  const p = [s.body, { color: c.fg }];
  if (what === 'ambassador') {
    const url = str(it.video_url);
    return (
      <>
        <Text style={p}>{`${str(it.email)} · ${str(it.game_name)}`}</Text>
        <Pressable onPress={() => Linking.openURL(url).catch(() => undefined)} accessibilityRole="link">
          <Text style={[s.body, { color: c.t.accent }]} numberOfLines={1}>{url}</Text>
        </Pressable>
      </>
    );
  }
  if (what === 'cases') {
    const findings = (it.findings as string[] | null) ?? [];
    return (
      <>
        <Text style={[s.name, { color: c.fg }]}>{str(it.diagnosis)}</Text>
        <Text style={[s.small, { color: c.mute }]}>{`${str(it.field) || 'No field'} · ${str(it.gender)}, ${str(it.age)}`}</Text>
        <Text style={p}>{str(it.presentation)}</Text>
        {[['History', it.history], ['Exam', it.exam], ['Investigation', it.investigation]].map(([k, v]) => (str(v) ? <Text key={String(k)} style={p}>{`${k}: ${str(v)}`}</Text> : null))}
        {findings.map((f, i) => (
          <Text key={i} style={p}>{`Key finding ${i + 1}: ${f}`}</Text>
        ))}
      </>
    );
  }
  return <Text style={p}>{str(it.body) || '(no text)'}</Text>;
}

const Act = ({ c, label, mute, onPress }: { c: C; label: string; mute?: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} accessibilityRole="button">
    <Text style={[s.act, { color: mute ? c.mute : c.t.accent }]}>{label}</Text>
  </Pressable>
);

/** The live count behind the global 100k mission (until a daily store job sets it). */
export function Downloads({ c }: { c: C }) {
  const [now, setNow] = useState<number | null>(null);
  const [n, setN] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    call<{ downloads?: number }>('free_status')
      .then((r) => setNow(Number(r?.downloads ?? 0)))
      .catch(() => undefined);
  }, []);
  const save = async () => {
    const v = Math.trunc(Number(n));
    if (!(v >= 0)) return setMsg('Type a number.');
    try {
      await call('admin_set_downloads', { n: v });
      setNow(v);
      setN('');
      setMsg(`Saved. The bar now shows ${v.toLocaleString('en-GB')} of 100,000.`);
    } catch {
      setMsg('Not saved. Check the connection.');
    }
  };
  return (
    <>
      <Text style={[ui.H, s.H, s.gapL, { color: c.fg }]}>Downloads</Text>
      <Text style={[ui.p, { color: c.mute }]}>The global mission bar in the Store. Reaching 100,000 opens the 200-token reward.</Text>
      <Kicker style={s.gapS}>{now == null ? 'Loading' : `Now ${now.toLocaleString('en-GB')}`}</Kicker>
      <TextInput value={n} onChangeText={(v) => setN(v.replace(/\D/g, ''))} placeholder="New total" placeholderTextColor={c.mute} keyboardType="number-pad" style={[s.in, s.gapS, { backgroundColor: c.surf, borderColor: c.line, color: c.fg }]} />
      <GradBtn label="Save total" onPress={save} style={s.gapS} />
      {msg ? <Text style={[ui.p, { color: c.fg }]}>{msg}</Text> : null}
    </>
  );
}

const s = StyleSheet.create({
  H: { fontFamily: F.display },
  gapS: { marginTop: u(8) },
  gapL: { marginTop: u(32) },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: u(14), rowGap: u(4) },
  tab: { fontFamily: F.display, fontSize: u(14) },
  sub: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  rep: { borderWidth: 1, borderRadius: u(14), paddingVertical: u(10), paddingHorizontal: u(12), gap: u(4) },
  body: { fontFamily: F.body, fontSize: u(11), lineHeight: u(15) },
  name: { fontFamily: F.display, fontSize: u(14) },
  in: { borderWidth: 1, borderRadius: u(14), paddingHorizontal: u(12), height: u(38), fontFamily: F.body, fontSize: u(11) },
  list: { gap: u(6), marginTop: u(8) },
  small: { fontFamily: F.body, fontSize: u(9), marginTop: u(2) },
  acts: { flexDirection: 'row', gap: u(16), marginTop: u(2) },
  act: { fontFamily: F.bodySemi, fontSize: u(10) },
});
