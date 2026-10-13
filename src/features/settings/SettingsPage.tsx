import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { InfoScroll, Kicker, Rich, s as ui, useInfo } from '@/features/info/ui';
import { Face } from '@/games/shell/Face';
import { signOut, useAccount } from '@/state/account';
import { useApp } from '@/state/app';
import { loadFriends, unblockUser, useFriends } from '@/state/friends';
import { u } from '@/theme/scale';
import { F, type Mode } from '@/theme/tokens';

/** Settings (look A "Sections", Yazan 2026-10-13): the look, blocked players (moved from Friends) and the account. */
export function SettingsPage() {
  const c = useInfo();
  const profile = useAccount((a) => a.profile);
  const mode = useApp((a) => a.mode);
  const setMode = useApp((a) => a.setMode);
  const blocked = useFriends((f) => f.blocked);
  const [busy, setBusy] = useState<string | null>(null);
  const [outErr, setOutErr] = useState(false);
  useEffect(() => {
    if (profile) loadFriends().catch(() => {});
  }, [profile]);

  const look = (
    <View style={s.seg}>
      {(['dark', 'light'] as Mode[]).map((m) => {
        const on = mode === m;
        return (
          <Pressable key={m} onPress={() => setMode(m)} style={[s.segB, { borderColor: on ? c.chipOnLine : c.line, backgroundColor: on ? c.chipOnFill : 'transparent' }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
            <Text style={[s.segT, { color: on ? c.fg : c.mute }]}>{m === 'dark' ? 'Dark' : 'Light'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
  const blockedRows = !profile ? (
    <Text style={[s.note, { color: c.mute }]}>Sign in to see players you blocked.</Text>
  ) : blocked.length ? (
    blocked.map((b) => (
      <View key={b.id} style={s.row}>
        <Face slug={b.avatar} size={u(22)} />
        <Text style={[s.name, { color: c.fg }]} numberOfLines={1}>{b.display_name}</Text>
        <Pressable
          disabled={busy === b.id}
          onPress={async () => {
            setBusy(b.id);
            await unblockUser(b.id).catch(() => {});
            setBusy(null);
          }}
          style={[s.ghost, { borderColor: c.line }]}
          accessibilityRole="button"
          accessibilityLabel={`Unblock ${b.display_name}`}>
          <Text style={[s.ghostT, { color: c.mute }]}>Unblock</Text>
        </Pressable>
      </View>
    ))
  ) : (
    <Text style={[s.note, { color: c.mute }]}>You haven’t blocked anyone.</Text>
  );
  const account = profile ? (
    <Pressable onPress={() => signOut().catch(() => setOutErr(true))} style={[s.ghost, s.wide, { borderColor: c.line }]} accessibilityRole="button">
      <Text style={[s.ghostT, { color: c.fg }]}>Sign out</Text>
    </Pressable>
  ) : (
    <Pressable onPress={() => router.push('/auth')} style={[s.ghost, s.wide, { borderColor: c.line }]} accessibilityRole="button">
      <Text style={[s.ghostT, { color: c.fg }]}>Sign in</Text>
    </Pressable>
  );
  const sections = [
    { k: 'Appearance', body: look },
    { k: 'Blocked players', body: blockedRows },
    { k: 'Account', body: <>{account}{outErr ? <Text style={[s.note, { color: c.mute }]}>You’re offline. Connect to sign out, so nothing is lost.</Text> : null}</> },
  ];
  return (
    <Screen tab={null} glow={9}>
      <InfoScroll>
        <Kicker>Settings</Kicker>
        <Rich text={'Make it *yours.*'} style={ui.H} />
        {sections.map((x) => (
          <View key={x.k} style={ui.xsec}>
            <Kicker inSec>{x.k}</Kicker>
            <View style={[s.panel, s.pad, { backgroundColor: c.surf, borderColor: c.line }]}>{x.body}</View>
          </View>
        ))}
      </InfoScroll>
    </Screen>
  );
}

const s = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: u(14) },
  pad: { padding: u(12), gap: u(8), marginTop: u(6) },
  seg: { flexDirection: 'row', gap: u(8) },
  segB: { flex: 1, borderWidth: 1, borderRadius: u(10), paddingVertical: u(7), alignItems: 'center' },
  segT: { fontFamily: F.bodySemi, fontSize: u(11) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(9) },
  name: { flex: 1, fontFamily: F.bodySemi, fontSize: u(11.5) },
  note: { fontFamily: F.body, fontSize: u(10.5), lineHeight: u(15) },
  ghost: { borderWidth: 1, borderRadius: u(10), paddingHorizontal: u(10), paddingVertical: u(5) },
  wide: { alignItems: 'center', paddingVertical: u(8) },
  ghostT: { fontFamily: F.bodySemi, fontSize: u(11) },
});
