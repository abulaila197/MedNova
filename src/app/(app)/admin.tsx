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
type Report = { id: string; kind: string; body: string; context: { chips?: string[]; path?: string }; status: 'new' | 'done'; created_at: string; username: string | null };

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Hidden Admin page (AD1): only in the menu for Yazan's account, and every call is checked again on the server.
 * Find a player by username, give (or take back) tokens with a note; each grant is a row in their wallet. Sparks go
 * to one player or, with tokens, to everyone (#4); a gift may take a bar past 100.
 */
export default function Page() {
  const c = useInfo();
  const isAdmin = useAccount((a) => a.isAdmin);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Player[]>([]);
  const [pick, setPick] = useState<Player | null>(null);
  const [amount, setAmount] = useState('');
  const giving = useRef(false);
  const [note, setNote] = useState('');
  const [sparks, setSparks] = useState('');
  const [allTok, setAllTok] = useState('');
  const [allSp, setAllSp] = useState('');
  const [allNote, setAllNote] = useState('');
  const [sure, setSure] = useState(false);
  const [allMsg, setAllMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
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

  const n = Math.trunc(Number(amount));
  const give = async () => {
    if (!pick || !n) return setMsg({ text: 'Pick a player and type a number of tokens.', bad: true });
    // Each call is a new grant on the server, so a double tap would give twice (AP12e).
    if (giving.current) return;
    giving.current = true;
    setMsg(null);
    const { data, error } = await supabase.rpc('admin_grant_tokens', { target: pick.id, amount: n, note });
    giving.current = false;
    if (error) return setMsg({ text: 'Not saved. Amounts go from -1,000 to 5,000.', bad: true });
    const tokens = Number((data as { tokens?: number } | null)?.tokens ?? pick.tokens + n);
    setPick({ ...pick, tokens });
    setFound((f) => f.map((p) => (p.id === pick.id ? { ...p, tokens } : p)));
    setMsg({ text: `${n > 0 ? 'Gave' : 'Took back'} ${Math.abs(n)} token${Math.abs(n) === 1 ? '' : 's'}. @${pick.username} now has ${tokens}.` });
    setAmount('');
    setNote('');
  };

  const sp = Math.trunc(Number(sparks));
  const giveSparks = async () => {
    if (!pick || !sp) return setMsg({ text: 'Pick a player and type a number of Sparks.', bad: true });
    if (giving.current) return;
    giving.current = true;
    setMsg(null);
    const { error } = await supabase.rpc('admin_grant_sparks', { target: pick.id, amount: sp, note });
    giving.current = false;
    if (error) return setMsg({ text: 'Not saved. Sparks go from 1 to 1,000.', bad: true });
    setMsg({ text: `Gave ${sp} Spark${sp === 1 ? '' : 's'} to @${pick.username}.` });
    setSparks('');
    setNote('');
  };

  // Everyone at once: the first tap asks, the second sends.
  const at = Math.trunc(Number(allTok)) || 0;
  const asp = Math.trunc(Number(allSp)) || 0;
  const giveAll = async () => {
    if (at <= 0 && asp <= 0) return setAllMsg({ text: 'Type tokens, Sparks or both.', bad: true });
    if (!sure) return setSure(true);
    if (giving.current) return;
    giving.current = true;
    setAllMsg(null);
    const { data, error } = await supabase.rpc('admin_grant_all', { tokens: at, sparks: asp, note: allNote });
    giving.current = false;
    setSure(false);
    if (error) return setAllMsg({ text: 'Not sent. Each amount goes from 0 to 500.', bad: true });
    const players = Number((data as { players?: number } | null)?.players ?? 0);
    setAllMsg({ text: `Sent to ${players} player${players === 1 ? '' : 's'}.` });
    setAllTok('');
    setAllSp('');
    setAllNote('');
  };
  const allLabel = sure ? `Tap again to send to every player` : 'Give to everyone';

  const field = [s.in, { backgroundColor: c.surf, borderColor: c.line, color: c.fg }];
  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>Admin</Kicker>
        <Text style={[ui.H, s.H, { color: c.fg }]}>Give tokens</Text>
        <Text style={[ui.p, { color: c.mute }]}>Only your account sees this page. The player gets the tokens the next time their app syncs.</Text>

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

        <Kicker style={s.gap}>{pick ? `For @${pick.username}` : 'Pick a player above'}</Kicker>
        <TextInput value={amount} onChangeText={setAmount} placeholder="Tokens (use - to take back)" placeholderTextColor={c.mute} keyboardType="numbers-and-punctuation" style={[field, s.gapS]} />
        <TextInput value={note} onChangeText={setNote} placeholder="Note (why), saved with the grant" placeholderTextColor={c.mute} maxLength={200} style={[field, s.gapS]} />
        <GradBtn label="Give tokens" onPress={give} style={s.gap} />
        <TextInput value={sparks} onChangeText={setSparks} placeholder="Sparks (1 to 1,000)" placeholderTextColor={c.mute} keyboardType="number-pad" style={[field, s.gap]} />
        <GradBtn label="Give Sparks" onPress={giveSparks} style={s.gapS} />
        {msg ? <Text style={[ui.p, { color: msg.bad ? c.t.error : c.fg }]}>{msg.text}</Text> : null}

        <Text style={[ui.H, s.H, s.gapL, { color: c.fg }]}>Give everyone</Text>
        <Text style={[ui.p, { color: c.mute }]}>Tokens and/or Sparks to every player, for an event or an apology. Up to 500 of each.</Text>
        <TextInput value={allTok} onChangeText={(v) => (setAllTok(v), setSure(false))} placeholder="Tokens each" placeholderTextColor={c.mute} keyboardType="number-pad" style={[field, s.gapS]} />
        <TextInput value={allSp} onChangeText={(v) => (setAllSp(v), setSure(false))} placeholder="Sparks each" placeholderTextColor={c.mute} keyboardType="number-pad" style={[field, s.gapS]} />
        <TextInput value={allNote} onChangeText={setAllNote} placeholder="Note (why)" placeholderTextColor={c.mute} maxLength={200} style={[field, s.gapS]} />
        <GradBtn label={allLabel} onPress={giveAll} style={s.gap} />
        {allMsg ? <Text style={[ui.p, { color: allMsg.bad ? c.t.error : c.fg }]}>{allMsg.text}</Text> : null}

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
});
