// Local config plugin (runs at prebuild; never edit android/ by hand).
// 1. PB9: android:appCategory="game" on <application>. From Android 16, apps targeting API 36 have "portrait"
//    ignored on large screens (>= 600 dp), but games are exempt, so tablets and foldables stay portrait.
// 2. LV3: wallpaper saving needs no photo READ access. Android 11+ saves through MediaStore with no permission;
//    only Android 10 and older need WRITE_EXTERNAL_STORAGE (expo-media-library's legacy path), so it is capped
//    at maxSdkVersion 29. The read permissions themselves are removed with android.blockedPermissions (app.json).
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const WRITE = 'android.permission.WRITE_EXTERNAL_STORAGE';

module.exports = function withAndroidGameAndSaveOnly(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    app.$['android:appCategory'] = 'game';

    const perms = (manifest.manifest['uses-permission'] ??= []);
    const write = perms.find((p) => p.$?.['android:name'] === WRITE);
    if (write) write.$['android:maxSdkVersion'] = '29';
    else perms.push({ $: { 'android:name': WRITE, 'android:maxSdkVersion': '29' } });
    return cfg;
  });
};
