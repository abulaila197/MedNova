import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** "‹ Dossiers" style back link: goes back, or to `fallback` when the page was opened directly. */
export function Back({ label, fallback }: { label: string; fallback: Href }) {
  const t = useTheme();
  const go = () => (router.canGoBack() ? router.back() : router.replace(fallback));
  return (
    <Pressable onPress={go} hitSlop={u(8)} accessibilityRole="link" accessibilityLabel={`Back to ${label}`}>
      <Text style={[s.bk, { color: t.accent }]}>‹ {label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  bk: { fontFamily: F.bodySemi, fontSize: u(12), lineHeight: u(15) },
});
