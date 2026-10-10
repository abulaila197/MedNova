import { Dimensions, useWindowDimensions } from 'react-native';

// Every locked design was drawn on a 282px-wide phone screen. Sizes in the
// app are written in those design pixels and scaled to the real screen width,
// so each device shows the same proportions as the approved previews.
// Tablets (SZ2): the app is a centred phone-shaped column, scaled to fit the height.
export const DESIGN_WIDTH = 282;
export const DESIGN_HEIGHT = 615;
const win = Dimensions.get('window');
export const TABLET = Math.min(win.width, win.height) >= 600;
export const K = TABLET ? Math.min(win.width / DESIGN_WIDTH, win.height / DESIGN_HEIGHT) : win.width / DESIGN_WIDTH;
/** Width of the app column: the whole screen on phones, the centred column on tablets. */
export const COLUMN_W = Math.min(win.width, DESIGN_WIDTH * K);
export const SCREEN_W = COLUMN_W;

// A worklet, so animated styles and gestures on the UI thread can call it too.
export const u = (n: number) => {
  'worklet';
  return n * K;
};

/** The app's drawing area: use instead of useWindowDimensions, so tablets get the column width. */
export function useScreen() {
  const { width, height } = useWindowDimensions();
  return { width: Math.min(width, COLUMN_W), height };
}
