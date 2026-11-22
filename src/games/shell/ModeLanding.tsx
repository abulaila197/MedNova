import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { Back } from '@/components/Back';
import { FeatherArt } from '@/components/FeatherArt';
import { GAMES } from '@/data/games';
import { GAME_MODES } from '@/features/challenges/ChallengeSheets';
import { navTo } from '@/lib/nav';
import { LOAD } from '@/features/loading/configs';
import { useTheme } from '@/state/app';
import { IS_COLUMN, u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tapped } from '@/lib/sound';

import type { Mode } from '../engine/types';
import type { GameDef } from './types';
import { useLanding } from './useShellPages';
import { Body, Btn, Card, GameScreen, Ghost, Kick, Title } from './ui';
import { tr } from '@/i18n';

export const MODE_NAME: Record<Mode, string> = { solo: tr('Solo'), offline: tr('Pass the phone'), bots: tr('Vs rivals'), online: tr('Online Multiplayer') };

/** The app-look landing: title, then a card per mode with How to play, over the game's loading art. */
export function ModeLanding({ def }: { def: GameDef }) {
  const t = useTheme();
  const g = GAMES.find((x) => x.key === def.key)!;
  const { open, setOpen, resume, go, resumePlay, resumeLabel, note } = useLanding(def);

  const art = LOAD[def.key];
  const challenge = GAME_MODES.some((x) => x.key === def.key);
  return (
    <GameScreen
      top={
        // The game's loading-page art as a quiet backdrop behind the title (Yazan 2026-10-14), in its own colours,
        // dissolving into the page with real transparency so no edge can show.
        <>
          {art ? (
          <FeatherArt
            source={art.photo}
            position={art.fo}
            opacity={0.34}
            // #12: on a centred column the art also fades at its sides, so no box edge shows beside the page.
            edges={IS_COLUMN ? { bottom: 0.2, left: 0.12, right: 0.12 } : { bottom: 0.2 }}
            style={s.art}
          />
        ) : null}
        </>
      }>
      <Back label={tr('Games')} fallback="/games" exact />
      <View style={{ gap: u(6), marginBottom: u(4) }}>
        <Kick>{tr('Choose how to play')}</Kick>
        <Title lead={g.lead} em={g.em} />
        <Body>{g.desc}</Body>
      </View>
        <>
          {def.modes.map((m) => {
            const bm = resume[m.mode];
            const isOpen = open === m.mode;
            return (
              <Card key={m.mode} style={[s.slim, { borderColor: MODE_COLOR[m.mode] }]}>
                <View style={s.line}>
                  <View style={{ flex: 1, gap: u(3) }}>
                    <View style={s.row}>
                      <Kick color={MODE_COLOR[m.mode]}>{MODE_NAME[m.mode]}</Kick>
                      {note(m.mode) ? (
                        <View style={[s.free, { borderColor: t.panelLine }]}>
                          <Text style={[s.freeT, { color: t.mute }]} numberOfLines={1}>{note(m.mode)}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[s.hS, { color: t.white }]} numberOfLines={2}>{m.title}</Text>
                    <Pressable onPress={tapped(() => setOpen(isOpen ? null : m.mode))} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
                      <Text style={[s.how, { color: t.accent }]}>{isOpen ? tr('Hide how to play') : tr('How to play')}</Text>
                    </Pressable>
                  </View>
                  <View style={s.side}>
                    {bm ? <Btn label={resumeLabel(bm)} onPress={() => resumePlay(bm)} /> : null}
                    {bm ? <Ghost label={tr('New game')} onPress={() => go(m.mode)} /> : <Btn label={tr('Play')} onPress={() => go(m.mode)} />}
                  </View>
                </View>
                {isOpen ? <HowTo m={m} /> : null}
              </Card>
            );
          })}
          {challenge ? (
            <Card style={[s.slim, { borderColor: CHALLENGE_COLOR }]}>
              <View style={s.line}>
                <View style={{ flex: 1, gap: u(3) }}>
                  <Kick color={CHALLENGE_COLOR}>{tr('Challenge')}</Kick>
                  <Text style={[s.hS, { color: t.white }]} numberOfLines={2}>{tr('Challenge a friend')}</Text>
                </View>
                <View style={s.side}>
                  <Btn label={tr('Friends page')} onPress={() => navTo('/friends')} />
                </View>
              </View>
            </Card>
          ) : null}
        </>
    </GameScreen>
  );
}

/** Each way to play has its own colour on every game's mode page: the card's border and its label (Yazan 2026-11-22). */
export const MODE_COLOR: Record<Mode, string> = { solo: '#22d3ee', offline: '#fbbf24', bots: '#fb7185', online: '#a78bfa' };
export const CHALLENGE_COLOR = '#4ade80';

/** A mode's blurb and steps, shown when How to play is open. */
function HowTo({ m }: { m: GameDef['modes'][number] }) {
  const t = useTheme();
  const body = (
    <>
      <Body>{m.blurb}</Body>
      {m.howTo.map((step, i) => (
        <View key={i} style={s.step}>
          <Text style={[s.num, { color: t.dim }]}>{i + 1}</Text>
          <Body style={{ flex: 1 }}>{step}</Body>
        </View>
      ))}
    </>
  );
  return <View style={{ gap: u(6), marginTop: u(8) }}>{body}</View>;
}

const s = StyleSheet.create({
  slim: { paddingVertical: u(11), paddingHorizontal: u(13), gap: 0, borderWidth: 1.5 },
  line: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  side: { minWidth: u(84), gap: u(6) },
  hS: { fontFamily: F.display, fontSize: u(15), lineHeight: u(19) },
  // The art fills the whole page behind the cards (Yazan 2026-11-22), fading only at the very bottom.
  art: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: u(10) },
  free: { borderWidth: 1, borderRadius: 999, paddingVertical: u(2), paddingHorizontal: u(8), flexShrink: 0 },
  freeT: { fontFamily: F.bodySemi, fontSize: u(9) },
  how: { fontFamily: F.bodySemi, fontSize: u(11), lineHeight: u(14) },
  step: { flexDirection: 'row', gap: u(8) },
  num: { fontFamily: F.mono, fontSize: u(10), lineHeight: u(17), width: u(10) },
  btns: { flexDirection: 'row', gap: u(8), marginTop: u(4) },
});
