import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { useApp, useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** Placeholder until each game screen is designed. */
export function PlaySheet() {
  const t = useTheme();
  const { playing, setPlaying } = useApp();
  return (
    <Sheet open={!!playing} onClose={() => setPlaying(null)}>
      <Text style={[s.k, { color: t.accent }]}>GAME SCREEN</Text>
      <Text style={[s.h, { color: t.white }]}>{playing}</Text>
      <Text style={[s.p, { color: t.mute }]}>Each game gets its own design next. This is where Play will open it.</Text>
      <Pressable onPress={() => setPlaying(null)}>
        <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.btn}>
          <Text style={[s.btnT, { color: t.onGrad }]}>Back to games</Text>
        </LinearGradient>
      </Pressable>
    </Sheet>
  );
}

const s = StyleSheet.create({
  k: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.7), marginTop: u(6) },
  h: { fontFamily: F.display, fontSize: u(26), lineHeight: u(28) },
  p: { fontFamily: F.body, fontSize: u(12), lineHeight: u(18) },
  btn: { borderRadius: u(14), paddingVertical: u(12), alignItems: 'center', marginTop: u(4) },
  btnT: { fontFamily: F.bodySemi, fontSize: u(13) },
});
