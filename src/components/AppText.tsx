import { Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';

// Every screen is laid out at fixed design sizes, so a very large phone text-size setting
// pushed words onto the art, the header and the buttons. Text still grows with the setting,
// but only up to this much.
export const MAX_FONT_SCALE = 1.15;

/** react-native Text with the text-size cap. Use instead of importing Text from react-native. */
export function Text(props: TextProps & { ref?: React.Ref<RNText> }) {
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
export type Text = RNText;

/** react-native TextInput with the text-size cap. */
export function TextInput(props: TextInputProps & { ref?: React.Ref<RNTextInput> }) {
  return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
export type TextInput = RNTextInput;
