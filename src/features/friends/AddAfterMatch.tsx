import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/AppText';
import { call } from '@/online/api';
import { loadFriends, useFriends } from '@/state/friends';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** Add a player you just played with: their state with you, and the request. */
export function useAddFriend(userId: string) {
  const rel = useFriends((f) => f.list.find((x) => x.id === userId)?.kind);
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'failed'>('idle');
  const send = async () => {
    setState('busy');
    try {
      await call('request_friend_id', { other: userId });
      await loadFriends();
      setState('sent');
    } catch {
      setState('failed');
    }
  };
  const label = rel === 'friend' ? 'Friends' : rel === 'outgoing' || state === 'sent' ? 'Sent' : rel === 'incoming' ? 'Accept' : state === 'failed' ? 'Retry' : '+ Add';
  const open = rel !== 'friend' && rel !== 'outgoing' && state !== 'sent' && state !== 'busy';
  return { label, open, send };
}

/** A small Add pill at the end of a standings row. Own-look games pass their own ink, faded ink and font. */
export function AddPill({ userId, name, ink, dim, font }: { userId: string; name: string; ink?: string; dim?: string; font?: string }) {
  const t = useTheme();
  const a = useAddFriend(userId);
  const on = ink ?? t.accent;
  const off = dim ?? t.mute;
  return (
    <Pressable disabled={!a.open} onPress={a.send} hitSlop={u(6)} style={[s.pill, { borderColor: a.open ? on : dim ?? t.chipLine }]} accessibilityRole="button" accessibilityLabel={a.open ? `Add ${name} as a friend` : `${name}: ${a.label}`}>
      <Text style={[s.pillT, { color: a.open ? on : off }, font ? { fontFamily: font } : null]}>{a.label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pill: { borderWidth: 1, borderRadius: u(9), paddingHorizontal: u(7), paddingVertical: u(1.5) },
  pillT: { fontFamily: F.bodySemi, fontSize: u(9.5) },
});
