# Botanical & You — wellness shopping prototype

A clickable website skeleton for the supervisor meeting on Monday 28 September 2026.

**Working title:** Designing and Evaluating an Interactive, AI-Assisted Personalised E-commerce Platform.

## Run locally

Requires Node.js 22.13+.

```sh
npm install
npm run dev
```

Open the local URL printed by the server. `npm run build` creates the deployment build. `npx tsc --noEmit` checks TypeScript.

## Five-minute meeting demonstration

1. Open Discover and explain the single-brand shopping concept.
2. Click Find my match. Select Hair and a budget of £25.
3. Show the filtered catalogue and the preference explanation.
4. Switch to Conventional to demonstrate standard search and category filtering.
5. Select Compare on two products and open Compare selected.
6. Try the shopping assistant with “hair under £25”. Explain that it is a scripted prototype, not an LLM.
7. Add an item to the demo bag.
8. Open Project overview to discuss the research question and scope.

## Working features

- Responsive storefront with sample branding and six sample products.
- Product search and category filtering.
- Care routine and budget preferences with deterministic filtering.
- Conventional and personalised viewing modes.
- Product details, comparison, save toggles and session-only basket.
- Scripted catalogue matcher with no-match and unsupported-query responses.
- Supervisor project overview, research question and provisional roadmap.

## Deliberately not implemented

No real AI model, authentication, database, payments, order processing or administration. All state resets when the page reloads. Saved hearts are session-only visual selections. No information is sent to an AI provider. Product photos use remote Unsplash images and are illustrative, not actual business products. The website is not a validated accessible or production-ready shop.

The conventional/personalised switch illustrates a study concept; it is not yet a controlled experiment. Personalisation currently filters products rather than learning or ranking preferences.

## Project structure

- `app/page.tsx`: interactive prototype and sample catalogue.
- `app/globals.css`: responsive visual design and theme.
- `app/layout.tsx`: page metadata.
- `components/ui/`: provided interface primitives.
- `docs/ROADMAP.md`: milestones and supervisor decisions.
- `.github/ISSUE_TEMPLATE/`: task and research decision templates.

## Before development proceeds

Confirm real business name, product category, catalogue access, deadlines, university requirements and ethics process. Review dependency audit results before production use. The starter installation reported 11 advisories; no automatic breaking dependency upgrades have been applied.

## Wellness design direction

Botanical & You is a fictional sample brand inspired by ingredient-led wellness shopping. Products and prices are illustrative. The guide matches catalogue attributes, not symptoms or medical conditions. The original generated hero image is a product concept, not a photograph of real inventory. Product card photos are illustrative stock imagery. This revision is local-only; the earlier hosted preview has not been updated.
