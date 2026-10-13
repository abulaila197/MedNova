import { useSyncExternalStore } from 'react';

// One shared once-a-second wall clock for countdown text (e.g. a challenge's time left). It runs only while
// something follows it, and reads the time afresh when the first follower arrives.
let now = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const subs = new Set<() => void>();

function subscribe(fn: () => void) {
  subs.add(fn);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      subs.forEach((f) => f());
    }, 1000);
  }
  return () => {
    subs.delete(fn);
    if (!subs.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
const idle = () => () => {};
const get = () => now;

/** The time, redrawing once a second while `active`; when not active it does not redraw (and may be old). */
export function useSecond(active = true) {
  return useSyncExternalStore(active ? subscribe : idle, get, get);
}
