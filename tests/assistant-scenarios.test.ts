// Customer scenarios for the offline catalogue helper: everyday ways people
// describe what they need from a wellbeing product, and what a correct answer
// must do. Each check is against catalogue fields, so the scenarios stay valid
// if products change. These are synthetic test cases, not real customer data.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, ingredientsWithTag, type Product } from '../lib/catalogue.ts';
import { offlineAnswer } from '../lib/assistant/offline.ts';
import { UNKNOWN } from '../lib/assistant/shared.ts';

const ask = (content: string) => offlineAnswer({ messages: [{ role: 'user', content }], context: {} });
const product = (id: string) => PRODUCTS.find((p) => p.id === id)!;

type Expect =
  | { every: (p: Product) => boolean } // products shown, all satisfying this
  | { says: RegExp; noProducts?: true }; // an honest answer or boundary

const GENERIC = /I can help with this shop’s products/;

const SCENARIOS: [group: string, question: string, expect: Expect][] = [
  // Skin
  ['dry skin', 'My skin feels tight and dry after washing', { every: (p) => p.goals.includes('dry-skin-comfort') }],
  ['dry skin on the body', 'I have dry patches on my elbows and legs', { every: (p) => p.goals.includes('dry-skin-comfort') && p.category !== 'face-oil' }],
  ['oily skin', 'My face gets shiny and greasy by lunchtime', { every: (p) => !!p.skinTypes?.includes('oily') && p.category !== 'body-care' }],
  ['light texture', 'I want something light that won’t feel heavy on my face', { every: (p) => p.texture === 'light' }],
  ['body care', 'What can I use on my body after the shower?', { every: (p) => p.areas.includes('skin') && p.category !== 'face-oil' }],
  // Hair
  ['dry hair', 'I want something that will help me with my dry hair', { every: (p) => p.goals.includes('dry-ends') }],
  ['frizz', 'My hair is frizzy and the ends are split', { every: (p) => p.goals.includes('dry-ends') }],
  ['dull hair', 'My hair looks dull, I want it shinier', { every: (p) => p.goals.includes('softness-shine') }],
  ['fine hair', 'I have fine hair that goes flat', { every: (p) => !!p.hairTypes?.includes('fine') }],
  ['scalp massage', 'I want a scalp massage oil', { every: (p) => p.goals.includes('scalp-massage') }],
  ['pre-wash', 'Something to put on my hair before I wash it', { every: (p) => p.goals.includes('pre-wash') }],
  // Self-care, matched to the catalogue's massage goal without claiming effects
  ['relaxing', 'I want to relax before bed', { every: (p) => p.goals.includes('massage') }],
  ['self-care', 'I need something for a self-care evening', { every: (p) => p.goals.includes('massage') }],
  ['massage', 'Looking for a massage oil for my partner', { every: (p) => p.goals.includes('massage') }],
  // Occasions and practicalities
  ['gift', 'I need a gift for my mum', { every: (p) => p.category === 'set' }],
  ['travel', 'Something for travelling, small size', { every: (p) => p.size.value <= 30 }],
  ['budget', 'I’m on a budget, what’s good under £10?', { every: (p) => p.pricePence <= 1000 }],
  ['one product', 'I want one product for both skin and hair', { every: (p) => p.areas.length === 2 }],
  ['simple routine', 'I want a simple routine', { every: (p) => p.routineFit === 'simple' }],
  // Scent
  ['no scent', 'I don’t like strong smells', { every: (p) => p.fragrance === 'unscented' }],
  ['scented', 'I want something that smells nice', { every: (p) => p.fragrance === 'essential-oils' }],
  // Ingredients to avoid: unconfirmed ingredient lists are never treated as safe
  ['nut allergy', 'I’m allergic to nuts', { every: (p) => !!p.ingredients && !ingredientsWithTag(p, 'nut')?.length }],
  ['coconut', 'I can’t have coconut', { every: (p) => !!p.ingredients && !ingredientsWithTag(p, 'coconut')?.length }],
  ['no essential oils', 'Hair oils without essential oils', { every: (p) => !!p.ingredients && !ingredientsWithTag(p, 'essential-oil')?.length }],
  // Choosing between products
  ['argan or jojoba', 'Is argan or jojoba better for my hair?', { every: (p) => ['pure-argan-oil', 'golden-jojoba-oil'].includes(p.id) }],
  // Boundaries: medical, unsupported claims, missing data
  ['hair loss', 'I want help picking a product that will help me lose less hair', { says: /can’t say whether any product will reduce hair loss/, noProducts: true }],
  ['pregnancy', 'I’m pregnant, what can I use?', { says: /can’t give medical advice/, noProducts: true }],
  ['eczema', 'I have eczema on my hands', { says: /can’t give medical advice/, noProducts: true }],
  ['itchy scalp', 'My scalp is really itchy', { says: /can’t give medical advice/, noProducts: true }],
  ['sensitive skin', 'I have sensitive skin', { says: /doesn’t record which products suit or help with sensitive/, noProducts: true }],
  ['wrinkles', 'I want to get rid of wrinkles', { says: /doesn’t record which products suit or help with wrinkles/, noProducts: true }],
  ['curly hair', 'Something for my curly hair', { says: /doesn’t record which products suit or help with curly hair/, noProducts: true }],
  ['natural', 'What’s the most natural product?', { says: new RegExp(UNKNOWN), noProducts: true }],
  ['beard', 'Do you have anything for my beard?', { says: new RegExp(UNKNOWN), noProducts: true }],
  ['vegan', 'Is the Pure Argan Oil vegan?', { says: new RegExp(UNKNOWN) }],
  ['how long it lasts', 'How long does a bottle last?', { says: new RegExp(UNKNOWN), noProducts: true }],
  ['delivery', 'Do you deliver to Ireland?', { says: new RegExp(UNKNOWN), noProducts: true }],
  // Getting started
  ['beginner', 'I’ve never used oils before', { says: /skin, your hair, or both/, noProducts: true }],
  ['gender', 'What do you recommend for men?', { says: /Nothing here is made for a particular gender/, noProducts: true }],
];

for (const [group, question, expect] of SCENARIOS) {
  test(`scenario: ${group} — “${question}”`, () => {
    const reply = ask(question);
    assert.doesNotMatch(reply.answer, GENERIC, 'fell through to the generic reply');
    assert.ok(reply.followUps.length > 0, 'offers a next step');
    if ('every' in expect) {
      assert.ok(reply.productIds.length > 0, 'shows at least one product');
      for (const id of reply.productIds) assert.ok(expect.every(product(id)), `${id} doesn’t fit the request`);
    } else {
      assert.match(reply.answer, expect.says);
      if (expect.noProducts) assert.deepEqual(reply.productIds, []);
    }
  });
}
