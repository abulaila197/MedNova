import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { Back } from '@/components/Back';
import { FeatherArt } from '@/components/FeatherArt';
import { GAMES } from '@/data/games';
import { LOAD } from '@/features/loading/configs';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tapped } from '@/lib/sound';

import type { Mode } from '../engine/types';
import type { GameDef } from './types';
import { useLanding } from './useShellPages';
import { Body, Btn, Card, GameScreen, Ghost, Kick, Title } from './ui';

export const MODE_NAME: Record<Mode, string> = { solo: 'Solo', offline: 'Offline Multiplayer', online: 'Online Multiplayer' };

/** The app-look landing: title, then a card per mode with How to play, over the game's loading art. */
export function ModeLanding({ def }: { def: GameDef }) {
  const t = useTheme();
  const g = GAMES.find((x) => x.key === def.key)!;
  const { open, setOpen, resume, go, resumePlay, resumeLabel, note } = useLanding(def);

  const art = LOAD[def.key];
  return (
    <GameScreen
      top={
        // The game's loading-page art as a quiet backdrop behind the title (Yazan 2026-10-14), in its own colours,
        // dissolving into the page with real transparency so no edge can show.
        art ? (
          <FeatherArt
            source={art.photo}
            position={art.fo}
            opacity={t.mode === 'dark' ? 0.34 : 0.2}
            edges={{ bottom: 0.65 }}
            style={s.art}
          />
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
        const isOpen = open === m.mode;
        return (
          <Card key={m.mode}>
            <View style={s.row}>
              <Kick color={t.accent}>{MODE_NAME[m.mode]}</Kick>
              {note(m.mode) ? <Kick>{note(m.mode)}</Kick> : null}
            </View>
            <Text style={[s.h, { color: t.white }]}>{m.title}</Text>
            <Body>{m.blurb}</Body>
            <Pressable onPress={tapped(() => setOpen(isOpen ? null : m.mode))} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
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
            <View style={s.btns}>
                {bm ? <Btn label={resumeLabel(bm)} onPress={() => resumePlay(bm)} style={{ flex: 1 }} /> : null}
                {bm ? <Ghost label="New game" onPress={() => go(m.mode)} style={{ flex: 1 }} /> : <Btn label="Play" onPress={() => go(m.mode)} style={{ flex: 1 }} />}
              </View>
          </Card>
        );
      })}
    </GameScreen>
  );
}

const s = StyleSheet.create({
  art: { position: 'absolute', left: 0, right: 0, top: 0, height: u(330) },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h: { fontFamily: F.display, fontSize: u(19), lineHeight: u(22) },
  how: { fontFamily: F.bodySemi, fontSize: u(11), lineHeight: u(14) },
  step: { flexDirection: 'row', gap: u(8) },
  num: { fontFamily: F.mono, fontSize: u(10), lineHeight: u(17), width: u(10) },
  btns: { flexDirection: 'row', gap: u(8), marginTop: u(4) },
});
