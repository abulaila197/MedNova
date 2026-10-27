// Save a wallpaper to the phone's photos (Yazan, 2026-10-13). Write-only photo access: MedNova never reads the
// gallery. The web version (save.web.ts) downloads the picture as a file instead.
import { Asset as Bundled } from 'expo-asset';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { type ImageSourcePropType, Platform } from 'react-native';

export type SaveResult = 'saved' | 'denied' | 'error';

export async function saveWallpaper(src: ImageSourcePropType, _name: string): Promise<SaveResult> {
  try {
    const asset = Bundled.fromModule(src as number);
    // In the store build an Android picture is a bundled drawable: localUri is its bare name, not a file, so saving
    // failed with "Try again" (2026-10-27). Downloading again copies it to a real file first.
    if (Platform.OS === 'android' && !asset.localUri?.includes(':')) asset.downloaded = false;
    const file = await asset.downloadAsync();
    // Android 11+ saves a new photo with no permission at all, and the app's manifest has no photo permission to
    // ask for, so asking failed and Save said "try again" (2026-10-21). Older Android and iOS still ask (add-only).
    if (!(Platform.OS === 'android' && Number(Platform.Version) >= 30)) {
      const { status } = await requestPermissionsAsync(true, Platform.OS === 'android' ? [] : ['photo']);
      if (status !== 'granted') return 'denied';
    }
    await Asset.create(file.localUri ?? file.uri);
    return 'saved';
  } catch {
    return 'error';
  }
}
