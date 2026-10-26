// Guided product finder. Starts from the saved preference profile (unless the
// customer chooses to ignore it), then asks only questions that split the
// remaining products. Answers are temporary: they are merged into a working
// copy of the profile and never written back unless the customer saves them.

import {
  CATEGORY_LABELS,
  GOAL_LABELS,
  HAIR_TYPE_LABELS,
  SKIN_TYPE_LABELS,
  TEXTURE_LABELS,
  formatPrice,
  type Area,
  type Category,
  type Goal,
  type HairType,
  type Product,
  type SkinType,
} from './catalogue.ts';
import {
  EMPTY_PREFERENCES,
  normalisePreferences,
  type Preferences,
} from './preferences.ts';
import { recommend, type ProductFit } from './recommend.ts';

export type FinderField =
  | 'area'
  | 'category'
  | 'goal'
  | 'skinType'
  | 'hairType'
  | 'budget'
  | 'texture'
  | 'fragrance';

export interface FinderAnswers {
  area?: Area;
  category?: Category;
  goal?: Goal;
  skinType?: SkinType;
  hairType?: HairType;
  budgetMax?: number;
  texture?: 'light' | 'medium' | 'rich';
  fragrance?: 'unscented-only' | 'no-preference';
  /** Questions the customer chose to skip. */
  skipped?: FinderField[];
}

export interface FinderOption {
  value: string;
  label: string;
  count: number;
}

export interface FinderQuestion {
  field: FinderField;
  prompt: string;
  help?: string;
  options: FinderOption[];
}

export interface FinderState {
  /** The profile actually used for ranking (saved profile + finder answers). */
  working: Preferences;
  candidates: ProductFit[];
  question: FinderQuestion | null;
  done: boolean;
  /** Saved answers the finder reused instead of asking again. */
  reused: { field: FinderField; text: string }[];
}

export const MAX_QUESTIONS = 5;
export const ENOUGH_CANDIDATES = 3;
const BUDGET_STEPS = [1000, 1500, 2000, 2500];
const ORDER: FinderField[] = [
  'area',
  'category',
  'goal',
  'hairType',
  'skinType',
  'budget',
  'texture',
  'fragrance',
];

const PROMPTS: Record<FinderField, { prompt: string; help?: string }> = {
  area: { prompt: 'Is this for your skin or your hair?' },
  category: { prompt: 'What kind of product are you looking for?' },
  goal: { prompt: 'What would you most like it to help with?' },
  skinType: {
    prompt: 'How would you describe your skin?',
    help: 'Dry skin often feels tight; oily skin often looks shiny; combination is both.',
  },
  hairType: {
    prompt: 'How would you describe your hair?',
    help: 'Think about the thickness of individual strands.',
  },
  budget: { prompt: 'What’s the most you’d like to spend on this product?' },
  texture: {
    prompt: 'What texture do you prefer?',
    help: 'Light oils absorb quickly; rich ones feel thicker and absorb slowly.',
  },
  fragrance: {
    prompt: 'Does it need to have no added scent?',
    help: 'Some products are scented with essential oils such as rose or tea tree.',
  },
};

/** Merge finder answers into a working copy of the profile. */
export function workingPreferences(
  saved: Preferences | null,
  answers: FinderAnswers,
  ignoreSaved: boolean,
): Preferences {
  const base = ignoreSaved || !saved ? EMPTY_PREFERENCES : saved;
  const next: Preferences = structuredClone(base);
  if (answers.area) next.area = answers.area;
  if (answers.goal) next.goals = [answers.goal];
  if (answers.skinType) next.skinType = answers.skinType;
  if (answers.hairType) next.hairType = answers.hairType;
  if (answers.texture) next.texture = answers.texture;
  if (answers.fragrance) next.fragrance = answers.fragrance;
  if (answers.budgetMax !== undefined)
    next.budget = { maxPence: answers.budgetMax, strict: true };
  return normalisePreferences(next);
}

function knownFromProfile(field: FinderField, p: Preferences): string | null {
  switch (field) {
    case 'area':
      return p.area === 'skin' || p.area === 'hair'
        ? `You’re shopping for ${p.area}`
        : null;
    case 'goal':
      return p.goals.length
        ? `Your goal: ${p.goals.map((g) => GOAL_LABELS[g]).join('; ')}`
        : null;
    case 'skinType':
      return p.skinType && p.skinType !== 'not-sure'
        ? `${SKIN_TYPE_LABELS[p.skinType]} skin`
        : null;
    case 'hairType':
      return p.hairType && p.hairType !== 'not-sure'
        ? `${HAIR_TYPE_LABELS[p.hairType]} hair`
        : null;
    case 'budget':
      return p.budget.maxPence !== null
        ? `Up to ${formatPrice(p.budget.maxPence)} per product (${p.budget.strict ? 'strict' : 'flexible'})`
        : null;
    case 'texture':
      return p.texture === 'light' || p.texture === 'medium' || p.texture === 'rich'
        ? `${TEXTURE_LABELS[p.texture]} texture`
        : null;
    case 'fragrance':
      return p.fragrance && p.fragrance !== 'no-preference'
        ? p.fragrance === 'unscented-only'
          ? 'Unscented products only'
          : p.fragrance === 'prefer-unscented'
            ? 'Prefer no added scent'
            : 'Enjoys natural scents'
        : null;
    case 'category':
      return null;
  }
}

function answered(field: FinderField, a: FinderAnswers): boolean {
  if (a.skipped?.includes(field)) return true;
  switch (field) {
    case 'budget':
      return a.budgetMax !== undefined;
    default:
      return a[field] !== undefined;
  }
}

function countBy(
  products: Product[],
  values: string[],
  has: (p: Product, value: string) => boolean,
): FinderOption[] {
  return values
    .map((value) => ({
      value,
      label: value,
      count: products.filter((p) => has(p, value)).length,
    }))
    .filter((o) => o.count > 0);
}

function optionsFor(field: FinderField, products: Product[]): FinderOption[] {
  const distinct = <T extends string>(xs: (T | null | undefined)[]) =>
    [...new Set(xs.filter((x): x is T => !!x))];
  switch (field) {
    case 'area':
      return countBy(products, ['skin', 'hair'], (p, v) =>
        p.areas.includes(v as Area),
      ).map((o) => ({ ...o, label: o.value === 'skin' ? 'Skin' : 'Hair' }));
    case 'category':
      return countBy(
        products,
        distinct(products.map((p) => p.category)),
        (p, v) => p.category === v,
      ).map((o) => ({ ...o, label: CATEGORY_LABELS[o.value as Category] }));
    case 'goal':
      return countBy(
        products,
        distinct(products.flatMap((p) => p.goals)),
        (p, v) => p.goals.includes(v as Goal),
      ).map((o) => ({
        ...o,
        label: capitalise(GOAL_LABELS[o.value as Goal]),
      }));
    case 'skinType': {
      const skin = products.filter((p) => p.skinTypes);
      return countBy(
        skin,
        ['dry', 'normal', 'combination', 'oily'],
        (p, v) => p.skinTypes!.includes(v as SkinType),
      ).map((o) => ({ ...o, label: SKIN_TYPE_LABELS[o.value as SkinType] }));
    }
    case 'hairType': {
      const hair = products.filter((p) => p.hairTypes);
      return countBy(hair, ['fine', 'medium', 'thick'], (p, v) =>
        p.hairTypes!.includes(v as HairType),
      ).map((o) => ({ ...o, label: HAIR_TYPE_LABELS[o.value as HairType] }));
    }
    case 'budget':
      return countBy(
        products,
        BUDGET_STEPS.map(String),
        (p, v) => p.pricePence <= Number(v),
      ).map((o) => ({ ...o, label: `Up to ${formatPrice(Number(o.value))}` }));
    case 'texture':
      return countBy(
        products,
        ['light', 'medium', 'rich'],
        (p, v) => p.texture === v,
      ).map((o) => ({
        ...o,
        label: TEXTURE_LABELS[o.value as 'light' | 'medium' | 'rich'],
      }));
    case 'fragrance': {
      const unscented = products.filter((p) => p.fragrance === 'unscented').length;
      return [
        {
          value: 'unscented-only',
          label: 'Yes — no added scent',
          count: unscented,
        },
        {
          value: 'no-preference',
          label: 'No, scent is fine',
          count: products.length,
        },
      ].filter((o) => o.count > 0);
    }
  }
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * How well a question splits the candidates: 0 means every option keeps every
 * product (useless); higher means the answer will narrow the choice more.
 */
function splitValue(options: FinderOption[], total: number): number {
  const narrowing = options.filter((o) => o.count < total);
  if (options.length < 2 || !narrowing.length) return 0;
  const largest = Math.max(...options.map((o) => o.count));
  return 1 - largest / total + narrowing.length / 100;
}

export function finderState(
  saved: Preferences | null,
  answers: FinderAnswers,
  ignoreSaved: boolean,
): FinderState {
  const working = workingPreferences(saved, answers, ignoreSaved);
  // Finder answers narrow the list (matching the counts shown on each option);
  // saved preferences only rank it, apart from their strict limits.
  const candidates = recommend(working).ranked.filter(({ product: p }) => {
    if (answers.category && p.category !== answers.category) return false;
    if (answers.goal && !p.goals.includes(answers.goal)) return false;
    if (answers.skinType && !p.skinTypes?.includes(answers.skinType)) return false;
    if (answers.hairType && !p.hairTypes?.includes(answers.hairType)) return false;
    if (answers.texture && p.texture !== answers.texture) return false;
    return true;
  });

  const profile = ignoreSaved || !saved ? EMPTY_PREFERENCES : saved;
  const reused = ORDER.flatMap((field) => {
    const text = knownFromProfile(field, profile);
    return text && !answered(field, answers) ? [{ field, text }] : [];
  });

  const asked = ORDER.filter((f) => answered(f, answers)).length;

  let question: FinderQuestion | null = null;
  if (candidates.length > ENOUGH_CANDIDATES && asked < MAX_QUESTIONS) {
    const products = candidates.map((c) => c.product);
    let best = 0;
    for (const field of ORDER) {
      if (answered(field, answers) || knownFromProfile(field, working)) continue;
      if (field === 'skinType' && working.area === 'hair') continue;
      if (field === 'hairType' && working.area === 'skin') continue;
      const options = optionsFor(field, products);
      const value = splitValue(options, products.length);
      if (value > best) {
        best = value;
        question = { field, ...PROMPTS[field], options };
      }
    }
  }

  return { working, candidates, question, done: question === null, reused };
}

/** Apply one option to the answers. */
export function answer(
  answers: FinderAnswers,
  field: FinderField,
  value: string | null,
): FinderAnswers {
  const next: FinderAnswers = { ...answers, skipped: [...(answers.skipped ?? [])] };
  if (value === null) {
    next.skipped!.push(field);
    return next;
  }
  switch (field) {
    case 'budget':
      next.budgetMax = Number(value);
      break;
    case 'area':
      next.area = value as Area;
      break;
    case 'category':
      next.category = value as Category;
      break;
    case 'goal':
      next.goal = value as Goal;
      break;
    case 'skinType':
      next.skinType = value as SkinType;
      break;
    case 'hairType':
      next.hairType = value as HairType;
      break;
    case 'texture':
      next.texture = value as FinderAnswers['texture'];
      break;
    case 'fragrance':
      next.fragrance = value as FinderAnswers['fragrance'];
      break;
  }
  return next;
}

/**
 * Finder answers that would change the saved profile if the customer chose to
 * save them. Category is finder-only and never saved.
 */
export function profileChanges(
  saved: Preferences | null,
  answers: FinderAnswers,
): { field: keyof Preferences; text: string }[] {
  const s = saved ?? EMPTY_PREFERENCES;
  const changes: { field: keyof Preferences; text: string }[] = [];
  if (answers.area && s.area !== answers.area)
    changes.push({ field: 'area', text: `Shopping for: ${answers.area}` });
  if (answers.goal && !(s.goals.length === 1 && s.goals[0] === answers.goal))
    changes.push({
      field: 'goals',
      text: `Goal: ${GOAL_LABELS[answers.goal]}`,
    });
  if (answers.skinType && s.skinType !== answers.skinType)
    changes.push({
      field: 'skinType',
      text: `Skin: ${SKIN_TYPE_LABELS[answers.skinType]}`,
    });
  if (answers.hairType && s.hairType !== answers.hairType)
    changes.push({
      field: 'hairType',
      text: `Hair: ${HAIR_TYPE_LABELS[answers.hairType]}`,
    });
  if (answers.texture && s.texture !== answers.texture)
    changes.push({
      field: 'texture',
      text: `Texture: ${TEXTURE_LABELS[answers.texture]}`,
    });
  if (answers.fragrance && s.fragrance !== answers.fragrance)
    changes.push({
      field: 'fragrance',
      text:
        answers.fragrance === 'unscented-only'
          ? 'Scent: unscented only'
          : 'Scent: no preference',
    });
  if (
    answers.budgetMax !== undefined &&
    (s.budget.maxPence !== answers.budgetMax || !s.budget.strict)
  )
    changes.push({
      field: 'budget',
      text: `Budget: up to ${formatPrice(answers.budgetMax)} per product (strict)`,
    });
  return changes;
}

/** The saved profile with the finder answers written into it. */
export function applyFinderAnswers(
  saved: Preferences | null,
  answers: FinderAnswers,
): Preferences {
  return workingPreferences(saved, answers, false);
}
