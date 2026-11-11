// Pass the phone (WC1, WC12-WC17): the full game on one phone. Three acts of 3, 2 and 2 rounds of everyone's turn;
// each act ends with a Boss Round of turn-based swipes. No tarot cards since #39a (Yazan 2026-11-01). The phone goes
// round behind a curtain that shows what happened since that player last held it (OF1).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, View } from 'react-native';

import { useStableCallback } from '@/lib/useStableCallback';
import { u } from '@/theme/scale';

import { engine, rank } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import { RECAP_MAX } from '../shell/recap';
import type { PlayProps } from '../shell/types';
import { tickedFields } from '../shell/fields';
import { fieldName, mixWith, type Mix, type QResult, type Target } from './core';
import { BANK } from './data';
import {
  actor, bossPoints, startOffline, stepOffline, upgradeSaved, bossBonus, BOSS_MS, BOSS_RIGHT, BOSS_WRONG, MAX_ACTS, roundsIn, REDEMPTION_ITEMS, REDEMPTION_MS,
  type Log, type OfflineEvent, type OfflineGame,
} from './offline';
import { PauseMenu } from '../shell/PauseMenu';
import { TurnBoard, type Strip } from './TurnBoard';
import { TurnName } from '../shell/TurnName';
import { Bill, Btn, Bulbs, CB, CD, CM, Gem, Kicker, Panel, PauseBtn, QF_B, ROMAN, Rule, T, VelvetScreen, VV } from './velvet';
import { useTicker } from '../engine/useTicker';
import { gameShown } from './shown';

export type Seats = Map<number, { name: string; color?: string }>;
const snapshot = (g: OfflineGame, now: number) => stepOffline(g, { type: 'PAUSE', now }, BANK, Math.random);
export const actName = (g: OfflineGame) => `Act ${ROMAN[g.cycle]} · Round ${g.round + 1} of ${roundsIn(g.cycle)}`;

export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const target = (Number(play.settings.target) || 50) as Target;
  const mix = mixWith((play.settings.mix as Mix) || 'mixed', tickedFields(play.settings));
  // The saved game (its clocks started again), or a new one.
  const [first] = useState(() => {
    const saved = play.resume as OfflineGame | null;
    if (saved) return { g: stepOffline(upgradeSaved(saved, BANK, Math.random), { type: 'RESUME', now: Date.now() }, BANK, Math.random), fresh: false };
    return { g: startOffline(play.seats.length, target, BANK, Math.random, mix), fresh: true };
  });
  const [g, setG] = useState<OfflineGame>(first.g);
  const ref = useRef<OfflineGame>(first.g);
  const [paused, setPaused] = useState(false);
  // Who has the phone, and where in the log each player last took it (for the recap).
  const [holder, setHolder] = useState<number | null>(null);
  const [seen, setSeen] = useState<Record<number, number>>({});
  const seats: Seats = useMemo(() => new Map(play.seats.map((x) => [x.seat, { name: x.name, color: x.color }])), [play.seats]);
  const name = (s: number) => seats.get(s)?.name ?? `Player ${s + 1}`;

  useEffect(() => {
    if (first.fresh) engine.recorder.bookmark(play.id, snapshot(first.g, Date.now()), 0);
  }, [first, play.id]);

  const record = useCallback(
    (seat: number, rs: QResult[]) => {
      for (const r of rs)
        recordItem(play, {
          seat, itemId: r.id, answerKey: null, outcome: r.right ? 'right' : r.answer == null ? 'timed_out' : 'wrong', answersGiven: [], timeMs: 0,
          hintsUsed: 0, revealsUsed: 0, points: r.points, feedsLearn: seat === 0, gameData: { style: r.style, field: r.field },
        });
    },
    [play],
  );

  const dispatch = useCallback(
    (e: OfflineEvent) => {
      const prev = ref.current;
      if (!prev) return;
      const next = stepOffline(prev, e, BANK, Math.random);
      if (next === prev) return;
      ref.current = next;
      setG(next);
      engine.recorder.bookmark(play.id, snapshot(next, Date.now()), next.scores[0] ?? 0);
      // Each answered question is one item under the player who answered it; the phone owner's misses go to Learn.
      if (next.answers.length > prev.answers.length) for (const a of next.answers.slice(prev.answers.length)) record(a.seat, [a.r]);
      const pr = prev.redemption, nr = next.redemption;
      if (nr && nr.answers.length > (pr && pr.seat === nr.seat && pr.items === nr.items ? pr.answers.length : 0)) {
        const from = pr && pr.items === nr.items ? pr.answers.length : 0;
        record(nr.seat, nr.answers.slice(from).map((v, i) => {
          const q = nr.items[from + i];
          const right = q.style === 'tf' && q.answer === v;
          return { id: q.id, style: 'tf', field: q.field, right, points: right ? 1 : 0, answer: v };
        }));
      }
      if (next.phase === 'done' && prev.phase !== 'done') {
        const rows = next.active.map((s) => ({ seat: s, name: name(s), score: next.scores[s], timeMs: 0 }));
        onFinish(next.scores[0] ?? 0, rank(rows));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [play, record, onFinish],
  );

  const timed = !!g && !paused && (g.turn?.until != null || g.redemption?.until != null || g.boss?.until != null);
  const now = useTicker(timed, 150, (n) => {
    const cur = ref.current;
    if (!cur) return;
    if (cur.phase === 'turn') dispatch({ type: 'TURN', e: { type: 'TICK', now: n } });
    else if (cur.phase === 'redemption') dispatch({ type: 'RED', e: { type: 'TICK', now: n } });
    else if (cur.phase === 'boss') dispatch({ type: 'BOSS', e: { type: 'TICK', now: n } });
  }, { shown: (n) => gameShown(ref.current, n) }); // redraws when the bulbs change, not on every tick

  const pause = () => {
    setPaused(true);
    dispatch({ type: 'PAUSE', now: Date.now() });
  };
  usePauseHide(pause);

  if (!g || g.phase === 'done') return <VelvetScreen>{null}</VelvetScreen>;
  const who = actor(g);
  const resume = () => {
    setPaused(false);
    dispatch({ type: 'RESUME', now: Date.now() });
  };
  const board: Strip = g.active.map((s) => ({ seat: s, name: name(s), color: seats.get(s)?.color, score: g.scores[s], me: s === who })).sort((a, b) => b.score - a.score);
  const ready = () => {
    if (who == null) return;
    setSeen((x) => ({ ...x, [who]: g.log.length }));
    setHolder(who);
  };

  let body: React.ReactNode;
  if (who != null && who !== holder) body = <Curtain g={g} seat={who} seats={seats} board={board} since={seen[who] ?? 0} onReady={ready} />;
  else if (g.phase === 'redemptionOffer' && who != null) body = <RedemptionOffer seat={who} seats={seats} onPick={(use) => dispatch({ type: 'REDEEM', use })} onPause={pause} />;
  else if (g.phase === 'redemption' && g.redemption) body = <RedemptionBoard g={g} now={now} seats={seats} onEvent={(e) => dispatch({ type: 'RED', e })} onPause={pause} hidden={paused} />;
  else if (g.phase === 'turn' && g.turn && who != null)
    body = (
      <TurnBoard
        turn={g.turn}
        now={now}
        kicker={actName(g)}
        title={<TurnName name={name(who)} color={seats.get(who)?.color} after="’s turn" />}
        strip={board}
        onEvent={(e) => dispatch({ type: 'TURN', e })}
        onPause={pause}
        hidden={paused}
      />
    );
  else if (g.phase === 'turnOver' && who != null) body = <TurnOver g={g} seat={who} seats={seats} board={board} onNext={() => dispatch({ type: 'NEXT' })} />;
  else if (g.phase === 'boss' && g.boss && who != null) body = <BossBoard g={g} seat={who} now={now} seats={seats} onEvent={(e) => dispatch({ type: 'BOSS', e })} onPause={pause} hidden={paused} />;
  else if (g.phase === 'bossOver') body = <BossOver g={g} seats={seats} board={board} onNext={() => dispatch({ type: 'NEXT' })} />;

  return (
    <>
      <VelvetScreen scroll={g.phase === 'turnOver' || g.phase === 'bossOver' || who !== holder}>{body}</VelvetScreen>
      <PauseMenu
        open={paused}
        mode="offline"
        seats={play.seats.map((x) => ({ ...x, removed: x.removed || !g.active.includes(x.seat) }))}
        keep={[0]}
        onResume={resume}
        onQuit={onQuit}
        onRemove={(x) => {
          engine.recorder.removeSeat(play.id, x);
          dispatch({ type: 'REMOVE', seat: x });
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------- shared bits

export function Top({ kicker, title, onPause }: { kicker: string; title: ReactNode; onPause?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(12) }}>
      <View style={{ gap: u(2), flex: 1 }}>
        <Kicker>{kicker}</Kicker>
        <T f={CD} size={23}>{title}</T>
      </View>
      {onPause ? <PauseBtn onPress={onPause} /> : null}
    </View>
  );
}

export function Board({ board, extra }: { board: Strip; extra?: Record<number, string> }) {
  return (
    <Panel>
      {board.map((p, i) => (
        <View key={p.seat} style={{ flexDirection: 'row', alignItems: 'center', gap: u(10) }}>
          <T f={CB} size={13} color={VV.dim} style={{ width: u(22) }}>{ROMAN[i]}</T>
          <Gem c={p.color} size={9} />
          <T f={CB} size={14.5} color={p.me ? VV.gold : VV.ink} style={{ flex: 1 }}>{p.name}</T>
          {extra?.[p.seat] ? <T f={CM} size={11.5} color={VV.soft}>{extra[p.seat]}</T> : null}
          <T f={CD} size={17} color={VV.brass}>{String(p.score)}</T>
        </View>
      ))}
    </Panel>
  );
}

/** OF1: one line per event since this player last held the phone. */
export function recapLine(l: Log, n: (s: number) => string): string | null {
  switch (l.k) {
    case 'turn':
      return `${n(l.seat)} scored ${l.points}`;
    case 'redemption':
      return `${n(l.seat)} played Redemption · +${l.points}`;
    case 'boss':
      return `${l.winners.map(n).join(' and ')} won the Boss Round · +${l.bonus}`;
    case 'left':
      return `${n(l.seat)} left the game`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------- the curtain

function Curtain({ g, seat, seats, board, since, onReady }: { g: OfflineGame; seat: number; seats: Seats; board: Strip; since: number; onReady: () => void }) {
  const n = (s: number) => seats.get(s)?.name ?? `Player ${s + 1}`;
  const lines = g.log.slice(since).map((l) => recapLine(l, n)).filter((x): x is string => !!x).slice(-RECAP_MAX);
  const why = g.phase === 'boss' ? 'Boss Round' : 'Your turn';
  return (
    <View style={{ gap: u(14), paddingTop: u(18) }}>
      <View style={{ alignItems: 'center', gap: u(4) }}>
        <Kicker>{`${actName(g)} · ${why}`}</Kicker>
        <T f={CM} size={13} color={VV.soft}>Pass the phone to</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(12) }}>
          <Gem c={seats.get(seat)?.color} size={13} />
          <T f={CD} size={32} color={VV.gold}>{n(seat)}</T>
        </View>
      </View>
      {lines.length ? (
        <Panel>
          <T f={CM} size={10.5} color={VV.dim} style={{ letterSpacing: u(2) }}>SINCE YOUR LAST TURN</T>
          {lines.map((x, i) => (
            <T key={i} size={12.5} color={VV.ink}>{x}</T>
          ))}
        </Panel>
      ) : null}
      <Board board={board} />
      <Btn label="I’m ready" onPress={onReady} />
    </View>
  );
}

// ---------------------------------------------------------------- Redemption (WC3, WC13, WC15)

export function RedemptionOffer({ seat, seats, onPick, onPause }: { seat: number; seats: Seats; onPick: (use: boolean) => void; onPause: () => void }) {
  return (
    <View style={{ flex: 1, gap: u(14) }}>
      <Top kicker={`Redemption · ${seats.get(seat)?.name ?? ''}`} title="A second chance" onPause={onPause} />
      <T size={14} style={{ textAlign: 'center', paddingTop: u(8) }}>{`You’re last. Swap this turn for a Redemption round: ${REDEMPTION_ITEMS} quick true or false calls in ${REDEMPTION_MS / 1000} seconds, +1 each.`}</T>
      <T size={12} color={VV.dim} style={{ textAlign: 'center' }}>Redemption is offered once a game, in the final round, to whoever is last first.</T>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: u(10) }}>
        <Btn label="Keep my turn" ghost onPress={() => onPick(false)} style={{ flex: 1 }} />
        <Btn label="Redemption" onPress={() => onPick(true)} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export function RedemptionBoard({ g, now, seats, onEvent, onPause, hidden, watch }: { g: OfflineGame; now: number; seats: Seats; onEvent: (e: { type: 'GO'; now: number } | { type: 'ANSWER'; value: boolean; now: number }) => void; onPause?: () => void; hidden?: boolean; watch?: boolean }) {
  const r = g.redemption!;
  if (hidden) return null;
  if (r.phase === 'reveal')
    return (
      <View style={{ flex: 1, gap: u(14) }}>
        <Top kicker={`Redemption · ${fieldName(r.field)}`} title={<TurnName name={seats.get(r.seat)?.name ?? ''} color={seats.get(r.seat)?.color} after="’s second chance" />} onPause={onPause} />
        <Bill>
          <T f={CD} size={18} color={VV.redInk} style={{ textAlign: 'center' }}>{`${REDEMPTION_ITEMS} calls · ${REDEMPTION_MS / 1000} seconds`}</T>
          <T size={13} color={VV.paperSoft} style={{ textAlign: 'center' }}>{`True or false, as fast as you can. Each right call is +1. A wrong call costs nothing but time.`}</T>
        </Bill>
        <View style={{ flex: 1 }} />
        {watch ? null : <Btn label="Begin" onPress={() => onEvent({ type: 'GO', now: Date.now() })} />}
      </View>
    );
  const q = r.items[Math.min(r.index, r.items.length - 1)];
  const left = r.until != null ? Math.max(0, r.until - (r.pausedAt ?? now)) : 0;
  return (
    <View style={{ flex: 1, gap: u(12) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(12) }}>
        <View style={{ flex: 1 }}>
          <Bulbs frac={left / REDEMPTION_MS} />
        </View>
        {onPause ? <PauseBtn onPress={onPause} /> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T f={CM} size={12} color={VV.brass} style={{ letterSpacing: u(1) }}>{`CALL ${Math.min(r.index + 1, r.items.length)} OF ${r.items.length}`}</T>
        <T f={CM} size={12} color={VV.soft}>{`${r.right} right`}</T>
      </View>
      <Panel inner={{ paddingVertical: u(22) }}>
        <T f={QF_B} size={18.5} style={{ textAlign: 'center', lineHeight: u(23.5) }}>{q.prompt}</T>
      </Panel>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: u(10), opacity: watch ? 0.4 : 1 }} pointerEvents={watch ? 'none' : 'auto'}>
        <Btn label="False" ghost onPress={() => onEvent({ type: 'ANSWER', value: false, now: Date.now() })} style={{ flex: 1 }} />
        <Btn label="True" onPress={() => onEvent({ type: 'ANSWER', value: true, now: Date.now() })} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- between turns

export function TurnOver({ g, seat, seats, board, onNext }: { g: OfflineGame; seat: number; seats: Seats; board: Strip; onNext?: () => void }) {
  const last = [...g.log].reverse().find((l) => (l.k === 'turn' || l.k === 'redemption') && l.seat === seat);
  const pts = last && (last.k === 'turn' || last.k === 'redemption') ? last.points : 0;
  const results = g.turn && last?.k === 'turn' ? g.turn.results : [];
  const red = last?.k === 'redemption' ? g.redemption : null;
  return (
    <View style={{ gap: u(12) }}>
      <Top kicker={actName(g)} title={`${seats.get(seat)?.name ?? ''} ${pts ? `+${pts}` : 'scores nothing'}`} />
      {results.length ? (
        <Panel>
          {results.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: u(9) }}>
              <T f={CB} size={13} color={r.right ? VV.right : VV.wrong} style={{ width: u(16) }}>{r.right ? '✓' : '✕'}</T>
              <T size={13} style={{ flex: 1 }}>{fieldName(r.field)}</T>
              <T f={CB} size={13} color={VV.soft}>{String(r.points)}</T>
            </View>
          ))}
        </Panel>
      ) : red ? (
        <Panel>
          <T size={13}>{`Redemption: ${red.right} right of ${red.items.length}.`}</T>
        </Panel>
      ) : null}
      <Board board={board} />
      {onNext ? <Btn label="Pass the phone" onPress={onNext} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------- Boss Round (spec 5, turn-based swipes)

function BossBoard({ g, seat, now, seats, onEvent, onPause, hidden }: { g: OfflineGame; seat: number; now: number; seats: Seats; onEvent: (e: { type: 'GO'; now: number } | { type: 'SWIPE'; fits: boolean; now: number }) => void; onPause: () => void; hidden?: boolean }) {
  const b = g.boss!;
  const swipe = useStableCallback((fits: boolean) => onEvent({ type: 'SWIPE', fits, now: Date.now() }));
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
  const n = seats.get(seat)?.name ?? '';
  if (b.phase === 'ready')
    return (
      <View style={{ flex: 1, gap: u(14) }}>
        <Top kicker={`Act ${ROMAN[g.cycle]} · Boss Round`} title={<TurnName name={n} color={seats.get(seat)?.color} after="’s go" />} onPause={onPause} />
        <Bill>
          <T f={CM} size={10.5} color={VV.paperSoft} style={{ letterSpacing: u(2), textAlign: 'center' }}>{fieldName(b.field).toUpperCase()}</T>
          <T f={CD} size={19} color={VV.redInk} style={{ textAlign: 'center' }}>{b.category}</T>
          <Rule c="rgba(42,26,18,0.18)" />
          <T size={13} color={VV.paperInk} style={{ textAlign: 'center' }}>{`Swipe right if it belongs, left if it doesn’t. ${BOSS_MS / 1000} seconds. +${BOSS_RIGHT} for a right swipe, ${BOSS_WRONG} for a wrong one.`}</T>
          <T size={12} color={VV.paperSoft} style={{ textAlign: 'center' }}>{`Everyone gets the same items in their own order. Highest score wins +${bossBonus(g.target)}.`}</T>
        </Bill>
        <View style={{ flex: 1 }} />
        <Btn label="Start swiping" onPress={() => onEvent({ type: 'GO', now: Date.now() })} />
      </View>
    );
  const deck = b.decks[seat] ?? [];
  const done = (b.swipes[seat] ?? []).length;
  const item = b.items[deck[Math.min(done, deck.length - 1)]];
  const left = b.until != null ? Math.max(0, b.until - (b.pausedAt ?? now)) : 0;
  return (
    <View style={{ flex: 1, gap: u(12) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(12) }}>
        <View style={{ flex: 1 }}>
          <Bulbs frac={left / BOSS_MS} />
        </View>
        <PauseBtn onPress={onPause} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T f={CM} size={12} color={VV.brass} style={{ letterSpacing: u(1) }}>{b.category.toUpperCase()}</T>
        <T f={CM} size={12} color={VV.soft}>{`${bossPoints(b, seat)} pts`}</T>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }} {...pan.panHandlers}>
        <Bill style={{ marginHorizontal: u(20) }}>
          <View style={{ minHeight: u(150), alignItems: 'center', justifyContent: 'center', gap: u(8) }}>
            <T f={CM} size={10.5} color={VV.paperSoft} style={{ letterSpacing: u(2) }}>{`${done + 1} OF ${b.items.length}`}</T>
            <T f={CD} size={20} color={VV.paperInk} style={{ textAlign: 'center' }}>{item.label}</T>
          </View>
        </Bill>
        <T size={11.5} color={VV.dim} style={{ textAlign: 'center', marginTop: u(10) }}>Swipe the card, or tap below.</T>
      </View>
      <View style={{ flexDirection: 'row', gap: u(10) }}>
        <Btn label="‹ Doesn’t fit" ghost onPress={() => onEvent({ type: 'SWIPE', fits: false, now: Date.now() })} style={{ flex: 1 }} />
        <Btn label="Fits ›" onPress={() => onEvent({ type: 'SWIPE', fits: true, now: Date.now() })} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export function BossOver({ g, seats, board, onNext }: { g: OfflineGame; seats: Seats; board: Strip; onNext?: () => void }) {
  const l = [...g.log].reverse().find((x) => x.k === 'boss');
  const n = (s: number) => seats.get(s)?.name ?? `Player ${s + 1}`;
  if (!l || l.k !== 'boss') return null;
  const extra = Object.fromEntries(Object.entries(l.points).map(([s, p]) => [Number(s), `Boss ${p}`]));
  const last = g.cycle + 1 >= MAX_ACTS;
  return (
    <View style={{ gap: u(12) }}>
      <Top kicker={`Act ${ROMAN[g.cycle]} · Boss Round`} title={`${l.winners.map(n).join(' and ')} +${l.bonus}`} />
      <T size={13} color={VV.soft}>{l.winners.length > 1 ? `A tie at the top: +${l.bonus} each.` : `Best swiper takes +${l.bonus}.`}</T>
      <Board board={board.map((p) => ({ ...p, me: l.winners.includes(p.seat) }))} extra={extra} />
      {onNext ? <Btn label={last ? 'Final curtain' : `On to Act ${ROMAN[g.cycle + 1]}`} onPress={onNext} /> : null}
    </View>
  );
}
