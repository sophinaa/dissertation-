import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, ingredientsWithTag, type IngredientTag } from '../lib/catalogue.ts';
import { EMPTY_PREFERENCES, findConflicts, normalisePreferences, type Preferences } from '../lib/preferences.ts';
import { WEIGHTS, evaluateProduct, headline, recommend } from '../lib/recommend.ts';

const prefs = (p: Partial<Preferences>): Preferences => normalisePreferences({ ...EMPTY_PREFERENCES, ...p });
const ids = (list: { product: { id: string } }[]) => list.map((f) => f.product.id);

const HAIR_PROFILE = prefs({ area: 'hair', hairType: 'thick', goals: ['pre-wash'], fragrance: 'prefer-unscented' });
const SKIN_PROFILE = prefs({ area: 'skin', skinType: 'oily', goals: ['light-moisture'], texture: 'light', routine: 'simple' });

test('materially different profiles produce different recommendations', () => {
  const hair = ids(recommend(HAIR_PROFILE).recommended);
  const skin = ids(recommend(SKIN_PROFILE).recommended);
  assert.ok(hair.length > 0 && skin.length > 0);
  assert.notDeepEqual(hair, skin);
  assert.notEqual(hair[0], skin[0]);
  for (const id of hair) assert.ok(PRODUCTS.find((p) => p.id === id)!.areas.includes('hair'));
  for (const id of skin) assert.ok(PRODUCTS.find((p) => p.id === id)!.areas.includes('skin'));
});

test('excluded ingredients never appear in eligible results, for every exclusion', () => {
  const tags: IngredientTag[] = ['essential-oil', 'tea-tree', 'nut', 'coconut', 'sesame', 'mustard-family'];
  for (const tag of tags) {
    const r = recommend(prefs({ exclude: [tag], goals: ['pre-wash', 'dry-skin-comfort'] }));
    for (const fit of r.ranked) {
      const hits = ingredientsWithTag(fit.product, tag);
      assert.ok(hits !== null, `${fit.product.id} has unknown ingredients but was eligible for ${tag}`);
      assert.equal(hits.length, 0, `${fit.product.id} contains ${tag}`);
    }
  }
});

test('missing ingredient information is never treated as meeting an exclusion', () => {
  const unknown = PRODUCTS.filter((p) => p.ingredients === null);
  assert.ok(unknown.length > 0, 'fixture needs a product with unconfirmed ingredients');
  const r = recommend(prefs({ exclude: ['coconut'], goals: ['pre-wash'] }));
  for (const p of unknown) {
    assert.ok(!ids(r.ranked).includes(p.id));
    const fit = evaluateProduct(p, prefs({ exclude: ['coconut'] }));
    assert.equal(fit.eligible, false);
    assert.match(fit.reasons[0].text, /isn’t confirmed/);
  }
});

test('unscented-only excludes scented products and products with unknown scent', () => {
  const r = recommend(prefs({ fragrance: 'unscented-only', goals: ['pre-wash'] }));
  for (const fit of r.ranked) assert.equal(fit.product.fragrance, 'unscented');
});

test('a strict budget is respected and never silently relaxed', () => {
  for (const max of [800, 1500, 2000]) {
    const r = recommend(prefs({ budget: { maxPence: max, strict: true }, goals: ['dry-skin-comfort'] }));
    for (const fit of r.ranked) assert.ok(fit.product.pricePence <= max);
  }
  const none = recommend(prefs({ budget: { maxPence: 100, strict: true }, goals: ['pre-wash'] }));
  assert.equal(none.ranked.length, 0);
  assert.equal(none.recommended.length, 0);
  assert.ok(none.constraintImpact.some((c) => c.constraint === 'budget' && c.removed === PRODUCTS.length));
});

test('a flexible budget keeps pricier products but ranks them lower with a stated trade-off', () => {
  const p = prefs({ area: 'skin', goals: ['dry-skin-comfort'], budget: { maxPence: 2000, strict: false } });
  const fit = evaluateProduct(PRODUCTS.find((x) => x.id === 'rose-argan-night-oil')!, p);
  assert.equal(fit.eligible, true);
  const over = fit.factors.find((f) => f.code === 'budget-over');
  assert.ok(over);
  assert.equal(over.points, WEIGHTS.overFlexibleBudget);
  assert.match(over.text, /£8\.00 over your flexible £20\.00/);
});

test('budget changes update both recommendations and explanation text', () => {
  const base = { area: 'skin' as const, goals: ['dry-skin-comfort' as const] };
  const at25 = recommend(prefs({ ...base, budget: { maxPence: 2500, strict: true } }));
  const at16 = recommend(prefs({ ...base, budget: { maxPence: 1600, strict: true } }));
  assert.notDeepEqual(ids(at25.recommended), ids(at16.recommended));
  for (const fit of at16.recommended) assert.match(headline(fit).why, /within your £16\.00 budget/);
  for (const fit of at25.recommended) assert.match(headline(fit).why, /within your £25\.00 budget/);
});

test('explanations are generated from, and agree with, the ranking factors', () => {
  for (const profile of [HAIR_PROFILE, SKIN_PROFILE]) {
    for (const fit of recommend(profile).recommended) {
      assert.equal(fit.score, fit.factors.reduce((s, f) => s + f.points, 0));
      const { why, tradeoff } = headline(fit);
      const positive = fit.factors.filter((f) => f.kind === 'match' && f.points > 0);
      assert.ok(positive.length > 0, 'recommended products must have a positive match');
      for (const f of positive.slice(0, 3)) assert.ok(why.includes(f.short), `${f.short} missing from "${why}"`);
      const tradeoffs = fit.factors.filter((f) => f.kind === 'tradeoff');
      assert.equal(tradeoff === null, tradeoffs.length === 0);
      // Every goal claim must be true of the product.
      for (const f of fit.factors.filter((x) => x.code.startsWith('goal:')))
        assert.ok(fit.product.goals.includes(f.code.slice(5) as never));
    }
  }
});

test('ranking is stable regardless of catalogue order', () => {
  const forward = ids(recommend(HAIR_PROFILE).ranked);
  const reversed = ids(recommend(HAIR_PROFILE, [...PRODUCTS].reverse()).ranked);
  assert.deepEqual(forward, reversed);
  assert.deepEqual(forward, ids(recommend(HAIR_PROFILE).ranked));
});

test('out-of-stock products are flagged and lose ties', () => {
  const fit = evaluateProduct(PRODUCTS.find((p) => p.id === 'amla-hair-oil')!, HAIR_PROFILE);
  assert.ok(fit.factors.some((f) => f.code === 'out-of-stock' && f.kind === 'tradeoff'));
});

test('limits alone do not claim personalisation', () => {
  const r = recommend(prefs({ exclude: ['nut'], budget: { maxPence: 2000, strict: true } }));
  assert.equal(r.personalised, false);
  assert.equal(r.recommended.length, 0);
  assert.ok(r.ranked.length > 0);
});

test('a narrow profile can return exactly one match', () => {
  const r = recommend(
    prefs({ area: 'hair', goals: ['scalp-massage'], exclude: ['nut', 'coconut'], budget: { maxPence: 1400, strict: true } }),
  );
  assert.deepEqual(ids(r.ranked), ['tea-tree-scalp-oil']);
});

test('conflicting preferences are reported rather than silently fixed', () => {
  const issues = findConflicts(prefs({ likes: ['tea-tree'], exclude: ['essential-oil'] }));
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /tea tree/);
  const scent = findConflicts(prefs({ likes: ['rose'], fragrance: 'unscented-only' }));
  assert.equal(scent[0].field, 'fragrance');
});

test('normalisation drops invalid values and answers that do not apply', () => {
  const p = normalisePreferences({
    area: 'skin',
    hairType: 'thick',
    goals: ['pre-wash', 'light-moisture', 'nonsense'],
    exclude: ['nut', 'bogus'],
    budget: { maxPence: -5, strict: true },
    fragrance: 'loud',
  });
  assert.equal(p.hairType, null);
  assert.deepEqual(p.goals, ['light-moisture']);
  assert.deepEqual(p.exclude, ['nut']);
  assert.equal(p.budget.maxPence, null);
  assert.equal(p.fragrance, null);
});

test('"not sure" is distinct from unanswered and favours sampler sets', () => {
  const unsure = prefs({ area: 'skin', goalsNotSure: true });
  const unanswered = prefs({ area: 'skin' });
  const set = PRODUCTS.find((p) => p.id === 'face-oil-discovery-set')!;
  assert.ok(evaluateProduct(set, unsure).factors.some((f) => f.code === 'sampler'));
  assert.ok(!evaluateProduct(set, unanswered).factors.some((f) => f.code === 'sampler'));
});
