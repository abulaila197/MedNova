import { Stack } from 'expo-router';

import { useTheme } from '@/state/app';

export default function PlayLayout() {
  const t = useTheme();
  // No iOS edge swipe out of an online match or lobby: that would leave without giving the seat up (PB3).
  // The in-game Quit / Leave buttons (and Android back, see live.tsx / lobby.tsx) leave properly.
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: t.sky } }}>
      <Stack.Screen name="live" options={{ gestureEnabled: false }} />
      <Stack.Screen name="lobby" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
