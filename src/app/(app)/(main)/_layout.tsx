import { Tabs } from 'expo-router';

import { useTheme } from '@/state/app';

/**
 * Learn, Games and Community stay mounted side by side (Yazan 2026-11-15, page-switch lag on the Note 10+): the dock
 * used to push a fresh copy of the whole page on every tap, so each switch rebuilt it from nothing. Now a tap only
 * shows the page that is already there. The dock itself is drawn by each page's Screen, so the tab bar is hidden.
 * Not frozen while hidden (2026-11-16): a frozen page caught up on every change at once when shown, which stalled the switch.
 */
export default function MainTabs() {
  const t = useTheme();
  return (
    <Tabs
      tabBar={() => null}
      backBehavior="history"
      screenOptions={{ headerShown: false, lazy: true, freezeOnBlur: false, animation: 'fade', sceneStyle: { backgroundColor: t.sky } }}
    >
      <Tabs.Screen name="games" />
      <Tabs.Screen name="learn" />
      <Tabs.Screen name="community" />
    </Tabs>
  );
}
