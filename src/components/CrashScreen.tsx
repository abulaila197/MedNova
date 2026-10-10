import type { ErrorBoundaryProps } from 'expo-router';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { u } from '@/theme/scale';
import { F, THEMES } from '@/theme/tokens';

const t = THEMES.dark;

/**
 * Shown instead of a page when it throws, so a bug becomes a readable message with a way back
 * instead of the app closing. The message helps us find the cause (send a screenshot).
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const home = () => {
    try {
      router.replace('/games');
    } catch {
      void retry();
    }
  };
  return (
    <View style={s.root}>
      <Text style={s.ttl}>Something went wrong</Text>
      <Text style={s.sub}>This page hit a problem. A screenshot of this message helps us fix it.</Text>
      <ScrollView style={s.box} contentContainerStyle={{ padding: u(10) }}>
        <Text style={s.err} selectable>
          {String(error?.message ?? error)}
        </Text>
      </ScrollView>
      <View style={s.row}>
        <Pressable onPress={() => void retry()} style={[s.btn, { backgroundColor: t.accent }]} accessibilityRole="button">
          <Text style={[s.btnT, { color: t.onGrad }]}>Try again</Text>
        </Pressable>
        <Pressable onPress={home} style={[s.btn, { borderWidth: 1, borderColor: t.hair }]} accessibilityRole="button">
          <Text style={[s.btnT, { color: t.fg }]}>Go to Games</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.sky, paddingHorizontal: u(20), paddingTop: u(80), paddingBottom: u(40) },
  ttl: { color: t.white, fontFamily: F.display, fontSize: u(24), lineHeight: u(28) },
  sub: { color: t.soft, fontFamily: F.body, fontSize: u(11), lineHeight: u(16), marginTop: u(8) },
  box: { flexGrow: 0, maxHeight: u(220), marginTop: u(16), borderRadius: u(10), backgroundColor: t.card2, borderWidth: 1, borderColor: t.line },
  err: { color: t.mute, fontFamily: F.mono, fontSize: u(9), lineHeight: u(13) },
  row: { flexDirection: 'row', gap: u(10), marginTop: u(18) },
  btn: { borderRadius: u(12), paddingVertical: u(9), paddingHorizontal: u(16) },
  btnT: { fontFamily: F.bodyBold, fontSize: u(12) },
});
