import { getProduct, type Product } from './catalogue.ts';

export interface BasketLineInput {
  id: string;
  qty: number;
}

export interface PricedLine {
  product: Product;
  qty: number;
  linePence: number;
}

/** Price basket lines from the catalogue. Unknown IDs are dropped, never priced. */
export function priceBasket(lines: BasketLineInput[]): {
  lines: PricedLine[];
  itemCount: number;
  subtotalPence: number;
} {
  const priced = lines.flatMap((l) => {
    const product = getProduct(l.id);
    if (!product || !Number.isInteger(l.qty) || l.qty < 1) return [];
    return [{ product, qty: l.qty, linePence: product.pricePence * l.qty }];
  });
  return {
    lines: priced,
    itemCount: priced.reduce((n, l) => n + l.qty, 0),
    subtotalPence: priced.reduce((n, l) => n + l.linePence, 0),
  };
}
