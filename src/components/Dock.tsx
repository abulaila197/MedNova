import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { CommunityIcon, GamesIcon, LearnIcon } from '@/components/Icons';
import { useTheme } from '@/state/app';
import { DESIGN_W, u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tapped } from '@/lib/sound';

export type Tab = 'learn' | 'games' | 'community' | null;

// Tab row height; the icon and name sit centred in it. On web the row runs down to the drawn home line, so the gap
// above the icon matches the gap below the name.
const H = Platform.OS === 'web' ? 46 : 40;

/**
 * Docked nav (decision 46, slimmed 2026-10-13; redesign 2026-10-17): edge to edge, shows the page's own navy backdrop
 * (no bar colour of its own), hairline top edge and dividers, brand type, raised Games box.
 */
export function Dock({ active }: { active: Tab }) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const bottom = Platform.OS === 'web' ? u(8) : Math.max(ins.bottom, u(8));
  const go = tapped((r: Tab) => r && router.navigate(`/${r}`));
  const tab = (key: Exclude<Tab, null>, label: string, Icon: typeof LearnIcon) => {
    const on = active === key;
    const g = key === 'games';
    const col = on ? t.fg : t.tabOff;
    return (
      <Pressable key={key} onPress={() => go(key)} style={[s.tab, on && { backgroundColor: t.tabOn }]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
        {g ? (
          <View style={[s.gbox, { shadowColor: t.gamesGlow }]}>
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.gfill}>
              <View style={s.glit} />
              <GamesIcon size={u(21)} color={t.onGrad} />
            </LinearGradient>
          </View>
        ) : (
          <Icon size={u(18)} color={col} />
        )}
        {/* Keeps the Games name level with the others while its box rises out of the bar. */}
        {g ? <View style={s.gslot} /> : null}
        <Text style={[s.lbl, { color: col }]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[s.dock, { paddingBottom: bottom, height: u(H) + bottom, borderTopColor: t.headerEdge }]}>
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}><Backdrop anchor="bottom" /></View>
      {/* The header's own navy (Yazan 2026-10-13). */}
      {[1, 2].map((i) => (
        <LinearGradient
          key={i}
          colors={['transparent', t.dockDivider, t.dockDivider, 'transparent']}
          locations={[0, 0.3, 0.7, 1]}
          style={[s.div, { left: u(10) + ((i * (DESIGN_W - 20)) / 3) * u(1), top: u(7), height: u(H - 14) }]}
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
    gap: u(8),
    borderTopWidth: 1,
    overflow: 'visible',
  },
  div: { position: 'absolute', width: 1 },
  // Centred so the gap above the icon equals the gap below the name (the Games box rises out of the bar).
  tab: { flex: 1, marginTop: u(3), height: u(H - 6), borderRadius: u(12), alignItems: 'center', justifyContent: 'center', gap: u(2) },
  gbox: {
    position: 'absolute',
    top: u(-23),
    alignSelf: 'center',
    width: u(42),
    height: u(42),
    borderRadius: u(14),
    shadowOffset: { width: 0, height: u(8) },
    shadowOpacity: 1,
    shadowRadius: u(10),
    elevation: 10,
  },
  gslot: { width: u(18), height: u(18) },
  gfill: { flex: 1, borderRadius: u(14), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glit: { position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.45)' },
  lbl: { fontFamily: F.display, fontSize: u(10.5), letterSpacing: u(0.2) },
  hm: { position: 'absolute', left: '50%', marginLeft: u(-50), bottom: u(3), width: u(100), height: u(4), borderRadius: u(4), opacity: 0.5 },
});
