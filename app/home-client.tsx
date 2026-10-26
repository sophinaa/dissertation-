'use client';

import Link from 'next/link';
import { ArrowRight, Compass, MessageCircle, Search } from 'lucide-react';
import { CATEGORY_LABELS, getProduct, type Category } from '@/lib/catalogue.ts';
import { recommend } from '@/lib/recommend.ts';
import { ProductCard } from '@/components/product-ui';
import { PreferenceSummary, UpdatedNotice } from '@/components/preference-ui';
import { useActivePrefs, useStore } from '@/components/store';

const CATEGORIES: { category: Category; text: string }[] = [
  { category: 'face-oil', text: 'Light and richer oils for the face' },
  { category: 'body-care', text: 'Body oils and a body butter' },
  { category: 'hair-oil', text: 'Pre-wash and conditioning hair oils' },
  { category: 'scalp-oil', text: 'Light oils for scalp massage' },
  { category: 'multi-use-oil', text: 'Single oils for skin and hair' },
  { category: 'set', text: 'Try several oils together' },
];

export function HomeClient() {
  const { features, openAssistant, recent, hydrated } = useStore();
  const prefs = useActivePrefs();
  const recs = prefs ? recommend(prefs, undefined, 4) : null;
  const area = prefs?.area === 'skin' || prefs?.area === 'hair' ? prefs.area : null;
  const recentProducts = recent.map(getProduct).filter((p) => !!p);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Natural skin and hair care</p>
          <h1>
            Plant oils for skin and hair, <em>explained clearly.</em>
          </h1>
          <p className="lede">
            A small range of face, body, hair and scalp oils. Every product lists its ingredients, texture,
            scent and directions, so you can see the differences and choose with confidence.
          </p>
          <div className="hero-actions">
            <Link href="/shop" className="btn btn-primary btn-large">
              Shop products <ArrowRight size={18} aria-hidden="true" />
            </Link>
            {features.personalisation && (
              <Link
                href={prefs ? '/recommendations' : '/preferences'}
                className="btn btn-secondary btn-large"
              >
                {prefs ? 'See my recommendations' : 'Find my products'}
              </Link>
            )}
          </div>
          {features.personalisation && !prefs && (
            <p className="hint">
              “Find my products” asks a few optional questions — about two minutes. No account needed.
            </p>
          )}
        </div>
        <div className="hero-image">
          {/* oxlint-disable-next-line nextjs/no-img-element -- static local image; next/image adds no optimisation here */}
          <img
            src="/wellness-hero.jpg"
            alt="Amber glass oil bottles with fresh herbs in soft sunlight — a concept illustration, not the actual products"
            width={1400}
            height={933}
          />
          <p className="image-caption">Concept illustration — not the actual products</p>
        </div>
      </section>

      {hydrated && prefs && recs && (
        <section className="section personal" aria-labelledby="for-you">
          <div className="section-head">
            <div>
              <p className="eyebrow">Based on your answers</p>
              <h2 id="for-you">{recs.recommended.length ? 'Your top matches' : 'No strong matches yet'}</h2>
            </div>
            <Link href="/recommendations" className="text-link">
              See all results and explanations <ArrowRight size={16} aria-hidden="true" />
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
            <div className="empty">
              <p>
                {recs.ranked.length
                  ? `${recs.ranked.length} products fit your limits, but none match your goals or other preferences yet.`
                  : 'No products fit all of your current limits.'}
              </p>
              <Link href="/recommendations" className="btn btn-secondary">
                See why and what to change
              </Link>
            </div>
          )}
          <PreferenceSummary />
          {area && (
            <p className="guidance">
              Browsing on your own?{' '}
              <Link href={`/shop?area=${area}`}>See every {area} product</Link>, or{' '}
              <Link href="/finder">narrow down a specific choice with the product finder</Link>.
            </p>
          )}
        </section>
      )}

      <section className="section" aria-labelledby="how">
        <p className="eyebrow">How to shop</p>
        <h2 id="how">Three ways to find what suits you</h2>
        <div className="ways">
          <article>
            <Search size={22} aria-hidden="true" />
            <h3>Browse and filter</h3>
            <p>Search the full range and filter by skin or hair, price, scent, texture or ingredients to avoid.</p>
            <Link href="/shop" className="text-link">
              Shop all products
            </Link>
          </article>
          {features.personalisation && (
            <article>
              <Compass size={22} aria-hidden="true" />
              <h3>Get suggestions</h3>
              <p>
                Tell us what you’re shopping for and any ingredients to avoid. Each suggestion says exactly
                which of your answers it matches.
              </p>
              <Link href={prefs ? '/recommendations' : '/preferences'} className="text-link">
                {prefs ? 'See my recommendations' : 'Find my products'}
              </Link>
            </article>
          )}
          {features.assistant && (
            <article>
              <MessageCircle size={22} aria-hidden="true" />
              <h3>Ask a question</h3>
              <p>
                Ask the shopping assistant about ingredients, directions or differences between products. It
                answers only from this shop’s product information.
              </p>
              <button type="button" className="text-link" onClick={() => openAssistant({ productId: null })}>
                Open the shopping assistant
              </button>
            </article>
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="categories">
        <p className="eyebrow">The range</p>
        <h2 id="categories">Shop by category</h2>
        <ul className="category-links">
          {CATEGORIES.map((c) => (
            <li key={c.category}>
              <Link href={`/shop?category=${c.category}`}>
                <strong>{CATEGORY_LABELS[c.category]}</strong>
                <span>{c.text}</span>
              </Link>
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
        <p className="eyebrow">Our intentions</p>
        <h2 id="story">Working with the people who produce natural oils</h2>
        <p>
          Many plant oils are produced by small growers and community groups. As this brand develops, we
          intend to build fair, long-term relationships with producers and to share part of our sales with
          their communities. These plans are not yet in place, and we will only describe specific partners,
          sourcing or contributions once they are confirmed.
        </p>
      </section>
    </>
  );
}
