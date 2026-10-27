'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { CATEGORY_LABELS, PRODUCTS, TAG_LABELS, formatPrice, type Category, type IngredientTag } from '@/lib/catalogue.ts';
import { compareFits, evaluateProduct, type ProductFit } from '@/lib/recommend.ts';
import {
  EMPTY_FILTERS,
  PRICE_STEPS,
  SORT_LABELS,
  activeFilters,
  filterProducts,
  filtersToParams,
  parseFilters,
  sortProducts,
  type Filters,
  type SortKey,
} from '@/lib/search.ts';
import { ProductCard } from '@/components/product-ui';
import { useActivePrefs, useStore } from '@/components/store';

export function ShopClient() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = parseFilters(new URLSearchParams(params.toString()));
  const prefs = useActivePrefs();
  const { track } = useStore();
  const [query, setQuery] = useState(filters.q);
  const [showFilters, setShowFilters] = useState(false);

  const update = (next: Filters) => {
    const qs = filtersToParams(next).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // Study log: counts and filter names only, never the search text itself.
    const resultCount = filterProducts(PRODUCTS, next).products.length;
    if (next.q !== filters.q && next.q)
      track('search', { detail: { resultCount, queryLength: next.q.length } });
    else
      track('filter_change', {
        detail: { filters: activeFilters(next).map((c) => c.key).join(','), sort: next.sort, resultCount },
      });
  };

  // Keep the search box in step with the URL (e.g. after "Clear all" or back navigation).
  const [urlQuery, setUrlQuery] = useState(filters.q);
  if (urlQuery !== filters.q) {
    setUrlQuery(filters.q);
    setQuery(filters.q);
  }

  const usePrefs = !!prefs;
  const effectiveSort: SortKey = filters.sort === 'match' && !usePrefs ? 'featured' : filters.sort;
  const { products: filtered, hiddenUnknownIngredients } = filterProducts(PRODUCTS, filters);
  let fits: ProductFit[] | null = usePrefs ? filtered.map((p) => evaluateProduct(p, prefs)) : null;
  if (fits && filters.fit) fits = fits.filter((f) => f.eligible);
  if (fits && effectiveSort === 'match') fits = [...fits].sort(compareFits);
  const shown = fits ? (effectiveSort === 'match' ? fits.map((f) => f.product) : sortProducts(fits.map((f) => f.product), effectiveSort)) : sortProducts(filtered, effectiveSort);
  const fitById = new Map(fits?.map((f) => [f.product.id, f]));
  const hiddenByPrefs = usePrefs && filters.fit ? filtered.length - shown.length : 0;
  const chips = activeFilters(filters);

  const toggleTag = (tag: IngredientTag) =>
    update({
      ...filters,
      without: filters.without.includes(tag) ? filters.without.filter((t) => t !== tag) : [...filters.without, tag],
    });

  const title = filters.category
    ? CATEGORY_LABELS[filters.category]
    : filters.area
      ? `${filters.area === 'skin' ? 'Skin' : 'Hair'} care`
      : 'All products';

  return (
    <div className="page shop">
      <div className="page-head">
        <h1>{title}</h1>
        <search>
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            update({ ...filters, q: query });
          }}
        >
          <label htmlFor="shop-search">Search products</label>
          <div className="search-row">
            <input
              id="shop-search"
              type="search"
              value={query}
              placeholder="Search oils, ingredients…"
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value === '') update({ ...filters, q: '' });
              }}
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </div>
        </form>
        </search>
      </div>

      <div className="shop-layout">
        <button
          type="button"
          className="btn btn-secondary filters-toggle"
          aria-expanded={showFilters}
          aria-controls="filters"
          onClick={() => setShowFilters((s) => !s)}
        >
          <SlidersHorizontal size={16} aria-hidden="true" /> Filters{chips.length ? ` (${chips.length})` : ''}
        </button>
        <aside id="filters" className={`filters${showFilters ? ' open' : ''}`} aria-label="Filters">
          <fieldset>
            <legend>For</legend>
            {(['skin', 'hair'] as const).map((a) => (
              <label key={a} className="option">
                <input
                  type="radio"
                  name="area"
                  checked={filters.area === a}
                  onChange={() => update({ ...filters, area: a })}
                />
                {a === 'skin' ? 'Skin' : 'Hair'}
              </label>
            ))}
            <label className="option">
              <input type="radio" name="area" checked={!filters.area} onChange={() => update({ ...filters, area: null })} />
              Skin and hair
            </label>
          </fieldset>

          <div className="field">
            <label htmlFor="f-category">Category</label>
            <select
              id="f-category"
              value={filters.category ?? ''}
              onChange={(e) => update({ ...filters, category: (e.target.value || null) as Category | null })}
            >
              <option value="">All categories</option>
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-max">Maximum price per product</label>
            <select
              id="f-max"
              value={filters.maxPence ?? ''}
              onChange={(e) => update({ ...filters, maxPence: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Any price</option>
              {PRICE_STEPS.map((p) => (
                <option key={p} value={p}>
                  Up to {formatPrice(p)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-scent">Scent</label>
            <select
              id="f-scent"
              value={filters.scent ?? ''}
              onChange={(e) => update({ ...filters, scent: (e.target.value || null) as Filters['scent'] })}
            >
              <option value="">Any</option>
              <option value="unscented">No added scent</option>
              <option value="essential-oils">Scented with essential oils</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-texture">Texture</label>
            <select
              id="f-texture"
              value={filters.texture ?? ''}
              onChange={(e) => update({ ...filters, texture: (e.target.value || null) as Filters['texture'] })}
            >
              <option value="">Any</option>
              <option value="light">Light (absorbs quickly)</option>
              <option value="medium">Medium</option>
              <option value="rich">Rich (thick, slow to absorb)</option>
            </select>
          </div>

          <fieldset>
            <legend>Without</legend>
            {(Object.keys(TAG_LABELS) as IngredientTag[]).map((tag) => (
              <label key={tag} className="option">
                <input type="checkbox" checked={filters.without.includes(tag)} onChange={() => toggleTag(tag)} />
                {TAG_LABELS[tag]}
              </label>
            ))}
            <p className="hint">Also hides products with unconfirmed ingredients.</p>
          </fieldset>

          <label className="option">
            <input type="checkbox" checked={filters.inStock} onChange={() => update({ ...filters, inStock: !filters.inStock })} />
            In stock only
          </label>

          {usePrefs && (
            <label className="option">
              <input type="checkbox" checked={filters.fit} onChange={() => update({ ...filters, fit: !filters.fit })} />
              Only products that fit my saved preferences
            </label>
          )}
        </aside>

        <section className="results" aria-labelledby="results-heading">
          <h2 id="results-heading" className="sr-only">
            Results
          </h2>
          <div className="results-bar">
            <p aria-live="polite" aria-atomic="true">
              <strong>{shown.length}</strong> of {PRODUCTS.length} products
              {chips.length ? ' match your filters' : ''}
            </p>
            <div className="field inline">
              <label htmlFor="f-sort">Sort by</label>
              <select id="f-sort" value={effectiveSort} onChange={(e) => update({ ...filters, sort: e.target.value as SortKey })}>
                {(Object.keys(SORT_LABELS) as SortKey[])
                  .filter((s) => s !== 'match' || usePrefs)
                  .map((s) => (
                    <option key={s} value={s}>
                      {SORT_LABELS[s]}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="active-filters">
              <span id="active-label">Active filters:</span>
              <ul aria-labelledby="active-label">
                {chips.map((chip) => (
                  <li key={chip.key}>
                    <button type="button" onClick={() => update(chip.without)}>
                      {chip.label} <X size={13} aria-hidden="true" />
                      <span className="sr-only">, remove</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="link-button" onClick={() => update({ ...EMPTY_FILTERS, sort: filters.sort })}>
                Clear all
              </button>
            </div>
          )}

          {(hiddenUnknownIngredients > 0 || hiddenByPrefs > 0) && (
            <p className="hint notice">
              {hiddenUnknownIngredients > 0 &&
                `${hiddenUnknownIngredients} product${hiddenUnknownIngredients > 1 ? 's are' : ' is'} hidden because ${hiddenUnknownIngredients > 1 ? 'their' : 'its'} ingredients aren’t confirmed. `}
              {hiddenByPrefs > 0 && `${hiddenByPrefs} hidden because they don’t fit your saved preferences.`}
            </p>
          )}


          {shown.length ? (
            <div className="grid">
              {shown.map((p) => (
                <ProductCard key={p.id} product={p} fit={fitById.get(p.id) ?? null} headingLevel={3} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h3>No products match</h3>
              <p>
                {filters.q
                  ? `Nothing matches “${filters.q}” with the current filters. Check the spelling or try a broader word such as “oil” or “hair”.`
                  : 'No products match all of these filters. Try removing one.'}
              </p>
              <button type="button" className="btn btn-secondary" onClick={() => update(EMPTY_FILTERS)}>
                Clear all filters
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
