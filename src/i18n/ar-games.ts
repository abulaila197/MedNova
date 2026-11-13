import { GAMES, PARKED_GAMES, type Game } from '@/data/games';

/**
 * Arabic game names (Yazan 2026-11-13), split like the English ones: `lead` plain, `em` in the accent. Fixed per run,
 * so the game list is rewritten in place once at start, before any screen reads it. Keys stay English.
 */
const AR_GAMES: Record<string, Omit<Game, 'key'>> = {
  'the-diagnostic-pursuit': { lead: 'سباق', em: 'التشخيص', sub: 'كل دليل بيفرق', desc: 'سابق الوقت للتشخيص الصح، دليل ورا دليل.' },
  'the-silent-artist': { lead: 'ارسم', em: 'وخمّن', sub: 'طباشير وسكوت', desc: 'ارسم التشخيص من غير كلام وصحابك يخمّنوا.' },
  'nova-crossword': { lead: 'كلمات', em: 'متقاطعة', sub: 'شبكة الإكلينيكي', desc: 'املا الشبكة بأمراض وأدوية وعلامات.' },
  'the-riddler': { lead: 'فوازير', em: 'طبية', sub: 'ألغاز قدام عينك', desc: 'فوازير بالصور بتتهجّى مرض أو علامة.' },
  'nova-medicordle': { lead: 'خمّن', em: 'الكلمة', sub: 'كلمة العنبر', desc: 'خمّن المصطلح الطبي المستخبي في ست محاولات.' },
  'the-streak-master': { lead: 'سلسلة', em: 'الإجابات', sub: 'غلطة واحدة وتقع', desc: 'جاوب صح ورا بعض وخلّي السلسلة شغّالة.' },
  'case-files-unsolved': { lead: 'ملفات', em: 'غامضة', sub: 'تشخيصات تفريقية مفتوحة', desc: 'افتح الملف، اتبع الأدلة، واقفل القضية.' },
  'the-wheels-of-chaos': { lead: 'عجلة', em: 'الفوضى', sub: 'لفّة القدر', desc: 'لفّ العجلة وخد أي حالة تقف عليها.' },
  imposter: { lead: '', em: 'الدخيل', sub: 'مين اللي دخل', desc: 'لاعب واحد معاه كلمة مختلفة. اكتشف مين الدخيل.' },
  'tilt-and-tell': { lead: 'على', em: 'راسك', sub: 'اقرا أفكاري', desc: 'الكلمة على جبهتك، وفريقك بيديك التلميحات.' },
  'four-of-a-kind': { lead: '', em: 'رباعيات', sub: 'لاقي الرابط المستخبي', desc: 'ستاشر خانة، أربع مجموعات مستخبية. لاقي إيه اللي بيربط كل أربعة.' },
  'spot-the-flaw': { lead: 'اكتشف', em: 'الغلطة', sub: 'اقرا ما بين السطور', desc: 'قصة واحدة، وغلطة واحدة مستخبية. امسكها وصلّحها.' },
  'trace-the-treatment': { lead: 'تتبّع', em: 'العلاج', sub: 'امشي ورا الأدلة', desc: 'قصة واحدة، وعلاج واحد. امشي ورا الأدلة لحد ما توصله.' },
  'the-quiz-parade': { lead: 'أسئلة', em: 'سريعة', sub: 'موكب العقول', desc: 'سبع أنواع أسئلة ورا بعض. الأصعب بيجيب نقط أكتر.' },
};

/** Called once by '@/i18n' when the app runs in Arabic. */
export function localizeGames() {
  for (const g of [...GAMES, ...PARKED_GAMES]) {
    const a = AR_GAMES[g.key];
    if (a) Object.assign(g, a);
  }
}
