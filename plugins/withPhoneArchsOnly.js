// Local config plugin (runs at prebuild; never edit android/ by hand).
// Builds native code for real phone chips only (ARM). The x86 / x86_64 copies only serve PC emulators and
// added ~53 MB to the APK.
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'reactNativeArchitectures';

module.exports = function withPhoneArchsOnly(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === KEY));
    cfg.modResults.push({ type: 'property', key: KEY, value: 'armeabi-v7a,arm64-v8a' });
    return cfg;
  });
};
