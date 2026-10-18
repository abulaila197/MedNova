import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Text } from '@/components/AppText';
import { PulseStar } from '@/components/PulseStar';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

import type { HuntCard } from './deck';

export const RATIO = 860 / 480;

/** Glass colours of the card saver. */
export const glass = (t: Theme) =>
  ({ edge: 'rgba(255,255,255,0.32)', line: 'rgba(200,215,255,0.22)', fill: 'rgba(190,205,255,0.07)', sheen: 'rgba(255,255,255,0.22)', lip: 'rgba(255,255,255,0.28)', shadow: 'rgba(0,0,0,0.55)' });

/**
 * A card in its glass saver (a toploader): clear rim, the card inside, a diagonal sheen and the open lip at the top.
 * Locked cards sit dimmed behind frosted glass with a small lock and can't be opened.
 */
export function Sleeve({ t, card, w, locked, style }: { t: Theme; card: HuntCard; w: number; locked: boolean; style?: StyleProp<ViewStyle> }) {
  const g = glass(t);
  const pad = Math.max(3, w * 0.045);
  const inner = w - pad * 2;
  const r = w * 0.07;
  return (
    <View style={[{ width: w, borderRadius: r, padding: pad, backgroundColor: g.fill, borderWidth: 1, borderColor: g.line, shadowColor: g.shadow, shadowOpacity: 1, shadowRadius: w * 0.08, shadowOffset: { width: 0, height: w * 0.04 } }, style]}>
      <View style={{ width: inner, height: inner * RATIO, borderRadius: r * 0.7, overflow: 'hidden', backgroundColor: '#0b0f2c' }}>
        <Image source={card.art} style={[StyleSheet.absoluteFill, { width: inner, height: inner * RATIO }, locked && { opacity: 0.16 }]} resizeMode="cover" />
        {locked ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,6,16,0.35)' }]} /> : null}
      </View>
      {/* sheen across the plastic */}
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', g.sheen, 'rgba(255,255,255,0)']} locations={[0.18, 0.32, 0.46]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: r }]} />
      {/* the open lip of the saver */}
      <View pointerEvents="none" style={{ position: 'absolute', left: pad * 1.6, right: pad * 1.6, top: pad * 0.45, height: 1, backgroundColor: g.lip }} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: r, borderWidth: 1, borderColor: g.edge, opacity: 0.6 }]} />
      {locked ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.mid]}>
          <Lock size={w * 0.2} color="rgba(220,225,255,0.6)" />
        </View>
      ) : null}
    </View>
  );
}

export function Lock({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <Path d="M12 14.5v2.5" />
    </Svg>
  );
}

/** The back of every card: navy with a gold frame, the Pulse star, and the clue (it's a printed card). */
export function CardBack({ card, w, i }: { card: HuntCard; w: number; i: number }) {
  const h = w * RATIO;
  const last = card.key === 'omar';
  return (
    <View style={{ width: w, height: h, borderRadius: w * 0.05, overflow: 'hidden', backgroundColor: '#132045' }}>
      <LinearGradient colors={['#1c2c5c', '#0e1734']} style={StyleSheet.absoluteFill} />
      <View style={[s.frame, { margin: w * 0.04, borderRadius: w * 0.035, borderColor: '#e9b44c' }]}>
        <View style={[s.frame2, { margin: w * 0.018, borderRadius: w * 0.025, borderColor: 'rgba(233,180,76,0.45)', padding: w * 0.07 }]}>
          <View style={s.mid}>
            <PulseStar width={w * 0.2} height={w * 0.21} glow={0.6} />
            <Text style={[s.kick, { fontSize: w * 0.04, marginTop: w * 0.05 }]}>{last ? 'THE LAST CARD' : 'YOUR NEXT CLUE'}</Text>
          </View>
          <Text style={[s.clue, { fontSize: w * (last ? 0.062 : 0.074), lineHeight: w * (last ? 0.088 : 0.1), marginTop: w * 0.06 }]}>{card.clue}</Text>
          {last ? <Text style={[s.prize, { fontSize: w * 0.05, marginTop: w * 0.05 }]}>200 tokens wait for you</Text> : null}
          <View style={{ flex: 1 }} />
          <View style={[s.foot, { borderTopColor: 'rgba(233,180,76,0.35)', paddingTop: w * 0.035 }]}>
            <Text style={[s.footT, { fontSize: w * 0.034 }]}>{card.name.toUpperCase()}</Text>
            <Text style={[s.footT, { fontSize: w * 0.034 }]}>{`${'★'.repeat(card.stars)}`}</Text>
            <Text style={[s.footT, { fontSize: w * 0.034 }]}>{`${i + 1} / 9`}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  mid: { alignItems: 'center', justifyContent: 'center' },
  frame: { flex: 1, borderWidth: 2 },
  frame2: { flex: 1, borderWidth: 1 },
  kick: { fontFamily: F.mono, color: '#e9b44c', letterSpacing: 2 },
  clue: { fontFamily: F.displayItalic, color: '#f3ecdc', textAlign: 'center' },
  prize: { fontFamily: F.bodyBold, color: '#e9b44c', textAlign: 'center' },
  foot: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1 },
  footT: { fontFamily: F.mono, color: 'rgba(243,236,220,0.7)', letterSpacing: 1 },
});
