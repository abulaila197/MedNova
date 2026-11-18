import { useCallback, useEffect, useRef, useState } from 'react';

import { tr } from '@/i18n';
import { sfxVerdict } from '@/lib/sound';

import { engine } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { Btn, GameScreen } from '../shell/ui';
import { helpLabels, missNote, OrderBoard } from './Board';
import { ORDER, move, placeStep, removeDecoy, runPoints, startRun, submit, worthNow, type QRun, type Target } from './core';
import { questionById } from './data';
import { countOf, dealQuestions } from './deal';
import { questionItem } from './items';
import { OrderResult } from './Result';

/** Solo bookmark: the questions, where you are, your run and the time spent on this question. */
type Save = { ids: string[]; index: number; run: QRun; points: number[]; ms: number };

/** Solo (Yazan 2026-11-18): 3, 5 or 10 questions, no clock limit; speed adds up to 20 points. Paid helpers, once each a question. */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const [save, setSave] = useState<Save | null>(null);
  const ref = useRef<Save | null>(null);
  const [menu, setMenu] = useState(false);
  const { hidden, resume } = usePauseHide(() => setMenu(true));
  const paused = menu || hidden;

  const put = useCallback(
    (next: Save) => {
      ref.current = next;
      setSave(next);
      engine.recorder.bookmark(play.id, next, next.points.reduce((a, b) => a + b, 0));
    },
    [play.id],
  );

  useEffect(() => {
    let live = true;
    (async () => {
      const saved = play.resume as Save | null;
      const ok = saved?.ids?.length && saved.ids.every((id) => questionById.has(id)) && saved.run?.slots;
      const ids = ok ? saved!.ids : await dealQuestions(play, countOf(play.settings));
      const next: Save = ok ? saved! : { ids, index: 0, run: startRun(questionById.get(ids[0])!, Math.random), points: [], ms: 0 };
      if (live) put(next);
    })();
    return () => {
      live = false;
    };
  }, [play, put]);

  // The clock counts while the question is open and the game isn't paused.
  const [live, setLive] = useState(0);
  const since = useRef<number | null>(null);
  const playing = !!save && !save.run.done && !paused;
  useEffect(() => {
    if (!playing) return;
    since.current = Date.now();
    const id = setInterval(() => setLive(since.current != null ? Date.now() - since.current : 0), 500);
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

  /** Applies a change to the open question; when it ends, it is recorded. */
  const step = useCallback(
    (run: QRun) => {
      const cur = ref.current;
      if (!cur || run === cur.run) return;
      const ms = cur.ms + (since.current != null ? Date.now() - since.current : 0);
      if (since.current != null) since.current = Date.now();
      let next: Save = { ...cur, run, ms };
      if (run.done && !cur.run.done) {
        const id = cur.ids[cur.index];
        const pts = runPoints(run, ms);
        next = { ...next, points: [...cur.points, pts] };
        void sfxVerdict(run.solved);
        void recordItem(play, questionItem(id, run, { index: cur.index, learn: true, ms }), true);
      } else if (run.miss > cur.run.miss) void sfxVerdict(false);
      put(next);
      setLive(0);
    },
    [play, put],
  );

  // Paid helpers (tokens), once each a question; a failed step gives them back.
  const [helpNote, setHelpNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const buy = async (cost: number, reason: string, apply: (r: QRun) => QRun) => {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      const receipt = await engine.wallet.spend(cost, reason, play.id);
      if (!receipt) return setHelpNote(tr('This help costs {cost} tokens. Each level up gives 1 token.', { cost }));
      const now = ref.current;
      const next = now && !now.run.done ? apply(now.run) : null;
      if (!now || !next || next === now.run) return void engine.wallet.refund(receipt);
      setHelpNote(null);
      step(next);
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    const done = ref.current?.points ?? [];
    if (!done.length) {
      void engine.recorder.discard(play.id);
      return onQuit();
    }
    onFinish(done.reduce((a, b) => a + b, 0));
  };

  if (!save) return <GameScreen scroll={false}>{null}</GameScreen>;
  const id = save.ids[save.index];
  const q = questionById.get(id)!;
  const run = save.run;
  const total = save.ids.length;
  const title = tr('Question {n}', { n: save.index + 1 });
  const sub = tr('of {n}', { n: total });
  const score = save.points.reduce((a, b) => a + b, 0);
  const menuEl = <PauseMenu open={menu} mode="solo" onResume={() => (setMenu(false), resume())} onQuit={() => (save.points.length > save.index ? finish() : onQuit())} />;

  if (run.done) {
    const last = save.index + 1 >= total;
    const nextQ = () => {
      setHelpNote(null);
      const nid = save.ids[save.index + 1];
      put({ ...save, index: save.index + 1, run: startRun(questionById.get(nid)!, Math.random), ms: 0 });
    };
    return (
      <OrderResult q={q} run={run} ms={save.ms} title={tr('Question {n} of {total} · {score} pts', { n: save.index + 1, total, score })} foot={<Btn label={last ? tr('See results') : tr('Next question')} onPress={() => (last ? finish() : nextQ())} />}>
        {menuEl}
      </OrderResult>
    );
  }

  const labels = helpLabels(run);
  return (
    <OrderBoard
      key={id}
      q={q}
      run={run}
      title={title}
      sub={sub}
      clock={{ label: tr('Clock'), ms: spent }}
      worth={worthNow(run, spent)}
      locked={paused || busy}
      hidden={hidden}
      onPause={() => setMenu(true)}
      onMove={(card: number, to: Target) => step(move(ref.current!.run, card, to))}
      onSubmit={() => step(submit(ref.current!.run))}
      note={helpNote ? { text: helpNote, tone: 'bad' } : missNote(run)}
      help={{
        place: { label: labels.place, disabled: run.placeUsed || busy, onPress: () => void buy(ORDER.placeCost, 'order_place', (r) => placeStep(r, Math.random)) },
        decoy: { label: labels.decoy, disabled: run.decoyUsed || busy, onPress: () => void buy(ORDER.decoyCost, 'order_decoy', (r) => removeDecoy(q, r, Math.random)) },
      }}>
      {menuEl}
    </OrderBoard>
  );
}
