import { Dimensions, useWindowDimensions } from 'react-native';

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
 *   - On taller phones the extra height goes to each page's flexible space, never to stretching.
 *
 * Sizes in code are written in design px and passed through u(). The factor is fixed at launch, so
 * the phone's system bar sliding in or out moves page edges (flex) but never rescales the design.
 */
export const DESIGN_W = 282;
export const DESIGN_H = 615;
const SLIVER = 0.03;

const win = Dimensions.get('window');
const fit = Math.min(win.width / DESIGN_W, win.height / DESIGN_H);
const fillsWidth = DESIGN_W * fit >= win.width * (1 - SLIVER);

/** Design px to screen px. */
export const K = fillsWidth ? win.width / DESIGN_W : fit;
/** Width of the app frame: the whole screen, or the centred column. */
export const FRAME_W = Math.min(win.width, DESIGN_W * K);

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
