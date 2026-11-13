import { COIN } from '@/components/CoinLabel';
import { useCallback, useEffect, useRef, useState } from 'react';

import { sfxVerdict } from '@/lib/sound';
import { u } from '@/theme/scale';

import { engine } from '../engine';
import { clock as clockText } from '../engine/clock';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { GameScreen } from '../shell/ui';
import { CaseView } from './CaseView';
import { STF, caseExp, casePoints, doubleWrong, gameScore, lock, startCase, timeUp, takeFifty, takeHighlight, type CaseRun } from './core';
import { caseById } from './data';
import { dealCases } from './deal';
import { caseItem } from './items';
import { Btn, Explain, Pill, StfSky, TopLine } from './Paper';
import { tr } from '@/i18n';

/** One case's result in this game. */
type Done = { points: number; exp: number; doubles: number; ms: number };
/** Solo bookmark: the cases, where you are and the time spent on this case. */
type Save = { cases: string[]; index: number; run: CaseRun; done: Done[]; ms: number };

/** Solo (Yazan's cards 2026-11-12): 1, 3 or 5 cases, each with 50/50 and Highlight to buy with tokens. */
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
      engine.recorder.bookmark(play.id, next, gameScore(next.done.map((d) => d.points)));
    },
    [play.id],
  );

  // Start, or carry on from the bookmark.
  useEffect(() => {
    let live = true;
    (async () => {
      const saved = play.resume as Save | null;
      const ok = saved?.cases?.length && saved.cases.every((id) => caseById.has(id));
      const next: Save = ok ? saved! : { cases: await dealCases(play), index: 0, run: startCase(Math.random), done: [], ms: 0 };
      if (live) put(next);
    })();
    return () => {
      live = false;
    };
  }, [play, put]);

  // The case clock: counts while the case is open and the game isn't paused.
  const [live, setLive] = useState(0);
  const since = useRef<number | null>(null);
  const playing = !!save && save.run.stage !== 'done' && !paused;
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

  /** Moves the case on; when it ends, it is recorded. */
  const step = useCallback(
    (run: CaseRun) => {
      const cur = ref.current;
      if (!cur) return;
      const ms = cur.ms + (since.current != null ? Date.now() - since.current : 0);
      if (since.current != null) since.current = Date.now();
      let next: Save = { ...cur, run, ms };
      if (run.stage === 'done' && cur.run.stage !== 'done') {
        const id = cur.cases[cur.index];
        const points = casePoints(caseById.get(id)!.lv, run);
        next = { ...next, done: [...cur.done, { points, exp: caseExp(points), doubles: doubleWrong(run) ? 1 : 0, ms }] };
        void sfxVerdict(run.timeUp && run.pick1 === -1 ? 'timeup' : points > 0);
        void recordItem(play, caseItem(id, run, { index: cur.index, learn: true, ms }), true);
      }
      put(next);
      setLive(0);
    },
    [play, put],
  );

  // Time up: what is not locked counts as wrong.
  useEffect(() => {
    if (limitMs && save && save.run.stage !== 'done' && spent >= limitMs) step(timeUp(save.run));
  }, [limitMs, save, spent, step]);

  // Help is paid in tokens (Yazan 2026-11-12), once each a case; a failed step gives them back.
  const [helpNote, setHelpNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const buy = async (cost: number, reason: string, apply: (r: CaseRun) => CaseRun) => {
    const cur = ref.current;
    if (!cur || busy) return;
    setBusy(true);
    try {
      const receipt = await engine.wallet.spend(cost, reason, play.id);
      if (!receipt) return setHelpNote(tr('This help costs {cost} tokens. Each level up gives 1 token.', { cost }));
      const now = ref.current;
      const next = now && now.run.stage !== 'done' ? apply(now.run) : null;
      if (!now || !next || next === now.run) return void engine.wallet.refund(receipt);
      setHelpNote(null);
      step(next);
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    const done = ref.current?.done ?? [];
    if (!done.length) {
      void engine.recorder.discard(play.id);
      return onQuit();
    }
    onFinish(gameScore(done.map((d) => d.points)));
  };

  if (!save) return <GameScreen scroll={false} under={<StfSky />}>{null}</GameScreen>;
  const c = caseById.get(save.cases[save.index])!;
  const run = save.run;
  const total = save.cases.length;
  const kicker = total > 1 ? tr('Case {n} of {total}', { n: save.index + 1, total }) : tr('One case');
  const score = gameScore(save.done.map((d) => d.points));
  const menuEl = <PauseMenu open={menu} mode="solo" onResume={() => (setMenu(false), resume())} onQuit={() => (save.done.length > save.index ? finish() : onQuit())} />;

  if (run.stage === 'done') {
    const last = save.index + 1 >= total;
    return (
      <GameScreen scroll={false} under={<StfSky />} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), paddingBottom: u(14), gap: u(10) }}>
        <TopLine kicker={run.timeUp ? tr('{kicker} · Time up', { kicker }) : kicker} right={<Pill text={tr('{score} pts', { score })} />} />
        <Explain c={c} run={run} foot={<Btn label={last ? tr('See results') : tr('Next case')} go onPress={() => (last ? finish() : (setHelpNote(null), put({ ...save, index: save.index + 1, run: startCase(Math.random), ms: 0 })))} />} />
        {menuEl}
      </GameScreen>
    );
  }

  const left = limitMs ? Math.max(0, limitMs - spent) : null;
  return (
    <GameScreen scroll={false} under={<StfSky />} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), paddingBottom: u(14) }}>
      <CaseView
        c={c}
        run={run}
        locked={paused || busy}
        top={<TopLine kicker={kicker} right={<Pill text={left != null ? clockText(left, { down: true }) : tr('{score} pts', { score })} warn={left != null && left < 15_000} />} />}
        onLock={(pick) => step(lock(run, pick))}
        help={{
          fifty: { label: run.fifty ? tr('50/50 used') : `50/50 · ${STF.fiftyCost}${COIN}`, onPress: () => void buy(STF.fiftyCost, 'stf_fifty', (r) => takeFifty(r, Math.random)), disabled: !!run.fifty || busy },
          highlight: { label: run.highlight ? tr('Highlighted') : tr('Highlight · {highlightCost}{COIN}', { highlightCost: STF.highlightCost, COIN }), onPress: () => void buy(STF.highlightCost, 'stf_highlight', takeHighlight), disabled: run.highlight || busy },
          note: helpNote,
        }}
      />
      {menuEl}
    </GameScreen>
  );
}
