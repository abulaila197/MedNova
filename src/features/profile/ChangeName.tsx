import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, TextInput } from '@/components/AppText';

import { Sheet } from '@/components/Sheet';
import { useSession } from '@/games/shell/session';
import { nameIsClean } from '@/lib/names';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';
import { useAccount } from '@/state/account';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

type Why = 'shape' | 'bad' | 'same' | 'taken' | 'tokens' | 'guest' | 'offline';

const SAY: Record<Why, string> = {
  shape: 'Use 3 to 16 letters, numbers or _.',
  bad: 'That name is not allowed. Try another.',
  same: 'That’s already your name.',
  taken: 'That name is taken. Try another.',
  tokens: 'Not enough tokens.',
  guest: 'Sign in to change your name.',
  offline: 'Couldn’t reach the server. Check your connection.',
};

/**
 * Change name (list #2, #54): 100 tokens the first time, then double the last change. The server checks the
 * name (bad words, taken, not like a friend code) and takes the tokens in public.change_name.
 */
export function ChangeName({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const profile = useAccount((a) => a.profile);
  const [name, setName] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  useEffect(() => {
    if (!open) return;
    setName('');
    setMsg(null);
    setCost(null);
    void supabase.rpc('name_change_cost').then(({ data }) => setCost(typeof data === 'number' ? data : null));
  }, [open]);
  if (!profile) return null;
  const ok = /^[A-Za-z0-9_]{3,16}$/.test(name);
  const save = async () => {
    if (!nameIsClean(name)) return setMsg({ text: SAY.bad, good: false });
    setBusy(true);
    setMsg(null);
    const userId = useSession.getState().userId;
    // Unsynced spends on this phone go up first so the server sees the right balance.
    if (userId) await syncAccount(userId).catch(() => {});
    const { data, error } = await supabase.rpc('change_name', { name });
    const r = (error || !data ? { ok: false, why: 'offline' } : data) as { ok: boolean; why?: Why; need?: number; next?: number };
    if (r.ok) {
      useAccount.setState({ profile: { ...profile, username: name, display_name: name } });
      if (userId) await syncAccount(userId).catch(() => {});
      if (r.next) setCost(r.next);
      setName('');
      setMsg({ text: `You’re Dr. ${name} now.`, good: true });
    } else {
      const why = r.why ?? 'offline';
      setMsg({ text: why === 'tokens' && r.need ? `You need ${r.need} more tokens.` : SAY[why], good: false });
    }
    setBusy(false);
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <Text style={[s.k, { color: t.mute }]}>CHANGE NAME</Text>
      <Text style={[s.now, { color: t.fg }]} numberOfLines={1}>{`Dr. ${profile.display_name}`}</Text>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16));
          setMsg(null);
        }}
        placeholder="New name"
        placeholderTextColor={t.mute}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={16}
        style={[s.field, { color: t.fg, backgroundColor: t.panel2, borderColor: name ? 'rgba(111,214,255,0.5)' : t.panelLine }]}
        accessibilityLabel="New name"
      />
      <Text style={[s.note, { color: t.mute }]}>Each change costs double the last one.</Text>
      {msg ? <Text style={[s.msg, { color: msg.good ? t.accent : t.mute }]}>{msg.text}</Text> : null}
      <Pressable disabled={!ok || busy} onPress={save} accessibilityRole="button" style={{ opacity: ok ? 1 : 0.5 }}>
        <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
          <Text style={[s.btnT, { color: t.onGrad }]}>{busy ? 'Saving…' : cost == null ? 'Change name' : `Change name · ${cost} tokens`}</Text>
        </LinearGradient>
      </Pressable>
    </Sheet>
  );
}

const s = StyleSheet.create({
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.4), marginTop: u(4) },
  now: { fontFamily: F.bodySemi, fontSize: u(13) },
  field: { height: u(36), borderRadius: u(10), borderWidth: 1, paddingHorizontal: u(12), fontFamily: F.bodySemi, fontSize: u(12) },
  note: { fontFamily: F.body, fontSize: u(9), textAlign: 'center' },
  msg: { fontFamily: F.body, fontSize: u(9.5), textAlign: 'center' },
  btn: { height: u(34), borderRadius: u(12), alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(11) },
});
