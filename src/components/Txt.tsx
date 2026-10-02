import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/state/app';
import { F } from '@/theme/tokens';

/** Display line where the part in `em` is the accent word (cyan on dark, orange on light). */
export function Display({ children, em, italic = false, style, emStyle, ...rest }: TextProps & { em?: string; italic?: boolean; emStyle?: TextStyle }) {
  const t = useTheme();
  return (
    <Text {...rest} style={[{ fontFamily: F.display, color: t.white }, style]}>
      {children}
      {em ? <Text style={[{ color: t.accent, fontFamily: italic ? F.displayItalic : F.display }, emStyle]}>{em}</Text> : null}
    </Text>
  );
}
