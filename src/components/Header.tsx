import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MenuIcon } from '@/components/Icons';
import { PulseStar } from '@/components/PulseStar';
import { useApp, useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** Locked header (decisions 59-60): see-through bar with blur and a lit bottom edge. */
export function Header() {
  const t = useTheme();
  const lt = t.mode === 'light';
  const setMenu = useApp((s) => s.setMenu);
  const setReport = useApp((s) => s.setReport);
  return (
    <View style={[s.bar, { shadowColor: lt ? 'rgba(80,60,20,0.35)' : '#000' }]}>
      <BlurView intensity={20} tint={lt ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[t.headerTop, t.headerBottom]} style={StyleSheet.absoluteFill} />
      <View style={[s.edge, { backgroundColor: t.headerEdge }]} />
      {lt ? <View style={[s.edge, { bottom: -1, backgroundColor: 'rgba(29,34,48,0.12)' }]} /> : null}
      <View style={s.row}>
        <Pressable onPress={() => setMenu(true)} style={[s.mb, { backgroundColor: t.chip, borderColor: t.chipLine }]} accessibilityLabel="Open menu">
          <MenuIcon size={u(14)} color={t.menuBtn} />
        </Pressable>
        <View style={s.lk}>
          <PulseStar width={u(20)} height={u(21)} light={lt} />
          <Text style={[s.wmk, { color: t.white }]}>
            Med<Text style={{ color: t.accent }}>Nova</Text>
          </Text>
        </View>
      </View>
      <View style={s.row}>
        <Pressable onPress={() => setReport(true)} style={[s.rp, { backgroundColor: t.red }]} accessibilityLabel="Report a problem">
          <Text style={s.rpT}>!</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/auth')} accessibilityLabel="Sign in">
          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.si}>
            <Text style={[s.siT, { color: t.onGrad }]}>Sign in</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    height: u(42),
    paddingHorizontal: u(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
    shadowOffset: { width: 0, height: u(6) },
    shadowOpacity: 0.7,
    shadowRadius: u(7),
  },
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  mb: { width: u(26), height: u(26), borderRadius: u(9), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  lk: { flexDirection: 'row', alignItems: 'center', gap: u(5) },
  wmk: { fontFamily: F.display, fontSize: u(17), letterSpacing: u(-0.17) },
  rp: { width: u(20), height: u(20), borderRadius: u(10), alignItems: 'center', justifyContent: 'center' },
  rpT: { color: '#fff', fontFamily: F.bodyBold, fontSize: u(11), lineHeight: u(13) },
  si: { paddingVertical: u(5), paddingHorizontal: u(10), borderRadius: 999 },
  siT: { fontFamily: F.bodySemi, fontSize: u(10) },
});
