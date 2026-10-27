'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { summarisePreferences } from '@/lib/recommend.ts';
import { useAccount } from '@/components/account';
import { useStore } from '@/components/store';
import { FeatureUnavailable } from '@/components/feature-unavailable';

const PROVIDER_LABELS = { email: 'Email code', google: 'Google', apple: 'Apple' } as const;

export function AccountClient() {
  const { study, prefs } = useStore();
  const { ready, user, syncNote, signOut, deleteAccount } = useAccount();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  if (study) return <FeatureUnavailable feature="Accounts" />;
  if (!ready) return <div className="page narrow"><p>Loading…</p></div>;
  if (!user) {
    return (
      <div className="page narrow">
        <h1>Your account</h1>
        <p className="lede">Sign in to save your preferences across devices.</p>
        <p className="actions">
          <Link href="/signin" className="btn btn-primary">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  const summary = prefs ? summarisePreferences(prefs) : [];

  return (
    <div className="page narrow account">
      <h1>Your account</h1>
      {syncNote && <p className="updated-notice">{syncNote}</p>}

      <ul className="contact-list">
        <li>
          <h2>Email</h2>
          <p>{user.email}</p>
        </li>
        <li>
          <h2>Signs in with</h2>
          <p>{user.providers.map((p) => PROVIDER_LABELS[p]).join(', ')}</p>
        </li>
        <li>
          <h2>Preferences</h2>
          <div>
            <p>{summary.length ? summary.map((s) => s.value).join(' · ') : 'None saved yet.'}</p>
            <p>
              <Link href={prefs ? '/preferences?return=summary' : '/preferences'}>
                {prefs ? 'Edit preferences' : 'Set your preferences'}
              </Link>
            </p>
          </div>
        </li>
      </ul>

      <p className="actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            await signOut();
            router.push('/');
          }}
        >
          Sign out
        </button>
      </p>

      <section className="danger-zone" aria-labelledby="delete-heading">
        <h2 id="delete-heading">Delete account</h2>
        <p>This permanently deletes your account and saved preferences. It can’t be undone.</p>
        {error && <p className="error">{error}</p>}
        {confirming ? (
          <fieldset className="confirm">
            <legend>Delete your account for good?</legend>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                if (await deleteAccount()) router.push('/?accountDeleted=1');
                else setError('We couldn’t delete your account. Please try again.');
              }}
            >
              Yes, delete everything
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </fieldset>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={() => setConfirming(true)}>
            Delete my account
          </button>
        )}
      </section>
    </div>
  );
}
