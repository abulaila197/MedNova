import { fullName, indexNames, type Named } from '../shell/names';
import type { CaseDef } from './core';
import casesJson from './data/cases.json';
import diagnosesJson from './data/diagnoses.json';

/** The 100 cases, cleaned at import (IM1, CF2) with plain diagnosis names (build/case-files/build.py). */
export const CASES = casesJson as CaseDef[];
export const caseById = new Map(CASES.map((c) => [c.id, c]));

/** Case Files' own diagnosis master list (CF4): case names plus look-alikes, NL1 names, dossier links. */
export type Diagnosis = Named & { id: string; dossier?: string };
export const DIAGNOSES = diagnosesJson as Diagnosis[];
export const DIAG_INDEX = indexNames(DIAGNOSES);
const byLabel = new Map(DIAGNOSES.map((d) => [d.label, d]));
/** "Main name (other 1, other 2)". */
export const diagName = (label: string) => {
  const d = byLabel.get(label);
  return d ? fullName(d) : label;
};
export const dossierOf = (label: string) => byLabel.get(label)?.dossier ?? null;

/** Cases this phone has finished in Solo, with the stamp they got: replays pay no EXP (CF6). */
export const PLAYED_KEY = 'casefiles:played';
export type Played = Record<string, 'SOLVED' | 'CLOSED'>;
