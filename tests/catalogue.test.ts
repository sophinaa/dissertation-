import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOAL_AREA, INGREDIENTS, PRODUCTS, pricePer100 } from '../lib/catalogue.ts';
import { priceBasket } from '../lib/basket.ts';
import { filterProducts, filtersToParams, parseFilters, sortProducts, EMPTY_FILTERS } from '../lib/search.ts';
import { exportSession, featuresFor, newSession, sanitiseParticipantCode, tasksFor } from '../lib/study.ts';

test('catalogue records are internally consistent', () => {
  const ids = new Set<string>();
  for (const p of PRODUCTS) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.match(p.id, /^[a-z0-9-]+$/);
    assert.ok(Number.isInteger(p.pricePence) && p.pricePence > 0);
    assert.ok(p.size.value > 0);
    assert.equal(p.dataStatus, 'demonstration');
    for (const i of p.ingredients ?? []) assert.ok(i in INGREDIENTS, `${p.id}: unknown ingredient ${i}`);
    for (const g of p.goals) assert.ok(p.areas.includes(GOAL_AREA[g]), `${p.id}: goal ${g} outside its areas`);
    if (p.category === 'set') assert.ok(p.setContents?.length);
    if (p.fragrance === 'unscented' && p.ingredients)
      assert.ok(!p.ingredients.some((i) => (INGREDIENTS[i].tags as string[]).includes('essential-oil')), `${p.id} is unscented but has essential oils`);
    if (p.fragrance === 'essential-oils' && p.ingredients)
      assert.ok(p.ingredients.some((i) => (INGREDIENTS[i].tags as string[]).includes('essential-oil')), `${p.id} scent claim lacks an essential oil`);
  }
});

test('basket totals and quantities are calculated from catalogue prices', () => {
  const b = priceBasket([
    { id: 'pure-argan-oil', qty: 2 },
    { id: 'tea-tree-scalp-oil', qty: 1 },
    { id: 'not-a-product', qty: 3 },
    { id: 'rosehip-facial-oil', qty: 0 },
  ]);
  assert.equal(b.lines.length, 2);
  assert.equal(b.itemCount, 3);
  assert.equal(b.subtotalPence, 1800 * 2 + 1400);
  assert.deepEqual(priceBasket([]), { lines: [], itemCount: 0, subtotalPence: 0 });
});

test('search and filters use real product data', () => {
  const argan = filterProducts(PRODUCTS, { ...EMPTY_FILTERS, q: 'argan' }).products;
  assert.ok(argan.length >= 3);
  assert.ok(argan.every((p) => /argan/i.test(p.name + p.description + (p.ingredients ?? []).join())));
  const none = filterProducts(PRODUCTS, { ...EMPTY_FILTERS, q: 'zzzz' });
  assert.equal(none.products.length, 0);
  const noNuts = filterProducts(PRODUCTS, { ...EMPTY_FILTERS, without: ['nut'] });
  assert.ok(noNuts.hiddenUnknownIngredients > 0);
  assert.ok(noNuts.products.every((p) => p.ingredients && !p.ingredients.some((i) => (INGREDIENTS[i].tags as string[]).includes('nut'))));
  const cheap = filterProducts(PRODUCTS, { ...EMPTY_FILTERS, maxPence: 1500, area: 'hair' }).products;
  assert.ok(cheap.every((p) => p.pricePence <= 1500 && p.areas.includes('hair')));
});

test('sorting and URL round-trips are predictable', () => {
  const asc = sortProducts(PRODUCTS, 'price-asc');
  for (let i = 1; i < asc.length; i++) assert.ok(asc[i - 1].pricePence <= asc[i].pricePence);
  const per100 = sortProducts(PRODUCTS, 'per100').filter((p) => p.size.unit === 'ml');
  for (let i = 1; i < per100.length; i++) assert.ok(pricePer100(per100[i - 1]) <= pricePer100(per100[i]));
  const f = { ...EMPTY_FILTERS, q: 'oil', area: 'skin' as const, without: ['nut' as const], sort: 'name' as const };
  assert.deepEqual(parseFilters(filtersToParams(f)), f);
  assert.equal(parseFilters(new URLSearchParams('max=999&area=feet')).maxPence, null);
});

test('study conditions share the catalogue and isolate assisted features', () => {
  assert.deepEqual(featuresFor('conventional'), { personalisation: false, finder: false, assistant: false });
  assert.deepEqual(featuresFor('assisted'), { personalisation: true, finder: true, assistant: true });
  assert.deepEqual(featuresFor(null), featuresFor('assisted'));
  assert.equal(sanitiseParticipantCode(' p07 '), 'P07');
  assert.equal(sanitiseParticipantCode('jane@example.com'), null);
  assert.ok(tasksFor('conventional').every((t) => t.id !== 'explain'));
  const s = newSession('conventional', 'P01', true, 0);
  const exported = exportSession(s);
  assert.equal(exported.condition, 'conventional');
  assert.deepEqual(exported.events.map((e) => e.type), ['session_start', 'task_start']);
  assert.equal(newSession('assisted', null, false).events.length, 0);
});
