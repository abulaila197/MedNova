// Push notifications on phones (Group 2). Expo's free push service carries them (FCM V1 key on Android, APNs key on
// iPhone, both uploaded to expo.dev). The server decides what to send (social events at once, one reminder a day at
// most) and honours the two switches in Settings.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { engine } from '@/games/engine';
import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';

export const PUSH_ON = true;

const ASKED = 'push_asked';

// In the app the in-app banners already show invites and gifts, so a push that lands while MedNova is open stays
// in the tray instead of popping over the game.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

async function channel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'MedNova',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#6fd6ff',
  }).catch(() => {});
}

export async function pushAllowed(): Promise<'yes' | 'no' | 'ask'> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'yes';
  return p.canAskAgain ? 'ask' : 'no';
}

let linkedFor: string | null = null;
export async function linkPush(uid: string | null): Promise<void> {
  if (!uid || linkedFor === uid) return;
  if ((await pushAllowed()) !== 'yes') return;
  await channel();
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  const { error } = await supabase.rpc('push_register', { token, platform: Platform.OS });
  if (!error) linkedFor = uid;
}

export async function unlinkPush(): Promise<void> {
  linkedFor = null;
  if ((await pushAllowed()) !== 'yes') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await supabase.rpc('push_unregister', { token });
}

export async function askPushNow(uid: string | null): Promise<boolean> {
  await channel(); // Android 13+ asks only once a channel exists
  const p = await Notifications.requestPermissionsAsync();
  await engine.kv.set(ASKED, true);
  if (p.granted) await linkPush(uid).catch(() => {});
  return p.granted;
}

let asking = false;
export function askPushAfterFirstGame(): void {
  if (asking) return;
  asking = true;
  void (async () => {
    try {
      if (await engine.kv.get<boolean>(ASKED)) return;
      if ((await pushAllowed()) !== 'ask') return void (await engine.kv.set(ASKED, true));
      // Let the results page settle first.
      await new Promise((r) => setTimeout(r, 2500));
      await askPushNow(useSession.getState().userId);
    } catch {
      // try again after the next game
    } finally {
      asking = false;
    }
  })();
}

/** Where each kind of notification opens. */
const OPEN: Record<string, string> = {
  friend: '/friends',
  inbox: '/inbox',
  challenge: '/challenges',
  invite: '/games',
  sparks: '/games',
  daily: '/games',
  rounds: '/rounds',
};

export function followPushTaps(): () => void {
  const go = (r: Notifications.NotificationResponse | null) => {
    const d = r?.notification.request.content.data as { kind?: string; url?: string } | undefined;
    if (!d) return;
    const to = d.url ?? (d.kind ? OPEN[d.kind] : undefined);
    if (to) setTimeout(() => router.navigate(to as never), 300);
  };
  // A tap that opened the app from closed.
  Notifications.getLastNotificationResponseAsync().then((r) => {
    go(r);
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, () => {});
  const sub = Notifications.addNotificationResponseReceivedListener(go);
  return () => sub.remove();
}
