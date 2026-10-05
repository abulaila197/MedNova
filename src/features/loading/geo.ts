import { u } from '@/theme/scale';

/** The loading previews were drawn on a 300px-wide phone; the app's design width is 282. */
export const q = (n: number) => u((n * 282) / 300);
