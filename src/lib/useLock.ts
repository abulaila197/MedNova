import { useCallback, useRef } from 'react';

/**
 * A tap lock that holds from the first tap, not from the next render: a fast double tap on a button that spends
 * tokens or calls the server runs the job once (DEF-094). State-only `busy` flags let a second tap through
 * within the same frame.
 */
export function useLock() {
  const held = useRef(false);
  return useCallback(async (job: () => Promise<unknown>) => {
    if (held.current) return;
    held.current = true;
    try {
      await job();
    } finally {
      held.current = false;
    }
  }, []);
}
