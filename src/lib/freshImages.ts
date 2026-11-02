import * as Application from 'expo-application';
import { Image } from 'expo-image';
import { Platform } from 'react-native';

/**
 * Wrong pictures after an update (Yazan 2026-11-02: Silent Artist's loading page showed the intro's community photo).
 * A new APK installed over an old one keeps the picture cache, and a cached picture can come back for another one.
 * On the first launch of each new install the cache is cleared once; pictures decode again from the app itself.
 */
const KEY = 'mn-image-cache-install';

export async function freshImagesOnUpdate() {
  if (Platform.OS === 'web') return;
  try {
    const stamp = Platform.OS === 'android' ? String((await Application.getLastUpdateTimeAsync())?.getTime() ?? '') : `${Application.nativeApplicationVersion}-${Application.nativeBuildVersion}`;
    if (!stamp) return;
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (ls?.getItem(KEY) === stamp) return;
    await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]);
    ls?.setItem(KEY, stamp);
  } catch {}
}
