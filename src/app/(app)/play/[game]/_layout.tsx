import { Stack } from 'expo-router';

import { useTheme } from '@/state/app';

export default function PlayLayout() {
  const t = useTheme();
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: t.sky } }} />;
}
