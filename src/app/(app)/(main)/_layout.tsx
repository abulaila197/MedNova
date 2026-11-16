import { Tabs } from 'expo-router';

import { useTheme } from '@/state/app';

/**
 * Learn, Games and Community stay mounted side by side (Yazan 2026-11-15, page-switch lag on the Note 10+): the dock
 * used to push a fresh copy of the whole page on every tap, so each switch rebuilt it from nothing. Now a tap only
 * shows the page that is already there. The dock itself is drawn by each page's Screen, so the tab bar is hidden.
 * Games is not frozen while hidden (2026-11-16): frozen, it caught up on every change at once when shown, which stalled
 * the way back from a game. Learn and Community are frozen while hidden (Yazan 2026-11-16): kept live, Learn went on
 * working behind Community after a visit, and Community's scrolling stopped being smooth.
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
      <Tabs.Screen name="learn" options={{ freezeOnBlur: true }} />
      <Tabs.Screen name="community" options={{ freezeOnBlur: true }} />
    </Tabs>
  );
}
