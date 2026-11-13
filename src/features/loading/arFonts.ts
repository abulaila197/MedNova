// Arabic loading pages (Yazan 2026-11-13): the games' English display fonts have no Arabic letters, so each page gets
// an Arabic Google font in the same mood. title = the game name, body = "MedNova:", the sub name, the tip and the tag.
export const AR_FONT_FILES: Record<string, number> = {
  Lalezar_400Regular: require('@expo-google-fonts/lalezar/400Regular/Lalezar_400Regular.ttf'),
  Changa_500Medium: require('@expo-google-fonts/changa/500Medium/Changa_500Medium.ttf'),
  Changa_800ExtraBold: require('@expo-google-fonts/changa/800ExtraBold/Changa_800ExtraBold.ttf'),
  Marhey_400Regular: require('@expo-google-fonts/marhey/400Regular/Marhey_400Regular.ttf'),
  Marhey_700Bold: require('@expo-google-fonts/marhey/700Bold/Marhey_700Bold.ttf'),
  ArefRuqaa_700Bold: require('@expo-google-fonts/aref-ruqaa/700Bold/ArefRuqaa_700Bold.ttf'),
  Amiri_400Regular: require('@expo-google-fonts/amiri/400Regular/Amiri_400Regular.ttf'),
  Amiri_700Bold: require('@expo-google-fonts/amiri/700Bold/Amiri_700Bold.ttf'),
  Rakkas_400Regular: require('@expo-google-fonts/rakkas/400Regular/Rakkas_400Regular.ttf'),
  ReemKufi_500Medium: require('@expo-google-fonts/reem-kufi/500Medium/ReemKufi_500Medium.ttf'),
  ReemKufi_700Bold: require('@expo-google-fonts/reem-kufi/700Bold/ReemKufi_700Bold.ttf'),
};

export const AR_FONTS: Record<string, { title: string; body: string }> = {
  'the-diagnostic-pursuit': { title: 'Lalezar_400Regular', body: 'Changa_500Medium' },
  'the-silent-artist': { title: 'Marhey_700Bold', body: 'Marhey_400Regular' },
  'the-wheels-of-chaos': { title: 'ArefRuqaa_700Bold', body: 'Amiri_400Regular' },
  'the-riddler': { title: 'ArefRuqaa_700Bold', body: 'Amiri_400Regular' },
  'case-files-unsolved': { title: 'ReemKufi_700Bold', body: 'ReemKufi_500Medium' },
  'nova-medicordle': { title: 'Changa_800ExtraBold', body: 'Changa_500Medium' },
  imposter: { title: 'Lalezar_400Regular', body: 'Changa_500Medium' },
  'tilt-and-tell': { title: 'Changa_800ExtraBold', body: 'Changa_500Medium' },
  'four-of-a-kind': { title: 'Amiri_700Bold', body: 'Amiri_400Regular' },
  'spot-the-flaw': { title: 'Amiri_700Bold', body: 'Amiri_400Regular' },
  'trace-the-treatment': { title: 'Lalezar_400Regular', body: 'Changa_500Medium' },
  'the-streak-master': { title: 'Rakkas_400Regular', body: 'Amiri_400Regular' },
  'nova-crossword': { title: 'Rakkas_400Regular', body: 'Amiri_400Regular' },
};
