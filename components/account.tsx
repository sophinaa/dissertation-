'use client';

// Optional accounts. Guests keep everything in the browser; signing in saves
// preferences and assistant chats to the account so they follow the person
// across devices, and each account only ever sees its own chats.
// Accounts are never used during study sessions, to keep conditions clean.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { normalisePreferences, type Preferences } from '@/lib/preferences.ts';
import { normaliseConversation, type Conversation } from '@/lib/assistant/chats.ts';
import { useStore } from './store';

export interface AccountUser {
  email: string;
  providers: ('email' | 'google' | 'apple')[];
}

export interface AuthMethods {
  enabled: boolean;
  email: boolean;
  devCodes: boolean;
  google: boolean;
  apple: boolean;
}

interface AccountValue {
  /** null until the session check finishes. */
  ready: boolean;
  user: AccountUser | null;
  methods: AuthMethods | null;
  /** Set after sign-in when the account's saved preferences replaced this device's. */
  syncNote: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
}

const AccountContext = createContext<AccountValue | null>(null);

async function putPrefs(preferences: Preferences | null) {
  await fetch('/api/account/preferences', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ preferences }),
  }).catch(() => null);
}

async function fetchChats(): Promise<Conversation[] | null> {
  const res = await fetch('/api/account/chats', { cache: 'no-store' }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as { chats?: unknown[] } | null;
  if (!Array.isArray(data?.chats)) return null;
  return data.chats.map(normaliseConversation).filter((c): c is Conversation => !!c);
}

const chatRequest = (id: string, init: RequestInit) =>
  fetch(`/api/account/chats/${encodeURIComponent(id)}`, {
    ...init,
    headers: { 'content-type': 'application/json' },
  }).catch(() => null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { hydrated, study, prefs, loadPrefs, announce, chats, chatOwner, loadAccountChats } = useStore();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const syncStarted = useRef<string | null>(null);
  const [syncedEmail, setSyncedEmail] = useState<string | null>(null);
  const lastUploaded = useRef<string | null>(null);
  /** Account whose chats are showing, and the version of each chat the server has. */
  const [chatsFor, setChatsFor] = useState<string | null>(null);
  const serverChats = useRef(new Map<string, number>());

  const applySession = useCallback((data: { user: AccountUser | null; methods: AuthMethods } | null) => {
    setUser(data?.user ?? null);
    setMethods(data?.methods ?? null);
    setReady(true);
  }, []);

  const loadSession = useCallback(
    () =>
      fetch('/api/auth/session', { cache: 'no-store' })
        .then((r) => r.json() as Promise<{ user: AccountUser | null; methods: AuthMethods }>)
        .catch(() => null),
    [],
  );

  const refresh = useCallback(async () => applySession(await loadSession()), [applySession, loadSession]);

  useEffect(() => {
    if (!hydrated || study) return;
    let active = true;
    void loadSession().then((data) => active && applySession(data));
    return () => {
      active = false;
    };
  }, [hydrated, study, loadSession, applySession]);

  // On sign-in: the account's saved preferences win; if it has none, save this device's.
  // Nothing is uploaded until this first load finishes, so a slow response can
  // never overwrite the account's saved copy with this device's (possibly empty) state.
  useEffect(() => {
    if (!user || study || syncStarted.current === user.email) return;
    syncStarted.current = user.email;
    const email = user.email;
    void (async () => {
      const res = await fetch('/api/account/preferences', { cache: 'no-store' }).catch(() => null);
      const data = res?.ok
        ? ((await res.json().catch(() => null)) as { preferences: Preferences | null } | null)
        : null;
      if (syncStarted.current !== email) return; // signed out meanwhile
      if (!data) {
        syncStarted.current = null; // couldn't load: retry later rather than risk overwriting
        return;
      }
      if (data.preferences) {
        const saved = normalisePreferences(data.preferences);
        lastUploaded.current = JSON.stringify(saved);
        loadPrefs(saved);
        setSyncNote('Loaded the preferences saved to your account.');
      } else {
        lastUploaded.current = JSON.stringify(prefs);
        if (prefs) {
          await putPrefs(prefs);
          setSyncNote('Saved this device’s preferences to your account.');
        }
      }
      setSyncedEmail(email);
    })();
  }, [user, study, prefs, loadPrefs]);

  // After that first load, every preference change (including reset) is saved to the account.
  useEffect(() => {
    if (!user || study || syncedEmail !== user.email) return;
    const serialised = JSON.stringify(prefs);
    if (serialised === lastUploaded.current) return;
    const timer = setTimeout(() => {
      lastUploaded.current = serialised;
      void putPrefs(prefs);
    }, 400);
    return () => clearTimeout(timer);
  }, [prefs, user, study, syncedEmail]);

  // On sign-in, show the account's chats instead of this device's.
  useEffect(() => {
    if (!user || study || chatsFor === user.email) return;
    const email = user.email;
    let active = true;
    void fetchChats().then((saved) => {
      if (!active || !saved) return; // couldn't load: keep showing this device's chats
      serverChats.current = new Map(saved.map((c) => [c.id, c.updatedAt]));
      loadAccountChats(saved);
      setChatsFor(email);
    });
    return () => {
      active = false;
    };
  }, [user, study, chatsFor, loadAccountChats]);

  // Then save new or changed chats, and remove deleted ones, shortly after each change.
  useEffect(() => {
    if (!user || study || chatOwner !== 'account' || chatsFor !== user.email) return;
    const timer = setTimeout(() => {
      const known = serverChats.current;
      for (const chat of chats) {
        if (known.get(chat.id) === chat.updatedAt) continue;
        known.set(chat.id, chat.updatedAt);
        void chatRequest(chat.id, { method: 'PUT', body: JSON.stringify({ chat }) });
      }
      for (const id of known.keys()) {
        if (chats.some((c) => c.id === id)) continue;
        known.delete(id);
        void chatRequest(id, { method: 'DELETE' });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [chats, chatOwner, chatsFor, user, study]);

  const forgetAccountChats = useCallback(() => {
    serverChats.current = new Map();
    setChatsFor(null);
    loadAccountChats(null);
  }, [loadAccountChats]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    syncStarted.current = null;
    setSyncedEmail(null);
    setUser(null);
    setSyncNote(null);
    // The preferences and chats belonged to the account; don't leave them on a possibly shared device.
    loadPrefs(null);
    forgetAccountChats();
    announce('You’re signed out.');
  }, [announce, loadPrefs, forgetAccountChats]);

  const deleteAccount = useCallback(async () => {
    const res = await fetch('/api/account', { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) return false;
    syncStarted.current = null;
    setSyncedEmail(null);
    setUser(null);
    setSyncNote(null);
    loadPrefs(null);
    forgetAccountChats();
    announce('Your account and saved data have been deleted.');
    return true;
  }, [announce, loadPrefs, forgetAccountChats]);

  return (
    <AccountContext.Provider value={{ ready, user, methods, syncNote, refresh, signOut, deleteAccount }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider');
  return ctx;
}
