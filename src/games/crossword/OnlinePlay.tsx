import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { call } from '@/online/api';
import { AlertPill, Countdown, useAlerts } from '@/online/live';
import { settingsLine } from '@/online/format';
import { useRace, type RacePlayer, type RaceState } from '@/online/race';
import { RaceReveal } from '@/online/RaceReveal';
import { RoomTalk } from '@/online/Talk';
import { useTheme } from '@/state/app';
import { u, useScreen } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { characterOf } from '../shell/characters';
import { PauseMenu } from '../shell/PauseMenu';
import { presetTeam } from '../shell/teams';
import type { OnlineProps } from '../shell/types';
import { GameScreen, Ghost } from '../shell/ui';
import { AppGrid, AppPopup, AppTopBar } from './AppLook';
import { CW, buildSlots, composeAnswer, indexOf, isFilled, lockedCells, placeLetter, removeSlot, type CellPos, type PuzzleDef, type Typed } from './core';
import { PUZZLES, clueText } from './data';
import { ReviveCard } from './OfflinePlay';
import { clock } from '@/games/engine/clock';

const puzzleOf = (n: number) => PUZZLES[n - 1];

/** CW12: stars by rank (1st 3, 2nd 2, the rest 1), only for players who claimed a word; 4 EXP a star. */
export const onlineStars = (rank: number, words: number) => (words < 1 ? 0 : rank <= 1 ? 3 : rank === 2 ? 2 : 1);

/** Each word is one item. Yours = right; the rest are misses, and Learn gets the ones you got wrong or nobody claimed (CW1). */
function itemsOf(me: string) {
  return (st: RaceState) => {
    const p = puzzleOf(st.item ?? st.my_items?.[0]?.item ?? 1);
    const by = new Map((st.claims ?? []).map((c) => [c.word_id, c]));
    const mine = st.players.find((x) => x.user_id === me);
    const words = (st.claims ?? []).filter((c) => c.user_id === me).length;
    const stars = onlineStars(mine?.rank ?? st.players.length, words);
    const nameOf = new Map(st.players.map((x) => [x.user_id, x.name]));
    return p.words.map((w, i) => {
      const c = by.get(w.id);
      const tried = st.tried?.[w.id] ?? [];
      const right = c?.user_id === me;
      return {
        seat: 0,
        itemId: w.id,
        answerKey: w.dossier ?? null,
        outcome: right ? ('right' as const) : ('wrong' as const),
        answersGiven: tried,
        timeMs: c?.at_ms ?? 0,
        hintsUsed: 0,
        revealsUsed: 0,
        points: right ? w.answer.length : 0,
        feedsLearn: !right && (!c || tried.length > 0),
        // The match's EXP rides on the first word, like Solo stores a puzzle's EXP on its first word (CW9).
        gameData: { level: p.level, answer: w.answer, clue: clueText(w), category: w.category, claimedBy: c ? nameOf.get(c.user_id) ?? null : null, room: st.room_id, ...(i === 0 ? { exp: stars * CW.expPerStar, stars } : null) },
      };
    });
  };
}

/**
 * Nova Crossword Online (CW6, CW7, CW10-CW12): everyone races the same random grid. The first right answer claims the
 * word and its letters; a wrong answer costs one of 5 hearts. One token revive per player. The server referees.
 */
export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const t = useTheme();
  const { width } = useScreen();
  const W = Math.min(width, 430);
  const toItems = useMemo(() => itemsOf(me), [me]);
  const { st, load, server, playing, notice, setNotice, leave } = useRace(def, roomId, matchId, me, toItems);
  const [menu, setMenu] = useState(false);
  const [typing, setTyping] = useState(false);
  const { alert, push } = useAlerts();
  const seen = useRef<{ claims: Set<string>; leader: string | null; out: Set<string> } | null>(null);

  const teams = Number(st?.settings.teams) || 0;
  const colorOf = (p: RacePlayer | undefined) => (!p ? t.accent : teams >= 2 && p.team != null ? presetTeam(p.team).color : (characterOf(p.character)?.ring ?? t.accent));

  // CW7 alerts: "Sara claimed ANEMIA", "Omar takes the lead", "Lina is out of hearts".
  useEffect(() => {
    if (!st || st.phase !== 'case' || st.item == null) return;
    const p = puzzleOf(st.item);
    const byId = new Map(st.players.map((x) => [x.user_id, x]));
    const claims = st.claims ?? [];
    const leaders = [...st.players].filter((x) => !x.dropped).sort((a, b) => b.score - a.score || a.solve_ms - b.solve_ms);
    const leader = leaders[0]?.score ? leaders[0].user_id : null;
    const outNow = new Set(st.players.filter((x) => (x.hearts ?? CW.hearts) <= 0).map((x) => x.user_id));
    if (!seen.current) {
      seen.current = { claims: new Set(claims.map((c) => c.word_id)), leader, out: outNow };
      return;
    }
    const was = seen.current;
    for (const c of claims) {
      if (was.claims.has(c.word_id)) continue;
      was.claims.add(c.word_id);
      const who = byId.get(c.user_id);
      if (c.user_id !== me && !c.auto && who) push(`${who.name} claimed ${indexOf(p).wordById.get(c.word_id)?.answer ?? 'a word'}`, colorOf(who));
    }
    if (leader && leader !== was.leader && leaders[0].score > (leaders[1]?.score ?? 0)) {
      const who = byId.get(leader)!;
      // A claim alert of the same moment goes first; the lead change follows it.
      setTimeout(() => push(leader === me ? 'You take the lead' : `${who.name} takes the lead`, colorOf(who)), was.claims.size ? 2100 : 0);
    }
    was.leader = leader ?? was.leader;
    for (const id of outNow) if (!was.out.has(id) && id !== me) push(`${byId.get(id)?.name ?? 'Someone'} is out of hearts`, '#f5b041');
    was.out = outNow;
  }, [st, me, push]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!st) return <GameScreen scroll={false}>{null}</GameScreen>;
  if (st.phase === 'countdown' || st.item == null) {
    return (
      <GameScreen scroll={false}>
        <Countdown ms={st.phase_ends_at - server} faces={st.players.map((p) => p.character)} line={settingsLine(def, st.settings)} />
      </GameScreen>
    );
  }

  const p = puzzleOf(st.item);
  const mine = st.players.find((x) => x.user_id === me);
  const talker = { id: me, name: mine?.name ?? 'You', face: mine?.character ?? 'yara' };
  const byUser = new Map(st.players.map((x) => [x.user_id, x]));
  const claimsList = st.claims ?? [];
  const claims = Object.fromEntries(claimsList.map((c) => [c.word_id, colorOf(byUser.get(c.user_id))]));
  const solved = claimsList.map((c) => c.word_id);
  const left = p.words.length - solved.length;
  const reveal = st.phase !== 'case';
  const hearts = mine?.hearts ?? CW.hearts;
  const out = hearts <= 0;
  const canRevive = playing && out && !mine?.revived && !st.me?.done;
  const wordsOf = (id: string) => claimsList.filter((c) => c.user_id === id).length;
  const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - server) / 1000));
  const sub = reveal ? (left ? 'Time up' : 'Grid complete') : `${clock(st.phase_ends_at - server, { down: true })} left · ${mine?.revived ? 'revive used' : 'first right answer claims it'}`;

  const board = (
    <View style={s.lead}>
      {[...st.players]
        .filter((x) => !x.dropped)
        .sort((a, b) => b.score - a.score)
        .map((x) => (
          <View key={x.user_id} style={[s.chip, { borderColor: colorOf(x) }]}>
            <Text style={[s.chipT, { color: t.fg }]} numberOfLines={1}>{x.user_id === me ? 'You' : x.name}</Text>
            <Text style={[s.chipN, { color: t.white }]}>{x.score}</Text>
          </View>
        ))}
    </View>
  );

  return (
    <GameScreen scroll={false} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), gap: u(10) }}>
      <AppTopBar kicker={`${left} ${left === 1 ? 'word' : 'words'} left`} title="The race" sub={sub} hearts={hearts} score={mine?.score ?? 0} onPause={() => setMenu(true)} />
      {board}
      {!reveal && playing && !out && !menu ? (
        <Race onTyping={setTyping} puzzle={p} matchId={matchId} solved={solved} claims={claims} tried={st.tried ?? {}} hearts={hearts} width={W} load={load} claimerOf={(id) => byUser.get(claimsList.find((c) => c.word_id === id)?.user_id ?? '')?.name} />
      ) : (
        <>
          <AppGrid puzzle={p} solved={solved} claims={claims} width={W - u(32)} />
          {!reveal ? <Text style={[s.tip, { color: t.mute }]}>{!playing ? 'You’re watching. You get a seat at the rematch.' : out && !canRevive ? 'Out of hearts. You’re watching the rest of the race.' : ' '}</Text> : null}
        </>
      )}
      {reveal ? (
        <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, s.dockWrap]}>
          <RaceReveal
            label={left ? 'Time up' : 'Grid complete'}
            answer={`${p.words.length - left} of ${p.words.length} words claimed`}
            players={st.players}
            me={me}
            how={(x) => `${wordsOf(x.user_id)} ${wordsOf(x.user_id) === 1 ? 'word' : 'words'}`}
            next={st.phase === 'done' ? 'Adding up the scores…' : `Results in ${nextIn} s`}
          />
        </Animated.View>
      ) : canRevive && !menu ? (
        <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, s.dockWrap]}>
          <ReviveCard
            playId={matchId}
            name={mine?.name ?? 'You'}
            payer="You"
            text={`No hearts left. One revive per match: ${CW.revivePrice} token gives ${CW.reviveHearts} heart. Your claimed words stay yours.`}
            decline="No revive, watch the rest"
            onRevive={async () => {
              // A failed request throws, so the card refunds the token and says so.
              await call('cw_revive', { m: matchId });
              await load().catch(() => {});
            }}
            onDecline={async () => {
              await call('cw_decline', { m: matchId }).catch(() => {});
              await load();
            }}
          />
        </Animated.View>
      ) : null}
      {notice ? <Text style={[s.tip, { color: t.mute, textAlign: 'center' }]}>{notice}</Text> : null}
      <AlertPill alert={alert} />
      {/* The talk button would sit on the keyboard while a word is open. */}
      {typing && !reveal && playing && !out ? null : <RoomTalk room={roomId} me={talker} />}
      <PauseMenu open={menu} mode="online" onResume={() => setMenu(false)} onQuit={leave} />
    </GameScreen>
  );
}

/** Your side of the race: zoom, open any unclaimed word, answer it. A word someone else claims closes on you. */
function Race({ onTyping, puzzle, matchId, solved, claims, tried, hearts, width, load, claimerOf }: {
  onTyping: (open: boolean) => void; puzzle: PuzzleDef; matchId: string; solved: string[]; claims: Record<string, string>; tried: Record<string, string[]>; hearts: number; width: number;
  load: () => Promise<void>; claimerOf: (wordId: string) => string | undefined;
}) {
  const t = useTheme();
  const idx = indexOf(puzzle);
  const [zoom, setZoom] = useState<CellPos | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [typed, setTyped] = useState<Typed>([]);
  const [line, setLine] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const busy = useRef(false);
  const locked = lockedCells(idx, solved);
  const slots = word ? buildSlots(idx, word, locked) : [];

  // Someone else claimed the open word: close it and say who.
  useEffect(() => {
    if (!word || !solved.includes(word) || busy.current) return;
    const who = claimerOf(word);
    setWord(null);
    setLine(who ? `${who} claimed it first.` : null);
  }, [solved, word, claimerOf]);

  const openWord = (id: string) => {
    setWord(id);
    setTyped(buildSlots(idx, id, locked).map(() => null));
    setLine(null);
  };

  const tapCell = (cell: CellPos) => {
    if (!zoom) return setZoom(cell);
    const ids = (idx.wordsAt.get(`${cell.r},${cell.c}`) ?? []).filter((id) => !solved.includes(id));
    if (!ids.length) return;
    const i = word ? ids.indexOf(word) : -1;
    openWord(ids[(i + 1) % ids.length]);
  };

  const submit = async (next: Typed) => {
    if (!word || busy.current) return;
    const answer = composeAnswer(slots, next);
    const clear = () => setTyped(slots.map(() => null));
    if ((tried[word] ?? []).includes(answer)) {
      setLine('You already tried that one.');
      clear();
      return setShake((x) => x + 1);
    }
    busy.current = true;
    setLine('Checking…');
    try {
      const res = await call<{ result: string; gained?: number; hearts?: number }>('cw_submit', { m: matchId, word_id: word, answer });
      if (res.result === 'right') {
        setLine(null);
        setWord(null);
        busy.current = false;
        await load();
        return;
      }
      if (res.result === 'taken') {
        busy.current = false;
        await load();
        return;
      }
      setShake((x) => x + 1);
      clear();
      setLine(res.result === 'repeat' ? 'You already tried that one.' : res.result === 'wrong' ? ((res.hearts ?? 0) <= 0 ? 'Not this one. That was your last heart.' : 'Not this one. One heart lost.') : 'The race is over.');
    } catch {
      setLine('Couldn’t send that. Try again.');
      clear();
    }
    busy.current = false;
    await load();
  };

  const key = (k: string) => {
    if (busy.current) return;
    const next = placeLetter(slots, typed, k);
    if (!next) return;
    setTyped(next);
    if (isFilled(slots, next)) submit(next);
  };

  useEffect(() => {
    onTyping(word != null);
    return () => onTyping(false);
  }, [word, onTyping]);

  const sel = word ? idx.wordById.get(word)! : null;
  return (
    <>
      <AppGrid puzzle={puzzle} solved={solved} claims={claims} selected={word} width={width - u(32)} zoom={zoom} onCell={tapCell} onBlank={(c) => !zoom && setZoom(c)} />
      <View style={s.under}>
        <Text style={[s.tip, { color: t.mute, flex: 1 }]}>{line && !sel ? line : zoom ? 'Tap a square to open its word.' : 'Tap part of the grid to zoom in.'}</Text>
        {zoom ? <Ghost label="Zoom out" onPress={() => setZoom(null)} /> : null}
      </View>
      {sel ? (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={[StyleSheet.absoluteFill, s.sheetWrap]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,8,25,0.45)' }]} />
          <AppPopup
            word={sel}
            slots={slots}
            typed={typed}
            width={width}
            notice={line}
            shake={shake}
            onKey={key}
            onSlot={(i) => !busy.current && setTyped(removeSlot(slots, typed, i))}
            onClose={() => !busy.current && setWord(null)}
            foot={
              <View style={[s.foot, { borderColor: t.panelLine }]}>
                <Text style={[s.footT, { color: t.mute }]}>{`${hearts} ${hearts === 1 ? 'heart' : 'hearts'} left · no hints online`}</Text>
                <Pressable onPress={() => !busy.current && setWord(null)} hitSlop={u(6)} accessibilityRole="button" accessibilityLabel="Pick another word">
                  <Text style={[s.footT, { color: t.accent, fontFamily: F.bodySemi }]}>Other word</Text>
                </Pressable>
              </View>
            }
          />
        </Animated.View>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  lead: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6), marginRight: u(34) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: u(6), borderWidth: 1, borderRadius: 999, paddingVertical: u(3), paddingHorizontal: u(9), maxWidth: '48%' },
  chipT: { fontFamily: F.bodySemi, fontSize: u(11), flexShrink: 1 },
  chipN: { fontFamily: F.mono, fontSize: u(11) },
  under: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: u(10), minHeight: u(36) },
  tip: { fontFamily: F.body, fontSize: u(12) },
  sheetWrap: { justifyContent: 'flex-end', zIndex: 5 },
  dockWrap: { justifyContent: 'flex-end', padding: u(16), zIndex: 6 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: u(9), marginTop: u(2), gap: u(10) },
  footT: { fontFamily: F.body, fontSize: u(11.5), flexShrink: 1 },
});
