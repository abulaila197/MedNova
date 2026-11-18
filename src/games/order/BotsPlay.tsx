import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { YOU } from '@/bots/race/engine';
import { useBotRace } from '@/bots/race/useBotRace';
import { isAr, tr } from '@/i18n';
import { settingsLine } from '@/match/format';
import { AlertPill, Countdown } from '@/match/live';
import type { RacePlayer, RaceState } from '@/match/race';
import { RoomTalk } from '@/match/TalkBar';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { engine } from '../engine';
import { playerColour } from '../shell/characters';
import { PauseMenu } from '../shell/PauseMenu';
import { gameDef } from '../shell/registry';
import { presetTeam } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { Btn, GameScreen } from '../shell/ui';
import { helpLabels, missNote, OrderBoard } from './Board';
import { ORDER, placeStep, removeDecoy, worthNow, type QRun } from './core';
import { questionById } from './data';
import { countOf, dealQuestions } from './deal';
import { questionItem } from './items';
import { OrderResult, type ResultRow } from './Result';
import { OrderRace } from './rivals';

const GREEN = '#34d399';

/**
 * Put it in order vs rivals: the same question for everyone, 90 seconds. Each rival's slots fill live (how many,
 * never their order), and a pop-up shows when one gets it right. Your missed questions go to Learn.
 */
export function BotsPlay({ play, onFinish, onQuit }: PlayProps) {
  const ids = useRef<string[]>([]);
  const g = useBotRace<OrderRace>({
    play,
    onFinish,
    onQuit,
    fine: true,
    build: (ctx) => new OrderRace({ ...ctx, ids: ids.current }),
    pick: async () => {
      ids.current = await dealQuestions(play, countOf(play.settings));
      return ids.current.map((_, i) => i + 1);
    },
    toItems: (st: RaceState, race: OrderRace) =>
      (st.my_items ?? []).flatMap((m) => {
        const r = race.runOf(m.index);
        const id = ids.current[m.index];
        return id && r ? [questionItem(id, r.run, { index: m.index, learn: true, ms: r.ms })] : [];
      }),
    solvedText: (name) => tr('{name} got the order right', { name }),
  });
  const { st, race, t: now } = g;
  const teams = Number(play.settings.teams) || 0;
  const colorOf = (p: RacePlayer | undefined) => (!p ? '#9aa0c4' : teams >= 2 && p.team != null ? presetTeam(p.team).color : playerColour(st?.players ?? [], p.user_id));

  // Paid helpers at Solo's prices; a failed step gives the tokens back.
  const [helpNote, setHelpNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const buy = async (cost: number, reason: string, apply: (r: QRun) => QRun) => {
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

  const id = race.questionNow();
  const run = race.mine();
  const q = id ? questionById.get(id) : null;
  if (!q || !run) return <GameScreen scroll={false}>{null}</GameScreen>;
  const total = st.total;
  const me = st.players.find((p) => p.user_id === YOU);

  if (st.phase !== 'case') {
    const rowsBy = race.lastRows();
    const mine = race.runOf(st.index);
    const rows: ResultRow[] = [...st.players]
      .sort((a, b) => (a.item_rank ?? 9) - (b.item_rank ?? 9))
      .flatMap((p) => (rowsBy[p.user_id] ? [{ id: p.user_id, name: p.user_id === YOU ? tr('You') : p.name, color: colorOf(p), run: rowsBy[p.user_id].run, points: rowsBy[p.user_id].points, ms: rowsBy[p.user_id].ms }] : []));
    const nextIn = Math.max(0, Math.ceil((st.phase_ends_at - now) / 1000));
    const last = st.index + 1 >= total;
    return (
      <OrderResult
        q={q}
        run={mine?.run ?? run}
        ms={mine?.ms ?? 0}
        rows={rows}
        title={tr('Question {n} of {total} · {score} pts', { n: st.index + 1, total, score: me?.score ?? 0 })}
        foot={st.phase === 'done' ? <Text style={[s.wait]}>{tr('Adding up the scores…')}</Text> : <Btn label={`${last ? tr('See results') : tr('Next question')} · ${tr('{n} s', { n: nextIn })}`} onPress={() => void g.at((at) => race.next(at))} />}>
        <AlertPill alert={g.alert} />
        {menu}
      </OrderResult>
    );
  }

  const spent = race.spentMs(now);
  const left = race.leftMs(now);
  const labels = helpLabels(run);
  const rivals = st.players.filter((p) => p.user_id !== YOU);
  return (
    <OrderBoard
      key={st.index}
      q={q}
      run={run}
      title={tr('Question {n}', { n: st.index + 1 })}
      sub={tr('of {n}', { n: total })}
      clock={{ label: tr('Time left'), ms: left, down: true, warn: left < 15_000 }}
      worth={worthNow(run, spent)}
      locked={g.paused || run.done || busy}
      hidden={g.paused}
      onPause={g.openMenu}
      onMove={(card, to) => void g.at((at) => race.move(at, card, to))}
      onSubmit={() => void g.at((at) => race.submit(at))}
      note={run.done ? { text: run.solved ? tr('Right order. Waiting for the rivals…') : tr('Out of tries. Waiting for the rivals…'), tone: run.solved ? 'good' : 'bad' } : helpNote ? { text: helpNote, tone: 'bad' } : missNote(run)}
      help={{
        place: { label: labels.place, disabled: run.placeUsed || busy, onPress: () => void buy(ORDER.placeCost, 'order_place', (r) => placeStep(r, Math.random)) },
        decoy: { label: labels.decoy, disabled: run.decoyUsed || busy, onPress: () => void buy(ORDER.decoyCost, 'order_decoy', (r) => removeDecoy(q, r, Math.random)) },
      }}
      live={<RivalSlots players={rivals} slots={q.steps.length} colorOf={colorOf} />}>
      <AlertPill alert={g.alert} />
      <RoomTalk room={g.room} me={g.talker} />
      {menu}
    </OrderBoard>
  );
}

/** Each rival's slots filling live: a short bar of n cells, green when they got the order right. */
function RivalSlots({ players, slots, colorOf }: { players: RacePlayer[]; slots: number; colorOf: (p: RacePlayer) => string }) {
  const t = useTheme();
  return (
    // Room on the side where the talk button sits (the right edge in both languages).
    <View style={[s.rivals, isAr ? { paddingStart: u(48) } : { paddingEnd: u(48) }]}>
      {players.map((p) => {
        const filled = p.greens ?? 0;
        const col = p.solved ? GREEN : colorOf(p);
        return (
          <View key={p.user_id} style={[s.rival, { backgroundColor: t.panel, borderColor: p.solved ? GREEN : t.panelLine }]}>
            <Text style={[s.rName, { color: t.fg }]} numberOfLines={1}>
              {p.name}
            </Text>
            <View style={s.cells}>
              {Array.from({ length: slots }, (_, i) => (
                <View key={i} style={[s.cell, { backgroundColor: i < filled ? col : '#2b3866' }]} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wait: { fontFamily: F.body, fontSize: u(11.5), color: '#9aa0c4', textAlign: 'center' },
  rivals: { flexDirection: 'row', flexWrap: 'wrap', gap: u(5), marginBottom: u(8) },
  rival: { flexGrow: 1, flexBasis: '30%', borderWidth: 1, borderRadius: u(9), paddingVertical: u(5), paddingHorizontal: u(8), gap: u(4) },
  rName: { fontFamily: F.bodySemi, fontSize: u(10), lineHeight: u(13) },
  cells: { flexDirection: 'row', gap: u(2) },
  cell: { flex: 1, height: u(4), borderRadius: u(2) },
});
