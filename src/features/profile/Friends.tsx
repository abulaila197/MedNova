import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { create } from 'zustand';

import { LevelBadge } from '@/components/LevelBadge';
import { PlayerFace } from '@/features/style/Frame';
import { useSecond } from '@/lib/useSecond';
import { useAccount } from '@/state/account';
import { clock } from '@/games/engine/clock';
import { acceptInvite, challenge, useInvites } from '@/online/invites';
import { type Friend, respondFriend, seenLabel, useFriends } from '@/state/friends';
import { u } from '@/theme/scale';
import { F, type Theme } from '@/theme/tokens';

/** Which friends sheet is open (drawn by FriendSheets at the app layout so it covers the dock). */
/** A player to report: from the friends list or an online lobby. */
export type ReportTarget = { id: string; name: string; avatar: string };
type SheetState = { open: null | 'add' | 'menu' | 'report'; friend: Friend | null; code: string; target: ReportTarget | null };
export const useFriendSheet = create<SheetState>(() => ({ open: null, friend: null, code: '', target: null }));
export const openAdd = (code = '') => useFriendSheet.setState({ open: 'add', friend: null, code, target: null });
const openMenu = (friend: Friend) => useFriendSheet.setState({ open: 'menu', friend, code: '', target: null });
export const openReport = (target: ReportTarget) => useFriendSheet.setState({ open: 'report', friend: null, code: '', target });

const ONLINE = { dark: '#7be0a8', light: '#5e9e6a' };

/**
 * Friends (FR1-FR4): requests with Accept and ✕, then friends with face, level and Online / last seen.
 * The Friends page shows one tab at a time (`only`); Profile shows just the count (FriendCount).
 */
export function FriendsSection({ t, only }: { t: Theme; only?: 'friends' | 'requests' }) {
  const profile = useAccount((a) => a.profile);
  const list = useFriends((x) => x.list);
  const [busy, setBusy] = useState<string | null>(null);
  const invites = useInvites((x) => x.list);
  // Ticks the "time left" on challenges once a second while any are open.
  const now = useSecond(invites.length > 0);
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

  const showReq = only !== 'friends';
  const showFr = only !== 'requests';
  return (
    <>
      {only ? null : (
        <View style={s.head}>
          <Text style={[s.sh2, { color: t.kick }]}>FRIENDS</Text>
          <Pressable onPress={() => openAdd()} hitSlop={u(8)} accessibilityRole="button">
            <Text style={[s.add, { color: t.accent }]}>+ Add friend</Text>
          </Pressable>
        </View>
      )}
      {only === 'requests' && !incoming.length ? <Text style={[s.note, { color: t.mute }]}>No requests right now.</Text> : null}
      {showReq && incoming.length && !only ? <Text style={[s.sub, { color: t.mute }]}>{`REQUESTS · ${incoming.length}`}</Text> : null}
      {(showReq ? incoming : []).map((f) => (
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
      {showFr && !only ? <Text style={[s.sub, { color: t.mute }]}>{`YOUR FRIENDS · ${friends.filter((f) => f.kind === 'friend').length}`}</Text> : null}
      {showFr && friends.length === 0 ? <Text style={[s.note, { color: t.mute }]}>No friends yet. Find players or share your invite code.</Text> : null}
      {(showFr ? friends : []).map((f) => {
        const inv = invites.find((x) => x.from_user === f.id);
        const when = inv ? `CHALLENGED YOU · ${clock(Date.parse(inv.expires_at) - now, { down: true })} LEFT` : f.kind === 'outgoing' ? 'REQUEST SENT' : seenLabel(f.last_seen, invites.length ? now : undefined);
        return (
          <View key={f.id} style={[s.fr, line]}>
            <Ring t={t} f={f} />
            <Pressable style={s.frT} onPress={() => openMenu(f)} accessibilityRole="button" accessibilityHint="Remove, block or report">
              <Name t={t} f={f} />
              <Text style={[s.frS, { color: inv ? t.accent : when === 'ONLINE' ? ONLINE[t.mode] : t.mute }]}>{when}</Text>
            </Pressable>
            {inv ? (
              // ON24: a challenge waits here for 10 minutes after its banner.
              <Pressable onPress={() => acceptInvite(inv)} accessibilityRole="button" accessibilityLabel={`Join ${f.display_name}'s challenge`}>
                <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.ch}>
                  <Text style={[s.chT, { color: t.onGrad }]}>Join</Text>
                </LinearGradient>
              </Pressable>
            ) : f.kind === 'friend' ? (
              // ON24: opens a private room for The Diagnostic Pursuit (the only online game so far) and invites them.
              <Pressable
                disabled={busy === f.id}
                onPress={() => act(f.id, async () => void (await challenge(f.id, 'the-diagnostic-pursuit', { difficulty: 'Medium', cases: 5, teams: 0 })))}
                style={[s.ch, s.ghost, line, busy === f.id && { opacity: 0.5 }]}
                accessibilityRole="button"
                accessibilityLabel={`Challenge ${f.display_name}`}>
                <Text style={[s.ghT, { color: t.fg }]}>Challenge</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {showFr && friends.length ? <Text style={[s.tip, { color: t.mute }]}>Tap a friend’s name to remove or block.</Text> : null}
    </>
  );
}

/** Profile keeps only the count; the list lives on the Friends page (Yazan 2026-10-11). */
export function FriendCount({ t }: { t: Theme }) {
  const profile = useAccount((a) => a.profile);
  const list = useFriends((x) => x.list);
  const n = list.filter((f) => f.kind === 'friend').length;
  const req = list.filter((f) => f.kind === 'incoming').length;
  return (
    <Pressable onPress={() => router.navigate((profile ? '/friends' : '/auth') as never)} style={[s.fr, { borderColor: t.panelLine, marginTop: u(10) }]} accessibilityRole="link">
      <View style={s.frT}>
        <Text style={[s.sh2, { color: t.kick, marginTop: 0 }]}>FRIENDS</Text>
        <Text style={[s.frB, { color: t.fg }]}>{profile ? `${n} friend${n === 1 ? '' : 's'}` : 'Sign in to add friends'}</Text>
        {req ? <Text style={[s.frS, { color: t.accent }]}>{`${req} REQUEST${req === 1 ? '' : 'S'} WAITING`}</Text> : null}
      </View>
      <Text style={[s.add, { color: t.accent }]}>Open ›</Text>
    </Pressable>
  );
}

export function Ring({ t, f }: { t: Theme; f: { avatar: string; id?: string } }) {
  return (
    <View style={[s.ring, { borderColor: t.mode === 'light' ? 'rgba(184,116,31,0.3)' : 'rgba(201,184,255,0.3)' }]}>
      <PlayerFace slug={f.avatar} size={u(20)} userId={f.id} still />
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
