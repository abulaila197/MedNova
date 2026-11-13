import { useState, type ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/AppText";
import { u } from "@/theme/scale";

import type { Case, CaseRun } from "./core";
import { Ask, Btn, C, Choices, HelpBtn, NotePopup, Sheet, s } from "./Paper";
import { tr } from '@/i18n';

export type Help = {
  fifty: { label: string; onPress: () => void; disabled?: boolean };
  highlight: { label: string; onPress: () => void; disabled?: boolean };
  note?: string | null;
};

/**
 * A case in play: the sheet takes the room left once the question and its 4 choices fit, with the whole note one tap
 * away; the helps sit fixed over "Lock it in" at the bottom (Yazan 2026-11-12). Stage 1's choices are replaced by stage 2's once locked. `help` is Solo's 50/50 and Highlight.
 */
export function CaseView({
  c,
  run,
  top,
  onLock,
  help,
  locked,
  note,
}: {
  c: Case;
  run: CaseRun;
  top: ReactNode;
  onLock: (pick: number) => void;
  help?: Help | null;
  locked?: boolean;
  note?: string;
}) {
  const stage = run.stage === "done" ? 2 : run.stage;
  // A pick belongs to its case and stage, so a new stage starts with nothing picked.
  const key = `${c.id}:${stage}`;
  const [pick, setPick] = useState<{ key: string; i: number } | null>(null);
  const picked = pick?.key === key ? pick.i : null;
  const setPicked = (i: number) => setPick({ key, i });
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1, gap: u(8) }}>
      {top}
      {/* The paper takes what is left once the 4 choices fit (Yazan 2026-11-12); the whole note opens in a pop-up. */}
      <Sheet c={c} highlight={run.highlight} style={{ flex: 1, minHeight: u(110) }} onOpen={() => setOpen(true)} />
      <Ask stage={stage} />
      <Choices
        c={c}
        run={run}
        stage={stage}
        picked={picked}
        onPick={setPicked}
        disabled={locked || run.stage === "done"}
      />
      {help?.note ? (
        <Text style={[s.sub, { textAlign: "center", color: C.soft }]}>{help.note}</Text>
      ) : note ? (
        <Text style={[s.sub, { textAlign: "center" }]}>{note}</Text>
      ) : null}
      {help ? (
        <View style={{ flexDirection: "row", gap: u(6) }}>
          <HelpBtn tone="fifty" label={help.fifty.label} onPress={help.fifty.onPress} disabled={locked || run.stage === "done" || help.fifty.disabled} />
          <HelpBtn tone="highlight" label={help.highlight.label} onPress={help.highlight.onPress} disabled={locked || run.stage === "done" || help.highlight.disabled} />
        </View>
      ) : null}
      <Btn
        label={tr('Lock it in')}
        go
        onPress={() => picked != null && onLock(picked)}
        disabled={locked || picked == null || run.stage === "done"}
      />
      {open ? <NotePopup c={c} highlight={run.highlight} onClose={() => setOpen(false)} /> : null}
    </View>
  );
}
