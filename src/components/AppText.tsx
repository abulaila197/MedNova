import { AR_LETTERS, isAr } from '@/i18n';
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
// own height; Android mostly lets them spill, so tight display titles ("Play", game names) only broke on iPhone (Yazan
// 2026-11-08). Such a text gets a little room above and below, taken back by equal negative margins, so the letters
// draw whole and the layout doesn't move. Texts with a background or a border are left alone.
// Android cut them too, on lines only a little taller than the font ("Continue as guest", Yazan 2026-11-09), so it gets
// the same room, from a slightly looser line height.
const TIGHT = Platform.OS === 'android' ? 1.3 : 1.2;
const ROOM = 1.36;
const num = (v: unknown) => (typeof v === 'number' ? v : v == null ? 0 : NaN);
function letterRoom(style: TextProps['style']): TextStyle | null {
  const f = StyleSheet.flatten(style) as TextStyle | undefined;
  if (!f?.fontSize || !f.lineHeight || f.lineHeight >= f.fontSize * TIGHT) return null;
  if (f.backgroundColor || f.borderWidth || f.borderTopWidth || f.borderBottomWidth) return null;
  // A text boxed to its own line height (big numbers and names, "57%", "Dr. Huda") was left alone and its bottoms were
  // cut on small Android phones (Yazan 2026-11-11): the box grows by the same room, and the margins take it back.
  if (f.height != null && (typeof f.height !== 'number' || f.height >= f.fontSize * TIGHT)) return null;
  const box = typeof f.height === 'number' ? Math.max(f.height, f.lineHeight) : f.lineHeight;
  const pad = Math.ceil((f.fontSize * ROOM - box) / 2);
  if (pad <= 0) return null;
  const pt = num(f.paddingTop ?? f.paddingVertical ?? f.padding);
  const pb = num(f.paddingBottom ?? f.paddingVertical ?? f.padding);
  const mt = num(f.marginTop ?? f.marginVertical ?? f.margin);
  const mb = num(f.marginBottom ?? f.marginVertical ?? f.margin);
  if ([pt, pb, mt, mb].some(Number.isNaN)) return null;
  const room: TextStyle = { paddingTop: pt + pad, paddingBottom: pb + pad, marginTop: mt - pad, marginBottom: mb - pad };
  if (typeof f.height === 'number') room.height = f.height + 2 * pad;
  return room;
}

// Arabic fonts (Yazan 2026-11-13): big headings in Alexandria Bold, everything else in IBM Plex Sans Arabic. A text
// takes them only when it has Arabic letters, so English medical words inside an Arabic screen keep the app's fonts.
// Arabic letters join, so letter spacing (used by the small mono labels) is dropped, and the taller Arabic letters
// get a slightly roomier line.
const BIG = 18;
const AR_FONT: Record<string, string> = {
  InterTight_400Regular: 'IBMPlexSansArabic_400Regular',
  InterTight_500Medium: 'IBMPlexSansArabic_500Medium',
  InterTight_600SemiBold: 'IBMPlexSansArabic_600SemiBold',
  InterTight_700Bold: 'IBMPlexSansArabic_700Bold',
  JetBrainsMono_500Medium: 'IBMPlexSansArabic_600SemiBold',
};
function hasArabic(children: unknown): boolean {
  if (typeof children === 'string') return AR_LETTERS.test(children);
  return Array.isArray(children) && children.some((c) => typeof c === 'string' && AR_LETTERS.test(c));
}
function arabicStyle(style: TextProps['style']): TextStyle {
  const f = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const size = f.fontSize ?? 14;
  const fam = f.fontFamily === 'Gabarito_700Bold' ? (size >= BIG ? 'Alexandria_700Bold' : 'IBMPlexSansArabic_700Bold') : (f.fontFamily && AR_FONT[f.fontFamily]) || 'IBMPlexSansArabic_400Regular';
  const out: TextStyle = { fontFamily: fam, letterSpacing: 0 };
  if (f.lineHeight && f.lineHeight < size * 1.45) out.lineHeight = Math.round(size * 1.45);
  return out;
}

/** react-native Text with the text-size cap. Use instead of importing Text from react-native. */
export function Text(props: TextProps & { ref?: React.Ref<RNText> }) {
  // Game seats keep the English name 'You' as a marker for the phone owner (game code compares it), so the word
  // itself is swapped only where it is drawn.
  if (isAr && props.children === 'You') props = { ...props, children: 'انت' };
  // The Arabic fonts are only loaded when the app runs in Arabic.
  const ar = isAr && hasArabic(props.children);
  const style = ar ? [props.style, arabicStyle(props.style)] : props.style;
  const room = Platform.OS === 'web' ? null : letterRoom(style);
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} textBreakStrategy={BREAK} {...props} style={room ? [style, room] : style} />;
}
// eslint-disable-next-line @typescript-eslint/no-redeclare -- the type that goes with the component, as in react-native
export type Text = RNText;

/** react-native TextInput with the text-size cap. */
export function TextInput(props: TextInputProps & { ref?: React.Ref<RNTextInput> }) {
  return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
// eslint-disable-next-line @typescript-eslint/no-redeclare -- the type that goes with the component, as in react-native
export type TextInput = RNTextInput;
