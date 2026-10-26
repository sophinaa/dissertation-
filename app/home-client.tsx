'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CATEGORY_LABELS, getProduct, type Category } from '@/lib/catalogue.ts';
import { recommend } from '@/lib/recommend.ts';
import { ProductCard } from '@/components/product-ui';
import { PreferenceSummary, UpdatedNotice } from '@/components/preference-ui';
import { useActivePrefs, useStore } from '@/components/store';

const CATEGORIES: Category[] = ['face-oil', 'hair-oil', 'body-care', 'scalp-oil', 'multi-use-oil', 'set'];

export function HomeClient() {
  const { features, openAssistant, recent, hydrated } = useStore();
  const prefs = useActivePrefs();
  const recs = prefs ? recommend(prefs, undefined, 4) : null;
  const recentProducts = recent.map(getProduct).filter((p) => !!p);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Oils for skin <span>&amp;</span> hair.
          </h1>
          <p className="lede">Clear ingredients. Simple routines. Help when you want it.</p>
          <div className="hero-actions">
            <Link href="/shop" className="btn btn-primary btn-large">
              Shop products <ArrowRight size={18} aria-hidden="true" />
            </Link>
            {features.personalisation && (
              <Link href={prefs ? '/recommendations' : '/preferences'} className="btn btn-secondary btn-large">
                {prefs ? 'See my recommendations' : 'Find my products'}
              </Link>
            )}
          </div>
        </div>
        <figure className="hero-image">
          {/* oxlint-disable-next-line nextjs/no-img-element -- static local image; next/image adds no optimisation here */}
          <img
            src="/wellness-hero.jpg"
            alt="Amber glass oil bottles with fresh herbs in soft sunlight — a concept illustration, not the actual products"
            width={1400}
            height={933}
          />
          <figcaption>Concept illustration</figcaption>
        </figure>
      </section>

      {hydrated && prefs && recs && (
        <section className="section personal" aria-labelledby="for-you">
          <div className="section-head">
            <h2 id="for-you">{recs.recommended.length ? 'Your top matches' : 'No strong matches yet'}</h2>
            <Link href="/recommendations" className="text-link">
              See all <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <UpdatedNotice />
          {recs.recommended.length ? (
            <div className="grid">
              {recs.recommended.map((fit, i) => (
                <ProductCard key={fit.product.id} product={fit.product} fit={fit} rank={i + 1} />
              ))}
            </div>
          ) : (
            <p className="empty">
              {recs.ranked.length
                ? `${recs.ranked.length} products fit your limits — add a goal to rank them.`
                : 'Nothing fits all your limits.'}{' '}
              <Link href="/recommendations">See why</Link>
            </p>
          )}
          <PreferenceSummary />
        </section>
      )}

      <section className="section" aria-labelledby="how">
        <h2 id="how" className="poster-title">
          How to shop
        </h2>
        <ol className="ways">
          <li>
            <span className="numeral" aria-hidden="true">
              01
            </span>
            <h3>Browse</h3>
            <p>Filter by price, scent, texture or ingredients.</p>
            <Link href="/shop" className="text-link">
              Shop all
            </Link>
          </li>
          {features.personalisation && (
            <li className="accent">
              <span className="numeral" aria-hidden="true">
                02
              </span>
              <h3>Get matched</h3>
              <p>A few quick questions. Every pick says why.</p>
              <Link href={prefs ? '/recommendations' : '/preferences'} className="text-link">
                {prefs ? 'My matches' : 'Find my products'}
              </Link>
            </li>
          )}
          {features.assistant && (
            <li>
              <span className="numeral" aria-hidden="true">
                03
              </span>
              <h3>Ask</h3>
              <p>Questions answered from our product information only.</p>
              <button type="button" className="text-link" onClick={() => openAssistant({ productId: null })}>
                Open the assistant
              </button>
            </li>
          )}
        </ol>
      </section>

      <section className="section" aria-labelledby="categories">
        <h2 id="categories" className="poster-title">
          The range
        </h2>
        <ul className="category-links">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <Link href={`/shop?category=${c}`}>{CATEGORY_LABELS[c]}</Link>
            </li>
          ))}
        </ul>
      </section>

      {hydrated && recentProducts.length > 0 && (
        <section className="section" aria-labelledby="recent">
          <h2 id="recent">Recently viewed</h2>
          <ul className="recent-list">
            {recentProducts.map((p) => (
              <li key={p.id}>
                <Link href={`/products/${p.id}`}>{p.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section story" aria-labelledby="story">
        <h2 id="story">Rooted in the people who make it</h2>
        <p>
          We intend to work with — and give back to — the communities who produce our oils. Nothing is in place
          yet; we’ll name partners only once it’s real.
        </p>
      </section>
    </>
  );
}
