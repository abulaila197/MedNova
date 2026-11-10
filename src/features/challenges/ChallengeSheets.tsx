import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/AppText';
import { TokenCoin } from '@/components/PulseStar';
import { GAMES } from '@/data/games';
import { PlayerFace } from '@/features/style/Frame';
import { botSeats } from '@/bots/setup';
import { engine } from '@/games/engine';
import type { GameKey } from '@/games/engine/types';
import { sparksCost } from '@/features/sparks/costs';
import { needSparks } from '@/features/sparks/sparks';
import { alwaysFree, startPlay } from '@/games/shell/flow';
import { gameDef } from '@/games/shell/registry';
import { useSession } from '@/games/shell/session';
import { settingsLine } from '@/match/format';
import { useAccount } from '@/state/account';
import { type Friend } from '@/state/friends';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { type Challenge, type ChallengeKind, type ChallengeMode, DAYS, isOver, loadFriendChallenges, markSeen, otherOf, PRIZE, scoreOf, setIntent, timeLeft, useChallenges, withFriend } from './store';

/** Games a challenge can use, with the modes each offers (Solo, Vs rivals). */
const GAME_MODES: { key: GameKey; modes: ChallengeMode[] }[] = GAMES.map((g) => {
  const def = gameDef(g.key);
  const modes: ChallengeMode[] = [];
  if (def?.modes.some((m) => m.mode === 'solo')) modes.push('solo');
  if (def?.bots) modes.push('bots');
  return { key: g.key as GameKey, modes };
}).filter((g) => g.modes.length);
const MODE_NAME: Record<ChallengeMode, string> = { solo: 'Solo', bots: 'Vs rivals' };
const KIND: { k: ChallengeKind; title: string; say: string }[] = [
  { k: 'score', title: 'Beat my score', say: 'You play first. Your score is the bar; they have one day to beat it.' },
  { k: 'game', title: 'Game challenge', say: 'You both play within the time. The best score wins.' },
];
export const gameName = (k: string) => {
  const g = GAMES.find((x) => x.key === k);
  return g ? `${g.lead} ${g.em}` : k;
};
const useSheetMax = (design: number) => Math.min(u(design), useWindowDimensions().height * 0.75 - u(40));

/**
 * The Challenge sheet (G7): the open challenges with this friend (Play, time left, scores so far), then a new one:
 * kind, game, mode and days. "Set up and play" goes to the game's setup with the challenge waiting on Start.
 */
export function ChallengeSheet({ f, onClose }: { f: Friend; onClose: () => void }) {
  const t = useTheme();
  const maxH = useSheetMax(600);
  const uid = useSession((x) => x.userId) ?? '';
  const list = useChallenges((x) => x.list);
  const failed = useChallenges((x) => x.failed);
  const { open } = withFriend(list, f.id);
  const [kind, setKind] = useState<ChallengeKind>('score');
  const [game, setGame] = useState<GameKey>(GAME_MODES[0].key);
  const [mode, setMode] = useState<ChallengeMode>('solo');
  const [days, setDays] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => void loadFriendChallenges(), []);
  const modes = GAME_MODES.find((g) => g.key === game)?.modes ?? ['solo'];
  const pickGame = (k: GameKey) => {
    setGame(k);
    const m = GAME_MODES.find((g) => g.key === k)?.modes ?? ['solo'];
    if (!m.includes(mode)) setMode(m[0]);
  };
  const chip = (label: string, on: boolean, go: () => void, key = label) => (
    <Pressable key={key} onPress={go} style={[s.chip, { borderColor: on ? t.accent : t.panelLine, backgroundColor: on ? `${t.accent}22` : 'transparent' }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[s.chipT, { color: on ? t.accent : t.fg }]}>{label}</Text>
    </Pressable>
  );
  const go = () => {
    setIntent({ friend: { id: f.id, name: f.display_name, avatar: f.avatar }, kind, days: kind === 'score' ? 1 : days, game, mode, at: Date.now() });
    onClose();
    router.push(`/play/${game}/setup?mode=${mode}` as never);
  };
  /** Play for an open challenge: the same game, mode and settings, straight in (rivals dealt fresh in the room). */
  const play = async (c: Challenge) => {
    if (busy) return;
    setBusy(c.id);
    try {
      const def = gameDef(c.game);
      if (!def) return;
      if (await engine.gate.mustSignIn(c.mode, !!uid)) return;
      if (!alwaysFree({ game: c.game, mode: c.mode, settings: c.settings }) && !(await needSparks(sparksCost(c.game, c.mode, c.settings)))) return;
      if (c.mode === 'bots') {
        const b = botSeats(def, c.settings);
        const p = await startPlay(c.game, 'bots', { ...c.settings, ...b.settings }, b.seats);
        onClose();
        router.push(`/play/${c.game}/room?play=${p.id}` as never);
      } else {
        const p = await startPlay(c.game, 'solo', c.settings);
        onClose();
        router.push(`/play/${c.game}/run?play=${p.id}` as never);
      }
    } finally {
      setBusy(null);
    }
  };
  return (
    <ScrollView style={{ maxHeight: maxH }} contentContainerStyle={{ gap: u(10), paddingTop: u(8) }} showsVerticalScrollIndicator={false}>
      <View style={s.head}>
        <PlayerFace slug={f.avatar} size={u(40)} userId={f.id} still />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.h, { color: t.fg }]} numberOfLines={1}>{`Challenge ${f.display_name}`}</Text>
          <Text style={[s.sub, { color: t.mute }]}>{`The winner gets ${PRIZE} tokens when the challenge completes (first win against each friend per day).`}</Text>
        </View>
      </View>
      {open.length ? (
        <>
          <Text style={[s.k, { color: t.kick }]}>RUNNING NOW</Text>
          {open.map((c) => {
            const mine = scoreOf(c, uid);
            const theirs = scoreOf(c, otherOf(c, uid).id);
            const bar = c.kind === 'score';
            const setter = c.from.id === uid;
            const can = !(bar && setter) && !isOver(c);
            return (
              <View key={c.id} style={[s.card, { borderColor: t.panelLine, backgroundColor: t.panel2 }]}>
                <Text style={[s.cardK, { color: t.kick }]}>{`${bar ? 'BEAT MY SCORE' : 'GAME CHALLENGE'} · ${timeLeft(c).toUpperCase()}`}</Text>
                <Text style={[s.cardH, { color: t.fg }]}>{`${gameName(c.game)} · ${MODE_NAME[c.mode]}`}</Text>
                <Text style={[s.cardS, { color: t.mute }]}>{settingsLine(gameDef(c.game), c.settings) || 'Default settings'}</Text>
                <Text style={[s.cardS, { color: t.fg }]}>{`You ${mine ?? '–'} · ${otherOf(c, uid).name} ${theirs ?? '–'}${bar ? (setter ? ' (your bar)' : ' (the bar)') : ''}`}</Text>
                {can ? (
                  <Pressable onPress={() => play(c)} disabled={!!busy} style={s.goWrap} accessibilityRole="button" accessibilityLabel={`Play ${gameName(c.game)} for this challenge`}>
                    <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.go}>
                      <Text style={[s.goT, { color: t.onGrad }]}>{busy === c.id ? 'Opening…' : mine == null ? 'Play' : 'Play again'}</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <Text style={[s.cardS, { color: t.mute }]}>{bar && setter ? `Waiting for ${c.to.name} to play.` : 'Waiting for the result.'}</Text>
                )}
              </View>
            );
          })}
        </>
      ) : null}
      {failed ? <Text style={[s.sub, { color: t.mute }]}>Couldn’t reach the server; showing what was saved.</Text> : null}
      <Text style={[s.k, { color: t.kick }]}>NEW CHALLENGE</Text>
      <View style={s.chips}>{KIND.map((x) => chip(x.title, kind === x.k, () => setKind(x.k)))}</View>
      <Text style={[s.sub, { color: t.mute }]}>{KIND.find((x) => x.k === kind)!.say}</Text>
      <View style={s.chips}>{GAME_MODES.map((g) => chip(gameName(g.key), game === g.key, () => pickGame(g.key), g.key))}</View>
      <View style={s.chips}>
        {modes.map((m) => chip(MODE_NAME[m], mode === m, () => setMode(m)))}
        {kind === 'game' ? DAYS.map((d) => chip(`${d} day${d > 1 ? 's' : ''}`, days === d, () => setDays(d), `d${d}`)) : chip('1 day', true, () => {}, 'd1')}
      </View>
      <Pressable onPress={go} accessibilityRole="button">
        <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
          <Text style={[s.btnT, { color: t.onGrad }]}>Set up and play</Text>
        </LinearGradient>
      </Pressable>
      <Text style={[s.sub, { color: t.mute, textAlign: 'center' }]}>{kind === 'score' ? 'Your score from this play becomes the bar.' : `${f.display_name} gets the challenge as soon as you start.`}</Text>
      <Pressable onPress={onClose} accessibilityRole="button">
        <Text style={[s.cancel, { color: t.mute }]}>Close</Text>
      </Pressable>
    </ScrollView>
  );
}

/**
 * The Result sheet (G7, Yazan 2026-11-10): once a challenge's time is over, the friend's button reads "Result"; this
 * shows who won, both scores and the prize. Seeing it sends the button back to "Challenge".
 */
export function ResultSheet({ f, onClose, onAgain }: { f: Friend; onClose: () => void; onAgain: () => void }) {
  const t = useTheme();
  const uid = useSession((x) => x.userId) ?? '';
  const me = useAccount((a) => a.profile);
  const list = useChallenges((x) => x.list);
  const { result } = withFriend(list, f.id);
  const [shown] = useState(result);
  useEffect(() => {
    if (shown) void markSeen(shown.id);
  }, [shown]);
  const c = shown;
  if (!c) return null;
  const mine = scoreOf(c, uid);
  const theirs = scoreOf(c, f.id);
  const won = c.winner === uid;
  const lost = c.winner === f.id;
  const nobody = mine == null && theirs == null;
  const headline = won ? 'You won' : lost ? `${f.display_name} won` : nobody ? 'Nobody played' : mine == null ? "You didn't play" : theirs == null ? `${f.display_name} didn't play` : 'A tie';
  const line = won
    ? c.prize > 0
      ? `+${c.prize} tokens are waiting in your Inbox.`
      : `No tokens this time: you already won against ${f.display_name} today.`
    : lost
      ? `${f.display_name} takes the tokens.`
      : 'No winner, no tokens.';
  return (
    <View style={{ gap: u(12), paddingTop: u(8) }}>
      <Text style={[s.k, { color: t.kick, textAlign: 'center' }]}>{`${c.kind === 'score' ? 'BEAT MY SCORE' : 'GAME CHALLENGE'} · ${gameName(c.game).toUpperCase()} · ${MODE_NAME[c.mode].toUpperCase()}`}</Text>
      <Text style={[s.big, { color: won ? '#7be0a8' : lost ? t.error : t.fg }]}>{headline}</Text>
      <View style={s.duel}>
        <Side t={t} face={me?.avatar ?? 'yara'} id={uid} name="You" score={mine} lit={won} />
        <Text style={[s.vs, { color: t.mute }]}>vs</Text>
        <Side t={t} face={f.avatar} id={f.id} name={f.display_name} score={theirs} lit={lost} />
      </View>
      <Text style={[s.cardS, { color: t.mute, textAlign: 'center' }]}>{settingsLine(gameDef(c.game), c.settings) || 'Default settings'}</Text>
      <View style={s.prizeRow}>
        {won && c.prize > 0 ? <TokenCoin size={u(14)} progress={0} track="transparent" /> : null}
        <Text style={[s.sub, { color: t.fg }]}>{line}</Text>
      </View>
      <Pressable onPress={onAgain} accessibilityRole="button">
        <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
          <Text style={[s.btnT, { color: t.onGrad }]}>{`Challenge ${f.display_name} again`}</Text>
        </LinearGradient>
      </Pressable>
      <Pressable onPress={onClose} accessibilityRole="button">
        <Text style={[s.cancel, { color: t.mute }]}>Close</Text>
      </Pressable>
    </View>
  );
}

function Side({ t, face, id, name, score, lit }: { t: ReturnType<typeof useTheme>; face: string; id: string; name: string; score: number | null; lit: boolean }) {
  return (
    <View style={[s.side, { borderColor: lit ? t.accent : t.panelLine, backgroundColor: t.panel2 }]}>
      <PlayerFace slug={face || 'yara'} size={u(40)} userId={id} still />
      <Text style={[s.sideN, { color: t.fg }]} numberOfLines={1}>{name}</Text>
      <Text style={[s.sideS, { color: score == null ? t.mute : t.fg }]}>{score == null ? '–' : score}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  h: { fontFamily: F.display, fontSize: u(18), lineHeight: u(22) },
  sub: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13) },
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.4), marginTop: u(4) },
  card: { borderWidth: 1, borderRadius: u(14), padding: u(10), gap: u(3) },
  cardK: { fontFamily: F.mono, fontSize: u(7), letterSpacing: u(1.2) },
  cardH: { fontFamily: F.display, fontSize: u(14), lineHeight: u(18) },
  cardS: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13) },
  goWrap: { alignSelf: 'flex-start', marginTop: u(6) },
  go: { borderRadius: u(12), paddingVertical: u(6), paddingHorizontal: u(16) },
  goT: { fontFamily: F.bodyBold, fontSize: u(10.5) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6) },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: u(6), paddingHorizontal: u(11) },
  chipT: { fontFamily: F.bodySemi, fontSize: u(10) },
  btn: { height: u(34), borderRadius: u(12), alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(11) },
  cancel: { textAlign: 'center', fontFamily: F.bodySemi, fontSize: u(11), paddingTop: u(2) },
  big: { fontFamily: F.display, fontSize: u(26), lineHeight: u(30), textAlign: 'center' },
  duel: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  vs: { fontFamily: F.displayItalic, fontSize: u(13) },
  side: { flex: 1, alignItems: 'center', gap: u(4), borderWidth: 1, borderRadius: u(14), paddingVertical: u(10), paddingHorizontal: u(6) },
  sideN: { fontFamily: F.display, fontSize: u(12), maxWidth: '100%' },
  sideS: { fontFamily: F.display, fontSize: u(22), lineHeight: u(26) },
  prizeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: u(6) },
});
