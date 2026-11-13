import { COIN } from '@/components/CoinLabel';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Text } from '@/components/AppText';
import { YOU } from '@/bots/race/engine';
import { useBotRace } from '@/bots/race/useBotRace';
import { settingsLine } from '@/match/format';
import { AlertPill, Countdown } from '@/match/live';
import type { RacePlayer, RaceState } from '@/match/race';
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
import { CaseView } from './CaseView';
import { TTT, takeFifty, type CaseRun } from './core';
import { caseById } from './data';
import { dealCases } from './deal';
import { caseItem } from './items';
import { Btn, C, Explain, PadSky, Pill, TopLine, type RevealRow } from './Pad';
import { TttRace } from './rivals';
import { tr } from '@/i18n';

/**
 * Trace the Treatment vs rivals: the same case for everyone at the same time. You see who has locked in, never what
 * they picked; the answer card shows everyone's answers. Your missed cases go to Learn.
 */
export function BotsPlay({ play, onFinish, onQuit }: PlayProps) {
  const limitMs = (Number(play.settings.clock) || 0) * 60_000;
  const cases = useRef<string[]>([]);
  const g = useBotRace<TttRace>({
    play,
    onFinish,
    onQuit,
    blind: true,
    build: (ctx) => new TttRace({ ...ctx, cases: cases.current, limitMs }),
    pick: async () => {
      cases.current = await dealCases(play);
      return cases.current.map((_, i) => i + 1);
    },
    toItems: (st: RaceState, race: TttRace) =>
      (st.my_items ?? []).flatMap((m) => {
        const run = race.runOfCase(m.index);
        const id = cases.current[m.index];
        return id && run ? [caseItem(id, run, { index: m.index, learn: true, ms: m.solved_ms ?? 0 })] : [];
      }),
    solvedText: (name) => tr('{name} locked in', { name }),
  });
  const { st, race, t: now, push } = g;
  const teams = Number(play.settings.teams) || 0;
  const colorOf = (p: RacePlayer | undefined) => (!p ? C.cyan : teams >= 2 && p.team != null ? presetTeam(p.team).color : playerColour(st?.players ?? [], p.user_id));

  // "Sara locked in": who has answered, never what.
  const seen = useRef<{ index: number; locks: Record<string, number> } | null>(null);
  useEffect(() => {
    if (!st || st.phase !== 'case') return;
    const locks = Object.fromEntries(st.players.map((p) => [p.user_id, p.greens ?? 0]));
    const was = seen.current;
    seen.current = { index: st.index, locks };
    if (!was || was.index !== st.index) return;
    for (const p of st.players) {
      if (p.user_id === YOU) continue;
      const n = locks[p.user_id];
      if (n > (was.locks[p.user_id] ?? 0)) push(tr('{name} locked in', { name: p.name }), colorOf(p));
    }
  }, [st, push]); // eslint-disable-line react-hooks/exhaustive-deps

  // 50/50 in Vs rivals too, at Solo's token price (Yazan 2026-11-12); a failed step gives the tokens back.
  const [helpNote, setHelpNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const buy = async (cost: number, reason: string, apply: (r: CaseRun) => CaseRun) => {
    if (!race || busy) return;
    setBusy(true);
    try {
      const receipt = await engine.wallet.spend(cost, reason, play.id);
      if (!receipt) return setHelpNote(tr('This help costs {cost} tokens. Each level up gives 1 token.', { cost }));
      if (!g.at((at) => race.help(at, apply))) return void engine.wallet.refund(receipt);
      setHelpNote(null);
    } finally {
      setBusy(false);
    }
  };

  const menu = <PauseMenu open={g.menu} mode="bots" onResume={g.closeMenu} onQuit={g.quit} />;
  if (!st || !race) return <GameScreen scroll={false} under={<PadSky />}>{null}</GameScreen>;
  if (st.phase === 'countdown' || st.item == null) {
    return (
      <GameScreen scroll={false} under={<PadSky />}>
        <Countdown ms={st.phase_ends_at - now} faces={st.players.map((p) => p.character)} line={settingsLine(gameDef(play.game), play.settings)} />
        <RoomTalk room={g.room} me={g.talker} />
        {menu}
      </GameScreen>
    );
  }

  const id = race.caseNow();
  const run = race.mine();
  const c = id ? caseById.get(id) : null;
  if (!c || !run) return <GameScreen scroll={false} under={<PadSky />}>{null}</GameScreen>;
  const total = st.total;
  const kicker = total > 1 ? tr('Case {n} of {total}', { n: st.index + 1, total }) : tr('One case');
  const me = st.players.find((p) => p.user_id === YOU);

  if (st.phase !== 'case') {
    const runs = race.lastRuns();
    const rows: RevealRow[] = [...st.players]
      .sort((a, b) => (a.item_rank ?? 9) - (b.item_rank ?? 9))
      .map((p) => ({ id: p.user_id, name: p.user_id === YOU ? 'You' : p.name, character: p.character, color: colorOf(p), run: runs[p.user_id], points: p.item_points ?? 0, rank: p.item_rank }))
      .filter((r) => r.run);
    const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - now) / 1000));
    const last = st.index + 1 >= total;
    return (
      <GameScreen scroll={false} under={<PadSky />} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), paddingBottom: u(14), gap: u(10) }}>
        <TopLine kicker={tr('{kicker} · Everyone’s answers', { kicker })} right={<Pill text={tr('{n} pts', { n: me?.score ?? 0 })} />} />
        <Explain
          c={c}
          run={race.runOfCase(st.index) ?? run}
          rows={rows}
          foot={st.phase === 'done' ? <Text style={s.wait}>{tr('Adding up the scores…')}</Text> : <Btn label={`${last ? tr('See results') : tr('Next case')} · ${nextIn} s`} onPress={() => void g.at((at) => race.next(at))} />}
        />
        <AlertPill alert={g.alert} />
        {menu}
      </GameScreen>
    );
  }

  const left = race.leftMs(now);
  return (
    <GameScreen scroll={false} under={<PadSky />} bodyStyle={{ paddingTop: u(12), paddingHorizontal: u(16), paddingBottom: u(14) }}>
      <CaseView
        key={st.index}
        c={c}
        run={run}
        locked={g.paused || run.done}
        note={run.done ? tr('Locked in. Waiting for the rivals…') : tr('Answers stay hidden until the reveal.')}
        help={{
          fifty: { label: run.fifty ? tr('50/50 used') : `50/50 · ${TTT.fiftyCost}${COIN}`, onPress: () => void buy(TTT.fiftyCost, 'ttt_fifty', (r) => takeFifty(r, Math.random)), disabled: !!run.fifty || busy },
          note: helpNote,
        }}
        // No chips over the paper (Yazan 2026-11-12): who locked in shows as live pop-ups, never what they picked.
        top={<TopLine kicker={kicker} right={<Pill text={left != null ? clock(left, { down: true }) : tr('{n} pts', { n: me?.score ?? 0 })} warn={left != null && left < 15_000} />} />}
        onLock={(pick) => void g.at((at) => race.lock(at, pick))}
      />
      <AlertPill alert={g.alert} />
      <RoomTalk room={g.room} me={g.talker} />
      {menu}
    </GameScreen>
  );
}

const s = StyleSheet.create({
  wait: { fontFamily: F.body, fontSize: u(11.5), color: C.mute, textAlign: 'center' },
});
