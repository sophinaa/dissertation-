'use client';

import Link from 'next/link';
import { priceBasket } from '@/lib/basket.ts';
import { formatPrice, formatSize } from '@/lib/catalogue.ts';
import { evaluateProduct } from '@/lib/recommend.ts';
import { QuantityInput } from '@/components/product-ui';
import { MAX_QTY, useActivePrefs, useStore } from '@/components/store';

export function BasketClient() {
  const { basket, setQty, removeFromBasket, announce, hydrated } = useStore();
  const prefs = useActivePrefs();
  const { lines, itemCount, subtotalPence } = priceBasket(basket);

  if (!hydrated) return <div className="page narrow"><p>Loading your basket…</p></div>;

  if (!lines.length) {
    return (
      <div className="page narrow">
        <h1>Your basket</h1>
        <div className="empty">
          <p>Your basket is empty.</p>
          <Link href="/shop" className="btn btn-primary">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page narrow basket">
      <h1>Your basket</h1>
      <p className="lede" aria-live="polite">
        {itemCount} item{itemCount === 1 ? '' : 's'} · subtotal {formatPrice(subtotalPence)}
      </p>
      <ul className="basket-lines">
        {lines.map(({ product, qty, linePence }) => {
          const fit = prefs ? evaluateProduct(product, prefs) : null;
          return (
            <li key={product.id} className="basket-line">
              <div>
                <h2 className="h-small">
                  <Link href={`/products/${product.id}`}>{product.name}</Link>
                </h2>
                <p className="hint">
                  {formatSize(product)} · {formatPrice(product.pricePence)} each
                </p>
                {product.availability === 'out-of-stock' && (
                  <p className="notice">This product is now out of stock.</p>
                )}
                {fit && !fit.eligible && (
                  <p className="fit fit-mismatch">
                    <strong>Note:</strong> this no longer fits your saved preferences. {fit.reasons[0].text} It’s
                    still in your basket; remove it if you no longer want it.
                  </p>
                )}
              </div>
              <QuantityInput
                value={qty}
                max={MAX_QTY}
                label={`Quantity of ${product.name}`}
                onChange={(n) => setQty(product.id, n)}
              />
              <p className="line-total">{formatPrice(linePence)}</p>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  removeFromBasket(product.id);
                  announce(`${product.name} removed from your basket.`);
                }}
              >
                Remove<span className="sr-only"> {product.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="basket-total">
        <p>
          Subtotal <strong>{formatPrice(subtotalPence)}</strong>
        </p>
        <p className="hint">Delivery is not calculated in this prototype.</p>
      </div>
      <div className="notice">
        <p>
          <strong>Checkout isn’t available.</strong> This is a prototype: no order can be placed and no payment
          details are collected.
        </p>
      </div>
      <p className="actions">
        <Link href="/shop" className="btn btn-secondary">
          Continue shopping
        </Link>
      </p>
    </div>
  );
}
