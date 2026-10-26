import Link from 'next/link';

/** Shown when a study session uses the conventional condition. */
export function FeatureUnavailable({ feature }: { feature: string }) {
  return (
    <div className="page narrow">
      <h1>{feature} isn’t available in this session</h1>
      <p>You can still browse, search and filter every product in the shop.</p>
      <p className="actions">
        <Link href="/shop" className="btn btn-primary">
          Browse all products
        </Link>
      </p>
    </div>
  );
}
