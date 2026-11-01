/**
 * Soft beige answer boxes (Yazan 2026-11-01, picked A "Soft beige" from the preview): Riddler's photo paper and the
 * choice boxes in The Quiz Parade and The Streak Master, with dark brown text. Right and wrong colours stay as before.
 */
export type Beige = { bg: string; line: string; ink: string; paper: string; board?: string; boardLine?: string } | null;

export const BEIGE: Beige = { bg: '#efe4cb', line: '#cdb88c', ink: '#3b2f1c', paper: '#f1e6cc' };
