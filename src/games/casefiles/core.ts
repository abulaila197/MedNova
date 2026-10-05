// Case Files: Unsolved Differentials, pure rules (CF1-CF10), ported from the old game's flow and scoring
// (games-src/code/case-file-unsolved). No React here, so the engine tests can run it in Node.

/** One page of prose (personal file, history, an exam page, treatment, discharge). */
export type Page = { title: string; body: string };
/** A test result: the story line, then its report blocks ("Laboratory Report" and its lines). */
export type Investigation = { title: string; body: string; reports: { title: string; lines: string[] }[] };

export type CaseDef = {
  id: string;
  title: string;
  personal: string;
  incident: string;
  background: string;
  exam: Page[];
  investigations: Investigation[];
  treatment: string;
  discharge: string;
  /** The doc's first list (DD1), shown in the end review only; never scored (CF1). */
  dd1: string[];
  /** The doc's narrowed list (DD2) without the final diagnosis, as slots: a slot counts when any of its names is
   *  listed ("Ruptured ovarian cyst" or "Ovarian torsion"). What the filtered list scores against (CF1, CF7). */
  dd2: string[][];
  /** The final diagnosis (= the provisional answer). Strict match (CF3). */
  final: string;
  /** A broader name for the final the doc listed in DD2 ("Acute appendicitis"): like the final, it neither scores nor costs in the DD. */
  parent?: string;
};

export const CF = {
  ddMax: 5,
  points: { ddRight: 10, ddWrong: 2, provisional: 20, redemption: 10, timeMax: 10 },
  timeWindowMs: 5 * 60_000,
};

export type FileId = 'personal' | 'incident' | 'background' | 'exam' | `inv${number}` | 'treatment' | 'discharge';

export type Verdict = { id: string; correct: boolean };

export type Run = {
  caseId: string;
  /** 'board' while playing; 'done' once the stamp is down and the discharge has been read (or sealed). */
  phase: 'board' | 'paused' | 'done';
  opened: FileId[];
  examPages: number[];
  examRequested: boolean;
  /** First list (unscored), then the filtered list after the exam (scored once, CF1). */
  dd: string[] | null;
  filtered: string[] | null;
  invRequested: boolean;
  provisional: Verdict | null;
  /** The treatment opens after the "treatment starting" moment. */
  treatmentReleased: boolean;
  redemption: Verdict | null;
  /** Stopwatch from case open to the last submission; pauses in the background (rule 4). */
  elapsedMs: number;
  runningSince: number | null;
  /** Ms on the clock at the last submission, once the case is complete. */
  finalMs: number | null;
};

export type RunEvent =
  | { type: 'OPEN'; file: FileId }
  | { type: 'VIEW_EXAM'; page: number }
  | { type: 'SUBMIT_DD'; ids: string[] }
  | { type: 'REQUEST_EXAM' }
  | { type: 'SUBMIT_FILTER'; ids: string[] }
  | { type: 'REQUEST_INV' }
  | { type: 'SUBMIT_PROVISIONAL'; id: string; now: number }
  | { type: 'RELEASE_TREATMENT' }
  | { type: 'SUBMIT_REDEMPTION'; id: string; now: number }
  | { type: 'CLOSE' }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number };

export const invFile = (i: number): FileId => `inv${i}`;

export function startRun(caseId: string, now: number): Run {
  return {
    caseId, phase: 'board', opened: [], examPages: [], examRequested: false, dd: null, filtered: null, invRequested: false,
    provisional: null, treatmentReleased: false, redemption: null, elapsedMs: 0, runningSince: now, finalMs: null,
  };
}

export const elapsed = (r: Run, now: number) => (r.finalMs ?? r.elapsedMs + (r.runningSince == null ? 0 : Math.max(0, now - r.runningSince)));

/** The case is over: a right provisional, or a judged redemption. */
export const completed = (r: Run) => r.provisional?.correct === true || r.redemption != null;

/** Clean list entries: at least one, at most 5, no duplicates. */
export function cleanList(ids: readonly string[]) {
  return [...new Set(ids.filter(Boolean))].slice(0, CF.ddMax);
}

/**
 * The gating rules in one place (RULES_SPEC 3 plus the CF1 filter stage):
 *  - personal, incident and background are open from the start;
 *  - the first list needs all three opened; then "Request examination";
 *  - after at least one exam page, the filter stage (edit the list, scored once); then "Request investigations";
 *  - the provisional needs every investigation opened;
 *  - treatment opens after the provisional; a wrong provisional gets one redemption once treatment is read;
 *  - discharge opens when the case is complete and treatment was read, unless sealed (multiplayer, CF8).
 */
export function status(def: CaseDef, r: Run, sealed = false) {
  const opened = new Set(r.opened);
  const historyDone = opened.has('personal') && opened.has('incident') && opened.has('background');
  const invs = def.investigations.map((_, i) => invFile(i));
  const allInv = invs.every((f) => opened.has(f));
  const unlocked: Record<string, boolean> = {
    personal: true, incident: true, background: true,
    exam: r.examRequested,
    treatment: r.treatmentReleased,
    discharge: !sealed && opened.has('treatment') && completed(r),
  };
  for (const f of invs) unlocked[f] = r.invRequested;
  return {
    unlocked,
    canDd: historyDone && r.dd == null,
    showRequestExam: r.dd != null && !r.examRequested,
    canFilter: r.examRequested && r.examPages.length >= 1 && r.filtered == null,
    showRequestInv: r.filtered != null && !r.invRequested,
    canProvisional: r.invRequested && allInv && r.provisional == null,
    canRedemption: r.provisional?.correct === false && opened.has('treatment') && r.redemption == null,
    completed: completed(r),
  };
}

const stop = (r: Run, now: number): Run => {
  const ms = elapsed(r, now);
  return { ...r, finalMs: ms, elapsedMs: ms, runningSince: null };
};

export function stepRun(def: CaseDef, r: Run, e: RunEvent, sealed = false): Run {
  if (r.phase === 'done' && e.type !== 'PAUSE' && e.type !== 'RESUME') return r;
  if (r.phase === 'paused' && e.type !== 'RESUME') return r;
  const st = status(def, r, sealed);
  switch (e.type) {
    case 'OPEN':
      if (!st.unlocked[e.file] || r.opened.includes(e.file)) return r;
      return { ...r, opened: [...r.opened, e.file] };
    case 'VIEW_EXAM':
      if (!r.examRequested || e.page < 0 || e.page >= def.exam.length || r.examPages.includes(e.page)) return r;
      return { ...r, examPages: [...r.examPages, e.page], opened: r.opened.includes('exam') ? r.opened : [...r.opened, 'exam'] };
    case 'SUBMIT_DD': {
      const ids = cleanList(e.ids);
      return st.canDd && ids.length ? { ...r, dd: ids } : r;
    }
    case 'REQUEST_EXAM':
      return st.showRequestExam ? { ...r, examRequested: true } : r;
    case 'SUBMIT_FILTER': {
      const ids = cleanList(e.ids);
      return st.canFilter && ids.length ? { ...r, filtered: ids } : r;
    }
    case 'REQUEST_INV':
      return st.showRequestInv ? { ...r, invRequested: true } : r;
    case 'SUBMIT_PROVISIONAL': {
      if (!st.canProvisional || !e.id) return r;
      const correct = e.id === def.final;
      const next = { ...r, provisional: { id: e.id, correct } };
      return correct ? stop(next, e.now) : next;
    }
    case 'RELEASE_TREATMENT':
      return r.provisional && !r.treatmentReleased ? { ...r, treatmentReleased: true } : r;
    case 'SUBMIT_REDEMPTION':
      if (!st.canRedemption || !e.id) return r;
      return stop({ ...r, redemption: { id: e.id, correct: e.id === def.final } }, e.now);
    case 'CLOSE':
      // Leaves the board once the case is complete and treatment was read; the discharge may be sealed.
      return completed(r) && r.opened.includes('treatment') ? { ...r, phase: 'done', runningSince: null } : r;
    case 'PAUSE':
      if (r.phase !== 'board') return r;
      return { ...r, phase: 'paused', elapsedMs: r.finalMs ?? elapsed(r, e.now), runningSince: null };
    case 'RESUME':
      if (r.phase !== 'paused') return r;
      return { ...r, phase: 'board', runningSince: r.finalMs == null ? e.now : null };
  }
}

/** Saved for resume: a running clock is saved paused (rule 10). */
export const snapshot = (def: CaseDef, r: Run, now: number) => (r.phase === 'board' ? stepRun(def, r, { type: 'PAUSE', now }) : r);

/**
 * DD: +10 per narrowed-list slot hit, -2 per entry that hits no slot, floored at 0 (CF7). A slot counts once, so a
 * second name for the same slot (or a duplicate) earns nothing and costs nothing.
 */
export function scoreDd(slots: readonly (readonly string[])[], entries: readonly string[]) {
  const unique = [...new Set(entries)];
  const hit = new Set<number>();
  let wrong = 0;
  for (const x of unique) {
    const i = slots.findIndex((names) => names.includes(x));
    if (i < 0) wrong++;
    else hit.add(i);
  }
  const right = hit.size;
  return { right, wrong, points: Math.max(0, right * CF.points.ddRight - wrong * CF.points.ddWrong) };
}

/** Up to +10, falling steadily to 0 over 5 minutes, only when solved. */
export const timeBonus = (ms: number) => Math.round(CF.points.timeMax * Math.max(0, 1 - Math.max(0, ms) / CF.timeWindowMs));

export type Score = { dd: number; ddRight: number; ddWrong: number; provisional: number; redemption: number; time: number; total: number; solved: boolean; stamp: 'SOLVED' | 'CLOSED' };

export function scoreRun(def: CaseDef, r: Run): Score {
  const dd = scoreDd(def.dd2, (r.filtered ?? []).filter((x) => x !== def.final && x !== def.parent)); // CF7: the final is not part of the DD
  const provisional = r.provisional?.correct ? CF.points.provisional : 0;
  const redemption = r.redemption?.correct ? CF.points.redemption : 0;
  const solved = !!r.provisional?.correct || !!r.redemption?.correct;
  const time = solved ? timeBonus(r.finalMs ?? r.elapsedMs) : 0;
  return { dd: dd.points, ddRight: dd.right, ddWrong: dd.wrong, provisional, redemption, time, total: dd.points + provisional + redemption + time, solved, stamp: solved ? 'SOLVED' : 'CLOSED' };
}

/** The stage the player has reached, for the offline recap and later the online alerts (CF9, CF10). */
export function stageOf(r: Run): 'History' | 'Examination' | 'Investigations' | 'Treatment' | 'Finished' {
  if (completed(r)) return 'Finished';
  if (r.provisional) return 'Treatment';
  if (r.invRequested) return 'Investigations';
  if (r.examRequested) return 'Examination';
  return 'History';
}
