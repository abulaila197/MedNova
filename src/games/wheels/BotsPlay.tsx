// Live on stage (The Wheels of Chaos vs rivals, G5): the full show on your phone, the rivals taking their turns live
// while you watch, you taking yours; the Boss Round played by everyone at once. The phone referees (rivals.ts).
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { PanResponder, View } from 'react-native';

import { rivalMoment } from '@/bots/director';
import type { Place } from '@/bots/lines';
import { useBotRace } from '@/bots/race/useBotRace';
import { useStableCallback } from '@/lib/useStableCallback';
import { useRevealSound } from '@/lib/sound';
import { settingsLine } from '@/match/format';
import { AlertPill, Countdown } from '@/match/live';
import { RoomTalk } from '@/match/TalkBar';
import { u } from '@/theme/scale';

import { PauseMenu } from '../shell/PauseMenu';
import { gameDef } from '../shell/registry';
import { TurnName } from '../shell/TurnName';
import type { PlayProps } from '../shell/types';
import { fieldName, type Answer, type Mix, type QResult, type Target, type TurnEvent } from './core';
import { BANK } from './data';
import { actor, bossBonus, bossPoints, BOSS_MS, BOSS_RIGHT, BOSS_WRONG, type OfflineGame } from './offline';
import { actName, Board, BossOver, recapLine, RedemptionBoard, RedemptionOffer, Top, TurnOver, type Seats } from './OfflinePlay';
import { ONLINE_MS } from './online';
import { WheelsShow } from './rivals';
import { TurnBoard, type Strip } from './TurnBoard';
import { Bill, Btn, Bulbs, CD, CM, GEMS, Panel, PauseBtn, ROMAN, Rule, T, VelvetScreen, VV } from './velvet';

const WAITS: Partial<Record<OfflineGame['phase'], number>> = { redemptionOffer: ONLINE_MS.offer };

/** Your questions, one item each; EXP is half your points (WC11, through the def). */
function itemsOf(g: OfflineGame) {
  return g.answers
    .filter((a) => a.seat === 0)
    .map(({ r }: { r: QResult }) => ({
      seat: 0,
      itemId: r.id,
      answerKey: null,
      outcome: r.right ? ('right' as const) : r.answer == null ? ('timed_out' as const) : ('wrong' as const),
      answersGiven: [],
      timeMs: 0,
      hintsUsed: 0,
      revealsUsed: 0,
      points: r.points,
      feedsLearn: true,
      gameData: { style: r.style, field: r.field },
    }));
}

export function BotsPlay({ play, onFinish, onQuit }: PlayProps) {
  const target = (Number(play.settings.target) || 25) as Target;
  const mix = (play.settings.mix as Mix) || 'mixed';
  const g = useBotRace<WheelsShow>({
    play,
    onFinish,
    onQuit,
    blind: true,
    fine: true,
    build: (ctx) => new WheelsShow({ ...ctx, bank: BANK, target, mix }),
    pick: async () => [1],
    toItems: (_st, show) => itemsOf(show.game),
  });
  const { st, race: show, t, push } = g;
  const game = show && st ? show.game : null;

  const seatName = (s: number) => (s === 0 ? 'You' : (show?.rivals[s - 1]?.name ?? `Player ${s + 1}`));
  const n = game?.seats ?? 1;
  const placeOf = (seat: number): Place => {
    if (!game) return 'mid';
    const order = [...game.active].sort((a, b) => game.scores[b] - game.scores[a]);
    const i = order.indexOf(seat);
    return i <= 0 ? 'lead' : i >= order.length - 1 ? 'last' : 'mid';
  };

  // WC8: turn points, Redemption and Boss winners as alerts; the rivals react a beat later (never on the instant).
  const seenLog = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void) => void timers.current.push(setTimeout(fn, 2000 + Math.random() * 1000));
  useEffect(() => {
    if (!game || !show) return;
    if (seenLog.current == null || game.log.length < seenLog.current) {
      seenLog.current = game.log.length;
      return;
    }
    const bots = show.rivals;
    const any = () => bots[Math.floor(Math.random() * bots.length)];
    for (const l of game.log.slice(seenLog.current)) {
      const line = recapLine(l, seatName);
      if (line) push(line, GEMS[('seat' in l ? l.seat : 0) % GEMS.length]);
      if (l.k === 'turn' || l.k === 'redemption') {
        if (l.seat > 0) {
          const b = bots[l.seat - 1];
          if (b) later(() => rivalMoment(g.room, b, l.points > 0 ? 'right' : 'wrong', { tableSize: n, place: placeOf(l.seat) }));
        } else {
          const b = any();
          if (b) later(() => rivalMoment(g.room, b, l.points >= 3 ? 'youRight' : l.points === 0 ? 'youWrong' : 'round', { tableSize: n, place: placeOf(show.seatOf(b.id)) }));
        }
      } else if (l.k === 'boss') {
        for (const s of l.winners) {
          const b = bots[s - 1];
          if (s > 0 && b) later(() => rivalMoment(g.room, b, 'right', { tableSize: n, place: placeOf(s) }));
        }
      }
    }
    seenLog.current = game.log.length;
  }, [game?.log.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // My answer's right or wrong, as the feedback shows it.
  const who = game ? actor(game) : null;
  const fb = game?.phase === 'turn' && who === 0 && game.turn?.phase === 'feedback' ? game.turn.results[game.turn.k] : undefined;
  useRevealSound(fb ? `${game!.turn!.count}:${game!.turn!.k}:${fb.id}` : null, fb ? (fb.right ? true : fb.answer == null ? 'timeup' : false) : null);

  const menu = <PauseMenu open={g.menu} mode="bots" onResume={g.closeMenu} onQuit={g.quit} />;
  if (!st || !show || !game) return <VelvetScreen>{null}</VelvetScreen>;
  const answering = (game.phase === 'turn' && who === 0 && game.turn?.phase === 'question') || (game.phase === 'redemption' && who === 0) || (game.phase === 'boss' && game.boss?.phase === 'playing');
  const extras = (
    <>
      <AlertPill alert={g.alert} />
      {answering ? null : <RoomTalk room={g.room} me={g.talker} />}
      {menu}
    </>
  );
  if (st.phase === 'countdown') {
    return (
      <VelvetScreen>
        <Countdown ms={Math.max(0, st.phase_ends_at - t)} faces={st.players.map((p) => p.character)} line={settingsLine(gameDef(play.game), play.settings)} />
        {extras}
      </VelvetScreen>
    );
  }

  const seats: Seats = new Map(Array.from({ length: game.seats }, (_, s) => [s, { name: seatName(s), color: GEMS[s % GEMS.length] }]));
  const board: Strip = game.active.map((s) => ({ seat: s, name: seatName(s), color: GEMS[s % GEMS.length], score: game.scores[s], me: s === who })).sort((a, b) => b.score - a.score);
  const mine = who === 0;
  const pause = g.openMenu;
  const move = (m: Parameters<WheelsShow['move']>[1]) => void g.at((at) => show.move(at, m));
  const wait = WAITS[game.phase];
  const waitBar = wait && show.deadline ? <WaitBar left={Math.max(0, show.deadline - t)} total={wait} mine={mine} /> : null;

  let body: ReactNode = null;
  if (game.phase === 'done')
    body = (
      <View style={{ alignItems: 'center', gap: u(16), marginTop: u(120) }}>
        <T f={CD} size={22} color={VV.gold} style={{ textAlign: 'center' }}>Final curtain…</T>
        <Board board={board} />
      </View>
    );
  else if (game.phase === 'redemptionOffer' && who != null)
    body = mine ? (
      <RedemptionOffer seat={who} seats={seats} onPick={(use) => move({ type: 'REDEEM', use })} onPause={pause} />
    ) : (
      <Watching kicker="Redemption" title={<TurnName name={seatName(who)} color={GEMS[who % GEMS.length]} after=" is last" />} line="Final round: last place may swap this turn for a Redemption round, once a game." board={board} onPause={pause} />
    );
  else if (game.phase === 'redemption' && game.redemption)
    body = (
      <RedemptionBoard
        g={game}
        now={t}
        seats={seats}
        watch={!mine}
        hidden={g.paused}
        onEvent={(e) => move(e.type === 'GO' ? { type: 'GO' } : { type: 'CALL', value: e.value })}
        onPause={pause}
      />
    );
  else if (game.phase === 'turn' && game.turn && who != null)
    body = (
      <TurnBoard
        turn={game.turn}
        now={t}
        kicker={actName(game)}
        title={mine ? <TurnName name="Your turn" color={GEMS[who % GEMS.length]} /> : <TurnName name={seatName(who)} color={GEMS[who % GEMS.length]} after="’s turn" />}
        strip={board}
        watch={!mine}
        hidden={g.paused}
        footer={mine ? undefined : <T f={CM} size={12} color={VV.soft} style={{ textAlign: 'center' }}><TurnName name={seatName(who)} color={GEMS[who % GEMS.length]} after=" is answering" /></T>}
        onEvent={(e: TurnEvent) => {
          if (e.type === 'ANSWER') move({ type: 'ANSWER', answer: e.answer as Answer });
          else if (e.type === 'GO') move({ type: 'GO' });
        }}
        onPause={pause}
      />
    );
  else if (game.phase === 'turnOver' && who != null) body = <TurnOver g={game} seat={who} seats={seats} board={board} />;
  else if (game.phase === 'boss' && game.boss) body = <LiveBoss show={show} g={game} t={t} seatName={seatName} onSwipe={(fits) => void g.at((at) => show.swipe(at, fits))} onPause={pause} hidden={g.paused} />;
  else if (game.phase === 'bossOver') body = <BossOver g={game} seats={seats} board={board} />;

  return (
    <VelvetScreen scroll={game.phase === 'turnOver' || game.phase === 'bossOver'}>
      {waitBar}
      {body}
      {extras}
    </VelvetScreen>
  );
}

/** How long the player whose move it is has left. */
function WaitBar({ left, total, mine }: { left: number; total: number; mine: boolean }) {
  return (
    <View style={{ gap: u(4), marginBottom: u(10) }}>
      <Bulbs frac={left / total} />
      <T f={CM} size={11} color={mine ? VV.gold : VV.dim} style={{ textAlign: 'right' }}>{`${Math.ceil(left / 1000)} s${mine ? ' to choose' : ''}`}</T>
    </View>
  );
}

/** A rival's move: what is happening and the table. */
function Watching({ kicker, title, line, board, onPause }: { kicker: string; title: ReactNode; line: string; board: Strip; onPause: () => void }) {
  return (
    <View style={{ gap: u(12) }}>
      <Top kicker={kicker} title={title} onPause={onPause} />
      <T size={13.5} color={VV.soft} style={{ textAlign: 'center' }}>{line}</T>
      <Board board={board} />
    </View>
  );
}

// ---------------------------------------------------------------- Boss Round, everyone at once (WC23)

function LiveBoss({ show, g, t, seatName, onSwipe, onPause, hidden }: { show: WheelsShow; g: OfflineGame; t: number; seatName: (s: number) => string; onSwipe: (fits: boolean) => void; onPause: () => void; hidden: boolean }) {
  const b = g.boss!;
  const mine = show.swipesOf(0, t);
  const deck = b.decks[0] ?? [];
  const done = mine.length >= deck.length && deck.length > 0;
  const swipe = useStableCallback(onSwipe);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, d) => Math.abs(d.dx) > 12,
        onPanResponderRelease: (_, d) => {
          if (Math.abs(d.dx) > 60) swipe(d.dx > 0);
        },
      }),
    [swipe],
  );
  if (hidden) return null;

  if (b.phase === 'ready' || done) {
    const others = g.active.filter((s) => s !== 0);
    const startsIn = b.phase === 'ready' && show.deadline ? Math.max(0, Math.ceil((show.deadline - t) / 1000)) : null;
    return (
      <View style={{ gap: u(14) }}>
        <Top kicker={`Act ${ROMAN[g.cycle]} · Boss Round`} title={b.phase === 'ready' ? 'Everyone swipes at once' : 'Deck done'} onPause={onPause} />
        <Bill>
          <T f={CM} size={10.5} color={VV.paperSoft} style={{ letterSpacing: u(2), textAlign: 'center' }}>{fieldName(b.field).toUpperCase()}</T>
          <T f={CD} size={19} color={VV.redInk} style={{ textAlign: 'center' }}>{b.category}</T>
          <Rule c="rgba(42,26,18,0.18)" />
          <T size={13} color={VV.paperInk} style={{ textAlign: 'center' }}>{`Swipe right if it belongs, left if it doesn’t. ${BOSS_MS / 1000} seconds. +${BOSS_RIGHT} for a right swipe, ${BOSS_WRONG} for a wrong one.`}</T>
          <T size={12} color={VV.paperSoft} style={{ textAlign: 'center' }}>{`Same items for everyone, each in their own order. Highest score wins +${bossBonus(g.target)}.`}</T>
        </Bill>
        {startsIn != null ? <T f={CD} size={30} color={VV.gold} style={{ textAlign: 'center' }}>{String(startsIn)}</T> : null}
        {done ? <T size={13} color={VV.soft} style={{ textAlign: 'center' }}>{`${show.myBossPoints()} points.`}</T> : null}
        {b.phase === 'playing' ? (
          <Panel>
            {others.map((s) => (
              <T key={s} size={12.5} color={VV.soft}>{`${seatName(s)}: ${show.swipesOf(s, t).length} of ${b.items.length}`}</T>
            ))}
          </Panel>
        ) : null}
      </View>
    );
  }

  const item = b.items[deck[Math.min(mine.length, deck.length - 1)]];
  const left = b.until != null ? Math.max(0, b.until - t) : 0;
  return (
    <View style={{ flex: 1, gap: u(12) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(12) }}>
        <View style={{ flex: 1 }}>
          <Bulbs frac={left / BOSS_MS} />
        </View>
        <PauseBtn onPress={onPause} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T f={CM} size={12} color={VV.brass} style={{ letterSpacing: u(1), flexShrink: 1 }} lines={1}>{b.category.toUpperCase()}</T>
        <T f={CM} size={12} color={VV.soft} style={{ flexShrink: 0 }}>{`${bossPoints({ ...b, swipes: { 0: mine } }, 0)} pts`}</T>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', minHeight: u(240) }} {...pan.panHandlers}>
        <Bill style={{ marginHorizontal: u(20) }}>
          <View style={{ minHeight: u(150), alignItems: 'center', justifyContent: 'center', gap: u(8) }}>
            <T f={CM} size={10.5} color={VV.paperSoft} style={{ letterSpacing: u(2) }}>{`${mine.length + 1} OF ${b.items.length}`}</T>
            <T f={CD} size={20} color={VV.paperInk} style={{ textAlign: 'center' }}>{item.label}</T>
          </View>
        </Bill>
        <T size={11.5} color={VV.dim} style={{ textAlign: 'center', marginTop: u(10) }}>Swipe the card, or tap below.</T>
      </View>
      <View style={{ flexDirection: 'row', gap: u(10) }}>
        <Btn label="‹ Doesn’t fit" ghost onPress={() => onSwipe(false)} style={{ flex: 1 }} />
        <Btn label="Fits ›" onPress={() => onSwipe(true)} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

