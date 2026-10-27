import { Platform, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';

// Every screen is laid out at fixed design sizes and scaled as one piece (theme/scale.ts), so text
// that grew with the phone's text-size setting outgrew the art and crowded the buttons. Text keeps
// the design size relative to the art on every phone (Yazan, 2026-10-19).
export const MAX_FONT_SCALE = 1;

// On Android the default "highQuality" line breaking can measure a text a little narrower than it draws in our own
// fonts, so the last word wraps onto a line that has no room and vanishes ("The Road to" with no "Diagnosis",
// Yazan 2026-10-27). "simple" measures and draws the same way, so every text in the app keeps all its words.
const BREAK = Platform.OS === 'android' ? 'simple' : undefined;

/** react-native Text with the text-size cap. Use instead of importing Text from react-native. */
export function Text(props: TextProps & { ref?: React.Ref<RNText> }) {
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} textBreakStrategy={BREAK} {...props} />;
}
// eslint-disable-next-line @typescript-eslint/no-redeclare -- the type that goes with the component, as in react-native
export type Text = RNText;

/** react-native TextInput with the text-size cap. */
export function TextInput(props: TextInputProps & { ref?: React.Ref<RNTextInput> }) {
  return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
// eslint-disable-next-line @typescript-eslint/no-redeclare -- the type that goes with the component, as in react-native
export type TextInput = RNTextInput;
