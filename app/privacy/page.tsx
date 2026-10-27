import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy' };

// DRAFT: review with your university (and a data-protection adviser before any
// real launch). It describes what the code actually does today.
export default function PrivacyPage() {
  return (
    <div className="page narrow about">
      <h1>Privacy</h1>
      <p className="lede">What we keep, and why. Draft notice for a prototype.</p>

      <section aria-labelledby="no-account">
        <h2 id="no-account">Without an account</h2>
        <p>
          Your basket, comparison and preferences stay in your browser. Preferences are kept for up to 30 days.
          Nothing is sent to us. You can clear them any time with “Reset preferences” or by clearing your browser
          data.
        </p>
      </section>

      <section aria-labelledby="with-account">
        <h2 id="with-account">With an account</h2>
        <ul>
          <li>
            <strong>We store:</strong> your email address, which sign-in methods you’ve used, and your saved shopping
            preferences.
          </li>
          <li>
            <strong>Preferences can include ingredients you avoid.</strong> Only save these if you’re happy for us
            to keep them.
          </li>
          <li>
            <strong>We don’t store:</strong> passwords (there aren’t any), your name, or your browsing history.
            Sign-in codes and session tokens are stored only in scrambled (hashed) form.
          </li>
          <li>
            <strong>Sessions</strong> last 30 days, using one essential cookie. Signing out ends the session.
          </li>
          <li>
            <strong>Delete your account</strong> any time from <Link href="/account">your account page</Link>. This
            removes everything immediately.
          </li>
        </ul>
      </section>

      <section aria-labelledby="third-parties">
        <h2 id="third-parties">Services we use</h2>
        <ul>
          <li>Cloudflare hosts the site and the account database.</li>
          <li>Resend sends sign-in code emails.</li>
          <li>Google or Apple confirm your identity if you sign in with them.</li>
          <li>Anthropic answers shopping-assistant questions when the AI assistant is switched on.</li>
          <li>Google Fonts provides the site’s typefaces.</li>
        </ul>
      </section>

      <p>
        Questions? <Link href="/contact">Get in touch</Link>.
      </p>
    </div>
  );
}
