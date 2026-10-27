// Single source of product truth for the storefront, recommendations,
// comparison and the shopping assistant.
//
// IMPORTANT: every record below is DEMONSTRATION DATA written for the
// dissertation prototype. Names, prices, formulations, usage directions and
// stock levels are illustrative and are not claims about real products.
// Replace them with verified records before any real customer use.

export type Area = 'skin' | 'hair';
export type Category =
  | 'face-oil'
  | 'body-care'
  | 'hair-oil'
  | 'scalp-oil'
  | 'multi-use-oil'
  | 'set';
export type Fragrance = 'unscented' | 'essential-oils';
export type Texture = 'light' | 'medium' | 'rich' | 'varies';
export type SkinType = 'dry' | 'normal' | 'combination' | 'oily';
export type HairType = 'fine' | 'medium' | 'thick';
export type Availability = 'in-stock' | 'low-stock' | 'out-of-stock';
export type RoutineFit = 'simple' | 'fuller';
export type Goal =
  | 'dry-skin-comfort'
  | 'light-moisture'
  | 'body-softening'
  | 'massage'
  | 'softness-shine'
  | 'pre-wash'
  | 'scalp-massage'
  | 'dry-ends';

export type IngredientTag =
  | 'essential-oil'
  | 'tea-tree'
  | 'nut'
  | 'coconut'
  | 'sesame'
  | 'mustard-family';

export interface Ingredient {
  name: string;
  inci: string;
  tags: IngredientTag[];
  about: string;
}

export const INGREDIENTS = {
  jojoba: {
    name: 'Jojoba seed oil',
    inci: 'Simmondsia chinensis seed oil',
    tags: [],
    about:
      'A liquid wax pressed from jojoba seeds. It usually feels light rather than greasy.',
  },
  rosehip: {
    name: 'Rosehip seed oil',
    inci: 'Rosa canina fruit oil',
    tags: [],
    about: 'Pressed from the seeds of wild rose hips. A light, dry-feeling oil.',
  },
  rose: {
    name: 'Rose flower oil',
    inci: 'Rosa damascena flower oil',
    tags: ['essential-oil'],
    about: 'A rose essential oil, used in small amounts for its scent.',
  },
  argan: {
    name: 'Argan kernel oil',
    inci: 'Argania spinosa kernel oil',
    tags: ['nut'],
    about:
      'Pressed from the kernels of argan tree fruit. A medium-weight oil with a faint nutty smell.',
  },
  rocket: {
    name: 'Rocket seed oil (taramira)',
    inci: 'Eruca sativa seed oil',
    tags: ['mustard-family'],
    about:
      'Pressed from rocket seeds and known in South Asia as taramira oil. A thicker oil with an earthy smell. Rocket belongs to the mustard (Brassicaceae) plant family.',
  },
  'tea-tree': {
    name: 'Tea tree leaf oil',
    inci: 'Melaleuca alternifolia leaf oil',
    tags: ['essential-oil', 'tea-tree'],
    about:
      'An essential oil with a strong, fresh scent. It is always used diluted in a carrier oil.',
  },
  'sweet-almond': {
    name: 'Sweet almond oil',
    inci: 'Prunus amygdalus dulcis oil',
    tags: ['nut'],
    about: 'Pressed from almonds. A smooth, medium-weight oil.',
  },
  coconut: {
    name: 'Coconut oil',
    inci: 'Cocos nucifera oil',
    tags: ['coconut'],
    about: 'Solid when cool and melts on contact with warm skin.',
  },
  sesame: {
    name: 'Sesame seed oil',
    inci: 'Sesamum indicum seed oil',
    tags: ['sesame'],
    about: 'Pressed from sesame seeds. A medium-weight oil.',
  },
  castor: {
    name: 'Castor seed oil',
    inci: 'Ricinus communis seed oil',
    tags: [],
    about:
      'A very thick, sticky oil that is usually blended with lighter oils.',
  },
  rosemary: {
    name: 'Rosemary leaf oil',
    inci: 'Rosmarinus officinalis leaf oil',
    tags: ['essential-oil'],
    about: 'An essential oil with a herbal scent.',
  },
  lavender: {
    name: 'Lavender oil',
    inci: 'Lavandula angustifolia oil',
    tags: ['essential-oil'],
    about: 'An essential oil with a floral scent.',
  },
  shea: {
    name: 'Shea butter',
    inci: 'Butyrospermum parkii butter',
    tags: ['nut'],
    about: 'A soft butter from the nuts of the shea tree.',
  },
  sunflower: {
    name: 'Sunflower seed oil',
    inci: 'Helianthus annuus seed oil',
    tags: [],
    about: 'A light, widely used carrier oil.',
  },
  grapeseed: {
    name: 'Grapeseed oil',
    inci: 'Vitis vinifera seed oil',
    tags: [],
    about: 'A light carrier oil pressed from grape seeds.',
  },
  'vitamin-e': {
    name: 'Vitamin E (tocopherol)',
    inci: 'Tocopherol',
    tags: [],
    about:
      'Often added in small amounts to help slow oils from going rancid.',
  },
  amla: {
    name: 'Amla fruit extract',
    inci: 'Phyllanthus emblica fruit extract',
    tags: [],
    about: 'An extract of Indian gooseberry, traditionally used in hair oils.',
  },
} satisfies Record<string, Ingredient>;

export type IngredientId = keyof typeof INGREDIENTS;

export interface Product {
  /** Stable identifier, also used in URLs. Never reuse an ID. */
  id: string;
  name: string;
  category: Category;
  /** Which part of a routine the product is intended for. */
  areas: Area[];
  summary: string;
  description: string;
  pricePence: number;
  size: { value: number; unit: 'ml' | 'g' };
  /** Full ingredient list in label order, or null when not yet confirmed. */
  ingredients: IngredientId[] | null;
  setContents?: string[];
  /** null means the catalogue does not specify the scent. */
  fragrance: Fragrance | null;
  fragranceNote: string | null;
  /** null means the catalogue does not specify the texture. */
  texture: Texture | null;
  goals: Goal[];
  /** null means the catalogue does not specify suitable skin or hair types. */
  skinTypes: SkinType[] | null;
  hairTypes: HairType[] | null;
  routineFit: RoutineFit;
  /** Lets customers try several oils before choosing one. */
  sampler?: boolean;
  /** null means usage directions have not been confirmed. */
  usage: string | null;
  warnings: string[];
  /** null means stock is unknown. */
  availability: Availability | null;
  dataStatus: 'demonstration';
}

export const CATALOGUE_INFO = {
  status: 'demonstration',
  version: '2026-10-26',
  note: 'All products, prices, ingredients, directions and stock levels are demonstration content for a dissertation prototype. They are not verified product information.',
} as const;

const EXTERNAL_USE = [
  'For external use only.',
  'Avoid contact with eyes.',
  'Patch test on a small area before first use and stop using if irritation occurs.',
];
const ESSENTIAL_OIL_WARNING =
  'Contains essential oils. Keep out of reach of children.';

export const PRODUCTS: Product[] = [
  {
    id: 'rose-facial-oil',
    name: 'Rose Facial Oil',
    category: 'face-oil',
    areas: ['skin'],
    summary: 'A light face oil of jojoba and rosehip, scented with rose.',
    description:
      'Jojoba and rosehip seed oils with a small amount of rose flower oil for scent. Designed as a light final step in an evening or morning skin routine.',
    pricePence: 2400,
    size: { value: 30, unit: 'ml' },
    ingredients: ['jojoba', 'rosehip', 'rose', 'vitamin-e'],
    fragrance: 'essential-oils',
    fragranceNote: 'Rose scent from rose flower oil.',
    texture: 'light',
    goals: ['dry-skin-comfort', 'light-moisture'],
    skinTypes: ['dry', 'normal', 'combination'],
    hairTypes: null,
    routineFit: 'fuller',
    usage:
      'Warm 2–3 drops between your fingertips and press onto clean skin, after any water-based products.',
    warnings: [...EXTERNAL_USE, ESSENTIAL_OIL_WARNING],
    availability: 'in-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'rosehip-facial-oil',
    name: 'Rosehip Facial Oil',
    category: 'face-oil',
    areas: ['skin'],
    summary: 'Single-oil rosehip face oil with no added scent.',
    description:
      'Rosehip seed oil with a little vitamin E to help keep it fresh. No essential oils or added scent.',
    pricePence: 1900,
    size: { value: 30, unit: 'ml' },
    ingredients: ['rosehip', 'vitamin-e'],
    fragrance: 'unscented',
    fragranceNote: 'No added scent. Rosehip oil has a faint natural smell.',
    texture: 'light',
    goals: ['dry-skin-comfort'],
    skinTypes: ['dry', 'normal'],
    hairTypes: null,
    routineFit: 'fuller',
    usage:
      'Press 2–3 drops onto clean skin in the evening. Store away from heat and light.',
    warnings: EXTERNAL_USE,
    availability: 'in-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'golden-jojoba-oil',
    name: 'Golden Jojoba Oil',
    category: 'multi-use-oil',
    areas: ['skin', 'hair'],
    summary: 'Pure jojoba for face, body or hair ends. No added scent.',
    description:
      'A single-ingredient jojoba oil that can be used on the face, on the body or smoothed over the ends of hair, so one bottle can cover several steps.',
    pricePence: 1500,
    size: { value: 50, unit: 'ml' },
    ingredients: ['jojoba'],
    fragrance: 'unscented',
    fragranceNote: 'No added scent.',
    texture: 'light',
    goals: ['light-moisture', 'dry-ends'],
    skinTypes: ['normal', 'combination', 'oily'],
    hairTypes: ['fine', 'medium'],
    routineFit: 'simple',
    usage:
      'Face: press 2–3 drops onto clean skin. Hair: warm 1–2 drops in your palms and smooth over the ends.',
    warnings: EXTERNAL_USE,
    availability: 'in-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'pure-argan-oil',
    name: 'Pure Argan Oil',
    category: 'multi-use-oil',
    areas: ['skin', 'hair'],
    summary: 'Single-ingredient argan oil for skin, body and hair.',
    description:
      'Argan kernel oil on its own, with nothing added. A medium-weight oil that can be used on dry-feeling skin, the body, or the lengths and ends of hair.',
    pricePence: 1800,
    size: { value: 50, unit: 'ml' },
    ingredients: ['argan'],
    fragrance: 'unscented',
    fragranceNote: 'No added scent. Argan oil has a faint nutty smell.',
    texture: 'medium',
    goals: ['dry-skin-comfort', 'body-softening', 'softness-shine', 'dry-ends'],
    skinTypes: ['dry', 'normal'],
    hairTypes: ['medium', 'thick'],
    routineFit: 'simple',
    usage:
      'Skin: massage a few drops into damp skin. Hair: smooth 2–3 drops through the lengths and ends of damp or dry hair.',
    warnings: [...EXTERNAL_USE, 'Contains a nut-derived oil (argan).'],
    availability: 'in-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'pure-argan-oil-15ml',
    name: 'Pure Argan Oil (Travel Size)',
    category: 'multi-use-oil',
    areas: ['skin', 'hair'],
    summary: 'The same single-ingredient argan oil in a 15 ml bottle.',
    description:
      'Identical to Pure Argan Oil in a smaller bottle, for trying it or for travel. It costs more per millilitre than the 50 ml size.',
    pricePence: 750,
    size: { value: 15, unit: 'ml' },
    ingredients: ['argan'],
    fragrance: 'unscented',
    fragranceNote: 'No added scent. Argan oil has a faint nutty smell.',
    texture: 'medium',
    goals: ['dry-skin-comfort', 'body-softening', 'softness-shine', 'dry-ends'],
    skinTypes: ['dry', 'normal'],
    hairTypes: ['medium', 'thick'],
    routineFit: 'simple',
    usage:
      'Skin: massage a few drops into damp skin. Hair: smooth 2–3 drops through the lengths and ends of damp or dry hair.',
    warnings: [...EXTERNAL_USE, 'Contains a nut-derived oil (argan).'],
    availability: 'in-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'rose-argan-night-oil',
    name: 'Rose & Argan Night Oil',
    category: 'face-oil',
    areas: ['skin'],
    summary: 'A richer evening face oil of argan and rosehip with rose.',
    description:
      'Argan and rosehip seed oils with rose flower oil for scent. Heavier than the Rose Facial Oil, intended for the evening.',
    pricePence: 2800,
    size: { value: 30, unit: 'ml' },
    ingredients: ['argan', 'rosehip', 'rose', 'vitamin-e'],
    fragrance: 'essential-oils',
    fragranceNote: 'Rose scent from rose flower oil.',
    texture: 'medium',
    goals: ['dry-skin-comfort'],
    skinTypes: ['dry'],
    hairTypes: null,
    routineFit: 'fuller',
    usage: 'Warm 3–4 drops between your palms and press onto clean skin at night.',
    warnings: [
      ...EXTERNAL_USE,
      ESSENTIAL_OIL_WARNING,
      'Contains a nut-derived oil (argan).',
    ],
    availability: 'low-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'face-oil-discovery-set',
    name: 'Face Oil Discovery Set',
    category: 'set',
    areas: ['skin'],
    summary: 'Three 10 ml face oils (jojoba, rosehip and argan) to try side by side.',
    description:
      'Three small bottles of single-ingredient oils, so you can compare how each one feels before choosing a full size. None contains added scent.',
    pricePence: 1600,
    size: { value: 30, unit: 'ml' },
    ingredients: ['jojoba', 'rosehip', 'argan'],
    setContents: [
      'Golden Jojoba Oil, 10 ml',
      'Rosehip Facial Oil, 10 ml',
      'Pure Argan Oil, 10 ml',
    ],
    fragrance: 'unscented',
    fragranceNote: 'No added scent in any of the three oils.',
    texture: 'varies',
    goals: ['dry-skin-comfort', 'light-moisture'],
    skinTypes: ['dry', 'normal', 'combination'],
    hairTypes: null,
    routineFit: 'fuller',
    sampler: true,
    usage:
      'Try one oil at a time for a few days each. Press 2–3 drops onto clean skin.',
    warnings: [...EXTERNAL_USE, 'The argan oil is nut-derived.'],
    availability: 'in-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'unscented-body-oil',
    name: 'Unscented Body Oil',
    category: 'body-care',
    areas: ['skin'],
    summary: 'A light everyday body oil of sunflower and jojoba, no added scent.',
    description:
      'Sunflower and jojoba oils in a large bottle for everyday use on the body after showering.',
    pricePence: 2000,
    size: { value: 200, unit: 'ml' },
    ingredients: ['sunflower', 'jojoba', 'vitamin-e'],
    fragrance: 'unscented',
    fragranceNote: 'No added scent.',
    texture: 'light',
    goals: ['body-softening', 'massage'],
    skinTypes: ['dry', 'normal', 'combination', 'oily'],
    hairTypes: null,
    routineFit: 'simple',
    usage: 'Massage into damp skin after a bath or shower.',
    warnings: EXTERNAL_USE,
    availability: 'in-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'evening-body-oil',
    name: 'Evening Body Oil',
    category: 'body-care',
    areas: ['skin'],
    summary: 'Sesame and sweet almond body oil scented with lavender.',
    description:
      'A body oil of sesame and sweet almond oils with lavender oil for scent, intended for an unhurried evening massage.',
    pricePence: 2200,
    size: { value: 100, unit: 'ml' },
    ingredients: ['sesame', 'sweet-almond', 'lavender', 'vitamin-e'],
    fragrance: 'essential-oils',
    fragranceNote: 'Lavender scent from lavender oil.',
    texture: 'medium',
    goals: ['body-softening', 'massage'],
    skinTypes: ['dry', 'normal'],
    hairTypes: null,
    routineFit: 'fuller',
    usage: 'Warm a small amount in your hands and massage into skin.',
    warnings: [
      ...EXTERNAL_USE,
      ESSENTIAL_OIL_WARNING,
      'Contains a nut-derived oil (sweet almond) and sesame oil.',
    ],
    availability: 'in-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'shea-body-butter',
    name: 'Everyday Body Butter',
    category: 'body-care',
    areas: ['skin'],
    summary: 'A rich shea and coconut butter for dry-feeling skin.',
    description:
      'Shea butter whipped with coconut and sweet almond oils. Thicker than an oil and slower to absorb.',
    pricePence: 1800,
    size: { value: 120, unit: 'g' },
    ingredients: ['shea', 'coconut', 'sweet-almond'],
    fragrance: 'unscented',
    fragranceNote: 'No added scent.',
    texture: 'rich',
    goals: ['body-softening', 'dry-skin-comfort'],
    skinTypes: ['dry'],
    hairTypes: null,
    routineFit: 'simple',
    usage:
      'Warm a small amount between your hands and smooth over dry areas. It may melt in warm weather.',
    warnings: [
      ...EXTERNAL_USE,
      'Contains nut-derived ingredients (shea, sweet almond) and coconut.',
    ],
    availability: 'in-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'rocket-seed-hair-oil',
    name: 'Rocket Seed Hair Oil',
    category: 'hair-oil',
    areas: ['hair'],
    summary: 'Rocket (taramira) and sweet almond oils for a pre-wash treatment.',
    description:
      'Rocket seed oil blended with sweet almond oil. A thicker oil intended to be massaged into the scalp and lengths before washing.',
    pricePence: 1600,
    size: { value: 100, unit: 'ml' },
    ingredients: ['rocket', 'sweet-almond'],
    fragrance: 'unscented',
    fragranceNote: 'No added scent. Rocket seed oil has a strong earthy smell.',
    texture: 'rich',
    goals: ['pre-wash', 'scalp-massage'],
    skinTypes: null,
    hairTypes: ['medium', 'thick'],
    routineFit: 'fuller',
    usage:
      'Massage into the scalp and through the lengths, leave for at least 30 minutes, then shampoo out.',
    warnings: [...EXTERNAL_USE, 'Contains a nut-derived oil (sweet almond).'],
    availability: 'in-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'mixed-botanical-hair-oil',
    name: 'Mixed Botanical Hair Oil',
    category: 'hair-oil',
    areas: ['hair'],
    summary: 'A blend of five oils, including coconut, rocket and rosemary.',
    description:
      'Coconut, rocket seed, castor and argan oils with rosemary oil for scent. A rich pre-wash blend for thicker hair.',
    pricePence: 2000,
    size: { value: 100, unit: 'ml' },
    ingredients: ['coconut', 'rocket', 'castor', 'argan', 'rosemary'],
    fragrance: 'essential-oils',
    fragranceNote: 'Herbal scent from rosemary oil.',
    texture: 'rich',
    goals: ['pre-wash', 'softness-shine', 'scalp-massage'],
    skinTypes: null,
    hairTypes: ['thick'],
    routineFit: 'fuller',
    usage:
      'Warm a small amount, massage into the scalp and lengths, leave for 30–60 minutes, then shampoo twice.',
    warnings: [
      ...EXTERNAL_USE,
      ESSENTIAL_OIL_WARNING,
      'Contains coconut and a nut-derived oil (argan).',
    ],
    availability: 'low-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'tea-tree-scalp-oil',
    name: 'Tea Tree Scalp Oil',
    category: 'scalp-oil',
    areas: ['hair'],
    summary: 'A light jojoba scalp oil with diluted tea tree oil.',
    description:
      'Jojoba and grapeseed oils with a small amount of tea tree oil, for a light scalp massage before washing.',
    pricePence: 1400,
    size: { value: 50, unit: 'ml' },
    ingredients: ['jojoba', 'grapeseed', 'tea-tree', 'vitamin-e'],
    fragrance: 'essential-oils',
    fragranceNote: 'Fresh, strong scent from tea tree oil.',
    texture: 'light',
    goals: ['scalp-massage', 'pre-wash'],
    skinTypes: null,
    hairTypes: ['fine', 'medium'],
    routineFit: 'fuller',
    usage:
      'Part the hair and apply a few drops directly to the scalp. Massage gently, leave for 15–30 minutes, then shampoo.',
    warnings: [
      ...EXTERNAL_USE,
      ESSENTIAL_OIL_WARNING,
      'Do not use on broken or irritated skin.',
    ],
    availability: 'in-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'rosemary-hair-oil',
    name: 'Rosemary Hair Oil',
    category: 'hair-oil',
    areas: ['hair'],
    summary: 'A rosemary-infused pre-wash hair oil. Details to be confirmed.',
    description:
      'A rosemary hair oil intended for a pre-wash routine. The full ingredient list, scent and directions have not yet been confirmed.',
    pricePence: 1700,
    size: { value: 100, unit: 'ml' },
    ingredients: null,
    fragrance: null,
    fragranceNote: null,
    texture: null,
    goals: ['pre-wash'],
    skinTypes: null,
    hairTypes: null,
    routineFit: 'fuller',
    usage: null,
    warnings: EXTERNAL_USE,
    availability: 'in-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'amla-hair-oil',
    name: 'Amla & Sesame Hair Oil',
    category: 'hair-oil',
    areas: ['hair'],
    summary: 'Sesame oil infused with amla. Currently out of stock.',
    description:
      'Sesame seed oil infused with amla (Indian gooseberry) extract, used as a pre-wash conditioning oil. Scent has not been confirmed.',
    pricePence: 1800,
    size: { value: 100, unit: 'ml' },
    ingredients: ['sesame', 'amla'],
    fragrance: null,
    fragranceNote: null,
    texture: 'medium',
    goals: ['softness-shine', 'pre-wash'],
    skinTypes: null,
    hairTypes: ['medium', 'thick'],
    routineFit: 'fuller',
    usage:
      'Massage into the scalp and lengths, leave for at least an hour, then shampoo out.',
    warnings: [...EXTERNAL_USE, 'Contains sesame oil.'],
    availability: 'out-of-stock',
    dataStatus: 'demonstration',
  },
  {
    id: 'pre-wash-hair-duo',
    name: 'Pre-wash Hair Duo',
    category: 'set',
    areas: ['hair'],
    summary: 'Rocket Seed Hair Oil and Tea Tree Scalp Oil together.',
    description:
      'Both pre-wash oils in one set: the light Tea Tree Scalp Oil for the scalp, and the richer Rocket Seed Hair Oil for the lengths.',
    pricePence: 2700,
    size: { value: 150, unit: 'ml' },
    ingredients: [
      'rocket',
      'sweet-almond',
      'jojoba',
      'grapeseed',
      'tea-tree',
      'vitamin-e',
    ],
    setContents: ['Rocket Seed Hair Oil, 100 ml', 'Tea Tree Scalp Oil, 50 ml'],
    fragrance: 'essential-oils',
    fragranceNote:
      'The scalp oil has a tea tree scent; the hair oil has no added scent.',
    texture: 'varies',
    goals: ['pre-wash', 'scalp-massage'],
    skinTypes: null,
    hairTypes: ['medium', 'thick'],
    routineFit: 'fuller',
    usage:
      'Apply the scalp oil to the scalp and the hair oil to the lengths. Leave for 30 minutes, then shampoo.',
    warnings: [
      ...EXTERNAL_USE,
      ESSENTIAL_OIL_WARNING,
      'Contains a nut-derived oil (sweet almond).',
    ],
    availability: 'in-stock',
    dataStatus: 'demonstration',
  },
];

// ---------- Labels shared by every screen and the assistant ----------

export const CATEGORY_LABELS: Record<Category, string> = {
  'face-oil': 'Face oils',
  'body-care': 'Body care',
  'hair-oil': 'Hair oils',
  'scalp-oil': 'Scalp oils',
  'multi-use-oil': 'Multi-use oils',
  set: 'Sets',
};

export const GOAL_LABELS: Record<Goal, string> = {
  'dry-skin-comfort': 'moisture for dry-feeling skin',
  'light-moisture': 'light moisture that doesn’t feel heavy',
  'body-softening': 'softer-feeling skin on the body',
  massage: 'a massage or self-care routine',
  'softness-shine': 'softer, shinier-looking hair',
  'pre-wash': 'a pre-wash hair treatment',
  'scalp-massage': 'a scalp massage routine',
  'dry-ends': 'smoothing dry ends and frizz',
};

export const GOAL_AREA: Record<Goal, Area> = {
  'dry-skin-comfort': 'skin',
  'light-moisture': 'skin',
  'body-softening': 'skin',
  massage: 'skin',
  'softness-shine': 'hair',
  'pre-wash': 'hair',
  'scalp-massage': 'hair',
  'dry-ends': 'hair',
};

export const FRAGRANCE_LABELS: Record<Fragrance, string> = {
  unscented: 'No added scent',
  'essential-oils': 'Scented with essential oils',
};

export const TEXTURE_LABELS: Record<Texture, string> = {
  light: 'Light',
  medium: 'Medium',
  rich: 'Rich',
  varies: 'Varies by item',
};

export const TEXTURE_HELP: Record<Exclude<Texture, 'varies'>, string> = {
  light: 'absorbs quickly and feels thin',
  medium: 'smooth, takes a little longer to absorb',
  rich: 'thick and cushiony, slow to absorb',
};

export const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  dry: 'Dry',
  normal: 'Normal',
  combination: 'Combination',
  oily: 'Oily',
};

export const HAIR_TYPE_LABELS: Record<HairType, string> = {
  fine: 'Fine',
  medium: 'Medium',
  thick: 'Thick or coarse',
};

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  'in-stock': 'In stock',
  'low-stock': 'Low stock',
  'out-of-stock': 'Out of stock',
};

export const TAG_LABELS: Record<IngredientTag, string> = {
  'essential-oil': 'Essential oils',
  'tea-tree': 'Tea tree oil',
  nut: 'Nut-derived oils and butters',
  coconut: 'Coconut',
  sesame: 'Sesame',
  'mustard-family': 'Mustard-family oils (e.g. rocket)',
};

// ---------- Helpers ----------

const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id: string): Product | undefined {
  return BY_ID.get(id);
}

export function isProductId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}

export function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export function formatSize(product: Product): string {
  return `${product.size.value} ${product.size.unit}`;
}

/** Price per 100 ml or 100 g in pence; only comparable within the same unit. */
export function pricePer100(product: Product): number {
  return Math.round((product.pricePence / product.size.value) * 100);
}

export function formatPricePer100(product: Product): string {
  return `${formatPrice(pricePer100(product))} per 100 ${product.size.unit}`;
}

export function ingredientName(id: IngredientId): string {
  return INGREDIENTS[id].name;
}

/** Ingredients carrying a tag, or null when the ingredient list is unknown. */
export function ingredientsWithTag(
  product: Product,
  tag: IngredientTag,
): IngredientId[] | null {
  if (!product.ingredients) return null;
  return product.ingredients.filter((id) =>
    (INGREDIENTS[id].tags as readonly IngredientTag[]).includes(tag),
  );
}

/** Scent label plus any extra note, without repeating the label. */
export function scentText(product: Product): string | null {
  if (!product.fragrance) return null;
  const label = FRAGRANCE_LABELS[product.fragrance];
  const note = product.fragranceNote?.replace(/^No added scent\.\s*/, '').trim();
  return note ? `${label}. ${note}` : `${label}.`;
}

export function productAreasLabel(product: Product): string {
  return product.areas.length === 2
    ? 'Skin and hair'
    : product.areas[0] === 'skin'
      ? 'Skin'
      : 'Hair';
}
