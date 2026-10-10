/** Every approved design is drawn on this frame (see scale.ts). */
export const DESIGN_W = 282;
export const DESIGN_H = 615;
const SLIVER = 0.03;
/** Shortest side of a tablet, in dp. */
const TABLET = 600;
/** More than this between the screen and the window is a real smaller window (split screen), not system bars. */
const BARS = 100;

type Size = { width: number; height: number };

/**
 * The height the app really draws on. Android (14 and older) leaves the 3-button navigation bar out of the
 * window height while the app draws edge to edge under it, so there the whole screen counts, unless the window
 * is much shorter (split screen).
 */
export function drawHeight(win: Size, screen: Size, android: boolean) {
  if (!android || win.width !== screen.width) return win.height;
  return screen.height - win.height < BARS ? Math.max(win.height, screen.height) : win.height;
}

/**
 * The design scale K and the app frame's width. Phones fill the width when the fit leaves only a sliver at
 * the sides; tablets and really short phones get a centred column scaled to fit the height.
 */
export function frameFit(win: Size, screen: Size, android: boolean) {
  const h = drawHeight(win, screen, android);
  const fit = Math.min(win.width / DESIGN_W, h / DESIGN_H);
  const phone = Math.min(win.width, h) < TABLET;
  const fillsWidth = phone && DESIGN_W * fit >= win.width * (1 - SLIVER);
  const K = fillsWidth ? win.width / DESIGN_W : fit;
  return { K, frameW: Math.min(win.width, DESIGN_W * K) };
}
