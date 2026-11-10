import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { YOU } from '@/bots/race/engine';
import { useBotRace } from '@/bots/race/useBotRace';
import { PlayerFace } from '@/features/style/Frame';
import { clock } from '@/games/engine/clock';
import { settingsLine } from '@/match/format';
import { AlertPill, Countdown } from '@/match/live';
import type { RacePlayer, RaceState } from '@/match/race';
import { RaceReveal } from '@/match/RaceReveal';
import { RoomTalk } from '@/match/TalkBar';
import { useTheme } from '@/state/app';
import { u, useScreen } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { sfxVerdict } from '@/lib/sound';

import { engine } from '../engine';
import { playerColour } from '../shell/characters';
import { PauseMenu } from '../shell/PauseMenu';
import { gameDef } from '../shell/registry';
import { presetTeam } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { GameScreen } from '../shell/ui';
import { AppGrid, AppPopup, AppTopBar, TIP, useGridTaps } from './AppLook';
import { CW, buildSlots, composeAnswer, indexOf, isFilled, lockedCells, placeLetter, removeSlot, type PuzzleDef, type Typed } from './core';
import { PUZZLES, clueText } from './data';
import { ReviveCard } from './OfflinePlay';
import { CwRace, showdownStars } from './rivals';

const puzzleOf = (n: number) => PUZZLES[n - 1];
const indexOfPuzzle = new Map(PUZZLES.map((p, i) => [p.id, i + 1]));

/**
 * Each word is one item. Yours = right; the rest are misses, and Learn gets the ones you got wrong or nobody claimed
 * (CW1). Each puzzle's stars go by your place on it, so EXP adds up over 2 or 3 puzzles (Yazan, 2026-10-25).
 */
function itemsOf(st: RaceState) {
  const by = new Map((st.claims ?? []).map((c) => [c.word_id, c]));
  const nameOf = new Map(st.players.map((x) => [x.user_id, x.name]));
  return (st.my_items ?? []).flatMap((m) => {
    const p = puzzleOf(m.item);
    if (!p) return [];
    const words = p.words.filter((w) => by.get(w.id)?.user_id === YOU).length;
    const stars = showdownStars(m.rank ?? st.players.length, words);
    return p.words.map((w, i) => {
      const c = by.get(w.id);
      const tried = st.tried?.[w.id] ?? [];
      const right = c?.user_id === YOU;
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
        // Each puzzle's EXP rides on its first word, like Solo stores a puzzle's EXP on its first word (CW9).
        gameData: { level: p.level, answer: w.answer, clue: clueText(w), category: w.category, claimedBy: c ? (c.user_id === YOU ? 'You' : (nameOf.get(c.user_id) ?? null)) : null, ...(i === 0 ? { exp: stars * CW.expPerStar, stars } : null) },
      };
    });
  });
}

/**
 * Grid showdown (Nova Crossword vs rivals, G5): everyone races the same grid. The first right answer claims the
 * word and its letters; a wrong answer costs one of 5 hearts. One token revive per puzzle. A rival never takes the
 * word you are typing.
 */
export function BotsPlay({ play, onFinish, onQuit }: PlayProps) {
  const t = useTheme();
  const { width } = useScreen();
  const W = Math.min(width, 430);
  const limitMs = (Number(play.settings.timelimit) || 10) * 60_000;
  const g = useBotRace<CwRace>({
    play,
    onFinish,
    onQuit,
    blind: true,
    build: (ctx) => new CwRace({ ...ctx, puzzleOf, limitMs }),
    pick: async () => {
      const n = Math.min(3, Math.max(1, Number(play.settings.count) || 1));
      return (await engine.picker.pick(play.game, PUZZLES.map((x) => x.id), n)).map((id) => indexOfPuzzle.get(id)!).filter(Boolean);
    },
    toItems: itemsOf,
  });
  const { st, race, t: now, push } = g;
  const [typing, setTyping] = useState(false);
  const onTyping = useCallback(
    (open: boolean, wordId: string | null) => {
      setTyping(open);
      race?.setOpen(wordId);
    },
    [race],
  );
  const seen = useRef<{ index: number; claims: Set<string>; leader: string | null; out: Set<string> } | null>(null);

  const teams = Number(play.settings.teams) || 0;
  const colorOf = (p: RacePlayer | undefined) => (!p ? t.accent : teams >= 2 && p.team != null ? presetTeam(p.team).color : playerColour(st?.players ?? [], p.user_id));

  // CW7 alerts: "Sara claimed ANEMIA", "Omar takes the lead", "Lina is out of hearts".
  useEffect(() => {
    if (!st || st.phase !== 'case' || st.item == null) return;
    const p = puzzleOf(st.item);
    const byId = new Map(st.players.map((x) => [x.user_id, x]));
    const claims = st.claims ?? [];
    const leaders = [...st.players].sort((a, b) => b.score - a.score);
    const leader = leaders[0]?.score ? leaders[0].user_id : null;
    const outNow = new Set(st.players.filter((x) => (x.hearts ?? CW.onlineHearts) <= 0).map((x) => x.user_id));
    if (!seen.current || seen.current.index !== st.index) {
      seen.current = { index: st.index, claims: new Set(claims.map((c) => c.word_id)), leader, out: outNow };
      return;
    }
    const was = seen.current;
    for (const c of claims) {
      if (was.claims.has(c.word_id)) continue;
      was.claims.add(c.word_id);
      const who = byId.get(c.user_id);
      if (c.user_id !== YOU && !c.auto && who) push(`${who.name} claimed ${indexOf(p).wordById.get(c.word_id)?.answer ?? 'a word'}`, colorOf(who));
    }
    if (leader && leader !== was.leader && leaders[0].score > (leaders[1]?.score ?? 0)) {
      const who = byId.get(leader)!;
      // A claim alert of the same moment goes first; the lead change follows it.
      setTimeout(() => push(leader === YOU ? 'You take the lead' : `${who.name} takes the lead`, colorOf(who)), 2100);
    }
    was.leader = leader ?? was.leader;
    for (const id of outNow) if (!was.out.has(id) && id !== YOU) push(`${byId.get(id)?.name ?? 'Someone'} is out of hearts`, '#f5b041');
    was.out = outNow;
  }, [st, push]); // eslint-disable-line react-hooks/exhaustive-deps

  const menu = <PauseMenu open={g.menu} mode="bots" onResume={g.closeMenu} onQuit={g.quit} />;
  if (!st || !race) return <GameScreen scroll={false}>{null}</GameScreen>;
  if (st.phase === 'countdown' || st.item == null) {
    return (
      <GameScreen scroll={false}>
        <Countdown ms={st.phase_ends_at - now} faces={st.players.map((p) => p.character)} line={settingsLine(gameDef(play.game), play.settings)} />
        <RoomTalk room={g.room} me={g.talker} />
        {menu}
      </GameScreen>
    );
  }

  const p = puzzleOf(st.item);
  const total = st.total;
  const ids = new Set(p.words.map((w) => w.id));
  const mine = st.players.find((x) => x.user_id === YOU);
  const byUser = new Map(st.players.map((x) => [x.user_id, x]));
  // Only this puzzle's claims (earlier puzzles' stay in the match's list).
  const claimsList = (st.claims ?? []).filter((c) => ids.has(c.word_id));
  const claims = Object.fromEntries(claimsList.map((c) => [c.word_id, colorOf(byUser.get(c.user_id))]));
  const solved = claimsList.map((c) => c.word_id);
  const left = p.words.length - solved.length;
  const reveal = st.phase !== 'case';
  const hearts = mine?.hearts ?? CW.onlineHearts;
  const out = hearts <= 0;
  const watching = !!st.me?.done && !reveal;
  const canRevive = !reveal && out && !mine?.revived && !watching;
  const wordsOf = (id: string) => claimsList.filter((c) => c.user_id === id && !c.auto).length;
  const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - now) / 1000));
  const sub = reveal ? (left ? 'Time up' : 'Grid complete') : `${clock(Math.max(0, st.phase_ends_at - now), { down: true })} left · ${mine?.revived ? 'revive used' : 'first right answer claims it'}`;

  const board = (
    <View style={s.lead}>
      {[...st.players]
        .sort((a, b) => b.score - a.score)
        .map((x) => (
          <View key={x.user_id} style={[s.chip, { borderColor: colorOf(x), backgroundColor: t.panel }]}>
            <PlayerFace slug={x.character} size={u(18)} userId={x.user_id} still />
            <Text style={[s.chipT, { color: t.fg }]} numberOfLines={1}>{x.user_id === YOU ? 'You' : x.name.split(' ')[0]}</Text>
            <Text style={[s.chipN, { color: t.white }]}>{x.score}</Text>
            <Text style={[s.chipH, { color: (x.hearts ?? 0) > 0 ? '#ff6b7d' : t.dim }]}>{`♥${x.hearts ?? 0}`}</Text>
          </View>
        ))}
    </View>
  );

  return (
    <GameScreen scroll={false} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), gap: u(10) }}>
      <AppTopBar kicker={`${left} ${left === 1 ? 'word' : 'words'} left`} title={total > 1 ? `Puzzle ${st.index + 1} of ${total}` : 'The race'} sub={sub} hearts={hearts} maxHearts={CW.onlineHearts} score={mine?.score ?? 0} onPause={g.openMenu} />
      {board}
      {!reveal && !out && !g.paused ? (
        <Race
          key={st.index}
          onTyping={onTyping}
          puzzle={p}
          solved={solved}
          claims={claims}
          hearts={hearts}
          width={W}
          submit={(wordId, answer) => g.at((at) => race.submit(at, wordId, answer)) ?? 'ignored'}
          claimerOf={(id) => {
            const c = claimsList.find((x) => x.word_id === id);
            return c ? (c.user_id === YOU ? 'You' : byUser.get(c.user_id)?.name) : undefined;
          }}
        />
      ) : (
        <>
          <AppGrid puzzle={p} solved={solved} claims={claims} width={W - u(32)} />
          {!reveal ? <Text style={[s.tip, { color: t.mute }]}>{out && !canRevive ? 'Out of hearts. You’re watching the rest of the race.' : ' '}</Text> : null}
        </>
      )}
      {reveal ? (
        <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, s.dockWrap]}>
          <RaceReveal
            label={left ? 'Time up' : 'Grid complete'}
            answer={`${p.words.length - left} of ${p.words.length} words claimed`}
            players={st.players}
            me={YOU}
            how={(x) => `${wordsOf(x.user_id)} ${wordsOf(x.user_id) === 1 ? 'word' : 'words'} · ${x.item_points ?? 0} pts`}
            next={st.phase === 'done' ? 'Adding up the scores…' : `${st.index + 1 < total ? 'Next puzzle' : 'Results'} in ${nextIn} s`}
          />
        </Animated.View>
      ) : canRevive && !g.paused ? (
        <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, s.dockWrap]}>
          <ReviveCard
            playId={play.id}
            name="You"
            payer="You"
            text={`No hearts left. One revive per ${total > 1 ? 'puzzle' : 'match'}: ${CW.revivePrice} token gives ${CW.reviveHearts} heart. Your claimed words stay yours.`}
            decline="No revive, watch the rest"
            onRevive={() => {
              // The race moved on while the card was up: the token comes back (the card refunds on a throw).
              if (!g.at((at) => race.revive(at))) throw new Error('over');
            }}
            onDecline={() => void g.at((at) => race.decline(at))}
          />
        </Animated.View>
      ) : null}
      <AlertPill alert={g.alert} />
      {/* The talk button would sit on the keyboard while a word is open. */}
      {typing && !reveal && !out ? null : <RoomTalk room={g.room} me={g.talker} />}
      {menu}
    </GameScreen>
  );
}

/** Your side of the race: open any unclaimed word, answer it. A word a rival claims closes on you. */
function Race({ onTyping, puzzle, solved, claims, hearts, width, submit, claimerOf }: {
  onTyping: (open: boolean, wordId: string | null) => void; puzzle: PuzzleDef; solved: string[]; claims: Record<string, string>; hearts: number; width: number;
  submit: (wordId: string, answer: string) => 'right' | 'wrong' | 'repeat' | 'taken' | 'ignored'; claimerOf: (wordId: string) => string | undefined;
}) {
  const t = useTheme();
  const idx = indexOf(puzzle);
  const [word, setWord] = useState<string | null>(null);
  const [typed, setTyped] = useState<Typed>([]);
  const [line, setLine] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const locked = lockedCells(idx, solved);
  // A rival claimed the open word (it was the last one left): it closes on you, and the tip says who.
  const open = word && !solved.includes(word) ? word : null;
  const taken = word && !open ? claimerOf(word) : undefined;
  const slots = open ? buildSlots(idx, open, locked) : [];

  const openWord = (id: string) => {
    setWord(id);
    setTyped(buildSlots(idx, id, locked).map(() => null));
    setLine(null);
  };

  const send = (next: Typed) => {
    if (!open) return;
    const answer = composeAnswer(slots, next);
    const clear = () => setTyped(slots.map(() => null));
    const res = submit(open, answer);
    if (res === 'right') {
      void sfxVerdict(true);
      setLine(null);
      return setWord(null);
    }
    if (res === 'taken') return setWord(null);
    if (res === 'ignored') return;
    void sfxVerdict(false);
    setShake((x) => x + 1);
    clear();
    setLine(res === 'repeat' ? 'You already tried that one.' : hearts <= 1 ? 'Not this one. That was your last heart.' : 'Not this one. One heart lost.');
  };

  const key = (k: string) => {
    const next = placeLetter(slots, typed, k);
    if (!next) return;
    setTyped(next);
    if (isFilled(slots, next)) send(next);
  };

  useEffect(() => {
    onTyping(open != null, open);
    return () => onTyping(false, null);
  }, [open, onTyping]);

  const taps = useGridTaps(idx, solved, openWord);
  const sel = open ? idx.wordById.get(open)! : null;
  const tip = line && !sel ? line : taken && taken !== 'You' ? `${taken} claimed it first.` : TIP;
  return (
    <>
      <AppGrid puzzle={puzzle} solved={solved} claims={claims} selected={open ?? taps.lit} width={width - u(32)} onCell={taps.tap} onDouble={taps.double} />
      <View style={s.under}>
        <Text style={[s.tip, { color: t.mute, flex: 1 }]}>{tip}</Text>
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
            onSlot={(i) => setTyped(removeSlot(slots, typed, i))}
            onClose={() => setWord(null)}
            foot={
              <View style={[s.foot, { borderColor: t.panelLine }]}>
                <Text style={[s.footT, { color: t.mute }]}>{`${hearts} ${hearts === 1 ? 'heart' : 'hearts'} left · no hints vs rivals`}</Text>
                <Pressable onPress={() => setWord(null)} hitSlop={u(6)} accessibilityRole="button" accessibilityLabel="Pick another word">
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
  chip: { flexDirection: 'row', alignItems: 'center', gap: u(5), borderWidth: 1, borderRadius: 999, paddingVertical: u(3), paddingLeft: u(3), paddingRight: u(9), maxWidth: '48%' },
  chipT: { fontFamily: F.bodySemi, fontSize: u(11), flexShrink: 1 },
  chipN: { fontFamily: F.mono, fontSize: u(11) },
  chipH: { fontFamily: F.mono, fontSize: u(10) },
  under: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: u(10), minHeight: u(36) },
  tip: { fontFamily: F.body, fontSize: u(12) },
  sheetWrap: { justifyContent: 'flex-end', zIndex: 5 },
  dockWrap: { justifyContent: 'flex-end', padding: u(16), zIndex: 6 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: u(9), marginTop: u(2), gap: u(10) },
  footT: { fontFamily: F.body, fontSize: u(11.5), flexShrink: 1 },
});
