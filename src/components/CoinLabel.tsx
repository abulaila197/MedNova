import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { Text } from '@/components/AppText';
import { TokenCoin } from '@/components/PulseStar';
import { Bolt } from '@/features/sparks/Bolt';

/** Put COIN in a label where the token symbol goes: `50/50 · 2${COIN}` (Yazan 2026-11-12: the symbol, never the word "token"). */
export const COIN = '{coin}';

/** Put SPARK in a label where the Sparks bolt goes: `Retry  30${SPARK}` (Yazan 2026-11-13: replay buttons show their cost). */
export const SPARK = '{spark}';

/** A button label with the Sparks it costs, the same price the setup page showed; no cost, no tag. */
export const priced = (label: string, cost: number) => (cost > 0 ? `${label}  ${cost}${SPARK}` : label);

/** The label as a screen reader says it: the symbols become words. */
export const spoken = (label: string) => label.split(COIN).join(' tokens').split(SPARK).join(' Sparks');

/** A one-line label that draws the header's token coin wherever COIN sits, sized to the text. */
export function CoinLabel({ text, style, numberOfLines }: { text: string; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  // Each mark is kept as its own part, so a label can hold coins, bolts or both.
  const parts = text.split(/(\{coin\}|\{spark\})/);
  // A price label on a centred button keeps its full width: shrinking there cut "Rematch · 25" to "Remat..." on web.
  const bolt = parts.includes(SPARK);
  if (parts.length === 1) return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  const flat = StyleSheet.flatten(style) ?? {};
  const fs = flat.fontSize ?? 14;
  const align = flat.textAlign === 'left' ? 'flex-start' : flat.textAlign === 'right' ? 'flex-end' : 'center';
  return (
    <View style={[s.row, { justifyContent: align, opacity: flat.opacity ?? 1 }]}>
      {parts.map((p, i) =>
        p === COIN || p === SPARK ? (
          <View key={i} style={{ marginStart: p === SPARK ? fs * 0.08 : fs * 0.22, marginEnd: parts[i + 1] ? fs * 0.22 : 0 }}>
            {p === COIN ? <TokenCoin size={Math.round(fs * 1.25)} progress={0} track="transparent" /> : <Bolt size={Math.round(fs * 1.1)} color={typeof flat.color === 'string' ? flat.color : undefined} />}
          </View>
        ) : p ? (
          <Text key={i} style={[style, { opacity: 1, flexShrink: bolt ? 0 : 1 }]} numberOfLines={numberOfLines ?? 1}>{p}</Text>
        ) : null,
      )}
    </View>
  );
}

const s = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%' } });
