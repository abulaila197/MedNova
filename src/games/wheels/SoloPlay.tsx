import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { u } from '@/theme/scale';

import { engine } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import type { PlayProps } from '../shell/types';
import { isNoClock } from '../shell/clockOption';
import { tickedFields } from '../shell/fields';
import { STYLES, fieldName, mixWith, type Mix, type QResult, type SoloRun, type Target } from './core';
import { bossBonus, roundsIn } from './offline';
import { BossBoard, RedemptionBoard, type Seats } from './OfflinePlay';
import { asSoloGame, canRedeem, missedPoints, SOLO_BOSS_PER, startSoloGame, stepSoloGame, type SoloGame, type SoloGameEvent } from './solo';
import { BANK } from './data';
import { PauseMenu } from '../shell/PauseMenu';
import { TurnBoard } from './TurnBoard';
import { Btn, CB, CD, Kicker, Panel, ROMAN, Rule, T, VelvetScreen, VV } from './velvet';
import { useTicker } from '../engine/useTicker';
import { gameShown } from './shown';
import { tr } from '@/i18n';

/** The saved game has its clocks stopped, so resuming later picks up with the same time left (rules 7, 10). */
const snapshot = (g: SoloGame, now: number): SoloGame => stepSoloGame(g, { type: 'PAUSE', now }, BANK, Math.random);
const SEATS: Seats = new Map([[0, { name: 'You' }]]);

/**
 * Solo (WC1, WC11): spin and answer, turn after turn, until the target. Since 2026-11-12 (Yazan) each act ends in a
 * Boss Round and once a game a turn with a miss can be followed by a Redemption round (solo.ts).
 */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const target = (Number(play.settings.target) || 50) as Target;
  const mix = mixWith((play.settings.mix as Mix) || 'mixed', tickedFields(play.settings));
  // The saved game (its clocks started again), or a new one.
  const [first] = useState(() => {
    const saved = play.resume as { game?: SoloGame; run?: SoloRun } | null;
    const was = saved?.game ?? saved?.run ?? null;
    if (was) return { game: stepSoloGame(asSoloGame(was), { type: 'RESUME', now: Date.now() }, BANK, Math.random), fresh: false };
    return { game: startSoloGame(BANK, target, Math.random, mix, isNoClock(play.settings)), fresh: true };
  });
  const [game, setGame] = useState<SoloGame>(first.game);
  const ref = useRef<SoloGame>(first.game);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (first.fresh) engine.recorder.bookmark(play.id, { game: snapshot(first.game, Date.now()) }, 0);
  }, [first, play.id]);

  const record = useCallback(
    (rs: QResult[]) => {
      for (const r of rs)
        recordItem(play, {
          seat: 0, itemId: r.id, answerKey: null, outcome: r.right ? 'right' : r.answer == null ? 'timed_out' : 'wrong', answersGiven: [], timeMs: 0,
          hintsUsed: 0, revealsUsed: 0, points: r.points, feedsLearn: true, // #39a (2026-10-31): misses go to Learn (was WC7: nothing)
          gameData: { style: r.style, field: r.field },
        });
    },
    [play],
  );

  const dispatch = useCallback(
    (e: SoloGameEvent) => {
      const prev = ref.current;
      if (!prev) return;
      const next = stepSoloGame(prev, e, BANK, Math.random);
      if (next === prev) return;
      ref.current = next;
      setGame(next);
      engine.recorder.bookmark(play.id, { game: snapshot(next, Date.now()) }, next.run.score);
      const before = prev.run.turnNo === next.run.turnNo ? (prev.run.turn?.results.length ?? 0) : 0;
      record(next.run.turn?.results.slice(before) ?? []);
      if (next.run.phase === 'done' && prev.run.phase !== 'done') onFinish(next.run.score);
    },
    [play, record, onFinish],
  );
  const run = game.run;

  // The clock: ticks while a timer runs (question, the right/wrong moment, Boss Round, Redemption).
  const timed = !paused && ((game.stage === 'run' && run.phase === 'turn' && run.turn?.until != null) || (game.stage === 'boss' && game.boss?.until != null) || (game.stage === 'redemption' && game.redemption?.until != null));
  // The screen redraws when the bulbs it shows change, not on every tick.
  const now = useTicker(
    timed,
    150,
    (n) => {
      const g = ref.current;
      if (g.stage === 'boss') dispatch({ type: 'BOSS', e: { type: 'TICK', now: n } });
      else if (g.stage === 'redemption') dispatch({ type: 'RED', e: { type: 'TICK', now: n } });
      else dispatch({ type: 'RUN', e: { type: 'TICK', now: n } });
    },
    { shown: (n) => gameShown({ turn: ref.current.stage === 'run' ? ref.current.run.turn : null, boss: ref.current.boss, redemption: ref.current.redemption }, n) },
  );

  const pause = () => {
    setPaused(true);
    dispatch({ type: 'PAUSE', now: Date.now() });
  };
  usePauseHide(pause);

  const resume = () => {
    setPaused(false);
    dispatch({ type: 'RESUME', now: Date.now() });
  };
  const bossLine = tr('Every {SOLO_BOSS_PER} Boss points is +1, up to +{n}.', { SOLO_BOSS_PER, n: bossBonus(target) });
  const missed = missedPoints(game);

  return (
    <>
      <VelvetScreen>
        {game.stage === 'boss' && game.boss ? (
          <BossBoard g={{ boss: game.boss, cycle: game.act, target }} seat={0} now={now} seats={SEATS} solo={bossLine} onEvent={(e) => dispatch({ type: 'BOSS', e })} onPause={pause} hidden={paused} />
        ) : game.stage === 'redemption' && game.redemption ? (
          <RedemptionBoard g={{ redemption: game.redemption }} now={now} seats={SEATS} solo={tr('True or false, as fast as you can. Each right call wins back 1 of the {missed} points you missed, up to all of them.', { missed })} onEvent={(e) => dispatch({ type: 'RED', e })} onPause={pause} hidden={paused} />
        ) : game.stage === 'bossOver' || game.stage === 'redOver' ? (
          <Extra game={game} onNext={() => dispatch({ type: 'ON' })} />
        ) : run.phase === 'turn' && run.turn ? (
          <TurnBoard
            turn={run.turn}
            now={now}
            kicker={tr('Solo · Act {n} · Turn {inAct} of {roundsIn}', { n: ROMAN[game.act], inAct: game.inAct, roundsIn: roundsIn(game.act) })}
            title={tr('{score} of {target}', { score: run.score, target })}
            strip={[{ seat: 0, name: 'You', score: run.score, me: true }]}
            onEvent={(e) => dispatch({ type: 'RUN', e })}
            onPause={pause}
            hidden={paused}
          />
        ) : run.turn ? (
          <TurnOver
            game={game}
            boss={game.inAct >= roundsIn(game.act)}
            redeem={canRedeem(game) ? missed : 0}
            onRedeem={() => dispatch({ type: 'REDEEM' })}
            onNext={() => dispatch({ type: 'RUN', e: { type: 'NEXT' } })}
            onEnd={() => dispatch({ type: 'RUN', e: { type: 'END' } })}
          />
        ) : null}
      </VelvetScreen>
      <PauseMenu open={paused} mode="solo" onResume={resume} onQuit={onQuit} />
    </>
  );
}

/** After a Boss Round or a Redemption: what it added. */
function Extra({ game, onNext }: { game: SoloGame; onNext: () => void }) {
  const x = game.extra;
  const boss = x?.k === 'boss';
  return (
    <View style={{ flex: 1, gap: u(12) }}>
      <View style={{ gap: u(2) }}>
        <Kicker>{boss ? tr('Act {n} · Boss Round', { n: ROMAN[game.act] }) : tr('Redemption')}</Kicker>
        <T f={CD} size={26}>{x?.points ? tr('+{points} points', { points: x.points }) : tr('No points this time')}</T>
      </View>
      <Panel>
        <T size={13} color={VV.soft}>{boss ? tr('{n} Boss points: every {SOLO_BOSS_PER} is +1, up to +{bossBonus}.', { n: x?.of ?? 0, SOLO_BOSS_PER, bossBonus: bossBonus(game.run.target) }) : tr('{n} right calls won back {n2} points.', { n: x?.of ?? 0, n2: x?.points ?? 0 })}</T>
        <Rule />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T f={CB} size={12} color={VV.dim} style={{ letterSpacing: u(1.2) }}>{tr('SCORE')}</T>
          <T f={CD} size={22} color={VV.gold}>{`${game.run.score} / ${game.run.target}`}</T>
        </View>
      </Panel>
      <View style={{ flex: 1 }} />
      <Btn label={boss ? tr('On to Act {n}', { n: ROMAN[game.act + 1] ?? game.act + 2 }) : tr('Back to my turn')} onPress={onNext} />
    </View>
  );
}

/** Between turns: what this turn earned and how far the target is. */
function TurnOver({ game, boss, redeem, onRedeem, onNext, onEnd }: { game: SoloGame; boss: boolean; redeem: number; onRedeem: () => void; onNext: () => void; onEnd: () => void }) {
  const run = game.run;
  const t = run.turn!;
  const pts = t.results.reduce((a, r) => a + r.points, 0);
  return (
    <View style={{ flex: 1, gap: u(12) }}>
      <View style={{ gap: u(2) }}>
        <Kicker>{tr('Solo · Act {n} · Turn {inAct} of {n2}', { n: ROMAN[game.act], inAct: game.inAct, n2: roundsIn(game.act) })}</Kicker>
        <T f={CD} size={26}>{pts ? tr('+{pts} points', { pts }) : tr('No points this turn')}</T>
      </View>
      <Panel>
        {t.results.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: u(9) }}>
            <T f={CB} size={13} color={r.right ? VV.right : VV.wrong} style={{ width: u(16) }}>{r.right ? '✓' : '✕'}</T>
            <T size={13} style={{ flex: 1 }}>{`${tr(STYLES[r.style].name)} · ${fieldName(r.field)}`}</T>
            <T f={CB} size={13} color={VV.soft}>{String(r.points)}</T>
          </View>
        ))}
        <Rule />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T f={CB} size={12} color={VV.dim} style={{ letterSpacing: u(1.2) }}>{tr('SCORE')}</T>
          <T f={CD} size={22} color={VV.gold}>{`${run.score} / ${run.target}`}</T>
        </View>
        <View style={{ height: u(6), borderRadius: u(3), backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(100, (run.score / run.target) * 100)}%`, height: '100%', backgroundColor: VV.brass }} />
        </View>
      </Panel>
      <View style={{ flex: 1 }} />
      {/* Once a game, after a turn with a miss (Yazan 2026-11-12). */}
      {redeem ? <Btn label={tr('Redemption: win back up to {redeem}', { redeem })} paper onPress={onRedeem} /> : null}
      <Btn label={boss ? tr('On to the Boss Round') : tr('Spin again')} onPress={onNext} />
      <Btn label={tr('Finish here')} ghost onPress={onEnd} />
    </View>
  );
}
