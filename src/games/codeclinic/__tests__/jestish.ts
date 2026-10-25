import assert from 'node:assert/strict';
import { describe as nodeDescribe, it as nodeIt, beforeEach as nodeBeforeEach } from 'node:test';

// Yazan's Code Clinic tests were written for Jest; this maps the matchers they use onto node:test,
// which is what scripts/test-engine.sh runs.

export const describe = (name: string, fn: () => void) => nodeDescribe(name, fn);
export const it = (name: string, fn: () => void | Promise<void>) => nodeIt(name, fn);
export const test = it;
export const beforeEach = (fn: () => void) => nodeBeforeEach(fn);

function matches(actual: unknown, expected: unknown): boolean {
  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    if (actual === null || typeof actual !== 'object') return false;
    return Object.entries(expected as Record<string, unknown>).every(([k, v]) => matches((actual as Record<string, unknown>)[k], v));
  }
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((v, i) => matches(actual[i], v));
  }
  return Object.is(actual, expected);
}

function matchers(actual: any, negate: boolean) {
  const check = (pass: boolean, msg: string) => {
    if (pass === negate) assert.fail(`${negate ? 'not ' : ''}${msg}: got ${safe(actual)}`);
  };
  return {
    toBe: (e: unknown) => check(Object.is(actual, e), `toBe ${safe(e)}`),
    toEqual: (e: unknown) => {
      let pass = true;
      try {
        assert.deepStrictEqual(strip(actual), strip(e));
      } catch {
        pass = false;
      }
      check(pass, `toEqual ${safe(e)}`);
    },
    toMatchObject: (e: unknown) => check(matches(actual, e), `toMatchObject ${safe(e)}`),
    toBeNull: () => check(actual === null, 'toBeNull'),
    toBeUndefined: () => check(actual === undefined, 'toBeUndefined'),
    toBeTruthy: () => check(!!actual, 'toBeTruthy'),
    toContain: (e: unknown) => check(typeof actual === 'string' ? actual.includes(e as string) : Array.from(actual ?? []).some((x) => Object.is(x, e)), `toContain ${safe(e)}`),
    toHaveLength: (n: number) => check(actual?.length === n, `toHaveLength ${n}`),
    toBeGreaterThan: (n: number) => check(actual > n, `toBeGreaterThan ${n}`),
    toBeGreaterThanOrEqual: (n: number) => check(actual >= n, `toBeGreaterThanOrEqual ${n}`),
    toBeLessThan: (n: number) => check(actual < n, `toBeLessThan ${n}`),
    toMatch: (re: RegExp | string) => check(typeof re === 'string' ? String(actual).includes(re) : re.test(String(actual)), `toMatch ${String(re)}`),
    toThrow: () => {
      let threw = false;
      try {
        actual();
      } catch {
        threw = true;
      }
      check(threw, 'toThrow');
    },
  };
}

export function expect(actual: any) {
  return { ...matchers(actual, false), not: matchers(actual, true) };
}

// Jest's toEqual ignores keys whose value is undefined.
function strip(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, strip(x)]));
  return v;
}

function safe(v: unknown): string {
  try {
    return JSON.stringify(v)?.slice(0, 200) ?? String(v);
  } catch {
    return String(v);
  }
}
