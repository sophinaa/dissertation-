'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CATEGORY_LABELS, type Category } from '@/lib/catalogue.ts';
import { recommend, summarisePreferences } from '@/lib/recommend.ts';
import { ProductCard } from '@/components/product-ui';
import { ResetPreferencesButton, UpdatedNotice } from '@/components/preference-ui';
import { useActivePrefs, useStore } from '@/components/store';

const CATEGORIES: Category[] = ['face-oil', 'hair-oil', 'body-care', 'scalp-oil', 'multi-use-oil', 'set'];

export function HomeClient() {
  const { features, openAssistant, hydrated } = useStore();
  const prefs = useActivePrefs();
  const recs = prefs ? recommend(prefs, undefined, 3) : null;

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Oils for skin <span>&amp;</span> hair.
          </h1>
          <p className="lede">Clear ingredients. Simple routines.</p>
          <div className="hero-actions">
            <Link href="/shop" className="btn btn-primary btn-large">
              Shop products <ArrowRight size={18} aria-hidden="true" />
            </Link>
            {features.personalisation && (
              <Link href={prefs ? '/recommendations' : '/preferences'} className="btn btn-secondary btn-large">
                {prefs ? 'My matches' : 'Find my products'}
              </Link>
            )}
          </div>
          {features.assistant && (
            <p className="hero-help">
              Not sure?{' '}
              <button type="button" className="link-button" onClick={() => openAssistant({ productId: null })}>
                Ask the assistant
              </button>
            </p>
          )}
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

      <nav className="home-categories" aria-label="Shop by category">
        <ul>
          {CATEGORIES.map((c) => (
            <li key={c}>
              <Link href={`/shop?category=${c}`}>{CATEGORY_LABELS[c]}</Link>
            </li>
          ))}
        </ul>
      </nav>

      {hydrated && prefs && recs && (
        <section className="section personal" aria-labelledby="for-you">
          <div className="section-head">
            <h2 id="for-you">{recs.recommended.length ? 'Your top matches' : 'No strong matches yet'}</h2>
            <Link href="/recommendations" className="text-link">
              See all <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="pref-line">
            <span>
              Based on:{' '}
              {summarisePreferences(prefs)
                .map((item) => item.value)
                .join(' · ')}
            </span>
            <Link href="/preferences?return=summary" className="link-button">
              Edit preferences
            </Link>
            <ResetPreferencesButton />
          </div>
          <UpdatedNotice />
          {recs.recommended.length > 0 && (
            <div className="grid">
              {recs.recommended.map((fit, i) => (
                <ProductCard key={fit.product.id} product={fit.product} fit={fit} rank={i + 1} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
