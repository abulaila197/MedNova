import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { type Game, GAMES } from '@/data/games';
import { useLoading } from '@/features/loading/store';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { W } from './fit';
import { GameArt } from './GameArt';
import { wrapOff } from './Planet';

const DESC = { dark: '#c9cde8', light: '#5f5a50' };

/** One game: the drawing in the lower right and the text block top left. Slides with the swipe. */
export function GamePage({ game, j, pos, active }: { game: Game; j: number; pos: SharedValue<number>; active: boolean }) {
  const t = useTheme();
  const play = useRef<View>(null);
  // Play opens the game's loading page; the doors split the page at the button's middle.
  const onPlay = () => {
    const btn = play.current;
    if (!btn) return useLoading.getState().start(game.key, 0, j);
    btn.measureInWindow((_x, y, _w, h) => useLoading.getState().start(game.key, y + h / 2, j));
  };
  const slide = useAnimatedStyle(() => {
    const off = wrapOff(j - pos.value);
    return { transform: [{ translateX: off * u(W) }], opacity: Math.abs(off) > 1.5 ? 0 : 1 };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, slide]} pointerEvents={active ? 'box-none' : 'none'} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
      <GameArt k={game.key} mode={t.mode} />
      <View style={s.info}>
        <Text style={[s.kick, { color: t.soft }]}>{`${String(j + 1).padStart(2, '0')} / ${String(GAMES.length).padStart(2, '0')}`}</Text>
        <Text style={[s.ttl, { color: t.white }]}>
          {game.lead} <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{game.em}</Text>
        </Text>
        <Text style={[s.sub, { color: t.soft }]}>{game.sub}</Text>
        <Text style={[s.desc, { color: DESC[t.mode] }]}>{game.desc}</Text>
        <Pressable ref={play} onPress={onPlay} style={s.goWrap} accessibilityRole="button" accessibilityLabel={`Play ${game.lead} ${game.em}`}>
          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.go}>
            <Text style={[s.goT, { color: t.onGrad }]}>Play</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  info: { position: 'absolute', left: u(16), right: u(16), top: u(40) },
  kick: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12), letterSpacing: u(1.7), textTransform: 'uppercase' },
  ttl: { marginTop: u(7), fontFamily: F.display, fontSize: u(32), lineHeight: u(28.8), letterSpacing: u(-0.64) },
  sub: { marginTop: u(8), fontFamily: F.displayItalic, fontSize: u(13), lineHeight: u(17) },
  desc: { marginTop: u(7), marginBottom: u(2), maxWidth: u(190), fontFamily: F.body, fontSize: u(11), lineHeight: u(15.95) },
  goWrap: { marginTop: u(7), alignSelf: 'flex-start' },
  go: { borderRadius: u(14), paddingVertical: u(9), paddingHorizontal: u(18) },
  goT: { fontFamily: F.bodyBold, fontSize: u(12), lineHeight: u(15), textAlign: 'center' },
});
