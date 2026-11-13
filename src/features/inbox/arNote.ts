import { GAMES, PARKED_GAMES } from '@/data/games';
import { isAr, tr } from '@/i18n';

/**
 * Inbox titles and bodies are written by the server in English (challenge notes, gifts). In Arabic, the known
 * server sentences are rewritten here, so old rows read right too. Anything else (an admin's own message) stays as typed.
 */

// The English names the server writes (challenge_game_name), by game key.
const EN_GAME: Record<string, string> = {
  'Race to Diagnosis': 'the-diagnostic-pursuit',
  'Sketch It': 'the-silent-artist',
  'Nova Crossword': 'nova-crossword',
  'Quick Fire Quiz': 'the-quiz-parade',
  'Medical Riddles': 'the-riddler',
  'Six Word Tries': 'nova-medicordle',
  'The Streak Master': 'the-streak-master',
  'Case Files': 'case-files-unsolved',
  'The Wheels of Chaos': 'the-wheels-of-chaos',
  'The Imposter': 'imposter',
  'Tilt & Tell': 'tilt-and-tell',
  'Four Of A Kind': 'four-of-a-kind',
  'Spot The Flaw': 'spot-the-flaw',
  'Trace The Treatment': 'trace-the-treatment',
};

function game(en: string): string {
  const key = EN_GAME[en];
  const g = key ? [...GAMES, ...PARKED_GAMES].find((x) => x.key === key) : undefined;
  return g ? [g.lead, g.em].filter(Boolean).join(' ') : en;
}

const days = (n: string) => (n === '1' ? 'يوم واحد' : n === '2' ? 'يومين' : `${n} أيام`);

const FIXED: Record<string, string> = {
  'Challenge': 'تحدّي',
  'Challenge over': 'التحدّي خلص',
  'You won the challenge': 'كسبت التحدّي',
  'Challenge lost': 'خسرت التحدّي',
  'A gift for you': 'هدية ليك',
  'Open MedNova to see it.': 'افتح MedNova وشوفها.',
};

const RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^New challenge from (.+)$/, (m) => `تحدّي جديد من ${m[1]}`],
  [/^(.+) scored (\d+) in (.+)\. Beat it within a day\.$/, (m) => `${m[1]} جاب ${m[2]} في ${game(m[3])}. اكسر الرقم ده خلال يوم.`],
  [/^(.+) scored (\d+)\. Beat it within a day\.$/, (m) => `${m[1]} جاب ${m[2]}. اكسر الرقم ده خلال يوم.`],
  [/^(.+) challenges you to (.+): best score within (\d+) days? wins\.$/, (m) => `تحدّي من ${m[1]} في ${game(m[2])}: أعلى سكور خلال ${days(m[3])} يكسب.`],
  [/^(.+) challenges you: best score within (\d+) days? wins\.$/, (m) => `تحدّي من ${m[1]}: أعلى سكور خلال ${days(m[2])} يكسب.`],
  [/^Your challenge with (.+) ended with no winner\. See the result on their profile\.$/, (m) => `التحدّي مع ${m[1]} خلص من غير فايز. النتيجة في البروفايل.`],
  [/^You beat (.+)\. Collect your (\d+) tokens\.$/, (m) => `غلبت ${m[1]}. استلم ${m[2]} عملات.`],
  [/^You beat (.+)\. No tokens this time: you already won against them today\.$/, (m) => `غلبت ${m[1]}. مفيش عملات المرة دي، لإنك كسبت نفس الصاحب النهارده قبل كده.`],
  [/^(.+) won your challenge\. See the result on their profile\.$/, (m) => `التحدّي راح لـ ${m[1]}. النتيجة في البروفايل.`],
];

export function arNote(s: string): string {
  if (!isAr || !s) return s;
  if (FIXED[s]) return FIXED[s];
  for (const [re, f] of RULES) {
    const m = s.match(re);
    if (m) return f(m);
  }
  return tr(s);
}
