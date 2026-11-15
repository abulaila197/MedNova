import { router } from 'expo-router';
// The router's own navigation handle (expo-router 57); only read, to find the dock pages under the current page.
import { store } from 'expo-router/build/global-state/router-store';

/** The three dock pages, kept mounted in one tab group, "(main)". */
const MAIN = new Set(['/games', '/learn', '/community']);

type NavState = { index?: number; routes: { name: string; state?: NavState }[] };

/** How many pages sit above the dock pages in the stack that holds them, or -1 when they aren't in it. */
function aboveMain(): number {
  let st = store.navigationRef?.current?.getRootState?.() as NavState | undefined;
  while (st) {
    const at = st.routes.findIndex((r) => r.name === '(main)');
    if (at >= 0) return (st.index ?? st.routes.length - 1) - at;
    st = st.routes[st.index ?? st.routes.length - 1]?.state;
  }
  return -1;
}

/**
 * Opens a page from the header, dock or a host sheet. A dock page closes the pages above the dock pages (if any)
 * and switches to the one asked for, instead of stacking a new copy of all three; the first time, it opens normally.
 */
export const navTo = (to: string) => {
  if (MAIN.has(to)) {
    let n = -1;
    try {
      n = aboveMain();
    } catch {
      n = -1;
    }
    if (n > 0) router.dismiss(n);
  }
  return router.navigate(to as never);
};
