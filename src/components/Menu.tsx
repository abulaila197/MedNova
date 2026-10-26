import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBalance } from '@/components/LevelBadge';
import { Moon } from '@/components/Moon';
import { loadAchievements } from '@/features/achievements/useAchievements';
import { engine, GUEST_PLAYS } from '@/games/engine';
import { sfx, tapped, useSound } from '@/lib/sound';
import { signOut, useAccount } from '@/state/account';
import { useApp, useTheme } from '@/state/app';
import { useFriends } from '@/state/friends';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

const ITEMS = [
  ['My Profile', '/profile'], // first item (Yazan 2026-10-21); the moon button still opens it too
  ['Leaderboard', '/leaderboard'],
  ['Friends', '/friends'],
  ['Achievements', '/achievements'],
  ['My cards', '/cards'],
  ['Nova Shop', '/store'],
  ['Contact', '/contact'],
  ['About', '/about'],
  ['FAQ', '/faq'],
  ['Privacy & Terms', '/privacy'],
] as const;

/** Locked side menu ("Journal index"): sits under the app card, which slides aside. */
export function Menu() {
  const t = useTheme();
  const path = usePathname();
  const setMenu = useApp((a) => a.setMenu);
  const ins = useSafeAreaInsets();
  const muted = useSound((m) => m.muted);
  const setMuted = useSound((m) => m.setMuted);
  const profile = useAccount((a) => a.profile);
  const { level, into, need } = useBalance();
  const isAdmin = useAccount((a) => a.isAdmin);
  const items = isAdmin ? [...ITEMS, ['Admin', '/admin'] as const] : ITEMS;
  const [outErr, setOutErr] = useState(false);
  // AC6: a dot on Achievements while a reached tier waits to be collected (signed in only).
  const open = useApp((a) => a.menuOpen);
  const friends = useFriends((f) => f.list);
  const [waiting, setWaiting] = useState(false);
  if ((!open || !profile) && waiting) setWaiting(false);
  useEffect(() => {
    if (!open || !profile) return;
    loadAchievements(friends.map((f) => f.id), profile.id)
      .then((rows) => setWaiting(rows.some((r) => r.paid < r.reached)))
      .catch(() => {});
  }, [open, profile, friends]);
  // Guests: free plays left, 5 in total (#83).
  const [tries, setTries] = useState<number | null>(null);
  useEffect(() => {
    if (!open || profile) return;
    engine.gate.guestLeft().then(setTries, () => {});
  }, [open, profile]);
  const out = () => {
    setOutErr(false);
    signOut().catch(() => setOutErr(true));
  };
  const top = (Platform.OS === 'web' ? u(30) : ins.top) + u(14);
  const go = tapped((to: string) => {
    setMenu(false);
    router.navigate(to as never);
  });
  return (
    // Keeps clear of the phone's own buttons at the bottom (2026-10-19: the version line sat under them).
    <View style={[s.col, { top, bottom: u(22) + (Platform.OS === 'web' ? 0 : ins.bottom) }]}>
      <Pressable onPress={tapped(() => setMenu(false))} style={[s.close, { backgroundColor: t.panel, borderColor: t.panelLine }]} accessibilityLabel="Close menu">
        <Text style={{ color: t.mute, fontSize: u(15) }}>×</Text>
      </Pressable>
      <Pressable style={s.moonc} onPress={() => go('/profile')}>
        {/* Signed in, the moon carries your level and its phase is how far into the next one (#34). */}
        <View>
          <Moon size={u(54)} f={profile ? 0.2 + 0.8 * (need ? into / need : 0) : 0.3} />
          {profile ? (
            <View style={[StyleSheet.absoluteFill, s.moonL]} accessibilityLabel={`Level ${level}`}>
              <Text style={[s.moonK, { color: t.white }]}>LEVEL</Text>
              <Text style={[s.moonN, { color: t.white }]}>{level}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          {profile ? (
            <>
              <Text style={[s.guest, { color: t.white }]} numberOfLines={1}>{`Dr. ${profile.display_name}`}</Text>
              <Text style={[s.small, { color: t.mute }]}>{`@${profile.username}`}</Text>
              <Pressable onPress={out}>
                <Text style={[s.keep, { color: t.accent, borderBottomColor: t.accent }]}>Sign out</Text>
              </Pressable>
              {outErr ? <Text style={[s.small, { color: t.error }]}>Couldn’t sign out. Please try again.</Text> : null}
            </>
          ) : (
            <>
              <Text style={[s.guest, { color: t.white }]}>Guest doctor</Text>
              <Text style={[s.small, { color: t.mute }]}>
                {tries == null ? ' ' : tries === 0 ? 'No free plays left' : `${tries} of ${GUEST_PLAYS} free plays left`}
              </Text>
              <Pressable onPress={() => go('/auth')}>
                <Text style={[s.keep, { color: t.accent, borderBottomColor: t.accent }]}>Sign in to keep it</Text>
              </Pressable>
            </>
          )}
        </View>
      </Pressable>
      {/* The list scrolls if it can't fit, so it never runs over the profile or the Sound switch (2026-10-19). */}
      <ScrollView style={s.items} contentContainerStyle={s.itemsIn} showsVerticalScrollIndicator={false}>
        {items.map(([label, to], i) => {
          const on = path === to;
          return (
            <Pressable key={to} onPress={() => go(to)} style={[s.r, { borderBottomColor: t.panelLine }, i === 0 && { borderTopWidth: 1, borderTopColor: t.panelLine }]}>
              <Text style={[s.no, { color: t.kick }]} numberOfLines={1}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={[s.lbl, { color: on ? t.accent : t.white, fontFamily: on ? F.displayItalic : F.display }]}>{label}</Text>
              {waiting && to === '/achievements' ? <View style={[s.dot, { backgroundColor: t.accent }]} accessibilityLabel="Tokens waiting" /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={s.pills}>
        <View style={[s.theme, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
          {([[false, 'Sound'], [true, 'Mute']] as const).map(([key, label]) => (
            <Pressable key={label} onPress={() => {
              setMuted(key);
              if (!key) void sfx('tap');
            }} accessibilityRole="button" accessibilityState={{ selected: muted === key }}>
              {muted === key ? (
                <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.opt}>
                  <Text style={[s.optT, { color: t.onGrad }]}>{label}</Text>
                </LinearGradient>
              ) : (
                <View style={s.opt}>
                  <Text style={[s.optT, { color: t.mute }]}>{label}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={[s.ver, { color: t.mute }]}>MEDNOVA · V0.1</Text>
    </View>
  );
}

const s = StyleSheet.create({
  col: { position: 'absolute', left: u(18), bottom: u(22), width: '56%', zIndex: 1 },
  close: { width: u(30), height: u(30), borderRadius: u(10), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  moonL: { alignItems: 'center', justifyContent: 'center' },
  moonK: { fontFamily: F.mono, fontSize: u(6), letterSpacing: u(1.2), marginBottom: -u(2), textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: u(4) },
  moonN: { fontFamily: F.display, fontSize: u(22), lineHeight: u(26), textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: u(5) },
  moonc: { flexDirection: 'row', alignItems: 'center', gap: u(10), marginTop: u(16) },
  guest: { fontFamily: F.display, fontSize: u(18), lineHeight: u(18) },
  small: { fontFamily: F.body, fontSize: u(9), marginTop: u(3) },
  keep: { fontFamily: F.bodySemi, fontSize: u(9.5), marginTop: u(7), alignSelf: 'flex-start', borderBottomWidth: 1 },
  items: { flex: 1, marginVertical: u(10) },
  itemsIn: { flexGrow: 1, justifyContent: 'center' },
  r: { flexDirection: 'row', alignItems: 'baseline', gap: u(12), paddingVertical: u(9), borderBottomWidth: 1 },
  no: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.275), width: u(16) },
  lbl: { fontSize: u(14.5), lineHeight: u(16.5), flex: 1 },
  dot: { width: u(7), height: u(7), borderRadius: u(4), alignSelf: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8) },
  theme: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, padding: u(3) },
  opt: { paddingVertical: u(5), paddingHorizontal: u(11), borderRadius: 999 },
  optT: { fontFamily: F.bodySemi, fontSize: u(9.5) },
  ver: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.5), marginTop: u(10) },
});
