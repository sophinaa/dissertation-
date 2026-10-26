'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { GOAL_AREA, GOAL_LABELS, INGREDIENTS, formatPrice, type Goal } from '@/lib/catalogue.ts';
import {
  AREA_OPTIONS,
  EMPTY_PREFERENCES,
  EXCLUSION_OPTIONS,
  FRAGRANCE_OPTIONS,
  HAIR_TYPE_OPTIONS,
  LIKEABLE_INGREDIENTS,
  MAX_GOALS,
  ROUTINE_OPTIONS,
  SKIN_TYPE_OPTIONS,
  TEXTURE_OPTIONS,
  findConflicts,
  normalisePreferences,
  wantsArea,
  type Preferences,
} from '@/lib/preferences.ts';
import { summarisePreferences } from '@/lib/recommend.ts';
import { ResetPreferencesButton } from '@/components/preference-ui';
import { useStore } from '@/components/store';
import { FeatureUnavailable } from '@/components/feature-unavailable';

const STEPS = ['What you’re shopping for', 'Goals and type', 'Ingredients', 'Scent and texture', 'Budget and routine'];
const LAST = STEPS.length;

function RadioGroup<T extends string>({
  name,
  legend,
  help,
  options,
  value,
  onChange,
  error,
}: {
  name: string;
  legend: string;
  help?: string;
  options: { value: T; label: string; hint?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string;
}) {
  const describedBy = [help ? `${name}-help` : '', error ? `${name}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <fieldset className="question" aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
      <legend>{legend}</legend>
      {help && (
        <p className="hint" id={`${name}-help`}>
          {help}
        </p>
      )}
      {error && (
        <p className="error" id={`${name}-error`}>
          {error}
        </p>
      )}
      <div className="choices">
        {options.map((o) => (
          <label key={o.value} className="choice">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>
              {o.label}
              {o.hint && <small>{o.hint}</small>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function draftKey(studyId: string | undefined) {
  return studyId ? `bny.study.prefsDraft` : 'bny.prefsDraft';
}

function readDraft(studyId: string | undefined): Preferences | null {
  try {
    const raw = sessionStorage.getItem(draftKey(studyId));
    return raw ? normalisePreferences(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function PreferencesClient() {
  const { prefs, features, hydrated } = useStore();
  if (!features.personalisation) return <FeatureUnavailable feature="Personalised recommendations" />;
  if (!hydrated) return <div className="page narrow"><p>Loading your answers…</p></div>;
  // Remount when preferences are created or reset so the form starts from the right state.
  return <Questionnaire key={prefs ? 'saved' : 'new'} />;
}

function Questionnaire() {
  const { prefs, savePrefs, study, announce, track } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const stepParam = Number(params.get('step'));
  const returnToSummary = params.get('return') === 'summary';
  const validStep = stepParam >= 1 && stepParam <= LAST;

  // Start from the saved profile, else an unfinished draft from this visit.
  const [draft, setDraft] = useState<Preferences>(() => prefs ?? readDraft(study?.id) ?? EMPTY_PREFERENCES);
  const [step, setStep] = useState<number | 'review'>(() => (validStep ? stepParam : prefs ? 'review' : 1));
  const [editingOne, setEditingOne] = useState(() => validStep && !!prefs && returnToSummary);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [budgetMode, setBudgetMode] = useState<'none' | 'max'>(() => (draft.budget.maxPence !== null ? 'max' : 'none'));
  const [budgetText, setBudgetText] = useState(() =>
    draft.budget.maxPence !== null ? (draft.budget.maxPence / 100).toFixed(2) : '',
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Keep an unfinished questionnaire so a reload doesn't lose answers.
  useEffect(() => {
    if (prefs) return;
    try {
      sessionStorage.setItem(draftKey(study?.id), JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft, prefs, study]);

  // Move focus to the new heading when the step changes.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const set = (patch: Partial<Preferences>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors({});
  };

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 1 && !draft.area) e.area = 'Choose an option, or “Not sure yet”.';
    if (s === 3) {
      const conflicts = findConflicts(normalisePreferences(draft)).filter((c) => c.field === 'likes');
      if (conflicts.length) e.likes = conflicts.map((c) => c.message).join(' ');
    }
    if (s === 4) {
      const conflicts = findConflicts(normalisePreferences(draft)).filter((c) => c.field === 'fragrance');
      if (conflicts.length) e.fragrance = conflicts.map((c) => c.message).join(' ');
    }
    if (s === 5 && budgetMode === 'max') {
      const value = Number(budgetText);
      if (!budgetText.trim()) e.budget = 'Enter an amount in pounds, or choose “No limit”.';
      else if (!/^\d+(\.\d{1,2})?$/.test(budgetText.trim()) || value <= 0)
        e.budget = 'Enter an amount in pounds, such as 15 or 15.50.';
      else if (value > 1000) e.budget = 'Enter an amount of £1,000 or less.';
    }
    return e;
  }

  function withBudget(d: Preferences): Preferences {
    return {
      ...d,
      budget:
        budgetMode === 'max' && Number(budgetText) > 0
          ? { maxPence: Math.round(Number(budgetText) * 100), strict: d.budget.strict }
          : { maxPence: null, strict: false },
    };
  }

  function next() {
    if (typeof step !== 'number') return;
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (editingOne) {
      save('edit');
      return;
    }
    setStep(step === LAST ? 'review' : step + 1);
  }

  function save(source: 'questionnaire' | 'edit') {
    const final = normalisePreferences(withBudget(draft));
    savePrefs(final, source);
    try {
      sessionStorage.removeItem(draftKey(study?.id));
    } catch {
      /* ignore */
    }
    if (source === 'edit') {
      announce('Preferences updated. Your recommendations have been recalculated.');
      setEditingOne(false);
      setDraft(final);
      setStep('review');
      router.replace('/preferences?return=summary', { scroll: false });
    } else {
      track('recommendations_shown');
      router.push('/recommendations');
    }
  }

  const progress = typeof step === 'number' ? step : LAST;
  const goalOptions = (Object.keys(GOAL_LABELS) as Goal[]).filter((g) => wantsArea(draft, GOAL_AREA[g]));

  return (
    <div className="page narrow questionnaire">
      <p className="eyebrow">Find my products</p>
      {step === 'review' ? (
        <>
          <h1 ref={headingRef} tabIndex={-1}>
            {prefs ? 'Your preferences' : 'Check your answers'}
          </h1>
          <p className="lede">
            {prefs
              ? 'These answers shape your recommendations. Change any one of them — you don’t need to start again.'
              : 'Check your answers, then see products that match.'}
          </p>
          <ReviewList
            prefs={normalisePreferences(withBudget(draft))}
            onChange={(n) => {
              setEditingOne(!!prefs);
              setStep(n);
            }}
          />
          <div className="actions">
            {prefs ? (
              <>
                <Link href="/recommendations" className="btn btn-primary">
                  See my recommendations <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link href="/shop" className="btn btn-secondary">
                  Continue shopping
                </Link>
                <ResetPreferencesButton />
              </>
            ) : (
              <>
                <button type="button" className="btn btn-primary" onClick={() => save('questionnaire')}>
                  Save and see my products <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(LAST)}>
                  <ArrowLeft size={16} aria-hidden="true" /> Back
                </button>
              </>
            )}
          </div>
          <p className="hint">
            Saved only in this browser, for up to 30 days. We don’t ask for your name or any contact details.
          </p>
        </>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          <div className="progress" aria-hidden="true">
            <div style={{ width: `${(progress / LAST) * 100}%` }} />
          </div>
          <p className="progress-text">
            {editingOne ? 'Editing one answer' : `Step ${step} of ${LAST}`}
          </p>
          <h1 ref={headingRef} tabIndex={-1}>
            {STEPS[step - 1]}
          </h1>
          {Object.keys(errors).length > 0 && (
            <div className="error-summary" role="alert">
              <p>
                <strong>Please check your answers:</strong>
              </p>
              <ul>
                {Object.values(errors).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {step === 1 && (
            <RadioGroup
              name="area"
              legend="Are you shopping for skin care, hair care or both?"
              options={AREA_OPTIONS}
              value={draft.area}
              onChange={(area) => set({ area })}
              error={errors.area}
            />
          )}

          {step === 2 && (
            <>
              <fieldset className="question" aria-describedby="goals-help">
                <legend>What would you most like help with?</legend>
                <p className="hint" id="goals-help">
                  Choose up to {MAX_GOALS}. These describe what products are intended for — not medical treatment.
                </p>
                <div className="choices">
                  {goalOptions.map((g) => {
                    const checked = draft.goals.includes(g);
                    const full = !checked && draft.goals.length >= MAX_GOALS;
                    return (
                      <label key={g} className={`choice${full ? ' disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={full}
                          onChange={() =>
                            set({
                              goals: checked ? draft.goals.filter((x) => x !== g) : [...draft.goals, g],
                              goalsNotSure: false,
                            })
                          }
                        />
                        <span>
                          {GOAL_LABELS[g].charAt(0).toUpperCase() + GOAL_LABELS[g].slice(1)}
                          <small>{GOAL_AREA[g] === 'skin' ? 'Skin' : 'Hair'}</small>
                        </span>
                      </label>
                    );
                  })}
                  <label className="choice">
                    <input
                      type="checkbox"
                      checked={draft.goalsNotSure}
                      onChange={() => set({ goalsNotSure: !draft.goalsNotSure, goals: [] })}
                    />
                    <span>Not sure yet</span>
                  </label>
                </div>
              </fieldset>
              {wantsArea(draft, 'skin') && (
                <RadioGroup
                  name="skinType"
                  legend="How would you describe your skin?"
                  help="Optional. Products list the skin types they’re intended for."
                  options={SKIN_TYPE_OPTIONS}
                  value={draft.skinType}
                  onChange={(skinType) => set({ skinType })}
                />
              )}
              {wantsArea(draft, 'hair') && (
                <RadioGroup
                  name="hairType"
                  legend="How would you describe your hair?"
                  help="Optional. Think about the thickness of individual strands."
                  options={HAIR_TYPE_OPTIONS}
                  value={draft.hairType}
                  onChange={(hairType) => set({ hairType })}
                />
              )}
            </>
          )}

          {step === 3 && (
            <>
              <fieldset className="question" aria-describedby="exclude-help">
                <legend>Are there any ingredients you want to avoid completely?</legend>
                <p className="hint" id="exclude-help">
                  Strict: products containing these are never recommended. Products whose full ingredient list
                  isn’t confirmed are also left out, because we can’t check them. This uses the shop’s product
                  data — if you have an allergy, always check the label as well.
                </p>
                <div className="choices">
                  {EXCLUSION_OPTIONS.map((o) => (
                    <label key={o.value} className="choice">
                      <input
                        type="checkbox"
                        checked={draft.exclude.includes(o.value)}
                        onChange={() =>
                          set({
                            exclude: draft.exclude.includes(o.value)
                              ? draft.exclude.filter((x) => x !== o.value)
                              : [...draft.exclude, o.value],
                          })
                        }
                      />
                      <span>
                        {o.label}
                        {o.hint && <small>{o.hint}</small>}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="question" aria-describedby="likes-help" aria-invalid={errors.likes ? true : undefined}>
                <legend>Any ingredients you’d like to see?</legend>
                <p className="hint" id="likes-help">
                  A preference, not a requirement: products containing these move up the list.
                </p>
                {errors.likes && <p className="error">{errors.likes}</p>}
                <div className="choices columns">
                  {LIKEABLE_INGREDIENTS.map((id) => (
                    <label key={id} className="choice">
                      <input
                        type="checkbox"
                        checked={draft.likes.includes(id)}
                        onChange={() =>
                          set({
                            likes: draft.likes.includes(id) ? draft.likes.filter((x) => x !== id) : [...draft.likes, id],
                          })
                        }
                      />
                      <span>{INGREDIENTS[id].name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {step === 4 && (
            <>
              <RadioGroup
                name="fragrance"
                legend="How do you feel about scent?"
                help="Some oils are scented with essential oils such as rose, lavender or tea tree. Plain oils can still have a faint natural smell."
                options={FRAGRANCE_OPTIONS}
                value={draft.fragrance}
                onChange={(fragrance) => set({ fragrance })}
                error={errors.fragrance}
              />
              <RadioGroup
                name="texture"
                legend="What texture do you prefer?"
                options={TEXTURE_OPTIONS}
                value={draft.texture}
                onChange={(texture) => set({ texture })}
              />
            </>
          )}

          {step === 5 && (
            <>
              <fieldset className="question" aria-describedby="budget-help" aria-invalid={errors.budget ? true : undefined}>
                <legend>What’s the most you’d like to spend on each product?</legend>
                <p className="hint" id="budget-help">
                  This is a price limit per product, not for your whole basket.
                </p>
                {errors.budget && (
                  <p className="error" id="budget-error">
                    {errors.budget}
                  </p>
                )}
                <div className="choices">
                  <label className="choice">
                    <input type="radio" name="budgetMode" checked={budgetMode === 'none'} onChange={() => { setBudgetMode('none'); setErrors({}); }} />
                    <span>No limit</span>
                  </label>
                  <label className="choice">
                    <input type="radio" name="budgetMode" checked={budgetMode === 'max'} onChange={() => setBudgetMode('max')} />
                    <span>Set a maximum per product</span>
                  </label>
                </div>
                {budgetMode === 'max' && (
                  <div className="budget-fields">
                    <div className="field">
                      <label htmlFor="budget-amount">Maximum per product (£)</label>
                      <input
                        id="budget-amount"
                        inputMode="decimal"
                        value={budgetText}
                        aria-invalid={errors.budget ? true : undefined}
                        aria-describedby={errors.budget ? 'budget-error' : undefined}
                        onChange={(e) => {
                          setBudgetText(e.target.value.replace(/[£\s]/g, ''));
                          setErrors({});
                        }}
                      />
                    </div>
                    <RadioGroup
                      name="budgetStrict"
                      legend="How firm is this limit?"
                      options={[
                        { value: 'strict', label: 'Strict', hint: 'Never show me products above it' },
                        { value: 'flexible', label: 'Flexible', hint: 'Show slightly pricier products lower down, marked as over budget' },
                      ]}
                      value={draft.budget.strict ? 'strict' : 'flexible'}
                      onChange={(v) => set({ budget: { ...draft.budget, strict: v === 'strict' } })}
                    />
                  </div>
                )}
              </fieldset>
              <RadioGroup
                name="routine"
                legend="How much of a routine do you want?"
                options={ROUTINE_OPTIONS}
                value={draft.routine}
                onChange={(routine) => set({ routine })}
              />
            </>
          )}

          <div className="actions">
            <button type="submit" className="btn btn-primary">
              {editingOne ? 'Save this answer' : step === LAST ? 'Review answers' : 'Next'}
              {!editingOne && <ArrowRight size={16} aria-hidden="true" />}
            </button>
            {editingOne ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setDraft(prefs ?? EMPTY_PREFERENCES);
                  setEditingOne(false);
                  setStep('review');
                }}
              >
                Cancel
              </button>
            ) : (
              step > 1 && (
                <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>
                  <ArrowLeft size={16} aria-hidden="true" /> Back
                </button>
              )
            )}
          </div>
          {!editingOne && (
            <p className="hint">
              Every question after the first is optional — you can leave any unanswered.{' '}
              <Link href="/shop">Exit and browse all products</Link> (your answers so far are kept for this visit).
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function ReviewList({ prefs, onChange }: { prefs: Preferences; onChange: (step: number) => void }) {
  const summary = summarisePreferences(prefs);
  const value = (fields: (keyof Preferences)[]) =>
    summary.filter((s) => fields.includes(s.field)).map((s) => `${s.label}: ${s.value}`);
  const rows: { step: number; label: string; values: string[] }[] = [
    { step: 1, label: STEPS[0], values: value(['area']) },
    { step: 2, label: STEPS[1], values: value(['goals', 'skinType', 'hairType']) },
    { step: 3, label: STEPS[2], values: value(['exclude', 'likes']) },
    { step: 4, label: STEPS[3], values: value(['fragrance', 'texture']) },
    { step: 5, label: STEPS[4], values: value(['budget', 'routine']) },
  ];
  return (
    <dl className="review">
      {rows.map((r) => (
        <div key={r.step} className="review-row">
          <dt>{r.label}</dt>
          <dd>
            {r.values.length ? (
              <ul>
                {r.values.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            ) : (
              <span className="muted">Not answered</span>
            )}
          </dd>
          <dd>
            <button type="button" className="link-button" onClick={() => onChange(r.step)}>
              Change<span className="sr-only"> {r.label.toLowerCase()}</span>
            </button>
          </dd>
        </div>
      ))}
      {prefs.budget.maxPence !== null && (
        <p className="hint">
          Budget limits apply per product ({formatPrice(prefs.budget.maxPence)}), not to your basket total.
        </p>
      )}
    </dl>
  );
}
