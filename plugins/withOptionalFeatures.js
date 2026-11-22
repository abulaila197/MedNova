// Local config plugin (runs at prebuild; never edit android/ by hand).
// Play flagged two hardware features as REQUIRED (Yazan 2026-11-22): the portrait-only screen lock implies
// android.hardware.screen.portrait, and the Wi-Fi state permission (expo-network) implies android.hardware.wifi.
// Neither is needed to run MedNova, so both are declared optional and no device is filtered out for them.
const { withAndroidManifest } = require('expo/config-plugins');

const OPTIONAL = ['android.hardware.screen.portrait', 'android.hardware.wifi'];

module.exports = function withOptionalFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    const m = cfg.modResults.manifest;
    const kept = (m['uses-feature'] ?? []).filter((f) => !OPTIONAL.includes(f.$['android:name']));
    m['uses-feature'] = [...kept, ...OPTIONAL.map((name) => ({ $: { 'android:name': name, 'android:required': 'false' } }))];
    return cfg;
  });
};
