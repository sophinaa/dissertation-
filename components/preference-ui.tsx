'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import { FIELD_LABELS, type Preferences } from '@/lib/preferences.ts';
import { summarisePreferences } from '@/lib/recommend.ts';
import { useStore } from './store';

export const FIELD_STEP: Record<keyof Preferences, number> = {
  area: 1,
  goals: 2,
  goalsNotSure: 2,
  skinType: 2,
  hairType: 2,
  exclude: 3,
  likes: 3,
  fragrance: 4,
  texture: 4,
  budget: 5,
  routine: 5,
};

export function editHref(field: keyof Preferences) {
  return `/preferences?step=${FIELD_STEP[field]}&return=summary`;
}

export function ResetPreferencesButton() {
  const { resetPrefs } = useStore();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" className="btn btn-quiet btn-small" onClick={() => setConfirming(true)}>
        <RotateCcw size={14} aria-hidden="true" /> Reset preferences
      </button>
    );
  }
  return (
    <fieldset className="confirm">
      <legend>Clear all your answers?</legend>
      <button
        type="button"
        className="btn btn-danger btn-small"
        onClick={() => {
          resetPrefs();
          setConfirming(false);
        }}
      >
        Yes, reset
      </button>
      <button type="button" className="btn btn-quiet btn-small" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </fieldset>
  );
}

/** The active profile as editable chips. */
export function PreferenceSummary({ title = 'Your preferences' }: { title?: string }) {
  const { prefs } = useStore();
  if (!prefs) return null;
  const items = summarisePreferences(prefs);
  return (
    <section className="pref-summary" aria-labelledby="pref-summary-title">
      <div className="pref-summary-head">
        <h2 id="pref-summary-title">{title}</h2>
        <div className="pref-summary-actions">
          <Link className="btn btn-secondary btn-small" href="/preferences?return=summary">
            <Pencil size={14} aria-hidden="true" /> Edit preferences
          </Link>
          <ResetPreferencesButton />
        </div>
      </div>
      <ul className="pref-chips">
        {items.map((item) => (
          <li key={item.field}>
            <span className="pref-label">{item.label}:</span> {item.value}{' '}
            <Link href={editHref(item.field)} className="pref-edit">
              Change<span className="sr-only"> {FIELD_LABELS[item.field].toLowerCase()}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="hint">
        Saved on this device for up to 30 days. Strict limits (ingredients to avoid, unscented only, a strict
        budget) remove products; everything else changes the order.
      </p>
    </section>
  );
}

/** Shown after preferences change so customers know results have been recalculated. */
export function UpdatedNotice() {
  const { lastPrefsChange } = useStore();
  if (!lastPrefsChange) return null;
  const fields = [...new Set(lastPrefsChange.fields.map((f) => FIELD_LABELS[f]))];
  if (!fields.length) return null;
  return (
    <p className="updated-notice">
      Updated for your new answers: {fields.join(', ').toLowerCase()}.
    </p>
  );
}
