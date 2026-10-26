import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { TokenCoin } from '@/components/PulseStar';
import type { Play } from '@/games/engine/types';
import { useAccount } from '@/state/account';
import { useTheme } from '@/state/app';
import { useBalanceStore } from '@/state/balance';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { LevelRing } from './LevelRing';

/**
 * The Results level counter (#51): your face in the level ring, as in the header, and the EXP bar filling with
 * this play's EXP. A level up shows the new level and its tokens.
 */
export function LevelCounter({ play }: { play: Play }) {
  const t = useTheme();
  const slug = useAccount((a) => a.profile?.avatar) ?? play.seats[0]?.character ?? 'yara';
  const { level, into, need } = useBalanceStore();
  const up = play.levelUp;
  const after = need ? into / need : 0;
  const before = up ? 0 : Math.max(0, into - play.expEarned) / (need || 1);
  const fill = useSharedValue(before);
  useEffect(() => {
    fill.value = before;
    fill.value = withDelay(450, withTiming(after, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [before, after, fill]);
  const bar = useAnimatedStyle(() => ({ width: `${Math.min(1, fill.value) * 100}%` }));
  return (
    <View style={s.row}>
      <LevelRing size={u(46)} level={level} progress={after} slug={slug} />
      <View style={{ flex: 1, gap: u(5) }}>
        <View style={s.top}>
          <Text style={[s.lv, { color: t.white }]}>
            {'Level '}
            <Text style={[s.lv, { color: t.accent, fontFamily: F.displayItalic }]}>{level}</Text>
          </Text>
          <Text style={[s.n, { color: t.mute }]}>{`${into} / ${need} EXP`}</Text>
        </View>
        <View style={[s.track, { backgroundColor: t.chip }]}>
          <Animated.View style={[s.fillBox, bar]}>
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
        {up ? (
          <View style={s.up}>
            <Text style={[s.upT, { color: t.accent }]}>{`Level up! +${up.tokens}`}</Text>
            <TokenCoin size={u(11)} progress={0} track="transparent" />
          </View>
        ) : (
          <Text style={[s.n, { color: t.mute }]}>{`${need - into} EXP to level ${level + 1}`}</Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: u(12), marginTop: u(10), paddingTop: u(10), borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  lv: { fontFamily: F.display, fontSize: u(16) },
  n: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(0.5) },
  track: { height: u(6), borderRadius: 99, overflow: 'hidden' },
  fillBox: { height: '100%', borderRadius: 99, overflow: 'hidden' },
  up: { flexDirection: 'row', alignItems: 'center', gap: u(4) },
  upT: { fontFamily: F.bodyBold, fontSize: u(11) },
});
