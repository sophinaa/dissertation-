'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, History, MessageSquarePlus, Plus, Send, Trash2, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { formatPrice, formatSize, getProduct, isProductId } from '@/lib/catalogue.ts';
import type { AssistantErrorBody, AssistantReply } from '@/lib/assistant/shared.ts';
import { GUEST_CHAT_TTL_DAYS, newChatId, type Conversation } from '@/lib/assistant/chats.ts';
import { getAssistantOpener, useStore, type ChatMessage } from './store';

const CLIENT_TIMEOUT_MS = 40_000;
/** The typing bubble stays at least this long, so instant offline replies still feel like a reply. */
const MIN_TYPING_MS = 700;
/** Replies type out over at most this long, whatever their length. */
const MAX_TYPE_MS = 1600;

/** Resolves once at least `ms` have passed since `since` (a timestamp from `startTimer`). */
const startTimer = () => Date.now();
const waitUntil = (since: number, ms: number) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, ms - (Date.now() - since))));

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Reveals `text` a few characters at a time. Returns the visible part and whether it has finished. */
function useTypewriter(text: string, active: boolean, onTick: () => void) {
  const [shown, setShown] = useState(active ? 0 : text.length);
  const done = shown >= text.length;
  useEffect(() => {
    if (done) return;
    const frame = 22;
    const step = Math.max(1, Math.ceil(text.length / (MAX_TYPE_MS / frame)));
    const timer = setInterval(() => setShown((n) => Math.min(text.length, n + step)), frame);
    return () => clearInterval(timer);
  }, [done, text.length]);
  useEffect(onTick, [shown, onTick]);
  return { visible: text.slice(0, shown), done, finish: () => setShown(text.length) };
}

function suggestionsFor(productName: string | null, hasPrefs: boolean): string[] {
  if (productName)
    return [
      `What are the ingredients in ${productName}?`,
      'How do I use it?',
      hasPrefs ? 'Why was this recommended for me?' : 'Does it have added scent?',
      'Is there a cheaper alternative?',
    ];
  // Everyday needs, phrased the way customers describe them.
  return [
    hasPrefs ? 'Where should I start?' : 'I’m new to oils. Where should I start?',
    'My hair is dry and frizzy',
    'My skin feels tight and dry',
    'Something for a self-care evening',
    'I’m allergic to nuts',
    'I need a gift',
  ];
}

function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') return 'The assistant took too long to respond.';
  return err instanceof Error ? err.message : 'Something went wrong.';
}

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function AssistantPanel() {
  const store = useStore();
  const {
    assistant,
    closeAssistant,
    setAssistantProduct,
    compare,
    features,
    prefs,
    track,
    chats,
    activeChatId,
    updateChat,
    openChat,
    newChat,
  } = store;
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  /** The newest reply, while it is being typed out. Restored conversations never animate. */
  const [typingId, setTypingId] = useState<string | null>(null);
  const [configured, setConfigured] = useState<'live' | 'offline' | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const product = assistant.productId ? getProduct(assistant.productId) : undefined;
  const activePrefs = features.personalisation ? prefs : null;

  // Place any suggested question in the input when the panel opens.
  const [seenPrefill, setSeenPrefill] = useState('');
  if (assistant.open && assistant.prefill && assistant.prefill !== seenPrefill) {
    setSeenPrefill(assistant.prefill);
    setInput(assistant.prefill);
  }

  useEffect(() => {
    if (!assistant.open) return;
    if (configured === null) {
      fetch('/api/assistant')
        .then((r) => r.json() as Promise<{ mode: 'live' | 'offline' }>)
        .then((d) => setConfigured(d.mode))
        .catch(() => setConfigured(null));
    }
  }, [assistant.open, configured]);

  const scrollToEnd = useCallback(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, []);
  useEffect(scrollToEnd, [assistant.messages.length, pending, scrollToEnd]);

  const markFailed = (chatId: string, id: string, failed: string) =>
    updateChat(chatId, (ms) => ms.map((m) => (m.id === id ? { ...m, failed } : m)));

  async function send(text: string, retryId?: string) {
    const question = text.trim();
    if (!question || pending) return;
    setTypingId(null);
    // Replies always go to the chat they were asked in, even if another is opened meanwhile.
    const chatId = activeChatId ?? newChatId();
    const setMessages = (update: Parameters<typeof updateChat>[1]) => updateChat(chatId, update);
    const id = retryId ?? newId();
    const started = startTimer();
    const history = assistant.messages
      .filter((m) => !m.failed && m.id !== retryId)
      .map((m) => ({ role: m.role, content: m.content }));
    updateChat(
      chatId,
      (ms) =>
        retryId
          ? ms.map((m) => (m.id === retryId ? { ...m, failed: undefined } : m))
          : [...ms, { id, role: 'user', content: question }],
      !activeChatId,
    );
    if (!retryId) setInput('');
    setPending(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: question }],
          context: {
            productId: assistant.productId ?? undefined,
            compareIds: compare,
            preferences: activePrefs ?? undefined,
          },
        }),
      });
      const data = (await res.json().catch(() => null)) as AssistantReply | AssistantErrorBody | null;
      if (!res.ok || !data || 'error' in data) {
        throw new Error(
          data && 'error' in data ? data.error.message : 'The assistant didn’t respond properly. Please try again.',
        );
      }
      const productIds = data.productIds.filter(isProductId);
      const animate = !prefersReducedMotion();
      if (animate) await waitUntil(started, MIN_TYPING_MS);
      const replyId = newId();
      if (animate) setTypingId(replyId);
      setConfigured(data.mode);
      setMessages((ms) => [
        ...ms,
        {
          id: replyId,
          role: 'assistant',
          content: data.answer,
          productIds,
          mode: data.mode,
          followUps: data.followUps ?? [],
          shopLink: data.shopLink?.href.startsWith('/shop?') ? data.shopLink : undefined,
        },
      ]);
      track('assistant_message', {
        productIds,
        detail: { mode: data.mode, withProduct: !!assistant.productId, rejectedIds: data.rejectedIds },
      });
    } catch (err) {
      markFailed(chatId, id, describeError(err));
      track('assistant_error');
    } finally {
      clearTimeout(timer);
      setPending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <Sheet open={assistant.open} onOpenChange={(open) => !open && closeAssistant()}>
      <SheetContent
        side="right"
        className="assistant"
        initialFocus={inputRef}
        finalFocus={() => getAssistantOpener() ?? true}
      >
        <div className="assistant-head">
          <SheetTitle className="assistant-title">Shopping assistant</SheetTitle>
          <SheetDescription className="assistant-mode">
            {configured === 'offline'
              ? 'Offline catalogue helper: rule-based, not AI. Live AI isn’t set up on this server.'
              : configured === 'live'
                ? 'AI assistant (Claude). Answers use only this shop’s catalogue and may still contain mistakes.'
                : 'Answers use only this shop’s catalogue information.'}
          </SheetDescription>
          <div className="assistant-actions">
            <button
              type="button"
              onClick={() => {
                newChat();
                setTypingId(null);
                setView('chat');
                inputRef.current?.focus();
              }}
              disabled={view === 'chat' && !activeChatId}
            >
              <MessageSquarePlus size={16} aria-hidden="true" /> New chat
            </button>
            <button
              type="button"
              aria-pressed={view === 'history'}
              onClick={() => setView((v) => (v === 'history' ? 'chat' : 'history'))}
            >
              <History size={16} aria-hidden="true" /> History
              {chats.length > 0 && <span className="count">{chats.length}</span>}
            </button>
          </div>
        </div>

        {view === 'history' ? (
          <ChatHistory
            onOpen={(id) => {
              openChat(id);
              setTypingId(null);
              setView('chat');
            }}
            onBack={() => setView('chat')}
          />
        ) : (
          <>

        <div className="assistant-context" aria-label="What the assistant knows">
          {product ? (
            <span className="context-chip">
              Asking about: <strong>{product.name}</strong>
              <button
                type="button"
                onClick={() => setAssistantProduct(null)}
                aria-label={`Stop asking about ${product.name}`}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          ) : (
            <span className="context-chip muted">No product selected</span>
          )}
          <span className="context-chip muted">
            {activePrefs ? 'Using your saved preferences' : 'No preferences used'}
          </span>
          {compare.length > 0 && <span className="context-chip muted">Comparing {compare.length}</span>}
        </div>

        <div className="assistant-log" ref={logRef} role="log" aria-live="polite" aria-busy={pending}>
          {assistant.messages.length === 0 && (
            <div className="assistant-empty">
              <p>Ask about ingredients, directions, prices, differences between products, or why something was suggested.</p>
              <ul className="suggestions" aria-label="Suggested questions">
                {suggestionsFor(product?.name ?? null, !!activePrefs).map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => send(s)}>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {assistant.messages.map((m, i) => (
            <Message
              key={m.id}
              message={m}
              onRetry={() => send(m.content, m.id)}
              onFollowUp={(q) => send(q)}
              latest={i === assistant.messages.length - 1}
              typing={m.id === typingId}
              onTyped={() => setTypingId((t) => (t === m.id ? null : t))}
              onTick={scrollToEnd}
              disabled={pending}
            />
          ))}
          {pending && (
            <div className="msg msg-assistant msg-typing">
              <span className="sr-only">The assistant is typing…</span>
              <span className="typing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          )}
        </div>

        <form
          className="assistant-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <label htmlFor="assistant-input">Your question</label>
          <div className="assistant-input-row">
            <textarea
              id="assistant-input"
              ref={inputRef}
              rows={2}
              maxLength={1000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={product ? `Ask about ${product.name}` : 'e.g. Which hair oils have no added scent?'}
            />
            <button type="submit" className="btn btn-primary" disabled={pending || !input.trim()}>
              <Send size={16} aria-hidden="true" />
              <span className="sr-only">Send</span>
            </button>
          </div>
          <p className="hint">
            Not medical advice. For skin or scalp conditions, allergies or reactions, ask a pharmacist or GP.
          </p>
        </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const formatWhen = (t: number) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(t);

function ChatHistory({ onOpen, onBack }: { onOpen: (id: string) => void; onBack: () => void }) {
  const { chats, activeChatId, chatOwner, study, deleteChat, deleteAllChats, announce } = useStore();
  const [confirmAll, setConfirmAll] = useState(false);
  const where = study
    ? 'Kept for this study session only.'
    : chatOwner === 'account'
      ? 'Saved to your account, so they’re available wherever you sign in.'
      : `Saved on this device for ${GUEST_CHAT_TTL_DAYS} days. Sign in to keep them with your account.`;
  const remove = (chat: Conversation) => {
    deleteChat(chat.id);
    announce(`Deleted “${chat.title}”.`);
  };
  return (
    <div className="assistant-history">
      <button type="button" className="link-button history-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to chat
      </button>
      <h3>Your chats</h3>
      <p className="hint">{where}</p>
      {chats.length === 0 ? (
        <p className="history-empty">No saved chats yet. Ask a question and it will appear here.</p>
      ) : (
        <>
          <ul className="history-list">
            {chats.map((c) => (
              <li key={c.id} className={c.id === activeChatId ? 'current' : undefined}>
                <button type="button" className="history-open" onClick={() => onOpen(c.id)}>
                  <span className="history-title">{c.title}</span>
                  <span className="history-meta">
                    {formatWhen(c.updatedAt)} · {c.messages.length} message{c.messages.length === 1 ? '' : 's'}
                    {c.id === activeChatId ? ' · open now' : ''}
                  </span>
                </button>
                <button type="button" className="history-delete" aria-label={`Delete chat “${c.title}”`} onClick={() => remove(c)}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {confirmAll ? (
            <p className="history-confirm" role="alert">
              Delete all {chats.length} chats? This can’t be undone.{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  deleteAllChats();
                  setConfirmAll(false);
                  announce('All chats deleted.');
                }}
              >
                Delete all
              </button>{' '}
              <button type="button" className="link-button" onClick={() => setConfirmAll(false)}>
                Cancel
              </button>
            </p>
          ) : (
            <button type="button" className="link-button" onClick={() => setConfirmAll(true)}>
              Delete all chats
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Message({
  message,
  onRetry,
  onFollowUp,
  latest,
  typing,
  onTyped,
  onTick,
  disabled,
}: {
  message: ChatMessage;
  onRetry: () => void;
  onFollowUp: (question: string) => void;
  latest: boolean;
  typing: boolean;
  onTyped: () => void;
  onTick: () => void;
  disabled: boolean;
}) {
  const { closeAssistant, addToBasket, basket, compare, toggleCompare, announce } = useStore();
  const { visible, done, finish } = useTypewriter(message.content, typing, onTick);
  useEffect(() => {
    if (typing && done) onTyped();
  }, [typing, done, onTyped]);
  // Cards and buttons appear once the text has finished typing.
  const products = done ? (message.productIds ?? []).map(getProduct).filter((p) => !!p) : [];
  // Only the newest reply offers next steps, so older buttons can't jump the conversation back.
  const followUps = latest && done ? (message.followUps ?? []) : [];
  return (
    <div className={`msg msg-${message.role}`}>
      <p className="sr-only">{message.role === 'user' ? 'You said:' : 'Assistant:'}</p>
      {done ? (
        <div className="msg-text">{message.content}</div>
      ) : (
        <>
          {/* Screen readers get the whole reply once; the typing is visual only. */}
          <div className="sr-only">{message.content}</div>
          <div className="msg-text" aria-hidden="true" onClick={finish}>
            {visible}
            <span className="typing-caret" />
          </div>
        </>
      )}
      {products.length > 0 && (
        <ul className="msg-products" aria-label="Products mentioned">
          {products.map((p) => {
            const inBasket = basket.some((l) => l.id === p.id);
            const comparing = compare.includes(p.id);
            return (
              <li key={p.id} className="msg-product">
                <Link href={`/products/${p.id}`} onClick={closeAssistant}>
                  <span className="msg-product-name">{p.name}</span>
                  <span className="msg-product-meta">
                    {formatPrice(p.pricePence)} · {formatSize(p)}
                  </span>
                </Link>
                <div className="msg-product-actions">
                  <button
                    type="button"
                    aria-pressed={comparing}
                    aria-label={`${comparing ? 'Remove' : 'Add'} ${p.name} ${comparing ? 'from' : 'to'} comparison`}
                    onClick={() => {
                      const result = toggleCompare(p.id);
                      announce(
                        result === 'full'
                          ? 'You can compare up to three products. Remove one first.'
                          : `${p.name} ${result === 'added' ? 'added to' : 'removed from'} comparison.`,
                      );
                    }}
                  >
                    {comparing && <Check size={14} aria-hidden="true" />} Compare
                  </button>
                  {p.availability === 'out-of-stock' ? (
                    <span className="msg-product-note">Out of stock</span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Add ${p.name} to basket`}
                      onClick={() => {
                        addToBasket(p.id);
                        announce(`${p.name} added to your basket.`);
                      }}
                    >
                      {inBasket ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}{' '}
                      {inBasket ? 'In basket' : 'Basket'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {done && message.shopLink && (
        <Link className="msg-shop-link" href={message.shopLink.href} onClick={closeAssistant}>
          {message.shopLink.label} →
        </Link>
      )}
      {done && message.mode === 'offline' && <p className="msg-mode">Offline catalogue helper</p>}
      {followUps.length > 0 && (
        <ul className="follow-ups" aria-label="Suggested next questions">
          {followUps.map((q) => (
            <li key={q}>
              <button type="button" onClick={() => onFollowUp(q)} disabled={disabled}>
                {q}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message.failed && (
        <p className="msg-error" role="alert">
          Not answered: {message.failed}{' '}
          <button type="button" className="link-button" onClick={onRetry} disabled={disabled}>
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
