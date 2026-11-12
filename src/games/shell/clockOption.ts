import type { SetupOption } from './types';

/**
 * "No clock" (Yazan 2026-11-12): a setup choice in the Solo modes he picked (Quick Fire Quiz, Wheels; Sketch It
 * Practice has its own). With No clock nothing is timed and the time helpers are hidden; scoring stays the same.
 */
export const clockOption = (note: string): SetupOption => ({
  key: 'clock',
  label: 'Clock',
  choices: [
    { value: 'on', label: 'With clock', note },
    { value: 'off', label: 'No clock', note: 'take your time' },
  ],
  initial: 'on',
});

export const isNoClock = (settings: Record<string, unknown>) => settings.clock === 'off';
