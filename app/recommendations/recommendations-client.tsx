'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { formatPrice } from '@/lib/catalogue.ts';
import type { Preferences } from '@/lib/preferences.ts';
import { CONSTRAINT_LABELS, recommend, type HardConstraint } from '@/lib/recommend.ts';
import { FitDetails, ProductCard } from '@/components/product-ui';
import { PreferenceSummary, UpdatedNotice, editHref } from '@/components/preference-ui';
import { useActivePrefs, useStore } from '@/components/store';
import { FeatureUnavailable } from '@/components/feature-unavailable';

const CONSTRAINT_FIELD: Record<HardConstraint, keyof Preferences> = {
  area: 'area',
  exclusions: 'exclude',
  scent: 'fragrance',
  budget: 'budget',
};

export function RecommendationsClient() {
  const { features, hydrated, track, lastPrefsChange } = useStore();
  const prefs = useActivePrefs();
  const recs = prefs ? recommend(prefs) : null;
  const ids = recs?.recommended.map((f) => f.product.id).join(',') ?? '';

  useEffect(() => {
    if (ids) track('recommendations_shown', { productIds: ids.split(',') });
  }, [ids, track, lastPrefsChange]);

  if (!features.personalisation) return <FeatureUnavailable feature="Personalised recommendations" />;
  if (!hydrated) return <div className="page"><p>Loading…</p></div>;

  if (!prefs || !recs) {
    return (
      <div className="page narrow">
        <p className="eyebrow">Find my products</p>
        <h1>Get suggestions that explain themselves</h1>
        <p className="lede">
          Answer a few optional questions — what you’re shopping for, ingredients to avoid, scent, texture and
          budget. Every suggestion then shows which of your answers it matches, and any trade-offs.
        </p>
        <p className="actions">
          <Link href="/preferences" className="btn btn-primary">
            Start — about two minutes
          </Link>
          <Link href="/shop" className="btn btn-secondary">
            Browse all products instead
          </Link>
        </p>
        <p className="hint">No account needed. Answers stay in this browser.</p>
      </div>
    );
  }

  const others = recs.ranked.filter((f) => !recs.recommended.includes(f));

  return (
    <div className="page recommendations">
      <p className="eyebrow">Find my products</p>
      <h1>{recs.recommended.length ? 'Your recommendations' : 'Your results'}</h1>
      <UpdatedNotice />
      <PreferenceSummary />

      {recs.ranked.length === 0 ? (
        <section className="empty no-match" aria-labelledby="no-match">
          <h2 id="no-match">No products fit all of your limits</h2>
          <p>We haven’t loosened any of your limits. Here is what each one rules out:</p>
          <ul>
            {recs.constraintImpact.map((c) => (
              <li key={c.constraint}>
                <strong>{CONSTRAINT_LABELS[c.constraint]}</strong> rules out {c.removed} product
                {c.removed === 1 ? '' : 's'}
                {c.wouldAdd > 0
                  ? `. Changing only this would show ${c.wouldAdd} product${c.wouldAdd === 1 ? '' : 's'}.`
                  : '.'}{' '}
                <Link href={editHref(CONSTRAINT_FIELD[c.constraint])}>
                  Change {CONSTRAINT_LABELS[c.constraint].toLowerCase()}
                </Link>
              </li>
            ))}
          </ul>
          {prefs.budget.maxPence !== null && prefs.budget.strict && (
            <p className="hint">
              Your strict budget is {formatPrice(prefs.budget.maxPence)} per product. Choosing “flexible” would show
              pricier products lower down, marked as over budget.
            </p>
          )}
        </section>
      ) : !recs.personalised ? (
        <section className="section" aria-labelledby="within">
          <h2 id="within">{recs.ranked.length} products fit your limits</h2>
          <p className="notice">
            You’ve set limits but no goals, types or likes, so these aren’t ranked for you — they’re in the
            shop’s standard order. <Link href={editHref('goals')}>Add a goal</Link> to get ranked suggestions.
          </p>
          <div className="grid">
            {recs.ranked.map((fit) => (
              <ProductCard key={fit.product.id} product={fit.product} fit={fit} />
            ))}
          </div>
        </section>
      ) : (
        <>
          {recs.recommended.length > 0 ? (
            <section className="section" aria-labelledby="top">
              <h2 id="top">
                {recs.recommended.length === 1 ? 'One product matches' : `Top ${recs.recommended.length} matches`}
              </h2>
              <p className="hint">
                Ordered by how many of your answers each product matches. Ties go to the lower price.
              </p>
              <ol className="rec-list">
                {recs.recommended.map((fit, i) => (
                  <li key={fit.product.id}>
                    <ProductCard product={fit.product} fit={fit} rank={i + 1} />
                    <details className="explain">
                      <summary>Full explanation for {fit.product.name}</summary>
                      <FitDetails fit={fit} />
                    </details>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <p className="notice">
              {recs.ranked.length} products fit your limits, but none match your goals, types or liked
              ingredients. They’re listed below.
            </p>
          )}

          {others.length > 0 && (
            <section className="section" aria-labelledby="others">
              <h2 id="others">Also within your limits ({others.length})</h2>
              <p className="hint">These fit your strict limits but match fewer of your preferences.</p>
              <div className="grid">
                {others.map((fit) => (
                  <ProductCard key={fit.product.id} product={fit.product} fit={fit} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {recs.excluded.length > 0 && (
        <details className="section excluded">
          <summary>
            Not shown: {recs.excluded.length} product{recs.excluded.length === 1 ? '' : 's'} that don’t fit your limits
          </summary>
          <ul>
            {recs.excluded.map((fit) => (
              <li key={fit.product.id}>
                <Link href={`/products/${fit.product.id}`}>{fit.product.name}</Link> — {fit.reasons.map((r) => r.text).join(' ')}
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="section next-steps" aria-label="Next steps">
        <Link href="/finder" className="btn btn-secondary">
          Narrow down with the product finder
        </Link>
        <Link href="/compare" className="btn btn-secondary">
          Compare selected products
        </Link>
        <Link href="/shop" className="btn btn-quiet">
          Browse everything
        </Link>
      </section>
    </div>
  );
}
