import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { useLearnColors } from './palette';

/** Page title of a Learn page: "Today's review" with a small mono count on the right. */
export function PageTitle({ first, em, small }: { first: string; em: string; small: string }) {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  return (
    <View style={s.pt}>
      <Text style={[s.big, { color: t.fg }]}>{first}</Text>
      <Text style={[s.big, { color: t.accent }]}>{em}</Text>
      <Text style={[s.small, { color: c.mute }]}>{small}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pt: { flexDirection: 'row', alignItems: 'baseline', gap: u(8), height: u(29) },
  big: { fontFamily: F.display, fontSize: u(24), lineHeight: u(29), letterSpacing: u(-0.48) },
  small: { marginLeft: 'auto', fontFamily: F.mono, fontSize: u(10), lineHeight: u(13) },
});
