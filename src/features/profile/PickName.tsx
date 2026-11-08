import { router, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/AppText';

import { Sheet } from '@/components/Sheet';
import { nameIsClean } from '@/lib/names';
import { supabase } from '@/lib/supabase';
import { signOut, useAccount } from '@/state/account';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

type Why = 'shape' | 'bad' | 'taken' | 'guest' | 'done' | 'offline';

const SAY: Record<Why, string> = {
  shape: 'Use 3 to 16 letters, numbers or _.',
  bad: 'That name is not allowed. Try another.',
  taken: 'That name is taken. Try another.',
  guest: 'Sign in first.',
  done: 'You already have a name.',
  offline: 'Couldn’t reach the server. Check your connection.',
};

/** The name handle_new_user gives an account made without one (a first Google sign-in). */
const defaultName = (id: string) => `doc_${id.replace(/-/g, '').slice(0, 10)}`;

/**
 * Pick your username (Google sign-in, Yazan 2026-10-26): shown once after a first Google sign-in, which has no
 * username or 16+ tick yet. Free; the server sets it only while the name is still the default (pick_first_name).
 * It stays until a name is picked (except over Privacy & Terms); the only other way out is signing out.
 */
export function PickNameHost() {
  const t = useTheme();
  const profile = useAccount((a) => a.profile);
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Steps aside while the Terms or Privacy Policy it links to is open, and comes back after.
  const path = usePathname();
  const open = path !== '/privacy' && !!profile && profile.username.toLowerCase() === defaultName(profile.id);
  if (!profile || !open) return null;
  const ok = /^[A-Za-z0-9_]{3,16}$/.test(name) && agreed;
  const save = async () => {
    if (!nameIsClean(name)) return setMsg(SAY.bad);
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc('pick_first_name', { name });
    const r = (error || !data ? { ok: false, why: 'offline' } : data) as { ok: boolean; why?: Why };
    if (r.ok) useAccount.setState({ profile: { ...profile, username: name, display_name: name } });
    else setMsg(SAY[r.why ?? 'offline']);
    setBusy(false);
  };
  return (
    <Sheet open onClose={() => {}}>
      <Text style={[s.k, { color: t.mute }]}>ONE LAST STEP</Text>
      <Text style={[s.h, { color: t.fg }]}>Pick your username</Text>
      <Text style={[s.note, { color: t.mute }]}>Other players see it in games, rooms and friends.</Text>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16));
          setMsg(null);
        }}
        placeholder="3 to 16 letters, numbers or _"
        placeholderTextColor={t.mute}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={16}
        style={[s.field, { color: t.fg, backgroundColor: t.panel2, borderColor: name ? 'rgba(111,214,255,0.5)' : t.panelLine }]}
        accessibilityLabel="Username"
      />
      <Pressable onPress={() => setAgreed((v) => !v)} style={s.tick} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} accessibilityLabel="I am 16 or older and agree to the Terms and Privacy Policy">
        <View style={[s.box, { borderColor: agreed ? t.accent : t.panelLine, backgroundColor: agreed ? t.accent : t.panel2 }]}>
          {agreed ? <Text style={[s.check, { color: t.onGrad }]}>✓</Text> : null}
        </View>
        <Text style={[s.tickT, { color: t.mute }]}>
          I am 16 or older and agree to the{' '}
          <Text style={{ color: t.accent }} onPress={() => router.push({ pathname: '/privacy', params: { doc: 'terms' } })} accessibilityRole="link">
            Terms
          </Text>{' '}
          and{' '}
          <Text style={{ color: t.accent }} onPress={() => router.push('/privacy')} accessibilityRole="link">
            Privacy Policy
          </Text>
          .
        </Text>
      </Pressable>
      {msg ? <Text style={[s.msg, { color: t.mute }]}>{msg}</Text> : null}
      <Pressable disabled={!ok || busy} onPress={save} accessibilityRole="button" style={{ opacity: ok ? 1 : 0.5 }}>
        <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
          <Text style={[s.btnT, { color: t.onGrad }]}>{busy ? 'Saving…' : 'Start playing'}</Text>
        </LinearGradient>
      </Pressable>
      <Pressable onPress={() => void signOut()} accessibilityRole="button" style={s.out}>
        <Text style={[s.note, { color: t.mute }]}>Sign out instead</Text>
      </Pressable>
    </Sheet>
  );
}

const s = StyleSheet.create({
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.4), marginTop: u(4) },
  h: { fontFamily: F.display, fontSize: u(18) },
  field: { height: u(36), borderRadius: u(10), borderWidth: 1, paddingHorizontal: u(12), fontFamily: F.bodySemi, fontSize: u(12) },
  tick: { flexDirection: 'row', gap: u(8), alignItems: 'flex-start' },
  box: { width: u(15), height: u(15), borderRadius: u(4), borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: u(1) },
  check: { fontFamily: F.bodyBold, fontSize: u(10), lineHeight: u(12) },
  tickT: { flex: 1, fontFamily: F.body, fontSize: u(9.5), lineHeight: u(14) },
  note: { fontFamily: F.body, fontSize: u(9.5) },
  msg: { fontFamily: F.body, fontSize: u(9.5), textAlign: 'center' },
  btn: { height: u(34), borderRadius: u(12), alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(11) },
  out: { alignSelf: 'center', paddingVertical: u(4) },
});
