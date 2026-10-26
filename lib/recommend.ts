// Rule-based, explainable recommendation engine.
//
// 1. Hard constraints decide eligibility: area, ingredient exclusions,
//    "unscented only" and a strict budget. A product whose data is missing for
//    an active constraint is NOT eligible (unknown is never treated as a pass).
// 2. Eligible products are ranked by an additive score. Each point comes from a
//    Factor, and the customer-facing explanation is generated from the same
//    factors, so explanations always agree with the ranking.
// 3. Ties are broken by price (lower first) and then product ID, so the same
//    catalogue and profile always produce the same order.
//
// The score is an internal ordering value only. It is not a probability or a
// "% match" and is never shown to customers. Weights are listed in WEIGHTS and
// documented in docs/RECOMMENDATIONS.md.

import {
  AVAILABILITY_LABELS,
  GOAL_LABELS,
  HAIR_TYPE_LABELS,
  INGREDIENTS,
  PRODUCTS,
  SKIN_TYPE_LABELS,
  TAG_LABELS,
  TEXTURE_LABELS,
  formatPrice,
  ingredientsWithTag,
  type IngredientTag,
  type Product,
} from './catalogue.ts';
import {
  EXCLUSION_OPTIONS,
  HAIR_TYPE_OPTIONS,
  ROUTINE_OPTIONS,
  SKIN_TYPE_OPTIONS,
  TEXTURE_OPTIONS,
  AREA_OPTIONS,
  wantsArea,
  type Preferences,
} from './preferences.ts';

export const WEIGHTS = {
  goal: 3,
  typeMatch: 2,
  typeMismatch: -1,
  likedIngredient: 2,
  scentMatch: 1,
  scentMismatch: -1,
  textureMatch: 1,
  textureMismatch: -1,
  routineMatch: 1,
  routineMismatch: -1,
  samplerWhenUnsure: 1,
  overFlexibleBudget: -2,
  outOfStock: -3,
} as const;

export type HardConstraint = 'area' | 'exclusions' | 'scent' | 'budget';

export interface ExclusionReason {
  constraint: HardConstraint;
  text: string;
}

export interface Factor {
  /** match: supports the choice. tradeoff: works against it. note: missing data or context. */
  kind: 'match' | 'tradeoff' | 'note';
  code: string;
  points: number;
  /** Full sentence for detail views. */
  text: string;
  /** Short phrase for one-line summaries on cards. */
  short: string;
}

export interface ProductFit {
  product: Product;
  eligible: boolean;
  reasons: ExclusionReason[];
  score: number;
  factors: Factor[];
}

export interface Recommendations {
  /** All eligible products in ranked order. */
  ranked: ProductFit[];
  /** Eligible products with at least one positive match, best first. */
  recommended: ProductFit[];
  excluded: ProductFit[];
  /** True when the profile has at least one ranking preference. */
  personalised: boolean;
  /** How each active hard constraint affects the results. */
  constraintImpact: {
    constraint: HardConstraint;
    removed: number;
    /** Products that would become eligible if only this constraint were removed. */
    wouldAdd: number;
  }[];
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function exclusionLabel(tag: IngredientTag): string {
  return lower(TAG_LABELS[tag]);
}

export function hasRankingSignal(prefs: Preferences): boolean {
  return (
    prefs.goals.length > 0 ||
    (prefs.skinType !== null && prefs.skinType !== 'not-sure') ||
    (prefs.hairType !== null && prefs.hairType !== 'not-sure') ||
    prefs.likes.length > 0 ||
    prefs.fragrance === 'prefer-unscented' ||
    prefs.fragrance === 'prefer-scented' ||
    prefs.texture === 'light' ||
    prefs.texture === 'medium' ||
    prefs.texture === 'rich' ||
    prefs.routine === 'simple' ||
    prefs.routine === 'fuller' ||
    isUnsure(prefs) ||
    (prefs.budget.maxPence !== null && !prefs.budget.strict)
  );
}

function isUnsure(prefs: Preferences): boolean {
  return (
    prefs.goalsNotSure ||
    prefs.area === 'not-sure' ||
    prefs.skinType === 'not-sure' ||
    prefs.texture === 'not-sure'
  );
}

/** Evaluate one product against a profile. Pure and deterministic. */
export function evaluateProduct(product: Product, prefs: Preferences): ProductFit {
  const reasons: ExclusionReason[] = [];
  const factors: Factor[] = [];
  const add = (f: Factor) => factors.push(f);

  // ---- Hard constraints ----
  if (prefs.area === 'skin' || prefs.area === 'hair') {
    if (!product.areas.includes(prefs.area)) {
      reasons.push({
        constraint: 'area',
        text: `It’s a ${product.areas[0]} product, and you’re shopping for ${prefs.area}.`,
      });
    }
  }

  if (prefs.exclude.length) {
    if (!product.ingredients) {
      reasons.push({
        constraint: 'exclusions',
        text: 'Its full ingredient list isn’t confirmed, so we can’t check it against the ingredients you’re avoiding.',
      });
    } else {
      const found = prefs.exclude.flatMap((tag) => {
        const hits = ingredientsWithTag(product, tag) ?? [];
        return hits.length ? [{ tag, hits }] : [];
      });
      for (const { tag, hits } of found) {
        reasons.push({
          constraint: 'exclusions',
          text: `Contains ${hits.map((h) => lower(INGREDIENTS[h].name)).join(', ')} (${exclusionLabel(tag)}), which you’re avoiding.`,
        });
      }
      if (!found.length) {
        const labels = prefs.exclude.map(exclusionLabel).join(', ');
        add({
          kind: 'match',
          code: 'exclusions-clear',
          points: 0,
          text: `Its full ingredient list contains none of the ingredients you’re avoiding (${labels}).`,
          short: `free from ${labels}`,
        });
      }
    }
  }

  if (prefs.fragrance === 'unscented-only') {
    if (product.fragrance === 'essential-oils') {
      reasons.push({
        constraint: 'scent',
        text: 'It’s scented with essential oils, and you asked for unscented products only.',
      });
    } else if (product.fragrance === null) {
      reasons.push({
        constraint: 'scent',
        text: 'Its scent isn’t confirmed, and you asked for unscented products only.',
      });
    } else {
      add({
        kind: 'match',
        code: 'scent-required',
        points: 0,
        text: 'It has no added scent, as you required.',
        short: 'no added scent',
      });
    }
  }

  const max = prefs.budget.maxPence;
  if (max !== null) {
    const price = formatPrice(product.pricePence);
    if (product.pricePence <= max) {
      add({
        kind: 'match',
        code: 'budget-within',
        points: 0,
        text: `It costs ${price}, within your ${formatPrice(max)} per-product budget.`,
        short: `${price}, within your ${formatPrice(max)} budget`,
      });
    } else if (prefs.budget.strict) {
      reasons.push({
        constraint: 'budget',
        text: `It costs ${price}, above your strict ${formatPrice(max)} per-product budget.`,
      });
    } else {
      const over = formatPrice(product.pricePence - max);
      add({
        kind: 'tradeoff',
        code: 'budget-over',
        points: WEIGHTS.overFlexibleBudget,
        text: `It costs ${price}, ${over} over your flexible ${formatPrice(max)} per-product budget.`,
        short: `${over} over your budget`,
      });
    }
  }

  // ---- Ranking factors ----
  for (const goal of prefs.goals) {
    if (product.goals.includes(goal)) {
      add({
        kind: 'match',
        code: `goal:${goal}`,
        points: WEIGHTS.goal,
        text: `It’s intended for ${GOAL_LABELS[goal]}, one of your goals.`,
        short: `for ${GOAL_LABELS[goal]}`,
      });
    }
  }

  const skinType = prefs.skinType;
  if (
    skinType &&
    skinType !== 'not-sure' &&
    product.areas.includes('skin') &&
    wantsArea(prefs, 'skin')
  ) {
    const label = lower(SKIN_TYPE_LABELS[skinType]);
    if (product.skinTypes === null) {
      add({
        kind: 'note',
        code: 'skin-type-unknown',
        points: 0,
        text: 'The catalogue doesn’t say which skin types it’s intended for.',
        short: 'skin types not specified',
      });
    } else if (product.skinTypes.includes(skinType)) {
      add({
        kind: 'match',
        code: 'skin-type',
        points: WEIGHTS.typeMatch,
        text: `It’s listed for ${label} skin, which you selected.`,
        short: `listed for ${label} skin`,
      });
    } else {
      add({
        kind: 'tradeoff',
        code: 'skin-type-mismatch',
        points: WEIGHTS.typeMismatch,
        text: `It isn’t listed for ${label} skin (listed for ${product.skinTypes.map((t) => lower(SKIN_TYPE_LABELS[t])).join(', ')}).`,
        short: `not listed for ${label} skin`,
      });
    }
  }

  const hairType = prefs.hairType;
  if (
    hairType &&
    hairType !== 'not-sure' &&
    product.areas.includes('hair') &&
    wantsArea(prefs, 'hair')
  ) {
    const label = lower(HAIR_TYPE_LABELS[hairType]);
    if (product.hairTypes === null) {
      add({
        kind: 'note',
        code: 'hair-type-unknown',
        points: 0,
        text: 'The catalogue doesn’t say which hair types it’s intended for.',
        short: 'hair types not specified',
      });
    } else if (product.hairTypes.includes(hairType)) {
      add({
        kind: 'match',
        code: 'hair-type',
        points: WEIGHTS.typeMatch,
        text: `It’s listed for ${label} hair, which you selected.`,
        short: `listed for ${label} hair`,
      });
    } else {
      add({
        kind: 'tradeoff',
        code: 'hair-type-mismatch',
        points: WEIGHTS.typeMismatch,
        text: `It isn’t listed for ${label} hair (listed for ${product.hairTypes.map((t) => lower(HAIR_TYPE_LABELS[t])).join(', ')}).`,
        short: `not listed for ${label} hair`,
      });
    }
  }

  if (prefs.likes.length) {
    if (!product.ingredients) {
      add({
        kind: 'note',
        code: 'likes-unknown',
        points: 0,
        text: 'Its ingredients aren’t confirmed, so we can’t check for ingredients you like.',
        short: 'ingredients not confirmed',
      });
    } else {
      for (const like of prefs.likes) {
        if (product.ingredients.includes(like)) {
          const name = lower(INGREDIENTS[like].name);
          add({
            kind: 'match',
            code: `like:${like}`,
            points: WEIGHTS.likedIngredient,
            text: `It contains ${name}, an ingredient you like.`,
            short: `contains ${name}`,
          });
        }
      }
    }
  }

  if (prefs.fragrance === 'prefer-unscented' || prefs.fragrance === 'prefer-scented') {
    const wantsScent = prefs.fragrance === 'prefer-scented';
    if (product.fragrance === null) {
      add({
        kind: 'note',
        code: 'scent-unknown',
        points: 0,
        text: 'The catalogue doesn’t specify its scent.',
        short: 'scent not specified',
      });
    } else if ((product.fragrance === 'essential-oils') === wantsScent) {
      add({
        kind: 'match',
        code: 'scent-preference',
        points: WEIGHTS.scentMatch,
        text: wantsScent
          ? `It’s scented with essential oils, which you enjoy. ${product.fragranceNote ?? ''}`.trim()
          : 'It has no added scent, which you prefer.',
        short: wantsScent ? 'naturally scented' : 'no added scent',
      });
    } else if (wantsScent) {
      add({
        kind: 'tradeoff',
        code: 'scent-preference-mismatch',
        points: 0,
        text: 'It has no added scent; you said you enjoy natural scents.',
        short: 'no added scent',
      });
    } else {
      add({
        kind: 'tradeoff',
        code: 'scent-preference-mismatch',
        points: WEIGHTS.scentMismatch,
        text: 'It’s scented with essential oils; you’d prefer no added scent.',
        short: 'scented with essential oils',
      });
    }
  }

  const texture = prefs.texture;
  if (texture === 'light' || texture === 'medium' || texture === 'rich') {
    if (product.texture === null) {
      add({
        kind: 'note',
        code: 'texture-unknown',
        points: 0,
        text: 'The catalogue doesn’t specify its texture.',
        short: 'texture not specified',
      });
    } else if (product.texture === 'varies') {
      add({
        kind: 'note',
        code: 'texture-varies',
        points: 0,
        text: 'Its items have different textures.',
        short: 'textures vary',
      });
    } else if (product.texture === texture) {
      add({
        kind: 'match',
        code: 'texture',
        points: WEIGHTS.textureMatch,
        text: `It has a ${texture} texture, as you prefer.`,
        short: `${texture} texture`,
      });
    } else {
      add({
        kind: 'tradeoff',
        code: 'texture-mismatch',
        points: WEIGHTS.textureMismatch,
        text: `It has a ${lower(TEXTURE_LABELS[product.texture])} texture; you prefer ${texture}.`,
        short: `${lower(TEXTURE_LABELS[product.texture])} texture`,
      });
    }
  }

  if (prefs.routine === 'simple') {
    if (product.routineFit === 'simple') {
      add({
        kind: 'match',
        code: 'routine',
        points: WEIGHTS.routineMatch,
        text: 'It’s multi-use or a single step, which suits the simple routine you asked for.',
        short: 'suits a simple routine',
      });
    } else {
      add({
        kind: 'tradeoff',
        code: 'routine-mismatch',
        points: WEIGHTS.routineMismatch,
        text: 'It’s designed as one step in a fuller routine; you asked to keep things simple.',
        short: 'one step of a fuller routine',
      });
    }
  } else if (prefs.routine === 'fuller' && product.routineFit === 'fuller') {
    add({
      kind: 'match',
      code: 'routine',
      points: WEIGHTS.routineMatch,
      text: 'It’s designed as a dedicated step, which fits the fuller routine you’re happy with.',
      short: 'a dedicated routine step',
    });
  }

  if (product.sampler && isUnsure(prefs)) {
    add({
      kind: 'match',
      code: 'sampler',
      points: WEIGHTS.samplerWhenUnsure,
      text: 'It’s a sampler set, so you can try several oils while you’re not sure which suits you.',
      short: 'lets you try several oils',
    });
  }

  if (product.availability === 'out-of-stock') {
    add({
      kind: 'tradeoff',
      code: 'out-of-stock',
      points: WEIGHTS.outOfStock,
      text: 'It’s currently out of stock.',
      short: 'out of stock',
    });
  } else if (product.availability === 'low-stock') {
    add({
      kind: 'note',
      code: 'low-stock',
      points: 0,
      text: `${AVAILABILITY_LABELS['low-stock']}.`,
      short: 'low stock',
    });
  } else if (product.availability === null) {
    add({
      kind: 'note',
      code: 'stock-unknown',
      points: 0,
      text: 'Stock level is not known.',
      short: 'stock unknown',
    });
  }

  if (!product.ingredients && !prefs.exclude.length && !prefs.likes.length) {
    add({
      kind: 'note',
      code: 'ingredients-unconfirmed',
      points: 0,
      text: 'Its full ingredient list hasn’t been confirmed yet.',
      short: 'ingredients not confirmed',
    });
  }

  const score = factors.reduce((sum, f) => sum + f.points, 0);
  return { product, eligible: reasons.length === 0, reasons, score, factors };
}

export function compareFits(a: ProductFit, b: ProductFit): number {
  const oos = (f: ProductFit) =>
    f.product.availability === 'out-of-stock' ? 1 : 0;
  return (
    b.score - a.score ||
    oos(a) - oos(b) ||
    a.product.pricePence - b.product.pricePence ||
    a.product.id.localeCompare(b.product.id)
  );
}

/** Recommended only when at least one preference matches and matches outweigh trade-offs. */
export function hasPositiveMatch(fit: ProductFit): boolean {
  return fit.score > 0 && fit.factors.some((f) => f.kind === 'match' && f.points > 0);
}

export function recommend(
  prefs: Preferences,
  products: Product[] = PRODUCTS,
  limit = 6,
): Recommendations {
  const fits = products.map((p) => evaluateProduct(p, prefs));
  const ranked = fits.filter((f) => f.eligible).sort(compareFits);
  const excluded = fits.filter((f) => !f.eligible);
  const personalised = hasRankingSignal(prefs);
  const recommended = personalised
    ? ranked.filter(hasPositiveMatch).slice(0, limit)
    : [];

  const active = new Set(excluded.flatMap((f) => f.reasons.map((r) => r.constraint)));
  const constraintImpact = [...active].map((constraint) => ({
    constraint,
    removed: excluded.filter((f) => f.reasons.some((r) => r.constraint === constraint))
      .length,
    wouldAdd: excluded.filter((f) => f.reasons.every((r) => r.constraint === constraint))
      .length,
  }));

  return { ranked, recommended, excluded, personalised, constraintImpact };
}

/** One-line, customer-facing explanation generated from the fit's factors. */
export function headline(fit: ProductFit): { why: string; tradeoff: string | null } {
  if (!fit.eligible) {
    return { why: fit.reasons[0]?.text ?? '', tradeoff: null };
  }
  const positives = fit.factors
    .filter((f) => f.kind === 'match' && f.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);
  const constraints = fit.factors.filter(
    (f) => f.kind === 'match' && f.points === 0,
  );
  const parts = [...positives, ...constraints].map((f) => f.short);
  const why = parts.length
    ? `Matches: ${parts.join('; ')}.`
    : 'Fits your limits, but doesn’t match any of your ranking preferences.';
  const worst = fit.factors
    .filter((f) => f.kind === 'tradeoff')
    .sort((a, b) => a.points - b.points)[0];
  return { why, tradeoff: worst ? `Trade-off: ${worst.short}.` : null };
}

export const CONSTRAINT_LABELS: Record<HardConstraint, string> = {
  area: 'What you’re shopping for',
  exclusions: 'Ingredients to avoid',
  scent: 'Unscented products only',
  budget: 'Strict budget',
};

// ---------- Human-readable summary of a profile ----------

export interface SummaryItem {
  field: keyof Preferences;
  label: string;
  value: string;
}

const optionLabel = <T extends string>(
  options: { value: T; label: string }[],
  value: T,
) => options.find((o) => o.value === value)?.label ?? value;

export function summarisePreferences(prefs: Preferences): SummaryItem[] {
  const items: SummaryItem[] = [];
  if (prefs.area)
    items.push({
      field: 'area',
      label: 'Shopping for',
      value: optionLabel(AREA_OPTIONS, prefs.area),
    });
  if (prefs.goals.length)
    items.push({
      field: 'goals',
      label: 'Goals',
      value: prefs.goals.map((g) => GOAL_LABELS[g]).join('; '),
    });
  else if (prefs.goalsNotSure)
    items.push({ field: 'goals', label: 'Goals', value: 'Not sure' });
  if (prefs.skinType)
    items.push({
      field: 'skinType',
      label: 'Skin',
      value: optionLabel(SKIN_TYPE_OPTIONS, prefs.skinType),
    });
  if (prefs.hairType)
    items.push({
      field: 'hairType',
      label: 'Hair',
      value: optionLabel(HAIR_TYPE_OPTIONS, prefs.hairType),
    });
  if (prefs.exclude.length)
    items.push({
      field: 'exclude',
      label: 'Avoiding',
      value: prefs.exclude
        .map((t) => optionLabel(EXCLUSION_OPTIONS, t))
        .join(', '),
    });
  if (prefs.likes.length)
    items.push({
      field: 'likes',
      label: 'Likes',
      value: prefs.likes.map((l) => INGREDIENTS[l].name).join(', '),
    });
  if (prefs.fragrance)
    items.push({
      field: 'fragrance',
      label: 'Scent',
      value: {
        'unscented-only': 'Unscented only',
        'prefer-unscented': 'Prefer no added scent',
        'prefer-scented': 'Enjoys natural scents',
        'no-preference': 'No preference',
      }[prefs.fragrance],
    });
  if (prefs.texture)
    items.push({
      field: 'texture',
      label: 'Texture',
      value: optionLabel(TEXTURE_OPTIONS, prefs.texture),
    });
  if (prefs.budget.maxPence !== null)
    items.push({
      field: 'budget',
      label: 'Budget',
      value: `Up to ${formatPrice(prefs.budget.maxPence)} per product (${prefs.budget.strict ? 'strict' : 'flexible'})`,
    });
  if (prefs.routine)
    items.push({
      field: 'routine',
      label: 'Routine',
      value: optionLabel(ROUTINE_OPTIONS, prefs.routine),
    });
  return items;
}
