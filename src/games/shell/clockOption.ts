import type { SetupOption } from './types';
import { tr } from '@/i18n';

/**
 * "No clock" (Yazan 2026-11-12): a setup choice in the Solo modes he picked (Quick Fire Quiz, Wheels; Sketch It
 * Practice has its own). With No clock nothing is timed and the time helpers are hidden; scoring stays the same.
 */
export const clockOption = (note: string): SetupOption => ({
  key: 'clock',
  label: tr('Clock'),
  choices: [
    { value: 'on', label: tr('With clock'), note },
    { value: 'off', label: tr('No clock'), note: tr('take your time') },
  ],
  initial: 'on',
});

export const isNoClock = (settings: Record<string, unknown>) => settings.clock === 'off';
