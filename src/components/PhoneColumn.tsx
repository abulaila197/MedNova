import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Fade } from '@/components/Fade';
import { BAKED } from '@/features/start/baked';
import { NAVY, Stars } from '@/features/start/Sky';
import { ColumnW, DESIGN_W, PAGE_W, TABLET, u, useScreen } from '@/theme/scale';

const COL = u(DESIGN_W);

/**
 * The start pages (onboarding, sign-in) on an Android tablet (2026-11-12): their phone design in a centred column at
 * the tablet's reading size, over the start sky across the whole screen. On phones it is just the page.
 */
export function PhoneColumn({ children, soft }: { children: ReactNode; soft?: boolean }) {
  const { height } = useScreen();
  if (!TABLET) return <>{children}</>;
  return (
    <View style={[s.root, { backgroundColor: NAVY }]}>
      <Image source={BAKED.sky} contentFit="cover" transition={0} accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
      <Stars si={0} hd={height / u(1)} wd={PAGE_W} whole />
      <ColumnW.Provider value={COL}>
        {/* `soft`: pages whose pictures fill the column (the onboarding slides) melt into the sky at both sides */}
        {soft ? (
          <Fade horizontal stops={[[0, 0], [0.07, 1], [0.93, 1], [1, 0]]} style={s.col}>
            {children}
          </Fade>
        ) : (
          <View style={s.col}>{children}</View>
        )}
      </ColumnW.Provider>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  col: { flex: 1, width: COL },
});
