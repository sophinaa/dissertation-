# Recommendation logic

Implemented in `lib/recommend.ts`; tested in `tests/recommend.test.ts`. The engine is deterministic: the same catalogue and profile always give the same results, and explanations are generated from the same factors that produce the ranking.

## 1. Normalise preferences

`normalisePreferences` (in `lib/preferences.ts`) drops unknown values, clears answers that do not apply (for example hair type for a skin-only profile) and caps goals at two. It distinguishes:

- `null` — not answered
- `'not-sure'` — the customer said they don’t know
- `'no-preference'` — any option is fine

Contradictions (liking an ingredient that an exclusion covers; “unscented only” while liking an essential oil) are reported by `findConflicts` and must be resolved by the customer. They are never fixed silently.

## 2. Hard constraints (decide eligibility)

| Constraint | Rule | Missing data |
| --- | --- | --- |
| Area | Skin-only or hair-only profiles exclude products for the other area | — |
| Ingredients to avoid | Excluded if any ingredient carries an excluded tag | Ingredients not confirmed → **excluded** |
| Unscented only | Excluded if scented with essential oils | Scent not confirmed → **excluded** |
| Strict budget (per product) | Excluded if price is above the limit | — |

Hard constraints are never relaxed automatically. When nothing is eligible, the results page lists how many products each constraint removes, and how many would return if only that one were changed, with links to edit it.

## 3. Ranking factors (order eligible products)

| Factor | Points |
| --- | --- |
| Product intended for one of the customer’s goals (each) | +3 |
| Listed for the customer’s skin or hair type | +2 |
| Not listed for that type | −1 |
| Contains a liked ingredient (each) | +2 |
| Scent preference matched / “prefer unscented” but scented | +1 / −1 |
| Texture matched / different texture | +1 / −1 |
| Routine (simple vs fuller) matched / simple wanted but product is one step of a fuller routine | +1 / −1 |
| Sampler set when the customer said “not sure” | +1 |
| Above a *flexible* budget | −2 |
| Out of stock | −3 |

Unknown attributes (for example texture not specified) give 0 points and a visible “good to know” note. They never count as a match or a mismatch.

**Ordering:** score (high first), then in-stock before out-of-stock, then price (low first), then product ID.

**Recommended** = eligible, net score above 0, and at least one positive match (top 6). If the profile contains only limits (no goals, types, likes or soft preferences), nothing is labelled “recommended”: eligible products are shown in standard order with a note.

The score is an internal ordering value. It is not a probability or a percentage and is never shown to customers.

## 4. Explanations

Each `Factor` has a full sentence (detail views) and a short phrase (cards). A card shows up to three positive matches plus satisfied limits (“free from essential oils”, “£16.00, within your £20.00 budget”) and the most significant trade-off. Product pages, recommendation details and the assistant show every match, trade-off and note. Tests check that each card summary contains its top factors and that every goal claimed is true of the product.

## 5. Where preferences propagate

Homepage “Your top matches”, `/recommendations`, product page fit panels, shop cards and the optional “fits my preferences” filter, comparison preference row, basket mismatch notes, finder starting point, and assistant context all call the same `evaluateProduct` / `recommend` functions on the same saved profile.
