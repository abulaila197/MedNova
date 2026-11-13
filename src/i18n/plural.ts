/**
 * Arabic number and noun agreement (Yazan 2026-11-13): "حالة واحدة", "حالتين", "3 حالات", "11 حالة", never "3 حالة".
 * Run over every Arabic text after its numbers are filled in, so a template written once ("{n} حالة") reads right
 * for any count. Only nouns listed here change; anything else is left as written.
 *   1 -> noun + واحد/واحدة   2 -> the pair form   3 to 10 -> plural   0 and 11+ -> singular.
 * After a sign ("+3 عملة") or inside a "x من y" count the number stays and only the noun changes.
 */

// singular, pair, plural (Egyptian where the app speaks Egyptian).
const NOUNS: [string, string, string][] = [
  ['حالة', 'حالتين', 'حالات'],
  ['سؤال', 'سؤالين', 'أسئلة'],
  ['دقيقة', 'دقيقتين', 'دقايق'],
  ['ثانية', 'ثانيتين', 'ثواني'],
  ['ساعة', 'ساعتين', 'ساعات'],
  ['يوم', 'يومين', 'أيام'],
  ['أسبوع', 'أسبوعين', 'أسابيع'],
  ['جولة', 'جولتين', 'جولات'],
  ['لعبة', 'لعبتين', 'ألعاب'],
  ['كلمة', 'كلمتين', 'كلمات'],
  ['عملة', 'عملتين', 'عملات'],
  ['شرارة', 'شرارتين', 'شرارات'],
  ['نجمة', 'نجمتين', 'نجوم'],
  ['مستوى', 'مستويين', 'مستويات'],
  ['فزورة', 'فزورتين', 'فوازير'],
  ['صندوق', 'صندوقين', 'صناديق'],
  ['كارت', 'كارتين', 'كروت'],
  ['فريق', 'فريقين', 'فرق'],
  ['مهمة', 'مهمتين', 'مهام'],
  ['محاولة', 'محاولتين', 'محاولات'],
  ['نقطة', 'نقطتين', 'نقط'],
  ['دليل', 'دليلين', 'أدلة'],
  ['مرة', 'مرتين', 'مرات'],
  ['تلميح', 'تلميحين', 'تلميحات'],
  ['قلب', 'قلبين', 'قلوب'],
  ['صاحب', 'صاحبين', 'صحاب'],
  ['إجابة', 'إجابتين', 'إجابات'],
  ['ملصق', 'ملصقين', 'ملصقات'],
  ['لاعب', 'لاعبين', 'لاعبين'],
  ['منافس', 'منافسين', 'منافسين'],
  ['ماتش', 'ماتشين', 'ماتشات'],
  ['حرف', 'حرفين', 'حروف'],
  ['شخصية', 'شخصيتين', 'شخصيات'],
  ['إطار', 'إطارين', 'إطارات'],
  ['لقب', 'لقبين', 'ألقاب'],
  ['مجموعة', 'مجموعتين', 'مجموعات'],
  ['خانة', 'خانتين', 'خانات'],
  ['طلب', 'طلبين', 'طلبات'],
];

const FORMS = new Map<string, [string, string, string]>();
for (const n of NOUNS) for (const f of n) if (!FORMS.has(f)) FORMS.set(f, n);

const words = [...FORMS.keys()].sort((a, b) => b.length - a.length).join('|');
// A count: optional sign, digits, a space, then a listed noun standing as a whole word (Arabic letters don't count
// as \w, so word ends are checked by hand).
const RE = new RegExp(`(^|[^\\d.,/])([+×]?)(\\d+) (${words})(?=$|[^\\u0621-\\u064A])`, 'g');

export function agree(s: string): string {
  if (!/\d/.test(s)) return s;
  return s.replace(RE, (_all, pre: string, sign: string, num: string, word: string, at: number, whole: string) => {
    const [one, two, many] = FORMS.get(word)!;
    const n = Number(num);
    const counted = n >= 3 && n <= 10 ? many : one;
    const before = whole.slice(Math.max(0, at - 4), at + pre.length);
    if (sign || /(من|\/) ?$/.test(before) || n === 0 || n > 2) return `${pre}${sign}${num} ${counted}`;
    if (n === 2) return `${pre}${two}`;
    return `${pre}${one} ${one.endsWith('ة') ? 'واحدة' : 'واحد'}`;
  });
}

/** "حالة واحدة", "3 حالات" for a number and any form of a listed noun ("الحالات" works too); else just the number. */
export function countOf(n: number, word: string): string {
  const w = word.trim().replace(/^ال/, '');
  const f = FORMS.get(w) ?? FORMS.get(w.replace(/^أ/, 'ا'));
  return f ? agree(`${n} ${f[0]}`) : String(n);
}
