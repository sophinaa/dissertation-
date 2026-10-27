// Evaluation support: two comparable shopping conditions and a minimal,
// local-only task-event log. Nothing here is sent anywhere; researchers export
// the log manually from /study. See docs/EVALUATION.md before real study use.

export type Condition = 'conventional' | 'assisted';

export interface Features {
  /** Questionnaire, personalised homepage, recommendations and match explanations. */
  personalisation: boolean;
  finder: boolean;
  assistant: boolean;
}

export function featuresFor(condition: Condition | null): Features {
  const assisted = condition !== 'conventional';
  return { personalisation: assisted, finder: assisted, assistant: assisted };
}

export const CONDITION_LABELS: Record<Condition, string> = {
  conventional: 'Conventional: browse, search and filter only',
  assisted: 'Assisted: preferences, recommendations, finder and assistant',
};

export interface StudyTask {
  id: string;
  text: string;
  conditions: Condition[];
}

/** Proposed tasks. Wording is provisional and should be piloted. */
export const STUDY_TASKS: StudyTask[] = [
  {
    id: 'budget',
    text: 'Find a hair product that costs £15 or less and add it to your basket.',
    conditions: ['conventional', 'assisted'],
  },
  {
    id: 'exclusion',
    text: 'Find a skin product that contains no nut-derived ingredients (such as argan, almond or shea) and add it to your basket.',
    conditions: ['conventional', 'assisted'],
  },
  {
    id: 'compare',
    text: 'Pick two products you might buy, compare them, and decide which you prefer.',
    conditions: ['conventional', 'assisted'],
  },
  {
    id: 'usage',
    text: 'Find the directions for using the product you preferred in the last task.',
    conditions: ['conventional', 'assisted'],
  },
  {
    id: 'explain',
    text: 'Choose one product that was suggested to you and find out why it was suggested.',
    conditions: ['assisted'],
  },
  {
    id: 'alternative',
    text: 'Change one of your preferences, then find an alternative to a product in your basket.',
    conditions: ['assisted'],
  },
  {
    id: 'alternative-conventional',
    text: 'Find an alternative to a product in your basket that has no added scent.',
    conditions: ['conventional'],
  },
];

export function tasksFor(condition: Condition): StudyTask[] {
  return STUDY_TASKS.filter((t) => t.conditions.includes(condition));
}

export type StudyEventType =
  | 'session_start'
  | 'session_end'
  | 'task_start'
  | 'task_complete'
  | 'page_view'
  | 'search'
  | 'filter_change'
  | 'product_view'
  | 'basket_add'
  | 'basket_remove'
  | 'compare_add'
  | 'compare_remove'
  | 'preferences_saved'
  | 'preferences_reset'
  | 'recommendations_shown'
  | 'finder_complete'
  | 'assistant_message'
  | 'assistant_error';

/**
 * Events hold IDs, counts and field names only — never free text typed by the
 * participant (search terms and chat messages are not stored).
 */
export interface StudyEvent {
  /** Milliseconds since the session started. */
  t: number;
  type: StudyEventType;
  task?: string;
  productId?: string;
  productIds?: string[];
  detail?: Record<string, string | number | boolean>;
}

export interface StudySession {
  id: string;
  condition: Condition;
  /** Researcher-assigned code such as P07. Never a name or email address. */
  participantCode: string | null;
  startedAt: number;
  recordEvents: boolean;
  taskIndex: number;
  events: StudyEvent[];
}

export function sanitiseParticipantCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return /^[A-Z0-9-]{1,12}$/.test(code) ? code : null;
}

export function newSession(
  condition: Condition,
  participantCode: string | null,
  recordEvents: boolean,
  now = Date.now(),
): StudySession {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return {
    id,
    condition,
    participantCode,
    startedAt: now,
    recordEvents,
    taskIndex: 0,
    events: recordEvents
      ? [
          { t: 0, type: 'session_start', detail: { condition } },
          { t: 0, type: 'task_start', task: tasksFor(condition)[0]?.id },
        ]
      : [],
  };
}

export function exportSession(session: StudySession) {
  return {
    format: 'botanical-and-you-study-log/1',
    sessionId: session.id,
    participantCode: session.participantCode,
    condition: session.condition,
    startedAt: new Date(session.startedAt).toISOString(),
    tasks: tasksFor(session.condition).map((t) => t.id),
    events: session.events,
  };
}
