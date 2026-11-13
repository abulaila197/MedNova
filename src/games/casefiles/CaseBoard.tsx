import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/AppText';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { KeyboardLift } from '../shell/KeyboardLift';
import { searchNames } from '../shell/names';
import { CF, completed, elapsed, invFile, scoreRun, status, type CaseDef, type FileId, type Run, type RunEvent } from './core';
import { DIAG_INDEX, caseLabel, diagName } from './data';
import { Btn, Card, CaseTitle, Kicker, NR, NoirScreen, PauseBtn, Stamp, T, caseClock } from './noir';
import { PinBoard } from './PinBoard';
import { second, useTicker } from '../engine/useTicker';
import { tr } from '@/i18n';

type View_ = { at: 'board' } | { at: 'file'; file: FileId } | { at: 'pick'; kind: 'dd' | 'filter' | 'provisional' | 'redemption' } | { at: 'verdict'; kind: 'provisional' | 'redemption' };

const STAGES = [tr('History'), tr('Exam'), tr('Tests'), tr('Treatment')] as const;

/**
 * One player's whole case on the evidence board (CF1-CF3, as coded): the pinned files, the gated actions,
 * the file reader, the diagnosis pickers and the verdicts. `sealed` hides the stamp and the discharge (CF8).
 * The parent owns the run; this only sends events.
 */
export function CaseBoard({ def, run, sealed, kicker, onEvent, onPause, online, countdown, who }: {
  def: CaseDef; run: Run; sealed: boolean; kicker: string; onEvent: (e: RunEvent) => void; onPause: () => void;
  /** Online (#10, Yazan 2026-11-04): the discharge opens to each player, then "End the case" closes it for them. */
  online?: boolean;
  /** #26: online the top line keeps only the match's countdown ("04:51 left"), in red; no stopwatch beside it. */
  countdown?: string;
  /** Pass the phone: whose case it is, bold in their colour (#13). */
  who?: { name: string; color: string };
}) {
  const shut = sealed && !online;
  const [view, setView] = useState<View_>({ at: 'board' });
  const st = status(def, run, shut);
  const ticking = run.runningSince != null && run.phase === 'board';
  const now = useTicker(ticking, 500, undefined, { shown: (n) => second(elapsed(run, n)) });

  const files = useMemo(
    () => [
      { id: 'personal' as FileId, label: tr('Personal file') },
      { id: 'incident' as FileId, label: tr('Incident') },
      { id: 'background' as FileId, label: tr('Background') },
      { id: 'exam' as FileId, label: tr('Examination'), note: tr('{n} pages', { n: def.exam.length }) },
      ...def.investigations.map((v, i) => ({ id: invFile(i), label: v.title || tr('Results') })),
      { id: 'treatment' as FileId, label: tr('Treatment') },
      { id: 'discharge' as FileId, label: tr('Discharge') },
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
    ? { label: tr('Write your differential'), go: () => setView({ at: 'pick', kind: 'dd' }) }
    : st.showRequestExam
      ? { label: tr('Request examination'), go: () => onEvent({ type: 'REQUEST_EXAM' }) }
      : run.examRequested && !run.examPages.length
        ? { label: tr('Read the examination'), go: () => open('exam') }
        : st.canFilter
          ? { label: tr('Narrow your differential'), go: () => setView({ at: 'pick', kind: 'filter' }) }
          : st.showRequestInv
            ? { label: tr('Request investigations'), go: () => onEvent({ type: 'REQUEST_INV' }) }
            : run.invRequested && nextInv >= 0
              ? { label: tr('Read the {toLowerCase} file', { toLowerCase: files.find((f) => f.id === invFile(nextInv))?.label.toLowerCase() }), go: () => open(invFile(nextInv)) }
              : st.canProvisional
                ? { label: tr('Name the diagnosis'), go: () => setView({ at: 'pick', kind: 'provisional' }) }
                : st.canRedemption
                  ? { label: tr('Make your last call'), go: () => setView({ at: 'pick', kind: 'redemption' }) }
                  : st.unlocked.discharge && !opened.has('discharge')
                    ? { label: tr('Read the discharge'), go: () => open('discharge') }
                    : completed(run) && opened.has('treatment')
                      ? { label: online ? tr('End the case') : tr('Close the case'), go: () => onEvent({ type: 'CLOSE' }) }
                      : null;
  const hint = run.dd == null ? tr('Read the three history files, then write your differential.') : '';
  const list = run.filtered ?? run.dd;
  return (
    <NoirScreen>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          {countdown ? (
            <View style={{ gap: u(2) }}>
              <T size={13} color={END} style={{ fontFamily: F.mono, letterSpacing: 1.2 }}>{countdown.toUpperCase()}</T>
              <Kicker>{kicker}</Kicker>
            </View>
          ) : who ? (
            <View style={{ gap: u(2) }}>
              <T size={12} color={who.color} style={{ fontFamily: F.bodyBold, letterSpacing: 1.4 }}>{who.name === 'You' ? tr('YOUR CASE') : tr('{toUpperCase}’S CASE', { toUpperCase: who.name.toUpperCase() })}</T>
              <Kicker>{`${kicker} · ${caseClock(elapsed(run, now))}`}</Kicker>
            </View>
          ) : (
            <Kicker>{`${kicker} · ${caseClock(elapsed(run, now))}`}</Kicker>
          )}
          <CaseTitle title={def.title} size={19} />
        </View>
        <PauseBtn onPress={onPause} />
      </View>
      <View style={s.stages}>
        {STAGES.map((x, i) => (
          <T key={x} size={11} color={i === stage ? NR.white : i < stage ? NR.dim : '#5a6090'} style={i < stage ? { textDecorationLine: 'line-through' } : null}>
            {x}
            {i < STAGES.length - 1 ? '  ·  ' : ''}
          </T>
        ))}
      </View>
      <PinBoard def={def} run={run} sealed={shut} onOpen={open} />
      {list ? (
        <View style={{ gap: u(2) }}>
          <T size={12} color={NR.soft} lines={2}>{list.join('  /  ')}</T>
          {run.provisional ? (
            <T size={11.5} color={NR.dim} lines={2}>
              {tr('Diagnosis: {id}', { id: run.provisional.id })} {run.provisional.correct ? tr('· right') : tr('· not right')}
              {run.redemption ? tr('  ·  Last call: {id} {n}', { id: run.redemption.id, n: run.redemption.correct ? tr('· right') : tr('· not right') }) : ''}
            </T>
          ) : null}
        </View>
      ) : hint ? (
        <T size={12} color={NR.soft}>{hint}</T>
      ) : null}
      {action ? (
        online && action.label === 'End the case' ? (
          <Pressable onPress={action.go} accessibilityRole="button" accessibilityLabel={tr('End the case')} style={({ pressed }) => [s.end, { opacity: pressed ? 0.85 : 1 }]}>
            <T size={13} color="#ffffff" style={{ fontFamily: F.bodyBold, textAlign: 'center' }}>{tr('End the case')}</T>
          </Pressable>
        ) : (
          <Btn label={action.label} onPress={action.go} />
        )
      ) : null}
    </NoirScreen>
  );
}

/** Reading one file: prose on a white card, exam pages as tabs, investigation report sheets. */
function FileReader({ def, run, file, onEvent, onBack }: { def: CaseDef; run: Run; file: FileId; onEvent: (e: RunEvent) => void; onBack: () => void }) {
  const [page, setPage] = useState(0);
  const inv = file.startsWith('inv') ? def.investigations[Number(file.slice(3))] : null;
  const title = file === 'personal' ? tr('Personal file') : file === 'incident' ? tr('Incident') : file === 'background' ? tr('Background') : file === 'exam' ? tr('Examination') : file === 'treatment' ? tr('Treatment') : file === 'discharge' ? tr('Follow-up and discharge') : inv?.title || tr('Results');
  const body = file === 'personal' ? def.personal : file === 'incident' ? def.incident : file === 'background' ? def.background : file === 'treatment' ? def.treatment : file === 'discharge' ? def.discharge : file === 'exam' ? def.exam[page]?.body ?? '' : inv?.body ?? '';
  return (
    <NoirScreen scroll>
      <Animated.View entering={FadeInDown.duration(220)} style={{ gap: u(12) }}>
        <View style={s.top}>
          <View style={{ flex: 1 }}>
            <Kicker>{tr('{n} · confidential', { n: caseLabel(def.id) })}</Kicker>
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
        <Btn ghost label={tr('Back to the board')} onPress={onBack} />
      </Animated.View>
    </NoirScreen>
  );
}

const PICK = {
  dd: { title: tr('Your differential'), note: tr('Up to {ddMax} diagnoses. Right ones score, wrong ones cost a little.', { ddMax: CF.ddMax }), max: CF.ddMax, go: tr('File the differential') },
  filter: { title: tr('Narrow it down'), note: tr('Now you have examined the patient: add, remove or keep. A name already in your first list counts once.'), max: CF.ddMax, go: tr('File the narrowed list') },
  provisional: { title: tr('Name the diagnosis'), note: tr('One diagnosis, the exact name. You hear right or not right at once.'), max: 1, go: tr('Submit the diagnosis') },
  redemption: { title: tr('Your last call'), note: tr('You have read the treatment. One more diagnosis, worth 10 if right.'), max: 1, go: tr('Submit the last call') },
};

/** Type-ahead over the master list (CF4), exact names only (CF3). */
function Picker({ kind, initial, onCancel, onSubmit }: { kind: keyof typeof PICK; initial: string[]; onCancel: () => void; onSubmit: (ids: string[]) => void }) {
  const p = PICK[kind];
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<string[]>(initial);
  const hits = useMemo(() => searchNames(DIAG_INDEX, q, { min: 3, max: 7, skip: (d) => chosen.includes(d.label) }), [q, chosen]);
  const full = chosen.length >= p.max;
  const add = (label: string) => {
    if (p.max === 1) setChosen([label]);
    else if (!full) setChosen([...chosen, label]);
    setQ('');
    // The last name it can take: close the keyboard so the file button shows.
    if (p.max === 1 || chosen.length + 1 >= p.max) Keyboard.dismiss();
  };
  // While typing (Yazan 2026-11-13) the box docks just above the keyboard with the matches right over it, and the
  // long note and the buttons step aside; they come back when the keyboard closes.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => setTyping(false));
    return () => sub.remove();
  }, []);
  const box = !full || p.max === 1 ? (
    <TextInput
      value={q}
      onChangeText={setQ}
      onFocus={() => setTyping(true)}
      onBlur={() => Platform.OS === 'web' && setTyping(false)}
      placeholder={tr('Type a diagnosis…')}
      placeholderTextColor={NR.dim}
      autoCorrect={false}
      autoCapitalize="none"
      style={s.input}
      accessibilityLabel={tr('Search diagnoses')}
    />
  ) : null;
  const list = (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={[{ gap: u(2) }, typing ? { flexGrow: 1, justifyContent: 'flex-end' } : null]}>
      {hits.map((d) => (
        <Pressable key={d.id} onPress={() => add(d.label)} accessibilityRole="button" accessibilityLabel={tr('Add {label}', { label: d.label })} style={({ pressed }) => [s.hit, pressed ? { backgroundColor: NR.panel } : null]}>
          <T size={13.5}>{diagName(d.label)}</T>
        </Pressable>
      ))}
      {q.trim().length >= 3 && !hits.length ? <T size={12} color={NR.dim}>{tr('No diagnosis by that name.')}</T> : null}
    </ScrollView>
  );
  return (
    <NoirScreen>
      <KeyboardLift style={{ flex: 1, gap: u(12) }}>
        <View style={{ gap: u(4) }}>
          <Kicker>{p.max > 1 ? tr('{n} of {max}', { n: chosen.length, max: p.max }) : tr('One name')}</Kicker>
          <T size={typing ? 18 : 22}>{p.title}</T>
          {typing ? null : <T size={12} color={NR.soft}>{p.note}</T>}
        </View>
        <View style={{ gap: u(6) }}>
          {chosen.map((c, i) => (
            <View key={c} style={[s.chosen, typing ? s.chosenTight : null]}>
              <T size={13.5} color={NR.cardInk} style={{ flex: 1 }} lines={1}>{p.max > 1 ? `${i + 1}. ` : ''}{c}</T>
              <Pressable onPress={() => setChosen(chosen.filter((x) => x !== c))} hitSlop={u(8)} accessibilityRole="button" accessibilityLabel={tr('Remove {c}', { c })}>
                <T size={15} color={NR.red}>×</T>
              </Pressable>
            </View>
          ))}
        </View>
        {typing ? (
          <>
            {list}
            {box}
          </>
        ) : (
          <>
            {box}
            {list}
            <View style={{ flexDirection: 'row', gap: u(8) }}>
              <Btn ghost label={tr('Back')} onPress={onCancel} style={{ flex: 1 }} />
              <Btn label={p.go} onPress={() => onSubmit(chosen)} disabled={!chosen.length} style={{ flex: 2.4 }} />
            </View>
          </>
        )}
      </KeyboardLift>
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
        ? tr('Treatment starts now. Read how it went.')
        : tr('Treatment starts anyway. Read it, then you get one last call.')
      : right
        ? tr('You got there in the end.')
        : tr('The case goes in the drawer.');
  return (
    <NoirScreen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: u(14) }}>
        <Kicker>{kind === 'provisional' ? tr('Your diagnosis') : tr('Your last call')}</Kicker>
        <T size={18} color={NR.soft} style={{ textAlign: 'center' }}>{v?.id}</T>
        <Animated.View entering={FadeIn.delay(250).duration(300)}>
          <T size={40} color={right ? NR.green : NR.wrong}>{right ? tr('Right.') : tr('Not right.')}</T>
        </Animated.View>
        <T size={13} color={NR.soft} style={{ textAlign: 'center', maxWidth: u(260) }}>{note}</T>
        {score ? (
          <Animated.View entering={FadeIn.delay(600).duration(300)}>
            <Stamp word={score.stamp} />
          </Animated.View>
        ) : null}
      </View>
      <Btn label={kind === 'provisional' ? tr('Start treatment') : tr('Back to the board')} onPress={onNext} />
    </NoirScreen>
  );
}

/** The red of the online countdown and the "End the case" button. */
const END = '#ff4d5e';

const s = StyleSheet.create({
  end: { backgroundColor: END, borderRadius: u(14), paddingVertical: u(12), alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: u(10) },
  stages: { flexDirection: 'row', flexWrap: 'wrap' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6) },
  tab: { borderRadius: u(10), borderWidth: 1, borderColor: NR.line, paddingHorizontal: u(9), paddingVertical: u(4) },
  tabOn: { backgroundColor: NR.card, borderColor: NR.card },
  report: { gap: u(3), borderTopWidth: 3, borderTopColor: NR.red },
  chosen: { flexDirection: 'row', alignItems: 'center', backgroundColor: NR.card, paddingHorizontal: u(12), paddingVertical: u(8), borderRadius: u(10), borderLeftWidth: 4, borderLeftColor: NR.red },
  input: { fontFamily: NR.type, fontSize: u(15), color: NR.white, borderWidth: 1.5, borderColor: NR.red, borderRadius: u(12), paddingVertical: u(9), paddingHorizontal: u(12), outlineStyle: 'none' } as never,
  chosenTight: { paddingVertical: u(5) },
  hit: { paddingVertical: u(9), paddingHorizontal: u(4), borderBottomWidth: 1, borderBottomColor: NR.line },
});
