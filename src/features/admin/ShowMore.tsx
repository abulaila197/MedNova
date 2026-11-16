import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/AppText';
import type { useInfo } from '@/features/info/ui';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** Every list on the Admin page shows ten rows, then ten more per tap (Yazan 2026-11-16). */
export const ADMIN_PAGE = 10;

/**
 * How many rows of an already loaded list are shown: ten, and ten more per `more()`. A new `list` key (another tab or
 * filter) starts again from ten.
 */
export function useShown(list: string) {
  const [at, setAt] = useState({ list, n: ADMIN_PAGE });
  const n = at.list === list ? at.n : ADMIN_PAGE;
  return [n, () => setAt({ list, n: n + ADMIN_PAGE })] as const;
}

/** The "Show 10 more" button under an Admin list. */
export function ShowMore({ c, onPress, busy = false }: { c: ReturnType<typeof useInfo>; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={busy ? undefined : onPress} style={[s.btn, { borderColor: c.line }]} accessibilityRole="button" accessibilityState={{ busy }}>
      <Text style={[s.t, { color: c.t.accent }]}>{busy ? 'LOADING…' : `SHOW ${ADMIN_PAGE} MORE`}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { alignSelf: 'center', borderWidth: 1, borderRadius: u(10), paddingVertical: u(6), paddingHorizontal: u(14), marginTop: u(8) },
  t: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.5) },
});
