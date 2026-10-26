// Conventional catalogue search, filtering and sorting. Filters live in the URL
// so results are shareable and the back button restores them. Every filter is
// backed by a real catalogue field.

import {
  CATEGORY_LABELS,
  FRAGRANCE_LABELS,
  GOAL_LABELS,
  INGREDIENTS,
  TAG_LABELS,
  TEXTURE_LABELS,
  formatPrice,
  ingredientsWithTag,
  pricePer100,
  type Area,
  type Category,
  type Fragrance,
  type IngredientTag,
  type Product,
} from './catalogue.ts';

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'per100' | 'name' | 'match';

export interface Filters {
  q: string;
  area: Area | null;
  category: Category | null;
  maxPence: number | null;
  scent: Fragrance | null;
  texture: 'light' | 'medium' | 'rich' | null;
  without: IngredientTag[];
  inStock: boolean;
  sort: SortKey;
  /** Only products that fit the saved preference profile (assisted experience). */
  fit: boolean;
}

export const PRICE_STEPS = [1000, 1500, 2000, 2500];
export const SORT_LABELS: Record<SortKey, string> = {
  featured: 'Featured',
  match: 'Best match for my preferences',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  per100: 'Price per 100 ml or g',
  name: 'Name A–Z',
};

const AREAS: Area[] = ['skin', 'hair'];
const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];
const TAGS = Object.keys(TAG_LABELS) as IngredientTag[];
const SORTS = Object.keys(SORT_LABELS) as SortKey[];

function one<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseFilters(params: URLSearchParams): Filters {
  const max = Number(params.get('max'));
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    area: one(params.get('area'), AREAS),
    category: one(params.get('category'), CATEGORIES),
    maxPence: PRICE_STEPS.includes(max) ? max : null,
    scent: one(params.get('scent'), ['unscented', 'essential-oils'] as const),
    texture: one(params.get('texture'), ['light', 'medium', 'rich'] as const),
    without: (params.get('without') ?? '')
      .split(',')
      .filter((t): t is IngredientTag => (TAGS as string[]).includes(t)),
    inStock: params.get('stock') === '1',
    sort: one(params.get('sort'), SORTS) ?? 'featured',
    fit: params.get('fit') === '1',
  };
}

export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.area) p.set('area', f.area);
  if (f.category) p.set('category', f.category);
  if (f.maxPence) p.set('max', String(f.maxPence));
  if (f.scent) p.set('scent', f.scent);
  if (f.texture) p.set('texture', f.texture);
  if (f.without.length) p.set('without', f.without.join(','));
  if (f.inStock) p.set('stock', '1');
  if (f.sort !== 'featured') p.set('sort', f.sort);
  if (f.fit) p.set('fit', '1');
  return p;
}

function searchText(p: Product): string {
  return [
    p.name,
    p.summary,
    p.description,
    CATEGORY_LABELS[p.category],
    p.areas.join(' '),
    ...p.goals.map((g) => GOAL_LABELS[g]),
    ...(p.ingredients ?? []).flatMap((i) => [INGREDIENTS[i].name, INGREDIENTS[i].inci]),
    ...(p.setContents ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

const INDEX = new Map<string, string>();

export function matchesQuery(p: Product, q: string): boolean {
  const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return true;
  let text = INDEX.get(p.id);
  if (!text) {
    text = searchText(p);
    INDEX.set(p.id, text);
  }
  return terms.every((t) => text.includes(t));
}

export interface FilterResult {
  products: Product[];
  /** Products hidden by "without" filters only because their ingredients are unconfirmed. */
  hiddenUnknownIngredients: number;
}

export function filterProducts(products: Product[], f: Filters): FilterResult {
  let hiddenUnknownIngredients = 0;
  const result = products.filter((p) => {
    if (!matchesQuery(p, f.q)) return false;
    if (f.area && !p.areas.includes(f.area)) return false;
    if (f.category && p.category !== f.category) return false;
    if (f.maxPence !== null && p.pricePence > f.maxPence) return false;
    if (f.scent && p.fragrance !== f.scent) return false;
    if (f.texture && p.texture !== f.texture) return false;
    if (f.inStock && p.availability !== 'in-stock' && p.availability !== 'low-stock') return false;
    if (f.without.length) {
      if (!p.ingredients) {
        hiddenUnknownIngredients++;
        return false;
      }
      if (f.without.some((tag) => (ingredientsWithTag(p, tag) ?? []).length > 0)) return false;
    }
    return true;
  });
  return { products: result, hiddenUnknownIngredients };
}

export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const list = [...products];
  switch (sort) {
    case 'price-asc':
      return list.sort((a, b) => a.pricePence - b.pricePence || a.id.localeCompare(b.id));
    case 'price-desc':
      return list.sort((a, b) => b.pricePence - a.pricePence || a.id.localeCompare(b.id));
    case 'per100':
      return list.sort(
        (a, b) =>
          a.size.unit.localeCompare(b.size.unit) ||
          pricePer100(a) - pricePer100(b) ||
          a.id.localeCompare(b.id),
      );
    case 'name':
      return list.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return list;
  }
}

/** Human-readable active filters, each with the params that remove it. */
export function activeFilters(f: Filters): { key: string; label: string; without: Filters }[] {
  const chips: { key: string; label: string; without: Filters }[] = [];
  if (f.q.trim()) chips.push({ key: 'q', label: `Search: “${f.q.trim()}”`, without: { ...f, q: '' } });
  if (f.area)
    chips.push({ key: 'area', label: f.area === 'skin' ? 'Skin' : 'Hair', without: { ...f, area: null } });
  if (f.category)
    chips.push({ key: 'category', label: CATEGORY_LABELS[f.category], without: { ...f, category: null } });
  if (f.maxPence)
    chips.push({ key: 'max', label: `Up to ${formatPrice(f.maxPence)}`, without: { ...f, maxPence: null } });
  if (f.scent) chips.push({ key: 'scent', label: FRAGRANCE_LABELS[f.scent], without: { ...f, scent: null } });
  if (f.texture)
    chips.push({ key: 'texture', label: `${TEXTURE_LABELS[f.texture]} texture`, without: { ...f, texture: null } });
  for (const tag of f.without)
    chips.push({
      key: `without-${tag}`,
      label: `Without ${TAG_LABELS[tag].toLowerCase()}`,
      without: { ...f, without: f.without.filter((t) => t !== tag) },
    });
  if (f.inStock) chips.push({ key: 'stock', label: 'In stock only', without: { ...f, inStock: false } });
  if (f.fit) chips.push({ key: 'fit', label: 'Fits my preferences', without: { ...f, fit: false } });
  return chips;
}

export const EMPTY_FILTERS: Filters = parseFilters(new URLSearchParams());
