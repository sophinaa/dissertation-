import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_PREFERENCES, normalisePreferences } from '../lib/preferences.ts';
import { ENOUGH_CANDIDATES, answer, applyFinderAnswers, finderState, profileChanges } from '../lib/finder.ts';

const saved = normalisePreferences({
  ...EMPTY_PREFERENCES,
  area: 'hair',
  budget: { maxPence: 2000, strict: true },
});

test('the finder reuses saved answers instead of asking again', () => {
  const s = finderState(saved, {}, false);
  assert.notEqual(s.question?.field, 'area');
  assert.notEqual(s.question?.field, 'budget');
  assert.ok(s.reused.some((r) => r.field === 'area'));
  assert.ok(s.reused.some((r) => r.field === 'budget'));
  for (const c of s.candidates) {
    assert.ok(c.product.areas.includes('hair'));
    assert.ok(c.product.pricePence <= 2000);
  }
});

test('ignoring saved preferences starts from the whole range', () => {
  const s = finderState(saved, {}, true);
  assert.equal(s.reused.length, 0);
  assert.equal(s.candidates.length, finderState(null, {}, false).candidates.length);
  assert.ok(s.candidates.some((c) => c.product.areas.includes('skin')));
});

test('every offered option narrows to at least one product', () => {
  let answers = {};
  for (let i = 0; i < 6; i++) {
    const s = finderState(null, answers, false);
    if (!s.question) break;
    for (const o of s.question.options) assert.ok(o.count > 0);
    assert.ok(s.question.options.some((o) => o.count < s.candidates.length));
    answers = answer(answers, s.question.field, s.question.options[0].value);
  }
});

test('choosing an option leaves exactly the number of products it advertised', () => {
  let answers = {};
  for (let i = 0; i < 6; i++) {
    const s = finderState(null, answers, false);
    if (!s.question) break;
    const option = s.question.options[s.question.options.length - 1];
    answers = answer(answers, s.question.field, option.value);
    const after = finderState(null, answers, false).candidates.length;
    if (s.question.field !== 'fragrance' || option.value === 'unscented-only')
      assert.equal(after, option.count, `${s.question.field}=${option.value}`);
  }
});

test('the finder ends with a short, actionable list', () => {
  let answers = {};
  let s = finderState(null, answers, false);
  while (!s.done) {
    answers = answer(answers, s.question!.field, s.question!.options[0].value);
    s = finderState(null, answers, false);
  }
  assert.ok(s.candidates.length > 0);
  assert.ok(s.candidates.length <= ENOUGH_CANDIDATES || s.question === null);
});

test('finder answers are temporary until explicitly saved', () => {
  const before = structuredClone(saved);
  const answers = answer(answer({}, 'hairType', 'thick'), 'goal', 'pre-wash');
  finderState(saved, answers, false);
  assert.deepEqual(saved, before, 'saved profile must not be mutated');
  const changes = profileChanges(saved, answers);
  assert.deepEqual(changes.map((c) => c.field).sort(), ['goals', 'hairType']);
  const merged = applyFinderAnswers(saved, answers);
  assert.equal(merged.hairType, 'thick');
  assert.deepEqual(merged.goals, ['pre-wash']);
  assert.equal(merged.budget.maxPence, 2000, 'unrelated saved answers are kept');
});

test('skipping a question is recorded and not asked again', () => {
  const first = finderState(null, {}, false).question!;
  const skipped = answer({}, first.field, null);
  assert.notEqual(finderState(null, skipped, false).question?.field, first.field);
});
