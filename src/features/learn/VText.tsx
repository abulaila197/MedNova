import { Text, View, type TextStyle } from 'react-native';

/**
 * Text set vertically in a box of known size (CSS writing-mode: vertical-rl).
 * dir 'down' reads top to bottom; dir 'up' reads bottom to top (vertical-rl + rotate(180deg)).
 * top: the text hangs from the top edge of the box (and may run past the bottom, as in CSS); otherwise it is centred.
 */
export function VText({ w, h, line, style, dir = 'down', top = false, children }: { w?: number; h: number; line: number; style: TextStyle; dir?: 'up' | 'down'; top?: boolean; children: string }) {
  const L = h + 200; // generous run so long words overflow instead of wrapping
  const cy = top ? L / 2 : h / 2; // centre of the run, measured down from the box top
  return (
    <View style={{ width: w ?? '100%', height: h }} pointerEvents="none">
      <Text
        style={[
          style,
          {
            position: 'absolute',
            width: L,
            height: line,
            lineHeight: line,
            left: '50%',
            marginLeft: -L / 2,
            top: cy - line / 2,
            textAlign: top ? (dir === 'up' ? 'right' : 'left') : 'center',
            transform: [{ rotate: dir === 'up' ? '-90deg' : '90deg' }],
          },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}
