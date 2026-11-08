// Trust Me Not pages in the all-paper look (locked 2026-10-07, preview pages 6 "Month opening" and 21 "Question
// round"). Each page draws the player's own view of the year and sends only their own actions.
import { StyleSheet, View } from 'react-native';

import type { RoundId } from './engine';
import { rules } from './engine';
import { CRIMI, FELL, FELLI, p, Paper, Portrait, ROMAN, T, TM } from './paper';

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

const s = StyleSheet.create({
  rings: { position: 'absolute', top: p(8), left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: p(120) },
  ring: { width: p(10), height: p(10), borderRadius: p(5), backgroundColor: TM.ink },
  rule: { height: 1, alignSelf: 'stretch', backgroundColor: 'rgba(42,31,22,0.3)', marginVertical: p(14), marginHorizontal: p(30) },
  shadow: { textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});
