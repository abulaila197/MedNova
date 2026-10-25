// Daily login prizes (DL1-DL4): a 30-day calendar that only moves on days the player claims.

export const CALENDAR_DAYS = 30;
export const WEEK_END_PRIZE = 6;
export const MONTH_END_PRIZE = 20;
/** Sparks on the big days (Yazan, 2026-10-25): every 7th calendar day and day 30. */
export const WEEK_END_SPARKS = 20;
export const MONTH_END_SPARKS = 50;
/** Sparks for a claim made on a real weekend day, by the phone's date (Friday and Saturday). */
export const WEEKEND_SPARKS = 10;
const WEEKEND = [5, 6]; // Date.getDay(): Friday, Saturday

/** Tokens for calendar day 1-30: alternating 2 and 4, every 7th day 6, day 30 20 (DL1, doubled 2026-10-25). */
export function dayPrize(day: number) {
  if (day === CALENDAR_DAYS) return MONTH_END_PRIZE;
  if (day % 7 === 0) return WEEK_END_PRIZE;
  return day % 2 === 1 ? 2 : 4;
}

/** Sparks for calendar day 1-30; `date` (the claim's own day) adds the weekend Sparks. Mirrors daily_sparks on the server. */
export function daySparks(day: number, date?: Date) {
  const big = day === CALENDAR_DAYS ? MONTH_END_SPARKS : day % 7 === 0 ? WEEK_END_SPARKS : 0;
  return big + (date && WEEKEND.includes(date.getDay()) ? WEEKEND_SPARKS : 0);
}

/** The calendar day the next claim lands on, from how many prize days were claimed before (DL2: misses only pause). */
export const nextDay = (claimedBefore: number) => (claimedBefore % CALENDAR_DAYS) + 1;
