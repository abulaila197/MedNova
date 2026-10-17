import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dock, type Tab } from '@/components/Dock';
import { Backdrop } from '@/components/Backdrop';
import { Header } from '@/components/Header';
import { TopInset } from '@/components/TopInset';
import { useTheme } from '@/state/app';

/**
 * A page of the app: the still navy backdrop, header, content, docked nav. The header and dock show the same
 * backdrop, so they run on from the page. `glow` is false when the page draws its own opaque background.
 * The one owner of the screen edges: the header keeps clear of the status bar, and the bottom keeps
 * clear of the phone's system buttons (the dock does it when shown, the content does it otherwise).
 */
export function Screen({ children, tab = null, glow = 0, header = true, dock = true, under, game = false }: { children: ReactNode; tab?: Tab; glow?: number | false; header?: boolean; dock?: boolean; under?: ReactNode; game?: boolean }) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const bottom = dock || Platform.OS === 'web' ? 0 : ins.bottom;
  return (
    <View style={[s.root, { backgroundColor: t.sky }]}>
      {glow === false ? null : <Backdrop />}
      {under}
      {header ? (
        <View style={{ overflow: 'hidden', zIndex: 5 }}>
          {glow === false ? <View style={[StyleSheet.absoluteFill, { backgroundColor: t.sky }]} /> : <Backdrop />}
          {/* Stuck to the top edge (Yazan 2026-10-17): only the phone's own status bar sits above it, in the same navy. */}
          <View style={{ height: Platform.OS === 'web' ? 0 : ins.top }} />
          <Header variant={game ? 'game' : 'app'} />
        </View>
      ) : (
        <TopInset />
      )}
      <View style={[s.body, { paddingBottom: bottom }]}>{children}</View>
      {dock ? <Dock active={tab} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  body: { flex: 1, zIndex: 1 },
});
