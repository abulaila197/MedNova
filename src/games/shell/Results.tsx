import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GAMES } from '@/data/games';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { levelUpLine } from '../engine/levels';
import type { Play, PlayItem } from '../engine/types';
import { RoomTalk } from '@/online/Talk';

import { Face } from './Face';
import { useSession } from './session';
import type { GameDef } from './types';
import { useResults } from './useShellPages';
import { Body, Btn, Card, GameScreen, Ghost, Kick, Title } from './ui';

const MARK: Record<PlayItem['outcome'], string> = { right: '✓', wrong: '✕', skipped: '–', timed_out: '⏱' };

/** Shared results: score, EXP, each item, standings when several players. Rule 14: Rematch and Change settings. */
export function Results({ def, play, items }: { def: GameDef; play: Play; items: PlayItem[] }) {
  const t = useTheme();
  const g = GAMES.find((x) => x.key === def.key)!;
  const { multi, nameOf, colorOf, teamRows, plain, stats, missed, rematch, changeSettings, backToGames, openDossier } = useResults(def, play, items);
  const lvl = levelUpLine(play.levelUp);
  const faceOf = new Map(play.seats.map((x) => [x.seat, x.character]));
  // ON22: online results keep the floating talk button.
  const uid = useSession((x) => x.userId);
  const room = play.mode === 'online' ? (play.settings.room as string | undefined) : undefined;
  return (
    <GameScreen top={room && uid ? <RoomTalk room={room} me={{ id: uid, name: 'You', face: play.seats[0]?.character ?? 'yara' }} /> : undefined}>
      <View style={{ gap: u(6) }}>
        <Kick>{`${g.lead} ${g.em}`}</Kick>
        <Title lead="Game" em="over" />
      </View>
      <Card style={s.top}>
        {stats.map((x) => (
          <View key={x.label} style={s.stat}>
            <Text style={[s.big, { color: t.white }]}>{x.value}</Text>
            <Kick>{x.label}</Kick>
          </View>
        )).flatMap((el, i) => (i === 0 ? [el, <ExpStat key="exp" exp={play.expEarned} />] : [el]))}
        {lvl ? <Text style={[s.lvl, { color: t.accent }]}>{lvl}</Text> : null}
      </Card>
      {teamRows ? (
        <Card>
          <Kick>Teams</Kick>
          {teamRows.map((r) => (
            <View key={r.id} style={s.row}>
              <Text style={[s.rank, { color: t.dim }]}>{r.rank}</Text>
              <View style={[s.dot, { backgroundColor: r.color }]} />
              <Text style={[s.item, { color: r.rank === 1 ? r.color : t.fg }]}>{r.name}</Text>
              <Text style={[s.pts, { color: t.soft }]}>{r.score}</Text>
            </View>
          ))}
          <Body>{def.teamScore === 'sum' ? 'A team scores every word its players won.' : 'A team scores its players\' average.'}</Body>
        </Card>
      ) : null}
      {play.standings.length > 1 ? (
        <Card>
          <Kick>{teamRows ? 'Players' : 'Standings'}</Kick>
          {play.standings.map((r) => (
            <View key={r.seat} style={s.row}>
              <Text style={[s.rank, { color: t.dim }]}>{r.rank}</Text>
              {/* ON21: online standings show each player's face. */}
              {play.mode === 'online' && faceOf.get(r.seat) ? (
                <Face slug={faceOf.get(r.seat)!} size={u(18)} />
              ) : colorOf.get(r.seat) ? (
                <View style={[s.dot, { backgroundColor: colorOf.get(r.seat) }]} />
              ) : null}
              <Text style={[s.item, { color: t.fg }]}>{r.name}</Text>
              <Text style={[s.pts, { color: t.soft }]}>{r.score}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      <Card>
        <Kick>{def.itemsTitle ?? 'Cases'}</Kick>
        {items.map((i) => (
          <View key={i.id} style={s.row}>
            {plain ? null : <Text style={[s.mark, { color: i.outcome === 'right' ? t.accent : t.rose }]}>{MARK[i.outcome]}</Text>}
            <Text style={[s.item, { color: t.fg }]} numberOfLines={1}>
              {multi ? `${nameOf.get(i.seat) ?? 'Nobody'} · ` : ''}
              {def.itemLabel?.(i) ?? i.itemId}
            </Text>
            {/* RS1: dossier links only here, once the game has ended. */}
            {i.answerKey ? (
              <Pressable onPress={() => openDossier(i.answerKey!)} hitSlop={u(6)} accessibilityRole="link" accessibilityLabel={`Open the dossier for ${def.itemLabel?.(i) ?? i.itemId}`}>
                <Text style={[s.link, { color: t.accent }]}>Dossier ›</Text>
              </Pressable>
            ) : null}
            {plain ? null : <Text style={[s.pts, { color: t.soft }]}>{i.points}</Text>}
          </View>
        ))}
        {missed ? <Body>{multi ? 'Your missed cases are waiting in Today\'s review.' : 'Missed cases are waiting in Today\'s review.'}</Body> : null}
      </Card>
      <View style={{ flexDirection: 'row', gap: u(8) }}>
        <Btn label="Rematch" onPress={rematch} style={{ flex: 1 }} />
        <Ghost label="Change settings" onPress={changeSettings} style={{ flex: 1 }} />
      </View>
      <Ghost label="Back to games" onPress={backToGames} />
    </GameScreen>
  );
}

function ExpStat({ exp }: { exp: number }) {
  const t = useTheme();
  return (
    <View style={s.stat}>
      <Text style={[s.big, { color: t.accent }]}>{`+${exp}`}</Text>
      <Kick>EXP</Kick>
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
  lvl: { width: '100%', textAlign: 'center', marginTop: u(4), fontFamily: F.display, fontStyle: 'italic', fontSize: u(14) },
  stat: { alignItems: 'center', gap: u(2) },
  big: { fontFamily: F.display, fontSize: u(26), lineHeight: u(30) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  dot: { width: u(8), height: u(8), borderRadius: u(4) },
  rank: { fontFamily: F.mono, fontSize: u(10), width: u(12) },
  mark: { fontFamily: F.bodyBold, fontSize: u(12), width: u(12) },
  item: { flex: 1, fontFamily: F.body, fontSize: u(11.5) },
  pts: { fontFamily: F.mono, fontSize: u(10.5) },
  link: { fontFamily: F.bodySemi, fontSize: u(10) },
});
