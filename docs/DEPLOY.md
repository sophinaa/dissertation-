# Publishing on Cloudflare

This publishes the site at a public `*.workers.dev` link (or your own domain) with accounts stored in Cloudflare D1.

## Current public deployment

Public URL: **https://dissertation.sophinaa.workers.dev**

Deployed and verified on 27 October 2026 using the local `dissertation-prototype` checkout. Worker: `dissertation`. Existing D1 database: `dissertation-accounts`, ID `86da30b0-a5d8-4a2a-afb2-018b5b6715f9`. The database was reused without deleting or resetting data. No R2 or other resource bindings are required.

To redeploy this project:

```sh
D1_DATABASE_ID=86da30b0-a5d8-4a2a-afb2-018b5b6715f9 npm run build
npx wrangler deploy --config dist/server/wrangler.json
```

`vite.config.ts` explicitly enables `workers_dev`. The `sophinaa.workers.dev` account subdomain is registered. The generated Worker configuration in `dist/server/wrangler.json` must contain the real database ID; do not deploy a build containing `YOUR_DATABASE_ID` or the placeholder UUID.

Verification covered the public homepage, shop and filtered shop, product page, basket, comparison, preferences, finder, recommendations, about and sign-in routes; the stylesheet, scripts and all 16 product images; and a real offline-assistant response. Guest add-to-basket and basket persistence worked in the public browser. All 51 tests, TypeScript and the production build passed.

Existing email sign-in configuration was preserved and its form is available; email delivery was not tested. Google and Apple sign-in and live AI are not configured. The offline assistant works without an AI key. No secret values are stored in this document or the repository.

## Automatic deployment through GitHub

The workflow `.github/workflows/deploy.yml` deploys pushes to `main`, or a manual **Run workflow** from GitHub's Actions tab. It installs the locked dependencies, runs TypeScript and tests, builds with the existing D1 ID, checks the generated binding, deploys using the generated Worker configuration, then checks the public routes. The account and database IDs in the workflow are identifiers, not credentials. Existing Worker secrets and database contents are preserved.

One-time activation:

1. In Cloudflare's **Account API tokens**, create an **Edit Cloudflare Workers** token scoped to this account (or Workers Editor access to the existing `dissertation` Worker). See [Cloudflare's GitHub Actions guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).
2. In [repository Actions secrets](https://github.com/sophinaa/dissertation-/settings/secrets/actions), choose **New repository secret**, name it `CLOUDFLARE_API_TOKEN`, and paste the token as its value. Do not put the token in a source file or chat.
3. Commit and push the workflow, current `vite.config.ts`, and consistent package lockfile to `main`. Check **Actions → Deploy public prototype** for the result. Until the workflow is pushed and the secret is present, automatic deployment is not active.

The GitHub CLI can be authenticated on the Mac with `gh auth login --hostname github.com --git-protocol https --web --scopes workflow`. The workflow scope permits pushing the GitHub Actions file. The existing `wrangler login` session does not authenticate GitHub Actions.

## 1. Cloudflare account and database (required)

```sh
npx wrangler login                      # opens the browser to sign in to Cloudflare
npx wrangler d1 create dissertation-accounts
```

For this account the database already exists: use `npx wrangler d1 list --json` to retrieve its ID instead of creating, deleting or resetting it.

Copy the `database_id` it prints. The schema is created automatically on first use; to create it up front instead:

```sh
npx wrangler d1 execute dissertation-accounts --remote --file=migrations/0001_accounts.sql
```

## 2. Build with your database ID

```sh
D1_DATABASE_ID=<your-database-id> npm run build
```

## 3. Secrets (AUTH_SECRET is required only for accounts)

Secrets are stored encrypted by Cloudflare and never appear in the code or the browser.

```sh
openssl rand -base64 48 | npx wrangler secret put AUTH_SECRET --name dissertation
```

Without `AUTH_SECRET` (32+ characters), accounts stay switched off and the rest of the shop works as normal.

## 4. Deploy

```sh
npx wrangler deploy --config dist/server/wrangler.json
```

Wrangler prints the public link, e.g. `https://dissertation.<your-subdomain>.workers.dev`. Use that address (or your custom domain) in the provider settings below. Redeploy after changing secrets.

## 5. Sign-in methods (each optional; buttons appear once configured)

### Email codes — Resend

1. Sign up at resend.com, add and verify your sending domain.
2. Create an API key.
3. `npx wrangler secret put RESEND_API_KEY --name dissertation`
4. `npx wrangler secret put EMAIL_FROM --name dissertation` (e.g. `Botanical & You <signin@your-domain.com>`)

### Google

1. Google Cloud Console → APIs & Services → OAuth consent screen: set it up with the `openid` and `email` scopes.
2. Credentials → Create credentials → OAuth client ID → **Web application**.
3. Authorised redirect URI: `https://<your-site>/api/auth/oauth/google/callback`
4. `npx wrangler secret put GOOGLE_CLIENT_ID --name dissertation` and `GOOGLE_CLIENT_SECRET`.

### Apple (needs a paid Apple Developer Program membership)

1. Certificates, Identifiers & Profiles → Identifiers → an App ID with **Sign in with Apple** enabled.
2. Create a **Services ID** (this is `APPLE_CLIENT_ID`), enable Sign in with Apple, add your domain and the return URL `https://<your-site>/api/auth/oauth/apple/callback`. Apple only accepts HTTPS domains, not localhost.
3. Keys → create a key with Sign in with Apple. Download the `.p8` file (once only) and note the **Key ID** and your **Team ID**.
4. Set `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` (the `.p8` contents) as secrets.

### Live AI assistant (optional)

`npx wrangler secret put ANTHROPIC_API_KEY --name dissertation`

## Local development

`npm run dev` uses a local D1 database automatically. Without secrets, email codes appear on screen (development only, never in production builds) and Google/Apple stay hidden. To test real providers locally, copy `.dev.vars.example` to `.dev.vars` and fill it in. Apple still needs an HTTPS domain.

## Security summary

- No passwords. Email codes: 6 digits, 10-minute expiry, single use, 5 attempts, HMAC-hashed at rest, rate-limited per email and per hashed IP address.
- Google/Apple: OpenID Connect authorization-code flow with state, nonce and PKCE; issuer, audience, expiry, nonce and verified email are checked.
- Sessions: 256-bit random token in an `HttpOnly; Secure; SameSite=Lax` `__Host-` cookie; only a SHA-256 hash is stored; 30-day expiry; sign-out and account deletion remove them.
- State-changing API requests must come from the site's own origin (CSRF protection).
- Saved preferences are validated on the server.
- Security headers: `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, permissions policy, HSTS.
- Accounts are never used inside study sessions.

Not yet in place (consider before a real launch): a Content-Security-Policy, monitoring and alerting, a reviewed privacy notice and data-processing agreements with the providers.
