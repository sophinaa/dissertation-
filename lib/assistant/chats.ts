// Saved assistant conversations. Guests keep them in this browser; signed-in
// customers keep them in their account. Everything read back from storage or
// sent to the server passes through normaliseConversation first, so a stored
// chat can never render an unknown product or a link outside the shop.

import { isProductId } from '../catalogue.ts';
import { cleanFollowUps } from './shared.ts';

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  productIds?: string[];
  mode?: 'live' | 'offline';
  followUps?: string[];
  shopLink?: { href: string; label: string };
  /** Set on a user message whose request failed, so it can be retried. */
  failed?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
}

export const MAX_CHATS = 20;
export const MAX_CHAT_MESSAGES = 40;
export const MAX_STORED_CHARS = 4000;
const MAX_TITLE = 60;
/** Guest chats on a device are removed after this long without use. */
export const GUEST_CHAT_TTL_DAYS = 30;

const ID = /^[a-z0-9-]{4,40}$/;

export const isChatId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);

let counter = 0;
export const newChatId = () => `c-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** A short title from the first question, e.g. "My hair is dry and frizzy". */
export function chatTitle(messages: StoredMessage[]): string {
  const first = messages.find((m) => m.role === 'user')?.content.replace(/\s+/g, ' ').trim() ?? '';
  if (!first) return 'New chat';
  return first.length > MAX_TITLE ? `${first.slice(0, MAX_TITLE - 1).trimEnd()}…` : first;
}

function normaliseMessage(raw: unknown): StoredMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return null;
  const content = m.content.slice(0, MAX_STORED_CHARS);
  if (!content.trim()) return null;
  const msg: StoredMessage = {
    id: typeof m.id === 'string' && m.id.length <= 40 ? m.id : `m-${Math.random().toString(36).slice(2, 10)}`,
    role: m.role,
    content,
  };
  if (Array.isArray(m.productIds)) msg.productIds = [...new Set(m.productIds.filter(isProductId))].slice(0, 6);
  if (m.mode === 'live' || m.mode === 'offline') msg.mode = m.mode;
  const followUps = cleanFollowUps(m.followUps);
  if (followUps.length) msg.followUps = followUps;
  const link = m.shopLink as Record<string, unknown> | undefined;
  if (
    link &&
    typeof link.href === 'string' &&
    link.href.startsWith('/shop?') &&
    link.href.length <= 300 &&
    typeof link.label === 'string'
  )
    msg.shopLink = { href: link.href, label: link.label.slice(0, 60) };
  if (typeof m.failed === 'string') msg.failed = m.failed.slice(0, 200);
  return msg;
}

/** Validate an untrusted conversation. Returns null if nothing usable is left. */
export function normaliseConversation(raw: unknown): Conversation | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (!isChatId(c.id) || !Array.isArray(c.messages)) return null;
  const messages = c.messages
    .map(normaliseMessage)
    .filter((m): m is StoredMessage => !!m)
    .slice(-MAX_CHAT_MESSAGES);
  if (!messages.length) return null;
  const now = Date.now();
  const time = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= now + 60_000 ? v : now);
  return {
    id: c.id,
    title: chatTitle(messages),
    createdAt: time(c.createdAt),
    updatedAt: time(c.updatedAt),
    messages,
  };
}

/** Newest first, capped at MAX_CHATS. */
export function sortChats(chats: Conversation[]): Conversation[] {
  return [...chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
}
