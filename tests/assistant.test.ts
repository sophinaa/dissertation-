import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { INGREDIENTS, PRODUCTS } from '../lib/catalogue.ts';
import { normalisePreferences } from '../lib/preferences.ts';
import { evaluateProduct } from '../lib/recommend.ts';
import { offlineAnswer } from '../lib/assistant/offline.ts';
import {
  RequestError,
  UNKNOWN,
  buildContext,
  parseAssistantRequest,
  productRecord,
  validateModelOutput,
  type AssistantContext,
} from '../lib/assistant/shared.ts';

const ask = (content: string, context: AssistantContext = {}) =>
  offlineAnswer({ messages: [{ role: 'user', content }], context });

test('model output with unknown product IDs is filtered before rendering', () => {
  const out = validateModelOutput(
    JSON.stringify({ answer: 'Try these.', product_ids: ['pure-argan-oil', 'made-up-serum', 42], needs_clarification: false }),
  );
  assert.ok(out);
  assert.deepEqual(out.productIds, ['pure-argan-oil']);
  assert.equal(out.rejectedIds, 2);
});

test('invalid model output is rejected', () => {
  assert.equal(validateModelOutput('not json'), null);
  assert.equal(validateModelOutput(JSON.stringify({ answer: '', product_ids: [] })), null);
  assert.equal(validateModelOutput(JSON.stringify(['x'])), null);
});

test('requests are validated and untrusted context is cleaned', () => {
  assert.throws(() => parseAssistantRequest({ messages: [] }), RequestError);
  assert.throws(() => parseAssistantRequest({ messages: [{ role: 'user', content: 'x'.repeat(1500) }] }), RequestError);
  assert.throws(() => parseAssistantRequest({ messages: [{ role: 'system', content: 'hi' }] }), RequestError);
  const req = parseAssistantRequest({
    messages: [{ role: 'assistant', content: 'Hello' }, { role: 'user', content: 'Hi' }],
    context: { productId: 'nope', compareIds: ['pure-argan-oil', 'fake'], preferences: { area: 'hair', bogus: 1 } },
  });
  assert.equal(req.messages[0].role, 'user', 'leading assistant turns are dropped');
  assert.equal(req.context.productId, undefined);
  assert.deepEqual(req.context.compareIds, ['pure-argan-oil']);
  assert.equal(req.context.preferences?.area, 'hair');
});

test('catalogue records mark missing information explicitly', () => {
  const rosemary = productRecord(PRODUCTS.find((p) => p.id === 'rosemary-hair-oil')!);
  assert.match(String(rosemary.ingredients), /NOT SPECIFIED/);
  assert.match(rosemary.usage, /NOT SPECIFIED/);
  assert.match(rosemary.scent, /NOT SPECIFIED/);
});

test('the assistant agrees with product pages about ingredients', () => {
  for (const p of PRODUCTS) {
    const reply = ask('What are the ingredients?', { productId: p.id });
    if (p.ingredients) for (const i of p.ingredients) assert.ok(reply.answer.includes(INGREDIENTS[i].name), `${p.id}: ${i}`);
    else assert.ok(reply.answer.includes(UNKNOWN), `${p.id} should admit unknown ingredients`);
    assert.deepEqual(reply.productIds, [p.id]);
  }
});

test('the assistant agrees with product pages about usage', () => {
  for (const p of PRODUCTS) {
    const reply = ask('How do I use it?', { productId: p.id });
    assert.ok(reply.answer.includes(p.usage ?? UNKNOWN), p.id);
  }
});

test('ingredient questions give yes/no from the list, and admit unknowns', () => {
  assert.match(ask('Does it contain nuts?', { productId: 'pure-argan-oil' }).answer, /contains argan kernel oil/);
  assert.match(ask('Does it contain essential oils?', { productId: 'rosehip-facial-oil' }).answer, /no essential oils/);
  assert.match(ask('Does it contain coconut?', { productId: 'rosemary-hair-oil' }).answer, /can’t confirm/);
});

test('information outside the catalogue produces an honest limitation', () => {
  for (const q of ['Is it organic?', 'Where is it sourced from?', 'Are there any reviews?', 'Is it clinically proven?', 'Is it vegan?']) {
    assert.ok(ask(q, { productId: 'pure-argan-oil' }).answer.startsWith(UNKNOWN), q);
  }
});

test('medical questions get a boundary, not advice', () => {
  for (const q of ['Will this cure my dandruff?', 'Can I use it for eczema?', 'Is it safe in pregnancy?']) {
    assert.match(ask(q, { productId: 'tea-tree-scalp-oil' }).answer, /can’t give medical advice/, q);
  }
});

test('"why recommended" reflects the actual recommendation factors', () => {
  const prefs = normalisePreferences({ area: 'hair', hairType: 'thick', goals: ['pre-wash'] });
  const reply = ask('Why was this recommended?', { productId: 'rocket-seed-hair-oil', preferences: prefs });
  const fit = evaluateProduct(PRODUCTS.find((p) => p.id === 'rocket-seed-hair-oil')!, prefs);
  for (const f of fit.factors.filter((x) => x.kind === 'match')) assert.ok(reply.answer.includes(f.text), f.text);
  assert.match(ask('Why these?').answer, /nothing here has been personalised/);
});

test('alternatives respect saved exclusions', () => {
  const prefs = normalisePreferences({ exclude: ['essential-oil'] });
  const reply = ask('Is there an alternative to the Mixed Botanical Hair Oil?', { preferences: prefs });
  for (const id of reply.productIds) {
    assert.ok(evaluateProduct(PRODUCTS.find((p) => p.id === id)!, prefs).eligible, id);
  }
});

test('assistant context only includes preferences when provided', () => {
  assert.match(String(buildContext({}).preferences), /not set any preferences/);
  const ctx = buildContext({ preferences: normalisePreferences({ area: 'skin', goals: ['light-moisture'] }) });
  assert.ok(Array.isArray(ctx.preferences));
  assert.ok(ctx.recommendationFactors.length > 0);
});

test('no client-side file references the API key', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(tsx?|jsx?)$/.test(name)) files.push(path);
    }
  };
  walk('components');
  walk('app');
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (file.endsWith(join('api', 'assistant', 'route.ts'))) continue;
    assert.ok(!text.includes('ANTHROPIC_API_KEY'), `${file} mentions the API key`);
    if (text.startsWith("'use client'")) assert.ok(!text.includes('process.env'), `${file} reads process.env`);
  }
});
