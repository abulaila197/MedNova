import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/AppText';
import { u } from '@/theme/scale';

import { HelperButton } from '../shell/ui';
import type { Case, CaseRun } from './core';
import { Ask, Btn, C, Choices, NotePopup, Pad, s } from './Pad';
import { tr } from '@/i18n';

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
    <View style={{ flex: 1, gap: u(7) }}>
      {top}
      {/* Item 7 (Yazan 2026-11-16): the pad takes the room the question, choices and buttons leave (whole story on a
          tablet, a scrolling story on a small phone), instead of an empty gap above the buttons. */}
      <Pad c={c} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: u(110) }} onOpen={() => setOpen(true)} />
      {/* The question and choices scroll when they don't fit, so the buttons below always stay on the screen and
          clear of the phone's own buttons (Yazan 2026-11-15). */}
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: u(7) }} showsVerticalScrollIndicator={false}>
        <Ask q={c.q} />
        <Choices c={c} run={run} picked={picked} onPick={(i) => setPick({ key: c.id, i })} disabled={locked || run.done} />
      </ScrollView>
      {help?.note ? <Text style={[s.sub, { textAlign: 'center', color: C.soft }]}>{help.note}</Text> : note ? <Text style={[s.sub, { textAlign: 'center' }]}>{note}</Text> : null}
      {help ? <HelperButton tone="cyan" label={help.fifty.label} onPress={help.fifty.onPress} disabled={locked || run.done || help.fifty.disabled} /> : null}
      <Btn label={tr('Lock it in')} onPress={() => picked != null && onLock(picked)} disabled={locked || picked == null || run.done} />
      {open ? <NotePopup c={c} onClose={() => setOpen(false)} /> : null}
    </View>
  );
}
