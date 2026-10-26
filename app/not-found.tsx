import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page narrow">
      <h1>We couldn’t find that page</h1>
      <p>The product or page may have moved, or the link may be mistyped.</p>
      <p className="actions">
        <Link href="/shop" className="btn btn-primary">
          Browse all products
        </Link>
        <Link href="/" className="btn btn-secondary">
          Go to the homepage
        </Link>
      </p>
    </div>
  );
}
