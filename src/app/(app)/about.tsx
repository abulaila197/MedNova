import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { Screen } from '@/components/Screen';
import { AboutRail } from '@/features/info/AboutRail';
import { ABOUT_GAMES, DISCLAIMER, HABITS } from '@/features/info/content';
import { InfoScroll, Kicker, Rich, s as ui, useInfo } from '@/features/info/ui';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { useSharedValue } from 'react-native-reanimated';
import { tr } from '@/i18n';

const DAWN = { dark: require('@/assets/art/dawn-dark.webp') };

/** About MedNova, locked "A1 Night to dawn": the dawn horizon behind, a rail that tracks the scroll. */
export default function Page() {
  const c = useInfo();
  const progress = useSharedValue(0);
  return (
    <Screen tab={null} glow={21} under={<Image source={DAWN[c.t.mode]} contentFit="cover" style={s.dawn} />} wide={460}>
      <InfoScroll scrollY={progress} over={<AboutRail progress={progress} />}>
        <Kicker>{tr('About MedNova')}</Kicker>
        <Rich text={tr('Medicine becomes\na *puzzle.*')} style={ui.H} />
        <Text style={[ui.p, { color: c.mute }]}>{tr('Train the thinking behind the answer: what matters, what to check next, and which diagnosis explains the whole picture.')}</Text>

        <View style={ui.xsec}>
          <Kicker inSec>{tr('02 · Five habits')}</Kicker>
          <List items={HABITS.map((h) => tr(h))} />
        </View>

        <View style={ui.xsec}>
          <Kicker inSec>{tr('03 · The games')}</Kicker>
          <Rich text={tr('One platform. *Different ways to think.*')} style={ui.h4} />
          <Text style={[ui.p, { color: c.mute }]}>{tr('From rapid recognition to structured investigation and differential diagnosis, MedNova gives clinical thinking different arenas to be practised.')}</Text>
          <List items={ABOUT_GAMES} />
        </View>

        <View style={ui.xsec}>
          <Kicker inSec>{tr('04 · The vision')}</Kicker>
          <Rich text={tr('A growing *diagnostic universe.*')} style={ui.h4} />
          <Text style={[ui.p, { color: c.mute }]}>{tr('More cases. More ways to practise. Better feedback. MedNova is being built to grow without losing the clarity, credibility and discipline of clinical medicine.')}</Text>
        </View>

        <Text style={[ui.p, s.note, { color: c.mute }]}>{DISCLAIMER}</Text>
        <Link href="/licences" style={[s.lic, { color: c.mute }]}>
          {tr('Open-source licences')}
        </Link>
      </InfoScroll>
    </Screen>
  );
}

/** Numbered serif list (.habits). */
function List({ items }: { items: string[] }) {
  const c = useInfo();
  return (
    <View style={s.list}>
      {items.map((h, i) => (
        <View key={h} style={s.row}>
          <Text style={[s.no, { color: c.kick }]}>{String(i + 1).padStart(2, '0')}</Text>
          <Text style={[s.name, { color: c.fg }]}>{h}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  note: { marginTop: u(20), fontSize: u(9), lineHeight: u(13) },
  lic: { marginTop: u(14), alignSelf: 'flex-start', fontFamily: F.body, fontSize: u(9.5), textDecorationLine: 'underline' },
  dawn: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: 0.95 },
  list: { marginTop: u(6), gap: u(6) },
  // minHeight, not height: a fixed row cut the bottoms of g and j on small Android phones (Yazan 2026-11-11).
  row: { flexDirection: 'row', alignItems: 'baseline', gap: u(10), minHeight: u(19) },
  no: { fontFamily: F.mono, fontSize: u(8) },
  name: { fontFamily: F.display, fontSize: u(15), lineHeight: u(19) },
});
