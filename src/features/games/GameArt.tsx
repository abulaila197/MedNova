import { Image } from 'expo-image';
import { memo } from 'react';

import { u } from '@/theme/scale';
import type { Mode } from '@/theme/tokens';

import { ART_END, BODY_TOP, W } from './fit';

// Each drawing with its arc fade (and the light-mode colour tweak) is baked into one transparent
// image by scripts/bake-game-art.py, so the phone draws a plain picture instead of three stacked
// SVG masks per page. Re-run the script after changing a drawing or the geometry in fit.ts.
const BAKED = {
  dark: {
    'trust-me-not': require('@/assets/games/baked/dark/trust-me-not.webp'),
    'the-conqueror': require('@/assets/games/baked/dark/the-conqueror.webp'),
    'the-diagnostic-pursuit': require('@/assets/games/baked/dark/the-diagnostic-pursuit.webp'),
    'the-wheels-of-chaos': require('@/assets/games/baked/dark/the-wheels-of-chaos.webp'),
    'nova-crossword': require('@/assets/games/baked/dark/nova-crossword.webp'),
    'nova-medicordle': require('@/assets/games/baked/dark/nova-medicordle.webp'),
    'the-silent-artist': require('@/assets/games/baked/dark/the-silent-artist.webp'),
    'the-riddler': require('@/assets/games/baked/dark/the-riddler.webp'),
    'the-streak-master': require('@/assets/games/baked/dark/the-streak-master.webp'),
    'case-files-unsolved': require('@/assets/games/baked/dark/case-files-unsolved.webp'),
  },
  light: {
    'trust-me-not': require('@/assets/games/baked/light/trust-me-not.webp'),
    'the-conqueror': require('@/assets/games/baked/light/the-conqueror.webp'),
    'the-diagnostic-pursuit': require('@/assets/games/baked/light/the-diagnostic-pursuit.webp'),
    'the-wheels-of-chaos': require('@/assets/games/baked/light/the-wheels-of-chaos.webp'),
    'nova-crossword': require('@/assets/games/baked/light/nova-crossword.webp'),
    'nova-medicordle': require('@/assets/games/baked/light/nova-medicordle.webp'),
    'the-silent-artist': require('@/assets/games/baked/light/the-silent-artist.webp'),
    'the-riddler': require('@/assets/games/baked/light/the-riddler.webp'),
    'the-streak-master': require('@/assets/games/baked/light/the-streak-master.webp'),
    'case-files-unsolved': require('@/assets/games/baked/light/case-files-unsolved.webp'),
  },
} as const;

/** The game drawing, lower right, fading in along the big curve (prototype `.np.arc`). Drawn in body coordinates. */
export const GameArt = memo(function GameArt({ k, mode }: { k: string; mode: Mode }) {
  const src = BAKED[mode][k as keyof (typeof BAKED)['dark']];
  return (
    <Image
      source={src}
      style={{ position: 'absolute', left: 0, top: 0, width: u(W), height: u(ART_END - BODY_TOP) }}
      contentFit="fill"
      transition={0}
      cachePolicy="memory"
      pointerEvents="none"
      accessible={false}
    />
  );
});
