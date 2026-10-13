// Save a wallpaper to the phone's photos (Yazan, 2026-10-13). Write-only photo access: MedNova never reads the
// gallery. The web version (save.web.ts) downloads the picture as a file instead.
import { Asset as Bundled } from 'expo-asset';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import type { ImageSourcePropType } from 'react-native';

export type SaveResult = 'saved' | 'denied' | 'error';

export async function saveWallpaper(src: ImageSourcePropType, _name: string): Promise<SaveResult> {
  try {
    const file = await Bundled.fromModule(src as number).downloadAsync();
    const { status } = await requestPermissionsAsync(true, ['photo']);
    if (status !== 'granted') return 'denied';
    await Asset.create(file.localUri ?? file.uri);
    return 'saved';
  } catch {
    return 'error';
  }
}
