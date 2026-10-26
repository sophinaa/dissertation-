'use client';

import Link from 'next/link';
import { Check, Minus, Plus, Scale, ShoppingBag } from 'lucide-react';
import {
  AVAILABILITY_LABELS,
  FRAGRANCE_LABELS,
  TEXTURE_LABELS,
  formatPrice,
  formatSize,
  productAreasLabel,
  type Product,
} from '@/lib/catalogue.ts';
import { headline, type ProductFit } from '@/lib/recommend.ts';
import { MAX_COMPARE, useStore } from './store';

/** A short display word for the poster-style placeholder (presentation only). */
const POSTER_WORDS: Record<string, string> = {
  'rose-facial-oil': 'Rose',
  'rosehip-facial-oil': 'Rosehip',
  'golden-jojoba-oil': 'Jojoba',
  'pure-argan-oil': 'Argan',
  'pure-argan-oil-15ml': 'Argan',
  'rose-argan-night-oil': 'Night',
  'face-oil-discovery-set': 'Trio',
  'unscented-body-oil': 'Body',
  'evening-body-oil': 'Evening',
  'shea-body-butter': 'Shea',
  'rocket-seed-hair-oil': 'Rocket',
  'mixed-botanical-hair-oil': 'Blend',
  'tea-tree-scalp-oil': 'Tea tree',
  'rosemary-hair-oil': 'Rosemary',
  'amla-hair-oil': 'Amla',
  'pre-wash-hair-duo': 'Duo',
};

/** Honest placeholder: there are no real product photographs yet. */
export function ProductImage({ product, large = false }: { product: Product; large?: boolean }) {
  const word = POSTER_WORDS[product.id] ?? product.name.split(' ')[0];
  return (
    <div className={`product-image tone-${product.category}${large ? ' large' : ''}`}>
      <span className={`poster-word${word.length > 6 ? ' long' : ''}`} aria-hidden="true">
        {word}
      </span>
      <span className="photo-note">Photo coming soon</span>
    </div>
  );
}

export function AvailabilityBadge({ product }: { product: Product }) {
  const status = product.availability;
  return (
    <span className={`availability ${status ?? 'unknown'}`}>
      {status ? AVAILABILITY_LABELS[status] : 'Stock unknown'}
    </span>
  );
}

export function AddToBasketButton({
  product,
  qty = 1,
  className = 'btn btn-primary',
}: {
  product: Product;
  qty?: number;
  className?: string;
}) {
  const { addToBasket, announce, basket } = useStore();
  if (product.availability === 'out-of-stock') {
    return (
      <button type="button" className={className} disabled>
        Out of stock
      </button>
    );
  }
  const inBasket = basket.find((l) => l.id === product.id)?.qty ?? 0;
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        addToBasket(product.id, qty);
        announce(`${product.name} added to your basket. You now have ${inBasket + qty} in your basket.`);
      }}
    >
      <ShoppingBag size={16} aria-hidden="true" /> Add to basket
      <span className="sr-only">: {product.name}</span>
    </button>
  );
}

export function CompareButton({ product, className = 'btn btn-quiet' }: { product: Product; className?: string }) {
  const { compare, toggleCompare, announce } = useStore();
  const selected = compare.includes(product.id);
  return (
    <button
      type="button"
      className={className}
      aria-pressed={selected}
      onClick={() => {
        const result = toggleCompare(product.id);
        if (result === 'full')
          announce(`You can compare up to ${MAX_COMPARE} products. Remove one from Compare first.`);
        else if (result === 'added')
          announce(`${product.name} added to comparison (${compare.length + 1} of ${MAX_COMPARE}).`);
        else announce(`${product.name} removed from comparison.`);
      }}
    >
      {selected ? <Check size={16} aria-hidden="true" /> : <Scale size={16} aria-hidden="true" />}
      {selected ? 'Comparing' : 'Compare'}
      <span className="sr-only">: {product.name}</span>
    </button>
  );
}

export function QuantityInput({
  value,
  onChange,
  label,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  max: number;
}) {
  return (
    <fieldset className="qty">
      <legend className="sr-only">{label}</legend>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Decrease quantity"
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={value}
        aria-label="Quantity"
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= 1) onChange(Math.min(n, max));
        }}
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </fieldset>
  );
}

/** One-line explanation for cards. Text marks, not colour alone, show match vs trade-off. */
export function FitSummary({ fit }: { fit: ProductFit }) {
  if (!fit.eligible) {
    return (
      <p className="fit fit-mismatch">
        <strong>Not a fit:</strong> {fit.reasons[0].text}
      </p>
    );
  }
  const { why, tradeoff } = headline(fit);
  return (
    <div className="fit">
      <p>
        <strong>Why:</strong> {why.replace(/^Matches: /, '')}
      </p>
      {tradeoff && <p className="fit-tradeoff">{tradeoff}</p>}
    </div>
  );
}

/** Full breakdown of every factor, used on product and results pages. */
export function FitDetails({ fit }: { fit: ProductFit }) {
  const matches = fit.factors.filter((f) => f.kind === 'match');
  const tradeoffs = fit.factors.filter((f) => f.kind === 'tradeoff');
  const notes = fit.factors.filter((f) => f.kind === 'note');
  return (
    <div className="fit-details">
      {!fit.eligible && (
        <>
          <h4>Why it isn’t recommended</h4>
          <ul className="marks">
            {fit.reasons.map((r) => (
              <li key={r.text} className="mark-no">
                <span aria-hidden="true">✕</span> {r.text}
              </li>
            ))}
          </ul>
        </>
      )}
      {matches.length > 0 && (
        <>
          <h4>Matches your preferences</h4>
          <ul className="marks">
            {matches.map((f) => (
              <li key={f.code} className="mark-yes">
                <span aria-hidden="true">✓</span> {f.text}
              </li>
            ))}
          </ul>
        </>
      )}
      {tradeoffs.length > 0 && (
        <>
          <h4>Trade-offs</h4>
          <ul className="marks">
            {tradeoffs.map((f) => (
              <li key={f.code} className="mark-trade">
                <span aria-hidden="true">–</span> {f.text}
              </li>
            ))}
          </ul>
        </>
      )}
      {notes.length > 0 && (
        <>
          <h4>Good to know</h4>
          <ul className="marks">
            {notes.map((f) => (
              <li key={f.code} className="mark-note">
                <span aria-hidden="true">i</span> {f.text}
              </li>
            ))}
          </ul>
        </>
      )}
      {fit.eligible && !matches.length && !tradeoffs.length && (
        <p>This product fits your limits, but none of your ranking preferences apply to it.</p>
      )}
    </div>
  );
}

export function ProductCard({
  product,
  fit,
  rank,
  headingLevel = 3,
}: {
  product: Product;
  fit?: ProductFit | null;
  rank?: number;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const href = `/products/${product.id}`;
  return (
    <article className="card">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="card-image">
        <ProductImage product={product} />
      </Link>
      <div className="card-body">
        {rank !== undefined && <span className="rank">#{rank}</span>}
        <Heading className="card-title">
          <Link href={href}>{product.name}</Link>
        </Heading>
        <p className="card-price">
          <strong>{formatPrice(product.pricePence)}</strong> <span>{formatSize(product)}</span>{' '}
          <AvailabilityBadge product={product} />
        </p>
        <p className="card-summary">{product.summary}</p>
        <ul className="chips" aria-label="Product attributes">
          <li>{productAreasLabel(product)}</li>
          <li>{product.fragrance ? FRAGRANCE_LABELS[product.fragrance] : 'Scent not specified'}</li>
          <li>{product.texture ? `${TEXTURE_LABELS[product.texture]} texture` : 'Texture not specified'}</li>
          {!product.ingredients && <li>Ingredients not confirmed</li>}
        </ul>
        {fit && <FitSummary fit={fit} />}
        <div className="card-actions">
          <AddToBasketButton product={product} className="btn btn-primary btn-small" />
          <CompareButton product={product} className="btn btn-quiet btn-small" />
        </div>
      </div>
    </article>
  );
}

export function DemoNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`demo-notice${compact ? ' compact' : ''}`}>
      <strong>Demo product.</strong> Details, price and stock are sample content, not verified.
    </p>
  );
}
