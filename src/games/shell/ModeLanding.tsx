import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Back } from '@/features/learn/Back';
import { GAME_PHOTOS, GAMES } from '@/data/games';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { Mode } from '../engine/types';
import type { GameDef } from './types';
import { useLanding } from './useShellPages';
import { Body, Btn, Card, GameScreen, Ghost, Kick, Title } from './ui';

export const MODE_NAME: Record<Mode, string> = { solo: 'Solo', offline: 'Offline Multiplayer', online: 'Online Multiplayer' };

/** Structural landing: title, then a card per mode with How to play. Each game's own artwork comes later. */
export function ModeLanding({ def }: { def: GameDef }) {
  const t = useTheme();
  const g = GAMES.find((x) => x.key === def.key)!;
  const { open, setOpen, resume, left, go, resumePlay, resumeLabel } = useLanding(def);

  const photo = GAME_PHOTOS[t.mode][def.key as keyof (typeof GAME_PHOTOS)['dark']];
  return (
    <GameScreen
      top={
        // Stand-in art: the game photo, faded and feathered. Each game's own landing art replaces it later.
        // Dark only: on the light sky its feathered edges showed as a colour crack.
        t.mode === 'dark' ? (
          <View style={s.art} pointerEvents="none">
            <Image source={photo} style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} resizeMode="cover" />
            <LinearGradient colors={[t.sky, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 0.7, y: 0.5 }} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['transparent', t.sky]} start={{ x: 0.5, y: 0.35 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
          </View>
        ) : undefined
      }>
      <Back label="Games" fallback="/games" />
      <View style={{ gap: u(6), marginBottom: u(4) }}>
        <Kick>Choose how to play</Kick>
        <Title lead={g.lead} em={g.em} />
        <Body>{g.desc}</Body>
      </View>
      {def.modes.map((m) => {
        const bm = resume[m.mode];
        const l = left[m.mode];
        const isOpen = open === m.mode;
        return (
          <Card key={m.mode} style={m.soon ? { opacity: 0.55 } : undefined}>
            <View style={s.row}>
              <Kick color={t.accent}>{MODE_NAME[m.mode]}</Kick>
              {m.soon ? <Kick>Coming soon</Kick> : l === undefined || l === null ? null : <Kick>{m.mode === 'online' ? 'Sign in to play' : `${l} of 3 free plays left`}</Kick>}
            </View>
            <Text style={[s.h, { color: t.white }]}>{m.title}</Text>
            <Body>{m.blurb}</Body>
            <Pressable onPress={() => setOpen(isOpen ? null : m.mode)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
              <Text style={[s.how, { color: t.accent }]}>{isOpen ? 'Hide how to play' : 'How to play'}</Text>
            </Pressable>
            {isOpen
              ? m.howTo.map((step, i) => (
                  <View key={i} style={s.step}>
                    <Text style={[s.num, { color: t.dim }]}>{i + 1}</Text>
                    <Body style={{ flex: 1 }}>{step}</Body>
                  </View>
                ))
              : null}
            {m.soon ? null : (
              <View style={s.btns}>
                {bm ? <Btn label={resumeLabel(bm)} onPress={() => resumePlay(bm)} style={{ flex: 1 }} /> : null}
                {bm ? <Ghost label="New game" onPress={() => go(m.mode)} style={{ flex: 1 }} /> : <Btn label="Play" onPress={() => go(m.mode)} style={{ flex: 1 }} />}
              </View>
            )}
          </Card>
        );
      })}
    </GameScreen>
  );
}

const s = StyleSheet.create({
  art: { position: 'absolute', right: u(-30), top: u(0), width: u(230), height: u(200) },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h: { fontFamily: F.display, fontSize: u(19), lineHeight: u(22) },
  how: { fontFamily: F.bodySemi, fontSize: u(11), lineHeight: u(14) },
  step: { flexDirection: 'row', gap: u(8) },
  num: { fontFamily: F.mono, fontSize: u(10), lineHeight: u(17), width: u(10) },
  btns: { flexDirection: 'row', gap: u(8), marginTop: u(4) },
});
