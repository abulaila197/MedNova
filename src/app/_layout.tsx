import '@/lib/storage-install';
import { Fraunces_600SemiBold, Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces';
import { InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold, InterTight_700Bold } from '@expo-google-fonts/inter-tight';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Intro } from '@/features/start/Intro';
import { startAccount } from '@/state/account';
import { useApp } from '@/state/app';
import { bootStart, endIntro, useStart } from '@/state/start';
import { View } from 'react-native';
import { COLUMN_W, useScreen } from '@/theme/scale';
import { THEMES } from '@/theme/tokens';

export { CrashScreen as ErrorBoundary } from '@/components/CrashScreen';

SplashScreen.preventAutoHideAsync();
startAccount();
bootStart();

export default function RootLayout() {
  const mode = useApp((s) => s.mode);
  const ready = useStart((s) => s.ready);
  const intro = useStart((s) => s.intro);
  const { width, height } = useScreen();
  const [loaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    JetBrainsMono_500Medium,
  });
  useEffect(() => {
    if (loaded && ready) SplashScreen.hideAsync();
  }, [loaded, ready]);
  if (!loaded || !ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, alignItems: 'center', backgroundColor: THEMES[mode].sky }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {/* phones: the full screen; tablets: a centred column (SZ2) */}
      <View style={{ flex: 1, width: COLUMN_W, overflow: 'hidden' }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#05050d' } }} />
      {/* returning players: the intro plays over the first page (Games or sign-in) and bursts into it */}
      {intro ? <Intro w={width} h={height} onDone={endIntro} /> : null}
      </View>
    </GestureHandlerRootView>
  );
}
