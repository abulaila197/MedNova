import { Tabs } from 'expo-router';
import type { BottomTabSceneStyleInterpolator } from 'expo-router/build/react-navigation/bottom-tabs/types';

import { useTheme } from '@/state/app';

/**
 * The page you go to fades in over the page you leave, which stays fully shown underneath (Yazan 2026-11-16): a plain
 * cross-fade showed both pages half see-through over the navy halfway through, a dark frame between pages. Both pages
 * run the same curve (0 = shown, ±1 = away), so the curve is full until halfway out: the old page is still whole while
 * the new one comes in, and is only let go once the new one covers it.
 */
const fadeOver: BottomTabSceneStyleInterpolator = ({ current }) => ({
  sceneStyle: { opacity: current.progress.interpolate({ inputRange: [-1, -0.5, 0, 0.5, 1], outputRange: [0, 1, 1, 1, 0] }) },
});

/**
 * Learn, Games and Community stay mounted side by side (Yazan 2026-11-15, page-switch lag on the Note 10+): the dock
 * used to push a fresh copy of the whole page on every tap, so each switch rebuilt it from nothing. Now a tap only
 * shows the page that is already there, and the pages you are not on are taken off the screen (patches/expo-router:
 * the tab view kept every page left of the open one drawn behind it, so Community scrolled under Learn and Games).
 * The dock itself is drawn by each page's Screen, so the tab bar is hidden.
 */
export default function MainTabs() {
  const t = useTheme();
  return (
    <Tabs
      tabBar={() => null}
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: false,
        animation: 'fade',
        sceneStyleInterpolator: fadeOver,
        transitionSpec: { animation: 'timing', config: { duration: 300 } },
        sceneStyle: { backgroundColor: t.sky },
      }}
    >
      <Tabs.Screen name="games" />
      <Tabs.Screen name="learn" />
      <Tabs.Screen name="community" />
    </Tabs>
  );
}
