import { Platform, StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps, type TextStyle } from 'react-native';

// Every screen is laid out at fixed design sizes and scaled as one piece (theme/scale.ts), so text
// that grew with the phone's text-size setting outgrew the art and crowded the buttons. Text keeps
// the design size relative to the art on every phone (Yazan, 2026-10-19).
export const MAX_FONT_SCALE = 1;

// On Android the default "highQuality" line breaking can measure a text a little narrower than it draws in our own
// fonts, so the last word wraps onto a line that has no room and vanishes ("The Road to" with no "Diagnosis",
// Yazan 2026-10-27). "simple" measures and draws the same way, so every text in the app keeps all its words.
const BREAK = Platform.OS === 'android' ? 'simple' : undefined;

// iPhone cuts off the tops of letters (and the bottoms of g, y, p) that reach past a line height smaller than the font's
// own height; Android lets them spill, so tight display titles ("Play", game names) only broke on iPhone (Yazan
// 2026-11-08). Such a text gets a little room above and below, taken back by equal negative margins, so the letters
// draw whole and the layout doesn't move. Texts with a fixed height, a background or a border are left alone.
const TIGHT = 1.2;
const ROOM = 1.36;
const num = (v: unknown) => (typeof v === 'number' ? v : v == null ? 0 : NaN);
function iosRoom(style: TextProps['style']): TextStyle | null {
  const f = StyleSheet.flatten(style) as TextStyle | undefined;
  if (!f?.fontSize || !f.lineHeight || f.lineHeight >= f.fontSize * TIGHT) return null;
  if (f.height != null || f.backgroundColor || f.borderWidth || f.borderTopWidth || f.borderBottomWidth) return null;
  const pad = Math.ceil((f.fontSize * ROOM - f.lineHeight) / 2);
  const pt = num(f.paddingTop ?? f.paddingVertical ?? f.padding);
  const pb = num(f.paddingBottom ?? f.paddingVertical ?? f.padding);
  const mt = num(f.marginTop ?? f.marginVertical ?? f.margin);
  const mb = num(f.marginBottom ?? f.marginVertical ?? f.margin);
  if ([pt, pb, mt, mb].some(Number.isNaN)) return null;
  return { paddingTop: pt + pad, paddingBottom: pb + pad, marginTop: mt - pad, marginBottom: mb - pad };
}

/** react-native Text with the text-size cap. Use instead of importing Text from react-native. */
export function Text(props: TextProps & { ref?: React.Ref<RNText> }) {
  const room = Platform.OS === 'ios' ? iosRoom(props.style) : null;
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} textBreakStrategy={BREAK} {...props} style={room ? [props.style, room] : props.style} />;
}
// eslint-disable-next-line @typescript-eslint/no-redeclare -- the type that goes with the component, as in react-native
export type Text = RNText;

/** react-native TextInput with the text-size cap. */
export function TextInput(props: TextInputProps & { ref?: React.Ref<RNTextInput> }) {
  return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
// eslint-disable-next-line @typescript-eslint/no-redeclare -- the type that goes with the component, as in react-native
export type TextInput = RNTextInput;
