import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { Fade } from '@/components/Fade';
import { Post } from '@/features/community/Post';
import { MERCH, SHELF_WALLPAPERS, Shelf } from '@/features/community/Shelf';
import { Socials } from '@/features/community/Socials';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tr } from '@/i18n';

// The page name (Yazan, 2026-10-13: Community is announcements, no "This week").
export const PAGE = { lead: tr('From the'), em: tr('Lab') };

const VISION = [
  tr('We believe the most beautiful science in the world should never feel like a chore. Every heartbeat, every nerve, every diagnosis is a story waiting to be played.'),
  tr('MedNova turns long nights of memorising into moments of wonder, rivalry and laughter, so that learning medicine feels less like surviving and more like falling in love with it all over again.'),
];
const BUILD = [
  tr('MedNova took many months of quiet, stubborn work. We could have shipped one more quiz app. Instead we built ten games, each with its own world, its own rules and its own surprises.'),
  tr('Live matches refereed by our server, pass-the-phone nights with friends, a Learn space that remembers every miss. We poured ourselves into every detail, and we truly hope you love playing it as much as we loved making it.'),
];

/** Community: the MedNova team's announcements, with the wallpapers and the merch on their shelves. */
export function Feed() {
  const t = useTheme();
  return (
    <Fade veil stops={[[0, 1], [0.82, 1], [1, 0]]} style={s.area}>
      <ScrollView style={s.fill} contentContainerStyle={s.c2} showsVerticalScrollIndicator={false}>
        <View style={s.head}>
          <Text style={[s.kick, { color: t.kick }]}>{tr('NOVA COMMUNITY')}</Text>
          <Text style={[s.h2, { color: t.white }]}>
            {PAGE.lead} <Text style={{ fontFamily: F.displayItalic, color: t.accent }}>{PAGE.em}</Text>
          </Text>
        </View>
        <Socials />
        <Shelf lead={tr('Nova')} em={tr('Wallpapers')} photos={SHELF_WALLPAPERS} to="/community/wallpapers" />
        <Post id="vision" kick={tr('OUR VISION')} lead={tr('Medicine,')} em={tr('reimagined as wonder')} body={VISION} />
        {/* A look-ahead, not an unfinished store (audit call 2, Yazan 2026-11-08). */}
        <Shelf lead={tr('Nova')} em={tr('merch')} note={tr('Preview')} photos={MERCH} to="/community/soon" />
        <Post id="build" kick={tr('BEHIND MEDNOVA')} lead={tr('Built slowly,')} em={tr('with care')} body={BUILD} />
      </ScrollView>
    </Fade>
  );
}

const s = StyleSheet.create({
  area: { flex: 1, marginTop: u(16) },
  fill: { flex: 1 },
  c2: { paddingHorizontal: u(14), gap: u(12), paddingBottom: u(90) },
  head: { marginBottom: u(2) },
  kick: { marginTop: u(7), lineHeight: u(12), fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.7) },
  h2: { marginTop: u(3), fontFamily: F.display, fontSize: u(25), lineHeight: u(28) },
});
