/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fieldsValue, groupsOf, inFields, tickedFields, toggleAll, toggleField, type FieldMenu } from '../fields';

const items = [{ f: 'a', g: 'X' }, { f: 'a', g: 'X' }, { f: 'b', g: 'X' }, { f: 'c', g: 'Y' }];
const menu: FieldMenu = {
  groups: groupsOf(items, (x) => x.f, (x) => x.g, (f) => f.toUpperCase(), ['Y', 'X']),
  total: (t) => inFields(items, (x) => x.f, t).length,
  min: 2,
  unit: 'questions',
};

test('fields: groups keep the given order, largest field first, with counts', () => {
  assert.deepEqual(menu.groups.map((g) => g.title), ['Y', 'X']);
  assert.deepEqual(menu.groups[1].items, [{ key: 'a', label: 'A', count: 2 }, { key: 'b', label: 'B', count: 1 }]);
});

test('fields: All on, untick one (All goes with it), untick All, tick back to all', () => {
  assert.equal(tickedFields({}), null);
  let t = toggleField(menu, null, 'b');
  assert.deepEqual(t, ['c', 'a']);
  assert.equal(fieldsValue(menu, t), 'c|a', 'menu order, joined');
  assert.deepEqual(tickedFields({ fields: fieldsValue(menu, t) })?.sort(), ['a', 'c']);
  assert.equal(menu.total(t), 3);
  t = toggleAll(menu, t); // not all on: All ticks everything
  assert.equal(fieldsValue(menu, t), undefined);
  t = toggleAll(menu, null); // all on: All takes every tick away
  assert.deepEqual(t, []);
  assert.deepEqual(tickedFields({ fields: fieldsValue(menu, t) }), []);
  assert.equal(menu.total(t), 0);
  assert.ok(menu.total(['b']) < menu.min, 'one small field is too few');
});

test('fields: a case in two fields counts once', () => {
  const cases = [{ fs: ['a', 'b'] }, { fs: ['b'] }, { fs: ['c'] }];
  assert.equal(inFields(cases, (x) => x.fs, ['a', 'b']).length, 2);
});
