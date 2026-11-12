import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { GAMES } from '@/data/games';
import { STRIP } from '@/features/games/strips';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** Tablet side panel of a game's setup and landing pages: its poster strip, sub name and what it is about. */
export function GamePanel({ game }: { game: string }) {
  const t = useTheme();
  const g = GAMES.find((x) => x.key === game);
  if (!g) return null;
  return (
    <View style={[s.card, { borderColor: t.panelLine, backgroundColor: t.panel }]}>
      {STRIP[game] ? (
        <View style={s.pic}>
          <Image source={STRIP[game]} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} accessible={false} />
        </View>
      ) : null}
      <View style={s.txt}>
        <Text style={[s.sub, { color: t.accent }]}>{g.sub.toUpperCase()}</Text>
        <Text style={[s.desc, { color: t.soft }]}>{g.desc}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: u(16), borderWidth: 1, overflow: 'hidden' },
  pic: { height: u(96), backgroundColor: '#0b1331' },
  txt: { padding: u(12), gap: u(6) },
  sub: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(11), letterSpacing: u(1.2) },
  desc: { fontFamily: F.body, fontSize: u(11), lineHeight: u(15.5) },
});
