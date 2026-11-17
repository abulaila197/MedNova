import { AR_LETTERS, isAr } from '@/i18n';
import { K } from '@/theme/scale';
import { Platform, StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps, type TextStyle } from 'react-native';

// Every screen is laid out at fixed design sizes and scaled as one piece (theme/scale.ts), so text
// that grew with the phone's text-size setting outgrew the art and crowded the buttons. Text keeps
// the design size relative to the art on every phone (Yazan, 2026-10-19).
export const MAX_FONT_SCALE = 1;

// On Android the default "highQuality" line breaking can measure a text a little narrower than it draws in our own
// fonts, so the last word wraps onto a line that has no room and vanishes ("The Road to" with no "Diagnosis",
// Yazan 2026-10-27). "simple" measures and draws the same way, so every text in the app keeps all its words.
const BREAK = Platform.OS === 'android' ? 'simple' : undefined;

// A line height smaller than the font's own height cuts off the tops of letters (and the bottoms of g, y, p): iPhone
// cut tight display titles ("Play", game names, Yazan 2026-11-08), Android cut lines only a little taller than the
// font ("Continue as guest", 2026-11-09), names and numbers boxed to their line height ("Dr. Huda", "57%", 2026-11-11)
// and the profile name and stats (2026-11-17). Such a text gets more room, and equal negative margins take it back so
// the layout doesn't move. Texts with a background or a border are left alone.
// The room is made differently per system. iPhone draws into padding, so it gets padding. Android clips a text to the
// inside of its padding, so padding gave it nothing (that is why the 2026-11-09 and 11-11 fixes didn't hold there):
// it gets a taller line instead, which Android centres the letters in.
// A text boxed to a height smaller than its line (Arabic raises the line height, the box stayed) grows its box too.
const ANDROID = Platform.OS === 'android';
const TIGHT = ANDROID ? 1.3 : 1.2;
const ROOM = 1.36;
const num = (v: unknown) => (typeof v === 'number' ? v : v == null ? 0 : NaN);
function letterRoom(style: TextProps['style']): TextStyle | null {
  const f = StyleSheet.flatten(style) as TextStyle | undefined;
  if (!f?.fontSize) return null;
  if (f.backgroundColor || f.borderWidth || f.borderTopWidth || f.borderBottomWidth) return null;
  if (f.height != null && typeof f.height !== 'number') return null;
  const lh = f.lineHeight;
  const h = f.height as number | undefined;
  if (lh == null && h == null) return null;
  const tight = lh != null && lh < f.fontSize * TIGHT;
  // What one line needs, and the box it gets now.
  const line = tight || lh == null ? Math.ceil(f.fontSize * ROOM) : lh;
  const box = h ?? (lh as number);
  const want = Math.max(box, line);
  if (want <= box) return null;
  const pad = (want - box) / 2;
  const mt = num(f.marginTop ?? f.marginVertical ?? f.margin);
  const mb = num(f.marginBottom ?? f.marginVertical ?? f.margin);
  if ([mt, mb].some(Number.isNaN)) return null;
  const room: TextStyle = { marginTop: mt - pad, marginBottom: mb - pad };
  if (h != null) room.height = want;
  if (ANDROID || !tight) {
    if (tight) room.lineHeight = line;
  } else {
    const pt = num(f.paddingTop ?? f.paddingVertical ?? f.padding);
    const pb = num(f.paddingBottom ?? f.paddingVertical ?? f.padding);
    if ([pt, pb].some(Number.isNaN)) return null;
    room.paddingTop = pt + pad;
    room.paddingBottom = pb + pad;
  }
  return room;
}

/**
 * Android measures some Arabic texts a little narrower than it draws them, so a short label's last word went to a
 * line with no room and vanished ("غيّر" with no "الإطار", Yazan 2026-11-17). A no-break space on each side gives the
 * measured width that much to spare, evenly, and can't itself break off. Elsewhere the label is unchanged.
 */
export const roomy = (label: string) => (ANDROID && isAr && AR_LETTERS.test(label) ? `\u00A0${label}\u00A0` : label);

// Arabic fonts (Yazan 2026-11-13): big headings in Alexandria Bold, everything else in IBM Plex Sans Arabic. A text
// takes them only when it has Arabic letters, so English medical words inside an Arabic screen keep the app's fonts.
// Arabic letters join, so letter spacing (used by the small mono labels) is dropped, and the taller Arabic letters
// get a slightly roomier line.
const BIG = 18;
// Option A (Yazan 2026-11-15): Arabic keeps its size and boxes grow to fit, but the big page titles (design size 26
// and up, Alexandria) are 10% smaller, as Arabic words run longer than English and wrapped to a second line.
const TITLE = 26;
const TITLE_SHRINK = 0.9;
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
// Fonts that already have Arabic letters (the loading pages' own fonts) are kept as they are.
const AR_OWN = /^(Lalezar|Changa|Marhey|ArefRuqaa|Amiri|Rakkas|ReemKufi|Alexandria|IBMPlexSansArabic)_/;
function arabicStyle(style: TextProps['style']): TextStyle {
  const f = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const size = f.fontSize ?? 14;
  if (f.fontFamily && AR_OWN.test(f.fontFamily)) return { letterSpacing: 0 };
  const fam = f.fontFamily === 'Gabarito_700Bold' ? (size >= BIG ? 'Alexandria_700Bold' : 'IBMPlexSansArabic_700Bold') : (f.fontFamily && AR_FONT[f.fontFamily]) || 'IBMPlexSansArabic_400Regular';
  const out: TextStyle = { fontFamily: fam, letterSpacing: 0 };
  if (fam === 'Alexandria_700Bold' && size >= TITLE * K) {
    out.fontSize = size * TITLE_SHRINK;
    if (f.lineHeight) out.lineHeight = Math.round(Math.max(f.lineHeight * TITLE_SHRINK, out.fontSize * 1.45));
    return out;
  }
  if (f.lineHeight && f.lineHeight < size * 1.45) out.lineHeight = Math.round(size * 1.45);
  return out;
}

/** react-native Text with the text-size cap. Use instead of importing Text from react-native. */
export function Text(props: TextProps & { ref?: React.Ref<RNText> }) {
  // Game seats keep the English name 'You' as a marker for the phone owner (game code compares it), so the word
  // itself is swapped only where it is drawn.
  if (isAr && props.children === 'You') props = { ...props, children: 'إنت' };
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
