import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Dock, type Tab } from '@/components/Dock';
import { Glow } from '@/components/Glow';
import { Grain } from '@/components/Grain';
import { Header } from '@/components/Header';
import { TopInset } from '@/components/StatusMock';
import { useTheme } from '@/state/app';

/** A page of the app: sky, drifting glow, grain, header, content, docked nav. */
export function Screen({ children, tab = null, glow = 0, header = true, dock = true, under }: { children: ReactNode; tab?: Tab; glow?: number; header?: boolean; dock?: boolean; under?: ReactNode }) {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  return (
    <View style={[s.root, { backgroundColor: t.sky }]}>
      <Glow delay={glow} w={width} h={height} />
      <Grain />
      {under}
      <TopInset color={t.fg} />
      {header ? <Header /> : null}
      <View style={s.body}>{children}</View>
      {dock ? <Dock active={tab} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  body: { flex: 1, zIndex: 1 },
});
