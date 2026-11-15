// Local config plugin (runs at prebuild; never edit android/ by hand).
// Item D2 (Yazan 2026-11-16): Android's "Bold text" / bold font setting (Android 12+) makes text views draw our fonts
// thicker and wider than React Native measured them, so a word or a last letter got cut ("غيّر" without "الإطار").
// The app already ignores the phone's font size; this makes it ignore the bold setting the same way, so text is
// drawn exactly as it was measured on every phone.
const { withMainActivity } = require('expo/config-plugins');

const MARK = '// MedNova: ignore the bold text setting';

module.exports = function withFixedFontWeight(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARK)) return cfg;
    if (cfg.modResults.language !== 'kt') throw new Error('withFixedFontWeight: MainActivity is not Kotlin');
    if (!src.includes('import android.content.Context\n')) src = src.replace(/^package [^\n]+\n/m, (m) => `${m}\nimport android.content.Context\n`);
    const method = `
  ${MARK}
  override fun attachBaseContext(newBase: Context) {
    if (android.os.Build.VERSION.SDK_INT >= 31) {
      val conf = android.content.res.Configuration(newBase.resources.configuration)
      conf.fontWeightAdjustment = 0
      super.attachBaseContext(newBase.createConfigurationContext(conf))
    } else {
      super.attachBaseContext(newBase)
    }
  }
`;
    src = src.replace(/class MainActivity\s*:\s*ReactActivity\(\)\s*\{/, (m) => `${m}${method}`);
    if (!src.includes(MARK)) throw new Error('withFixedFontWeight: MainActivity class not found');
    cfg.modResults.contents = src;
    return cfg;
  });
};
