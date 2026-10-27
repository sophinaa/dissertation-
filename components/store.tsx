'use client';

// Shared client state for the whole site. Every page reads preferences, basket,
// comparison and assistant context from here, so a change in one place is
// reflected everywhere.
//
// Persistence:
//   normal visit  -> localStorage; preferences expire after PREFS_TTL_DAYS.
//                    Assistant chats: each page load starts a new chat; earlier
//                    chats are kept for GUEST_CHAT_TTL_DAYS. When signed in,
//                    chats belong to the account instead (synced by account.tsx)
//                    and are not written to this browser.
//   study session -> sessionStorage under a separate prefix, wiped when a
//                    session starts or ends, so study state never mixes with
//                    a normal visit or a previous participant.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isProductId } from '@/lib/catalogue.ts';
import {
  GUEST_CHAT_TTL_DAYS,
  MAX_CHAT_MESSAGES,
  chatTitle,
  normaliseConversation,
  sortChats,
  type Conversation,
  type StoredMessage,
} from '@/lib/assistant/chats.ts';
import {
  changedFields,
  hasAnswers,
  normalisePreferences,
  type Preferences,
} from '@/lib/preferences.ts';
import {
  featuresFor,
  newSession,
  tasksFor,
  type Condition,
  type Features,
  type StudyEvent,
  type StudyEventType,
  type StudySession,
} from '@/lib/study.ts';

export const PREFS_TTL_DAYS = 30;
export const MAX_COMPARE = 3;
export const MAX_QTY = 10;
const MAX_RECENT = 6;
const SESSION_KEY = 'bny.studySession';

export interface BasketLine {
  id: string;
  qty: number;
}

export type ChatMessage = StoredMessage;
/** Whose chats are showing: this browser's, or the signed-in account's. */
export type ChatOwner = 'device' | 'account';

interface AssistantState {
  open: boolean;
  productId: string | null;
  messages: ChatMessage[];
  /** Text to place in the input when the panel opens. */
  prefill: string;
}

interface StoreValue {
  hydrated: boolean;
  features: Features;
  study: StudySession | null;
  prefs: Preferences | null;
  /** Fields changed by the most recent save, for "results updated" notices. */
  lastPrefsChange: { at: number; fields: (keyof Preferences)[] } | null;
  savePrefs: (next: Preferences, source: 'questionnaire' | 'edit' | 'finder') => void;
  resetPrefs: () => void;
  /** Replace preferences without an "updated" notice, e.g. when an account's saved copy loads. */
  loadPrefs: (prefs: Preferences | null) => void;
  basket: BasketLine[];
  addToBasket: (id: string, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  removeFromBasket: (id: string) => void;
  compare: string[];
  toggleCompare: (id: string) => 'added' | 'removed' | 'full';
  clearCompare: () => void;
  recent: string[];
  markViewed: (id: string) => void;
  assistant: AssistantState;
  openAssistant: (opts?: { productId?: string | null; prefill?: string }) => void;
  closeAssistant: () => void;
  setAssistantProduct: (id: string | null) => void;
  /** Saved chats, newest first. */
  chats: Conversation[];
  activeChatId: string | null;
  chatOwner: ChatOwner;
  /** Update a chat's messages, creating it if needed. `open` makes it the active chat. */
  updateChat: (id: string, update: (m: ChatMessage[]) => ChatMessage[], open?: boolean) => void;
  openChat: (id: string) => void;
  newChat: () => void;
  deleteChat: (id: string) => void;
  deleteAllChats: () => void;
  /** Show an account's chats, or this browser's again with null (signed out). */
  loadAccountChats: (chats: Conversation[] | null) => void;
  announcement: string;
  announce: (text: string) => void;
  track: (type: StudyEventType, data?: Omit<StudyEvent, 't' | 'type'>) => void;
  startStudy: (condition: Condition, participantCode: string | null, recordEvents: boolean) => void;
  endStudy: () => void;
  completeTask: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

// The control that opened the assistant, so focus can return to it on close.
let assistantOpener: HTMLElement | null = null;
export function getAssistantOpener(): HTMLElement | null {
  return assistantOpener?.isConnected ? assistantOpener : null;
}

type StorageKind = 'local' | 'session';

function storage(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function read<T>(kind: StorageKind, key: string): T | null {
  try {
    const raw = storage(kind)?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(kind: StorageKind, key: string, value: unknown) {
  try {
    if (value === null) storage(kind)?.removeItem(key);
    else storage(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage can be unavailable (private mode); the site still works in memory. */
  }
}

function keysFor(study: StudySession | null) {
  const prefix = study ? 'bny.study.' : 'bny.';
  const kind: StorageKind = study ? 'session' : 'local';
  return {
    kind,
    prefs: `${prefix}prefs`,
    basket: `${prefix}basket`,
    compare: `${prefix}compare`,
    recent: `${prefix}recent`,
    chats: `${prefix}chats`,
    /** The single conversation kept before chat history existed. */
    legacyChat: `${prefix}chat`,
  };
}

function clearStudyStorage() {
  const s = storage('session');
  if (!s) return;
  for (const key of Object.keys(s)) if (key.startsWith('bny.study.')) s.removeItem(key);
}

interface Persisted {
  prefs: Preferences | null;
  basket: BasketLine[];
  compare: string[];
  recent: string[];
  chats: Conversation[];
}

function readChats(study: StudySession | null): Conversation[] {
  const keys = keysFor(study);
  const cutoff = Date.now() - GUEST_CHAT_TTL_DAYS * 86_400_000;
  const chats = (read<unknown[]>(keys.kind, keys.chats) ?? [])
    .map(normaliseConversation)
    .filter((c): c is Conversation => !!c && c.updatedAt > cutoff);
  // Keep a conversation saved by the earlier single-chat version.
  const legacy = read<unknown[]>('session', keys.legacyChat);
  if (legacy) {
    const now = Date.now();
    const old = normaliseConversation({ id: `c-legacy-${now.toString(36)}`, messages: legacy, createdAt: now, updatedAt: now });
    if (old) chats.push(old);
    write('session', keys.legacyChat, null);
  }
  return sortChats(chats);
}

function loadPersisted(study: StudySession | null): Persisted {
  const keys = keysFor(study);
  const storedPrefs = read<{ expiresAt: number; prefs: unknown }>(keys.kind, keys.prefs);
  let prefs: Preferences | null = null;
  if (storedPrefs && storedPrefs.expiresAt > Date.now()) {
    const normalised = normalisePreferences(storedPrefs.prefs);
    prefs = hasAnswers(normalised) ? normalised : null;
  } else if (storedPrefs) {
    write(keys.kind, keys.prefs, null);
  }
  const basket = (read<BasketLine[]>(keys.kind, keys.basket) ?? [])
    .filter((l) => isProductId(l?.id) && Number.isInteger(l.qty) && l.qty > 0)
    .map((l) => ({ id: l.id, qty: Math.min(l.qty, MAX_QTY) }));
  const ids = (key: string, max: number) =>
    (read<unknown[]>(keys.kind, key) ?? []).filter(isProductId).slice(0, max);
  return {
    prefs,
    basket,
    compare: ids(keys.compare, MAX_COMPARE),
    recent: ids(keys.recent, MAX_RECENT),
    chats: readChats(study),
  };
}

const EMPTY_STATE: Persisted = { prefs: null, basket: [], compare: [], recent: [], chats: [] };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [study, setStudy] = useState<StudySession | null>(null);
  const [state, setState] = useState<Persisted>(EMPTY_STATE);
  // Never restored: every page load starts with a new chat.
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatOwner, setChatOwner] = useState<ChatOwner>('device');
  const [lastPrefsChange, setLastPrefsChange] = useState<StoreValue['lastPrefsChange']>(null);
  const [assistantUi, setAssistantUi] = useState({ open: false, productId: null as string | null, prefill: '' });
  const [announcement, setAnnouncement] = useState('');
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load once on the client. Server rendering always starts from empty state,
  // so browser storage can only be read after hydration.
  /* oxlint-disable react/react-compiler -- one-time hydration from browser storage */
  useEffect(() => {
    const session = read<StudySession>('session', SESSION_KEY);
    const valid = session && (session.condition === 'assisted' || session.condition === 'conventional') ? session : null;
    setStudy(valid);
    setState(loadPersisted(valid));
    setHydrated(true);
  }, []);
  /* oxlint-enable react/react-compiler */

  // Persist after every change.
  useEffect(() => {
    if (!hydrated) return;
    const keys = keysFor(study);
    write(
      keys.kind,
      keys.prefs,
      state.prefs
        ? { expiresAt: Date.now() + PREFS_TTL_DAYS * 86_400_000, prefs: state.prefs }
        : null,
    );
    write(keys.kind, keys.basket, state.basket);
    write(keys.kind, keys.compare, state.compare);
    write(keys.kind, keys.recent, state.recent);
    // An account's chats are saved to the account, never left on this device.
    if (chatOwner === 'device') write(keys.kind, keys.chats, state.chats.length ? state.chats : null);
  }, [hydrated, study, state, chatOwner]);

  useEffect(() => {
    if (hydrated) write('session', SESSION_KEY, study);
  }, [hydrated, study]);

  const announce = useCallback((text: string) => {
    if (announceTimer.current) clearTimeout(announceTimer.current);
    setAnnouncement(text);
    announceTimer.current = setTimeout(() => setAnnouncement(''), 6000);
  }, []);

  const track = useCallback<StoreValue['track']>((type, data) => {
    setStudy((s) =>
      s && s.recordEvents
        ? { ...s, events: [...s.events, { t: Date.now() - s.startedAt, type, ...data }] }
        : s,
    );
  }, []);

  const features = useMemo(() => featuresFor(study?.condition ?? null), [study]);

  const savePrefs = useCallback<StoreValue['savePrefs']>(
    (next, source) => {
      const normalised = normalisePreferences(next);
      const fields = changedFields(state.prefs, normalised);
      setState((s) => ({ ...s, prefs: hasAnswers(normalised) ? normalised : null }));
      // Only an edit of existing preferences is an "update" worth announcing on results pages.
      setLastPrefsChange(state.prefs ? { at: Date.now(), fields } : null);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setLastPrefsChange(null), 5 * 60_000);
      track('preferences_saved', { detail: { source, fields: fields.join(',') } });
    },
    [state.prefs, track],
  );

  const resetPrefs = useCallback(() => {
    setState((s) => ({ ...s, prefs: null }));
    setLastPrefsChange({ at: Date.now(), fields: [] });
    track('preferences_reset');
    announce('Your preferences have been cleared. Products are no longer personalised.');
  }, [announce, track]);

  const loadPrefs = useCallback((next: Preferences | null) => {
    const normalised = next ? normalisePreferences(next) : null;
    setState((s) => ({ ...s, prefs: normalised && hasAnswers(normalised) ? normalised : null }));
  }, []);

  const addToBasket = useCallback<StoreValue['addToBasket']>(
    (id, qty = 1) => {
      if (!isProductId(id)) return;
      setState((s) => {
        const existing = s.basket.find((l) => l.id === id);
        const basket = existing
          ? s.basket.map((l) => (l.id === id ? { ...l, qty: Math.min(l.qty + qty, MAX_QTY) } : l))
          : [...s.basket, { id, qty: Math.min(qty, MAX_QTY) }];
        return { ...s, basket };
      });
      track('basket_add', { productId: id, detail: { qty } });
    },
    [track],
  );

  const setQty = useCallback((id: string, qty: number) => {
    const clean = Math.max(1, Math.min(MAX_QTY, Math.round(qty)));
    setState((s) => ({ ...s, basket: s.basket.map((l) => (l.id === id ? { ...l, qty: clean } : l)) }));
  }, []);

  const removeFromBasket = useCallback(
    (id: string) => {
      setState((s) => ({ ...s, basket: s.basket.filter((l) => l.id !== id) }));
      track('basket_remove', { productId: id });
    },
    [track],
  );

  const toggleCompare = useCallback<StoreValue['toggleCompare']>(
    (id) => {
      if (state.compare.includes(id)) {
        setState((s) => ({ ...s, compare: s.compare.filter((c) => c !== id) }));
        track('compare_remove', { productId: id });
        return 'removed';
      }
      if (state.compare.length >= MAX_COMPARE) return 'full';
      setState((s) => ({ ...s, compare: [...s.compare, id] }));
      track('compare_add', { productId: id });
      return 'added';
    },
    [state.compare, track],
  );

  const markViewed = useCallback(
    (id: string) => {
      setState((s) => ({ ...s, recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, MAX_RECENT) }));
      track('product_view', { productId: id });
    },
    [track],
  );

  const startStudy = useCallback<StoreValue['startStudy']>((condition, code, recordEvents) => {
    clearStudyStorage();
    const session = newSession(condition, code, recordEvents);
    setStudy(session);
    setState(EMPTY_STATE);
    setActiveChatId(null);
    setChatOwner('device');
    setLastPrefsChange(null);
    setAssistantUi({ open: false, productId: null, prefill: '' });
  }, []);

  const endStudy = useCallback(() => {
    clearStudyStorage();
    write('session', SESSION_KEY, null);
    setStudy(null);
    setState(loadPersisted(null));
    setActiveChatId(null);
    setChatOwner('device');
    setLastPrefsChange(null);
    setAssistantUi({ open: false, productId: null, prefill: '' });
  }, []);

  const completeTask = useCallback(() => {
    setStudy((s) => {
      if (!s) return s;
      const t = Date.now() - s.startedAt;
      const tasks = tasksFor(s.condition);
      const events: StudyEvent[] = s.recordEvents
        ? [
            ...s.events,
            { t, type: 'task_complete', task: tasks[s.taskIndex]?.id },
            ...(tasks[s.taskIndex + 1]
              ? [{ t, type: 'task_start' as const, task: tasks[s.taskIndex + 1].id }]
              : [{ t, type: 'session_end' as const }]),
          ]
        : s.events;
      return { ...s, taskIndex: s.taskIndex + 1, events };
    });
  }, []);

  const updateChat = useCallback<StoreValue['updateChat']>((id, update, open = false) => {
    setState((s) => {
      const existing = s.chats.find((c) => c.id === id);
      const messages = update(existing?.messages ?? []).slice(-MAX_CHAT_MESSAGES);
      if (!messages.length) return s;
      const now = Date.now();
      const chat: Conversation = {
        id,
        title: chatTitle(messages),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        messages,
      };
      return { ...s, chats: sortChats([chat, ...s.chats.filter((c) => c.id !== id)]) };
    });
    if (open) setActiveChatId(id);
  }, []);

  const deleteChat = useCallback((id: string) => {
    setState((s) => ({ ...s, chats: s.chats.filter((c) => c.id !== id) }));
    setActiveChatId((a) => (a === id ? null : a));
  }, []);

  const loadAccountChats = useCallback(
    (chats: Conversation[] | null) => {
      setActiveChatId(null);
      setChatOwner(chats ? 'account' : 'device');
      setState((s) => ({ ...s, chats: chats ? sortChats(chats) : readChats(study) }));
    },
    [study],
  );

  const activeChat = state.chats.find((c) => c.id === activeChatId);

  const value: StoreValue = {
    hydrated,
    features,
    study,
    prefs: state.prefs,
    lastPrefsChange,
    savePrefs,
    resetPrefs,
    loadPrefs,
    basket: state.basket,
    addToBasket,
    setQty,
    removeFromBasket,
    compare: state.compare,
    toggleCompare,
    clearCompare: () => setState((s) => ({ ...s, compare: [] })),
    recent: state.recent,
    markViewed,
    assistant: { ...assistantUi, messages: activeChat?.messages ?? [] },
    openAssistant: (opts) => {
      const active = document.activeElement;
      assistantOpener = active instanceof HTMLElement && active !== document.body ? active : null;
      setAssistantUi((a) => ({
        open: true,
        productId: opts?.productId !== undefined ? opts.productId : a.productId,
        prefill: opts?.prefill ?? '',
      }));
    },
    closeAssistant: () => setAssistantUi((a) => ({ ...a, open: false, prefill: '' })),
    setAssistantProduct: (id) => setAssistantUi((a) => ({ ...a, productId: id })),
    chats: state.chats,
    activeChatId: activeChat ? activeChatId : null,
    chatOwner,
    updateChat,
    openChat: setActiveChatId,
    newChat: () => setActiveChatId(null),
    deleteChat,
    deleteAllChats: () => {
      setState((s) => ({ ...s, chats: [] }));
      setActiveChatId(null);
    },
    loadAccountChats,
    announcement,
    announce,
    track,
    startStudy,
    endStudy,
    completeTask,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

/** Preferences only when personalisation is part of the current experience. */
export function useActivePrefs(): Preferences | null {
  const { prefs, features } = useStore();
  return features.personalisation ? prefs : null;
}
