import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useId, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dock, type Tab } from '@/components/Dock';
import { Backdrop } from '@/components/Backdrop';
import { Calm, type CalmStops } from '@/components/Calm';
import { Header } from '@/components/Header';
import { TopInset } from '@/components/TopInset';
import { useTheme } from '@/state/app';
import { clearSideBg, setSideBg } from '@/state/sideBg';
import { ColumnW, DESIGN_W, FRAME_W, TABLET, u } from '@/theme/scale';

const COL = u(DESIGN_W);
/** Calm edge above the dock: clear at the top of its strip, plain navy from just above the dock down (Yazan 2026-11-16). */
const CALM_H = u(120);
const CALM_DOCK: CalmStops = [[0, 0], [0.3, 0.22], [0.6, 0.7], [0.82, 1], [1, 1]];

/**
 * A page of the app: the still navy backdrop, header, content, docked nav. `glow` is false when the page draws its own
 * opaque background. The background is drawn once, at the page's own laid-out size (not the window's, which on Android leaves out the
 * system buttons): the header is see-through over it, and the dock is plain navy with a calm edge above it, so lists
 * fade into plain navy (Calm). Nothing draws a second copy of the picture.
 * The one owner of the screen edges: the header keeps clear of the status bar, and the bottom keeps
 * clear of the phone's system buttons (the dock does it when shown, the content does it otherwise).
 */
export function Screen({ children, tab = null, glow = 0, header = true, dock = true, under, side, game = false, wide = false, symbols = false }: { children: ReactNode; tab?: Tab; glow?: number | false; header?: boolean; dock?: boolean; under?: ReactNode; side?: ReactNode; game?: boolean; wide?: boolean | number; /** The still medical symbols behind the page (approved menu pages only, Yazan 2026-11-12). */ symbols?: boolean }) {
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
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      style={[s.root, { backgroundColor: t.sky }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((was) => (was && Math.abs(was.width - width) < 0.5 && Math.abs(was.height - height) < 0.5 ? was : { width, height }));
      }}
    >
      {glow === false ? null : <Backdrop symbols={symbols && !game} size={size ?? undefined} />}
      {under}
      {header ? (
        <View style={{ overflow: 'hidden', zIndex: 5 }} onLayout={(e) => setHeadH(Math.round(e.nativeEvent.layout.height))}>
          {glow === false ? <View style={[StyleSheet.absoluteFill, { backgroundColor: t.sky }]} /> : null}
          {/* Stuck to the top edge (Yazan 2026-10-17): only the phone's own status bar sits above it, in the same navy. */}
          <View style={{ height: Platform.OS === 'web' ? 0 : ins.top }} />
          <Header variant={game ? 'game' : 'app'} />
        </View>
      ) : (
        <TopInset />
      )}
      <View style={[s.body, { paddingBottom: bottom }]}>
        {dock && glow !== false ? <Calm stops={CALM_DOCK} style={{ bottom: 0, height: CALM_H }} /> : null}
        {/* Android tablets: a page laid out for the width (`wide`) gets the whole screen; any other page keeps its
            phone layout in a centred phone-wide column, at the tablet's reading size, under the full-width header and
            bottom bar (Yazan 2026-11-12, look A). A number is a wider reading column (design px) for list pages
            whose grids and rows follow the width. */}
        {TABLET && wide !== true ? (
          <ColumnW.Provider value={wide ? Math.min(FRAME_W, u(wide)) : COL}>
            <View style={[s.col, wide ? { width: Math.min(FRAME_W, u(wide)) } : null]}>{children}</View>
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
