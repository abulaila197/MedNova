// Firebase on phones (Group 2). Crash reports collect themselves once the app starts; stats are page views and a few
// game events, with no names, emails or typed text, and advertising signals turned off (firebase.json + setConsent).
import { getAnalytics, logEvent, setConsent } from '@react-native-firebase/analytics';
import { getCrashlytics, setUserId } from '@react-native-firebase/crashlytics';

let ready = false;

export async function startStats(): Promise<void> {
  if (ready) return;
  ready = true;
  await setConsent(getAnalytics(), {
    analytics_storage: true,
    ad_storage: false,
    ad_user_data: false,
    ad_personalization: false,
  }).catch(() => {});
}

let last = '';
export function screen(path: string): void {
  // Ids in paths (rooms, friends) are cut so only the page kind is counted.
  const name = path.replace(/\/[0-9a-f-]{8,}|\/[A-Z0-9]{4,8}$/g, '/:id') || '/';
  if (name === last) return;
  last = name;
  try {
    void logEvent(getAnalytics(), 'screen_view', { screen_name: name, screen_class: name });
  } catch {}
}

export function stat(name: 'game_start' | 'game_end' | 'ad_watched', p: Record<string, string | number> = {}): void {
  try {
    void logEvent(getAnalytics(), name as string, p);
  } catch {}
}

export function crashUser(id: string | null): void {
  setUserId(getCrashlytics(), id ?? '').catch(() => {});
}
