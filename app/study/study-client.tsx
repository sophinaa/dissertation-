'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CONDITION_LABELS, exportSession, sanitiseParticipantCode, tasksFor, type Condition } from '@/lib/study.ts';
import { useStore } from '@/components/store';

export function StudyClient() {
  const { study, startStudy, endStudy, hydrated } = useStore();
  const [condition, setCondition] = useState<Condition>('conventional');
  const [code, setCode] = useState('');
  const [record, setRecord] = useState(true);
  const [error, setError] = useState('');

  if (!hydrated) return <div className="page narrow"><p>Loading…</p></div>;

  const download = () => {
    if (!study) return;
    const blob = new Blob([JSON.stringify(exportSession(study), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-${study.participantCode ?? 'session'}-${study.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page narrow study">
      <p className="eyebrow">Researcher tools</p>
      <h1>Study session</h1>
      <p className="notice">
        For the researcher only. This page isn’t linked from the shop. Before real participants take part, confirm
        consent, ethics approval and data handling — see <code>docs/EVALUATION.md</code>.
      </p>

      {study ? (
        <section aria-labelledby="active">
          <h2 id="active">Session in progress</h2>
          <dl className="facts">
            <dt>Condition</dt>
            <dd>{CONDITION_LABELS[study.condition]}</dd>
            <dt>Participant code</dt>
            <dd>{study.participantCode ?? 'None'}</dd>
            <dt>Task</dt>
            <dd>
              {Math.min(study.taskIndex + 1, tasksFor(study.condition).length)} of {tasksFor(study.condition).length}
              {study.taskIndex >= tasksFor(study.condition).length && ' (all complete)'}
            </dd>
            <dt>Event log</dt>
            <dd>{study.recordEvents ? `${study.events.length} events recorded in this browser tab` : 'Off'}</dd>
          </dl>
          <p className="actions">
            <Link href="/" className="btn btn-primary">
              Go to the shop
            </Link>
            {study.recordEvents && (
              <button type="button" className="btn btn-secondary" onClick={download}>
                Download event log (JSON)
              </button>
            )}
            <button type="button" className="btn btn-danger" onClick={endStudy}>
              End session and clear its data
            </button>
          </p>
          <p className="hint">
            Ending the session deletes its preferences, basket, comparison, assistant conversation and event log
            from this browser. Download the log first if you need it.
          </p>
        </section>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const clean = code.trim() ? sanitiseParticipantCode(code) : null;
            if (code.trim() && !clean) {
              setError('Use up to 12 letters, numbers or hyphens, such as P07. Never use names.');
              return;
            }
            startStudy(condition, clean, record);
          }}
        >
          <fieldset className="question">
            <legend>Condition</legend>
            {(Object.keys(CONDITION_LABELS) as Condition[]).map((c) => (
              <label key={c} className="choice">
                <input type="radio" name="condition" checked={condition === c} onChange={() => setCondition(c)} />
                <span>{CONDITION_LABELS[c]}</span>
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="pcode">Participant code (optional)</label>
            <input
              id="pcode"
              value={code}
              aria-invalid={error ? true : undefined}
              aria-describedby="pcode-help"
              onChange={(e) => {
                setCode(e.target.value);
                setError('');
              }}
            />
            <p className="hint" id="pcode-help">
              A code such as P07. Do not enter names, emails or other identifying details.
            </p>
            {error && <p className="error">{error}</p>}
          </div>
          <label className="option">
            <input type="checkbox" checked={record} onChange={() => setRecord((r) => !r)} />
            Record task events in this browser (page views, product IDs, counts — never typed text)
          </label>
          <p className="hint">
            Starting a session clears any previous study data in this tab. The participant’s normal browsing data is
            not used or changed.
          </p>
          <button type="submit" className="btn btn-primary">
            Start session
          </button>
        </form>
      )}

      <section aria-labelledby="tasks">
        <h2 id="tasks">Proposed tasks</h2>
        {(['conventional', 'assisted'] as Condition[]).map((c) => (
          <div key={c}>
            <h3 className="h-small">{CONDITION_LABELS[c]}</h3>
            <ol>
              {tasksFor(c).map((t) => (
                <li key={t.id}>{t.text}</li>
              ))}
            </ol>
          </div>
        ))}
      </section>
    </div>
  );
}
