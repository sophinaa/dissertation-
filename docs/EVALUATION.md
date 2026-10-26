# Evaluation support

This prototype supports running the same shopping tasks under two conditions. Nothing here is an approved study protocol: participant numbers, ethics approval, consent wording and the analysis plan are still to be decided with the supervisor.

## Conditions

Open `/study` (not linked from the shop) on the participant’s device.

| | Conventional | Assisted |
| --- | --- | --- |
| Catalogue, product pages, search, filters, sort, basket | ✓ | ✓ |
| Comparison | ✓ (facts only) | ✓ (+ preference row) |
| Questionnaire, recommendations, explanations, personalised homepage | — | ✓ |
| Guided finder | — | ✓ |
| Shopping assistant | — | ✓ |

Both conditions use the same `lib/catalogue.ts` records and the same page layouts, so differences are limited to the assisted features. Hidden routes show “isn’t available in this session”.

**Isolation:** starting a session wipes any previous study data in that browser tab and uses a separate `sessionStorage` namespace, so a participant never sees saved preferences, basket, comparison or chat from normal browsing or an earlier participant. Ending the session deletes all study data and restores the normal visitor state.

**Decision to confirm:** comparison is available in both conditions as standard shop functionality. Removing it from the conventional condition would weaken that baseline.

## Proposed tasks (`lib/study.ts`)

1. Find a hair product that costs £15 or less and add it to the basket. *(budget constraint)*
2. Find a skin product with no nut-derived ingredients and add it to the basket. *(exclusion)*
3. Pick two products, compare them and decide which you prefer. *(comparison)*
4. Find the directions for the preferred product. *(usage information)*
5. Assisted: explain why a suggested product was suggested. Conventional: find an unscented alternative to a basket item.
6. Assisted only: change a preference and find an alternative.

The task text appears in a bar at the top of every page, with an “I’ve finished this task” button. Wording is provisional and should be piloted.

## Event log (optional, local only)

When “Record task events” is ticked, events are stored in the participant’s browser tab and can be downloaded as JSON from `/study`. Nothing is transmitted; there is no external analytics.

Recorded: `session_start`, `task_start`, `task_complete`, `page_view` (path), `search` (result count and query *length*), `filter_change` (filter names, result count), `product_view`, `basket_add` / `basket_remove`, `compare_add` / `compare_remove`, `preferences_saved` (changed field names), `preferences_reset`, `recommendations_shown` (product IDs), `finder_complete` (product IDs), `assistant_message` (returned product IDs, mode), `assistant_error`. Timestamps are milliseconds since the session started.

**Not recorded:** search text, chat messages, names, or any free text. Participant codes accept only letters, numbers and hyphens (e.g. `P07`).

## Measures this can support

Task completion and time (from task events), constraint satisfaction (compare basket product IDs against the task’s constraint using catalogue data), and behaviour counts. Perceived relevance, usability, confidence, trust and explanation usefulness need separate questionnaires (e.g. SUS plus custom items), which are not built into the prototype.

## Before real participants

- Ethics approval and consent forms; tell participants products are fictional demonstrations.
- Decide whether the live AI assistant is used. If it is, the consent wording must say that questions are sent to Anthropic, and the API costs need budgeting. If it isn’t, the assisted condition uses the labelled rule-based helper, which changes what is being evaluated.
- Decide on a within- or between-subjects design and counterbalancing (see `docs/ROADMAP.md`). A combined comparison cannot attribute effects to an individual feature.
- Data storage and retention for the exported JSON logs.
- Pilot the tasks and check the catalogue supports each one unambiguously.
