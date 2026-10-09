import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

import { LevelBadge } from '@/components/LevelBadge';
import { Face } from '@/games/shell/Face';
import { useAccount } from '@/state/account';
import { useTheme } from '@/state/app';
import { type Friend, respondFriend, seenLabel, unblockUser, useFriends } from '@/state/friends';
import { u } from '@/theme/scale';
import { F, type Theme } from '@/theme/tokens';

/** Which friends sheet is open (drawn by FriendSheets at the app layout so it covers the dock). */
type SheetState = { open: null | 'add' | 'menu'; friend: Friend | null; code: string };
export const useFriendSheet = create<SheetState>(() => ({ open: null, friend: null, code: '' }));
export const openAdd = (code = '') => useFriendSheet.setState({ open: 'add', friend: null, code });
const openMenu = (friend: Friend) => useFriendSheet.setState({ open: 'menu', friend, code: '' });

const ONLINE = { dark: '#7be0a8', light: '#5e9e6a' };

/** Profile, Friends (FR1-FR4): Add friend, requests with Accept and ✕, then friends with face, level and Online / last seen. */
export function FriendsSection({ t }: { t: Theme }) {
  const profile = useAccount((a) => a.profile);
  const { list, blocked } = useFriends();
  const [busy, setBusy] = useState<string | null>(null);
  const [showBlocked, setShowBlocked] = useState(false);
  const line = { borderColor: t.panelLine };
  const incoming = list.filter((f) => f.kind === 'incoming');
  const friends = list.filter((f) => f.kind !== 'incoming');
  const act = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
    } catch {
      // the list stays as it was; the next refresh shows the truth
    }
    setBusy(null);
  };

  if (!profile) {
    return (
      <>
        <Text style={[s.sh2, { color: t.kick }]}>FRIENDS</Text>
        <Pressable onPress={() => router.push('/auth')} accessibilityRole="link">
          <Text style={[s.note, { color: t.mute }]}>
            Sign in to add friends and challenge them. <Text style={{ color: t.accent, fontFamily: F.bodySemi }}>Sign in</Text>
          </Text>
        </Pressable>
      </>
    );
  }

  return (
    <>
      <View style={s.head}>
        <Text style={[s.sh2, { color: t.kick }]}>FRIENDS</Text>
        <Pressable onPress={() => openAdd()} hitSlop={u(8)} accessibilityRole="button">
          <Text style={[s.add, { color: t.accent }]}>+ Add friend</Text>
        </Pressable>
      </View>
      {incoming.length ? <Text style={[s.sub, { color: t.mute }]}>{`REQUESTS · ${incoming.length}`}</Text> : null}
      {incoming.map((f) => (
        <View key={f.id} style={[s.fr, line]}>
          <Ring t={t} f={f} />
          <View style={s.frT}>
            <Name t={t} f={f} />
            <Text style={[s.frS, { color: t.mute }]}>WANTS TO BE FRIENDS</Text>
          </View>
          <Pressable disabled={busy === f.id} onPress={() => act(f.id, () => respondFriend(f.id, true))} accessibilityRole="button" accessibilityLabel={`Accept ${f.display_name}`}>
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.ch}>
              <Text style={[s.chT, { color: t.onGrad }]}>Accept</Text>
            </LinearGradient>
          </Pressable>
          <Pressable disabled={busy === f.id} onPress={() => act(f.id, () => respondFriend(f.id, false))} style={[s.x, line]} accessibilityRole="button" accessibilityLabel={`Decline ${f.display_name}`}>
            <Text style={[s.xT, { color: t.mute }]}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Text style={[s.sub, { color: t.mute }]}>{`YOUR FRIENDS · ${friends.filter((f) => f.kind === 'friend').length}`}</Text>
      {friends.length === 0 ? <Text style={[s.note, { color: t.mute }]}>No friends yet. Share your friend pass to add some.</Text> : null}
      {friends.map((f) => {
        const when = f.kind === 'outgoing' ? 'REQUEST SENT' : seenLabel(f.last_seen);
        return (
          <View key={f.id} style={[s.fr, line]}>
            <Ring t={t} f={f} />
            <Pressable style={s.frT} onPress={() => openMenu(f)} accessibilityRole="button" accessibilityHint="Remove or block">
              <Name t={t} f={f} />
              <Text style={[s.frS, { color: when === 'ONLINE' ? ONLINE[t.mode] : t.mute }]}>{when}</Text>
            </Pressable>
            {f.kind === 'friend' ? (
              // Challenge opens a room once rooms exist (wire-later.md).
              <View style={[s.ch, s.ghost, line, { opacity: 0.45 }]} accessibilityLabel={`Challenge ${f.display_name}, coming with rooms`}>
                <Text style={[s.ghT, { color: t.mute }]}>Challenge</Text>
              </View>
            ) : null}
          </View>
        );
      })}
      {friends.length ? <Text style={[s.tip, { color: t.mute }]}>Tap a friend’s name to remove or block.</Text> : null}
      {blocked.length ? (
        <View style={s.blk}>
          <Pressable onPress={() => setShowBlocked((v) => !v)} accessibilityRole="button">
            <Text style={[s.tip, { color: t.mute, textDecorationLine: 'underline' }]}>{`Blocked players (${blocked.length})`}</Text>
          </Pressable>
          {showBlocked
            ? blocked.map((b) => (
                <View key={b.id} style={[s.fr, line]}>
                  <Face slug={b.avatar} size={u(20)} />
                  <Text style={[s.frB, { color: t.fg, flex: 1 }]}>{b.display_name}</Text>
                  <Pressable disabled={busy === b.id} onPress={() => act(b.id, () => unblockUser(b.id))} style={[s.ch, s.ghost, line]} accessibilityRole="button">
                    <Text style={[s.ghT, { color: t.mute }]}>Unblock</Text>
                  </Pressable>
                </View>
              ))
            : null}
        </View>
      ) : null}
    </>
  );
}

export function Ring({ t, f }: { t: Theme; f: { avatar: string } }) {
  return (
    <View style={[s.ring, { borderColor: t.mode === 'light' ? 'rgba(184,116,31,0.3)' : 'rgba(201,184,255,0.3)' }]}>
      <Face slug={f.avatar} size={u(20)} />
    </View>
  );
}

export function Name({ t, f, size = 17 }: { t: Theme; f: Friend; size?: number }) {
  return (
    <View style={s.nm}>
      <Text style={[s.frB, { color: t.fg, fontSize: u(size), lineHeight: u(size) }]} numberOfLines={1}>
        {f.display_name}
      </Text>
      <LevelBadge level={f.level} size={u(size * 0.78)} />
    </View>
  );
}

export const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: u(10) },
  sh2: { marginTop: u(10), marginBottom: u(2), fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12), letterSpacing: u(1.7) },
  add: { fontFamily: F.bodySemi, fontSize: u(10) },
  sub: { marginTop: u(8), fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(1.2) },
  note: { marginTop: u(6), fontFamily: F.body, fontSize: u(10), lineHeight: u(14) },
  tip: { marginTop: u(10), fontFamily: F.body, fontSize: u(9.5), textAlign: 'center' },
  blk: { gap: u(2) },
  fr: { flexDirection: 'row', alignItems: 'center', gap: u(10), paddingVertical: u(9), borderBottomWidth: 1 },
  ring: { width: u(26), height: u(26), borderRadius: u(13), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  frT: { flex: 1, minWidth: 0 },
  nm: { flexDirection: 'row', alignItems: 'center', gap: u(5) },
  frB: { fontFamily: F.display, fontSize: u(17), lineHeight: u(17), flexShrink: 1 },
  frS: { marginTop: u(3), fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(1.05) },
  ch: { height: u(23), paddingHorizontal: u(10), borderRadius: u(10), justifyContent: 'center' },
  ghost: { height: u(25), borderWidth: 1 },
  chT: { fontFamily: F.bodyBold, fontSize: u(9.5) },
  ghT: { fontFamily: F.bodySemi, fontSize: u(9.5) },
  x: { width: u(23), height: u(23), borderRadius: u(10), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  xT: { fontSize: u(9) },
});
