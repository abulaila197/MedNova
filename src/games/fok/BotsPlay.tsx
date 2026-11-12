import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { YOU } from '@/bots/race/engine';
import { useBotRace } from '@/bots/race/useBotRace';
import { PlayerFace } from '@/features/style/Frame';
import { settingsLine } from '@/match/format';
import { AlertPill, Countdown, nth } from '@/match/live';
import type { RacePlayer, RaceState } from '@/match/race';
import { RaceReveal } from '@/match/RaceReveal';
import { RoomTalk } from '@/match/TalkBar';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { engine } from '../engine';
import { clock } from '../engine/clock';
import { playerColour } from '../shell/characters';
import { PauseMenu } from '../shell/PauseMenu';
import { gameDef } from '../shell/registry';
import { presetTeam } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { GameScreen } from '../shell/ui';
import { BoardView } from './BoardView';
import { FOK, type Board } from './core';
import { dealBoards } from './deal';
import { boardItems } from './items';
import { FokRace } from './rivals';
import { BoardEnd } from './SoloPlay';
import { C, FokSky, Hearts, TokenCard, TopLine } from './Table';

/**
 * Four of a Kind vs rivals: everyone plays the same boards at the same time, each on their own copy. You see how many
 * groups each rival has found and their hearts, never which. Your board's groups are recorded (misses go to Learn).
 */
export function BotsPlay({ play, onFinish, onQuit }: PlayProps) {
  const limitMs = (Number(play.settings.clock) || 0) * 60_000;
  const boards = useRef<Board[]>([]);
  const g = useBotRace<FokRace>({
    play,
    onFinish,
    onQuit,
    build: (ctx) => new FokRace({ ...ctx, boards: boards.current, limitMs }),
    pick: async () => {
      boards.current = await dealBoards(play);
      return boards.current.map((_, i) => i + 1);
    },
    toItems: (st: RaceState, race: FokRace) =>
      (st.my_items ?? []).flatMap((m) => {
        const run = race.runOfBoard(m.index);
        const board = boards.current[m.index];
        return board && run ? boardItems(board, run, { index: m.index, learn: true, ms: m.solved_ms ?? 0 }) : [];
      }),
    solvedText: (name, rank) => (rank === 1 ? `${name} solved the board first` : `${name} solved the board`),
  });
  const { st, race, t: now, push } = g;
  const teams = Number(play.settings.teams) || 0;
  const colorOf = (p: RacePlayer | undefined) => (!p ? C.gold : teams >= 2 && p.team != null ? presetTeam(p.team).color : playerColour(st?.players ?? [], p.user_id));

  // "Sara found a group", "Omar is out of hearts".
  const seen = useRef<{ index: number; greens: Record<string, number>; out: Set<string> } | null>(null);
  useEffect(() => {
    if (!st || st.phase !== 'case') return;
    const greens = Object.fromEntries(st.players.map((p) => [p.user_id, p.greens ?? 0]));
    const out = new Set(st.players.filter((p) => p.done && !p.solved).map((p) => p.user_id));
    const was = seen.current;
    seen.current = { index: st.index, greens, out };
    if (!was || was.index !== st.index) return;
    for (const p of st.players) {
      if (p.user_id === YOU) continue;
      const n = greens[p.user_id] - (was.greens[p.user_id] ?? 0);
      // The fourth falls into place with the third: one alert, and the solve alert says the rest.
      if (n > 0 && !p.solved) push(`${p.name} found a group`, colorOf(p));
      if (out.has(p.user_id) && !was.out.has(p.user_id)) push(`${p.name} is out of hearts`, '#f5b041');
    }
  }, [st, push]); // eslint-disable-line react-hooks/exhaustive-deps

  // The hint in Vs rivals too, at Solo's token price (Yazan 2026-11-12); a failed step gives the tokens back.
  const [hintNote, setHintNote] = useState<string | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  const buyHint = async () => {
    if (!race || hintBusy) return;
    setHintBusy(true);
    try {
      const receipt = await engine.wallet.spend(FOK.revealCost, 'fok_hint', play.id);
      if (!receipt) return setHintNote(`The hint costs ${FOK.revealCost} tokens. Each level up gives 1 token.`);
      if (!g.at((at) => race.hint(at))) return void engine.wallet.refund(receipt);
      setHintNote(null);
    } finally {
      setHintBusy(false);
    }
  };

  const menu = <PauseMenu open={g.menu} mode="bots" onResume={g.closeMenu} onQuit={g.quit} />;
  if (!st || !race) return <GameScreen scroll={false} under={<FokSky />}>{null}</GameScreen>;
  if (st.phase === 'countdown' || st.item == null) {
    return (
      <GameScreen scroll={false} under={<FokSky />}>
        <Countdown ms={st.phase_ends_at - now} faces={st.players.map((p) => p.character)} line={settingsLine(gameDef(play.game), play.settings)} />
        <RoomTalk room={g.room} me={g.talker} />
        {menu}
      </GameScreen>
    );
  }

  const board = race.boardNow();
  const run = race.mine();
  if (!board || !run) return <GameScreen scroll={false} under={<FokSky />}>{null}</GameScreen>;
  const total = st.total;
  const boardLine = total > 1 ? `Board ${st.index + 1} of ${total}` : 'Four of a Kind';
  const reveal = st.phase !== 'case';
  const left = race.leftMs(now);
  const me = st.players.find((p) => p.user_id === YOU);

  const chips = (
    <View style={s.lead}>
      {[...st.players]
        .sort((a, b) => (b.greens ?? 0) - (a.greens ?? 0) || b.score - a.score)
        .map((x) => (
          <View key={x.user_id} style={[s.chip, { borderColor: colorOf(x) }]}>
            <PlayerFace slug={x.character} size={u(18)} userId={x.user_id} still />
            <View style={{ flex: 1, minWidth: 0, gap: u(2) }}>
              <Text style={s.chipT} numberOfLines={1}>{x.user_id === YOU ? 'You' : x.name.split(' ')[0]}</Text>
              <View style={s.dots}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={[s.dot, { backgroundColor: i < (x.greens ?? 0) ? C.rows[i] : 'rgba(255,255,255,0.14)' }]} />
                ))}
              </View>
            </View>
            <Text style={[s.chipH, { color: (x.hearts ?? 0) > 0 ? '#ff6b7d' : C.mute }]}>{`♥${x.hearts ?? 0}`}</Text>
          </View>
        ))}
    </View>
  );

  if (reveal) {
    const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - now) / 1000));
    return (
      <GameScreen scroll={false} under={<FokSky />} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16) }}>
        <BoardEnd board={board} run={run} kicker={run.solved ? 'Board solved' : 'Board over'} title={boardLine} line={`You · ${st.me?.points ?? 0} of ${FOK.maxPoints} points`} />
        <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, s.dock]} pointerEvents="box-none">
          <RaceReveal
            label={run.solved ? 'Board solved' : 'Board over'}
            answer={`${me?.item_rank ? `You placed ${nth(me.item_rank)}` : 'The board'} · ${st.me?.points ?? 0} points`}
            players={st.players}
            me={YOU}
            how={(x) => `${x.greens ?? 0} of 4 · ${x.item_points ?? 0} pts`}
            next={st.phase === 'done' ? 'Adding up the scores…' : `${st.index + 1 < total ? 'Next board' : 'Results'} in ${nextIn} s`}
          />
        </Animated.View>
        <AlertPill alert={g.alert} />
        {menu}
      </GameScreen>
    );
  }

  const sub = [boardLine, left != null ? `${clock(left, { down: true })} left` : null, `${me?.score ?? 0} points so far`].filter(Boolean).join(' · ');
  return (
    <GameScreen scroll={false} under={<FokSky />} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), paddingBottom: u(14) }}>
      <BoardView
        key={st.index}
        board={board}
        run={run}
        locked={g.paused || run.phase !== 'play'}
        top={
          <View style={{ gap: u(8) }}>
            <TopLine kicker="Race the rivals" right={<Hearts n={run.hearts} />} title="Four of a Kind" sub={sub} />
            {chips}
          </View>
        }
        tip={hintNote ?? 'Everyone has the same board.'}
        hint={{ label: run.revealed != null ? 'Hint used' : `Hint · ${FOK.revealCost}`, onPress: () => void buyHint(), disabled: run.revealed != null || hintBusy || run.phase !== 'play' }}
        onSubmit={(tiles) => g.at((at) => race.submit(at, tiles)) ?? 'ignored'}
        onShuffle={() => void g.at((at) => race.shuffle(at))}
      />
      {run.phase === 'out' && !g.paused ? (
        <View style={s.token}>
          <TokenCard
            playId={play.id}
            text={`Second chance: ${FOK.tokenPrice} token gives ${FOK.tokenHearts} heart, once a board. Your found groups stay found.`}
            noLabel="No, end my board"
            onBuy={() => {
              // The board closed while the card was up: the token comes back (the card refunds on a throw).
              if (!g.at((at) => race.buyHeart(at))) throw new Error('over');
            }}
            onNo={() => void g.at((at) => race.decline(at))}
          />
        </View>
      ) : null}
      <AlertPill alert={g.alert} />
      <RoomTalk room={g.room} me={g.talker} />
      {menu}
    </GameScreen>
  );
}

const s = StyleSheet.create({
  lead: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6), marginRight: u(52) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: u(5), borderWidth: 1, borderRadius: 999, paddingVertical: u(3), paddingLeft: u(3), paddingRight: u(8), flexGrow: 1, flexBasis: '45%', backgroundColor: 'rgba(255,255,255,0.05)' },
  chipT: { fontFamily: F.bodySemi, fontSize: u(11), lineHeight: u(13), color: C.text },
  dots: { flexDirection: 'row', gap: u(2) },
  dot: { width: u(6), height: u(6), borderRadius: u(3) },
  chipH: { fontFamily: F.mono, fontSize: u(10) },
  dock: { justifyContent: 'flex-end', padding: u(16), zIndex: 6 },
  token: { position: 'absolute', left: u(16), right: u(16), bottom: u(16) },
});
