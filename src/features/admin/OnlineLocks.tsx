import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { GAMES } from '@/data/games';
import { gameDef } from '@/games/shell/registry';
import { useInfo } from '@/features/info/ui';
import { supabase } from '@/lib/supabase';
import { tapped } from '@/lib/sound';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** The games that have an Online mode, in the Games page order. */
const ONLINE = GAMES.filter((g) => !!gameDef(g.key)?.Online);

/**
 * Admin: online locks (Yazan 2026-11-02). Lock online play for one game (e.g. while it has a bug) or for all of them.
 * A locked game shows a lock on its Online card and the server refuses its new rooms, seats and matches; matches
 * already running finish normally. When the week's online data is used up, every Online card locks by itself.
 */
export function OnlineLocks() {
  const c = useInfo();
  const [locked, setLocked] = useState<string[] | null>(null);
  const [off, setOff] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      supabase.rpc('online_status').then(({ data, error }) => {
        const l = (data as { locked?: string[] } | null)?.locked;
        if (error || !l) setOff(true);
        else setLocked(l);
      });
    }, []),
  );
  const flip = async (g: string, lock: boolean) => {
    if (busy) return;
    setBusy(g);
    const { data, error } = await supabase.rpc('admin_online_lock', { g, lock });
    setBusy(null);
    if (error) setOff(true);
    else setLocked((data as string[]) ?? []);
  };
  const all = !!locked?.includes('*');
  const row = (key: string, name: string, on: boolean, note?: string) => (
    <View key={key} style={[s.row, { borderColor: c.line }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.name, { color: c.fg }]} numberOfLines={1}>{name}</Text>
        {note ? <Text style={[s.small, { color: c.mute }]}>{note}</Text> : null}
      </View>
      <Pressable
        onPress={tapped(() => void flip(key, !on))}
        disabled={busy === key}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${on ? 'Unlock' : 'Lock'} ${name}`}
        style={[s.btn, { borderColor: on ? c.t.error : c.line, backgroundColor: on ? 'rgba(255,122,136,0.14)' : 'transparent', opacity: busy === key ? 0.5 : 1 }]}>
        <Text style={[s.btnT, { color: on ? c.t.error : c.fg }]}>{on ? '🔒 Locked' : 'Open'}</Text>
      </Pressable>
    </View>
  );
  return (
    <View style={[s.box, { borderColor: c.line }]}>
      <Text style={[s.k, { color: c.mute }]}>ONLINE LOCKS</Text>
      {off ? (
        <Text style={[s.small, { color: c.mute }]}>Locks aren’t on the server yet (paste the online locks SQL).</Text>
      ) : !locked ? (
        <Text style={[s.small, { color: c.mute }]}>Loading…</Text>
      ) : (
        <>
          <Text style={[s.small, { color: c.mute }]}>Tap to lock or open. Players can’t pick a locked game’s Online mode; matches already running finish.</Text>
          {row('*', 'All online games', all, all ? 'Every Online card shows the lock.' : undefined)}
          {ONLINE.map((g) => row(g.key, `${g.lead} ${g.em}`.trim(), locked.includes(g.key), all && !locked.includes(g.key) ? 'Locked by “All”' : undefined))}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: u(14), padding: u(12), gap: u(6), marginTop: u(10) },
  k: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.2) },
  small: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(10), borderTopWidth: 1, paddingTop: u(6) },
  name: { fontFamily: F.bodySemi, fontSize: u(11.5) },
  btn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: u(12), paddingVertical: u(5), minWidth: u(70), alignItems: 'center' },
  btnT: { fontFamily: F.bodySemi, fontSize: u(10) },
});
