import * as Network from 'expo-network';

import { tr } from '@/i18n';

/**
 * The phone's own internet state (Yazan 2026-11-16), shared by the whole app: actions that need the server say
 * "You're offline" before trying, background calls skip while offline, and work waiting for the internet runs the
 * moment it comes back. Starts as online, so nothing is blocked before the phone has answered.
 */
let online = true;
const back = new Set<() => void>();

const read = (e: { isInternetReachable?: boolean | null; isConnected?: boolean | null }) => e.isInternetReachable ?? e.isConnected ?? true;
function set(up: boolean) {
  const was = online;
  online = up;
  if (up && !was) for (const fn of back) fn();
}
try {
  Network.addNetworkStateListener((e) => set(read(e)));
  void Network.getNetworkStateAsync()
    .then((e) => set(read(e)))
    .catch(() => {});
} catch {
  // no network module (tests): stay "online"
}

/** False only when the phone says it has no internet. */
export const isOnline = () => online;

/** Runs `fn` each time the internet comes back; returns the undo. */
export function onBackOnline(fn: () => void) {
  back.add(fn);
  return () => void back.delete(fn);
}

/** The plain line for an action that needs the internet. */
export const offlineText = () => tr('You’re offline. Connect to the internet and try again.');
