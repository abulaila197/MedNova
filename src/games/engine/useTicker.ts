import { useEffect, useEffectEvent, useState } from 'react';

/**
 * A game's clock tick: while `active`, every `ms` it re-renders with the current time and hands it to `onTick`
 * (usually the game's TICK event, which ends a turn when its time is up). Returns the time to draw clocks from.
 */
export function useTicker(active: boolean, ms: number, onTick?: (now: number) => void) {
  const [now, setNow] = useState(Date.now);
  const tick = useEffectEvent((n: number) => onTick?.(n));
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      tick(n);
    }, ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}
