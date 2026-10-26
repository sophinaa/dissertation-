'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import {
  CATEGORY_LABELS,
  GOAL_LABELS,
  HAIR_TYPE_LABELS,
  INGREDIENTS,
  SKIN_TYPE_LABELS,
  TEXTURE_LABELS,
  formatPrice,
  formatPricePer100,
  formatSize,
  getProduct,
  pricePer100,
  productAreasLabel,
  scentText,
  type Product,
} from '@/lib/catalogue.ts';
import { evaluateProduct, headline } from '@/lib/recommend.ts';
import { AddToBasketButton, AvailabilityBadge, DemoNotice } from '@/components/product-ui';
import { MAX_COMPARE, useActivePrefs, useStore } from '@/components/store';

const NS = 'Not specified';

function differences(products: Product[]): string[] {
  const notes: string[] = [];
  const cheapest = [...products].sort((a, b) => a.pricePence - b.pricePence)[0];
  if (products.some((p) => p.pricePence !== cheapest.pricePence))
    notes.push(`Lowest price: ${cheapest.name} (${formatPrice(cheapest.pricePence)}).`);
  const units = new Set(products.map((p) => p.size.unit));
  if (units.size === 1) {
    const best = [...products].sort((a, b) => pricePer100(a) - pricePer100(b))[0];
    if (products.some((p) => pricePer100(p) !== pricePer100(best)))
      notes.push(`Lowest price per 100 ${best.size.unit}: ${best.name} (${formatPricePer100(best)}).`);
  } else {
    notes.push('Some items are sold by weight (g) and others by volume (ml), so price per unit isn’t directly comparable.');
  }
  const textures = new Set(products.map((p) => p.texture));
  if (textures.size > 1) notes.push('They differ in texture.');
  const scents = new Set(products.map((p) => p.fragrance));
  if (scents.size > 1) notes.push('They differ in scent: check the Scent row.');
  const sameIngredients =
    products.every((p) => p.ingredients) &&
    new Set(products.map((p) => [...p.ingredients!].sort().join())).size === 1;
  if (sameIngredients) notes.push('They have the same ingredients — the difference is size and price.');
  if (products.some((p) => !p.ingredients)) notes.push('At least one product’s ingredients aren’t confirmed.');
  return notes;
}

export function CompareClient() {
  const { compare, toggleCompare, clearCompare, announce } = useStore();
  const prefs = useActivePrefs();
  const products = compare.map(getProduct).filter((p): p is Product => !!p);

  if (!products.length) {
    return (
      <div className="page narrow">
        <h1>Compare products</h1>
        <div className="empty">
          <p>You haven’t chosen anything to compare yet. Select “Compare” on up to {MAX_COMPARE} products.</p>
          <Link href="/shop" className="btn btn-primary">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  const rows: { label: string; cell: (p: Product) => React.ReactNode }[] = [
    { label: 'Price', cell: (p) => <strong>{formatPrice(p.pricePence)}</strong> },
    { label: 'Size', cell: (p) => formatSize(p) },
    { label: 'Price per 100', cell: (p) => formatPricePer100(p) },
    { label: 'Category', cell: (p) => `${CATEGORY_LABELS[p.category]} · ${productAreasLabel(p)}` },
    { label: 'Availability', cell: (p) => <AvailabilityBadge product={p} /> },
    {
      label: 'Scent',
      cell: (p) => scentText(p) ?? NS,
    },
    { label: 'Texture', cell: (p) => (p.texture ? TEXTURE_LABELS[p.texture] : NS) },
    { label: 'Intended for', cell: (p) => p.goals.map((g) => GOAL_LABELS[g]).join('; ') },
    {
      label: 'Skin / hair types',
      cell: (p) =>
        [
          p.areas.includes('skin') &&
            `Skin: ${p.skinTypes ? p.skinTypes.map((t) => SKIN_TYPE_LABELS[t]).join(', ') : NS.toLowerCase()}`,
          p.areas.includes('hair') &&
            `Hair: ${p.hairTypes ? p.hairTypes.map((t) => HAIR_TYPE_LABELS[t]).join(', ') : NS.toLowerCase()}`,
        ]
          .filter(Boolean)
          .join(' · '),
    },
    {
      label: 'Ingredients',
      cell: (p) => (p.ingredients ? p.ingredients.map((i) => INGREDIENTS[i].name).join(', ') : 'Not confirmed'),
    },
    { label: 'How to use', cell: (p) => p.usage ?? NS },
    { label: 'Warnings', cell: (p) => p.warnings.join(' ') },
  ];
  if (prefs) {
    rows.unshift({
      label: 'Your preferences',
      cell: (p) => {
        const fit = evaluateProduct(p, prefs);
        if (!fit.eligible) return <span className="fit-mismatch">✕ Doesn’t fit: {fit.reasons[0].text}</span>;
        const h = headline(fit);
        return (
          <span>
            ✓ {h.why.replace(/^Matches: /, '')}
            {h.tradeoff && <span className="fit-tradeoff"> {h.tradeoff}</span>}
          </span>
        );
      },
    });
  }

  return (
    <div className="page compare">
      <h1>Compare products</h1>
      <p className="lede">
        Comparing {products.length} of up to {MAX_COMPARE}.{' '}
        {products.length < MAX_COMPARE && <Link href="/shop">Add another product</Link>}
      </p>

      {products.length > 1 && (
        <section className="differences" aria-labelledby="diff">
          <h2 id="diff">Key differences</h2>
          <ul>
            {differences(products).map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="hint">There’s no overall “best” — it depends which of these matter to you.</p>
        </section>
      )}

      {/* Focusable so keyboard users can scroll the table sideways on small screens. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <section className="table-scroll" aria-label="Comparison table" tabIndex={0}>
        <table className="compare-table">
          <caption className="sr-only">Product comparison</caption>
          <thead>
            <tr>
              <td>
                <span className="sr-only">Detail</span>
              </td>
              {products.map((p) => (
                <th key={p.id} scope="col">
                  <Link href={`/products/${p.id}`}>{p.name}</Link>
                  <button
                    type="button"
                    className="remove"
                    onClick={() => {
                      toggleCompare(p.id);
                      announce(`${p.name} removed from comparison.`);
                    }}
                  >
                    <X size={14} aria-hidden="true" /> Remove<span className="sr-only"> {p.name}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {products.map((p) => (
                  <td key={p.id}>{r.cell(p)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">
                <span className="sr-only">Actions</span>
              </th>
              {products.map((p) => (
                <td key={p.id}>
                  <AddToBasketButton product={p} className="btn btn-primary btn-small" />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>

      <p className="actions">
        <Link href="/shop" className="btn btn-secondary">
          Back to shopping
        </Link>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            clearCompare();
            announce('Comparison cleared.');
          }}
        >
          Clear comparison
        </button>
      </p>
      <DemoNotice compact />
    </div>
  );
}
