// Customer preference profile: types, option definitions, validation and
// normalisation. Shared by the questionnaire, finder, recommendation engine
// and assistant so that every part of the site reads preferences the same way.
//
// Conventions:
//   null           -> the question has not been answered
//   'not-sure'     -> the customer answered that they do not know
//   'no-preference'-> the customer is happy with any option

import {
  GOAL_AREA,
  INGREDIENTS,
  type Goal,
  type HairType,
  type IngredientId,
  type IngredientTag,
  type SkinType,
} from './catalogue.ts';

export type AreaChoice = 'skin' | 'hair' | 'both' | 'not-sure';
export type FragranceChoice =
  | 'unscented-only'
  | 'prefer-unscented'
  | 'prefer-scented'
  | 'no-preference';
export type TextureChoice =
  | 'light'
  | 'medium'
  | 'rich'
  | 'no-preference'
  | 'not-sure';
export type RoutineChoice = 'simple' | 'fuller' | 'no-preference';

export interface Budget {
  /** Maximum price per product in pence; null means no limit. */
  maxPence: number | null;
  /** Strict budgets exclude products above the limit; flexible ones only rank them lower. */
  strict: boolean;
}

export interface Preferences {
  area: AreaChoice | null;
  goals: Goal[];
  goalsNotSure: boolean;
  skinType: SkinType | 'not-sure' | null;
  hairType: HairType | 'not-sure' | null;
  /** Hard constraints: products containing a tagged ingredient are never recommended. */
  exclude: IngredientTag[];
  /** Soft preferences: products containing these rank higher. */
  likes: IngredientId[];
  fragrance: FragranceChoice | null;
  texture: TextureChoice | null;
  budget: Budget;
  routine: RoutineChoice | null;
}

export const EMPTY_PREFERENCES: Preferences = {
  area: null,
  goals: [],
  goalsNotSure: false,
  skinType: null,
  hairType: null,
  exclude: [],
  likes: [],
  fragrance: null,
  texture: null,
  budget: { maxPence: null, strict: false },
  routine: null,
};

export const MAX_GOALS = 2;

// ---------- Option lists used by forms ----------

export const AREA_OPTIONS: { value: AreaChoice; label: string; hint: string }[] =
  [
    { value: 'skin', label: 'Skin', hint: 'Face and body care' },
    { value: 'hair', label: 'Hair', hint: 'Hair and scalp oils' },
    { value: 'both', label: 'Both', hint: 'Show skin and hair products' },
    { value: 'not-sure', label: 'Not sure yet', hint: 'We’ll show both' },
  ];

export const SKIN_TYPE_OPTIONS: {
  value: SkinType | 'not-sure';
  label: string;
  hint: string;
}[] = [
  { value: 'dry', label: 'Dry', hint: 'Often feels tight or rough' },
  { value: 'normal', label: 'Normal', hint: 'Rarely feels tight or shiny' },
  {
    value: 'combination',
    label: 'Combination',
    hint: 'Shiny in some areas, dry in others',
  },
  { value: 'oily', label: 'Oily', hint: 'Often looks shiny' },
  { value: 'not-sure', label: 'Not sure', hint: '' },
];

export const HAIR_TYPE_OPTIONS: {
  value: HairType | 'not-sure';
  label: string;
  hint: string;
}[] = [
  { value: 'fine', label: 'Fine', hint: 'Individual strands feel thin' },
  { value: 'medium', label: 'Medium', hint: 'Neither fine nor coarse' },
  {
    value: 'thick',
    label: 'Thick or coarse',
    hint: 'Strands feel thick; hair is often dense or curly',
  },
  { value: 'not-sure', label: 'Not sure', hint: '' },
];

export const EXCLUSION_OPTIONS: {
  value: IngredientTag;
  label: string;
  hint: string;
}[] = [
  {
    value: 'essential-oil',
    label: 'Essential oils',
    hint: 'Concentrated plant oils used for scent, such as rose, lavender, rosemary and tea tree',
  },
  { value: 'tea-tree', label: 'Tea tree oil', hint: '' },
  {
    value: 'nut',
    label: 'Nut-derived oils and butters',
    hint: 'Argan, sweet almond and shea',
  },
  { value: 'coconut', label: 'Coconut', hint: '' },
  { value: 'sesame', label: 'Sesame', hint: '' },
  {
    value: 'mustard-family',
    label: 'Mustard-family oils',
    hint: 'Includes rocket (taramira) seed oil',
  },
];

export const LIKEABLE_INGREDIENTS: IngredientId[] = [
  'rose',
  'argan',
  'rocket',
  'tea-tree',
  'jojoba',
  'rosehip',
  'coconut',
  'rosemary',
  'shea',
];

export const FRAGRANCE_OPTIONS: {
  value: FragranceChoice;
  label: string;
  hint: string;
}[] = [
  {
    value: 'unscented-only',
    label: 'No added scent — only show me unscented products',
    hint: 'Products with essential oils or unconfirmed scent are left out',
  },
  {
    value: 'prefer-unscented',
    label: 'I’d prefer no added scent',
    hint: 'Scented products are still shown, ranked lower',
  },
  {
    value: 'prefer-scented',
    label: 'I enjoy natural scents',
    hint: 'Products scented with essential oils rank higher',
  },
  { value: 'no-preference', label: 'No preference', hint: '' },
];

export const TEXTURE_OPTIONS: {
  value: TextureChoice;
  label: string;
  hint: string;
}[] = [
  { value: 'light', label: 'Light', hint: 'Absorbs quickly and feels thin' },
  {
    value: 'medium',
    label: 'Medium',
    hint: 'Smooth, takes a little longer to absorb',
  },
  { value: 'rich', label: 'Rich', hint: 'Thick and cushiony, slow to absorb' },
  { value: 'no-preference', label: 'No preference', hint: '' },
  { value: 'not-sure', label: 'Not sure', hint: '' },
];

export const ROUTINE_OPTIONS: {
  value: RoutineChoice;
  label: string;
  hint: string;
}[] = [
  {
    value: 'simple',
    label: 'Keep it simple',
    hint: 'One or two products, ideally multi-use',
  },
  {
    value: 'fuller',
    label: 'I’m happy with a fuller routine',
    hint: 'Separate products for different steps',
  },
  { value: 'no-preference', label: 'No preference', hint: '' },
];

// ---------- Validation and normalisation ----------

const AREA_VALUES = AREA_OPTIONS.map((o) => o.value);
const SKIN_VALUES = SKIN_TYPE_OPTIONS.map((o) => o.value);
const HAIR_VALUES = HAIR_TYPE_OPTIONS.map((o) => o.value);
const TAG_VALUES = EXCLUSION_OPTIONS.map((o) => o.value);
const FRAGRANCE_VALUES = FRAGRANCE_OPTIONS.map((o) => o.value);
const TEXTURE_VALUES = TEXTURE_OPTIONS.map((o) => o.value);
const ROUTINE_VALUES = ROUTINE_OPTIONS.map((o) => o.value);
const GOAL_VALUES = Object.keys(GOAL_AREA) as Goal[];

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function pickMany<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const result: T[] = [];
  for (const item of value) {
    const valid = pick(item, allowed);
    if (valid && !result.includes(valid)) result.push(valid);
  }
  return result;
}

export const MAX_BUDGET_PENCE = 100_000;

/** Area values that mean the customer wants a given part of the routine. */
export function wantsArea(prefs: Preferences, area: 'skin' | 'hair'): boolean {
  return prefs.area === null || prefs.area === 'both' || prefs.area === 'not-sure'
    ? true
    : prefs.area === area;
}

/**
 * Turns untrusted input (local storage, request bodies, finder answers) into a
 * valid profile. Unknown values are dropped, never guessed. Answers that do not
 * apply to the chosen area (e.g. hair type for a skin-only profile) are cleared.
 */
export function normalisePreferences(input: unknown): Preferences {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<
    string,
    unknown
  >;
  const area = pick(raw.area, AREA_VALUES);
  const base: Preferences = {
    area,
    goals: pickMany(raw.goals, GOAL_VALUES),
    goalsNotSure: raw.goalsNotSure === true,
    skinType: pick(raw.skinType, SKIN_VALUES),
    hairType: pick(raw.hairType, HAIR_VALUES),
    exclude: pickMany(raw.exclude, TAG_VALUES),
    likes: pickMany(raw.likes, LIKEABLE_INGREDIENTS),
    fragrance: pick(raw.fragrance, FRAGRANCE_VALUES),
    texture: pick(raw.texture, TEXTURE_VALUES),
    budget: { maxPence: null, strict: false },
    routine: pick(raw.routine, ROUTINE_VALUES),
  };

  const budget = (raw.budget && typeof raw.budget === 'object'
    ? raw.budget
    : {}) as Record<string, unknown>;
  const max = budget.maxPence;
  if (typeof max === 'number' && Number.isFinite(max) && max > 0) {
    base.budget.maxPence = Math.min(Math.round(max), MAX_BUDGET_PENCE);
    base.budget.strict = budget.strict === true;
  }

  base.goals = base.goals
    .filter((g) => wantsArea(base, GOAL_AREA[g]))
    .slice(0, MAX_GOALS);
  if (base.goals.length) base.goalsNotSure = false;
  if (!wantsArea(base, 'skin')) base.skinType = null;
  if (!wantsArea(base, 'hair')) base.hairType = null;
  return base;
}

export interface PreferenceIssue {
  field: keyof Preferences;
  message: string;
}

/** Contradictions the customer must resolve; never silently fixed. */
export function findConflicts(prefs: Preferences): PreferenceIssue[] {
  const issues: PreferenceIssue[] = [];
  for (const like of prefs.likes) {
    const tags = INGREDIENTS[like].tags as readonly IngredientTag[];
    const clash = tags.find((t) => prefs.exclude.includes(t));
    if (clash) {
      const exclusion = EXCLUSION_OPTIONS.find((o) => o.value === clash)!;
      issues.push({
        field: 'likes',
        message: `You chose ${INGREDIENTS[like].name.toLowerCase()} as an ingredient you like, but you also excluded ${exclusion.label.toLowerCase()}, which includes it. Remove one of these.`,
      });
    }
  }
  if (prefs.fragrance === 'unscented-only') {
    const scented = prefs.likes.filter((l) =>
      (INGREDIENTS[l].tags as readonly IngredientTag[]).includes('essential-oil'),
    );
    if (scented.length) {
      issues.push({
        field: 'fragrance',
        message: `You asked for unscented products only, but you also like ${scented
          .map((s) => INGREDIENTS[s].name.toLowerCase())
          .join(' and ')}, which ${scented.length > 1 ? 'are essential oils' : 'is an essential oil'} used for scent. Change one of these answers.`,
      });
    }
  }
  return issues;
}

/** True when the profile contains at least one answer. */
export function hasAnswers(prefs: Preferences | null): prefs is Preferences {
  if (!prefs) return false;
  return (
    prefs.area !== null ||
    prefs.goals.length > 0 ||
    prefs.goalsNotSure ||
    prefs.skinType !== null ||
    prefs.hairType !== null ||
    prefs.exclude.length > 0 ||
    prefs.likes.length > 0 ||
    prefs.fragrance !== null ||
    prefs.texture !== null ||
    prefs.budget.maxPence !== null ||
    prefs.routine !== null
  );
}

/** Names of fields whose values differ, for "results updated" messages and events. */
export function changedFields(
  before: Preferences | null,
  after: Preferences | null,
): (keyof Preferences)[] {
  const a = before ?? EMPTY_PREFERENCES;
  const b = after ?? EMPTY_PREFERENCES;
  return (Object.keys(EMPTY_PREFERENCES) as (keyof Preferences)[]).filter(
    (key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]),
  );
}

export const FIELD_LABELS: Record<keyof Preferences, string> = {
  area: 'What you’re shopping for',
  goals: 'Main goals',
  goalsNotSure: 'Main goals',
  skinType: 'Skin type',
  hairType: 'Hair type',
  exclude: 'Ingredients to avoid',
  likes: 'Ingredients you like',
  fragrance: 'Scent',
  texture: 'Texture',
  budget: 'Budget per product',
  routine: 'Routine',
};
