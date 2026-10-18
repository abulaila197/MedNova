import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { RARITY, type Item } from './data';

/** One item square (Yazan's grid reference): dark tile, the art filling it, a rarity bar along the bottom. */
export function ItemTile({ item, size, owned, count }: { item: Item; size: number; owned?: boolean; count?: number }) {
  const t = useTheme();
  const r = RARITY[item.rarity];
  return (
    <View style={[s.tile, { width: size, height: size, borderColor: `${r.color}66`, backgroundColor: '#0a1230' }]}>
      {item.art ? (
        <Image source={item.art} style={item.kind === 'sticker' ? s.sticker : StyleSheet.absoluteFill} contentFit={item.kind === 'sticker' ? 'contain' : 'cover'} />
      ) : item.kind === 'effect' ? (
        <View style={s.center}>
          <Text style={[s.fx, { color: r.color, fontSize: size * 0.2 }]} numberOfLines={2}>
            {item.name.toUpperCase()}
          </Text>
        </View>
      ) : (
        <View style={s.center}>
          <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24">
            <Path d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 17H10l-4.5 3.5V17H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 5Z" stroke={r.color} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
            <Path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01" stroke={r.color} strokeWidth={2.4} strokeLinecap="round" />
          </Svg>
        </View>
      )}
      {item.stars ? (
        <View style={s.stars}>
          <Text style={[s.starT, { color: '#ffd76a', fontSize: size * 0.15 }]}>{'★'.repeat(item.stars)}</Text>
        </View>
      ) : null}
      {count && count > 1 ? <Text style={[s.count, { color: t.fg }]}>{`×${count}`}</Text> : null}
      {owned ? <View style={[s.own, { backgroundColor: r.color }]} /> : null}
      <View style={[s.bar, { backgroundColor: r.color }]} />
    </View>
  );
}

const s = StyleSheet.create({
  tile: { borderRadius: u(7), borderWidth: 1, overflow: 'hidden' },
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: u(2) },
  sticker: { position: 'absolute', left: '8%', right: '8%', top: '8%', bottom: '12%' },
  fx: { fontFamily: F.display, textAlign: 'center', letterSpacing: u(0.3) },
  stars: { position: 'absolute', left: 0, right: 0, bottom: u(3), alignItems: 'center' },
  starT: { textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
  count: { position: 'absolute', right: u(3), top: u(1), fontFamily: F.bodyBold, fontSize: u(8), textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
  own: { position: 'absolute', left: u(3), top: u(3), width: u(4), height: u(4), borderRadius: u(2) },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: u(2.5) },
});
