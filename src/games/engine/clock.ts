/**
 * A game clock as m:ss (or 00:42 with `pad`). A countdown (`down`) rounds up, so it reads 0:00 only when time is
 * really up; time taken rounds down, so "solved in 0:12" never claims a second that hasn't passed.
 */
export function clock(ms: number, { down = false, pad = false }: { down?: boolean; pad?: boolean } = {}) {
  const t = Math.max(0, down ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const m = String(Math.floor(t / 60));
  return `${pad ? m.padStart(2, '0') : m}:${String(t % 60).padStart(2, '0')}`;
}
