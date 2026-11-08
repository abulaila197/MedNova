import { DESIGN_W, u } from '@/theme/scale';

/** The loading previews were drawn on a 300px-wide phone; the app's design width is 282. */
export const q = (n: number) => u((n * DESIGN_W) / 300);
