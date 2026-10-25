/**
 * Anatomy and medical words that profanity lists often flag but that must never be blocked.
 * DRAFT: needs your review before use. Add plural/adjective forms here when needed
 * (the checker ignores one final "s" automatically).
 */
export const MEDICAL_ALLOWLIST: readonly string[] = [
  // anatomy
  'anus', 'anal', 'rectum', 'rectal', 'penis', 'penile', 'vagina', 'vaginal', 'vulva', 'vulval',
  'breast', 'nipple', 'areola', 'scrotum', 'scrotal', 'testis', 'testes', 'testicle', 'testicular',
  'clitoris', 'cervix', 'cervical', 'uterus', 'uterine', 'ovary', 'ovaries', 'prostate', 'urethra',
  'groin', 'buttock', 'buttocks', 'perineum', 'anorectal', 'genital', 'genitalia', 'pubic', 'pubis',
  'colon', 'bowel', 'stool', 'feces', 'faeces', 'urine', 'semen', 'sperm', 'ejaculation', 'erection',
  // clinical words
  'sexual', 'intercourse', 'coitus', 'impotence', 'lactation', 'mastitis', 'mammary', 'mammogram',
  'hemorrhoid', 'hemorrhoids', 'haemorrhoid', 'haemorrhoids', 'enema', 'defecation', 'micturition',
  // words badwords-list blocks that are fair clues here (2026-10-25)
  'labia', 'smegma', 'bloody', 'prick', 'viagra', 'masochist', 'sadist', 'cox', 'cipa',
];
