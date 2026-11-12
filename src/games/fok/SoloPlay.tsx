import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/AppText';
import { u } from '@/theme/scale';

import { engine } from '../engine';
import { clock as clockText } from '../engine/clock';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { GameScreen } from '../shell/ui';
import { BoardView } from './BoardView';
import { FOK, boardPoints, boardStars, buyHeart, endRun, reshuffle, reveal, startRun, submit, type Board, type BoardRun } from './core';
import { groupById } from './data';
import { dealBoards } from './deal';
import { boardItems } from './items';
import { Bar, FokSky, GroupNotes, GroupRow, Hearts, TableBtn, TokenCard, TopLine, s as ts, C } from './Table';

/** One board's result in this game. */
type Done = { points: number; stars: number; mistakes: number; ms: number; solved: boolean };
/** Solo bookmark (rules 7, 10): the boards, where you are and the time spent on this board. */
type Save = { boards: Board[]; index: number; run: BoardRun; done: Done[]; ms: number };

/** Solo (Yazan's cards 2026-11-12): 1, 3 or 5 boards in a row, each with 3 hearts, the hint and the token heart. */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const limitMs = (Number(play.settings.clock) || 0) * 60_000;
  const [save, setSave] = useState<Save | null>(null);
  const ref = useRef<Save | null>(null);
  const [menu, setMenu] = useState(false);
  const { hidden, resume } = usePauseHide(() => setMenu(true));
  const paused = menu || hidden;

  const put = useCallback(
    (next: Save) => {
      ref.current = next;
      setSave(next);
      engine.recorder.bookmark(play.id, next, next.done.reduce((a, d) => a + d.points, 0));
    },
    [play.id],
  );

  // Start, or carry on from the bookmark.
  useEffect(() => {
    let live = true;
    (async () => {
      const saved = play.resume as Save | null;
      const ok = saved?.boards?.length && saved.boards.every((b) => b.groups.every((g) => groupById.has(g.id)));
      const next: Save = ok ? saved! : { boards: await dealBoards(play), index: 0, run: startRun(Math.random), done: [], ms: 0 };
      if (live) put(next);
    })();
    return () => {
      live = false;
    };
  }, [play, put]);

  // The board clock: counts while the board is in play and the game isn't paused.
  // `live` is the time since the clock last started or a move was banked, redrawn every 250 ms.
  const [live, setLive] = useState(0);
  const since = useRef<number | null>(null);
  const playing = !!save && save.run.phase === 'play' && !paused;
  useEffect(() => {
    if (!playing) return;
    since.current = Date.now();
    const id = setInterval(() => setLive(since.current != null ? Date.now() - since.current : 0), 250);
    return () => {
      clearInterval(id);
      const cur = ref.current;
      if (cur && since.current != null) {
        const next = { ...cur, ms: cur.ms + Date.now() - since.current };
        ref.current = next;
        setSave(next);
      }
      since.current = null;
      setLive(0);
    };
  }, [playing]);
  const spent = (save?.ms ?? 0) + live;

  /** Moves the board on; when it ends, its groups are recorded. */
  const step = useCallback(
    (run: BoardRun) => {
      const cur = ref.current;
      if (!cur) return;
      const ms = cur.ms + (since.current != null ? Date.now() - since.current : 0);
      if (since.current != null) since.current = Date.now();
      let next: Save = { ...cur, run, ms };
      if (run.phase === 'done' && cur.run.phase !== 'done') {
        const board = cur.boards[cur.index];
        const d: Done = { points: boardPoints(board, groupById, run), stars: boardStars(run), mistakes: run.mistakes, ms, solved: run.solved };
        next = { ...next, done: [...cur.done, d] };
        for (const it of boardItems(board, run, { index: cur.index, learn: true, ms })) void recordItem(play, it, true);
      }
      put(next);
      setLive(0);
    },
    [play, put],
  );

  // Time up ends the board.
  useEffect(() => {
    if (limitMs && save && save.run.phase === 'play' && spent >= limitMs) step(endRun(save.run));
  }, [limitMs, save, spent, step]);

  // The hint costs tokens (Yazan 2026-11-12); a failed step gives them back.
  const [hintNote, setHintNote] = useState<string | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  const buyHint = async () => {
    const cur = ref.current;
    if (!cur || cur.run.revealed != null || hintBusy) return;
    setHintBusy(true);
    try {
      const receipt = await engine.wallet.spend(FOK.revealCost, 'fok_hint', play.id);
      if (!receipt) return setHintNote(`The hint costs ${FOK.revealCost} tokens. Each level up gives 1 token.`);
      const now = ref.current;
      if (!now || now.run.phase !== 'play') return void engine.wallet.refund(receipt);
      setHintNote(null);
      step(reveal(now.run));
    } finally {
      setHintBusy(false);
    }
  };

  const finish = () => {
    const done = ref.current?.done ?? [];
    if (!done.length) {
      void engine.recorder.discard(play.id);
      return onQuit();
    }
    onFinish(done.reduce((a, d) => a + d.points, 0));
  };

  if (!save) return <GameScreen scroll={false} under={<FokSky />}>{null}</GameScreen>;
  const board = save.boards[save.index];
  const run = save.run;
  const total = save.boards.length;
  const menuEl = <PauseMenu open={menu} mode="solo" onResume={() => (setMenu(false), resume())} onQuit={() => (save.done.length > save.index ? finish() : onQuit())} />;

  if (run.phase === 'done') {
    const last = save.index + 1 >= total;
    const d = save.done[save.index];
    return (
      <GameScreen scroll={false} under={<FokSky />} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16) }}>
        <BoardEnd
          board={board}
          run={run}
          kicker={run.solved ? 'Board solved' : limitMs && spent >= limitMs ? 'Time up' : 'Out of hearts'}
          title={total > 1 ? `Board ${save.index + 1} of ${total}` : 'Four of a Kind'}
          line={`${'★'.repeat(d?.stars ?? 0)}${'☆'.repeat(3 - (d?.stars ?? 0))}   ${d?.points ?? 0} of ${FOK.maxPoints} points · ${clockText(d?.ms ?? 0)}`}
          next={last ? 'See results' : 'Next board'}
          onNext={() => (last ? finish() : put({ ...save, index: save.index + 1, run: startRun(Math.random), ms: 0 }))}
        />
        {menuEl}
      </GameScreen>
    );
  }

  const left = limitMs ? Math.max(0, limitMs - spent) : null;
  return (
    <GameScreen scroll={false} under={<FokSky />} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), paddingBottom: u(14) }}>
      <BoardView
        key={save.index}
        board={board}
        run={run}
        locked={paused || run.phase !== 'play'}
        top={<TopLine kicker="Find 4 groups of 4" right={<Hearts n={run.hearts} />} title="Four of a Kind" sub={[total > 1 ? `Board ${save.index + 1} of ${total}` : null, left != null ? `${clockText(left, { down: true })} left` : null].filter(Boolean).join(' · ')} />}
        onSubmit={(tiles) => {
          const r = submit(run, tiles);
          if (r.run !== run) step(r.run);
          return r.verdict;
        }}
        onShuffle={() => step(reshuffle(run, Math.random))}
        tip={hintNote ?? undefined}
        hint={{ label: run.revealed != null ? 'Hint used' : `Hint · ${FOK.revealCost}`, onPress: buyHint, disabled: run.revealed != null || hintBusy }}
      />
      {run.phase === 'out' ? (
        <View style={{ position: 'absolute', left: u(16), right: u(16), bottom: u(16) }}>
          <TokenCard playId={play.id} onBuy={() => step(buyHeart(run))} onNo={() => step(endRun(run))} />
        </View>
      ) : null}
      {menuEl}
    </GameScreen>
  );
}

/** The end of a board: every group with its link (tap one for each box's note), stars and points, then on. */
export function BoardEnd({ board, run, kicker, title, line, next, onNext, who, wait, hearts = true }: { board: Board; run: BoardRun; kicker: string; title: string; line: string; next?: string; onNext?: () => void; who?: Record<number, string>; wait?: string; hearts?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const order = [...run.found, ...[0, 1, 2, 3].filter((x) => !run.found.includes(x))];
  return (
    <View style={{ flex: 1, gap: u(10) }}>
      <TopLine kicker={kicker} right={hearts ? <Hearts n={run.hearts} /> : undefined} title={title} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: u(8), paddingBottom: u(8) }} showsVerticalScrollIndicator={false}>
        {order.map((slot) => (
          <View key={slot} style={{ gap: u(8) }}>
            <GroupRow board={board} slot={slot} missed={!run.found.includes(slot)} who={who?.[slot]} line onPress={() => setOpen(open === slot ? null : slot)} />
            {open === slot ? <GroupNotes board={board} slot={slot} /> : null}
          </View>
        ))}
        <Text style={[ts.note, { textAlign: 'center' }]}>Tap a group to see each box.</Text>
      </ScrollView>
      <Text style={{ fontFamily: 'DMSerifDisplay_400Regular', fontSize: u(17), color: C.text, textAlign: 'center' }}>{line}</Text>
      {next && onNext ? (
        <Bar>
          <TableBtn label={next} go onPress={onNext} />
        </Bar>
      ) : wait ? (
        <Text style={[ts.note, { textAlign: 'center' }]}>{wait}</Text>
      ) : null}
    </View>
  );
}
