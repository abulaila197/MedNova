import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/AppText';

import { Screen } from '@/components/Screen';
import { Downloads, Inbox } from '@/features/admin/Inbox';
import { GradBtn, InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { supabase } from '@/lib/supabase';
import { useAccount } from '@/state/account';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

type Player = { id: string; username: string; display_name: string; tokens: number };
type ChestPick = '' | 'wooden' | 'golden' | 'diamond' | 'epic';
type Sent = { id: string; title: string; tokens: number; sparks: number; chest: string | null; at: string; to: string | null; read: number; collected: number };
const CHEST_PICKS: { k: ChestPick; label: string }[] = [
  { k: '', label: 'No chest' },
  { k: 'wooden', label: 'Wooden' },
  { k: 'golden', label: 'Golden' },
  { k: 'diamond', label: 'Diamond' },
  { k: 'epic', label: 'Epic' },
];
type Report = { id: string; kind: string; body: string; context: { chips?: string[]; path?: string }; status: 'new' | 'done'; created_at: string; username: string | null };

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Hidden Admin page (AD1): only in the menu for Yazan's account, and every call is checked again on the server.
 * Send to Inbox (Yazan 2026-10-27): a message to everyone or to one player, with tokens, Sparks and/or a chest that
 * reach the wallet only when the player taps Collect. Taking tokens back from a player stays instant.
 */
export default function Page() {
  const c = useInfo();
  const isAdmin = useAccount((a) => a.isAdmin);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Player[]>([]);
  const [pick, setPick] = useState<Player | null>(null);
  const giving = useRef(false);
  const [toAll, setToAll] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tok, setTok] = useState('');
  const [sparks, setSparks] = useState('');
  const [chest, setChest] = useState<ChestPick>('');
  const [sure, setSure] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [back, setBack] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [sent, setSent] = useState<Sent[] | null>(null);
  const loadSent = () => supabase.rpc('admin_inbox_sent').then(({ data }) => setSent((data as Sent[]) ?? []));
  const [show, setShow] = useState<'new' | 'all'>('new');
  const [reports, setReports] = useState<Report[] | null>(null);
  const [repErr, setRepErr] = useState(false);
  // A new list (or admin rights) starts from "loading" again.
  const repFor = `${isAdmin}:${show}`;
  const [repShown, setRepShown] = useState(repFor);
  if (repShown !== repFor) {
    setRepShown(repFor);
    if (isAdmin) setReports(null);
  }
  useEffect(() => {
    if (isAdmin) void loadSent();
  }, [isAdmin]);
  useEffect(() => {
    if (!isAdmin) return;
    supabase.rpc('admin_reports', { show }).then(({ data, error }) => {
      setRepErr(!!error);
      setReports((data as Report[]) ?? []);
    });
  }, [isAdmin, show]);
  const mark = async (r: Report) => {
    const status = r.status === 'new' ? 'done' : 'new';
    const { error } = await supabase.rpc('admin_report_status', { report: r.id, status });
    if (error) return setRepErr(true);
    setReports((list) => (list ?? []).flatMap((x) => (x.id !== r.id ? [x] : show === 'new' ? [] : [{ ...x, status }])));
  };

  // An empty search clears the results at once; a name is looked up after a short pause in typing.
  const name = q.trim().replace(/^@/, '');
  if (isAdmin && !name && found.length) setFound([]);
  useEffect(() => {
    if (!isAdmin || !name) return;
    let live = true; // a slow answer for an older search must not replace a newer list (AP12e)
    const id = setTimeout(async () => {
      const { data, error } = await supabase.rpc('admin_find_players', { q: name });
      if (!live) return;
      if (error) setMsg({ text: 'Could not search. Check the connection.', bad: true });
      else setFound((data as Player[]) ?? []);
    }, 300);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [name, isAdmin]);

  if (!isAdmin) return <Redirect href="/games" />;

  // Send to Inbox. Everyone: the first tap asks, the second sends.
  const tn = Math.trunc(Number(tok)) || 0;
  const sn = Math.trunc(Number(sparks)) || 0;
  const send = async () => {
    if (!title.trim()) return setSendMsg({ text: 'Write a title.', bad: true });
    if (!toAll && !pick) return setSendMsg({ text: 'Pick a player above, or send to all players.', bad: true });
    if (tn < 0 || sn < 0) return setSendMsg({ text: 'Gifts can’t be minus. Use Take tokens back below.', bad: true });
    if (toAll && !sure) return setSure(true);
    // Each call is a new message on the server, so a double tap would send twice (AP12e).
    if (giving.current) return;
    giving.current = true;
    setSendMsg(null);
    const { data, error } = await supabase.rpc('admin_inbox_send', { target: toAll ? null : pick!.id, title, body, tokens: tn, sparks: sn, chest });
    giving.current = false;
    setSure(false);
    if (error) return setSendMsg({ text: toAll ? 'Not sent. To everyone: up to 500 tokens and 500 Sparks.' : 'Not sent. Up to 5,000 tokens and 1,000 Sparks.', bad: true });
    const players = Number((data as { players?: number } | null)?.players ?? 0);
    setSendMsg({ text: toAll ? `Sent to ${players} player${players === 1 ? '' : 's'}. They collect it from their Inbox.` : `Sent to @${pick!.username}'s Inbox.` });
    setTitle('');
    setBody('');
    setTok('');
    setSparks('');
    setChest('');
    void loadSent();
  };
  const sendLabel = toAll ? (sure ? 'Tap again to send to every player' : 'Send to all players') : pick ? `Send to @${pick.username}` : 'Send';

  // Taking tokens back is a correction, not a gift: it stays instant.
  const bn = Math.abs(Math.trunc(Number(back)) || 0);
  const takeBack = async () => {
    if (!pick || !bn) return setMsg({ text: 'Pick a player and type how many tokens to take back.', bad: true });
    if (giving.current) return;
    giving.current = true;
    setMsg(null);
    const { data, error } = await supabase.rpc('admin_grant_tokens', { target: pick.id, amount: -bn, note });
    giving.current = false;
    if (error) return setMsg({ text: 'Not saved. Up to 1,000 at a time.', bad: true });
    const tokens = Number((data as { tokens?: number } | null)?.tokens ?? pick.tokens - bn);
    setPick({ ...pick, tokens });
    setFound((f) => f.map((p) => (p.id === pick.id ? { ...p, tokens } : p)));
    setMsg({ text: `Took back ${bn} token${bn === 1 ? '' : 's'}. @${pick.username} now has ${tokens}.` });
    setBack('');
    setNote('');
  };

  const field = [s.in, { backgroundColor: c.surf, borderColor: c.line, color: c.fg }];
  // The player search, used by One player and by Take tokens back (shown once on the page).
  const players = () => (
    <>
      <TextInput value={q} onChangeText={setQ} placeholder="Search a username" placeholderTextColor={c.mute} autoCapitalize="none" autoCorrect={false} style={[field, s.gap]} />
      <View style={s.list}>
        {found.map((p) => {
          const on = pick?.id === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPick(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[s.row, { borderColor: on ? c.chipOnLine : c.line, backgroundColor: on ? c.chipOnFill : 'transparent' }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.name, { color: c.fg }]} numberOfLines={1}>{`Dr. ${p.display_name}`}</Text>
                <Text style={[s.small, { color: c.mute }]}>{`@${p.username}`}</Text>
              </View>
              <Text style={[s.tok, { color: p.tokens < 0 ? c.t.red : c.fg }]}>{`${p.tokens} tokens`}</Text>
            </Pressable>
          );
        })}
        {q.trim() && !found.length ? <Text style={[s.small, { color: c.mute }]}>No player with that username.</Text> : null}
      </View>
    </>
  );
  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>Admin</Kicker>
        <Text style={[ui.H, s.H, { color: c.fg }]}>Send to Inbox</Text>
        <Text style={[ui.p, { color: c.mute }]}>Only your account sees this page. A message with gifts lands in the player’s Inbox with a red dot; the gifts reach their wallet when they tap Collect. “All players” reaches accounts that exist now.</Text>

        <View style={[s.chips, s.gap]}>
          {([true, false] as const).map((all) => (
            <Pressable key={String(all)} onPress={() => (setToAll(all), setSure(false))} accessibilityRole="tab" accessibilityState={{ selected: toAll === all }} style={[s.chip, { borderColor: toAll === all ? c.chipOnLine : c.line, backgroundColor: toAll === all ? c.chipOnFill : 'transparent' }]}>
              <Text style={[s.chipT, { color: toAll === all ? c.fg : c.mute }]}>{all ? 'All players' : 'One player'}</Text>
            </Pressable>
          ))}
        </View>

        {toAll ? null : players()}

        <TextInput value={title} onChangeText={setTitle} placeholder="Title (e.g. Sorry for the outage)" placeholderTextColor={c.mute} maxLength={80} style={[field, s.gap]} />
        <TextInput value={body} onChangeText={setBody} placeholder="Message" placeholderTextColor={c.mute} maxLength={1000} multiline style={[field, s.gapS, s.multi]} />
        <View style={[s.pair, s.gapS]}>
          <TextInput value={tok} onChangeText={(v) => (setTok(v), setSure(false))} placeholder={toAll ? 'Tokens (up to 500)' : 'Tokens (up to 5,000)'} placeholderTextColor={c.mute} keyboardType="number-pad" style={[field, s.half]} />
          <TextInput value={sparks} onChangeText={(v) => (setSparks(v), setSure(false))} placeholder={toAll ? 'Sparks (up to 500)' : 'Sparks (up to 1,000)'} placeholderTextColor={c.mute} keyboardType="number-pad" style={[field, s.half]} />
        </View>
        <View style={[s.chips, s.gapS]}>
          {CHEST_PICKS.map((x) => (
            <Pressable key={x.k || 'none'} onPress={() => (setChest(x.k), setSure(false))} accessibilityRole="button" accessibilityState={{ selected: chest === x.k }} style={[s.chip, { borderColor: chest === x.k ? c.chipOnLine : c.line, backgroundColor: chest === x.k ? c.chipOnFill : 'transparent' }]}>
              <Text style={[s.chipT, { color: chest === x.k ? c.fg : c.mute }]}>{x.label}</Text>
            </Pressable>
          ))}
        </View>
        <GradBtn label={sendLabel} onPress={send} style={s.gap} />
        {sendMsg ? <Text style={[ui.p, { color: sendMsg.bad ? c.t.error : c.fg }]}>{sendMsg.text}</Text> : null}

        <Text style={[ui.H, s.H, s.gapL, { color: c.fg }]}>Sent</Text>
        <Text style={[ui.p, { color: c.mute }]}>Your last 50 messages: who opened them and who collected.</Text>
        {sent && !sent.length ? <Text style={[s.small, s.gapS, { color: c.mute }]}>Nothing sent yet.</Text> : null}
        <View style={s.list}>
          {(sent ?? []).map((m) => (
            <View key={m.id} style={[s.rep, { borderColor: c.line }]}>
              <Text style={[s.small, { color: c.mute }]}>{`${when(m.at)} · ${m.to ? '@' + m.to : 'All players'}`}</Text>
              <Text style={[s.name, { color: c.fg }]}>{m.title}</Text>
              <Text style={[s.small, { color: c.fg }]}>{[m.tokens ? `${m.tokens} tokens` : '', m.sparks ? `${m.sparks} Sparks` : '', m.chest ? `${m.chest} chest` : ''].filter(Boolean).join(' · ') || 'Message only'}</Text>
              <Text style={[s.small, { color: c.mute }]}>{`Opened ${m.read} · Collected ${m.collected}`}</Text>
            </View>
          ))}
        </View>

        <Text style={[ui.H, s.H, s.gapL, { color: c.fg }]}>Take tokens back</Text>
        <Text style={[ui.p, { color: c.mute }]}>A correction for one player, taken from their wallet at once.</Text>
        {toAll ? players() : <Kicker style={s.gap}>{pick ? `For @${pick.username}` : 'Pick a player above'}</Kicker>}
        <TextInput value={back} onChangeText={setBack} placeholder="Tokens to take back" placeholderTextColor={c.mute} keyboardType="number-pad" style={[field, s.gap]} />
        <TextInput value={note} onChangeText={setNote} placeholder="Note (why), saved with it" placeholderTextColor={c.mute} maxLength={200} style={[field, s.gapS]} />
        <GradBtn label={pick ? `Take back from @${pick.username}` : 'Take back'} onPress={takeBack} style={s.gap} />
        {msg ? <Text style={[ui.p, { color: msg.bad ? c.t.error : c.fg }]}>{msg.text}</Text> : null}

        <Text style={[ui.H, s.H, s.gapL, { color: c.fg }]}>Reports</Text>
        <Text style={[ui.p, { color: c.mute }]}>Sent from the red ! by players and guests, newest first.</Text>
        <View style={[s.tabs, s.gapS]}>
          {(['new', 'all'] as const).map((k) => (
            <Pressable key={k} onPress={() => setShow(k)} accessibilityRole="tab" accessibilityState={{ selected: show === k }}>
              <Text style={[s.tab, { color: show === k ? c.t.accent : c.mute }]}>{k === 'new' ? 'New' : 'All'}</Text>
            </Pressable>
          ))}
        </View>
        {repErr ? <Text style={[s.small, { color: c.t.error }]}>Could not load reports. Check the connection.</Text> : null}
        {reports && !reports.length ? <Text style={[s.small, s.gapS, { color: c.mute }]}>{show === 'new' ? 'No new reports.' : 'No reports yet.'}</Text> : null}
        <View style={s.list}>
          {(reports ?? []).map((r) => (
            <View key={r.id} style={[s.rep, { borderColor: c.line, opacity: r.status === 'done' ? 0.55 : 1 }]}>
              <Text style={[s.small, { color: c.mute }]}>{`${r.kind.toUpperCase()} · ${when(r.created_at)} · ${r.username ? '@' + r.username : 'Guest'}`}</Text>
              {r.context?.chips?.length ? <Text style={[s.small, { color: c.fg }]}>{r.context.chips.join(' · ')}</Text> : null}
              <Text style={[s.body, { color: c.fg }]}>{r.body || '(no text)'}</Text>
              <Pressable onPress={() => mark(r)} accessibilityRole="button">
                <Text style={[s.small, { color: c.t.accent }]}>{r.status === 'new' ? 'Mark done' : 'Mark new'}</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <Inbox c={c} />
        <Downloads c={c} />
      </InfoScroll>
    </Screen>
  );
}

const s = StyleSheet.create({
  H: { fontFamily: F.display },
  gap: { marginTop: u(16) },
  gapS: { marginTop: u(8) },
  gapL: { marginTop: u(32) },
  tabs: { flexDirection: 'row', gap: u(14) },
  tab: { fontFamily: F.display, fontSize: u(14) },
  rep: { borderWidth: 1, borderRadius: u(14), paddingVertical: u(10), paddingHorizontal: u(12), gap: u(4) },
  body: { fontFamily: F.body, fontSize: u(11), lineHeight: u(15) },
  in: { borderWidth: 1, borderRadius: u(14), paddingHorizontal: u(12), height: u(38), fontFamily: F.body, fontSize: u(11) },
  list: { gap: u(6), marginTop: u(8) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(10), borderWidth: 1, borderRadius: u(14), paddingVertical: u(8), paddingHorizontal: u(12) },
  name: { fontFamily: F.display, fontSize: u(14) },
  small: { fontFamily: F.body, fontSize: u(9), marginTop: u(2) },
  tok: { fontFamily: F.mono, fontSize: u(10) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: u(12), paddingVertical: u(6) },
  chipT: { fontFamily: F.bodySemi, fontSize: u(10) },
  pair: { flexDirection: 'row', gap: u(8) },
  half: { flex: 1, minWidth: 0, width: 0 },
  multi: { height: u(80), paddingTop: u(10), textAlignVertical: 'top' },
});
