// The Conqueror's own landing page (Yazan 2026-10-14): the same texts as the shared landing, drawn in the Ink Atlas
// look over the game's loading-page art, like Trust Me Not, Wheels and Case Files.
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FeatherArt } from '@/components/FeatherArt';
import { GAMES } from '@/data/games';
import { LOAD } from '@/features/loading/configs';

import { MODE_NAME } from '../shell/ModeLanding';
import type { GameDef, OwnScreens } from '../shell/types';
import { useLanding } from '../shell/useShellPages';
import { AT, AtlasScreen, Btn, CG, CGI, CZ, Kicker, Room, T, v } from './atlas';

function Backdrop({ def }: { def: GameDef }) {
  const art = LOAD[def.key];
  return (
    <>
      <Room />
      {art ? <FeatherArt source={art.photo} position={art.fo} opacity={0.6} edges={{ bottom: 0.55 }} style={s.art} /> : null}
    </>
  );
}

function BackLink() {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/games'))} accessibilityRole="link" hitSlop={v(8)} style={{ alignSelf: 'flex-start', paddingHorizontal: v(4) }}>
      <T f={CGI} size={16} color={AT.soft}>‹ Games</T>
    </Pressable>
  );
}

function Landing({ def }: { def: GameDef }) {
  const g = GAMES.find((x) => x.key === def.key)!;
  const { open, setOpen, resume, go, resumePlay, resumeLabel, note } = useLanding(def);
  return (
    <AtlasScreen scroll under={<Backdrop def={def} />}>
      <BackLink />
      <View style={{ gap: v(3), paddingHorizontal: v(4), marginBottom: v(4) }}>
        <Kicker>Choose how to play</Kicker>
        <T f={CZ} size={30} color={AT.gold} style={{ lineHeight: v(35) }}>{`${g.lead} ${g.em}`}</T>
        <T f={CGI} size={17} style={{ lineHeight: v(21) }}>{g.sub}</T>
        <T size={15} color={AT.soft} style={{ marginTop: v(4), lineHeight: v(19) }}>{g.desc}</T>
      </View>
      {def.modes.map((m) => {
        const bm = resume[m.mode];
        const isOpen = open === m.mode;
        return (
          <View key={m.mode} style={s.sheet}>
            <View style={s.rule} pointerEvents="none" />
            <View style={s.row}>
              <Kicker color={AT.red}>{MODE_NAME[m.mode]}</Kicker>
              {note(m.mode) ? <Kicker color={AT.inkSoft}>{note(m.mode)}</Kicker> : null}
            </View>
            <T f={CZ} size={20} color={AT.ink} style={{ lineHeight: v(25) }}>{m.title}</T>
            <T size={15} color={AT.inkSoft} style={{ lineHeight: v(19) }}>{m.blurb}</T>
            <Pressable onPress={() => setOpen(isOpen ? null : m.mode)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} style={{ alignSelf: 'flex-start' }}>
              <T f={CGI} size={15} color={AT.red} style={{ textDecorationLine: 'underline' }}>{isOpen ? 'Hide how to play' : 'How to play'}</T>
            </Pressable>
            {isOpen
              ? m.howTo.map((step, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: v(8) }}>
                    <T f={CZ} size={13} color={AT.red} style={{ minWidth: v(12) }}>{String(i + 1)}</T>
                    <T f={CG} size={14.5} color={AT.ink} style={{ flex: 1, lineHeight: v(18) }}>{step}</T>
                  </View>
                ))
              : null}
            <View style={{ flexDirection: 'row', gap: v(8), marginTop: v(4) }}>
              {bm ? <Btn label={resumeLabel(bm)} onPress={() => resumePlay(bm)} /> : null}
              <Btn label={bm ? 'New game' : 'Play'} ghost={!!bm} onPress={() => go(m.mode)} />
            </View>
          </View>
        );
      })}
    </AtlasScreen>
  );
}

export const conquerorScreens: OwnScreens = { Landing };

const s = StyleSheet.create({
  art: { position: 'absolute', left: 0, right: 0, top: 0, height: '62%' },
  sheet: {
    backgroundColor: AT.paper,
    borderRadius: v(6),
    borderWidth: 1,
    borderColor: '#5a3a1e',
    padding: v(16),
    gap: v(7),
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: v(10),
    shadowOffset: { width: 0, height: v(4) },
    elevation: 4,
  },
  rule: { position: 'absolute', left: v(5), right: v(5), top: v(5), bottom: v(5), borderWidth: 1, borderColor: 'rgba(142,28,28,0.4)', borderRadius: v(4) },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
