import { Image, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { AboutRail } from '@/features/info/AboutRail';
import { ABOUT_GAMES, HABITS } from '@/features/info/content';
import { InfoScroll, Kicker, Rich, s as ui, useInfo } from '@/features/info/ui';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { useSharedValue } from 'react-native-reanimated';

const DAWN = { dark: require('@/assets/art/dawn-dark.jpg'), light: require('@/assets/art/dawn-light.jpg') };

/** About MedNova, locked "A1 Night to dawn": the dawn horizon behind, a rail that tracks the scroll. */
export default function Page() {
  const c = useInfo();
  const progress = useSharedValue(0);
  return (
    <Screen tab={null} glow={21} under={<Image source={DAWN[c.t.mode]} resizeMode="cover" style={s.dawn} />}>
      <InfoScroll scrollY={progress} over={<AboutRail progress={progress} />}>
        <Kicker>About MedNova</Kicker>
        <Rich text={'Medicine becomes\na *puzzle.*'} style={ui.H} />
        <Text style={[ui.p, { color: c.mute }]}>Train the thinking behind the answer: what matters, what to check next, and which diagnosis explains the whole picture.</Text>

        <View style={ui.xsec}>
          <Kicker inSec>02 · Five habits</Kicker>
          <List items={HABITS} />
        </View>

        <View style={ui.xsec}>
          <Kicker inSec>03 · The games</Kicker>
          <Rich text={'One platform. *Different ways to think.*'} style={ui.h4} />
          <Text style={[ui.p, { color: c.mute }]}>From rapid recognition to structured investigation and differential diagnosis, MedNova gives clinical thinking different arenas to be practised.</Text>
          <List items={ABOUT_GAMES} />
        </View>

        <View style={ui.xsec}>
          <Kicker inSec>04 · The vision</Kicker>
          <Rich text={'A growing *diagnostic universe.*'} style={ui.h4} />
          <Text style={[ui.p, { color: c.mute }]}>More cases. More ways to practise. Better feedback. MedNova is being built to grow without losing the clarity, credibility and discipline of clinical medicine.</Text>
        </View>
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
  dawn: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: 0.95 },
  list: { marginTop: u(6), gap: u(6) },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: u(10), height: u(19) },
  no: { fontFamily: F.mono, fontSize: u(8) },
  name: { fontFamily: F.display, fontSize: u(15), lineHeight: u(19) },
});
