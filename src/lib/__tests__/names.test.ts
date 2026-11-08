import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nameIsClean } from '../names';

test('blocks bad words anywhere, with look-alike digits and underscores', () => {
  for (const n of ['fuckboy', 'Sh1t_head', 'b_i_t_c_h', 'xxPORNxx', 'h1tler99']) assert.equal(nameIsClean(n), false, n);
});

test('short words only count as their own part of the name', () => {
  for (const n of ['ass', 'big_ass', 'SEXY_doc', 'dick_7']) assert.equal(nameIsClean(n), false, n);
  for (const n of ['Assem', 'class_of_25', 'Dickens', 'Cocktail', 'Titan', 'Nazir', 'Sussex', 'grape', 'yazan']) assert.equal(nameIsClean(n), true, n);
});
