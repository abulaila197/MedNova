import { StyleSheet } from 'react-native';

import { Text } from '@/components/AppText';
import { agoText } from '@/lib/copies';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** The line over a page shown from its saved copy while the server can't be reached (#59, Yazan 2026-10-26). */
export function OfflineLine({ at, style }: { at: number | null | undefined; style?: object }) {
  const t = useTheme();
  if (at == null) return null;
  return <Text style={[s.l, { color: t.mute }, style]}>{`OFFLINE · LAST UPDATED ${agoText(at).toUpperCase()}`}</Text>;
}

const s = StyleSheet.create({ l: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.2), marginTop: u(8) } });
