import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { u } from '@/theme/scale';

import { searchNames } from '../shell/names';
import { CF, completed, elapsed, invFile, scoreRun, status, type CaseDef, type FileId, type Run, type RunEvent } from './core';
import { DIAG_INDEX, caseLabel, diagName } from './data';
import { Btn, Card, CaseTitle, Kicker, NR, NoirScreen, PauseBtn, Stamp, T, clock } from './noir';
import { PinBoard } from './PinBoard';

type View_ = { at: 'board' } | { at: 'file'; file: FileId } | { at: 'pick'; kind: 'dd' | 'filter' | 'provisional' | 'redemption' } | { at: 'verdict'; kind: 'provisional' | 'redemption' };

const STAGES = ['History', 'Exam', 'Tests', 'Treatment'] as const;

/**
 * One player's whole case on the evidence board (CF1-CF3, as coded): the pinned files, the gated actions,
 * the file reader, the diagnosis pickers and the verdicts. `sealed` hides the stamp and the discharge (CF8).
 * The parent owns the run; this only sends events.
 */
export function CaseBoard({ def, run, sealed, kicker, onEvent, onPause }: { def: CaseDef; run: Run; sealed: boolean; kicker: string; onEvent: (e: RunEvent) => void; onPause: () => void }) {
  const [view, setView] = useState<View_>({ at: 'board' });
  const [now, setNow] = useState(Date.now());
  const st = status(def, run, sealed);
  const ticking = run.runningSince != null && run.phase === 'board';
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [ticking]);

  const files = useMemo(
    () => [
      { id: 'personal' as FileId, label: 'Personal file' },
      { id: 'incident' as FileId, label: 'Incident' },
      { id: 'background' as FileId, label: 'Background' },
      { id: 'exam' as FileId, label: 'Examination', note: `${def.exam.length} pages` },
      ...def.investigations.map((v, i) => ({ id: invFile(i), label: v.title || 'Results' })),
      { id: 'treatment' as FileId, label: 'Treatment' },
      { id: 'discharge' as FileId, label: 'Discharge' },
    ],
    [def],
  );

  const open = (file: FileId) => {
    if (!st.unlocked[file]) return;
    if (file === 'exam') onEvent({ type: 'VIEW_EXAM', page: 0 });
    else onEvent({ type: 'OPEN', file });
    setView({ at: 'file', file });
  };

  if (view.at === 'file') return <FileReader def={def} run={run} file={view.file} onEvent={onEvent} onBack={() => setView({ at: 'board' })} />;
  if (view.at === 'pick')
    return (
      <Picker
        kind={view.kind}
        initial={view.kind === 'filter' ? run.dd ?? [] : []}
        onCancel={() => setView({ at: 'board' })}
        onSubmit={(ids) => {
          const t = Date.now();
          if (view.kind === 'dd') onEvent({ type: 'SUBMIT_DD', ids });
          if (view.kind === 'filter') onEvent({ type: 'SUBMIT_FILTER', ids });
          if (view.kind === 'provisional') onEvent({ type: 'SUBMIT_PROVISIONAL', id: ids[0], now: t });
          if (view.kind === 'redemption') onEvent({ type: 'SUBMIT_REDEMPTION', id: ids[0], now: t });
          setView(view.kind === 'provisional' || view.kind === 'redemption' ? { at: 'verdict', kind: view.kind } : { at: 'board' });
        }}
      />
    );
  if (view.at === 'verdict')
    return (
      <Verdict
        run={run}
        def={def}
        kind={view.kind}
        sealed={sealed}
        onNext={() => {
          if (view.kind === 'provisional') {
            // "Treatment starting": the treatment file opens by itself and counts as read (as coded).
            onEvent({ type: 'RELEASE_TREATMENT' });
            onEvent({ type: 'OPEN', file: 'treatment' });
            setView({ at: 'file', file: 'treatment' });
          } else setView({ at: 'board' });
        }}
      />
    );

  const opened = new Set(run.opened);
  const stage = run.provisional ? 3 : run.invRequested ? 2 : run.examRequested ? 1 : 0;
  const nextInv = def.investigations.findIndex((_, i) => !opened.has(invFile(i)));
  const action: { label: string; go: () => void } | null = st.canDd
    ? { label: 'Write your differential', go: () => setView({ at: 'pick', kind: 'dd' }) }
    : st.showRequestExam
      ? { label: 'Request examination', go: () => onEvent({ type: 'REQUEST_EXAM' }) }
      : run.examRequested && !run.examPages.length
        ? { label: 'Read the examination', go: () => open('exam') }
        : st.canFilter
          ? { label: 'Narrow your differential', go: () => setView({ at: 'pick', kind: 'filter' }) }
          : st.showRequestInv
            ? { label: 'Request investigations', go: () => onEvent({ type: 'REQUEST_INV' }) }
            : run.invRequested && nextInv >= 0
              ? { label: `Read the ${files.find((f) => f.id === invFile(nextInv))?.label.toLowerCase()} file`, go: () => open(invFile(nextInv)) }
              : st.canProvisional
                ? { label: 'Name the diagnosis', go: () => setView({ at: 'pick', kind: 'provisional' }) }
                : st.canRedemption
                  ? { label: 'Make your last call', go: () => setView({ at: 'pick', kind: 'redemption' }) }
                  : st.unlocked.discharge && !opened.has('discharge')
                    ? { label: 'Read the discharge', go: () => open('discharge') }
                    : completed(run) && opened.has('treatment')
                      ? { label: 'Close the case', go: () => onEvent({ type: 'CLOSE' }) }
                      : null;
  const hint = run.dd == null ? 'Read the three history files, then write your differential.' : '';
  const list = run.filtered ?? run.dd;
  return (
    <NoirScreen>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Kicker>{`${kicker} · ${clock(elapsed(run, now))}`}</Kicker>
          <CaseTitle title={def.title} size={19} />
        </View>
        <PauseBtn onPress={onPause} />
      </View>
      <View style={s.stages}>
        {STAGES.map((x, i) => (
          <T key={x} size={11} color={i === stage ? NR.white : i < stage ? NR.dim : '#4a4a48'} style={i < stage ? { textDecorationLine: 'line-through' } : null}>
            {x}
            {i < STAGES.length - 1 ? '  ·  ' : ''}
          </T>
        ))}
      </View>
      <PinBoard def={def} run={run} sealed={sealed} onOpen={open} />
      {list ? (
        <View style={{ gap: u(2) }}>
          <T size={12} color={NR.soft} lines={2}>{list.join('  /  ')}</T>
          {run.provisional ? (
            <T size={11.5} color={NR.dim} lines={2}>
              Diagnosis: {run.provisional.id} {run.provisional.correct ? '· right' : '· not right'}
              {run.redemption ? `  ·  Last call: ${run.redemption.id} ${run.redemption.correct ? '· right' : '· not right'}` : ''}
            </T>
          ) : null}
        </View>
      ) : hint ? (
        <T size={12} color={NR.soft}>{hint}</T>
      ) : null}
      {action ? <Btn label={action.label} onPress={action.go} /> : null}
    </NoirScreen>
  );
}

/** Reading one file: prose on a white card, exam pages as tabs, investigation report sheets. */
function FileReader({ def, run, file, onEvent, onBack }: { def: CaseDef; run: Run; file: FileId; onEvent: (e: RunEvent) => void; onBack: () => void }) {
  const [page, setPage] = useState(0);
  const inv = file.startsWith('inv') ? def.investigations[Number(file.slice(3))] : null;
  const title = file === 'personal' ? 'Personal file' : file === 'incident' ? 'Incident' : file === 'background' ? 'Background' : file === 'exam' ? 'Examination' : file === 'treatment' ? 'Treatment' : file === 'discharge' ? 'Follow-up and discharge' : inv?.title || 'Results';
  const body = file === 'personal' ? def.personal : file === 'incident' ? def.incident : file === 'background' ? def.background : file === 'treatment' ? def.treatment : file === 'discharge' ? def.discharge : file === 'exam' ? def.exam[page]?.body ?? '' : inv?.body ?? '';
  return (
    <NoirScreen scroll>
      <Animated.View entering={FadeInDown.duration(220)} style={{ gap: u(12) }}>
        <View style={s.top}>
          <View style={{ flex: 1 }}>
            <Kicker>{`${caseLabel(def.id)} · confidential`}</Kicker>
            <T size={22}>{title}</T>
          </View>
        </View>
        {file === 'exam' ? (
          <View style={s.tabs}>
            {def.exam.map((p, i) => {
              const seen = run.examPages.includes(i);
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    setPage(i);
                    onEvent({ type: 'VIEW_EXAM', page: i });
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: i === page }}
                  style={[s.tab, i === page ? s.tabOn : null]}
                >
                  <T size={11.5} color={i === page ? NR.cardInk : seen ? NR.soft : NR.white}>{p.title}</T>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <Card style={{ gap: u(10) }}>
          {body.split(/\n+/).filter(Boolean).map((para, i) => (
            <T key={i} size={14} color={NR.cardInk} style={{ lineHeight: u(21) }}>{para}</T>
          ))}
        </Card>
        {inv?.reports.map((r, i) => (
          <Card key={i} style={s.report}>
            <T size={11} color={NR.red} style={{ letterSpacing: 2 }}>{r.title.toUpperCase()}</T>
            {r.lines.map((l, j) => {
              const k = l.indexOf(':');
              return (
                <T key={j} size={13} color={NR.cardInk} style={{ lineHeight: u(19) }}>
                  {k > 0 ? <Text style={{ color: NR.cardSoft }}>{l.slice(0, k + 1)}</Text> : null}
                  {k > 0 ? l.slice(k + 1) : l}
                </T>
              );
            })}
          </Card>
        ))}
        <Btn ghost label="Back to the board" onPress={onBack} />
      </Animated.View>
    </NoirScreen>
  );
}

const PICK = {
  dd: { title: 'Your differential', note: `Up to ${CF.ddMax} diagnoses. It is scored once, after the examination.`, max: CF.ddMax, go: 'File the differential' },
  filter: { title: 'Narrow it down', note: 'Now you have examined the patient: add, remove or keep. This list is the one that scores.', max: CF.ddMax, go: 'File the narrowed list' },
  provisional: { title: 'Name the diagnosis', note: 'One diagnosis, the exact name. You hear right or not right at once.', max: 1, go: 'Submit the diagnosis' },
  redemption: { title: 'Your last call', note: 'You have read the treatment. One more diagnosis, worth 10 if right.', max: 1, go: 'Submit the last call' },
};

/** Type-ahead over the master list (CF4), exact names only (CF3). */
function Picker({ kind, initial, onCancel, onSubmit }: { kind: keyof typeof PICK; initial: string[]; onCancel: () => void; onSubmit: (ids: string[]) => void }) {
  const p = PICK[kind];
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<string[]>(initial);
  const hits = useMemo(() => searchNames(DIAG_INDEX, q, { min: 2, max: 7, skip: (d) => chosen.includes(d.label) }), [q, chosen]);
  const full = chosen.length >= p.max;
  const add = (label: string) => {
    if (p.max === 1) setChosen([label]);
    else if (!full) setChosen([...chosen, label]);
    setQ('');
  };
  return (
    <NoirScreen>
      <View style={{ gap: u(4) }}>
        <Kicker>{p.max > 1 ? `${chosen.length} of ${p.max}` : 'One name'}</Kicker>
        <T size={22}>{p.title}</T>
        <T size={12} color={NR.soft}>{p.note}</T>
      </View>
      <View style={{ gap: u(6) }}>
        {chosen.map((c, i) => (
          <View key={c} style={s.chosen}>
            <T size={13.5} color={NR.cardInk} style={{ flex: 1 }}>{p.max > 1 ? `${i + 1}. ` : ''}{c}</T>
            <Pressable onPress={() => setChosen(chosen.filter((x) => x !== c))} hitSlop={u(8)} accessibilityRole="button" accessibilityLabel={`Remove ${c}`}>
              <T size={15} color={NR.red}>×</T>
            </Pressable>
          </View>
        ))}
      </View>
      {!full || p.max === 1 ? (
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Type a diagnosis…"
          placeholderTextColor={NR.dim}
          autoCorrect={false}
          autoCapitalize="none"
          style={s.input}
          accessibilityLabel="Search diagnoses"
        />
      ) : null}
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ gap: u(2) }}>
        {hits.map((d) => (
          <Pressable key={d.id} onPress={() => add(d.label)} accessibilityRole="button" accessibilityLabel={`Add ${d.label}`} style={({ pressed }) => [s.hit, pressed ? { backgroundColor: NR.panel } : null]}>
            <T size={13.5}>{diagName(d.label)}</T>
          </Pressable>
        ))}
        {q.trim().length >= 2 && !hits.length ? <T size={12} color={NR.dim}>No diagnosis by that name.</T> : null}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: u(8) }}>
        <Btn ghost label="Back" onPress={onCancel} style={{ flex: 1 }} />
        <Btn label={p.go} onPress={() => onSubmit(chosen)} disabled={!chosen.length} style={{ flex: 2.4 }} />
      </View>
    </NoirScreen>
  );
}

/** Right or not right, told at once; the right name is never shown (as coded). The stamp waits in multiplayer (CF10). */
function Verdict({ def, run, kind, sealed, onNext }: { def: CaseDef; run: Run; kind: 'provisional' | 'redemption'; sealed: boolean; onNext: () => void }) {
  const v = kind === 'provisional' ? run.provisional : run.redemption;
  const right = !!v?.correct;
  const score = !sealed && completed(run) ? scoreRun(def, run) : null;
  const note =
    kind === 'provisional'
      ? right
        ? 'Treatment starts now. Read how it went.'
        : 'Treatment starts anyway. Read it, then you get one last call.'
      : right
        ? 'You got there in the end.'
        : 'The case goes in the drawer.';
  return (
    <NoirScreen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: u(14) }}>
        <Kicker>{kind === 'provisional' ? 'Your diagnosis' : 'Your last call'}</Kicker>
        <T size={18} color={NR.soft} style={{ textAlign: 'center' }}>{v?.id}</T>
        <Animated.View entering={FadeIn.delay(250).duration(300)}>
          <T size={40} color={right ? NR.green : NR.red}>{right ? 'Right.' : 'Not right.'}</T>
        </Animated.View>
        <T size={13} color={NR.soft} style={{ textAlign: 'center', maxWidth: u(260) }}>{note}</T>
        {score ? (
          <Animated.View entering={FadeIn.delay(600).duration(300)}>
            <Stamp word={score.stamp} />
          </Animated.View>
        ) : null}
      </View>
      <Btn label={kind === 'provisional' ? 'Start treatment' : 'Back to the board'} onPress={onNext} />
    </NoirScreen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: u(10) },
  stages: { flexDirection: 'row', flexWrap: 'wrap' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6) },
  tab: { borderRadius: u(10), borderWidth: 1, borderColor: NR.line, paddingHorizontal: u(9), paddingVertical: u(4) },
  tabOn: { backgroundColor: NR.card, borderColor: NR.card },
  report: { gap: u(3), borderTopWidth: 3, borderTopColor: NR.red },
  chosen: { flexDirection: 'row', alignItems: 'center', backgroundColor: NR.card, paddingHorizontal: u(12), paddingVertical: u(8), borderRadius: u(10), borderLeftWidth: 4, borderLeftColor: NR.red },
  input: { fontFamily: NR.type, fontSize: u(15), color: NR.white, borderWidth: 1.5, borderColor: NR.red, borderRadius: u(12), paddingVertical: u(9), paddingHorizontal: u(12), outlineStyle: 'none' } as never,
  hit: { paddingVertical: u(9), paddingHorizontal: u(4), borderBottomWidth: 1, borderBottomColor: NR.line },
});
