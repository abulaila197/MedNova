import { Dimensions, Platform, useWindowDimensions } from 'react-native';

import { frameFit } from './fit';

/*
 * Responsive sizing for the whole app.
 *
 * Every approved design is drawn on a 282 x 615 phone screen ("the frame"). The app scales that
 * frame by ONE factor in both directions, so text, buttons, art, background and header keep exactly
 * the proportions of the design on every device, and nothing can slide onto anything else:
 *
 *   - The factor is the largest that fits the screen both ways (width and height).
 *   - When that leaves only a sliver at the sides (under 3% of the width), the frame fills the width
 *     instead; the few pixels of extra height are absorbed by each page's flexible space.
 *   - Otherwise (tablets, short phones) the app is a centred column on the page colour (SZ2).
 *   - On Android the height is the whole screen: the window leaves out the navigation bar the app draws under.
 *   - On taller phones the extra height goes to each page's flexible space, never to stretching.
 *
 * Sizes in code are written in design px and passed through u(). The factor is fixed at launch, so
 * the phone's system bar sliding in or out moves page edges (flex) but never rescales the design.
 */
export { DESIGN_H, DESIGN_W } from './fit';

const frame = frameFit(Dimensions.get('window'), Dimensions.get('screen'), Platform.OS === 'android');

/** Design px to screen px. */
export const K = frame.K;
/** Width of the app frame: the whole screen, or the centred column. */
export const FRAME_W = frame.frameW;

/** Design px to screen px. A worklet, so animated styles and gestures can call it on the UI thread. */
export const u = (n: number) => {
  'worklet';
  return n * K;
};

/** The app frame's live size. Use instead of useWindowDimensions, which would give the whole screen. */
export function useScreen() {
  const { width, height } = useWindowDimensions();
  return { width: Math.min(width, FRAME_W), height };
}
