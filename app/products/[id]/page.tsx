import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProduct } from '@/lib/catalogue.ts';
import { ProductClient } from './product-client';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = getProduct(id);
  return { title: product ? product.name : 'Product not found' };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  if (!getProduct(id)) notFound();
  return <ProductClient id={id} />;
}
