import '@/lib/storage-install';
import { Gabarito_700Bold } from '@expo-google-fonts/gabarito';
import { InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold, InterTight_700Bold } from '@expo-google-fonts/inter-tight';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BootSplash } from '@/features/start/BootSplash';
import { Intro } from '@/features/start/Intro';
import { startAccount } from '@/state/account';
import { watchResize } from '@/state/resize';
import { bootStart, endIntro, useStart, useStartReady } from '@/state/start';
import { View } from 'react-native';
import { FRAME_W, useScreen } from '@/theme/scale';
import { THEMES } from '@/theme/tokens';

export { CrashScreen as ErrorBoundary } from '@/components/CrashScreen';

SplashScreen.preventAutoHideAsync();
// The phone's own splash is plain black and hands over at once to the app's NOVA splash (BootSplash).
SplashScreen.setOptions({ fade: false });
/** How long the NOVA splash stays up at least, so it is seen even when the app starts fast. */
const SPLASH_MIN_MS = 1200;
startAccount();
bootStart();

export default function RootLayout() {
  const ready = useStartReady();
  const intro = useStart((s) => s.intro);
  const { width, height } = useScreen();
  const [fontsLoaded, fontError] = useFonts({
    Gabarito_700Bold,
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    JetBrainsMono_500Medium,
  });
  // A font that fails to load falls back to the system font instead of keeping the splash up for good (PB13a).
  const loaded = fontsLoaded || !!fontError;
  const [minDone, setMinDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMinDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(id);
  }, []);
  const go = loaded && ready && minDone;
  // A real window size change reloads the app on the same page (state/resize.ts).
  const path = usePathname();
  const params = useGlobalSearchParams();
  const here = useRef('');
  const url = path + (Object.keys(params).length ? `?${new URLSearchParams(params as Record<string, string>)}` : '');
  useEffect(() => {
    here.current = url;
  }, [url]);
  useEffect(() => watchResize(() => here.current), []);
  return (
    <GestureHandlerRootView style={{ flex: 1, alignItems: 'center', backgroundColor: go ? THEMES.dark.sky : '#000000' }}>
      <StatusBar style="light" />
      {go ? (
        <>
      {/* the app frame: the full screen, or a centred column (see theme/scale.ts) */}
      <View style={{ flex: 1, width: FRAME_W, overflow: 'hidden' }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: THEMES.dark.sky } }} />
      {/* returning players: the intro plays over the first page (Games or sign-in) and bursts into it */}
      {intro ? <Intro w={width} h={height} onDone={endIntro} /> : null}
      </View>
        </>
      ) : null}
      <BootSplash hide={go} />
    </GestureHandlerRootView>
  );
}
