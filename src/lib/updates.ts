import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { create } from 'zustand';

import { defaultKV } from '@/games/engine/storage';

/**
 * Over-the-air updates (Yazan 2026-11-16): fixes to the app's code, texts and pictures reach store builds without a new
 * store review. Every update is published to the "test" channel first; phones with "Get updates first" on (an Admin
 * switch, kept on this phone only) take it from there, so Yazan sees it on his own phone before it goes to
 * "production" for everyone. Native changes (new libraries, permissions, icon, phone settings) still need a store build:
 * the runtime fingerprint keeps an update away from a build it doesn't fit.
 */
const kv = defaultKV();
const KEY = 'updates:first';
export const TEST_CHANNEL = 'test';

export const live = Platform.OS !== 'web' && Updates.isEnabled;

export const useUpdates = create<{ first: boolean; read: boolean }>(() => ({ first: false, read: false }));

function apply(first: boolean) {
  if (!live) return;
  try {
    Updates.setUpdateRequestHeadersOverride(first ? { 'expo-channel-name': TEST_CHANNEL } : null);
  } catch {
    // Older native side: the switch just has no effect.
  }
}

/** At start-up: puts the saved switch back. The check at launch already ran; this one serves the next open. */
export function bootUpdates() {
  void kv
    .get<boolean>(KEY)
    .then((v) => {
      const first = v === true;
      useUpdates.setState({ first, read: true });
      apply(first);
      // The check at launch asked with the build's own channel; with the switch on, look on the test channel now and
      // keep what comes down for the next open.
      if (first && live) void Updates.checkForUpdateAsync().then((r) => (r.isAvailable ? Updates.fetchUpdateAsync() : null)).catch(() => {});
    })
    .catch(() => useUpdates.setState({ read: true }));
}

export async function setUpdatesFirst(first: boolean) {
  await kv.set(KEY, first);
  useUpdates.setState({ first });
  apply(first);
}

/** What this phone runs: the build's own code, or an update and when it was published. */
export function runningLabel() {
  if (!live) return 'Updates are off here (web or a development build).';
  const ch = Updates.channel ?? '?';
  if (Updates.isEmbeddedLaunch || !Updates.createdAt) return `Built-in code · channel ${ch}`;
  return `Update of ${Updates.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC · channel ${ch}`;
}

/** Looks for a newer update now; when there is one, downloads it and restarts into it. Returns what happened. */
export async function checkNow(): Promise<string> {
  if (!live) return 'Updates are off here.';
  const r = await Updates.checkForUpdateAsync();
  if (!r.isAvailable) return 'Up to date.';
  await Updates.fetchUpdateAsync();
  await Updates.reloadAsync();
  return 'Restarting…';
}
