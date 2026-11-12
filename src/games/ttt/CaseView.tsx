import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/AppText';
import { u } from '@/theme/scale';

import { HelperButton } from '../shell/ui';
import type { Case, CaseRun } from './core';
import { Ask, Btn, C, Choices, NotePopup, Pad, s } from './Pad';

export type Help = { fifty: { label: string; onPress: () => void; disabled?: boolean }; note?: string | null };

/**
 * A case in play: the pad (whole when it fits, else filling the room left with the line to the whole note), the
 * question and its 4 choices, then 50/50 and "Lock it in" pinned at the bottom (Yazan 2026-11-12).
 */
export function CaseView({ c, run, top, onLock, help, locked, note }: { c: Case; run: CaseRun; top: ReactNode; onLock: (pick: number) => void; help?: Help | null; locked?: boolean; note?: string }) {
  // A pick belongs to its case.
  const [pick, setPick] = useState<{ key: string; i: number } | null>(null);
  const picked = pick?.key === c.id ? pick.i : null;
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1, gap: u(8) }}>
      {top}
      <Pad c={c} style={{ flexShrink: 1, minHeight: u(120) }} onOpen={() => setOpen(true)} />
      <Ask q={c.q} />
      <Choices c={c} run={run} picked={picked} onPick={(i) => setPick({ key: c.id, i })} disabled={locked || run.done} />
      {/* The room left sits here, so the buttons stay at the bottom. */}
      <View style={{ flexGrow: 1, flexShrink: 0, flexBasis: 0 }} />
      {help?.note ? <Text style={[s.sub, { textAlign: 'center', color: C.soft }]}>{help.note}</Text> : note ? <Text style={[s.sub, { textAlign: 'center' }]}>{note}</Text> : null}
      {help ? <HelperButton tone="cyan" label={help.fifty.label} onPress={help.fifty.onPress} disabled={locked || run.done || help.fifty.disabled} /> : null}
      <Btn label="Lock it in" onPress={() => picked != null && onLock(picked)} disabled={locked || picked == null || run.done} />
      {open ? <NotePopup c={c} onClose={() => setOpen(false)} /> : null}
    </View>
  );
}
