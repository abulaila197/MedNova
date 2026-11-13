// ON28: the shared voice lines. Since 2026-11-02 all 19 are recorded by Yazan's friend (with his OK), cleaned, trimmed
// and set to one loudness (about -16 LUFS).
import { isAr } from '@/i18n';

export const VOICE_EN: { id: string; line: string; src: number }[] = [
  { id: 'good-luck', line: "Good luck!", src: require('../../assets/voice/good-luck.m4a') },
  { id: 'nice-one', line: "Nice one!", src: require('../../assets/voice/nice-one.m4a') },
  { id: 'so-close', line: "So close!", src: require('../../assets/voice/so-close.m4a') },
  { id: 'hurry-up', line: "Hurry up!", src: require('../../assets/voice/hurry-up.m4a') },
  { id: 'well-played', line: "Well played", src: require('../../assets/voice/well-played.m4a') },
  { id: 'oops', line: "Oops!", src: require('../../assets/voice/oops.m4a') },
  { id: 'rematch', line: "Rematch?", src: require('../../assets/voice/rematch.m4a') },
  { id: 'gg', line: "GG", src: require('../../assets/voice/gg.m4a') },
  { id: 'thank-you', line: "Thank you!", src: require('../../assets/voice/thank-you.m4a') },
  { id: 'sorry', line: "Sorry!", src: require('../../assets/voice/sorry.m4a') },
  { id: 'ready', line: "Ready!", src: require('../../assets/voice/ready.m4a') },
  { id: 'help-me', line: "Help me!", src: require('../../assets/voice/help-me.m4a') },
  { id: 'too-slow', line: "Too slow!", src: require('../../assets/voice/too-slow.m4a') },
  { id: 'all-youve-got', line: "Is that all you've got?", src: require('../../assets/voice/all-youve-got.m4a') },
  { id: 'catch-me', line: "Catch me if you can!", src: require('../../assets/voice/catch-me.m4a') },
  { id: 'too-easy', line: "Too easy!", src: require('../../assets/voice/too-easy.m4a') },
  { id: 'keep-up', line: "Keep up!", src: require('../../assets/voice/keep-up.m4a') },
  { id: 'better-luck', line: "Better luck next time!", src: require('../../assets/voice/better-luck.m4a') },
];
/**
 * The same 18 lines in the female voice (Yazan 2026-11-12, voice 2 picked from three samples, made with Chatterbox,
 * MIT licence), set to the same loudness. Used when the speaker's character is female, or your Settings say so.
 */
export const VOICE_F_EN: typeof VOICE_EN = [
  { id: 'good-luck', line: "Good luck!", src: require('../../assets/voice-f/good-luck.m4a') },
  { id: 'nice-one', line: "Nice one!", src: require('../../assets/voice-f/nice-one.m4a') },
  { id: 'so-close', line: "So close!", src: require('../../assets/voice-f/so-close.m4a') },
  { id: 'hurry-up', line: "Hurry up!", src: require('../../assets/voice-f/hurry-up.m4a') },
  { id: 'well-played', line: "Well played", src: require('../../assets/voice-f/well-played.m4a') },
  { id: 'oops', line: "Oops!", src: require('../../assets/voice-f/oops.m4a') },
  { id: 'rematch', line: "Rematch?", src: require('../../assets/voice-f/rematch.m4a') },
  { id: 'gg', line: "GG", src: require('../../assets/voice-f/gg.m4a') },
  { id: 'thank-you', line: "Thank you!", src: require('../../assets/voice-f/thank-you.m4a') },
  { id: 'sorry', line: "Sorry!", src: require('../../assets/voice-f/sorry.m4a') },
  { id: 'ready', line: "Ready!", src: require('../../assets/voice-f/ready.m4a') },
  { id: 'help-me', line: "Help me!", src: require('../../assets/voice-f/help-me.m4a') },
  { id: 'too-slow', line: "Too slow!", src: require('../../assets/voice-f/too-slow.m4a') },
  { id: 'all-youve-got', line: "Is that all you've got?", src: require('../../assets/voice-f/all-youve-got.m4a') },
  { id: 'catch-me', line: "Catch me if you can!", src: require('../../assets/voice-f/catch-me.m4a') },
  { id: 'too-easy', line: "Too easy!", src: require('../../assets/voice-f/too-easy.m4a') },
  { id: 'keep-up', line: "Keep up!", src: require('../../assets/voice-f/keep-up.m4a') },
  { id: 'better-luck', line: "Better luck next time!", src: require('../../assets/voice-f/better-luck.m4a') },
];
/**
 * Arabic (Yazan 2026-11-13): the same 18 lines in formal Arabic, made by Yazan with TTSMaker, a man's and a woman's
 * voice, trimmed and set to the same loudness. The Arabic app uses these, with their Arabic captions.
 */
export const VOICE_AR: typeof VOICE_EN = [
  { id: 'good-luck', line: 'بالتوفيق!', src: require('../../assets/voice-ar/good-luck.m4a') },
  { id: 'nice-one', line: 'أحسنت!', src: require('../../assets/voice-ar/nice-one.m4a') },
  { id: 'so-close', line: 'كنت قريبًا من الإجابة!', src: require('../../assets/voice-ar/so-close.m4a') },
  { id: 'hurry-up', line: 'زد من سرعتك!', src: require('../../assets/voice-ar/hurry-up.m4a') },
  { id: 'well-played', line: 'مبدع!', src: require('../../assets/voice-ar/well-played.m4a') },
  { id: 'oops', line: 'أخطأت!', src: require('../../assets/voice-ar/oops.m4a') },
  { id: 'rematch', line: 'نعيد المباراة؟', src: require('../../assets/voice-ar/rematch.m4a') },
  { id: 'gg', line: 'لعبة حلوة!', src: require('../../assets/voice-ar/gg.m4a') },
  { id: 'thank-you', line: 'شكرًا!', src: require('../../assets/voice-ar/thank-you.m4a') },
  { id: 'sorry', line: 'آسف!', src: require('../../assets/voice-ar/sorry.m4a') },
  { id: 'ready', line: 'جاهز!', src: require('../../assets/voice-ar/ready.m4a') },
  { id: 'help-me', line: 'قم بمساعدتي!', src: require('../../assets/voice-ar/help-me.m4a') },
  { id: 'too-slow', line: 'أنت بطيء جدًا!', src: require('../../assets/voice-ar/too-slow.m4a') },
  { id: 'all-youve-got', line: 'هل هذا كل ما تستطيع فعله؟', src: require('../../assets/voice-ar/all-youve-got.m4a') },
  { id: 'catch-me', line: 'ألا تستطيع اللحاق بي؟', src: require('../../assets/voice-ar/catch-me.m4a') },
  { id: 'too-easy', line: 'سؤال سهل جدًا!', src: require('../../assets/voice-ar/too-easy.m4a') },
  { id: 'keep-up', line: 'حاول أن تواكبنا!', src: require('../../assets/voice-ar/keep-up.m4a') },
  { id: 'better-luck', line: 'حظًا أوفر المرة القادمة!', src: require('../../assets/voice-ar/better-luck.m4a') },
];
export const VOICE_AR_F: typeof VOICE_EN = [
  { id: 'good-luck', line: 'بالتوفيق!', src: require('../../assets/voice-ar-f/good-luck.m4a') },
  { id: 'nice-one', line: 'أحسنت!', src: require('../../assets/voice-ar-f/nice-one.m4a') },
  { id: 'so-close', line: 'كنت قريبًا من الإجابة!', src: require('../../assets/voice-ar-f/so-close.m4a') },
  { id: 'hurry-up', line: 'زد من سرعتك!', src: require('../../assets/voice-ar-f/hurry-up.m4a') },
  { id: 'well-played', line: 'مبدع!', src: require('../../assets/voice-ar-f/well-played.m4a') },
  { id: 'oops', line: 'أخطأت!', src: require('../../assets/voice-ar-f/oops.m4a') },
  { id: 'rematch', line: 'نعيد المباراة؟', src: require('../../assets/voice-ar-f/rematch.m4a') },
  { id: 'gg', line: 'لعبة حلوة!', src: require('../../assets/voice-ar-f/gg.m4a') },
  { id: 'thank-you', line: 'شكرًا!', src: require('../../assets/voice-ar-f/thank-you.m4a') },
  { id: 'sorry', line: 'آسفة!', src: require('../../assets/voice-ar-f/sorry.m4a') },
  { id: 'ready', line: 'جاهزة!', src: require('../../assets/voice-ar-f/ready.m4a') },
  { id: 'help-me', line: 'قم بمساعدتي!', src: require('../../assets/voice-ar-f/help-me.m4a') },
  { id: 'too-slow', line: 'أنت بطيء جدًا!', src: require('../../assets/voice-ar-f/too-slow.m4a') },
  { id: 'all-youve-got', line: 'هل هذا كل ما تستطيع فعله؟', src: require('../../assets/voice-ar-f/all-youve-got.m4a') },
  { id: 'catch-me', line: 'ألا تستطيع اللحاق بي؟', src: require('../../assets/voice-ar-f/catch-me.m4a') },
  { id: 'too-easy', line: 'سؤال سهل جدًا!', src: require('../../assets/voice-ar-f/too-easy.m4a') },
  { id: 'keep-up', line: 'حاول أن تواكبنا!', src: require('../../assets/voice-ar-f/keep-up.m4a') },
  { id: 'better-luck', line: 'حظًا أوفر المرة القادمة!', src: require('../../assets/voice-ar-f/better-luck.m4a') },
];

/** The lines this app speaks: Arabic in the Arabic app, English otherwise. */
export const VOICE = isAr ? VOICE_AR : VOICE_EN;
export const VOICE_F = isAr ? VOICE_AR_F : VOICE_F_EN;
const femaleById = new Map(VOICE_F.map((v) => [v.id, v]));
/** The sound for a line in a voice; lines with no female take (Trust Me Not's) keep the male one. */
export const voiceSrc = (id: string, gender: 'female' | 'male') => (gender === 'female' ? femaleById.get(id)?.src : undefined) ?? voiceById.get(id)?.src;

/** Lines only Trust Me Not offers, in the same voice (Yazan, 2026-10-09: the 12 shared lines plus these 3). */
export const TMN_VOICE: typeof VOICE_EN = [
  { id: 'trust-me', line: "Trust me!", src: require('../../assets/trustmenot/voice/trust-me.m4a') },
  { id: 'liar', line: "Liar!", src: require('../../assets/trustmenot/voice/liar.m4a') },
  { id: 'not-me', line: "Not me!", src: require('../../assets/trustmenot/voice/not-me.m4a') },
];
export const voiceById = new Map([...VOICE, ...TMN_VOICE].map((v) => [v.id, v]));
/** A line's caption in a voice: the woman's wording where it differs (Arabic آسفة, جاهزة). */
export const voiceLine = (id: string, gender: 'female' | 'male') => (gender === 'female' ? femaleById.get(id)?.line : undefined) ?? voiceById.get(id)?.line ?? '';
