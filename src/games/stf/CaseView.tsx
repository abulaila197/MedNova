import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/AppText';
import { u } from '@/theme/scale';

import type { Case, CaseRun } from './core';
import { Ask, Btn, C, Choices, Sheet, s } from './Paper';

export type Help = { fifty: { label: string; onPress: () => void; disabled?: boolean }; highlight: { label: string; onPress: () => void; disabled?: boolean }; note?: string | null };

/**
 * A case in play: the sheet takes the free height (about 3/5 of a phone), then the question, its 4 choices and
 * "Lock it in". Stage 1's choices are replaced by stage 2's once locked. `help` is Solo's 50/50 and Highlight.
 */
export function CaseView({ c, run, top, onLock, help, locked, note }: { c: Case; run: CaseRun; top: ReactNode; onLock: (pick: number) => void; help?: Help | null; locked?: boolean; note?: string }) {
  const stage = run.stage === 'done' ? 2 : run.stage;
  // A pick belongs to its case and stage, so a new stage starts with nothing picked.
  const key = `${c.id}:${stage}`;
  const [pick, setPick] = useState<{ key: string; i: number } | null>(null);
  const picked = pick?.key === key ? pick.i : null;
  const setPicked = (i: number) => setPick({ key, i });
  return (
    <View style={{ flex: 1, gap: u(8) }}>
      {top}
      <Sheet c={c} highlight={run.highlight} style={{ flex: 1, minHeight: u(190) }} />
      <Ask stage={stage} />
      <Choices c={c} run={run} stage={stage} picked={picked} onPick={setPicked} disabled={locked || run.stage === 'done'} />
      {help ? (
        <View style={{ gap: u(4) }}>
          <View style={{ flexDirection: 'row', gap: u(6) }}>
            <Btn label={help.fifty.label} onPress={help.fifty.onPress} disabled={locked || help.fifty.disabled} flex={1} />
            <Btn label={help.highlight.label} onPress={help.highlight.onPress} disabled={locked || help.highlight.disabled} flex={1} />
          </View>
          {help.note ? <Text style={[s.sub, { textAlign: 'center', color: C.soft }]}>{help.note}</Text> : null}
        </View>
      ) : note ? (
        <Text style={[s.sub, { textAlign: 'center' }]}>{note}</Text>
      ) : null}
      <Btn label="Lock it in" go onPress={() => picked != null && onLock(picked)} disabled={locked || picked == null || run.stage === 'done'} />
    </View>
  );
}
