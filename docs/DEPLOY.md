# Publishing on Cloudflare

This publishes the site at a public `*.workers.dev` link (or your own domain) with accounts stored in Cloudflare D1. Nothing here has been run on your behalf: each step uses your own accounts.

## 1. Cloudflare account and database (required)

```sh
npx wrangler login                      # opens the browser to sign in to Cloudflare
npx wrangler d1 create botanical-accounts
```

Copy the `database_id` it prints. The schema is created automatically on first use; to create it up front instead:

```sh
npx wrangler d1 execute botanical-accounts --remote --file=migrations/0001_accounts.sql
```

## 2. Build with your database ID

```sh
D1_DATABASE_ID=<your-database-id> npm run build
```

## 3. Secrets (required: AUTH_SECRET)

Secrets are stored encrypted by Cloudflare and never appear in the code or the browser.

```sh
openssl rand -base64 48 | npx wrangler secret put AUTH_SECRET --name sites-project
```

Without `AUTH_SECRET` (32+ characters), accounts stay switched off and the rest of the shop works as normal.

## 4. Deploy

```sh
npx wrangler deploy --config dist/server/wrangler.json
```

Wrangler prints the public link, e.g. `https://sites-project.<your-subdomain>.workers.dev`. Use that address (or your custom domain) in the provider settings below. Redeploy after changing secrets.

## 5. Sign-in methods (each optional; buttons appear once configured)

### Email codes — Resend

1. Sign up at resend.com, add and verify your sending domain.
2. Create an API key.
3. `npx wrangler secret put RESEND_API_KEY --name sites-project`
4. `npx wrangler secret put EMAIL_FROM --name sites-project` (e.g. `Botanical & You <signin@your-domain.com>`)

### Google

1. Google Cloud Console → APIs & Services → OAuth consent screen: set it up with the `openid` and `email` scopes.
2. Credentials → Create credentials → OAuth client ID → **Web application**.
3. Authorised redirect URI: `https://<your-site>/api/auth/oauth/google/callback`
4. `npx wrangler secret put GOOGLE_CLIENT_ID --name sites-project` and `GOOGLE_CLIENT_SECRET`.

### Apple (needs a paid Apple Developer Program membership)

1. Certificates, Identifiers & Profiles → Identifiers → an App ID with **Sign in with Apple** enabled.
2. Create a **Services ID** (this is `APPLE_CLIENT_ID`), enable Sign in with Apple, add your domain and the return URL `https://<your-site>/api/auth/oauth/apple/callback`. Apple only accepts HTTPS domains, not localhost.
3. Keys → create a key with Sign in with Apple. Download the `.p8` file (once only) and note the **Key ID** and your **Team ID**.
4. Set `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` (the `.p8` contents) as secrets.

### Live AI assistant (optional)

`npx wrangler secret put ANTHROPIC_API_KEY --name sites-project`

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
