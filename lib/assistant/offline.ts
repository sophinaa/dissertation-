// Offline catalogue helper: a deterministic, rule-based responder used when no
// language model is configured. It is NOT AI and the interface says so. It only
// reads the same catalogue records and recommendation factors as the rest of
// the site, which also makes it a useful reference for testing grounding.

import {
  AVAILABILITY_LABELS,
  FRAGRANCE_LABELS,
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
  type IngredientId,
  type IngredientTag,
  type Product,
} from '../catalogue.ts';
import { EMPTY_PREFERENCES, type Preferences } from '../preferences.ts';
import { evaluateProduct, headline, recommend } from '../recommend.ts';
import { UNKNOWN, type AssistantReply, type AssistantRequest } from './shared.ts';

type Reply = Pick<AssistantReply, 'answer' | 'productIds'>;

const MEDICAL =
  /\b(acne|eczema|psoriasis|dermatitis|rosacea|dandruff|hair ?loss|alopecia|bald|balding|rash|infection|fungal|cure|cures|heal|heals|prescri\w*|pregnan\w*|breastfeed\w*|medication|medicine|diagnos\w*|allerg\w*|reaction|burns?|wound)\b/;
const UNSUPPORTED =
  /\b(organic|certif\w*|vegan|cruelty|halal|sourc\w*|origin|farm\w*|fair ?trade|reviews?|ratings?|testimonials?|clinical\w*|proven|evidence|stud(y|ies)|shelf ?life|expir\w*|recycl\w*|packaging|deliver\w*|shipping|returns?|refunds?)\b/;
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
  // Variants such as "Pure Argan Oil — Travel Size" must not claim the base name.
  const aliases = full.includes(' — ')
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

function ingredientAnswer(products: Product[], text: string): Reply | null {
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

function compareAnswer(products: Product[], prefs: Preferences | null): Reply {
  const lines = products.map((p) => {
    const parts = [
      `${formatPrice(p.pricePence)} for ${formatSize(p)} (${formatPricePer100(p)})`,
      `texture: ${p.texture ? TEXTURE_LABELS[p.texture].toLowerCase() : 'not specified'}`,
      `scent: ${p.fragrance ? FRAGRANCE_LABELS[p.fragrance].toLowerCase() : 'not specified'}`,
      `ingredients: ${ingredientsText(p) ?? 'not confirmed'}`,
    ];
    if (prefs) {
      const fit = evaluateProduct(p, prefs);
      parts.push(fit.eligible ? headline(fit).why : `doesn’t fit your limits — ${fit.reasons[0].text}`);
    }
    return `${p.name}: ${parts.join('; ')}`;
  });
  const units = new Set(products.map((p) => p.size.unit));
  const note =
    units.size > 1
      ? 'Prices per 100 aren’t directly comparable because one is sold by weight and one by volume.'
      : 'The catalogue doesn’t say one is better overall — it depends on which of these differences matter to you.';
  return {
    answer: `${list(lines)}\n\n${note} You can see them side by side on the Compare page.`,
    productIds: products.map((p) => p.id),
  };
}

function productSummary(p: Product, prefs: Preferences | null): Reply {
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

/** Deterministic answer from catalogue data only. */
export function offlineAnswer(req: AssistantRequest): Reply {
  const message = req.messages.at(-1)!.content;
  const t = normalise(message);
  const prefs = req.context.preferences ?? null;
  const current = req.context.productId ? getProduct(req.context.productId) : undefined;
  const compare = (req.context.compareIds ?? []).map(getProduct).filter((p): p is Product => !!p);
  const named = mentionedProducts(message);
  const targets = named.length ? named : current ? [current] : [];

  if (MEDICAL.test(t)) {
    return {
      answer:
        'I can’t give medical advice or say whether a product will help a skin, scalp or hair condition, allergy or reaction. A pharmacist or GP can advise you. I can show you a product’s full ingredient list, or you can set “Ingredients to avoid” in your preferences so those products are left out.',
      productIds: targets.map((p) => p.id),
    };
  }

  if (UNSUPPORTED.test(t)) {
    return {
      answer: `${UNKNOWN} The catalogue covers ingredients, scent, texture, size, price, usage, warnings and stock status${targets.length ? ` — I can tell you any of those for ${targets.map((p) => p.name).join(' or ')}` : ''}.`,
      productIds: targets.map((p) => p.id),
    };
  }

  if (WHY.test(t)) {
    if (!prefs)
      return {
        answer:
          'You haven’t set any preferences, so nothing here has been personalised. Products are shown in the shop’s standard order. Answer a few questions on the “Find my products” page and I can explain how each product matches your answers.',
        productIds: [],
      };
    const subject = targets.length ? targets : recommend(prefs).recommended.slice(0, 3).map((f) => f.product);
    if (!subject.length)
      return {
        answer: 'None of the products currently match your preferences, so there are no recommendations to explain. Try changing a preference on the Preferences page.',
        productIds: [],
      };
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
    return { answer: list(lines), productIds: subject.map((p) => p.id) };
  }

  const toCompare = named.length >= 2 ? named : compare.length >= 2 ? compare : null;
  if (COMPARE.test(t)) {
    if (toCompare) return compareAnswer(toCompare.slice(0, 3), prefs);
    return {
      answer:
        'Which products would you like to compare? Name two of them, or tick “Compare” on up to three products and ask again.',
      productIds: [],
    };
  }

  const budget = t.match(BUDGET);
  const wantsHair = /\b(hair|scalp)\b/.test(t);
  const wantsSkin = /\b(skin|face|facial|body)\b/.test(t);
  const effective = prefs ?? EMPTY_PREFERENCES;

  if (ALTERNATIVE.test(t) && targets.length) {
    const base = targets[0];
    const cheaper = /cheaper|less expensive|lower price/.test(t);
    const pool = recommend(effective).ranked
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
      return {
        answer: `I couldn’t find an in-stock alternative to ${base.name}${cheaper ? ' at a lower price' : ''}${prefs ? ' that fits your preferences' : ''}.`,
        productIds: [base.id],
      };
    return {
      answer: `Alternatives to ${base.name}${prefs ? ' that fit your preferences' : ''}:\n${list(
        pool.map((p) => `${link(p)} — ${p.summary}`),
      )}`,
      productIds: pool.map((p) => p.id),
    };
  }

  if (CONTAINS.test(t) || /\b(fragrance|perfume|scent\w*)\b/.test(t)) {
    const reply = ingredientAnswer(targets, message);
    if (reply) return reply;
  }

  if (USAGE.test(t)) {
    if (!targets.length)
      return { answer: 'Which product would you like directions for?', productIds: [] };
    return {
      answer: list(targets.map((p) => (p.usage ? `${p.name}: ${p.usage}` : `${p.name}: ${UNKNOWN}`))),
      productIds: targets.map((p) => p.id),
    };
  }

  if (SAFETY.test(t) && targets.length) {
    return {
      answer: `${list(targets.map((p) => `${p.name}: ${p.warnings.join(' ')}`))}\n\nI can’t confirm whether a product is suitable for you personally.`,
      productIds: targets.map((p) => p.id),
    };
  }

  if (STOCK.test(t) && targets.length) {
    return {
      answer: list(
        targets.map(
          (p) => `${p.name}: ${p.availability ? AVAILABILITY_LABELS[p.availability] : 'stock not known'} (demonstration stock status).`,
        ),
      ),
      productIds: targets.map((p) => p.id),
    };
  }

  if (budget || ((wantsHair || wantsSkin) && !targets.length) || /\bcheapest\b/.test(t)) {
    const max = budget ? Math.round(Number(budget[1]) * 100) : null;
    let pool = recommend(effective).ranked.map((f) => f.product);
    if (max !== null) pool = pool.filter((p) => p.pricePence <= max);
    if (wantsHair && !wantsSkin) pool = pool.filter((p) => p.areas.includes('hair'));
    if (wantsSkin && !wantsHair) pool = pool.filter((p) => p.areas.includes('skin'));
    if (/\bcheapest\b/.test(t)) pool = [...pool].sort((a, b) => a.pricePence - b.pricePence);
    const shown = pool.slice(0, 4);
    if (!shown.length)
      return {
        answer: `No products match that${prefs ? ' together with your saved preferences' : ''}. Try a higher budget${prefs ? ' or edit your preferences' : ''}.`,
        productIds: [],
      };
    return {
      answer: `${pool.length} product${pool.length === 1 ? '' : 's'} match${pool.length === 1 ? 'es' : ''}${max !== null ? ` at ${formatPrice(max)} or less per product` : ''}${prefs ? ' and your saved preferences' : ''}${pool.length > shown.length ? '. The first few:' : ':'}\n${list(shown.map(link))}`,
      productIds: shown.map((p) => p.id),
    };
  }

  if (RECOMMEND.test(t) && !targets.length) {
    if (!prefs)
      return {
        answer:
          'Happy to help. Is this for your skin, your hair, or both? You can also answer a few quick questions on “Find my products” and I’ll explain how each suggestion matches.',
        productIds: [],
      };
    const top = recommend(prefs).recommended.slice(0, 3);
    if (!top.length)
      return {
        answer: 'No products currently match your preferences. You can change a preference on the Preferences page to see more options.',
        productIds: [],
      };
    return {
      answer: `Based on your preferences:\n${list(top.map((f) => `${link(f.product)} — ${headline(f).why}`))}`,
      productIds: top.map((f) => f.product.id),
    };
  }

  if (targets.length) return productSummary(targets[0], prefs);

  return {
    answer:
      'I can help with this shop’s products — for example ingredients, how to use something, prices, comparisons, alternatives, or why something was recommended. What would you like to know?',
    productIds: [],
  };
}
