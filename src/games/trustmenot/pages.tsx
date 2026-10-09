// Trust Me Not pages in the all-paper look (locked 2026-10-07, preview pages 6 "Month opening" and 21 "Question
// round"). Each page draws the player's own view of the year and sends only their own actions.
import { Pressable, StyleSheet, View } from 'react-native';

import type { RoundId } from './engine';
import { rules } from './engine';
import { CRIM, CRIMI, FELL, FELLI, IvBag, Jar, p, Paper, Portrait, RingClock, ROMAN, T, TM } from './paper';

/** One line of story under each month's numeral. */
export const MONTH_STORY = [
  'The rains failed, but the fields gave one last crop. Gather what you can.',
  'The first merchants come up the road, with full carts and high prices.',
  'The granary is half full and the nights turn cold. Count every coin.',
  'Winter comes early. The road closes behind the last cart.',
  'Snow seals the road. The traders will not come this month.',
  'The well freezes over, and fever moves through the tents.',
  'The snow melts into mud, and sickness rises with the water.',
  'Rats reach the stores before you do. Trust wears thin.',
  'The stores are nearly empty. This is the Hunger Gap.',
  'The wells run dry under a white sun.',
  'A relief cart arrives. Some of its food can kill.',
  'On the last day, dust rises on the road. A rescue column, if you live to see it.',
];
const SEASON_TITLE = ['The Harvest', 'The Long Cold', 'The Rot', 'The Scorch'];

export const ROUND_NAME: Record<RoundId, string> = {
  granary: 'Granary Run', forager: 'Lone Forager', mine: 'The Mine Shaft', prospector: 'Lone Prospector',
  jar: 'Leaking Jar', purse: 'Cracked Purse', cavein: 'Cave-In', pickpocket: 'Pickpocket Night',
  lean: 'Lean Purse', offering: 'The Offering', hands: 'In Your Hands', gate: 'Quarantine Gate', buried: 'Buried Alive',
  hero: 'The Hero', signal: 'Signal Fire', supplier: 'The Supplier', whisperer: 'The Whisperer', wager: 'The Wager', chain: 'Chain of Trust',
};
const MODE_NAME: Record<string, string> = {
  'team-vote': 'team vote', solo: 'on your own', 'solo-competitive': 'on your own, lowest loses', pairs: 'in pairs', 'team-target': 'team target', linked: 'one link each',
};

// ---------------------------------------------------------------- month opening

/** A calendar sheet pinned over the village: the Roman month between the year's name and the season. */
export function OpeningPage({ month }: { month: number }) {
  const season = rules.seasonOf(month);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ position: 'absolute', left: p(34), right: p(34), top: p(56), transform: [{ rotate: '-1.5deg' }] }}>
        <Paper seed={`cal${month}`} pad={[30, 18, 22]}>
          <View style={s.rings} pointerEvents="none">
            <View style={s.ring} />
            <View style={s.ring} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <T f={FELLI} size={13}>The Year of Hunger</T>
            <T f={FELL} size={112} style={{ lineHeight: p(101), marginTop: p(19), marginBottom: p(7), letterSpacing: p(2) }}>{ROMAN[month - 1]}</T>
            <T f={FELL} size={12} color={TM.red} style={{ letterSpacing: p(0.3), textTransform: 'uppercase' }} lines={1}>
              {`${rules.SEASON_NAMES[season]} · ${SEASON_TITLE[season]}`}
            </T>
            <View style={s.rule} />
            <T f={CRIMI} size={16} style={{ textAlign: 'center', lineHeight: p(22.4) }}>{MONTH_STORY[month - 1]}</T>
          </View>
        </Paper>
      </View>
      <View style={{ position: 'absolute', bottom: p(26), left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
        <T f={FELLI} size={14} color={TM.cream} style={s.shadow}>{`Month ${month} of 12`}</T>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- question round

export type StripPlayer = { id: string; name: string; color: string; health: number; alive: boolean };

/** Everyone across the top: silhouette, name, and health (or "ghost"). */
export function Strip({ players, me }: { players: StripPlayer[]; me: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: p(9), paddingHorizontal: p(14) }}>
      {players.map((x) => (
        <View key={x.id} style={{ width: p(46), alignItems: 'center', opacity: x.alive ? 1 : 0.6 }}>
          <Portrait color={x.color} health={x.health} ghost={!x.alive} />
          <T f={FELL} size={11} color={TM.cream} style={[s.shadow, { marginTop: p(3), lineHeight: p(13) }]} lines={1}>{x.id === me ? 'You' : x.name}</T>
          <T size={8.5} color={TM.cream} style={[s.shadow, { lineHeight: p(10), opacity: 0.8 }]}>{x.alive ? `${Math.round(x.health)}%` : 'ghost'}</T>
        </View>
      ))}
    </View>
  );
}

export type RoundProps = {
  players: StripPlayer[];
  me: string;
  round: RoundId;
  index: number;
  total: number;
  seconds: number;
  limit: number;
  question: { q: string; choices: string[] };
  picked: number | null;
  onPick: (choice: number) => void;
  /** Team target rounds: right answers so far and the target. */
  camp?: { done: number; target: number; max: number } | null;
  health: number;
  jewels: number;
};

/** One question on a torn sheet under the strip: round name, clock, camp total, three choices, my health and jewels. */
export function RoundPage({ players, me, round, index, total, seconds, limit, question, picked, onPick, camp, health, jewels }: RoundProps) {
  const mode = MODE_NAME[rules.ROUNDS[round].mode] ?? '';
  return (
    <View style={{ flex: 1 }}>
      <Strip players={players} me={me} />
      <View style={{ position: 'absolute', left: p(12), right: p(12), top: p(76) }}>
        <Paper seed={`round${round}${index}`}>
          <View style={{ gap: p(8) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T f={FELL} size={19} style={{ lineHeight: p(21) }}>{ROUND_NAME[round]}</T>
                <T size={10.5} style={{ opacity: 0.75 }}>{`${mode} · question ${index + 1} of ${total}`}</T>
              </View>
              <RingClock seconds={seconds} total={limit} />
            </View>
            {camp ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: p(8) }}>
                <T size={10.5}>Camp total</T>
                <View style={s.bar}>
                  <View style={[s.barFill, { width: `${Math.min(100, (camp.done / camp.max) * 100)}%` }]} />
                  <View style={[s.barMark, { left: `${Math.min(100, (camp.target / camp.max) * 100)}%` }]} />
                </View>
                <T f={FELL} size={10.5}>{`${camp.done} / ${camp.target}`}</T>
              </View>
            ) : null}
            <T f={FELL} size={16} style={{ lineHeight: p(21), marginTop: p(2) }}>{question.q}</T>
            <View style={{ gap: p(7) }}>
              {question.choices.map((c, i) => {
                const on = picked === i;
                return (
                  <Pressable key={i} onPress={() => onPick(i)} disabled={picked != null} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={c} style={[s.ch, on ? s.chOn : null]}>
                    <View style={[s.letter, on ? s.letterOn : null]}>
                      <T f={FELL} size={12} color={on ? TM.paper : TM.ink} style={{ lineHeight: p(14) }}>{'ABC'[i]}</T>
                    </View>
                    <T f={CRIM} size={13.5} style={{ flex: 1, lineHeight: p(18) }}>{c}</T>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: p(6) }}>
              <View style={s.gauge}>
                <IvBag health={health} />
                <T f={FELL} size={15}>{`${Math.round(health)}%`}</T>
              </View>
              <View style={s.gauge}>
                <Jar />
                <T f={FELL} size={15}>{String(jewels)}</T>
              </View>
            </View>
          </View>
        </Paper>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  rings: { position: 'absolute', top: p(8), left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: p(120) },
  ring: { width: p(10), height: p(10), borderRadius: p(5), backgroundColor: TM.ink },
  rule: { height: 1, alignSelf: 'stretch', backgroundColor: 'rgba(42,31,22,0.3)', marginVertical: p(14), marginHorizontal: p(30) },
  shadow: { textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  bar: { flex: 1, height: p(5), backgroundColor: 'rgba(42,31,22,0.15)' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: TM.ink },
  barMark: { position: 'absolute', top: -p(3), bottom: -p(3), width: 1.5, backgroundColor: TM.red },
  ch: { flexDirection: 'row', alignItems: 'center', gap: p(10), paddingVertical: p(9), paddingHorizontal: p(11), borderWidth: 1, borderColor: 'rgba(42,31,22,0.4)' },
  chOn: { backgroundColor: 'rgba(155,47,34,0.1)', borderColor: TM.red },
  letter: { width: p(22), height: p(22), borderRadius: p(11), borderWidth: 1, borderColor: TM.ink, alignItems: 'center', justifyContent: 'center' },
  letterOn: { backgroundColor: TM.red, borderColor: TM.red },
  gauge: { flexDirection: 'row', alignItems: 'center', gap: p(6) },
});
