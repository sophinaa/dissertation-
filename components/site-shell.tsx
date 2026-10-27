'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, MessageCircle, Scale, ShoppingBag, UserRound, X } from 'lucide-react';
import { tasksFor } from '@/lib/study.ts';
import { useAccount } from './account';
import { Logo } from './logo';
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
  const account = useAccount();
  const showAccount = !study && account.ready && !!account.methods?.enabled;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const itemCount = basket.reduce((n, l) => n + l.qty, 0);

  useEffect(() => {
    if (hydrated) track('page_view', { detail: { path: pathname } });
  }, [pathname, hydrated, track]);

  const close = () => setMenuOpen(false);

  // Escape closes the mobile menu from anywhere and returns focus to its button.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

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
        <div className="header-inner">
          <Link href="/" className="brand" onClick={close} aria-label="Botanical & You, home">
            <Logo />
          </Link>
          <nav id="site-nav" aria-label="Main" className={menuOpen ? 'open' : ''}>
            <ul>
              <li>
                <NavLink href="/shop" onNavigate={close}>
                  Shop
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
                    For you
                  </NavLink>
                </li>
              )}
              {features.finder && (
                <li>
                  <NavLink href="/finder" onNavigate={close}>
                    Finder
                  </NavLink>
                </li>
              )}
              <li>
                <NavLink href="/about" onNavigate={close}>
                  About
                </NavLink>
              </li>
              <li className="menu-only">
                <NavLink href="/compare" onNavigate={close}>
                  Compare{compare.length > 0 ? ` (${compare.length})` : ''}
                </NavLink>
              </li>
              {showAccount && (
                <li className="menu-only">
                  <NavLink href={account.user ? '/account' : '/signin'} onNavigate={close}>
                    {account.user ? 'Account' : 'Sign in'}
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>
          <div className="header-actions">
            {features.assistant && (
              <button
                type="button"
                className="ask-button"
                onClick={() => {
                  close();
                  openAssistant({ productId: null });
                }}
              >
                <MessageCircle size={17} aria-hidden="true" />
                <span className="ask-label">Ask</span>
                <span className="sr-only"> the shopping assistant</span>
              </button>
            )}
            <Link
              href="/compare"
              className="icon-button hide-small"
              onClick={close}
              aria-label={`Compare, ${compare.length} selected`}
              aria-current={pathname === '/compare' ? 'page' : undefined}
            >
              <Scale size={18} aria-hidden="true" />
              {compare.length > 0 && (
                <span className="badge" aria-hidden="true">
                  {compare.length}
                </span>
              )}
            </Link>
            <Link
              href="/basket"
              className="icon-button"
              onClick={close}
              aria-label={`Basket, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
              aria-current={pathname === '/basket' ? 'page' : undefined}
            >
              <ShoppingBag size={18} aria-hidden="true" />
              {itemCount > 0 && (
                <span className="badge" aria-hidden="true">
                  {itemCount}
                </span>
              )}
            </Link>
            {showAccount && (
              <Link
                href={account.user ? '/account' : '/signin'}
                className="icon-button hide-small"
                onClick={close}
                aria-label={account.user ? 'Account' : 'Sign in'}
                aria-current={pathname === '/account' || pathname === '/signin' ? 'page' : undefined}
              >
                <UserRound size={18} aria-hidden="true" />
              </Link>
            )}
            <button
              ref={menuButton}
              type="button"
              className="icon-button menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="site-nav"
              aria-label={menuOpen ? 'Close menu' : 'Menu'}
              onClick={() => {
                const opening = !menuOpen;
                setMenuOpen(opening);
                // Move keyboard focus into the menu so Tab continues through its links.
                if (opening) requestAnimationFrame(() => document.querySelector<HTMLElement>('#site-nav a')?.focus());
              }}
            >
              {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div>
          <p className="brand small">
            <Logo />
            <span className="sr-only">Botanical &amp; You</span>
          </p>
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
          <li>
            <Link href="/privacy">Privacy</Link>
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
