import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Text } from '@/components/AppText';

import { Back } from '@/components/Back';
import { FeatherArt } from '@/components/FeatherArt';
import { GAMES } from '@/data/games';
import { LOAD } from '@/features/loading/configs';
import { useTheme } from '@/state/app';
import { IS_COLUMN, u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tapped } from '@/lib/sound';
import { restingSay, LOCKED_SAY } from '@/online/api';
import { useOnlineLock } from '@/online/locks';

import type { Mode } from '../engine/types';
import type { GameDef } from './types';
import { useLanding } from './useShellPages';
import { Body, Btn, Card, GameScreen, Ghost, Kick, Title } from './ui';

export const MODE_NAME: Record<Mode, string> = { solo: 'Solo', offline: 'Pass the phone', online: 'Online Multiplayer' };

/** The app-look landing: title, then a card per mode with How to play, over the game's loading art. */
export function ModeLanding({ def }: { def: GameDef }) {
  const t = useTheme();
  const g = GAMES.find((x) => x.key === def.key)!;
  const { open, setOpen, resume, go, resumePlay, resumeLabel, note } = useLanding(def);
  const lock = useOnlineLock(def.key);

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
            opacity={0.34}
            // #12: on a centred column the art also fades at its sides, so no box edge shows beside the page.
            edges={IS_COLUMN ? { bottom: 0.65, left: 0.12, right: 0.12 } : { bottom: 0.65 }}
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
        const online = m.mode === 'online';
        const locked = online ? lock : null;
        return (
          <Card key={m.mode}>
            <View style={s.row}>
              <View style={s.name}>
                <Kick color={t.accent}>{MODE_NAME[m.mode]}</Kick>
                {/* #25 (Yazan 2026-11-02): every Online card says beta. */}
                {online ? (
                  <View style={[s.beta, { borderColor: t.accent }]}>
                    <Text style={[s.betaT, { color: t.accent }]}>BETA</Text>
                  </View>
                ) : null}
                {locked ? <LockIcon color={t.error} /> : null}
              </View>
              {locked ? null : note(m.mode) ? (
                <Kick>{note(m.mode)}</Kick>
              ) : null}
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
            {locked ? (
              <>
                <Body style={{ color: t.soft }}>{locked.why === 'admin' ? LOCKED_SAY : restingSay(locked.day ?? null)}</Body>
                <View style={[s.lock, { backgroundColor: 'rgba(255,122,136,0.1)', borderColor: 'rgba(255,122,136,0.5)' }]} accessibilityRole="button" accessibilityState={{ disabled: true }} accessibilityLabel="Online is locked">
                  <LockIcon color={t.error} size={13} />
                  <Text style={[s.lockT, { color: t.error }]}>Locked</Text>
                </View>
              </>
            ) : (
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

/** A small padlock. */
function LockIcon({ color, size = 11 }: { color: string; size?: number }) {
  return (
    <Svg width={u(size)} height={u(size)} viewBox="0 0 16 16">
      <Path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Rect x={2.5} y={7} width={11} height={8} rx={2} fill={color} />
    </Svg>
  );
}

const s = StyleSheet.create({
  art: { position: 'absolute', left: 0, right: 0, top: 0, height: u(330) },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  beta: { borderWidth: 1, borderRadius: u(6), paddingHorizontal: u(4), paddingVertical: u(1) },
  betaT: { fontFamily: F.bodyBold, fontSize: u(7), lineHeight: u(9), letterSpacing: u(0.8) },
  lock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: u(6), borderWidth: 1, borderRadius: u(14), paddingVertical: u(10), marginTop: u(4) },
  lockT: { fontFamily: F.bodyBold, fontSize: u(12.5), lineHeight: u(15) },
  h: { fontFamily: F.display, fontSize: u(19), lineHeight: u(22) },
  how: { fontFamily: F.bodySemi, fontSize: u(11), lineHeight: u(14) },
  step: { flexDirection: 'row', gap: u(8) },
  num: { fontFamily: F.mono, fontSize: u(10), lineHeight: u(17), width: u(10) },
  btns: { flexDirection: 'row', gap: u(8), marginTop: u(4) },
});
