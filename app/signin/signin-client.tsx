'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { useAccount } from '@/components/account';
import { useStore } from '@/components/store';
import { FeatureUnavailable } from '@/components/feature-unavailable';

const ERRORS: Record<string, string> = {
  unavailable: 'That sign-in method isn’t available right now.',
  cancelled: 'Sign-in was cancelled.',
  state: 'Sign-in expired or was started in another tab. Please try again.',
  provider: 'The sign-in provider couldn’t confirm your account. Please try again.',
  failed: 'Something went wrong signing you in. Please try again.',
};

function safeReturn(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/account';
}

export function SignInClient() {
  const { study } = useStore();
  const { ready, user, methods, refresh } = useAccount();
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturn(params.get('returnTo'));
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState(params.get('error') ? (ERRORS[params.get('error')!] ?? ERRORS.failed) : '');
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  if (study) return <FeatureUnavailable feature="Accounts" />;
  if (!ready) return <div className="page narrow"><p>Loading…</p></div>;

  if (user) {
    return (
      <div className="page narrow">
        <h1>You’re signed in</h1>
        <p className="lede">Signed in as {user.email}.</p>
        <p className="actions">
          <Link href="/account" className="btn btn-primary">
            Your account
          </Link>
          <Link href="/shop" className="btn btn-secondary">
            Keep shopping
          </Link>
        </p>
      </div>
    );
  }

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: !!res?.ok, data };
  }

  async function sendCode() {
    setBusy(true);
    setError('');
    const { ok, data } = await post('/api/auth/email/start', { email });
    setBusy(false);
    if (!ok) {
      setError(typeof data?.error === 'string' ? data.error : 'We couldn’t send a code. Please try again.');
      return;
    }
    setDevCode(typeof data?.devCode === 'string' ? data.devCode : null);
    setStep('code');
    setCode('');
    requestAnimationFrame(() => codeRef.current?.focus());
  }

  async function verify() {
    setBusy(true);
    setError('');
    const { ok, data } = await post('/api/auth/email/verify', { email, code });
    setBusy(false);
    if (!ok) {
      setError(typeof data?.error === 'string' ? data.error : 'That didn’t work. Please try again.');
      return;
    }
    await refresh();
    router.push(`${returnTo}${returnTo.includes('?') ? '&' : '?'}signedIn=1`);
  }

  const providers = methods?.google || methods?.apple;
  const oauthHref = (p: 'google' | 'apple') => `/api/auth/oauth/${p}/start?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className="page narrow signin">
      <h1>Sign in</h1>
      <p className="lede">Save your preferences across devices. You don’t need an account to shop.</p>

      {error && (
        <p className="error-summary" role="alert">
          {error}
        </p>
      )}

      {!methods?.enabled ? (
        <p className="notice">Accounts aren’t set up on this server yet.</p>
      ) : (
        <div className="signin-box">
          {providers && (
            <div className="oauth-buttons">
              {methods.google && (
                <a className="btn btn-secondary btn-large" href={oauthHref('google')}>
                  Continue with Google
                </a>
              )}
              {methods.apple && (
                <a className="btn btn-secondary btn-large" href={oauthHref('apple')}>
                  Continue with Apple
                </a>
              )}
            </div>
          )}
          {providers && methods.email && <p className="divider">or use your email</p>}

          {methods.email &&
            (step === 'email' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendCode();
                }}
              >
                <div className="field">
                  <label htmlFor="signin-email">Email</label>
                  <input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-large" disabled={busy || !email}>
                  {busy ? 'Sending…' : 'Email me a code'}
                </button>
                <p className="hint">We’ll send a 6-digit code. No password needed.</p>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void verify();
                }}
              >
                <p>
                  We sent a code to <strong>{email}</strong>. It expires in 10 minutes.
                </p>
                {devCode && (
                  <p className="notice dev-code">
                    <strong>Development only:</strong> no email service is set up, so here’s your code:{' '}
                    <code>{devCode}</code>
                  </p>
                )}
                <div className="field">
                  <label htmlFor="signin-code">6-digit code</label>
                  <input
                    id="signin-code"
                    ref={codeRef}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-large" disabled={busy || code.length !== 6}>
                  {busy ? 'Checking…' : 'Sign in'}
                </button>
                <p className="actions">
                  <button type="button" className="link-button" onClick={() => void sendCode()} disabled={busy}>
                    Send a new code
                  </button>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setStep('email');
                      setError('');
                    }}
                  >
                    Use a different email
                  </button>
                </p>
              </form>
            ))}
        </div>
      )}

      <p className="hint">
        By signing in you agree to us storing your email and saved preferences. See our{' '}
        <Link href="/privacy">privacy notice</Link>.
      </p>
    </div>
  );
}
