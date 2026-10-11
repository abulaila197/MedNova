import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { create } from 'zustand';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { useLearnColors } from './palette';
import { VText } from './VText';

export type Book = { key: string; name: string; spine: string; total: number; missed: number };
export type BookLook = 'upright' | 'leaning' | 'stacked';

/** Preview only: which book look the Dossiers page draws (RL6 preview, 2026-10-11). */
export const useBookLook = create<{ look: BookLook }>(() => ({ look: 'upright' }));

const H = 108; // every book is the same height (RL6)
const MIN = 17; // thinnest spine still fits its name

/** One shelf of specialty books (RL6): same height, width from the specialty's total dossiers, the miss count at the foot. */
export function BookShelf({ books, look, onOpen }: { books: Book[]; look: BookLook; onOpen: (b: Book) => void }) {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const flat = look === 'stacked' ? books.slice(-2) : [];
  const up = look === 'stacked' ? books.slice(0, -2) : books;
  const spine = (b: Book, i: number, extra?: object) => {
    const col = c.spineColors[i % c.spineColors.length];
    return (
      <Pressable
        key={b.key}
        onPress={() => onOpen(b)}
        accessibilityRole="button"
        accessibilityLabel={`${b.name}, ${b.missed} missed`}
        style={[s.book, { height: u(H), flexGrow: b.total, borderColor: c.spineLine, boxShadow: c.spineShadow }, extra]}
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
        <Text style={[s.count, { color: b.missed ? t.fg : c.mute }]}>{b.missed}</Text>
      </Pressable>
    );
  };
  return (
    <View style={s.shelf}>
      <View style={[s.row, { height: u(4 + H) }]}>
        {up.map((b, i) =>
          spine(b, i, look === 'leaning' && i === up.length - 1 ? s.lean : look === 'leaning' && i === 2 ? s.leanR : undefined),
        )}
        {flat.length ? (
          <View style={s.pile}>
            {flat.map((b, i) => {
              const col = c.spineColors[(up.length + i) % c.spineColors.length];
              return (
                <Pressable
                  key={b.key}
                  onPress={() => onOpen(b)}
                  accessibilityRole="button"
                  accessibilityLabel={`${b.name}, ${b.missed} missed`}
                  style={[s.flat, { height: u(MIN + b.total * 0.35), borderColor: c.spineLine, marginLeft: u(i ? 6 : 0) }]}
                >
                  <LinearGradient colors={[c.spineA, c.spineB]} style={StyleSheet.absoluteFill} />
                  <View style={[s.fband, { backgroundColor: col }]} />
                  <Text numberOfLines={1} style={[s.fname, { color: t.fg }]}>
                    {b.spine}
                  </Text>
                  <Text style={[s.fcount, { color: b.missed ? t.fg : c.mute }]}>{b.missed}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
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
  pile: { width: u(96), justifyContent: 'flex-end', gap: u(2) },
  flat: { width: u(90), borderWidth: 1, borderRadius: u(3), overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: u(6) },
  fband: { position: 'absolute', left: u(6), top: u(3), bottom: u(3), width: u(2), borderRadius: u(1), opacity: 0.85 },
  fname: { flex: 1, marginLeft: u(6), fontFamily: F.display, fontSize: u(9.5), lineHeight: u(12) },
  fcount: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(11) },
  ledge: { height: u(6), marginHorizontal: u(2), borderRadius: u(2) },
});
