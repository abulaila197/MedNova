import { Fragment } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { Text } from '@/components/AppText';
import { TokenCoin } from '@/components/PulseStar';

/** Put COIN in a label where the token symbol goes: `50/50 · 2${COIN}` (Yazan 2026-11-12: the symbol, never the word "token"). */
export const COIN = '{coin}';

/** The label as a screen reader says it: the symbol becomes the word. */
export const spoken = (label: string) => label.split(COIN).join(' tokens');

/** A one-line label that draws the header's token coin wherever COIN sits, sized to the text. */
export function CoinLabel({ text, style, numberOfLines }: { text: string; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const parts = text.split(COIN);
  if (parts.length === 1) return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  const flat = StyleSheet.flatten(style) ?? {};
  const fs = flat.fontSize ?? 14;
  const align = flat.textAlign === 'left' ? 'flex-start' : flat.textAlign === 'right' ? 'flex-end' : 'center';
  return (
    <View style={[s.row, { justifyContent: align, opacity: flat.opacity ?? 1 }]}>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p ? <Text style={[style, { opacity: 1, flexShrink: 1 }]} numberOfLines={numberOfLines ?? 1}>{p}</Text> : null}
          {i < parts.length - 1 ? (
            <View style={{ marginStart: fs * 0.22, marginEnd: parts[i + 1] ? fs * 0.22 : 0 }}>
              <TokenCoin size={Math.round(fs * 1.25)} progress={0} track="transparent" />
            </View>
          ) : null}
        </Fragment>
      ))}
    </View>
  );
}

const s = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%' } });
