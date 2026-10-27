'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { formatPrice, getProduct, isProductId } from '@/lib/catalogue.ts';
import type { AssistantErrorBody, AssistantReply } from '@/lib/assistant/shared.ts';
import { getAssistantOpener, useStore, type ChatMessage } from './store';

const CLIENT_TIMEOUT_MS = 40_000;

function suggestionsFor(productName: string | null, hasPrefs: boolean): string[] {
  if (productName)
    return [
      `What are the ingredients in ${productName}?`,
      'How do I use it?',
      hasPrefs ? 'Why was this recommended for me?' : 'Does it have added scent?',
      'Is there a cheaper alternative?',
    ];
  return [
    hasPrefs ? 'Where should I start?' : 'I’m new to oils. Where should I start?',
    'Show me hair oils under £20',
    'Which products contain essential oils?',
    'What’s the difference between Pure Argan Oil and Golden Jojoba Oil?',
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
  const { assistant, closeAssistant, setMessages, setAssistantProduct, compare, features, prefs, track } =
    store;
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
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

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [assistant.messages.length, pending]);

  const markFailed = (id: string, failed: string) =>
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, failed } : m)));

  async function send(text: string, retryId?: string) {
    const question = text.trim();
    if (!question || pending) return;
    const id = retryId ?? newId();
    const history = assistant.messages
      .filter((m) => !m.failed && m.id !== retryId)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((ms) =>
      retryId
        ? ms.map((m) => (m.id === retryId ? { ...m, failed: undefined } : m))
        : [...ms, { id, role: 'user', content: question }],
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
      setConfigured(data.mode);
      setMessages((ms) => [
        ...ms,
        { id: newId(), role: 'assistant', content: data.answer, productIds, mode: data.mode },
      ]);
      track('assistant_message', {
        productIds,
        detail: { mode: data.mode, withProduct: !!assistant.productId, rejectedIds: data.rejectedIds },
      });
    } catch (err) {
      markFailed(id, describeError(err));
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
        </div>

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
          {assistant.messages.map((m) => (
            <Message key={m.id} message={m} onRetry={() => send(m.content, m.id)} disabled={pending} />
          ))}
          {pending && <p className="assistant-pending">Checking the catalogue…</p>}
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
            {assistant.messages.length > 0 && (
              <>
                {' '}
                <button type="button" className="link-button" onClick={() => store.clearChat()}>
                  Clear conversation
                </button>
              </>
            )}
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Message({ message, onRetry, disabled }: { message: ChatMessage; onRetry: () => void; disabled: boolean }) {
  const { closeAssistant } = useStore();
  const products = (message.productIds ?? []).map(getProduct).filter((p) => !!p);
  return (
    <div className={`msg msg-${message.role}`}>
      <p className="sr-only">{message.role === 'user' ? 'You said:' : 'Assistant:'}</p>
      <div className="msg-text">{message.content}</div>
      {products.length > 0 && (
        <ul className="msg-products" aria-label="Products mentioned">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/products/${p.id}`} onClick={closeAssistant}>
                {p.name} <span>{formatPrice(p.pricePence)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {message.mode === 'offline' && <p className="msg-mode">Offline catalogue helper</p>}
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
