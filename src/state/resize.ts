import { reloadAppAsync } from 'expo';
import { Dimensions, Platform } from 'react-native';

import { defaultKV } from '@/games/engine/storage';
import { frameFit } from '@/theme/fit';
import { FRAME_W, K } from '@/theme/scale';

// The app's size is fixed at launch (theme/scale.ts). When the window really changes size later (split screen,
// a foldable opening), the app reloads itself and comes back to the same page (Yazan, 2026-10-13: "Quick reload").
// The system bar showing or hiding never changes the fit, so it never reloads.
const kv = defaultKV();
const KEY = 'reload_route';

/** A page that only lives inside a running game goes back to the game's own page, which offers Resume. */
function safeHref(href: string) {
  const m = href.match(/^\/play\/([^/?]+)\/(run|live|lobby|results|gate)\b/);
  return m ? `/play/${m[1]}` : href;
}

/** Watches the window; `href` gives the current page. Returns the unsubscribe. */
export function watchResize(href: () => string) {
  let wait: ReturnType<typeof setTimeout> | undefined;
  const sub = Dimensions.addEventListener('change', ({ window, screen }) => {
    clearTimeout(wait);
    // Wait for the resize to settle, so dragging a split-screen divider reloads once.
    wait = setTimeout(() => {
      const f = frameFit(window, screen, Platform.OS === 'android');
      if (Math.abs(f.K - K) / K < 0.02 && Math.abs(f.frameW - FRAME_W) < 2) return;
      void kv
        .set(KEY, { href: safeHref(href()), at: Date.now() })
        .finally(() => reloadAppAsync('Screen size changed'));
    }, 500);
  });
  return () => {
    clearTimeout(wait);
    sub.remove();
  };
}

/** The page to reopen after a resize reload (read once at launch), or null. */
export async function takeReloadRoute() {
  const r = await kv.get<{ href: string; at: number }>(KEY).catch(() => null);
  if (!r) return null;
  await kv.remove(KEY);
  return Date.now() - r.at < 60_000 ? r.href : null;
}
