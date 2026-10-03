import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GAMES } from '@/data/games';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { Play, PlayItem } from '../engine/types';
import { startPlay } from './flow';
import type { GameDef } from './types';
import { Body, Btn, Card, GameScreen, Ghost, Kick, Title } from './ui';

const MARK: Record<PlayItem['outcome'], string> = { right: '✓', wrong: '✕', skipped: '–', timed_out: '⏱' };

/** Shared results: score, EXP, each item, standings when several players. Rule 14: Rematch and Change settings. */
export function Results({ def, play, items }: { def: GameDef; play: Play; items: PlayItem[] }) {
  const t = useTheme();
  const g = GAMES.find((x) => x.key === def.key)!;
  const rematch = async () => {
    const next = await startPlay(def.key, play.mode, play.settings, play.seats.filter((x) => !x.removed));
    router.replace(`/play/${def.key}/run?play=${next.id}`);
  };
  // One phone: the top numbers are the phone owner's (seat 0); every player's cases are listed by name.
  const multi = play.seats.length > 1;
  const mine = multi ? items.filter((i) => i.seat === 0) : items;
  const right = mine.filter((i) => i.outcome === 'right').length;
  const nameOf = new Map(play.seats.map((x) => [x.seat, x.name]));
  const colorOf = new Map(play.seats.map((x) => [x.seat, x.color]));
  return (
    <GameScreen>
      <View style={{ gap: u(6) }}>
        <Kick>{`${g.lead} ${g.em}`}</Kick>
        <Title lead="Game" em="over" />
      </View>
      <Card style={s.top}>
        <View style={s.stat}>
          <Text style={[s.big, { color: t.white }]}>{play.score}</Text>
          <Kick>{multi ? 'Your points' : 'Points'}</Kick>
        </View>
        <View style={s.stat}>
          <Text style={[s.big, { color: t.accent }]}>{`+${play.expEarned}`}</Text>
          <Kick>EXP</Kick>
        </View>
        <View style={s.stat}>
          <Text style={[s.big, { color: t.white }]}>{`${right}/${mine.length}`}</Text>
          <Kick>Solved</Kick>
        </View>
      </Card>
      {play.standings.length > 1 ? (
        <Card>
          <Kick>Standings</Kick>
          {play.standings.map((r) => (
            <View key={r.seat} style={s.row}>
              <Text style={[s.rank, { color: t.dim }]}>{r.rank}</Text>
              {colorOf.get(r.seat) ? <View style={[s.dot, { backgroundColor: colorOf.get(r.seat) }]} /> : null}
              <Text style={[s.item, { color: t.fg }]}>{r.name}</Text>
              <Text style={[s.pts, { color: t.soft }]}>{r.score}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      <Card>
        <Kick>Cases</Kick>
        {items.map((i) => (
          <View key={i.id} style={s.row}>
            <Text style={[s.mark, { color: i.outcome === 'right' ? t.accent : t.rose }]}>{MARK[i.outcome]}</Text>
            <Text style={[s.item, { color: t.fg }]} numberOfLines={1}>
              {multi ? `${nameOf.get(i.seat) ?? ''} · ` : ''}
              {def.itemLabel?.(i) ?? i.itemId}
            </Text>
            <Text style={[s.pts, { color: t.soft }]}>{i.points}</Text>
          </View>
        ))}
        {items.some((i) => i.feedsLearn && i.outcome !== 'right') ? <Body>{multi ? 'Your missed cases are waiting in Today\'s review.' : 'Missed cases are waiting in Today\'s review.'}</Body> : null}
      </Card>
      <View style={{ flexDirection: 'row', gap: u(8) }}>
        <Btn label="Rematch" onPress={rematch} style={{ flex: 1 }} />
        <Ghost label="Change settings" onPress={() => router.replace(`/play/${def.key}/setup?mode=${play.mode}&from=${play.id}`)} style={{ flex: 1 }} />
      </View>
      <Ghost label="Back to games" onPress={() => router.replace('/games')} />
    </GameScreen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: u(2) },
  big: { fontFamily: F.display, fontSize: u(26), lineHeight: u(30) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  dot: { width: u(8), height: u(8), borderRadius: u(4) },
  rank: { fontFamily: F.mono, fontSize: u(10), width: u(12) },
  mark: { fontFamily: F.bodyBold, fontSize: u(12), width: u(12) },
  item: { flex: 1, fontFamily: F.body, fontSize: u(11.5) },
  pts: { fontFamily: F.mono, fontSize: u(10.5) },
});
