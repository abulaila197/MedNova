// Fonts for the loading pages. Each game loads only its own, when its Play button is tapped,
// so the app start stays as light as before.
import * as Font from 'expo-font';

import { LOAD } from './configs';

const FILES: Record<string, number> = {
  SpecialElite_400Regular: require('@expo-google-fonts/special-elite/400Regular/SpecialElite_400Regular.ttf'),
  BebasNeue_400Regular: require('@expo-google-fonts/bebas-neue/400Regular/BebasNeue_400Regular.ttf'),
  CabinSketch_400Regular: require('@expo-google-fonts/cabin-sketch/400Regular/CabinSketch_400Regular.ttf'),
  CabinSketch_700Bold: require('@expo-google-fonts/cabin-sketch/700Bold/CabinSketch_700Bold.ttf'),
  PatrickHand_400Regular: require('@expo-google-fonts/patrick-hand/400Regular/PatrickHand_400Regular.ttf'),
  CormorantGaramond_600SemiBold: require('@expo-google-fonts/cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf'),
  CormorantGaramond_700Bold: require('@expo-google-fonts/cormorant-garamond/700Bold/CormorantGaramond_700Bold.ttf'),
  CormorantGaramond_700Bold_Italic: require('@expo-google-fonts/cormorant-garamond/700Bold_Italic/CormorantGaramond_700Bold_Italic.ttf'),
  CormorantGaramond_400Regular_Italic: require('@expo-google-fonts/cormorant-garamond/400Regular_Italic/CormorantGaramond_400Regular_Italic.ttf'),
  CormorantGaramond_600SemiBold_Italic: require('@expo-google-fonts/cormorant-garamond/600SemiBold_Italic/CormorantGaramond_600SemiBold_Italic.ttf'),
  Cinzel_400Regular: require('@expo-google-fonts/cinzel/400Regular/Cinzel_400Regular.ttf'),
  Cinzel_500Medium: require('@expo-google-fonts/cinzel/500Medium/Cinzel_500Medium.ttf'),
  Cinzel_700Bold: require('@expo-google-fonts/cinzel/700Bold/Cinzel_700Bold.ttf'),
  CinzelDecorative_700Bold: require('@expo-google-fonts/cinzel-decorative/700Bold/CinzelDecorative_700Bold.ttf'),
  IMFellEnglish_400Regular: require('@expo-google-fonts/im-fell-english/400Regular/IMFellEnglish_400Regular.ttf'),
  IMFellEnglish_400Regular_Italic: require('@expo-google-fonts/im-fell-english/400Regular_Italic/IMFellEnglish_400Regular_Italic.ttf'),
  IMFellEnglishSC_400Regular: require('@expo-google-fonts/im-fell-english-sc/400Regular/IMFellEnglishSC_400Regular.ttf'),
  Limelight_400Regular: require('@expo-google-fonts/limelight/400Regular/Limelight_400Regular.ttf'),
  Archivo_500Medium: require('@expo-google-fonts/archivo/500Medium/Archivo_500Medium.ttf'),
  Archivo_700Bold: require('@expo-google-fonts/archivo/700Bold/Archivo_700Bold.ttf'),
  Archivo_900Black: require('@expo-google-fonts/archivo/900Black/Archivo_900Black.ttf'),
  AbrilFatface_400Regular: require('@expo-google-fonts/abril-fatface/400Regular/AbrilFatface_400Regular.ttf'),
  LibreBaskerville_400Regular: require('@expo-google-fonts/libre-baskerville/400Regular/LibreBaskerville_400Regular.ttf'),
  LibreBaskerville_400Regular_Italic: require('@expo-google-fonts/libre-baskerville/400Regular_Italic/LibreBaskerville_400Regular_Italic.ttf'),
};

export async function loadFontsFor(key: string) {
  await loadFonts(LOAD[key]?.fonts ?? []);
}

/** Loads any of the fonts above by name (games reuse their loading page's fonts). */
export async function loadFonts(want: string[]) {
  const map = Object.fromEntries(want.filter((f) => !Font.isLoaded(f)).map((f) => [f, FILES[f]]));
  if (Object.keys(map).length) await Font.loadAsync(map);
}
