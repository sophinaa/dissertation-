'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Search,
  ArrowUpRight,
  ArrowRight,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Check,
  MessageCircle,
  Heart,
} from 'lucide-react';

const products = [
  {
    id: 1,
    name: 'Rosehip facial oil',
    category: 'Face oils',
    price: 22,
    ritual: 'Skin',
    ingredient: 'Rosehip',
    size: '30 ml',
    image: 'photo-1608571423902-eed4a5ad8108',
    description:
      'A sample single-ingredient facial oil concept with rosehip seed oil. Full formulation and usage information will be added with the real catalogue.',
  },
  {
    id: 2,
    name: 'Rosemary hair oil',
    category: 'Hair care',
    price: 24,
    ritual: 'Hair',
    ingredient: 'Rosemary',
    size: '100 ml',
    image: 'photo-1608248543803-ba4f8c70ae0b',
    description:
      'A sample rosemary-infused hair oil concept for a pre-wash routine. The final ingredients and directions are to be confirmed.',
  },
  {
    id: 3,
    name: 'Golden jojoba oil',
    category: 'Face oils',
    price: 19,
    ritual: 'Skin',
    ingredient: 'Jojoba',
    size: '50 ml',
    image: 'photo-1608571423902-eed4a5ad8108',
    description:
      'A simple jojoba facial oil concept. Illustrative catalogue entry; the final formula and product details are not yet verified.',
  },
  {
    id: 4,
    name: 'Evening body oil',
    category: 'Body care',
    price: 28,
    ritual: 'Body',
    ingredient: 'Sesame',
    size: '100 ml',
    image: 'photo-1608248543803-ba4f8c70ae0b',
    description:
      'A sesame-based body oil concept for an unhurried evening ritual. Scent, full ingredients and directions will be confirmed.',
  },
  {
    id: 5,
    name: 'Botanical hair oil',
    category: 'Hair care',
    price: 26,
    ritual: 'Hair',
    ingredient: 'Amla',
    size: '100 ml',
    image: 'photo-1556229010-6c3f2c9ca5f8',
    description:
      'An amla-infused hair oil concept. Sample product information only; no hair-growth or treatment claims are made.',
  },
  {
    id: 6,
    name: 'Everyday body butter',
    category: 'Body care',
    price: 18,
    ritual: 'Body',
    ingredient: 'Shea',
    size: '120 g',
    image: 'photo-1600612253971-422e7f7faeb6',
    description:
      'A shea-based body butter concept for a daily body-care routine. Full formulation and suitability information are still to be confirmed.',
  },
  {
    id: 7,
    name: 'Golden turmeric tea',
    category: 'Nutrition',
    price: 16,
    ritual: 'Nourish',
    ingredient: 'Turmeric',
    size: '60 g',
    image: 'photo-1544787219-7f47ccb76574',
    description:
      'A sample herbal tea blend for a warm everyday ritual. Ingredients and food labelling will be confirmed with the real catalogue.',
  },
  {
    id: 8,
    name: 'Botanical herbal infusion',
    category: 'Nutrition',
    price: 14,
    ritual: 'Nourish',
    ingredient: 'Herbs',
    size: '50 g',
    image: 'photo-1540555700478-4be289fbecef',
    description:
      'A sample botanical infusion concept. This listing makes no nutritional or medical claims.',
  },
  {
    id: 9,
    name: 'Daily ritual set',
    category: 'Bundles',
    price: 39,
    ritual: 'Skin',
    ingredient: 'Rosehip + jojoba',
    size: '2 pieces',
    image: 'photo-1608571423902-eed4a5ad8108',
    description:
      'A sample pair of facial oils for a simple routine. Contents and pricing are illustrative.',
  },
  {
    id: 10,
    name: 'Hair ritual duo',
    category: 'Bundles',
    price: 42,
    ritual: 'Hair',
    ingredient: 'Rosemary + amla',
    size: '2 pieces',
    image: 'photo-1608248543803-ba4f8c70ae0b',
    description:
      'A sample pair of hair oils. Contents and pricing are illustrative; no treatment claims are made.',
  },
];
type Product = (typeof products)[number];
const money = (n: number) => `£${n.toFixed(2)}`;
export default function Home() {
  const [view, setView] = useState('shop'),
    [mode, setMode] = useState('personalised'),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('All'),
    [ritual, setRitual] = useState('Any'),
    [budget, setBudget] = useState(50),
    [applied, setApplied] = useState(false),
    [modal, setModal] = useState<string | null>(null),
    [selected, setSelected] = useState<Product | null>(null),
    [basket, setBasket] = useState<number[]>([]),
    [compared, setCompared] = useState<number[]>([]),
    [saved, setSaved] = useState<number[]>([]),
    [chat, setChat] = useState(''),
    [answer, setAnswer] = useState(
      'Tell me a routine (skin, hair or body), an ingredient, or a budget such as “under £25”. I’ll look through the sample collection.',
    ),
    [notice, setNotice] = useState('');
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'read_sample_catalogue',
            description:
              'Read the ten sample products and their ritual, ingredient and price. Does not change preferences or place an order.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== 'object' ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error('Expected an empty object');
              return products.map(({ image, ...product }) => product);
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional browser capability. */
    }
    return () => lifecycle.abort();
  }, []);
  const filtered = products.filter(
    (p) =>
      (category === 'All' ||
        p.category === category ||
        (category === 'Beauty' &&
          ['Face oils', 'Hair care', 'Body care'].includes(p.category))) &&
      `${p.name} ${p.category} ${p.ingredient}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (mode === 'conventional' ||
        !applied ||
        (p.price <= budget && (ritual === 'Any' || p.ritual === ritual))),
  );
  function add(p: Product) {
    setBasket((b) => [...b, p.id]);
    setNotice(`${p.name} added to your demo bag.`);
  }
  function ask(text: string) {
    setChat(text);
    const lower = text.toLowerCase();
    const cap = lower.match(/(?:under|below|budget|up to)\s*£?\s*(\d+)/);
    const words = [
      'skin',
      'hair',
      'body',
      'rosehip',
      'rosemary',
      'jojoba',
      'sesame',
      'amla',
      'shea',
      'oil',
      'butter',
      'turmeric',
      'herbs',
      'tea',
      'nutrition',
      'nourish',
    ];
    const terms = words.filter((w) => lower.includes(w));
    if (!cap && !terms.length) {
      setAnswer(
        'This demo can match a care routine, ingredient or price from ten sample products. Try “hair under £25”. Live conversational AI is planned. This guide cannot assess medical suitability or recommend treatment.',
      );
      return;
    }
    const matches = products.filter(
      (p) =>
        (!cap || p.price <= Number(cap[1])) &&
        (!terms.length ||
          terms.every((t) =>
            `${p.name} ${p.category} ${p.ritual} ${p.ingredient}`
              .toLowerCase()
              .includes(t),
          )),
    );
    setAnswer(
      matches.length
        ? matches
            .map(
              (p) =>
                `${p.name} — ${money(p.price)}. ${p.ingredient}; ${p.ritual.toLowerCase()} ritual.`,
            )
            .join('\n\n')
        : 'No sample products match that combination. Try a higher budget or a different ritual.',
    );
  }
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="prototype-bar">
        <span>
          <i /> Dissertation prototype · September 2026
        </span>
        <span>Botanical & You · sample wellness brand</span>
      </div>
      <header className="header">
        <button className="brand" onClick={() => setView('shop')}>
          botanical & you<span>SMALL RITUALS. EVERYDAY WELLBEING.</span>
        </button>
        <nav aria-label="Main navigation" className="shop-nav">
          {[
            { label: 'Shop all', category: 'All' },
            { label: 'Beauty', category: 'Beauty' },
            { label: 'Health & Nutrition', category: 'Nutrition' },
            { label: 'Bundles', category: 'Bundles' },
          ].map((item) => (
            <button
              key={item.label}
              className={
                view === 'shop' && category === item.category ? 'active' : ''
              }
              aria-current={
                view === 'shop' && category === item.category
                  ? 'page'
                  : undefined
              }
              onClick={() => {
                setView('shop');
                setCategory(item.category);
                setQuery('');
                setRitual('Any');
                setApplied(false);
                requestAnimationFrame(() =>
                  document
                    .getElementById('collection')
                    ?.scrollIntoView({ behavior: 'smooth' }),
                );
              }}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => {
              setView('shop');
              setModal('preferences');
            }}
          >
            Find your ritual
          </button>
          <button
            className={view === 'overview' ? 'active' : ''}
            onClick={() => {
              setView('overview');
              window.scrollTo(0, 0);
            }}
          >
            Project overview <ArrowUpRight size={14} />
          </button>
        </nav>
        <Button
          variant="outline"
          className="bag-button"
          onClick={() => setModal('bag')}
        >
          <ShoppingBag size={17} /> Bag <span>{basket.length}</span>
        </Button>
      </header>
      <main id="main">
        {view === 'overview' ? (
          <section className="overview">
            <p className="eyebrow">SUPERVISOR MEETING / WORKING PROPOSAL</p>
            <h1>
              A better way to
              <br />
              find the right product.
            </h1>
            <p className="intro">
              Designing and Evaluating an Interactive, AI-Assisted Personalised
              E-commerce Platform
            </p>
            <div className="research">
              <span>THE RESEARCH QUESTION</span>
              <h2>
                Can preference-aware shopping and a catalogue-grounded assistant
                improve product discovery and satisfaction?
              </h2>
              <p>
                Compare the personalised experience with conventional search and
                filtering using the same catalogue. Scope and methodology are
                subject to supervisor agreement.
              </p>
            </div>
            <div className="overview-grid">
              <article>
                <p className="eyebrow">WORKING IN THIS PROTOTYPE</p>
                <h2>The customer journey</h2>
                <ul>
                  <li>Browse and search ten sample products</li>
                  <li>Set ritual and budget preferences</li>
                  <li>See matching products and explanations</li>
                  <li>Try catalogue keyword matching</li>
                  <li>Compare products and use a demo bag</li>
                </ul>
              </article>
              <article>
                <p className="eyebrow">TO DEVELOP & VALIDATE</p>
                <h2>The dissertation work</h2>
                <ul>
                  <li>Real business requirements and catalogue</li>
                  <li>Recommendation strategy and evaluation</li>
                  <li>Grounded LLM integration and safeguards</li>
                  <li>Accessibility audit and usability study</li>
                  <li>Ethics, consent and data management</li>
                </ul>
              </article>
              <article>
                <p className="eyebrow">DISCUSS ON MONDAY</p>
                <h2>Decisions to make</h2>
                <ul>
                  <li>One research question and agreed MVP</li>
                  <li>Combined experience or isolated AI effect?</li>
                  <li>Participants, study design and ethics</li>
                  <li>Task success, time, relevance and satisfaction</li>
                  <li>Milestones and next meeting deliverable</li>
                </ul>
              </article>
            </div>
            <div className="roadmap">
              {[
                'Agree scope',
                'Research & design',
                'Build core journeys',
                'Evaluate & write',
              ].map((s, i) => (
                <div key={s}>
                  <span>0{i + 1}</span>
                  <h3>{s}</h3>
                  <p>
                    {
                      [
                        'Supervisor feedback and business needs',
                        'Literature, wireframes and ethics',
                        'Personalisation and grounded assistance',
                        'User study, findings and limitations',
                      ][i]
                    }
                  </p>
                </div>
              ))}
            </div>
            <Button onClick={() => setView('shop')}>
              Explore the prototype <ArrowRight />
            </Button>
          </section>
        ) : (
          <>
            <section className="hero">
              <div className="hero-copy">
                <p className="eyebrow">ROOTED IN NATURE. CHOSEN BY YOU.</p>
                <h1>
                  A little nature.
                  <br />
                  <em>A daily ritual.</em>
                </h1>
                <p>
                  Make a little space for yourself.
                  <br />
                  Explore botanical oils and everyday care, around your routine.
                </p>
                <Button
                  className="primary-cta"
                  onClick={() => setModal('preferences')}
                >
                  Find my ritual <ArrowRight size={18} />
                </Button>
                <span className="micro">
                  For your skin. Your hair. Your own pace.
                </span>
              </div>
              <div className="hero-image">
                <img
                  src="/wellness-hero.png"
                  alt="Illustrative amber botanical oil bottles with fresh herbs in soft sunlight"
                />
                <div className="image-note">
                  <span className="note-icon">
                    <Sparkles size={20} />
                  </span>
                  <div>
                    <b>Your ritual starts here.</b>
                    <span>
                      A few thoughtful choices. A routine of your own.
                    </span>
                  </div>
                  <ArrowUpRight size={20} />
                </div>
                <span className="image-caption">
                  Botanical & You · concept collection
                </span>
              </div>
            </section>
            <section className="ritual-intro" aria-label="Explore your routine">
              <div>
                <p className="eyebrow">WELLBEING, IN YOUR OWN WAY</p>
                <h2>What does your everyday need?</h2>
              </div>
              <div className="ritual-links">
                {[
                  {
                    name: 'Skin',
                    copy: 'A moment for your skin',
                    category: 'Face oils',
                  },
                  {
                    name: 'Hair',
                    copy: 'From root to routine',
                    category: 'Hair care',
                  },
                  {
                    name: 'Body',
                    copy: 'A little everyday care',
                    category: 'Body care',
                  },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      setCategory(item.category);
                      setRitual('Any');
                      setApplied(false);
                      document
                        .getElementById('collection')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <span>{item.name}</span>
                    <small>{item.copy}</small>
                    <ArrowUpRight size={19} />
                  </button>
                ))}
              </div>
            </section>
            <section
              id="collection"
              className="discovery"
              aria-label="Wellness product discovery"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">THE BOTANICAL EDIT</p>
                  <h2>
                    {applied && mode === 'personalised'
                      ? 'A botanical edit, just for you'
                      : 'Little rituals, thoughtfully chosen'}
                  </h2>
                </div>
                <div className="mode-switch" aria-label="Shopping experience">
                  {['personalised', 'conventional'].map((m) => (
                    <button
                      key={m}
                      aria-pressed={mode === m}
                      onClick={() => setMode(m)}
                    >
                      {m === 'personalised' ? (
                        <Sparkles size={14} />
                      ) : (
                        <Search size={14} />
                      )}{' '}
                      {m === 'personalised' ? 'Personalised' : 'Conventional'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="discovery-layout">
                <aside className="preferences">
                  <div className="aside-title">
                    <SlidersHorizontal size={18} />
                    <h3>Your daily ritual</h3>
                  </div>
                  <p>
                    {mode === 'conventional'
                      ? 'Browse with standard search and category filters.'
                      : 'Start with skin, hair or body care. We’ll help you explore.'}
                  </p>
                  <label htmlFor="ritual">I’m shopping for</label>
                  <select
                    id="ritual"
                    value={ritual}
                    disabled={mode === 'conventional'}
                    onChange={(e) => {
                      setRitual(e.target.value);
                      setApplied(true);
                    }}
                  >
                    {['Any', 'Skin', 'Hair', 'Body', 'Nourish'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <label htmlFor="budget">
                    My budget <b>Up to £{budget}</b>
                  </label>
                  <input
                    id="budget"
                    type="range"
                    min="15"
                    max="50"
                    step="5"
                    value={budget}
                    disabled={mode === 'conventional'}
                    onChange={(e) => {
                      setBudget(Number(e.target.value));
                      setApplied(true);
                    }}
                  />
                  <div className="range-labels">
                    <span>£15</span>
                    <span>£50</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRitual('Any');
                      setBudget(50);
                      setApplied(false);
                      setCategory('All');
                      setQuery('');
                    }}
                  >
                    Reset filters
                  </Button>
                  <div className="how">
                    <span>WHY THESE PRODUCTS?</span>
                    <p>
                      {mode === 'conventional'
                        ? 'Personalisation is off in this view.'
                        : applied
                          ? `Matches your ${ritual === 'Any' ? 'chosen budget' : ritual.toLowerCase() + ' care routine'} and costs £${budget} or less.`
                          : 'Choose a ritual or budget to see simple, explainable matches.'}
                    </p>
                  </div>
                </aside>
                <div>
                  <div className="catalogue-tools">
                    <div className="categories" aria-label="Product category">
                      {[
                        'All',
                        'Face oils',
                        'Hair care',
                        'Body care',
                        'Nutrition',
                        'Bundles',
                      ].map((c) => (
                        <button
                          key={c}
                          aria-pressed={category === c}
                          className={category === c ? 'selected' : ''}
                          onClick={() => setCategory(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <label className="search">
                      <Search size={16} />
                      <input
                        aria-label="Search products"
                        placeholder="Find something…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  <p className="result-count" aria-live="polite">
                    {filtered.length} sample products{' '}
                    {compared.length > 0 && (
                      <button onClick={() => setModal('compare')}>
                        Compare selected ({compared.length}) →
                      </button>
                    )}
                  </p>
                  <div className="product-grid">
                    {filtered.map((p) => (
                      <article className="product" key={p.id}>
                        <div className="product-image">
                          <button
                            className="image-button"
                            aria-label={`View ${p.name}`}
                            onClick={() => {
                              setSelected(p);
                              setModal('product');
                            }}
                          >
                            <img
                              src={`https://images.unsplash.com/${p.image}?auto=format&fit=crop&w=650&q=80`}
                              alt={`Illustrative photograph for ${p.name}`}
                              loading="lazy"
                            />
                          </button>
                          <button
                            className="save"
                            aria-label={`${saved.includes(p.id) ? 'Unsave' : 'Save'} ${p.name}`}
                            aria-pressed={saved.includes(p.id)}
                            onClick={() =>
                              setSaved((a) =>
                                a.includes(p.id)
                                  ? a.filter((id) => id !== p.id)
                                  : [...a, p.id],
                              )
                            }
                          >
                            <Heart
                              size={17}
                              fill={
                                saved.includes(p.id) ? 'currentColor' : 'none'
                              }
                            />
                          </button>
                          {applied && mode === 'personalised' && (
                            <span className="match">
                              <Check size={12} /> Preference match
                            </span>
                          )}
                        </div>
                        <div className="product-meta">
                          <span>
                            {p.ingredient} · {p.size}
                          </span>
                          <strong>{money(p.price)}</strong>
                        </div>
                        <button
                          className="product-name"
                          onClick={() => {
                            setSelected(p);
                            setModal('product');
                          }}
                        >
                          {p.name}
                        </button>
                        <div className="product-actions">
                          <label>
                            <input
                              type="checkbox"
                              checked={compared.includes(p.id)}
                              onChange={() =>
                                setCompared((a) =>
                                  a.includes(p.id)
                                    ? a.filter((id) => id !== p.id)
                                    : [...a, p.id],
                                )
                              }
                            />{' '}
                            Compare
                          </label>
                          <button onClick={() => add(p)}>
                            Add to bag <span>+</span>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!filtered.length && (
                    <div className="empty">
                      <h3>No matches just yet.</h3>
                      <p>
                        Try another ritual, a higher budget or reset your
                        filters.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
            <section className="assistant-strip">
              <span className="assistant-icon">
                <MessageCircle size={30} />
              </span>
              <div>
                <p className="eyebrow">A LITTLE GUIDANCE, WHEN YOU NEED IT</p>
                <h2>Find a place in your routine.</h2>
                <p>Try “something hair under £25” in the catalogue demo.</p>
              </div>
              <Button onClick={() => setModal('assistant')}>
                Explore with our guide <ArrowUpRight size={17} />
              </Button>
            </section>
          </>
        )}
      </main>
      <footer>
        <span className="brand">
          botanical & you<span>A WELLNESS SHOPPING PROTOTYPE</span>
        </span>
        <p>
          Visual prototype · Sample content and illustrative photography.
          <br />
          AI integration, accounts and checkout are planned, not connected.
        </p>
        <button
          onClick={() => {
            setView('overview');
            window.scrollTo(0, 0);
          }}
        >
          About the project <ArrowUpRight size={14} />
        </button>
      </footer>
      <div className="status" role="status">
        {notice}
      </div>
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="project-dialog">
          <DialogTitle>
            {modal === 'preferences'
              ? 'Let’s find your daily ritual.'
              : modal === 'assistant'
                ? 'Your botanical shopping guide'
                : modal === 'bag'
                  ? 'Your demo bag'
                  : modal === 'compare'
                    ? 'Compare your finds'
                    : selected?.name}
          </DialogTitle>
          <DialogDescription>
            {modal === 'assistant'
              ? 'Scripted catalogue demo · not a live AI model'
              : modal === 'preferences'
                ? 'Choose a care routine and a budget to explore the collection.'
                : modal === 'bag'
                  ? 'Session-only basket. No payment or order will be placed.'
                  : modal === 'compare'
                    ? 'Compare facts from the sample catalogue.'
                    : 'Sample product · illustrative photography'}
          </DialogDescription>
          {modal === 'preferences' && (
            <div className="dialog-stack">
              <label>
                Where would you like to start?
                <select
                  value={ritual}
                  onChange={(e) => setRitual(e.target.value)}
                >
                  {['Any', 'Skin', 'Hair', 'Body', 'Nourish'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Budget per item: £{budget}
                <input
                  type="range"
                  min="15"
                  max="50"
                  step="5"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                />
              </label>
              <Button
                onClick={() => {
                  setApplied(true);
                  setMode('personalised');
                  setView('shop');
                  setCategory('All');
                  setQuery('');
                  setModal(null);
                  setNotice(
                    'Your daily ritual are applied. Scroll to see your matches.',
                  );
                }}
              >
                Show my matches <ArrowRight />
              </Button>
            </div>
          )}
          {modal === 'assistant' && (
            <div className="dialog-stack">
              <div className="chat-answer" aria-live="polite">
                {answer}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(chat);
                }}
              >
                <label htmlFor="chat">What are you looking for?</label>
                <input
                  id="chat"
                  value={chat}
                  onChange={(e) => setChat(e.target.value)}
                  placeholder="Hair under £25"
                  required
                />
                <Button type="submit">
                  Find products <ArrowRight />
                </Button>
              </form>
            </div>
          )}
          {modal === 'product' && selected && (
            <div className="dialog-stack">
              <p>{selected.description}</p>
              <p>
                {selected.ingredient} · {selected.ritual} ·{' '}
                {money(selected.price)}
              </p>
              <Button onClick={() => add(selected)}>Add to demo bag</Button>
            </div>
          )}
          {modal === 'bag' && (
            <div className="dialog-stack">
              {basket.length ? (
                products
                  .filter((p) => basket.includes(p.id))
                  .map((p) => (
                    <div className="bag-row" key={p.id}>
                      <span>
                        {p.name}
                        <small>
                          Quantity: {basket.filter((id) => id === p.id).length}
                        </small>
                      </span>
                      <b>
                        {money(
                          p.price * basket.filter((id) => id === p.id).length,
                        )}
                      </b>
                      <button
                        onClick={() =>
                          setBasket((a) => a.filter((id) => id !== p.id))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))
              ) : (
                <p>
                  Your bag is empty. Add a product to try the shopping journey.
                </p>
              )}
              <h3>
                Total:{' '}
                {money(
                  basket.reduce(
                    (sum, id) => sum + products.find((p) => p.id === id)!.price,
                    0,
                  ),
                )}
              </h3>
              <p className="prototype-note">
                Checkout is a future feature. This prototype does not collect
                payment or customer details.
              </p>
            </div>
          )}
          {modal === 'compare' && (
            <div className="compare-list">
              {products
                .filter((p) => compared.includes(p.id))
                .map((p) => (
                  <article key={p.id}>
                    <h3>{p.name}</h3>
                    <p>{money(p.price)}</p>
                    <p>
                      {p.ritual} · {p.ingredient}
                    </p>
                    <Button variant="outline" onClick={() => add(p)}>
                      Add to bag
                    </Button>
                  </article>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
