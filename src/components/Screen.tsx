import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useId, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dock, type Tab } from '@/components/Dock';
import { Backdrop } from '@/components/Backdrop';
import { Header } from '@/components/Header';
import { TopInset } from '@/components/TopInset';
import { useTheme } from '@/state/app';
import { clearSideBg, setSideBg } from '@/state/sideBg';
import { ColumnW, DESIGN_W, TABLET, u } from '@/theme/scale';

const COL = u(DESIGN_W);

/**
 * A page of the app: the still navy backdrop, header, content, docked nav. The header and dock show the same
 * backdrop, so they run on from the page. `glow` is false when the page draws its own opaque background.
 * The one owner of the screen edges: the header keeps clear of the status bar, and the bottom keeps
 * clear of the phone's system buttons (the dock does it when shown, the content does it otherwise).
 */
export function Screen({ children, tab = null, glow = 0, header = true, dock = true, under, side, game = false, wide = false }: { children: ReactNode; tab?: Tab; glow?: number | false; header?: boolean; dock?: boolean; under?: ReactNode; side?: ReactNode; game?: boolean; wide?: boolean }) {
  const t = useTheme();
  // #12: a page with its own background shows it beside the centred column on wide screens (SideSky). `side` is
  // that background without any drawing on it; by default it is `under` itself.
  const id = useId();
  const [headH, setHeadH] = useState(0);
  const own = glow === false ? (side ?? under ?? null) : null;
  useFocusEffect(
    useCallback(() => {
      if (!own) return;
      setSideBg({ id, node: own, header: header ? headH : 0 });
      return () => clearSideBg(id);
    }, [own, id, header, headH]),
  );
  const ins = useSafeAreaInsets();
  const bottom = dock || Platform.OS === 'web' ? 0 : ins.bottom;
  return (
    <View style={[s.root, { backgroundColor: t.sky }]}>
      {glow === false ? null : <Backdrop />}
      {under}
      {header ? (
        <View style={{ overflow: 'hidden', zIndex: 5 }} onLayout={(e) => setHeadH(Math.round(e.nativeEvent.layout.height))}>
          {glow === false ? <View style={[StyleSheet.absoluteFill, { backgroundColor: t.sky }]} /> : <Backdrop />}
          {/* Stuck to the top edge (Yazan 2026-10-17): only the phone's own status bar sits above it, in the same navy. */}
          <View style={{ height: Platform.OS === 'web' ? 0 : ins.top }} />
          <Header variant={game ? 'game' : 'app'} />
        </View>
      ) : (
        <TopInset />
      )}
      <View style={[s.body, { paddingBottom: bottom }]}>
        {/* Android tablets: a page laid out for the width (`wide`) gets the whole screen; any other page keeps its
            phone layout in a centred phone-wide column, at the tablet's reading size, under the full-width header and
            bottom bar (Yazan 2026-11-12, look A). */}
        {TABLET && !wide ? (
          <ColumnW.Provider value={COL}>
            <View style={s.col}>{children}</View>
          </ColumnW.Provider>
        ) : (
          children
        )}
      </View>
      {dock ? <Dock active={tab} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  body: { flex: 1, zIndex: 1 },
  col: { flex: 1, width: COL, alignSelf: 'center' },
});
