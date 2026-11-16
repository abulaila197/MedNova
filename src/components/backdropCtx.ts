import { createContext, type RefObject } from 'react';
import type { View } from 'react-native';

/**
 * The page backdrop a Screen draws behind its content (item 2, Yazan 2026-11-16): a Fade's veil copies this same
 * picture over the faded edge, so the edge dissolves into the real background instead of a flat navy box.
 */
/** `size` is the page's own laid-out size: unlike a window measurement it doesn't shrink while the side menu holds
 *  the page card scaled down to 80% (that made the veil 80% wide and the wrong picture: the dark band, 2026-11-16). */
export const BackdropCtx = createContext<{ symbols: boolean; root: RefObject<View | null>; size: { w: number; h: number } | null } | null>(null);
