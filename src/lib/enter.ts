import { Platform } from 'react-native';
import { FadeIn, type BaseAnimationBuilder, type EntryExitAnimationFunction } from 'react-native-reanimated';

type Enter = BaseAnimationBuilder | typeof BaseAnimationBuilder | EntryExitAnimationFunction;

/**
 * Android tap fault (Yazan, 2026-10-31): a pop-up that slides or zooms in and then changes size (its content loads,
 * or a new page swaps in) kept a stale offset on Android, so its buttons missed taps (friend pop-up Challenge and
 * card taps). On Android, pop-ups with buttons fade in instead; iPhone and web keep their slide or zoom.
 */
export function safeEnter<T extends Enter>(anim: T, ms = 250): T | ReturnType<typeof FadeIn.duration> {
  return Platform.OS === 'android' ? FadeIn.duration(ms) : anim;
}
