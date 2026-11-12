import { create } from 'zustand';

/**
 * A sideways game screen (Tilt & Tell) is on: the app frame leaves its upright phone column and fills the whole
 * turned screen. The frame's width is fixed at launch (theme/scale.ts), so without this the game would sit in a
 * narrow strip in the middle of the landscape screen.
 */
export const useSidewaysFrame = create<{ on: boolean }>(() => ({ on: false }));
