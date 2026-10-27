// Offline catalogue helper: a deterministic, rule-based responder used when no
// language model is configured. It is NOT AI and the interface says so. It only
// reads the same catalogue records and recommendation factors as the rest of
// the site, which also makes it a useful reference for testing grounding.

import {
  AVAILABILITY_LABELS,
  FRAGRANCE_LABELS,
  GOAL_LABELS,
  INGREDIENTS,
  PRODUCTS,
  TAG_LABELS,
  TEXTURE_LABELS,
  formatPrice,
  formatPricePer100,
  formatSize,
  getProduct,
  ingredientsWithTag,
  scentText,
  type Area,
  type Fragrance,
  type Goal,
  type HairType,
  type IngredientId,
  type IngredientTag,
  type Product,
  type SkinType,
} from '../catalogue.ts';
import { EMPTY_PREFERENCES, type Preferences } from '../preferences.ts';
import { evaluateProduct, headline, recommend } from '../recommend.ts';
import { EMPTY_FILTERS, PRICE_STEPS, filtersToParams } from '../search.ts';
import {
  MAX_FOLLOW_UPS,
  MAX_PRODUCT_LINKS,
  UNKNOWN,
  cleanFollowUps,
  type AssistantReply,
  type AssistantRequest,
} from './shared.ts';

type Reply = Pick<AssistantReply, 'answer' | 'productIds' | 'followUps' | 'shopLink'>;
type Base = Pick<AssistantReply, 'answer' | 'productIds'>;

// "Lose less hair", "hair falling out", "thinning", "regrow": a claim no product here makes.
const HAIR_LOSS =
  /\b(hair ?loss|(lose|losing|loose|lost|loosing)( less| so much| a lot of| my| of)* hair|hair (is )?(fall\w*|thinn\w*|shed\w*|breaking off)|thinning|shedding|regrow\w*|grow (back )?(my )?hair|hair growth|alopecia|bald\w*)\b/;
const MEDICAL =
  /\b(itch\w*|flak\w*|acne|eczema|psoriasis|dermatitis|rosacea|dandruff|hair ?loss|alopecia|bald|balding|rash|infection|fungal|cure|cures|heal|heals|prescri\w*|pregnan\w*|breastfeed\w*|medication|medicine|diagnos\w*|allerg\w*|reaction|burns?|wound)\b/;
const UNSUPPORTED =
  /\b(organic|certif\w*|vegan|cruelty|halal|sourc\w*|origin|farm\w*|fair ?trade|reviews?|ratings?|testimonials?|clinical\w*|proven|evidence|stud(y|ies)|shelf ?life|expir\w*|recycl\w*|packaging|deliver\w*|shipping|returns?|refunds?|natural\w*|beards?|moustache|how long (does|will|would) .{0,30}last)\b/;
const WHY = /\bwhy\b.*\b(recommend\w*|suggest\w*|shown|show|pick\w*|match\w*|top|here|this one|it)\b|\bwhy (this|that|these)\b/;
const COMPARE = /\b(compare|comparison|difference|differ\w*|vs\.?|versus|which (one|is)|better)\b/;
const CONTAINS =
  /\b(contain\w*|ingredients?|free (from|of)|without|include\w*|is there|does it have|have any|has any)\b/;
const USAGE = /\b(how (do|should|would|can|to) (i )?(use|apply)|how to use|how often|how much|usage|directions?|apply|instructions?)\b/;
const ALTERNATIVE = /\b(alternatives?|instead|similar|other options?|something else|cheaper|swap|replace\w*)\b/;
const STOCK = /\b(in stock|stock|available|availability|sold out)\b/;
const SAFETY = /\b(safe|safety|warnings?|cautions?|side effects?|sensitive|patch test)\b/;
const RECOMMEND =
  /\b(recommend\w*|suggest\w*|what should i|where (do|should) i start|start with|best for me|for me|help me choose|which should)\b/;
const BUDGET = /(?:under|below|less than|up to|max(?:imum)?|budget(?: of)?|within)\s*£?\s*(\d+(?:\.\d{1,2})?)/;

const TERM_TAGS: [RegExp, IngredientTag][] = [
  [/essential oils?/, 'essential-oil'],
  [/tea ?tree/, 'tea-tree'],
  [/\bnuts?\b|nut-derived|tree nut/, 'nut'],
  [/coconut/, 'coconut'],
  [/sesame/, 'sesame'],
  [/mustard|brassica/, 'mustard-family'],
];

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ');
}

const ALIASES: [Product, string[]][] = PRODUCTS.map((p) => {
  const full = normalise(p.name);
  // Variants such as "Pure Argan Oil (Travel Size)" must not claim the base name.
  const aliases = full.includes('(travel size)')
    ? [full, 'travel size', 'travel']
    : [full, full.replace(/ oil$/, '')];
  if (p.category === 'set') aliases.push(full.replace(/^(face oil |pre-wash )/, ''));
  return [p, [...new Set(aliases)].filter((a) => a.split(' ').length > 1 || a.length > 6)];
});

/** Products named in the text, in order of appearance. Longest names win. */
export function mentionedProducts(text: string): Product[] {
  const t = normalise(text);
  const hits: { p: Product; at: number; len: number }[] = [];
  for (const [p, aliases] of ALIASES) {
    let best: { at: number; len: number } | null = null;
    for (const a of aliases) {
      const at = t.indexOf(a);
      if (at >= 0 && (!best || a.length > best.len)) best = { at, len: a.length };
    }
    if (best) hits.push({ p, ...best });
  }
  // Drop matches contained in a longer match (e.g. "pure argan" inside the travel size).
  const kept = hits.filter(
    (h) =>
      !hits.some(
        (o) => o !== h && o.len > h.len && o.at <= h.at && o.at + o.len >= h.at + h.len,
      ),
  );
  return kept.sort((a, b) => a.at - b.at).map((h) => h.p);
}

// "Is argan or jojoba better?" names oils, not products: map each to its single-oil product.
const OIL_WORDS: [RegExp, string][] = [
  [/\bargan\b/, 'pure-argan-oil'],
  [/\bjojoba\b/, 'golden-jojoba-oil'],
  [/\brosehip\b/, 'rosehip-facial-oil'],
  [/\brose\b(?! ?(and|&) ?argan)/, 'rose-facial-oil'],
  [/\b(rocket|taramira)\b/, 'rocket-seed-hair-oil'],
  [/\btea ?tree\b/, 'tea-tree-scalp-oil'],
  [/\brosemary\b/, 'rosemary-hair-oil'],
  [/\bamla\b/, 'amla-hair-oil'],
  [/\bshea\b/, 'shea-body-butter'],
];

function mentionedOils(text: string): Product[] {
  const t = normalise(text);
  return OIL_WORDS.filter(([re]) => re.test(t)).map(([, id]) => getProduct(id)!);
}

function mentionedIngredients(text: string): IngredientId[] {
  const t = normalise(text);
  return (Object.keys(INGREDIENTS) as IngredientId[]).filter((id) => {
    const name = normalise(INGREDIENTS[id].name);
    const short = id.replace('-', ' ');
    return (
      t.includes(name) ||
      new RegExp(`\\b${short}\\b`).test(t) ||
      (id === 'rocket' && /taramira/.test(t)) ||
      (id === 'vitamin-e' && /tocopherol/.test(t))
    );
  });
}

const list = (lines: string[]) => lines.map((l) => `• ${l}`).join('\n');
const link = (p: Product) => `${p.name} (${formatPrice(p.pricePence)}, ${formatSize(p)})`;
const ingredientsText = (p: Product) =>
  p.ingredients ? p.ingredients.map((i) => INGREDIENTS[i].name).join(', ') : null;

function ingredientAnswer(products: Product[], text: string): Base | null {
  const t = normalise(text);
  const tag = TERM_TAGS.find(([re]) => re.test(t))?.[1];
  const scentQuestion = /\b(fragrance|perfume|parfum|scent\w*)\b/.test(t);
  const ingredients = mentionedIngredients(text).filter(
    (i) => !products.some((p) => normalise(p.name).includes(normalise(INGREDIENTS[i].name))),
  );

  const describe = (p: Product): string => {
    if (scentQuestion) {
      return p.fragrance
        ? `${p.name}: ${scentText(p)}`
        : `${p.name}: ${UNKNOWN}`;
    }
    if (!p.ingredients) return `${p.name}: its full ingredient list isn’t confirmed. ${UNKNOWN}`;
    if (tag) {
      const hits = ingredientsWithTag(p, tag) ?? [];
      return hits.length
        ? `${p.name} contains ${hits.map((h) => INGREDIENTS[h].name.toLowerCase()).join(', ')} (${TAG_LABELS[tag].toLowerCase()}).`
        : `${p.name}: no ${TAG_LABELS[tag].toLowerCase()} in its listed ingredients (${ingredientsText(p)}).`;
    }
    if (ingredients.length) {
      return ingredients
        .map((i) =>
          p.ingredients!.includes(i)
            ? `${p.name} contains ${INGREDIENTS[i].name.toLowerCase()}.`
            : `${p.name}: ${INGREDIENTS[i].name.toLowerCase()} isn’t in its listed ingredients.`,
        )
        .join(' ');
    }
    return `${p.name} ingredients: ${ingredientsText(p)}.`;
  };

  if (products.length) {
    const source = scentQuestion
      ? 'This comes from the catalogue’s scent information.'
      : 'This comes from the catalogue’s ingredient list. If you have an allergy, always check the product label too.';
    return {
      answer: `${list(products.map(describe))}\n\n${source}`,
      productIds: products.map((p) => p.id),
    };
  }
  if (tag || ingredients.length) {
    const term = tag ? TAG_LABELS[tag].toLowerCase() : INGREDIENTS[ingredients[0]].name.toLowerCase();
    const has = (p: Product) =>
      tag ? (ingredientsWithTag(p, tag) ?? []).length > 0 : p.ingredients!.includes(ingredients[0]);
    const known = PRODUCTS.filter((p) => p.ingredients);
    const withIt = known.filter(has);
    const unknown = PRODUCTS.filter((p) => !p.ingredients);
    const lines = [
      `Products containing ${term}: ${withIt.length ? withIt.map((p) => p.name).join(', ') : 'none'}.`,
      `Ingredients not confirmed, so I can’t say: ${unknown.map((p) => p.name).join(', ') || 'none'}.`,
    ];
    return {
      answer: `${lines.join('\n')}\n\nAll other products list their full ingredients without ${term}.`,
      productIds: withIt.map((p) => p.id),
    };
  }
  return null;
}

function compareAnswer(products: Product[], prefs: Preferences | null): Base {
  const lines = products.map((p) => {
    const parts = [
      `${formatPrice(p.pricePence)} for ${formatSize(p)} (${formatPricePer100(p)})`,
      `texture: ${p.texture ? TEXTURE_LABELS[p.texture].toLowerCase() : 'not specified'}`,
      `scent: ${p.fragrance ? FRAGRANCE_LABELS[p.fragrance].toLowerCase() : 'not specified'}`,
      `ingredients: ${ingredientsText(p) ?? 'not confirmed'}`,
    ];
    if (prefs) {
      const fit = evaluateProduct(p, prefs);
      parts.push(fit.eligible ? headline(fit).why : `doesn’t fit your limits: ${fit.reasons[0].text}`);
    }
    return `${p.name}: ${parts.join('; ')}`;
  });
  const units = new Set(products.map((p) => p.size.unit));
  const note =
    units.size > 1
      ? 'Prices per 100 aren’t directly comparable because one is sold by weight and one by volume.'
      : 'The catalogue doesn’t say one is better overall. It depends on which of these differences matter to you.';
  return {
    answer: `${list(lines)}\n\n${note} You can see them side by side on the Compare page.`,
    productIds: products.map((p) => p.id),
  };
}

function productSummary(p: Product, prefs: Preferences | null): Base {
  const lines = [
    `${formatPrice(p.pricePence)} · ${formatSize(p)} · ${p.availability ? AVAILABILITY_LABELS[p.availability] : 'stock unknown'}`,
    p.summary,
    `Ingredients: ${ingredientsText(p) ?? 'not yet confirmed'}`,
  ];
  if (prefs) {
    const fit = evaluateProduct(p, prefs);
    lines.push(fit.eligible ? headline(fit).why : `Doesn’t fit your preferences: ${fit.reasons[0].text}`);
  }
  return { answer: `${p.name}\n${list(lines)}`, productIds: [p.id] };
}


// ---------- List questions ("hair oils under £20 with no added scent") ----------

interface ListQuery {
  area: Area | null;
  /** Face or body within skin care: body care isn't for the face, face oils aren't for the body. */
  place: 'face' | 'body' | null;
  maxPence: number | null;
  scent: Fragrance | null;
  texture: 'light' | 'medium' | 'rich' | null;
  goal: Goal | null;
  /** Products for both skin and hair (multi-use). */
  both: boolean;
  /** Gift sets. */
  gift: boolean;
  /** 30 ml or g or less, e.g. for travel or trying something. */
  small: boolean;
  simpleRoutine: boolean;
  hairType: HairType | null;
  skinType: Exclude<SkinType, 'dry'> | null;
  without: IngredientTag[];
  withTags: IngredientTag[];
  inStock: boolean;
  cheapest: boolean;
}

// Checked in order; the first match wins. Phrases are what follow-ups say.
const GOALS: [Goal, RegExp, string][] = [
  ['scalp-massage', /scalp massage|massag\w* (my |the |your )?scalp/, 'a scalp massage'],
  ['pre-wash', /pre-? ?wash|before (i |you )?(wash|washing|shampoo\w*)/, 'a pre-wash treatment'],
  [
    'dry-ends',
    /frizz\w*|dry ends|split ends|\bdry(,? \w+)? hair|hair (is|feels|gets|that is) (really |very |so )?dry|brittle|rough hair/,
    'dry ends and frizz',
  ],
  // Shine only counts for hair: a "shiny face" is oily skin, not this goal.
  ['softness-shine', /shin(e|y|ier) hair|hair\b.{0,30}\b(shin(e|y|ier)|soft(er)?)\b|soft(er)? hair|softness|dull|lifeless/, 'softer, shinier hair'],
  ['dry-skin-comfort', /dry(-feeling)? skin|skin\b(\s\w+){0,4}\s(dry|tight)\b|tight skin|dry patches|rough skin/, 'dry skin'],
  ['light-moisture', /light moisture|not (too )?heavy|non-?greasy|not greasy/, 'light moisture'],
  ['body-softening', /soft(er)?(-feeling)? skin|body softening/, 'softer skin on the body'],
  // Matched to the catalogue's "massage or self-care routine" goal. No claim about relaxing is made.
  ['massage', /\bmassage\b|self-?care|relax\w*|unwind\w*|wind down|pamper\w*|before bed|bedtime/, 'a massage or self-care routine'],
];

const TAG_WORDS: Record<IngredientTag, string> = {
  'essential-oil': 'essential oils',
  'tea-tree': 'tea tree',
  nut: 'nuts',
  coconut: 'coconut',
  sesame: 'sesame',
  'mustard-family': 'mustard-family oils',
};

const UNSCENTED =
  /\b(unscented|no (added )?(scent|fragrance|perfume|smell)|(scent|fragrance|perfume|smell)[- ]free|without (added |any )?(scent|fragrance|perfume|smell)|(dont|do not|dont really) (like|want) (strong |any |a )?(smells?|scents?|fragrance|perfume)|no smell)\b/;
const SCENTED = /scented with essential oils|\b(?<!un)scented\b|smells? (nice|good|lovely|nice and)|(nice|lovely|nice-smelling) (smell|scent)|fragranced/;
const NEGATION =
  /\b(without|no|free (from|of)|avoid\w*|not|dont|doesnt|nothing with|cant have|cannot have|allergic to|allergy to|intolerant to|react to)\b[^.?!]{0,25}$/;
/** An allergy to something the catalogue tags, e.g. "I'm allergic to nuts". */
const ALLERGY = /\b(allerg\w*|intoleran\w*|cant have|cannot have|react\w* to)\b/;
/** Words that make a question about products in general, not the product being viewed. */
const LIST_CUE = /\b(products|oils|ones|options|anything|something|which|show|list|find|any)\b/;
/** Hair or skin descriptions the catalogue has no data for, so they can't be matched. */
const UNSUPPORTED_TRAIT =
  /\b(curly|wavy|straight|coily|kinky|afro|damaged|greasy|oily|colou?r(ed|-treated)|bleached|relaxed|permed|mature|ageing|aging|anti-?ageing|wrinkles?|fine lines|dark spots|pigmentation|sensitive)\b/;
const HELP =
  /\b(help|choose|pick|start|for my (hair|skin|scalp|face|body)|never used|new to|beginner|first time|dont know (where|what))\b/;
const GENDER = /\b(men|mens|man|male|guys?|women|womens|woman|female|ladies|unisex)\b/;

export function parseListQuery(t: string): ListQuery {
  const budget = t.match(BUDGET);
  const wantsHair = /\b(hair|scalp)\b/.test(t);
  const wantsSkin = /\b(skin|face|facial|body)\b/.test(t);
  const without: IngredientTag[] = [];
  const withTags: IngredientTag[] = [];
  const scented = !UNSCENTED.test(t) && SCENTED.test(t);
  for (const [re, tag] of TERM_TAGS) {
    const m = re.exec(t);
    if (!m) continue;
    if (NEGATION.test(t.slice(0, m.index))) without.push(tag);
    else if (CONTAINS.test(t) && !(scented && tag === 'essential-oil')) withTags.push(tag);
  }
  const goal = GOALS.find(([, re]) => re.test(t))?.[0] ?? null;
  const hairType: HairType | null = /\b(fine|thin|flat)(,? \w+)? hair\b/.test(t)
    ? 'fine'
    : /\b(thick|coarse)(,? \w+)? hair\b/.test(t)
      ? 'thick'
      : /\bmedium(-thickness| thickness)? hair\b/.test(t)
        ? 'medium'
        : null;
  const skinType = /\boily(,? \w+)? skin\b|\b(greasy|oily|shiny)\b.{0,20}\b(skin|face)\b|\b(skin|face)\b.{0,30}\b(greasy|oily|shiny)\b/.test(t)
    ? 'oily'
    : /\bcombination(,? \w+)? skin\b/.test(t)
      ? 'combination'
      : /\bnormal(,? \w+)? skin\b/.test(t)
        ? 'normal'
        : null;
  const face = /\b(face|facial)\b/.test(t);
  const body = /\b(body|elbows?|knees?|legs?|arms?|hands?|feet|foot|shower)\b/.test(t);
  const both =
    /\b(both (skin and hair|hair and skin)|skin and hair|hair and skin|multi-?use|all-?in-?one|one product for (both|everything))\b/.test(t);
  return {
    place: face === body ? null : face ? 'face' : 'body',
    area: both
      ? null
      : goal === 'scalp-massage' || hairType
        ? 'hair'
        : skinType || face || body
          ? 'skin'
          : wantsHair === wantsSkin
            ? null
            : wantsHair
              ? 'hair'
              : 'skin',
    both,
    gift: /\b(gifts?|present|gifting|set|sets)\b/.test(t),
    small: /\b(small|smaller|travel\w*|mini|trial|try (it|one) out|holiday)\b/.test(t),
    simpleRoutine: /\b(simple|minimal|easy|one step|low effort|not much time|lazy)\b/.test(t),
    maxPence: budget ? Math.round(Number(budget[1]) * 100) : null,
    scent: UNSCENTED.test(t) ? 'unscented' : scented ? 'essential-oils' : null,
    texture: /\b(light|lightweight)\b(?! moisture)/.test(t)
      ? 'light'
      : /\b(rich|thick|heavy)\b(?!,? (\w+ )?hair)/.test(t)
        ? 'rich'
        : /\bmedium texture\b/.test(t)
          ? 'medium'
          : null,
    goal,
    hairType,
    skinType,
    without,
    withTags,
    inStock: /\bin stock\b/.test(t),
    cheapest: /\b(cheapest|least expensive|lowest price)\b/.test(t),
  };
}

const hasFilters = (q: ListQuery) =>
  !!(q.area || q.place || q.both || q.gift || q.small || q.simpleRoutine || q.maxPence !== null || q.scent || q.texture || q.goal || q.hairType || q.skinType || q.without.length ||
    q.withTags.length || q.inStock || q.cheapest);

const onlyArea = (q: ListQuery) => hasFilters({ ...q, area: null }) === false;

/** Products with an unknown value for a filter are left out, never assumed to pass. */
function runListQuery(q: ListQuery, prefs: Preferences | null) {
  const unknown = new Set<Product>();
  let pool = recommend(prefs ?? EMPTY_PREFERENCES).ranked.map((f) => f.product);
  pool = pool.filter((p) => {
    if (q.area && !p.areas.includes(q.area)) return false;
    if (q.place && !p.areas.includes('skin')) return false;
    if (q.both && !(p.areas.includes('skin') && p.areas.includes('hair'))) return false;
    if (q.gift && p.category !== 'set') return false;
    if (q.small && p.size.value > 30) return false;
    if (q.simpleRoutine && p.routineFit !== 'simple') return false;
    if (q.place === 'face' && p.category === 'body-care') return false;
    if (
      q.place === 'body' &&
      p.category !== 'multi-use-oil' &&
      !p.goals.some((g) => g === 'body-softening' || g === 'massage')
    )
      return false;
    if (q.maxPence !== null && p.pricePence > q.maxPence) return false;
    if (q.goal && !p.goals.includes(q.goal)) return false;
    if (q.hairType) {
      if (!p.areas.includes('hair')) return false;
      if (!p.hairTypes) return !unknown.add(p);
      if (!p.hairTypes.includes(q.hairType)) return false;
    }
    if (q.skinType) {
      if (!p.areas.includes('skin')) return false;
      if (!p.skinTypes) return !unknown.add(p);
      if (!p.skinTypes.includes(q.skinType)) return false;
    }
    if (q.inStock && p.availability !== 'in-stock' && p.availability !== 'low-stock') return false;
    if (q.scent && !p.fragrance) return !unknown.add(p);
    if (q.scent && p.fragrance !== q.scent) return false;
    if (q.texture && !p.texture) return !unknown.add(p);
    if (q.texture && p.texture !== q.texture) return false;
    if (q.without.length || q.withTags.length) {
      if (!p.ingredients) return !unknown.add(p);
      if (q.without.some((tag) => (ingredientsWithTag(p, tag) ?? []).length > 0)) return false;
      if (!q.withTags.every((tag) => (ingredientsWithTag(p, tag) ?? []).length > 0)) return false;
    }
    return true;
  });
  if (q.cheapest) pool = [...pool].sort((a, b) => a.pricePence - b.pricePence);
  return { pool, unknown: [...unknown] };
}

const pounds = (pence: number) => (pence % 100 ? formatPrice(pence) : `£${pence / 100}`);

/** A question the parser reads back as the same filters, used for follow-up buttons. */
export function describeListQuery(q: ListQuery): string {
  const parts = [
    q.cheapest ? 'Cheapest' : '',
    q.gift
      ? q.area === 'hair' ? 'hair gift sets' : q.area === 'skin' ? 'skin gift sets' : 'gift sets'
      : q.both
        ? 'products for both skin and hair'
        : q.place
      ? `${q.place} products`
      : q.area === 'hair'
        ? 'hair products'
        : q.area === 'skin'
          ? 'skin products'
          : 'products',
    q.small ? 'in a small size' : '',
    q.simpleRoutine ? 'for a simple routine' : '',
    q.hairType ? `suited to ${q.hairType} hair` : '',
    q.skinType ? `suited to ${q.skinType} skin` : '',
    q.texture ? `with a ${q.texture} texture` : '',
    q.goal ? `for ${GOALS.find(([g]) => g === q.goal)![2]}` : '',
    q.maxPence !== null ? `under ${pounds(q.maxPence)}` : '',
    ...q.without.map((t) => `without ${TAG_WORDS[t]}`),
    ...q.withTags.map((t) => `that contain ${TAG_WORDS[t]}`),
    // Scent goes after ingredients so its "no" can't read as excluding them.
    q.scent === 'unscented' ? ', with no added scent' : q.scent ? ', scented with essential oils' : '',
    q.inStock ? ', in stock' : '',
  ].filter(Boolean);
  // The comma only helps after another filter: "products, with" reads oddly.
  const text = parts.join(' ').replace(/ ,/g, ',').replace(/products, /, 'products ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function shopLinkFor(q: ListQuery, prefs: Preferences | null, count: number): Reply['shopLink'] {
  // Only when the shop's own filters reproduce exactly the same list.
  if (q.place || q.both || q.small || q.simpleRoutine || q.goal || q.hairType || q.skinType || q.withTags.length) return undefined;
  if (q.maxPence !== null && !PRICE_STEPS.includes(q.maxPence)) return undefined;
  const params = filtersToParams({
    ...EMPTY_FILTERS,
    area: q.area,
    category: q.gift ? 'set' : null,
    maxPence: q.maxPence,
    scent: q.scent,
    texture: q.texture,
    without: q.without,
    inStock: q.inStock,
    sort: q.cheapest ? 'price-asc' : 'featured',
    fit: !!prefs,
  });
  return { href: `/shop?${params.toString()}`, label: `See all ${count} in the shop` };
}

function listAnswer(q: ListQuery, prefs: Preferences | null): Reply {
  const { pool, unknown } = runListQuery(q, prefs);
  const shown = pool.slice(0, MAX_PRODUCT_LINKS);
  const what = describeListQuery({ ...q, cheapest: false });
  const withPrefs = prefs ? ' that also fit your saved preferences' : '';
  // Say which catalogue field was matched, since "dry hair" is read as the "dry ends" goal.
  const goalNote = q.goal ? ` They’re the ones the catalogue lists for ${GOAL_LABELS[q.goal]}.` : '';
  const unknownNote = unknown.length
    ? `\n\nLeft out because the catalogue doesn’t confirm the details needed: ${unknown.map((p) => p.name).join(', ')}.`
    : '';

  if (!shown.length) {
    // Offer each filter removed in turn, but only where that actually finds something.
    const looser: ListQuery[] = [
      { ...q, maxPence: null },
      { ...q, scent: null },
      { ...q, texture: null },
      { ...q, goal: null },
      { ...q, small: false },
      { ...q, gift: false },
      { ...q, simpleRoutine: false },
      { ...q, hairType: null },
      { ...q, skinType: null },
      { ...q, without: [] },
      { ...q, inStock: false },
    ].filter((l) => describeListQuery(l) !== describeListQuery(q) && runListQuery(l, prefs).pool.length);
    return {
      answer: `I couldn’t find any ${what.charAt(0).toLowerCase()}${what.slice(1)}${withPrefs}.${unknownNote}${looser.length ? '\n\nYou could try one of these instead:' : prefs ? ' You could edit your preferences to see more.' : ''}`,
      productIds: [],
      followUps: looser.map(describeListQuery),
    };
  }

  // Conversational, but every number and filter still comes straight from the query.
  const lower = what.charAt(0).toLowerCase() + what.slice(1);
  const found =
    pool.length === 1
      ? `I found one match: ${lower}${withPrefs}.`
      : `I found ${pool.length} ${lower}${withPrefs}.`;
  const order = q.cheapest ? ' Cheapest first.' : prefs ? ' Best match first.' : '';
  const more = pool.length > shown.length ? ` Here are the top ${shown.length}.` : '';
  const intro = `${found}${goalNote}${order}${more}`;

  const followUps: string[] = [];
  if (shown.length >= 2) followUps.push(`Compare ${shown[0].name} and ${shown[1].name}`);
  followUps.push(`Tell me about ${shown[0].name}`);
  if (pool.length > 1) {
    const narrower = ([
      { ...q, scent: 'unscented' },
      { ...q, maxPence: 1500 },
      { ...q, texture: 'light' },
    ] satisfies ListQuery[]).filter(
      // "No added scent" adds nothing once essential oils are already excluded.
      (n) => !hasSame(n, q) && !(n.scent && q.without.includes('essential-oil')),
    );
    const next = narrower.find((n) => {
      const c = runListQuery(n, prefs).pool.length;
      return c > 0 && c < pool.length;
    });
    if (next) followUps.push(describeListQuery(next));
  }

  return {
    answer: intro + unknownNote,
    productIds: shown.map((p) => p.id),
    followUps,
    shopLink: pool.length > shown.length ? shopLinkFor(q, prefs, pool.length) : undefined,
  };
}

const hasSame = (a: ListQuery, b: ListQuery) => describeListQuery(a) === describeListQuery(b);

// ---------- Follow-up questions ----------

type Answered = 'summary' | 'ingredients' | 'usage' | 'alternatives' | 'why';

function productFollowUps(p: Product, prefs: Preferences | null, answered: Answered): string[] {
  const cheaper = PRODUCTS.some(
    (o) =>
      o.id !== p.id &&
      o.pricePence < p.pricePence &&
      o.availability !== 'out-of-stock' &&
      o.areas.some((a) => p.areas.includes(a)),
  );
  const options: [Answered, string][] = [
    ['usage', `How do I use ${p.name}?`],
    ['ingredients', `What are the ingredients in ${p.name}?`],
    [
      'alternatives',
      cheaper ? `Is there a cheaper alternative to ${p.name}?` : `What are some alternatives to ${p.name}?`,
    ],
  ];
  if (prefs) options.unshift(['why', `Why was ${p.name} recommended?`]);
  return options.filter(([kind]) => kind !== answered).map(([, q]) => q);
}

const STARTERS = [
  'I’m new to oils. Where should I start?',
  'Hair products under £20',
  'Which products contain essential oils?',
];

const AREA_QUESTIONS: Record<Area | 'unknown', string[]> = {
  hair: ['Hair products under £15', 'Hair products with no added scent', 'Hair products for a pre-wash treatment'],
  skin: ['Skin products for dry skin', 'Skin products with a light texture', 'Skin products with no added scent'],
  unknown: ['It’s for my hair', 'It’s for my skin', 'One product for both skin and hair'],
};

function finish(base: Base, followUps: string[], shopLink?: Reply['shopLink']): Reply {
  return { ...base, followUps: cleanFollowUps(followUps).slice(0, MAX_FOLLOW_UPS), shopLink };
}

// ---------- Main ----------

/** Deterministic answer from catalogue data only. */
export function offlineAnswer(req: AssistantRequest): Reply {
  const message = req.messages.at(-1)!.content;
  const t = normalise(message);
  const prefs = req.context.preferences ?? null;
  const current = req.context.productId ? getProduct(req.context.productId) : undefined;
  const compare = (req.context.compareIds ?? []).map(getProduct).filter((p): p is Product => !!p);
  const named = mentionedProducts(message);
  const q = parseListQuery(t);
  // "Which hair oils have no added scent?" on a product page is about the range, not that product.
  // Ingredient names such as "essential oils" don't count as a cue on their own.
  const cueText = TERM_TAGS.reduce((acc, [re]) => acc.replace(new RegExp(re.source, 'g'), ' '), t);
  const listIntent =
    !named.length && hasFilters(q) && (!current || LIST_CUE.test(cueText) || q.maxPence !== null);
  const targets = named.length ? named : current && !listIntent ? [current] : [];
  const first = targets[0];

  if (HAIR_LOSS.test(t)) {
    return finish(
      {
        answer:
          'I can’t say whether any product will reduce hair loss or help hair grow. None of the products here make that claim, and hair loss can have medical causes, so a pharmacist or GP is the best person to ask.\n\nIf you’d like a hair oil for your routine, I can help you choose one by what it’s for, its scent or your budget.',
        productIds: [],
      },
      ['Hair products for a scalp massage', 'Hair products for a pre-wash treatment', 'Hair products under £15'],
    );
  }

  // "I'm allergic to nuts": show what avoids it, with a clear caution, rather than refusing.
  if (ALLERGY.test(t) && q.without.length && !first) {
    const reply = listAnswer(q, prefs);
    return finish(
      {
        answer: `${reply.answer}\n\nWith an allergy, always check the full ingredient list on the label as well, and ask a pharmacist if you’re unsure. I can’t say whether a product is safe for you.`,
        productIds: reply.productIds,
      },
      reply.followUps,
      reply.shopLink,
    );
  }

  if (MEDICAL.test(t)) {
    return finish(
      {
        answer:
          'I can’t give medical advice or say whether a product will help a skin, scalp or hair condition, allergy or reaction. A pharmacist or GP can advise you. I can show you a product’s full ingredient list, or you can set “Ingredients to avoid” in your preferences so those products are left out.',
        productIds: targets.map((p) => p.id),
      },
      first
        ? [`What are the ingredients in ${first.name}?`, `How do I use ${first.name}?`]
        : ['Which products contain nuts?', 'Which products contain essential oils?'],
    );
  }

  if (UNSUPPORTED.test(t)) {
    return finish(
      {
        answer: `${UNKNOWN} The catalogue covers ingredients, scent, texture, size, price, usage, warnings and stock status${targets.length ? `. I can tell you any of those for ${targets.map((p) => p.name).join(' or ')}` : ''}.`,
        productIds: targets.map((p) => p.id),
      },
      first ? productFollowUps(first, prefs, 'summary') : STARTERS,
    );
  }

  if (WHY.test(t)) {
    if (!prefs)
      return finish(
        {
          answer:
            'You haven’t set any preferences, so nothing here has been personalised. Products are shown in the shop’s standard order. Tell me what you’re looking for, or answer a few questions on the “Find my products” page, and I can explain how each product matches.',
          productIds: [],
        },
        AREA_QUESTIONS.unknown,
      );
    const subject = targets.length ? targets : recommend(prefs).recommended.slice(0, 3).map((f) => f.product);
    if (!subject.length)
      return finish(
        {
          answer: 'None of the products currently match your preferences, so there are no recommendations to explain. Try changing a preference on the Preferences page.',
          productIds: [],
        },
        [],
      );
    const lines = subject.map((p) => {
      const fit = evaluateProduct(p, prefs);
      if (!fit.eligible) return `${p.name} isn’t recommended: ${fit.reasons.map((r) => r.text).join(' ')}`;
      const matches = fit.factors
        .filter((f) => f.kind === 'match')
        .sort((a, b) => b.points - a.points)
        .map((f) => f.text);
      const trade = fit.factors.filter((f) => f.kind === 'tradeoff').map((f) => f.text);
      return `${p.name}: ${matches.join(' ') || 'it fits your limits but matches none of your ranking preferences.'}${trade.length ? ` Trade-off: ${trade.join(' ')}` : ''}`;
    });
    return finish(
      { answer: list(lines), productIds: subject.map((p) => p.id) },
      subject.length >= 2
        ? [`Compare ${subject[0].name} and ${subject[1].name}`, `Tell me about ${subject[0].name}`]
        : productFollowUps(subject[0], prefs, 'why'),
    );
  }

  const oils = named.length >= 2 ? [] : mentionedOils(message);
  const toCompare =
    named.length >= 2 ? named : oils.length >= 2 ? oils : compare.length >= 2 ? compare : null;
  if (COMPARE.test(t)) {
    if (toCompare) {
      const [a, b] = toCompare;
      return finish(compareAnswer(toCompare.slice(0, 3), prefs), [
        `How do I use ${a.name}?`,
        `What are the ingredients in ${b.name}?`,
        `What are some alternatives to ${a.name}?`,
      ]);
    }
    return finish(
      {
        answer:
          'Which products would you like to compare? Name two of them, or tick “Compare” on up to three products and ask again.',
        productIds: [],
      },
      ['Compare Pure Argan Oil and Golden Jojoba Oil', 'Compare Rose Facial Oil and Rosehip Facial Oil'],
    );
  }

  if (ALTERNATIVE.test(t) && first) {
    const base = first;
    const cheaper = /cheaper|less expensive|lower price/.test(t);
    const pool = recommend(prefs ?? EMPTY_PREFERENCES).ranked
      .map((f) => f.product)
      .filter(
        (p) =>
          p.id !== base.id &&
          p.areas.some((a) => base.areas.includes(a)) &&
          (!cheaper || p.pricePence < base.pricePence) &&
          p.availability !== 'out-of-stock',
      )
      .sort(
        (a, b) =>
          b.goals.filter((g) => base.goals.includes(g)).length -
            a.goals.filter((g) => base.goals.includes(g)).length ||
          a.pricePence - b.pricePence,
      )
      .slice(0, 3);
    if (!pool.length)
      return finish(
        {
          answer: `I couldn’t find an in-stock alternative to ${base.name}${cheaper ? ' at a lower price' : ''}${prefs ? ' that fits your preferences' : ''}.`,
          productIds: [base.id],
        },
        productFollowUps(base, prefs, 'alternatives'),
      );
    return finish(
      {
        answer: `Alternatives to ${base.name}${prefs ? ' that fit your preferences' : ''}:\n${list(
          pool.map((p) => `${link(p)}: ${p.summary}`),
        )}`,
        productIds: pool.map((p) => p.id),
      },
      [`Compare ${base.name} and ${pool[0].name}`, `Tell me about ${pool[0].name}`],
    );
  }

  const trait = UNSUPPORTED_TRAIT.exec(t)?.[0];
  if (trait && !named.length && onlyArea(q) && !prefs) {
    const where = q.area ?? 'skin or hair';
    return finish(
      {
        answer: `The catalogue doesn’t record which products suit or help with ${trait}${q.area ? ` ${q.area}` : ''}, so I can’t match that. I can narrow things down by what a product is for, ${q.area === 'hair' ? 'hair thickness' : q.area === 'skin' ? 'skin type' : 'skin type, hair thickness'}, scent or budget.${q.area ? '' : ` Is this for your ${where}?`}`,
        productIds: [],
      },
      AREA_QUESTIONS[q.area ?? 'unknown'],
    );
  }

  if (GENDER.test(t) && onlyArea(q) && !named.length) {
    return finish(
      {
        answer: `Nothing here is made for a particular gender, so it’s best to choose by what you need. ${q.area ? `What matters most for your ${q.area}?` : 'Is it for your skin, your hair, or both?'}`,
        productIds: [],
      },
      AREA_QUESTIONS[q.area ?? 'unknown'],
    );
  }

  if (listIntent) {
    if (onlyArea(q) && HELP.test(t) && !prefs) {
      const area = q.area === 'hair' ? 'hair' : 'skin';
      return finish(
        {
          answer: `Happy to help you choose a ${area} product. What matters most to you? Pick one below, or tell me in your own words.`,
          productIds: [],
        },
        AREA_QUESTIONS[area],
      );
    }
    const reply = listAnswer(q, prefs);
    return finish(reply, reply.followUps, reply.shopLink);
  }

  if (first) {
    if (CONTAINS.test(t) || /\b(fragrance|perfume|scent\w*)\b/.test(t)) {
      const reply = ingredientAnswer(targets, message);
      if (reply) return finish(reply, productFollowUps(first, prefs, 'ingredients'));
    }
    if (USAGE.test(t))
      return finish(
        {
          answer: list(targets.map((p) => (p.usage ? `${p.name}: ${p.usage}` : `${p.name}: ${UNKNOWN}`))),
          productIds: targets.map((p) => p.id),
        },
        productFollowUps(first, prefs, 'usage'),
      );
    if (SAFETY.test(t))
      return finish(
        {
          answer: `${list(targets.map((p) => `${p.name}: ${p.warnings.join(' ')}`))}\n\nI can’t confirm whether a product is suitable for you personally.`,
          productIds: targets.map((p) => p.id),
        },
        productFollowUps(first, prefs, 'summary'),
      );
    if (STOCK.test(t))
      return finish(
        {
          answer: list(
            targets.map(
              (p) => `${p.name}: ${p.availability ? AVAILABILITY_LABELS[p.availability] : 'stock not known'} (demonstration stock status).`,
            ),
          ),
          productIds: targets.map((p) => p.id),
        },
        productFollowUps(first, prefs, 'summary'),
      );
    return finish(productSummary(first, prefs), productFollowUps(first, prefs, 'summary'));
  }

  if (CONTAINS.test(t) || /\b(fragrance|perfume|scent\w*)\b/.test(t)) {
    const reply = ingredientAnswer([], message);
    if (reply) {
      const tag = TERM_TAGS.find(([re]) => re.test(t))?.[1];
      return finish(
        reply,
        tag
          ? [`Products without ${TAG_WORDS[tag]}`, `Hair products without ${TAG_WORDS[tag]}`, `Skin products without ${TAG_WORDS[tag]}`]
          : STARTERS,
      );
    }
  }

  if (USAGE.test(t))
    return finish({ answer: 'Which product would you like directions for?', productIds: [] }, [
      'How do I use Pure Argan Oil?',
      'How do I use Rocket Seed Hair Oil?',
    ]);

  if (RECOMMEND.test(t) || HELP.test(t)) {
    if (!prefs)
      return finish(
        {
          answer:
            'Happy to help. Is this for your skin, your hair, or both? You can also answer a few quick questions on “Find my products” and I’ll explain how each suggestion matches.',
          productIds: [],
        },
        AREA_QUESTIONS.unknown,
      );
    const top = recommend(prefs).recommended.slice(0, 3);
    if (!top.length)
      return finish(
        {
          answer: 'No products currently match your preferences. You can change a preference on the Preferences page to see more options.',
          productIds: [],
        },
        [],
      );
    return finish(
      {
        answer: `Based on your preferences:\n${list(top.map((f) => `${f.product.name}: ${headline(f).why}`))}`,
        productIds: top.map((f) => f.product.id),
      },
      [
        `Why was ${top[0].product.name} recommended?`,
        ...(top.length >= 2 ? [`Compare ${top[0].product.name} and ${top[1].product.name}`] : []),
        `Tell me about ${top[0].product.name}`,
      ],
    );
  }

  return finish(
    {
      answer:
        'I can help with this shop’s products, for example ingredients, how to use something, prices, comparisons, alternatives, or why something was recommended. What would you like to know?',
      productIds: [],
    },
    STARTERS,
  );
}
