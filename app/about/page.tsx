import Link from 'next/link';
import type { Metadata } from 'next';
import { CATALOGUE_INFO, PRODUCTS } from '@/lib/catalogue.ts';

export const metadata: Metadata = { title: 'About this prototype' };

export default function AboutPage() {
  return (
    <div className="page narrow about">
      <p className="eyebrow">About this prototype</p>
      <h1>A shop that helps you choose, built for a dissertation</h1>
      <p className="lede">
        <em>Designing and Evaluating an Interactive, AI-Assisted Personalised E-commerce Platform.</em>
      </p>

      <section aria-labelledby="question">
        <h2 id="question">The research question</h2>
        <p>
          How does a connected personalised experience — a preference questionnaire, explained
          recommendations, a guided finder and a catalogue-grounded assistant — affect how people discover,
          understand and choose products, compared with conventional browsing, search and filtering of the same
          catalogue? This has not yet been evaluated, and no claim is made that either approach is better.
        </p>
      </section>

      <section aria-labelledby="works">
        <h2 id="works">What works in this prototype</h2>
        <ul>
          <li>Browsing, search, filters and sorting across {PRODUCTS.length} demonstration products.</li>
          <li>An optional questionnaire whose answers drive rule-based, explained recommendations.</li>
          <li>Editable preferences that update recommendations, the homepage, the finder and the assistant.</li>
          <li>A guided product finder that reuses saved answers and asks only questions that narrow the choice.</li>
          <li>Product comparison and a guest basket.</li>
          <li>
            A shopping assistant that answers only from catalogue records. With a server API key it uses Claude;
            without one it falls back to a rule-based helper that is clearly labelled as not AI.
          </li>
        </ul>
      </section>

      <section aria-labelledby="not">
        <h2 id="not">What isn’t real</h2>
        <ul>
          <li>
            <strong>Products:</strong> {CATALOGUE_INFO.note}
          </li>
          <li>
            <strong>Brand name:</strong> “Botanical &amp; You” is a working placeholder, not a confirmed business
            name.
          </li>
          <li>
            <strong>Images:</strong> there are no product photographs yet. The homepage image is a concept
            illustration.
          </li>
          <li>
            <strong>Orders:</strong> there is no checkout, payment, account or order history.
          </li>
          <li>
            <strong>Producer communities:</strong> the intention to work with and support producer communities is
            an aspiration; no partnerships, sourcing locations or contributions exist yet.
          </li>
        </ul>
      </section>

      <section aria-labelledby="privacy">
        <h2 id="privacy">Your data</h2>
        <p>
          There are no accounts and no analytics. Preferences, basket and comparison are stored only in your
          browser (preferences for up to 30 days) and can be cleared at any time. If the live assistant is
          enabled, your question, the products you’re viewing and a summary of your preferences are sent to the AI
          provider to answer it; nothing is stored by this site.
        </p>
      </section>

      <p className="actions">
        <Link href="/shop" className="btn btn-primary">
          Explore the shop
        </Link>
      </p>
    </div>
  );
}
