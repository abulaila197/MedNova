import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Grain } from '@/components/Grain';
import { CommunityIcon, GamesIcon, LearnIcon } from '@/components/Icons';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

export type Tab = 'learn' | 'games' | 'community' | null;

/** Locked docked nav (decision 46): edge to edge, hairline dividers, material finish, raised Games box. */
export function Dock({ active }: { active: Tab }) {
  const t = useTheme();
  const lt = t.mode === 'light';
  const ins = useSafeAreaInsets();
  const bottom = Platform.OS === 'web' ? u(16) : Math.max(ins.bottom, u(10));
  const go = (r: Tab) => r && router.navigate(`/${r}`);
  const tab = (key: Exclude<Tab, null>, label: string, Icon: typeof LearnIcon) => {
    const on = active === key;
    const g = key === 'games';
    return (
      <Pressable key={key} onPress={() => go(key)} style={[s.tab, on && { backgroundColor: t.tabOn }, on && g && lt && s.gOnLt]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
        {g ? (
          <View style={[s.gbox, { shadowColor: t.gamesGlow }]}>
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.gfill}>
              <View style={s.glit} />
              <GamesIcon size={u(24)} color={t.onGrad} />
            </LinearGradient>
          </View>
        ) : (
          <Icon size={u(20)} color={on ? t.fg : t.tabOff} />
        )}
        <Text style={[s.lbl, { color: on ? t.fg : t.tabOff }]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[s.dock, { paddingBottom: bottom, height: u(54) + bottom, borderTopColor: t.dockEdge, shadowColor: lt ? 'rgba(80,60,20,0.3)' : 'rgba(0,0,0,0.7)' }]}>
      <LinearGradient colors={[t.dockTop, t.dockBottom]} style={StyleSheet.absoluteFill} />
      <Grain opacity={lt ? 0.06 : 0.07} />
      <View style={[s.lit, { backgroundColor: t.dockLit }]} />
      {[1, 2].map((i) => (
        <LinearGradient
          key={i}
          colors={['transparent', t.dockDivider, t.dockDivider, 'transparent']}
          locations={[0, 0.3, 0.7, 1]}
          style={[s.div, { left: u(10) + ((i * (282 - 20)) / 3) * (u(1)), bottom: u(22) }]}
        />
      ))}
      {tab('learn', 'Learn', LearnIcon)}
      {tab('games', 'Games', GamesIcon)}
      {tab('community', 'Community', CommunityIcon)}
      {Platform.OS === 'web' ? <View style={[s.hm, { backgroundColor: t.fg }]} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  dock: {
    zIndex: 2,
    flexDirection: 'row',
    paddingHorizontal: u(10),
    paddingTop: u(6),
    gap: u(8),
    borderTopWidth: 1,
    overflow: 'visible',
    shadowOffset: { width: 0, height: u(-10) },
    shadowOpacity: 1,
    shadowRadius: u(12),
    elevation: 12,
  },
  lit: { position: 'absolute', left: 0, right: 0, top: 0, height: 1, opacity: 1 },
  div: { position: 'absolute', top: u(14), width: 1 },
  tab: { flex: 1, height: u(48), borderRadius: u(16), alignItems: 'center', justifyContent: 'flex-end', paddingBottom: u(7), gap: u(4) },
  gOnLt: { shadowColor: 'rgba(229,131,58,0.75)', shadowOffset: { width: 0, height: u(14) }, shadowOpacity: 1, shadowRadius: u(15) },
  gbox: {
    position: 'absolute',
    top: u(-36),
    alignSelf: 'center',
    width: u(50),
    height: u(50),
    borderRadius: u(16),
    shadowOffset: { width: 0, height: u(10) },
    shadowOpacity: 1,
    shadowRadius: u(11),
    elevation: 10,
  },
  gfill: { flex: 1, borderRadius: u(16), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glit: { position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.45)' },
  lbl: { fontFamily: F.bodySemi, fontSize: u(10), letterSpacing: u(0.1) },
  hm: { position: 'absolute', left: '50%', marginLeft: u(-50), bottom: u(6), width: u(100), height: u(4), borderRadius: u(4), opacity: 0.5 },
});
