import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';

import { engine, rank } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { useTicker } from '../engine/useTicker';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { Body, Btn, Card, Ghost, Kick } from '../shell/ui';
import { privateWord } from './engine/engine';
import type { GameAction, GameState, SubtypeChoice } from './engine/types';
import { BigClock, DecisionButtons, Holder, HoldWord, ImposterScreen, PlayerTiles, RoundResult, s as k, type Person } from './kit';
import { act, holderOf, idOf, roundOutcome, seatOf, shiftDeadlines, startOfflineGame, tally } from './offline';

type Saved = { state: GameState; recorded: number };

/** A bookmarked match picks up where it stopped; anything else starts a new one from the setup. */
function resumeOrStart(play: PlayProps['play']): Saved {
  const r = play.resume as Saved | null;
  if (r?.state?.round && r.state.mode === 'offline') return r;
  const seats = play.seats.filter((x) => !x.removed).map((x) => ({ seat: x.seat, name: x.name }));
  return { state: startOfflineGame(seats, (play.settings.style as SubtypeChoice) ?? 'mixed', Number(play.settings.rounds) || 3, Date.now()), recorded: 0 };
}

/**
 * Pass the phone (IM2, Yazan's design section 9): one phone, 3 to 6 players. Words are seen with hold to view,
 * clues are spoken aloud, and the decision and the vote go round the phone, each tap visible. No EXP and
 * nothing to Learn (IM5); every round is one item per player on the results.
 */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const t = useTheme();
  const [st, setSt] = useState<Saved>(() => resumeOrStart(play));
  const ref = useRef<Saved>(st);
  const [paused, setPaused] = useState(false);
  const pausedAt = useRef<number | null>(null);
  const [frozen, setFrozen] = useState<number | null>(null);
  // The word-reveal hand-off: the next player taps "I'm ready" before the hold pad shows.
  const [ready, setReady] = useState<string | null>(null);
  const [seen, setSeen] = useState(false);

  const people: Person[] = useMemo(() => play.seats.filter((x) => !x.removed).map((x) => ({ id: idOf(x.seat), name: x.name, color: x.color })), [play.seats]);
  const by = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  useEffect(() => {
    if (ref.current.recorded === 0 && ref.current.state.roundIndex === 0) engine.recorder.bookmark(play.id, ref.current, 0);
  }, [play.id]);

  const commit = useCallback(
    (next: GameState) => {
      const prev = ref.current;
      // The engine hands back a fresh copy every time; a clock tick that changed nothing is not saved.
      if (next === prev.state || JSON.stringify(next) === JSON.stringify(prev.state)) return;
      let recorded = prev.recorded;
      // Each finished round: one item per player, right when their part went their way (IM5: nothing feeds Learn).
      for (const sum of next.history.slice(recorded)) {
        for (const id of next.players.map((p) => p.id)) {
          recordItem(
            play,
            {
              seat: seatOf(id),
              itemId: sum.pairId,
              answerKey: null,
              outcome: roundOutcome(sum, id),
              answersGiven: [],
              timeMs: 0,
              hintsUsed: 0,
              revealsUsed: 0,
              points: sum.deltas[id] ?? 0,
              feedsLearn: false,
              gameData: { imposter: id === sum.imposterId, words: sum.words, category: sum.category, outcome: sum.outcome },
            },
            true,
          );
        }
        recorded += 1;
      }
      const saved = { state: next, recorded };
      ref.current = saved;
      setSt(saved);
      const owner = next.players.find((p) => p.id === idOf(0))?.score ?? 0;
      engine.recorder.bookmark(play.id, saved, owner);
      if (next.phase.kind === 'matchEnd' && prev.state.phase.kind !== 'matchEnd') {
        const credits = new Map(next.players.map((p) => [seatOf(p.id), p.credits]));
        const rows = next.players.map((p) => ({ seat: seatOf(p.id), name: p.name, score: p.score, timeMs: 0 }));
        // Ties go to the earliest right votes (credits), then the win is shared.
        onFinish(owner, rank(rows, (a, b) => (credits.get(b.seat) ?? 0) - (credits.get(a.seat) ?? 0)));
      }
    },
    [play, onFinish],
  );

  const send = useCallback(
    (a: GameAction) => {
      const cur = ref.current;
      const r = act(cur.state, a, Date.now());
      if (!r.error) commit(r.state);
    },
    [commit],
  );

  const kind = st?.state.phase.kind;
  const timed = !paused && (kind === 'offlineDiscussion' || kind === 'redemption');
  const now = useTicker(timed, 250, (n) => {
    commit(act(ref.current.state, { type: 'TICK' }, n).state);
  });

  const pause = () => {
    if (pausedAt.current == null) pausedAt.current = Date.now();
    setFrozen(pausedAt.current);
    setPaused(true);
  };
  const resume = () => {
    if (pausedAt.current != null) commit(shiftDeadlines(ref.current.state, Date.now() - pausedAt.current));
    pausedAt.current = null;
    setPaused(false);
  };
  const { resume: unhide } = usePauseHide(pause);

  if (!st.state.round || st.state.phase.kind === 'matchEnd') return <ImposterScreen round={1} rounds={1} onPause={pause}>{null}</ImposterScreen>;

  const s = st.state;
  const r = s.round!;
  const ph = s.phase;
  const holder = holderOf(s);
  const hp = holder ? by.get(holder) : undefined;
  const inRound = r.participants.map((id) => by.get(id)).filter((p): p is Person => !!p);
  const left = 'deadline' in ph && typeof ph.deadline === 'number' ? ph.deadline - (paused && frozen ? frozen : now) : 0;

  let body: ReactNode = null;
  let bottom: ReactNode = null;

  if (paused) {
    body = <Body style={{ textAlign: 'center', marginTop: u(40) }}>Paused. The clock is stopped.</Body>;
  } else if (ph.kind === 'wordReveal' && hp) {
    if (ready !== hp.id) {
      body = <Holder lead="Pass the phone to" person={hp} sub="Only you should see the next screen." />;
      bottom = (
        <Btn
          label="I'm ready"
          onPress={() => {
            setReady(hp.id);
            setSeen(false);
          }}
        />
      );
    } else {
      body = (
        <>
          <Holder lead="Your word" person={hp} sub={`Category: ${r.pair.category}. Someone has a different word, and they don't know it. It could be you.`} />
          <HoldWord word={privateWord(s, hp.id) ?? ''} onSeen={() => setSeen(true)} />
        </>
      );
      bottom = <Btn label="Done, pass it on" disabled={!seen} onPress={() => send({ type: 'ACK_WORD', playerId: hp.id })} />;
    }
  } else if (ph.kind === 'offlineTurn') {
    const extra = ph.turn > 2;
    body = (
      <>
        <View style={k.holder}>
          <Kick>{extra ? 'Extra turn' : `Turn ${ph.turn} of 2`}</Kick>
          <Text style={[k.name, { color: t.white }]}>Say one word each</Text>
          <Text style={[k.sub, { color: t.mute }]}>Out loud, in this order. Not your own word, and not a word already said this round.</Text>
        </View>
        <Card>
          {r.order.map((id, i) => {
            const p = by.get(id);
            return (
              <View key={id} style={k.row}>
                <Text style={[k.rowP, { color: t.dim, minWidth: u(18), textAlign: 'left' }]}>{i + 1}</Text>
                <View style={[k.dot, { backgroundColor: p?.color ?? t.soft }]} />
                <Text style={[k.rowN, { color: i === 0 ? t.accent : t.fg }]}>{p?.name}</Text>
                {i === 0 ? <Text style={[k.mark, { color: t.accent }]}>STARTS</Text> : null}
              </View>
            );
          })}
        </Card>
      </>
    );
    bottom = <Btn label={ph.turn >= 2 ? 'Everyone has spoken' : 'Next turn'} onPress={() => send({ type: 'NEXT_TURN', playerId: idOf(0) })} />;
  } else if (ph.kind === 'decision' && hp) {
    body = (
      <>
        <Holder lead="Pass the phone to" person={hp} sub="Vote now, or hear one more turn of clues? Most answers win; a tie means one more turn." />
        <Text style={[k.sub, { color: t.dim }]}>{`${Object.keys(r.decisions).length} of ${r.participants.length} answered`}</Text>
      </>
    );
    bottom = <DecisionButtons onVote={() => send({ type: 'DECIDE', playerId: hp.id, choice: 'vote' })} onExtra={() => send({ type: 'DECIDE', playerId: hp.id, choice: 'extra' })} />;
  } else if (ph.kind === 'offlineDiscussion') {
    body = (
      <>
        <View style={k.holder}>
          <Kick>Discuss</Kick>
          <Text style={[k.name, { color: t.white }]}>Who is the imposter?</Text>
        </View>
        <BigClock ms={left} />
        <Body style={{ textAlign: 'center' }}>Talk it over. Then the phone goes round for the vote.</Body>
      </>
    );
    bottom = <Btn label="Start the vote" onPress={() => send({ type: 'SKIP_DISCUSSION', playerId: idOf(0) })} />;
  } else if (ph.kind === 'vote' && hp) {
    const cands = r.candidates;
    body = (
      <>
        <Holder lead={cands ? 'Revote: pass the phone to' : 'Pass the phone to'} person={hp} sub={cands ? 'A tie. Vote again between the tied players. Your vote is final.' : 'Tap who you think is the imposter. Everyone can see the votes. Your vote is final.'} />
        <PlayerTiles people={inRound} votes={tally(s)} pickable={(id) => id !== hp.id && (!cands || cands.includes(id))} onPick={(id) => send({ type: 'CAST_VOTE', playerId: hp.id, target: id })} mark={{ [hp.id]: 'YOU' }} />
      </>
    );
  } else if (ph.kind === 'redemption' && hp) {
    const imp = by.get(r.imposterId)!;
    const theirs = r.pair[r.imposterSide === 'a' ? 'b' : 'a'].word;
    body = (
      <>
        <Holder lead="Caught" person={imp} sub={`${imp.name}, say your guess for everyone else's word, out loud. One try.`} />
        <BigClock ms={left} warnAt={5_000} />
        <Card>
          <Kick>{`${hp.name} decides`}</Kick>
          <HoldWord word={theirs} label="Hold to check the word" small />
        </Card>
      </>
    );
    bottom = (
      <View style={{ gap: u(8) }}>
        <Btn label="Right guess" onPress={() => send({ type: 'CONFIRM_GUESS', playerId: hp.id, correct: true })} />
        <Ghost label="Wrong guess" onPress={() => send({ type: 'CONFIRM_GUESS', playerId: hp.id, correct: false })} />
      </View>
    );
  } else if (ph.kind === 'roundResult') {
    const last = s.roundIndex + 1 >= (s.config?.rounds ?? 1);
    body = <RoundResult sum={ph.summary} people={inRound} totals={s.players.map((p) => ({ id: p.id, score: p.score }))} />;
    bottom = <Btn label={last ? 'See results' : 'Next round'} onPress={() => send({ type: 'NEXT_ROUND', playerId: idOf(0) })} />;
  }

  return (
    <ImposterScreen round={r.index + 1} rounds={s.config?.rounds ?? 1} category={ph.kind === 'roundResult' || paused ? null : r.pair.category} onPause={pause} bottom={bottom}>
      {body}
      <PauseMenu
        open={paused}
        mode="offline"
        onResume={() => {
          unhide();
          resume();
        }}
        onQuit={onQuit}
      />
    </ImposterScreen>
  );
}
