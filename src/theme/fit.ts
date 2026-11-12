/** Every approved design is drawn on this frame (see scale.ts). */
export const DESIGN_W = 282;
export const DESIGN_H = 615;
// 4% (was 3%): a Galaxy Note 10+ fit left 3.3%, two thin bars at the sides (Yazan 2026-10-21).
const SLIVER = 0.04;
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
export function frameFit(win: Size, screen: Size, android: boolean, tablets = android) {
  const h = drawHeight(win, screen, android);
  const fit = Math.min(win.width / DESIGN_W, h / DESIGN_H);
  const phone = Math.min(win.width, h) < TABLET;
  // Android tablets (Yazan 2026-11-12, look A): the whole screen at a reading size close to a phone's, so pages
  // spread into the width instead of a zoomed phone column. iPad stays an iPhone app (no tablet build), so only
  // Android gets it; the web preview follows Android so the screens can be checked.
  if (!phone && tablets && win.width >= TABLET) {
    const K = Math.min(TAB_K_MAX, Math.max(TAB_K_MIN, win.width / TAB_W, h / (DESIGN_H * 1.4)));
    return { K, frameW: win.width, tablet: true };
  }
  const fillsWidth = phone && DESIGN_W * fit >= win.width * (1 - SLIVER);
  const K = fillsWidth ? win.width / DESIGN_W : fit;
  // Short phones (Yazan 2026-11-12, "small screens"): the phone design at the height's size, but over the whole
  // width, not a column with bands at the sides; pages spread the few extra design px like any flexible row.
  if (phone && !fillsWidth) return { K, frameW: win.width, tablet: false };
  return { K, frameW: Math.min(win.width, DESIGN_W * K), tablet: false };
}

/** Tablet design width: a 10-inch tablet (800 dp wide) gets about 560 design px, twice a phone's room. */
const TAB_W = 560;
const TAB_K_MIN = 1.25;
const TAB_K_MAX = 1.7;
