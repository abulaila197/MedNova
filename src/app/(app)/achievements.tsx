import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { type AchRow, useAchievements } from '@/features/achievements/useAchievements';
import { TIER_TOKENS } from '@/features/achievements/progress';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import type { Theme } from '@/theme/tokens';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

const TIER = ['Bronze', 'Silver', 'Gold'];
const METAL = [
  ['#e6b089', '#a8693d'],
  ['#eef1f6', '#9aa3b2'],
  ['#f6dc8a', '#c9952e'],
] as const;

/** Achievements (AC1-AC8), locked look B "Residency logbook": bronze, silver and gold tiers; reached tiers wait for a tap to collect. */
export default function Page() {
  const c = useInfo();
  const { rows, signedIn, busy, error, collect, waiting, tokensWaiting } = useAchievements();
  const reached = rows?.reduce((n, r) => n + r.reached, 0) ?? 0;
  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>Achievements</Kicker>
        <Text style={[ui.H, s.H, { color: c.fg }]}>
          {'Your '}
          <Text style={[ui.H, s.H, { color: c.t.accent, fontFamily: F.displayItalic }]}>logbook</Text>
        </Text>
        <Text style={[ui.p, { color: c.mute }]}>
          {`${reached} of ${(rows?.length ?? 19) * 3} tiers reached`}
          {waiting ? ` · ${tokensWaiting} token${tokensWaiting === 1 ? '' : 's'} waiting` : ''}
        </Text>
        {!signedIn ? (
          <Pressable onPress={() => router.navigate('/auth')} style={[s.guest, { borderColor: c.line, backgroundColor: c.surf }]} accessibilityRole="button">
            <Text style={[s.guestT, { color: c.fg }]}>Sign in to collect your tokens</Text>
            <Text style={[s.guestA, { color: c.t.accent }]}>Sign in</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={[ui.p, { color: c.t.red }]}>{error}</Text> : null}
        <View style={[s.log, { backgroundColor: c.surf, borderColor: c.line }]}>
          <View style={[s.margin, { backgroundColor: c.t.rose }]} />
          {rows?.map((r) => <LogRow key={r.key} r={r} t={c.t} canCollect={signedIn} busy={busy === r.key} onCollect={() => collect(r.key)} />)}
        </View>
      </InfoScroll>
    </Screen>
  );
}

type RowP = { r: AchRow; t: Theme; canCollect: boolean; busy: boolean; onCollect: () => void };

function CollectPill({ r, t, busy, onCollect, small = false }: Omit<RowP, 'canCollect'> & { small?: boolean }) {
  return (
    <Pressable onPress={busy ? undefined : onCollect} accessibilityRole="button" style={busy && { opacity: 0.6 }}>
      <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={[s.pill, small && s.pillS]}>
        <Text style={[s.pillT, { color: t.onGrad }]}>{`Collect +${TIER_TOKENS[r.paid]}`}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/** One ruled line per achievement; each tier is a signed box, gold gets the stamp. */
function LogRow({ r, t, canCollect, busy, onCollect }: RowP) {
  const ready = canCollect && r.paid < r.reached;
  const goal = r.next ?? r.goals[2];
  const pct = Math.min(1, r.count / goal);
  return (
    <View style={[s.line, { borderBottomColor: t.panelLine }]}>
      <View style={s.tiers}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[s.box, { borderColor: i < r.reached ? METAL[i][1] : t.panelLine }]}>
            {i < r.reached ? <Text style={[s.tick, { color: METAL[i][1] }]}>✓</Text> : null}
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.lName, { color: t.fg }]}>{r.name}</Text>
        <Text style={[s.lWhat, { color: t.mute }]}>
          {r.next == null ? `${r.what} · all three signed` : `${r.what} · ${Math.min(r.count, r.next)} / ${r.next} for ${TIER[r.reached].toLowerCase()}`}
        </Text>
        <View style={[s.bar, { backgroundColor: t.chip }]}>
          <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: r.reached ? METAL[r.reached - 1][1] : t.accent }]} />
        </View>
      </View>
      {ready ? (
        <CollectPill r={r} t={t} busy={busy} onCollect={onCollect} small />
      ) : r.paid === 3 ? (
        <View style={[s.stamp, { borderColor: t.accent }]}>
          <Text style={[s.stampT, { color: t.accent }]}>SIGNED</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  H: { fontFamily: F.display },
  guest: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: u(14), padding: u(12), marginTop: u(12) },
  guestT: { fontFamily: F.bodyMedium, fontSize: u(11) },
  guestA: { fontFamily: F.bodyBold, fontSize: u(11) },
  pill: { borderRadius: 999, paddingHorizontal: u(12), height: u(26), justifyContent: 'center' },
  pillS: { paddingHorizontal: u(9), height: u(22) },
  pillT: { fontFamily: F.bodyBold, fontSize: u(9.5) },
  log: { marginTop: u(18), borderWidth: 1, borderRadius: u(18), paddingLeft: u(14), paddingRight: u(12), overflow: 'hidden' },
  margin: { position: 'absolute', left: u(54), top: 0, bottom: 0, width: 1, opacity: 0.35 },
  line: { flexDirection: 'row', alignItems: 'center', gap: u(14), paddingVertical: u(11), borderBottomWidth: 1 },
  tiers: { width: u(28), gap: u(3), alignItems: 'center' },
  box: { width: u(12), height: u(12), borderRadius: u(3), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tick: { fontSize: u(8), lineHeight: u(10), fontFamily: F.bodyBold },
  lName: { fontFamily: F.display, fontSize: u(14) },
  lWhat: { fontFamily: F.body, fontSize: u(9), marginTop: u(2) },
  bar: { height: u(3), borderRadius: u(2), marginTop: u(6), overflow: 'hidden' },
  fill: { height: '100%', borderRadius: u(2) },
  stamp: { borderWidth: 1.5, borderRadius: u(4), paddingHorizontal: u(5), paddingVertical: u(2), transform: [{ rotate: '-12deg' }] },
  stampT: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.2) },
});
