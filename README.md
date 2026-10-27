# Botanical & You — personalised shopping prototype

Dissertation prototype for **“Designing and Evaluating an Interactive, AI-Assisted Personalised E-commerce Platform.”**
A single-brand UK shop for natural skin and hair care oils, with a conventional shopping path and an optional assisted path (preferences → explained recommendations → finder → catalogue-grounded assistant), both built on one catalogue.

> **All products are demonstration data.** Names, prices, formulations, directions and stock levels in `lib/catalogue.ts` are illustrative and are not verified product information. “Botanical & You” is a working placeholder name.

## Run, test and check

Requires Node.js 22.13+ (tests use Node’s built-in TypeScript support).

```sh
npm install
npm run dev          # local server (vinext / Vite)
npm test             # unit tests: recommendations, finder, assistant grounding, catalogue, basket, study
npm run typecheck    # tsc --noEmit
npm run lint         # oxlint (pre-existing warnings remain in components/ui — see below)
npm run build        # production build
```

### Enabling the live AI assistant (optional)

Without credentials the assistant uses an **offline, rule-based catalogue helper** and the interface says so (“rule-based, not AI”). To use Claude:

1. Create `.env.local` (git-ignored) with:
   ```
   ANTHROPIC_API_KEY=your-key
   # optional; defaults to claude-opus-5-5
   ASSISTANT_MODEL=claude-opus-5-5
   ```
2. Restart `npm run dev`. The panel will then read “AI assistant (Claude)”.

The key is read only in `app/api/assistant/route.ts` (server). It is never sent to the browser; a test checks that no client file references it. For a Cloudflare deployment, store it as a Worker secret (`wrangler secret put ANTHROPIC_API_KEY`) and confirm the Worker exposes it through `process.env` (requires the `nodejs_compat` flag, which is configured) — this has not been tested on a deployment yet. The request enables Anthropic’s server-side refusal fallback (`fallbacks: "default"`).

## What the prototype supports

| Area | Status |
| --- | --- |
| Catalogue browse, search, filters (area, category, price, scent, texture, ingredients to avoid, stock), sorting, URL-shareable filters, empty states | Functional |
| Product pages with ingredients (with plain-language explanations), usage, warnings, availability, explicit “not specified” for missing data | Functional |
| 5-step questionnaire (progress, back, “Not sure”, validation, saved draft, exit) and single-answer editing | Functional |
| Rule-based recommendations with hard constraints, explained ranking, no-match diagnosis | Functional, unit-tested |
| Personalised homepage, preference summary, edit and reset | Functional |
| Guided finder that reuses saved answers and keeps its own answers temporary | Functional, unit-tested |
| Comparison (up to 3), price per 100 ml/g, preference row, “no overall best” | Functional |
| Basket (quantities, totals, persistence, preference-mismatch notes) | Functional |
| Shopping assistant | Live Claude integration implemented but **not exercised with real credentials**; offline rule-based helper functional |
| Optional accounts: email code, Google or Apple sign-in; preferences sync across devices; sign out; delete account | Functional for email codes (tested locally); Google/Apple implemented, need your credentials to test: see [docs/DEPLOY.md](docs/DEPLOY.md) |
| Checkout, payment, order history, admin | **Not implemented** (basket says checkout is unavailable) |
| Conventional vs assisted study conditions and local event log (`/study`) | Functional; requires ethics/consent decisions before real use |

## Architecture

- `lib/catalogue.ts` — the single source of product truth (ingredients dictionary with tags, product records, labels, helpers). Used by every page, the recommendation engine, comparison and the assistant.
- `lib/preferences.ts` — preference model, option lists, normalisation of untrusted input, conflict detection.
- `lib/recommend.ts` — deterministic recommendation engine and explanation generator. See [docs/RECOMMENDATIONS.md](docs/RECOMMENDATIONS.md).
- `lib/finder.ts` — guided finder question selection.
- `lib/search.ts`, `lib/basket.ts` — conventional search/filter/sort and basket pricing.
- `lib/assistant/shared.ts` — request validation, catalogue records sent to the model, context building, output validation, system prompt.
- `lib/assistant/offline.ts` — rule-based fallback responder.
- `app/api/assistant/route.ts` — server route calling Claude via `@anthropic-ai/sdk` with JSON-schema output; every product ID is validated against the catalogue.
- `lib/study.ts` + `app/study/` — study conditions, tasks and event log. See [docs/EVALUATION.md](docs/EVALUATION.md).
- `components/store.tsx` — shared client state (preferences, basket, comparison, recently viewed, assistant thread, study session) and persistence.
- `app/*` — routes: `/`, `/shop`, `/products/[id]`, `/preferences`, `/recommendations`, `/finder`, `/compare`, `/basket`, `/about`, `/study` (unlisted).

### Accounts and publishing

Accounts are optional: guests keep everything in the browser; signing in saves preferences to the account. Setup, secrets and the security design are in [docs/DEPLOY.md](docs/DEPLOY.md). Code: `lib/auth/`, `app/api/auth/`, `app/api/account/`, `components/account.tsx`.

## Data and privacy

No accounts, analytics or server-side storage. Preferences, basket, comparison and recently viewed live in `localStorage` (preferences expire after 30 days and can be reset). The assistant conversation is kept in `sessionStorage` only. Study sessions use a separate `sessionStorage` namespace that is wiped when a session starts or ends. Customer messages are not logged by the server. When the live assistant is enabled, the question, recent conversation, current/compared product IDs and a summary of the customer’s preferences are sent to Anthropic.

## Provisional decisions (please review)

- **Brand name** “Botanical & You” kept from the earlier prototype; flagged as a placeholder.
- **Catalogue scope:** 16 demonstration products (face, body, hair, scalp, multi-use, sets), including rose, argan, rocket (taramira), tea tree and a mixed oil. The earlier herbal teas (“Health & Nutrition”) were removed as outside skin and hair care.
- **Deliberate data gaps** for testing honesty: *Rosemary Hair Oil* has unconfirmed ingredients, scent, texture and directions; *Amla & Sesame Hair Oil* has unconfirmed scent and is out of stock.
- **Images:** the earlier Unsplash stock photos were replaced with labelled placeholders (“No product photo yet”). The homepage image is labelled a concept illustration; a compressed `wellness-hero.jpg` is used (the original PNG is kept).
- **Visual direction:** editorial poster style — deep forest green and sage on cream, chunky Fraunces display type, DM Sans body text, pill buttons, poster-word image placeholders and minimal copy. Colours and type are tokens in `app/globals.css`. Fonts load from Google Fonts, which means each visitor’s browser contacts Google; self-host them before a study if that matters for your ethics application.
- **Comparison is available in both study conditions** as a standard e-commerce feature; only the “Your preferences” row is assisted-only. Confirm with your supervisor.
- **Producer-community copy** is written as an intention, with no partners, locations or percentages.

## Known limitations

- The live Claude path has not been run against the real API here (no credentials were available); error mapping is implemented and the offline path is tested.
- Product data is illustrative; real formulations, prices, directions and warnings must replace it before customer use, and safety wording should be reviewed by someone qualified.
- `npm run lint` still reports pre-existing errors in the generated `components/ui/*` primitives and `hooks/use-mobile.ts`, which were not modified. `dissertation-/` is an older nested copy of the project and is excluded from lint and type checks.
- The starter install reported dependency audit advisories; no automatic upgrades were applied.
- Not a validated accessible or production-ready shop: keyboard, focus, contrast and mobile were checked in a headless browser, but no screen-reader or user testing has been done.
