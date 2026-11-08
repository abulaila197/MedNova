import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { Book } from './library';
import { useLearnColors } from './palette';
import { VText } from './VText';

const H = 108; // every book is the same height (RL6)
const MIN = 17; // the thinnest spine still fits its name

/**
 * One shelf of specialty books, look "Leaning" (RL6, picked 2026-10-11): same height, width from the specialty's
 * total dossiers, the player's miss count at the foot. The third book leans right and the last leans left.
 */
export function BookShelf({ books, missed, onOpen }: { books: Book[]; missed: (b: Book) => number; onOpen: (b: Book) => void }) {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  return (
    <View style={s.shelf}>
      <View style={[s.row, { height: u(4 + H) }]}>
        {books.map((b, i) => {
          const col = c.spineColors[i % c.spineColors.length];
          const n = missed(b);
          return (
            <Pressable
              key={b.key}
              onPress={() => onOpen(b)}
              accessibilityRole="button"
              accessibilityLabel={`${b.name}, ${n} missed`}
              style={[
                s.book,
                { height: u(H), flexGrow: b.ids.length, borderColor: c.spineLine, boxShadow: c.spineShadow },
                i === books.length - 1 ? s.lean : i === 2 ? s.leanR : undefined,
              ]}
            >
              <LinearGradient colors={[c.spineA, c.spineB]} style={StyleSheet.absoluteFill} />
              <LinearGradient colors={[...c.spineSheen]} locations={[0, 0.3, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <View style={[s.band, { backgroundColor: col, top: u(7) }]} />
              <View style={[s.band, { backgroundColor: col, bottom: u(21) }]} />
              <View style={s.name}>
                <VText h={u(H - 12 - 26)} line={u(12)} dir="up" top style={{ fontFamily: F.display, fontSize: u(9), letterSpacing: u(0.1), color: t.fg }}>
                  {b.spine}
                </VText>
              </View>
              <Text style={[s.count, { color: n ? t.fg : c.mute }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <LinearGradient colors={[c.sledgeA, c.sledgeB]} style={[s.ledge, { boxShadow: c.sledgeShadow }]} />
    </View>
  );
}

const s = StyleSheet.create({
  shelf: { marginHorizontal: u(-4) },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: u(4), paddingTop: u(4), paddingHorizontal: u(4) },
  book: {
    flexBasis: 0,
    minWidth: u(MIN),
    borderWidth: 1,
    borderTopLeftRadius: u(4),
    borderTopRightRadius: u(4),
    borderBottomLeftRadius: u(2),
    borderBottomRightRadius: u(2),
    overflow: 'hidden',
  },
  lean: { transform: [{ rotate: '-9deg' }], transformOrigin: 'left bottom', marginLeft: u(16), marginRight: u(2) },
  leanR: { transform: [{ rotate: '7deg' }], transformOrigin: 'right bottom', marginRight: u(14) },
  band: { position: 'absolute', left: u(3), right: u(3), height: u(2), borderRadius: u(1), opacity: 0.85 },
  name: { position: 'absolute', left: 0, right: 0, top: u(13) },
  count: { position: 'absolute', left: 0, right: 0, bottom: u(6), textAlign: 'center', fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(11) },
  ledge: { height: u(6), marginHorizontal: u(2), borderRadius: u(2) },
});
