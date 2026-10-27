'use client';

import Link from 'next/link';
import { useStore } from '@/components/store';

export function ContactClient() {
  const { features, openAssistant } = useStore();

  return (
    <div className="page narrow contact">
      <h1>Get in touch</h1>
      <p className="lede">We’d love to hear from you.</p>

      <ul className="contact-list">
        <li>
          <h2>Email</h2>
          {/* Placeholder: add the confirmed business address before launch. */}
          <p className="muted">Coming soon</p>
        </li>
        <li>
          <h2>Product questions</h2>
          {features.assistant ? (
            <p>
              <button type="button" className="link-button" onClick={() => openAssistant({ productId: null })}>
                Ask the shopping assistant
              </button>
            </p>
          ) : (
            <p>
              Every product page lists ingredients, directions and warnings.{' '}
              <Link href="/shop">Browse products</Link>
            </p>
          )}
        </li>
        <li>
          <h2>Orders</h2>
          <p className="muted">This is a prototype, so no orders can be placed yet.</p>
        </li>
      </ul>
    </div>
  );
}
