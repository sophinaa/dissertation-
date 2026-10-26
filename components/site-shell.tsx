'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Menu, MessageCircle, Scale, ShoppingBag, X } from 'lucide-react';
import { tasksFor } from '@/lib/study.ts';
import { AssistantPanel } from './assistant-panel';
import { useStore } from './store';

function NavLink({ href, children, onNavigate }: { href: string; children: ReactNode; onNavigate: () => void }) {
  const pathname = usePathname();
  const base = href.split('?')[0];
  const current = base === '/' ? pathname === '/' : pathname.startsWith(base) && !href.includes('?');
  return (
    <Link href={href} aria-current={current ? 'page' : undefined} onClick={onNavigate}>
      {children}
    </Link>
  );
}

function StudyBar() {
  const { study, completeTask } = useStore();
  if (!study) return null;
  const tasks = tasksFor(study.condition);
  const task = tasks[study.taskIndex];
  return (
    <section className="study-bar" aria-label="Study task">
      {task ? (
        <>
          <p>
            <strong>
              Task {study.taskIndex + 1} of {tasks.length}:
            </strong>{' '}
            {task.text}
          </p>
          <button type="button" className="btn btn-secondary btn-small" onClick={completeTask}>
            I’ve finished this task
          </button>
        </>
      ) : (
        <p>
          <strong>All tasks complete.</strong> Please let the researcher know you have finished.
        </p>
      )}
    </section>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const { basket, compare, features, openAssistant, announcement, track, hydrated, study } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const itemCount = basket.reduce((n, l) => n + l.qty, 0);

  useEffect(() => {
    if (hydrated) track('page_view', { detail: { path: pathname } });
  }, [pathname, hydrated, track]);

  const close = () => setMenuOpen(false);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <div className="prototype-bar">
        <span>Prototype · demo products · no real orders</span>
      </div>
      {study && <StudyBar />}
      <header className="site-header">
        <Link href="/" className="brand" onClick={close}>
          botanical &amp; you
        </Link>
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          Menu
        </button>
        <nav id="site-nav" aria-label="Main" className={menuOpen ? 'open' : ''}>
          <ul>
            <li>
              <NavLink href="/shop" onNavigate={close}>
                Shop all
              </NavLink>
            </li>
            <li>
              <NavLink href="/shop?area=skin" onNavigate={close}>
                Skin
              </NavLink>
            </li>
            <li>
              <NavLink href="/shop?area=hair" onNavigate={close}>
                Hair
              </NavLink>
            </li>
            {features.personalisation && (
              <li>
                <NavLink href="/recommendations" onNavigate={close}>
                  Find my products
                </NavLink>
              </li>
            )}
            {features.finder && (
              <li>
                <NavLink href="/finder" onNavigate={close}>
                  Product finder
                </NavLink>
              </li>
            )}
            <li>
              <NavLink href="/about" onNavigate={close}>
                About
              </NavLink>
            </li>
          </ul>
        </nav>
        <div className="header-actions">
          {features.assistant && (
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => {
                close();
                openAssistant({ productId: null });
              }}
            >
              <MessageCircle size={16} aria-hidden="true" /> Ask
              <span className="sr-only"> the shopping assistant</span>
            </button>
          )}
          <Link href="/compare" className="btn btn-quiet btn-small" onClick={close}>
            <Scale size={16} aria-hidden="true" /> Compare
            <span className="count" aria-label={`${compare.length} selected`}>
              {compare.length}
            </span>
          </Link>
          <Link href="/basket" className="btn btn-quiet btn-small" onClick={close}>
            <ShoppingBag size={16} aria-hidden="true" /> Basket
            <span className="count" aria-label={`${itemCount} items`}>
              {itemCount}
            </span>
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div>
          <p className="brand small">botanical &amp; you</p>
          <p>A dissertation prototype. Products are demos; nothing can be bought.</p>
        </div>
        <ul>
          <li>
            <Link href="/shop">Shop all products</Link>
          </li>
          {features.personalisation && (
            <li>
              <Link href="/preferences">Your preferences</Link>
            </li>
          )}
          <li>
            <Link href="/about">About this prototype</Link>
          </li>
          <li>
            <Link href="/contact">Contact</Link>
          </li>
        </ul>
      </footer>
      <div className="toast" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {features.assistant && <AssistantPanel />}
    </>
  );
}
