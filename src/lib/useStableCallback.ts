import { useLayoutEffect, useState } from 'react';

/**
 * A function that never changes identity but always runs the latest `fn` (from the last committed render).
 * For handlers handed once to something built once (a PanResponder, a gesture); never call it during render.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const [box] = useState(() => {
    let latest = fn;
    return { call: (...args: A) => latest(...args), set: (f: (...args: A) => R) => void (latest = f) };
  });
  useLayoutEffect(() => box.set(fn));
  return box.call;
}
