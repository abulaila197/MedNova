import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * A KeyboardAvoidingView that knows how far down the screen it starts. RN's KAV compares its own frame (relative to
 * its parent) with the keyboard's screen position, so under the safe area and the game header it lifts too little
 * and the keyboard covers the answer box. This measures the wrapper's top in the window and passes it as
 * keyboardVerticalOffset. With the keyboard closed the layout is the same as a plain flex: 1 view. Use
 * behavior 'height' when the content is absolutely placed (it ignores padding but follows the view's height).
 */
export function KeyboardLift({ style, behavior = 'padding', children }: { style?: StyleProp<ViewStyle>; behavior?: 'padding' | 'height'; children: ReactNode }) {
  const ref = useRef<View>(null);
  const [top, setTop] = useState(0);
  const measure = () => ref.current?.measureInWindow((_x, y) => setTop(Math.max(0, Math.round(y))));
  // Measure again once the screen's entry animation has settled.
  useEffect(() => {
    const id = setTimeout(measure, 500);
    return () => clearTimeout(id);
  }, []);
  return (
    <View ref={ref} style={s.fill} onLayout={measure}>
      <KeyboardAvoidingView style={style ?? s.fill} behavior={Platform.OS === 'web' ? undefined : behavior} keyboardVerticalOffset={top}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({ fill: { flex: 1 } });
