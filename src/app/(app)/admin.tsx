import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/AppText';

import { Screen } from '@/components/Screen';
import { GradBtn, InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { supabase } from '@/lib/supabase';
import { useAccount } from '@/state/account';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

type Player = { id: string; username: string; display_name: string; tokens: number };

/**
 * Hidden Admin page (AD1): only in the menu for Yazan's account, and every call is checked again on the server.
 * Find a player by username, give (or take back) tokens with a note; each grant is a row in their wallet.
 */
export default function Page() {
  const c = useInfo();
  const isAdmin = useAccount((a) => a.isAdmin);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Player[]>([]);
  const [pick, setPick] = useState<Player | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const name = q.trim().replace(/^@/, '');
    if (!name) return setFound([]);
    const id = setTimeout(async () => {
      const { data, error } = await supabase.rpc('admin_find_players', { q: name });
      if (error) setMsg({ text: 'Could not search. Check the connection.', bad: true });
      else setFound((data as Player[]) ?? []);
    }, 300);
    return () => clearTimeout(id);
  }, [q, isAdmin]);

  if (!isAdmin) return <Redirect href="/games" />;

  const n = Math.trunc(Number(amount));
  const give = async () => {
    if (!pick || !n) return setMsg({ text: 'Pick a player and type a number of tokens.', bad: true });
    setMsg(null);
    const { data, error } = await supabase.rpc('admin_grant_tokens', { target: pick.id, amount: n, note });
    if (error) return setMsg({ text: 'Not saved. Amounts go from -1,000 to 5,000.', bad: true });
    const tokens = Number((data as { tokens?: number } | null)?.tokens ?? pick.tokens + n);
    setPick({ ...pick, tokens });
    setFound((f) => f.map((p) => (p.id === pick.id ? { ...p, tokens } : p)));
    setMsg({ text: `${n > 0 ? 'Gave' : 'Took back'} ${Math.abs(n)} token${Math.abs(n) === 1 ? '' : 's'}. @${pick.username} now has ${tokens}.` });
    setAmount('');
    setNote('');
  };

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
        {msg ? <Text style={[ui.p, { color: msg.bad ? c.t.red : c.fg }]}>{msg.text}</Text> : null}
      </InfoScroll>
    </Screen>
  );
}

const s = StyleSheet.create({
  H: { fontFamily: F.display },
  gap: { marginTop: u(16) },
  gapS: { marginTop: u(8) },
  in: { borderWidth: 1, borderRadius: u(14), paddingHorizontal: u(12), height: u(38), fontFamily: F.body, fontSize: u(11) },
  list: { gap: u(6), marginTop: u(8) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(10), borderWidth: 1, borderRadius: u(14), paddingVertical: u(8), paddingHorizontal: u(12) },
  name: { fontFamily: F.display, fontSize: u(14) },
  small: { fontFamily: F.body, fontSize: u(9), marginTop: u(2) },
  tok: { fontFamily: F.mono, fontSize: u(10) },
});
