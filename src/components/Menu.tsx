import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

import { Moon } from '@/components/Moon';
import { signOut, useAccount } from '@/state/account';
import { useApp, useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

const ITEMS = [
  ['Leaderboard', '/leaderboard'],
  ['Contact', '/contact'],
  ['About', '/about'],
  ['FAQ', '/faq'],
  ['Privacy & Terms', '/privacy'],
] as const;

/** Locked side menu ("Journal index"): sits under the app card, which slides aside. */
export function Menu() {
  const t = useTheme();
  const path = usePathname();
  const { setMenu, mode, setMode } = useApp();
  const ins = useSafeAreaInsets();
  const profile = useAccount((a) => a.profile);
  const top = (Platform.OS === 'web' ? u(30) : ins.top) + u(14);
  const go = (to: string) => {
    setMenu(false);
    router.navigate(to as never);
  };
  return (
    <View style={[s.col, { top }]}>
      <Pressable onPress={() => setMenu(false)} style={[s.close, { backgroundColor: t.panel, borderColor: t.panelLine }]} accessibilityLabel="Close menu">
        <Text style={{ color: t.mute, fontSize: u(15) }}>×</Text>
      </Pressable>
      <Pressable style={s.moonc} onPress={() => go('/profile')}>
        <Moon size={u(50)} f={0.3} />
        <View style={{ flex: 1 }}>
          {profile ? (
            <>
              <Text style={[s.guest, { color: t.white }]} numberOfLines={1}>{`Dr. ${profile.display_name}`}</Text>
              <Text style={[s.small, { color: t.mute }]}>{`@${profile.username}`}</Text>
              <Pressable onPress={() => void signOut()}>
                <Text style={[s.keep, { color: t.accent, borderBottomColor: t.accent }]}>Sign out</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[s.guest, { color: t.white }]}>Guest doctor</Text>
              <Text style={[s.small, { color: t.mute }]}>3 cases played</Text>
              <Pressable onPress={() => go('/auth')}>
                <Text style={[s.keep, { color: t.accent, borderBottomColor: t.accent }]}>Sign in to keep it</Text>
              </Pressable>
            </>
          )}
        </View>
      </Pressable>
      <View style={s.items}>
        {ITEMS.map(([label, to], i) => {
          const on = path === to;
          return (
            <Pressable key={to} onPress={() => go(to)} style={[s.r, { borderBottomColor: t.panelLine }, i === 0 && { borderTopWidth: 1, borderTopColor: t.panelLine }]}>
              <Text style={[s.no, { color: t.kick }]}>0{i + 1}</Text>
              <Text style={[s.lbl, { color: on ? t.accent : t.white, fontFamily: on ? F.displayItalic : F.display }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[s.theme, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
        {(['dark', 'light'] as const).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} accessibilityRole="button" accessibilityState={{ selected: mode === m }}>
            {mode === m ? (
              <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.opt}>
                <Text style={[s.optT, { color: t.onGrad }]}>{m === 'dark' ? 'Dark' : 'Light'}</Text>
              </LinearGradient>
            ) : (
              <View style={s.opt}>
                <Text style={[s.optT, { color: t.mute }]}>{m === 'dark' ? 'Dark' : 'Light'}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
      <Text style={[s.ver, { color: t.mute }]}>MEDNOVA · V0.1</Text>
    </View>
  );
}

const s = StyleSheet.create({
  col: { position: 'absolute', left: u(18), bottom: u(22), width: '56%', zIndex: 1 },
  close: { width: u(30), height: u(30), borderRadius: u(10), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  moonc: { flexDirection: 'row', alignItems: 'center', gap: u(10), marginTop: u(16) },
  guest: { fontFamily: F.display, fontSize: u(18), lineHeight: u(18) },
  small: { fontFamily: F.body, fontSize: u(9), marginTop: u(3) },
  keep: { fontFamily: F.bodySemi, fontSize: u(9.5), marginTop: u(7), alignSelf: 'flex-start', borderBottomWidth: 1 },
  items: { flex: 1, justifyContent: 'center' },
  r: { flexDirection: 'row', alignItems: 'baseline', gap: u(12), paddingVertical: u(9), borderBottomWidth: 1 },
  no: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.275), width: u(13) },
  lbl: { fontSize: u(21), lineHeight: u(21), flex: 1 },
  theme: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, padding: u(3) },
  opt: { paddingVertical: u(5), paddingHorizontal: u(11), borderRadius: 999 },
  optT: { fontFamily: F.bodySemi, fontSize: u(9.5) },
  ver: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.5), marginTop: u(10) },
});
