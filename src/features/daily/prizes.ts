// Daily login prizes (DL1-DL4): a 30-day calendar that only moves on days the player claims.

export const CALENDAR_DAYS = 30;
export const WEEK_END_PRIZE = 3;
export const MONTH_END_PRIZE = 10;

/** Tokens for calendar day 1-30: alternating 1 and 2, every 7th day 3, day 30 10 (DL1). */
export function dayPrize(day: number) {
  if (day === CALENDAR_DAYS) return MONTH_END_PRIZE;
  if (day % 7 === 0) return WEEK_END_PRIZE;
  return day % 2 === 1 ? 1 : 2;
}

/** The calendar day the next claim lands on, from how many prize days were claimed before (DL2: misses only pause). */
export const nextDay = (claimedBefore: number) => (claimedBefore % CALENDAR_DAYS) + 1;
