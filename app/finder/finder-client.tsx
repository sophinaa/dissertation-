'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { answer, applyFinderAnswers, finderState, profileChanges, type FinderAnswers } from '@/lib/finder.ts';
import { FitDetails, ProductCard } from '@/components/product-ui';
import { useStore } from '@/components/store';
import { FeatureUnavailable } from '@/components/feature-unavailable';

export function FinderClient() {
  const { prefs, features, savePrefs, announce, track, hydrated } = useStore();
  const [answers, setAnswers] = useState<FinderAnswers>({});
  const [ignoreSaved, setIgnoreSaved] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [saved, setSaved] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);

  const state = finderState(prefs, answers, ignoreSaved);
  const done = state.done || stopped;
  const changes = profileChanges(ignoreSaved ? null : prefs, answers);
  const resultIds = state.candidates.map((c) => c.product.id).join(',');

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [state.question?.field, done]);

  useEffect(() => {
    if (done && resultIds) track('finder_complete', { productIds: resultIds.split(',').slice(0, 6) });
  }, [done, resultIds, track]);

  if (!features.finder) return <FeatureUnavailable feature="The product finder" />;
  if (!hydrated) return <div className="page"><p>Loading…</p></div>;

  const restart = () => {
    setAnswers({});
    setStopped(false);
    setSaved(false);
  };

  return (
    <div className="page finder">
      <p className="eyebrow">Product finder</p>
      <h1 ref={headingRef} tabIndex={-1}>
        {done ? 'Your shortlist' : 'Let’s narrow it down'}
      </h1>

      <section className="finder-context" aria-label="What the finder is using">
        {prefs && !ignoreSaved ? (
          <>
            <p>
              <strong>Using your saved preferences</strong>
              {state.reused.length ? ', so we won’t ask again about:' : '.'}
            </p>
            {state.reused.length > 0 && (
              <ul className="pref-chips">
                {state.reused.map((r) => (
                  <li key={r.field}>{r.text}</li>
                ))}
              </ul>
            )}
            <p className="hint">
              Ingredients you avoid and other strict limits still apply.{' '}
              <Link href="/preferences?return=summary">Edit preferences</Link>
            </p>
          </>
        ) : (
          <p>
            {prefs
              ? 'Ignoring your saved preferences for this search.'
              : 'You haven’t saved any preferences, so the finder starts from the whole range.'}
          </p>
        )}
        {prefs && (
          <label className="option">
            <input
              type="checkbox"
              checked={ignoreSaved}
              onChange={() => {
                setIgnoreSaved((v) => !v);
                restart();
              }}
            />
            Ignore my saved preferences for this search
          </label>
        )}
        <p className="hint">Answers here apply to this search only, unless you choose to save them at the end.</p>
      </section>

      <p className="finder-count" aria-live="polite" aria-atomic="true">
        {state.candidates.length} product{state.candidates.length === 1 ? '' : 's'} left
      </p>

      {!done && state.question && (
        <form
          className="finder-question"
          onSubmit={(e) => e.preventDefault()}
          aria-labelledby="finder-q"
        >
          <fieldset>
            <legend id="finder-q">{state.question.prompt}</legend>
            {state.question.help && <p className="hint">{state.question.help}</p>}
            <div className="finder-options">
              {state.question.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className="btn btn-secondary finder-option"
                  onClick={() => setAnswers((a) => answer(a, state.question!.field, o.value))}
                >
                  {o.label}
                  <span>
                    {o.count} product{o.count === 1 ? '' : 's'}
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="btn btn-quiet finder-option"
                onClick={() => setAnswers((a) => answer(a, state.question!.field, null))}
              >
                Not sure / skip
              </button>
            </div>
          </fieldset>
          <p className="actions">
            <button type="button" className="link-button" onClick={() => setStopped(true)}>
              Show all {state.candidates.length} now
            </button>
            {Object.keys(answers).length > 0 && (
              <button type="button" className="link-button" onClick={restart}>
                Start again
              </button>
            )}
          </p>
        </form>
      )}

      {done && (
        <>
          {state.candidates.length === 0 ? (
            <div className="empty">
              <h2>Nothing fits all of these answers</h2>
              <p>
                No products match this combination{prefs && !ignoreSaved ? ' together with your saved limits' : ''}.
                Try starting again with fewer answers{prefs && !ignoreSaved ? ', or ignore your saved preferences' : ''}.
              </p>
              <button type="button" className="btn btn-secondary" onClick={restart}>
                Start again
              </button>
            </div>
          ) : (
            <ol className="rec-list">
              {state.candidates.slice(0, 6).map((fit, i) => (
                <li key={fit.product.id}>
                  <ProductCard product={fit.product} fit={fit} rank={i + 1} />
                  <details className="explain">
                    <summary>Why {fit.product.name} is here</summary>
                    <FitDetails fit={fit} />
                  </details>
                </li>
              ))}
            </ol>
          )}
          {state.candidates.length > 6 && (
            <p className="hint">Showing the first 6 of {state.candidates.length}.</p>
          )}

          {changes.length > 0 && !saved && (
            <section className="save-answers" aria-labelledby="save-q">
              <h2 id="save-q">Keep these answers?</h2>
              <p>
                These finder answers differ from your saved preferences{ignoreSaved ? ' (which you chose to ignore)' : ''}.
                Saving them would change:
              </p>
              <ul>
                {changes.map((c) => (
                  <li key={c.field}>{c.text}</li>
                ))}
              </ul>
              <p className="actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    savePrefs(applyFinderAnswers(ignoreSaved ? null : prefs, answers), 'finder');
                    setSaved(true);
                    setAnswers({});
                    setIgnoreSaved(false);
                    setStopped(true);
                    announce('Saved to your preferences. Recommendations across the shop have been updated.');
                  }}
                >
                  Save to my preferences
                </button>
                <span className="hint">Or do nothing: they’ll only apply to this search.</span>
              </p>
            </section>
          )}
          {saved && <p className="updated-notice">Saved. Your recommendations now use these answers.</p>}

          <p className="actions">
            <button type="button" className="btn btn-secondary" onClick={restart}>
              Start a new search
            </button>
            <Link href="/compare" className="btn btn-quiet">
              Compare selected products
            </Link>
            <Link href="/shop" className="btn btn-quiet">
              Browse everything
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
