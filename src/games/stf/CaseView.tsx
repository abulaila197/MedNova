import { useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";

import { Text } from "@/components/AppText";
import { u, useScreen } from "@/theme/scale";

import type { Case, CaseRun } from "./core";
import { Ask, Btn, C, Choices, Sheet, s } from "./Paper";

export type Help = {
  fifty: { label: string; onPress: () => void; disabled?: boolean };
  highlight: { label: string; onPress: () => void; disabled?: boolean };
  note?: string | null;
};

/**
 * A case in play: the sheet is about 3/5 of the screen tall (Yazan) and scrolls inside; under it the question and its
 * 4 choices, scrolling with the page, and "Lock it in" always in reach at the bottom. Stage 1's choices are replaced by stage 2's once locked. `help` is Solo's 50/50 and Highlight.
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
  const { height } = useScreen();
  return (
    <View style={{ flex: 1, gap: u(10) }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: u(10), paddingBottom: u(4) }}
        showsVerticalScrollIndicator={false}
      >
        {top}
        <Sheet
          c={c}
          highlight={run.highlight}
          style={{ height: Math.max(u(260), height * 0.56) }}
        />
        <Ask stage={stage} />
        <Choices
          c={c}
          run={run}
          stage={stage}
          picked={picked}
          onPick={setPicked}
          disabled={locked || run.stage === "done"}
        />
        {help ? (
          <View style={{ gap: u(4) }}>
            <View style={{ flexDirection: "row", gap: u(6) }}>
              <Btn
                label={help.fifty.label}
                onPress={help.fifty.onPress}
                disabled={locked || help.fifty.disabled}
                flex={1}
              />
              <Btn
                label={help.highlight.label}
                onPress={help.highlight.onPress}
                disabled={locked || help.highlight.disabled}
                flex={1}
              />
            </View>
            {help.note ? (
              <Text style={[s.sub, { textAlign: "center", color: C.soft }]}>
                {help.note}
              </Text>
            ) : null}
          </View>
        ) : note ? (
          <Text style={[s.sub, { textAlign: "center" }]}>{note}</Text>
        ) : null}
      </ScrollView>
      <Btn
        label="Lock it in"
        go
        onPress={() => picked != null && onLock(picked)}
        disabled={locked || picked == null || run.stage === "done"}
      />
    </View>
  );
}
