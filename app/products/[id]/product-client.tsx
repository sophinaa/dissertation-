'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import {
  CATEGORY_LABELS,
  GOAL_LABELS,
  HAIR_TYPE_LABELS,
  INGREDIENTS,
  PRODUCTS,
  SKIN_TYPE_LABELS,
  TAG_LABELS,
  TEXTURE_HELP,
  TEXTURE_LABELS,
  formatPrice,
  formatPricePer100,
  formatSize,
  getProduct,
  productAreasLabel,
  scentText,
  type IngredientTag,
} from '@/lib/catalogue.ts';
import { evaluateProduct, recommend } from '@/lib/recommend.ts';
import {
  AddToBasketButton,
  AvailabilityBadge,
  CompareButton,
  DemoNotice,
  FitDetails,
  ProductCard,
  ProductImage,
  QuantityInput,
} from '@/components/product-ui';
import { MAX_QTY, useActivePrefs, useStore } from '@/components/store';

const NOT_SPECIFIED = 'Not specified in the catalogue';

export function ProductClient({ id }: { id: string }) {
  const product = getProduct(id)!;
  const { markViewed, features, openAssistant, hydrated } = useStore();
  const prefs = useActivePrefs();
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (hydrated) markViewed(id);
  }, [id, hydrated, markViewed]);

  const fit = prefs ? evaluateProduct(product, prefs) : null;
  const rank = prefs ? recommend(prefs).recommended.findIndex((f) => f.product.id === id) : -1;
  const similar = PRODUCTS.filter(
    (p) => p.id !== id && p.areas.some((a) => product.areas.includes(a)) && p.goals.some((g) => product.goals.includes(g)),
  )
    .map((p) => ({ p, fit: prefs ? evaluateProduct(p, prefs) : null }))
    .filter(({ fit: f }) => !f || f.eligible)
    .slice(0, 3);
  const tags = product.ingredients
    ? [...new Set(product.ingredients.flatMap((i) => INGREDIENTS[i].tags as readonly IngredientTag[]))]
    : [];

  return (
    <div className="page product-page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link href="/shop">Shop</Link>
          </li>
          <li>
            <Link href={`/shop?category=${product.category}`}>{CATEGORY_LABELS[product.category]}</Link>
          </li>
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <div className="product-layout">
        <ProductImage product={product} large />
        <div className="product-main">
          <p className="eyebrow">
            {CATEGORY_LABELS[product.category]} · {productAreasLabel(product)}
          </p>
          <h1>{product.name}</h1>
          <p className="product-price">
            <strong>{formatPrice(product.pricePence)}</strong> · {formatSize(product)}{' '}
            <span className="hint">({formatPricePer100(product)})</span>
          </p>
          <AvailabilityBadge product={product} />
          <p className="lede">{product.description}</p>
          {product.setContents && (
            <>
              <h2 className="h-small">In the set</h2>
              <ul>
                {product.setContents.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          )}

          <div className="buy-box">
            {product.availability !== 'out-of-stock' && (
              <QuantityInput value={qty} onChange={setQty} max={MAX_QTY} label={`Quantity of ${product.name}`} />
            )}
            <AddToBasketButton product={product} qty={qty} />
            <CompareButton product={product} className="btn btn-secondary" />
            {features.assistant && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => openAssistant({ productId: product.id })}
              >
                <MessageCircle size={16} aria-hidden="true" /> Ask about this product
              </button>
            )}
          </div>

          {fit && (
            <section className={`fit-panel${fit.eligible ? '' : ' mismatch'}`} aria-labelledby="fit-heading">
              <h2 id="fit-heading">
                {!fit.eligible
                  ? 'This doesn’t fit your preferences'
                  : rank >= 0
                    ? `#${rank + 1} of your recommendations`
                    : 'How this fits your preferences'}
              </h2>
              <FitDetails fit={fit} />
              <p className="hint">
                <Link href="/preferences?return=summary">Review or change your preferences</Link>
              </p>
            </section>
          )}
          {features.personalisation && !prefs && hydrated && (
            <p className="hint">
              <Link href="/preferences">See how this fits you</Link>
            </p>
          )}
        </div>
      </div>

      <div className="accordions">
        <details>
          <summary>
            <h2>Details</h2>
          </summary>
          <dl className="facts">
            <dt>For</dt>
            <dd>{productAreasLabel(product)}</dd>
            <dt>Scent</dt>
            <dd>
              {scentText(product) ?? NOT_SPECIFIED}
            </dd>
            <dt>Texture</dt>
            <dd>
              {product.texture
                ? `${TEXTURE_LABELS[product.texture]}${product.texture !== 'varies' ? `: ${TEXTURE_HELP[product.texture]}` : ''}`
                : NOT_SPECIFIED}
            </dd>
            <dt>Intended for</dt>
            <dd>{product.goals.map((g) => GOAL_LABELS[g]).join('; ')}</dd>
            {product.areas.includes('skin') && (
              <>
                <dt>Skin types</dt>
                <dd>{product.skinTypes ? product.skinTypes.map((t) => SKIN_TYPE_LABELS[t]).join(', ') : NOT_SPECIFIED}</dd>
              </>
            )}
            {product.areas.includes('hair') && (
              <>
                <dt>Hair types</dt>
                <dd>{product.hairTypes ? product.hairTypes.map((t) => HAIR_TYPE_LABELS[t]).join(', ') : NOT_SPECIFIED}</dd>
              </>
            )}
            <dt>Routine</dt>
            <dd>{product.routineFit === 'simple' ? 'Multi-use or a single step' : 'A dedicated step in a fuller routine'}</dd>
          </dl>
        </details>

        <details open>
          <summary>
            <h2>Ingredients</h2>
          </summary>
          {product.ingredients ? (
            <>
              <ol className="ingredients">
                {product.ingredients.map((i) => (
                  <li key={i}>
                    <details>
                      <summary>
                        {INGREDIENTS[i].name} <span className="inci">({INGREDIENTS[i].inci})</span>
                      </summary>
                      <p>{INGREDIENTS[i].about}</p>
                    </details>
                  </li>
                ))}
              </ol>
              {tags.length > 0 && (
                <p className="hint">Contains: {tags.map((t) => TAG_LABELS[t].toLowerCase()).join(', ')}.</p>
              )}
            </>
          ) : (
            <p className="notice">Not confirmed yet, so we can’t check it against ingredients you avoid.</p>
          )}
        </details>

        <details>
          <summary>
            <h2>How to use</h2>
          </summary>
          <p>{product.usage ?? 'Directions haven’t been confirmed for this product yet.'}</p>
        </details>

        <details>
          <summary>
            <h2>Warnings</h2>
          </summary>
          <ul>
            {product.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      </div>

      <DemoNotice />

      {similar.length > 0 && (
        <section className="section" aria-labelledby="similar">
          <h2 id="similar">{prefs ? 'Similar products that fit your preferences' : 'Similar products'}</h2>
          <div className="grid">
            {similar.map(({ p, fit: f }) => (
              <ProductCard key={p.id} product={p} fit={f} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
