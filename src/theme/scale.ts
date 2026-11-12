import { createContext, useContext } from 'react';
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
 *   - When that leaves only a sliver at the sides (under 4% of the width), the frame fills the width
 *     instead; the few pixels of extra height are absorbed by each page's flexible space.
 *   - Otherwise (tablets, short phones) the app is a centred column on the page colour (SZ2).
 *   - On Android the height is the whole screen: the window leaves out the navigation bar the app draws under.
 *   - On taller phones the extra height goes to each page's flexible space, never to stretching.
 *
 * Sizes in code are written in design px and passed through u(). The factor is fixed at launch, so
 * the phone's system bar sliding in or out moves page edges (flex) but never rescales the design. A real window
 * size change (split screen, a foldable opening) reloads the app on the same page (state/resize.ts).
 */
export { DESIGN_H, DESIGN_W } from './fit';

const frame = frameFit(Dimensions.get('window'), Dimensions.get('screen'), Platform.OS === 'android', Platform.OS !== 'ios');

/** Design px to screen px. */
export const K = frame.K;
/** Width of the app frame: the whole screen, or the centred column. */
export const FRAME_W = frame.frameW;
/** #12: the app is a centred column with sides (iPad, short phones), not the full screen width. */
export const IS_COLUMN = FRAME_W < Dimensions.get('window').width - 1;
/** Android tablet (look A, Yazan 2026-11-12): the app fills the screen and pages spread into the width. */
export const TABLET = frame.tablet;
/** The frame's width in design px: 282 on phones, about 560 on a 10-inch tablet. */
export const PAGE_W = FRAME_W / K;

/** Design px to screen px. A worklet, so animated styles and gestures can call it on the UI thread. */
export const u = (n: number) => {
  'worklet';
  return n * K;
};

/** The app frame's live size. Use instead of useWindowDimensions, which would give the whole screen. */
export function useScreen() {
  const { width, height } = useWindowDimensions();
  const col = useContext(ColumnW);
  return { width: Math.min(width, col ?? FRAME_W), height };
}

/**
 * On a tablet, a page not laid out for the width yet sits in a phone-wide column (Screen); everything inside it
 * measures that column, not the screen.
 */
export const ColumnW = createContext<number | null>(null);

/**
 * How far a full-screen layer inside the tablet column must reach out on each side to cover the whole screen
 * (a sheet's dimmed page, say). 0 outside a column.
 */
export function useBleed() {
  const col = useContext(ColumnW);
  return col == null ? 0 : Math.max(0, (FRAME_W - col) / 2);
}
