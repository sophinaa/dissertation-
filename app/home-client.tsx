'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_LABELS, PRODUCTS, type Category } from '@/lib/catalogue.ts';
import { summarisePreferences } from '@/lib/recommend.ts';
import { CoverArt, SpineArt, type Inks, type Motif } from '@/components/shelf-art';
import { ResetPreferencesButton, UpdatedNotice } from '@/components/preference-ui';
import { useActivePrefs, useStore } from '@/components/store';

type Group = 'skin' | 'hair' | 'gifts' | 'help';

const GROUPS: { id: Group | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'skin', label: 'Skin' },
  { id: 'hair', label: 'Hair' },
  { id: 'gifts', label: 'Gifts' },
  { id: 'help', label: 'Help me choose' },
];

const GROUP_LABELS: Record<Group, string> = { skin: 'Skin', hair: 'Hair', gifts: 'Gifts', help: 'Help me choose' };

interface ShelfItem {
  id: string;
  title: string;
  group: Group;
  kicker: string;
  meta: string;
  cta: { label: string; href: string } | { label: string; assistant: true };
  motif: Motif;
  inks: Inks;
  no: number;
}

const INKS: Record<string, Inks> = {
  forest: { bg: '#2f4f2f', ink: '#f3ead2', accent: '#d98a3a' },
  cream: { bg: '#efe7cf', ink: '#2f4f2f', accent: '#c4572e' },
  olive: { bg: '#5f7a32', ink: '#f3ead2', accent: '#26361b' },
  clay: { bg: '#b85a35', ink: '#f6ecd4', accent: '#2f4f2f' },
  ochre: { bg: '#d9a441', ink: '#2b3320', accent: '#f6ecd4' },
  sage: { bg: '#d3dec0', ink: '#2f4f2f', accent: '#b85a35' },
};

function categoryItem(
  category: Category,
  group: Group,
  kicker: string,
  motif: Motif,
  inks: Inks,
): Omit<ShelfItem, 'no'> {
  const count = PRODUCTS.filter((p) => p.category === category).length;
  const label = CATEGORY_LABELS[category];
  return {
    id: category,
    title: label,
    group,
    kicker,
    meta: `${count} ${count === 1 ? 'product' : 'products'} / ${GROUP_LABELS[group]} / Shop category`,
    cta: { label: `Shop ${label.toLowerCase()}`, href: `/shop?category=${category}` },
    motif,
    inks,
  };
}

function buildItems(features: { personalisation: boolean; finder: boolean; assistant: boolean }, hasPrefs: boolean): ShelfItem[] {
  const items: Omit<ShelfItem, 'no'>[] = [
    categoryItem('face-oil', 'skin', 'Skin / Face', 'drop', INKS.forest),
    categoryItem('body-care', 'skin', 'Skin / Body', 'sun', INKS.cream),
    categoryItem('multi-use-oil', 'skin', 'Skin & hair', 'leaf', INKS.olive),
    categoryItem('hair-oil', 'hair', 'Hair / Lengths', 'wave', INKS.clay),
    categoryItem('scalp-oil', 'hair', 'Hair / Scalp', 'roots', INKS.sage),
    categoryItem('set', 'gifts', 'Gifts', 'sprig', INKS.ochre),
  ];
  if (features.finder) {
    items.push({
      id: 'finder',
      title: 'Product finder',
      group: 'help',
      kicker: 'Help me choose / Guided',
      meta: 'A few quick questions / Answers stay temporary',
      cta: { label: 'Start the finder', href: '/finder' },
      motif: 'compass',
      inks: INKS.cream,
    });
  }
  if (features.personalisation) {
    items.push({
      id: 'matches',
      title: hasPrefs ? 'Your matches' : 'Find your matches',
      group: 'help',
      kicker: 'Help me choose / Personal',
      meta: hasPrefs ? 'Based on your saved preferences' : '5 short steps / Edit or reset any time',
      cta: hasPrefs ? { label: 'See your matches', href: '/recommendations' } : { label: 'Set preferences', href: '/preferences' },
      motif: 'star',
      inks: INKS.forest,
    });
  }
  if (features.assistant) {
    items.push({
      id: 'assistant',
      title: 'Ask the assistant',
      group: 'help',
      kicker: 'Help me choose / Chat',
      meta: 'Answers come from this catalogue only',
      cta: { label: 'Open the assistant', assistant: true },
      motif: 'speech',
      inks: INKS.olive,
    });
  }
  items.push({
    id: 'about',
    title: 'About the prototype',
    group: 'help',
    kicker: 'Dissertation prototype',
    meta: 'Demo products / No real orders',
    cta: { label: 'Read about it', href: '/about' },
    motif: 'book',
    inks: INKS.clay,
  });
  return items.map((item, i) => ({ ...item, no: i + 1 }));
}

const COPIES = 3;
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const TILT_Z = -4.5;

const smoothstep = (x: number) => x * x * (3 - 2 * x);
const bump = (r: number) => (Math.abs(r) < 1 ? (r + Math.sin(Math.PI * r) / Math.PI) / 2 : Math.sign(r) * 0.5);
const mod = (a: number, n: number) => ((a % n) + n) % n;

function Shelf({ items, onOpen }: { items: ShelfItem[]; onOpen: (item: ShelfItem) => void }) {
  const n = items.length;
  const [active, setActive] = useState(0);
  const item = items[active] ?? items[0];
  const onOpenRef = useRef(onOpen);
  useLayoutEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  const heroRef = useRef<HTMLElement>(null);
  const engine = useRef<{ go: (delta: number) => void; goTo: (index: number) => void; open: () => void } | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  // Slides the green tab block under the active item's group.
  const placeIndicator = useCallback(() => {
    const tab = tabsRef.current?.querySelector<HTMLElement>(`[data-group="${item.group}"]`);
    const ind = indicatorRef.current;
    if (!tab || !ind) return;
    ind.style.width = `${tab.offsetWidth}px`;
    ind.style.transform = `translateX(${tab.offsetLeft}px)`;
  }, [item.group]);

  useLayoutEffect(() => {
    placeIndicator();
    window.addEventListener('resize', placeIndicator);
    void document.fonts?.ready.then(placeIndicator);
    return () => window.removeEventListener('resize', placeIndicator);
  }, [placeIndicator]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const q = <T extends Element>(sel: string) => hero.querySelector<T>(sel)!;
    const wrap = q<HTMLElement>('.shelf-wrap');
    const stage = q<HTMLElement>('.shelf-stage');
    const tapes = Array.from(hero.querySelectorAll<HTMLElement>('.tape'));
    const spines = tapes.map((t) => t.querySelector<HTMLElement>('.tape-spine')!);
    const covers = tapes.map((t) => t.querySelector<HTMLElement>('.tape-cover')!);
    const play = q<HTMLElement>('.shelf-play');
    const cursor = q<HTMLElement>('.shelf-cursor');
    const captionMasks = Array.from(hero.querySelectorAll<HTMLElement>('.shelf-caption .mask'));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const total = n * COPIES;

    let H = 0, ws = 0, d = 0, gap = 0, W = 0;
    const measure = () => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--H);width:1px';
      hero.appendChild(probe);
      H = probe.getBoundingClientRect().height;
      probe.remove();
      ws = (H * 142) / 840;
      d = (H * 474) / 900;
      gap = H * 0.03;
      stage.style.setProperty('--h', `${H}px`);
      stage.style.setProperty('--ws', `${ws}px`);
      stage.style.setProperty('--d', `${d}px`);
    };
    measure();

    let s = n; // middle copy, first item
    let T = s;
    let dragging = false;
    let hover = -1;
    let current = 0;
    let mx = -1e4, my = -1e4, cx = mx, cy = my;
    let tiltX = 0, tiltY = 0;
    let onCover = false;
    let inside = false;
    let visible = true;
    let lastTarget: EventTarget | null = null;
    const lift = new Float32Array(total);

    // Caption: each change slides a new line in through its mask and the old one out.
    const swapCaption = (i: number, dir: number) => {
      const it = items[i];
      const texts = [it.title, it.kicker, it.meta.split(' / ')[0]];
      captionMasks.forEach((mask, k) => {
        const next = document.createElement('span');
        next.textContent = texts[k];
        if (reduced) {
          mask.replaceChildren(next);
          return;
        }
        mask.appendChild(next);
        next.animate([{ transform: `translateY(${dir * 105}%)` }, { transform: 'translateY(0)' }], {
          duration: 650,
          easing: EASE,
          fill: 'both',
        });
        for (const old of Array.from(mask.children) as HTMLElement[]) {
          if (old === next || old.dataset.leaving) continue;
          old.dataset.leaving = '1';
          old
            .animate([{ transform: getComputedStyle(old).transform }, { transform: `translateY(${-dir * 105}%)` }], {
              duration: 650,
              easing: EASE,
              fill: 'both',
            })
            .finished.then(() => old.remove(), () => {});
        }
      });
    };
    swapCaption(0, 1);
    setActive(0);

    const relative = (v: number) => {
      let r = mod(v - s, total);
      if (r > total / 2) r -= total;
      return r;
    };

    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;

      const k = reduced ? 1 : 1 - Math.exp(-(dragging ? 18 : 5.2) * dt);
      s += (T - s) * k;
      if (Math.abs(T - s) < 1e-4) s = T;
      const loop = total * 4;
      if (Math.abs(s) > loop) {
        const shift = Math.trunc(s / total) * total;
        s -= shift;
        T -= shift;
      }

      const idx = mod(Math.round(s), n);
      if (idx !== current) {
        swapCaption(idx, Math.sign(T - s) || 1);
        current = idx;
        setActive(idx);
      }

      const rect = wrap.getBoundingClientRect();
      W = rect.width;
      const midX = rect.left + W / 2;
      const midY = rect.top + rect.height / 2;
      const settled = Math.abs(T - s) < 0.3;

      onCover = settled && Math.abs(mx - midX) < 0.55 * d && Math.abs(my - midY) < 0.55 * H;
      const tk = 1 - Math.exp(-7 * dt);
      const tyTarget = onCover ? ((mx - midX) / (0.55 * d)) * 9 : inside ? ((mx - midX) / W) * 5 : 0;
      const txTarget = onCover ? (-(my - midY) / (H / 2)) * 6 : 0;
      tiltY += (tyTarget - tiltY) * tk;
      tiltX += (txTarget - tiltX) * tk;

      const lk = reduced ? 1 : 1 - Math.exp(-12 * dt);
      const limit = W / 2 + 1.5 * d;
      for (let v = 0; v < total; v++) {
        const r = relative(v);
        const x = r * (ws + gap) + (d - ws + 1.6 * gap) * bump(r);
        const tape = tapes[v];
        if (Math.abs(x) > limit) {
          tape.style.visibility = 'hidden';
          continue;
        }
        tape.style.visibility = '';
        lift[v] += ((hover === v && Math.abs(r) > 0.5 ? 1 : 0) - lift[v]) * lk;
        const o = smoothstep(Math.max(0, 1 - Math.abs(r)));
        const y = -o * 0.025 * H - lift[v] * 0.045 * H;
        tape.style.transform =
          `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${(o * 0.2 * H).toFixed(2)}px) ` +
          `rotateZ(${(TILT_Z * o).toFixed(3)}deg) rotateX(${(tiltX * o).toFixed(3)}deg) rotateY(${(-90 * o + tiltY * o).toFixed(3)}deg)`;
        tape.style.zIndex = String(Math.round(100 - Math.abs(r) * 4));
        spines[v].style.setProperty('--shade', (o * 0.55).toFixed(3));
        covers[v].style.setProperty('--shade', ((1 - o) * 0.5).toFixed(3));
      }

      setCursor(lastTarget);

      const ps = smoothstep(Math.max(0, 1 - Math.abs(T - s) * 3));
      play.style.transform = `translate(-50%, -50%) scale(${ps.toFixed(3)})`;

      if (fine) {
        const ck = 1 - Math.exp(-16 * dt);
        cx += (mx - cx) * ck;
        cy += (my - cy) * ck;
        cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      }
    };

    // Pointer, cursor and hover
    const setCursor = (target: EventTarget | null) => {
      if (!fine) return;
      const el = target instanceof Element ? target : null;
      const overTape = el?.closest('.tape');
      const overSpine = overTape && hover >= 0 && Math.abs(relative(hover)) > 0.5;
      cursor.classList.toggle('is-open', onCover && !overSpine);
      cursor.classList.toggle('is-spine', !!overSpine);
      cursor.classList.toggle('is-btn', !onCover && !overTape && !!el?.closest('button, a'));
    };
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      lastTarget = e.target;
      if (cx < -1e3) {
        cx = mx;
        cy = my;
      }
      if (dragging || pressX !== null) dragMove(e);
    };
    const onEnter = () => {
      inside = true;
      cursor.classList.add('is-visible');
    };
    const onLeave = () => {
      inside = false;
      hover = -1;
      cursor.classList.remove('is-visible');
    };
    const onOver = (e: PointerEvent) => {
      const tape = (e.target as Element).closest<HTMLElement>('.tape');
      hover = tape ? Number(tape.dataset.v) : -1;
    };

    // Drag to scrub
    let pressX: number | null = null;
    let pressT = 0;
    let dragged = false;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      pressX = e.clientX;
      pressT = T;
      dragged = false;
    };
    const dragMove = (e: PointerEvent) => {
      if (pressX === null) return;
      const dx = e.clientX - pressX;
      if (!dragging && Math.abs(dx) > 5) {
        dragging = true;
        dragged = true;
      }
      if (dragging) T = pressT - dx / (ws + gap);
    };
    const onUp = () => {
      if (pressX === null) return;
      pressX = null;
      if (dragging) {
        dragging = false;
        T = Math.round(T);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (dragged) {
        dragged = false;
        return;
      }
      // Browsers don't reliably hit-test the turned cover, so test its on-screen box first.
      const box = covers[mod(Math.round(s), total)].getBoundingClientRect();
      if (e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom) {
        open();
        return;
      }
      const tape = (e.target as Element).closest<HTMLElement>('.tape');
      if (!tape) return;
      const r = relative(Number(tape.dataset.v));
      if (Math.abs(r) < 0.5) open();
      else T = Math.round(T + r);
    };

    // Sideways wheel or trackpad swipe. Vertical scrolling is left alone so the page still scrolls.
    let wheelTimer = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      T += (e.deltaX / (ws + gap)) * 0.5;
      clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => (T = Math.round(T)), 160);
    };

    // The cover goes straight to its page.
    const open = () => {
      T = Math.round(T);
      onOpenRef.current(items[mod(T, n)]);
    };

    const onKey = (e: KeyboardEvent) => {
      const focus = document.activeElement;
      const free = !focus || focus === document.body || focus.id === 'main';
      if (!free && !(hero.contains(focus) && focus.tagName === 'BUTTON')) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        T = Math.round(T) + (e.key === 'ArrowLeft' ? -1 : 1);
      } else if (e.key === 'Enter' && free) {
        open();
      }
    };

    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(hero);
    const onResize = () => measure();

    hero.addEventListener('pointerenter', onEnter);
    hero.addEventListener('pointerleave', onLeave);
    hero.addEventListener('pointerover', onOver);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('click', onClick);
    wrap.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(frame);

    engine.current = {
      go: (delta) => {
        T = Math.round(T) + delta;
      },
      goTo: (index) => {
        const base = Math.round(T);
        let delta = index - mod(base, n);
        if (delta > n / 2) delta -= n;
        if (delta < -n / 2) delta += n;
        T = base + delta;
      },
      open,
    };

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(wheelTimer);
      io.disconnect();
      hero.removeEventListener('pointerenter', onEnter);
      hero.removeEventListener('pointerleave', onLeave);
      hero.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      wrap.removeEventListener('pointerdown', onDown);
      wrap.removeEventListener('click', onClick);
      wrap.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      captionMasks.forEach((m) => m.replaceChildren());
      engine.current = null;
    };
  }, [items, n]);

  const goToGroup = (group: Group | 'all') => {
    const index = group === 'all' ? 0 : items.findIndex((it) => it.group === group);
    if (index >= 0) engine.current?.goTo(index);
  };

  return (
    <section className="shelf-hero" ref={heroRef} aria-labelledby="shelf-heading">
      <div className="shelf-top">
        <h1 id="shelf-heading" className="lbl">
          Oils for skin &amp; hair
        </h1>
        <p className="lbl shelf-top-right">Clear ingredients · Simple routines</p>
      </div>

      <nav className="shelf-tabs" aria-label="Browse by area">
        <div ref={tabsRef}>
          <span className="shelf-tab-indicator" ref={indicatorRef} aria-hidden="true" />
          {GROUPS.filter((g) => g.id === 'all' || items.some((it) => it.group === g.id)).map((g) => (
            <button
              key={g.id}
              type="button"
              data-group={g.id}
              className={`lbl box${g.id === item.group ? ' is-active' : ''}`}
              aria-pressed={g.id === item.group}
              onClick={() => goToGroup(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="shelf-wrap" aria-hidden="true">
        <div className="shelf-stage">
          {Array.from({ length: COPIES }, (_, copy) =>
            items.map((it, i) => (
              <div className="tape" key={`${copy}-${it.id}`} data-v={copy * n + i}>
                <div className="tape-face tape-spine">
                  <SpineArt item={it} />
                </div>
                <div className="tape-face tape-cover">
                  <CoverArt item={it} />
                </div>
              </div>
            )),
          )}
        </div>
      </div>

      <button type="button" className="shelf-play" aria-label={item.cta.label} onClick={() => engine.current?.open()}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 1 L11 6 L2 11 Z" fill="currentColor" />
        </svg>
      </button>

      <div className="shelf-caption" aria-hidden="true">
        <div className="mask cap-title" />
        <div className="mask cap-kicker lbl" />
        <div className="mask cap-meta" />
      </div>
      <p className="sr-only" aria-live="polite">
        {item.title}, {item.kicker}. {active + 1} of {n}.
      </p>

      <button type="button" className="shelf-arrow is-prev" aria-label="Previous" onClick={() => engine.current?.go(-1)}>
        <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
          <path d="M5 1 L1 5 L5 9 M1 5 H17" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <button type="button" className="shelf-arrow is-next" aria-label="Next" onClick={() => engine.current?.go(1)}>
        <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
          <path d="M13 1 L17 5 L13 9 M17 5 H1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>

      <div className="shelf-grain" aria-hidden="true" />
      <div className="shelf-cursor" aria-hidden="true">
        <span className="ring" />
        <span className="dot" />
        <span className="label">Open</span>
      </div>
    </section>
  );
}

export function HomeClient() {
  const { features, openAssistant, hydrated } = useStore();
  const prefs = useActivePrefs();
  const hasPrefs = hydrated && !!prefs;
  const items = useMemo(() => buildItems(features, hasPrefs), [features, hasPrefs]);
  const router = useRouter();

  return (
    <>
      <Shelf
        items={items}
        onOpen={(it) => ('href' in it.cta ? router.push(it.cta.href) : openAssistant({ productId: null }))}
      />

      {hasPrefs && prefs && (
        <section className="section personal home-personal" aria-label="Your preferences">
          <div className="pref-line">
            <p>
              Your matches are based on:{' '}
              {summarisePreferences(prefs)
                .map((entry) => entry.value)
                .join(' · ')}
            </p>
            <div className="personal-pref-actions">
              <Link href="/preferences?return=summary" className="link-button">
                Edit preferences
              </Link>
              <ResetPreferencesButton />
            </div>
          </div>
          <UpdatedNotice />
        </section>
      )}
    </>
  );
}
