// Web: the wallpaper downloads as a file (expo-media-library has no web side).
import { Asset as Bundled } from 'expo-asset';
import type { ImageSourcePropType } from 'react-native';

export type SaveResult = 'saved' | 'denied' | 'error';

export async function saveWallpaper(src: ImageSourcePropType, name: string): Promise<SaveResult> {
  try {
    const file = await Bundled.fromModule(src as number).downloadAsync();
    const a = document.createElement('a');
    a.href = file.localUri ?? file.uri;
    a.download = `${name}.jpg`;
    a.click();
    return 'saved';
  } catch {
    return 'error';
  }
}
