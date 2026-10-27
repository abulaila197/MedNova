import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { useRoundsDot } from '@/features/rounds/useRounds';

import { chestCount, loadChallenges, useChests } from './useChests';

/**
 * The chest button on the Games page (last of the three; Grand Rounds sits inside its page); the badge counts unopened chests. With none to open, the red
 * Grand Rounds dot shows until this week's missions are done (Yazan 2026-10-26).
 */
export function ChestButton() {
  const t = useTheme();
  const count = useChests((x) => chestCount(x.c));
  const dot = useRoundsDot();
  useFocusEffect(
    useCallback(() => {
      void loadChallenges();
    }, []),
  );
  const line = {
    stroke: t.accent,
    strokeWidth: 2.4,
    fill: 'none',
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  return (
    <Pressable
      onPress={() => router.navigate('/chests' as never)}
      style={[s.btn, { backgroundColor: t.panel, borderColor: t.panelLine }]}
      accessibilityRole='button'
      accessibilityLabel={`Chests, ${count} to open`}
    >
      {/* Same face as the Inbox button: a faint ring at the same size, the chest inside. */}
      <Svg width={u(24)} height={u(24)} viewBox='0 0 30 30'>
        <Circle
          cx={15}
          cy={15}
          r={13}
          fill='none'
          stroke={t.chipLine}
          strokeWidth={1.6}
        />
        <G transform='translate(7.5 7.5) scale(0.625)'>
          <Path
            d='M4 10 C4 6.5 6.5 4.5 12 4.5 C17.5 4.5 20 6.5 20 10 Z'
            {...line}
          />
          <Path
            d='M4 10 H20 V18.5 A1 1 0 0 1 19 19.5 H5 A1 1 0 0 1 4 18.5 Z'
            {...line}
          />
          <Path d='M10.5 9 H13.5 V13 H10.5 Z' {...line} />
        </G>
      </Svg>
      {count > 0 ? (
        <View style={[s.badge, { backgroundColor: t.red, borderColor: t.sky }]}>
          <Text style={s.badgeT}>{count}</Text>
        </View>
      ) : dot ? (
        <View style={[s.dot, { backgroundColor: t.red, borderColor: t.sky }]} />
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: u(16),
    top: u(68), // last of the three (Yazan 2026-10-27); 80% size since 2026-10-19
    width: u(27),
    height: u(27),
    borderRadius: u(13.5),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: u(-3),
    top: u(-3),
    minWidth: u(14),
    height: u(14),
    borderRadius: u(7),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: u(3),
  },
  dot: { position: 'absolute', right: u(-1), top: u(-1), width: u(7), height: u(7), borderRadius: u(3.5), borderWidth: 1 },
  badgeT: { color: '#fff', fontFamily: F.bodyBold, fontSize: u(7.5) },
});
