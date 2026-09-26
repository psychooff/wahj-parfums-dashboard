import type { ABCClass, BatchRecipe, Pack, Perfume, Settings } from '../lib/types'

/**
 * ── Business rules, in one place ────────────────────────────────────────────
 * Every number below comes straight from the WAHJ strategy doc. Change it here
 * and the whole dashboard (KPIs, P&L, reorder badges, pack profitability)
 * recalculates — nothing is hardcoded inside a component.
 */
export const RULES: Settings = {
  deliveryFee: 35, // DH — absorbed on ONLINE orders, never charged to the customer
  returnProvisionRate: 0.15, // 15% of online order value reserved for returns
  macerationDays: 14, // production_date + 14 days = sellable date
  reorderTriggers: { A: 8, B: 5, C: 3 },
  batchesOnTrigger: { A: 2, B: 1, C: 1 },
  allocation: { stock: 0.4, ads: 0.3, salary: 0.2, savings: 0.1 },
}

/** Batch maths: 1 batch = 500ml = 16 × 30ml bottles, 205 DH with the base recipe. */
export const BASE_RECIPE: BatchRecipe = {
  oilMlPerBatch: 125,
  oilCost: 110,
  alcoholMlUsed: 375,
  alcoholPricePerLiter: 44, // 375ml → 16.50 DH
  bottlesPerBatch: 16,
  bottleCost: 3.75, // → 60 DH
  labelCost: 1.15625, // → 18.50 DH
}

export function calculateBatchCost(recipe: BatchRecipe) {
  const oil = recipe.oilCost
  const alcohol = (recipe.alcoholMlUsed / 1000) * recipe.alcoholPricePerLiter
  const bottles = recipe.bottlesPerBatch * recipe.bottleCost
  const labels = recipe.bottlesPerBatch * recipe.labelCost
  const total = oil + alcohol + bottles + labels
  return {
    oil,
    alcohol,
    bottles,
    labels,
    total,
    perBottle: total / recipe.bottlesPerBatch,
  }
}

const recipe = (oilCost: number, overrides: Partial<BatchRecipe> = {}): BatchRecipe => ({
  ...BASE_RECIPE,
  oilCost,
  ...overrides,
})

interface Seed {
  id: string
  name: string
  brand: string
  gender: 'men' | 'women' | 'unisex'
  family: string
  abcClass: ABCClass
  oilCost: number
  status?: 'active' | 'new_arrival'
  /** relative demand weight inside its class */
  weight: number
}

/**
 * 26 SKUs — A/B/C classes drive the reorder engine and the demand curve.
 * oilCost is the only real variable: precious ouds cost more per batch,
 * which is why their 30ml unit cost is not the flat 12.81 DH.
 */
const SEEDS: Seed[] = [
  // ── Class A — the volume drivers ──
  { id: 'sauvage', name: 'Sauvage', brand: 'Dior', gender: 'men', family: 'Fresh Aromatic', abcClass: 'A', oilCost: 110, weight: 10 },
  { id: 'bleu-chanel', name: 'Bleu de Chanel', brand: 'Chanel', gender: 'men', family: 'Woody Aromatic', abcClass: 'A', oilCost: 118, weight: 9 },
  { id: 'khamrah', name: 'Khamrah', brand: 'Lattafa', gender: 'unisex', family: 'Amber Vanilla', abcClass: 'A', oilCost: 112, weight: 9.5 },
  { id: 'baccarat-540', name: 'Baccarat Rouge 540', brand: 'MFK', gender: 'women', family: 'Amber Floral', abcClass: 'A', oilCost: 165, weight: 7.5 },
  { id: 'la-vie-est-belle', name: 'La Vie Est Belle', brand: 'Lancôme', gender: 'women', family: 'Sweet Floral', abcClass: 'A', oilCost: 118, weight: 7 },
  { id: 'yara', name: 'Yara', brand: 'Lattafa', gender: 'women', family: 'Sweet Vanilla', abcClass: 'A', oilCost: 108, weight: 8.5 },
  { id: 'asad', name: 'Asad', brand: 'Lattafa', gender: 'men', family: 'Amber Woody', abcClass: 'A', oilCost: 112, weight: 7.5 },
  { id: 'invictus', name: 'Invictus', brand: 'Paco Rabanne', gender: 'men', family: 'Fresh Woody', abcClass: 'A', oilCost: 110, weight: 6.5 },

  // ── Class B — the steady middle ──
  { id: 'oud-wood', name: 'Oud Wood', brand: 'Tom Ford', gender: 'unisex', family: 'Oud', abcClass: 'B', oilCost: 155, weight: 5 },
  { id: 'erba-pura', name: 'Erba Pura', brand: 'Xerjoff', gender: 'unisex', family: 'Fruity Amber', abcClass: 'B', oilCost: 132, weight: 4.5 },
  { id: 'le-male', name: 'Le Male', brand: 'Jean Paul Gaultier', gender: 'men', family: 'Aromatic Fougère', abcClass: 'B', oilCost: 110, weight: 4 },
  { id: 'good-girl', name: 'Good Girl', brand: 'Carolina Herrera', gender: 'women', family: 'Amber Floral', abcClass: 'B', oilCost: 120, weight: 4.5 },
  { id: 'libre', name: 'Libre', brand: 'YSL', gender: 'women', family: 'Floral Lavender', abcClass: 'B', oilCost: 118, weight: 4 },
  { id: 'one-million', name: '1 Million', brand: 'Paco Rabanne', gender: 'men', family: 'Spicy Leather', abcClass: 'B', oilCost: 110, weight: 4 },
  { id: 'ombre-nomade', name: 'Ombre Nomade', brand: 'Louis Vuitton', gender: 'unisex', family: 'Oud Rose', abcClass: 'B', oilCost: 175, weight: 3.5 },
  { id: 'angels-share', name: "Angel's Share", brand: 'Kilian', gender: 'unisex', family: 'Boozy Amber', abcClass: 'B', oilCost: 140, weight: 3.5 },
  { id: 'hawas', name: 'Hawas', brand: 'Rasasi', gender: 'men', family: 'Fresh Aquatic', abcClass: 'B', oilCost: 105, weight: 4 },

  // ── Class C — the long tail ──
  { id: 'hacivat', name: 'Hacivat', brand: 'Nishane', gender: 'unisex', family: 'Fruity Chypre', abcClass: 'C', oilCost: 145, weight: 2 },
  { id: 'amber-oud', name: 'Amber Oud Gold', brand: 'Al Haramain', gender: 'unisex', family: 'Amber Oud', abcClass: 'C', oilCost: 128, weight: 2.2 },
  { id: 'eros', name: 'Eros', brand: 'Versace', gender: 'men', family: 'Fresh Oriental', abcClass: 'C', oilCost: 108, weight: 2.4 },
  { id: 'luna-rossa', name: 'Luna Rossa', brand: 'Prada', gender: 'men', family: 'Fresh Aromatic', abcClass: 'C', oilCost: 108, weight: 2 },
  { id: 'shalimar', name: 'Shalimar', brand: 'Guerlain', gender: 'women', family: 'Oriental Vanilla', abcClass: 'C', oilCost: 138, weight: 1.8 },
  { id: 'armani-si', name: 'Sì', brand: 'Giorgio Armani', gender: 'women', family: 'Fruity Chypre', abcClass: 'C', oilCost: 118, weight: 2.2 },
  { id: 'aventus', name: 'Aventus', brand: 'Creed', gender: 'men', family: 'Fruity Woody', abcClass: 'C', oilCost: 168, weight: 2.6, status: 'new_arrival' },
  { id: 'lost-cherry', name: 'Lost Cherry', brand: 'Tom Ford', gender: 'women', family: 'Fruity Almond', abcClass: 'C', oilCost: 158, weight: 1.9 },
  { id: 'afnan-9pm', name: '9PM', brand: 'Afnan', gender: 'men', family: 'Amber Vanilla', abcClass: 'C', oilCost: 104, weight: 2.3 },
  { id: 'midnight-oud', name: 'Midnight Oud', brand: 'Ard Al Zaafaran', gender: 'unisex', family: 'Oud Amber', abcClass: 'C', oilCost: 122, weight: 1.7 },
]

export const PERFUMES: Perfume[] = SEEDS.map((seed) => {
  const r = recipe(seed.oilCost)
  const cost = calculateBatchCost(r)
  return {
    id: seed.id,
    name: seed.name,
    brand: seed.brand,
    gender: seed.gender,
    family: seed.family,
    abcClass: seed.abcClass,
    status: seed.status ?? 'active',
    recipe: r,
    unitCost30ml: Math.round(cost.perBottle * 100) / 100,
    // Local channel: singles + 2-packs only. 49 DH single → 73.9% margin on the 12.81 DH bottle.
    localSinglePrice: seed.oilCost >= 140 ? 59 : 49,
    localDuoPrice: seed.oilCost >= 140 ? 109 : 89,
  }
})

export const DEMAND_WEIGHT: Record<string, number> = Object.fromEntries(
  SEEDS.map((s) => [s.id, s.weight]),
)

/** Packs are ONLINE-ONLY, always 4 paid + 1 free gift (or 3 for the discovery packs). */
export const PACKS: Pack[] = [
  {
    id: 'pack-parfait-med',
    slug: 'pack-parfait-mediterranee',
    name: 'Pack Parfait — Méditerranée',
    nameAr: 'باك بارفي — البحر الأبيض المتوسط',
    gender: 'men',
    channel: 'ONLINE_ONLY',
    price: 249,
    story: 'Five fresh signatures that belong to the same sunny afternoon — citrus opening, woody spine, a clean dry-down for the Moroccan summer.',
    items: [
      { perfumeId: 'sauvage', quantity: 1, isFreeGift: false },
      { perfumeId: 'bleu-chanel', quantity: 1, isFreeGift: false },
      { perfumeId: 'invictus', quantity: 1, isFreeGift: false },
      { perfumeId: 'hawas', quantity: 1, isFreeGift: false },
      { perfumeId: 'eros', quantity: 1, isFreeGift: true },
    ],
  },
  {
    id: 'pack-parfait-oud',
    slug: 'pack-parfait-oud-royale',
    name: 'Pack Parfait — Oud Royale',
    nameAr: 'باك بارفي — العود الملكي',
    gender: 'unisex',
    channel: 'ONLINE_ONLY',
    price: 299,
    story: 'The heavyweights: real oud structures for evenings and weddings, layered so no two bottles fight each other.',
    items: [
      { perfumeId: 'oud-wood', quantity: 1, isFreeGift: false },
      { perfumeId: 'ombre-nomade', quantity: 1, isFreeGift: false },
      { perfumeId: 'amber-oud', quantity: 1, isFreeGift: false },
      { perfumeId: 'khamrah', quantity: 1, isFreeGift: false },
      { perfumeId: 'midnight-oud', quantity: 1, isFreeGift: true },
    ],
  },
  {
    id: 'pack-parfait-femme',
    slug: 'pack-parfait-femme',
    name: 'Pack Parfait — Elle',
    nameAr: 'باك بارفي — هي',
    gender: 'women',
    channel: 'ONLINE_ONLY',
    price: 269,
    story: 'From the sweet gourmand to the amber floral — one bottle per mood, so the week never smells the same.',
    items: [
      { perfumeId: 'baccarat-540', quantity: 1, isFreeGift: false },
      { perfumeId: 'la-vie-est-belle', quantity: 1, isFreeGift: false },
      { perfumeId: 'yara', quantity: 1, isFreeGift: false },
      { perfumeId: 'good-girl', quantity: 1, isFreeGift: false },
      { perfumeId: 'libre', quantity: 1, isFreeGift: true },
    ],
  },
  {
    id: 'pack-couple',
    slug: 'pack-couple',
    name: 'Pack Couple — Lui & Elle',
    nameAr: 'باك الزوجين',
    gender: 'unisex',
    channel: 'ONLINE_ONLY',
    price: 279,
    story: 'Built as two interlocking trios — his woody-fresh and her amber-sweet — so the pair reads as one trail.',
    items: [
      { perfumeId: 'sauvage', quantity: 1, isFreeGift: false },
      { perfumeId: 'asad', quantity: 1, isFreeGift: false },
      { perfumeId: 'yara', quantity: 1, isFreeGift: false },
      { perfumeId: 'la-vie-est-belle', quantity: 1, isFreeGift: false },
      { perfumeId: 'khamrah', quantity: 1, isFreeGift: true },
    ],
  },
  {
    id: 'pack-gift-box',
    slug: 'gift-box-signature',
    name: 'Gift Box Signature',
    nameAr: 'علبة الهدايا',
    gender: 'unisex',
    channel: 'ONLINE_ONLY',
    price: 329,
    story: 'The gift-ready box: five crowd-pleasers nobody returns, in the black-and-gold WAHJ presentation.',
    items: [
      { perfumeId: 'bleu-chanel', quantity: 1, isFreeGift: false },
      { perfumeId: 'baccarat-540', quantity: 1, isFreeGift: false },
      { perfumeId: 'khamrah', quantity: 1, isFreeGift: false },
      { perfumeId: 'erba-pura', quantity: 1, isFreeGift: false },
      { perfumeId: 'angels-share', quantity: 1, isFreeGift: true },
    ],
  },
  {
    id: 'pack-eid',
    slug: 'pack-eid',
    name: 'Pack EID',
    nameAr: 'باك العيد',
    gender: 'unisex',
    channel: 'ONLINE_ONLY',
    price: 339,
    story: 'The Ramadan/Eid box — sweet, dense, festive trails, shipped 10 days before the holiday rush while everything else is sold out.',
    items: [
      { perfumeId: 'khamrah', quantity: 1, isFreeGift: false },
      { perfumeId: 'asad', quantity: 1, isFreeGift: false },
      { perfumeId: 'yara', quantity: 1, isFreeGift: false },
      { perfumeId: 'amber-oud', quantity: 1, isFreeGift: false },
      { perfumeId: 'afnan-9pm', quantity: 1, isFreeGift: true },
    ],
  },
  {
    id: 'pack-decouverte-homme',
    slug: 'pack-decouverte-homme',
    name: 'Pack Découverte — Homme',
    nameAr: 'باك الاكتشاف — رجال',
    gender: 'men',
    channel: 'ONLINE_ONLY',
    price: 189,
    story: 'The entry pack: three best-sellers to find his signature before committing to the full box.',
    items: [
      { perfumeId: 'one-million', quantity: 1, isFreeGift: false },
      { perfumeId: 'le-male', quantity: 1, isFreeGift: false },
      { perfumeId: 'aventus', quantity: 1, isFreeGift: false },
    ],
  },
  {
    id: 'pack-decouverte-femme',
    slug: 'pack-decouverte-femme',
    name: 'Pack Découverte — Femme',
    nameAr: 'باك الاكتشاف — نساء',
    gender: 'women',
    channel: 'ONLINE_ONLY',
    price: 189,
    story: 'Three feminine signatures across three families — fresh, gourmand, oriental — to test on skin for a week.',
    items: [
      { perfumeId: 'yara', quantity: 1, isFreeGift: false },
      { perfumeId: 'armani-si', quantity: 1, isFreeGift: false },
      { perfumeId: 'shalimar', quantity: 1, isFreeGift: false },
    ],
  },
]

export const REGIONS = [
  'Casablanca-Settat',
  'Rabat-Salé-Kénitra',
  'Marrakech-Safi',
  'Fès-Meknès',
  'Tanger-Tétouan-Al Hoceïma',
  'Souss-Massa',
  'Oriental',
  'Béni Mellal-Khénifra',
  'Drâa-Tafilalet',
  'Laâyoune-Sakia El Hamra',
]

/** Weighted so Casablanca/Rabat/Marrakech dominate, like a real COD business. */
export const REGION_WEIGHTS: Record<string, number> = {
  'Casablanca-Settat': 34,
  'Rabat-Salé-Kénitra': 18,
  'Marrakech-Safi': 14,
  'Fès-Meknès': 11,
  'Tanger-Tétouan-Al Hoceïma': 10,
  'Souss-Massa': 2.6,
  Oriental: 2.6,
  'Béni Mellal-Khénifra': 2.6,
  'Drâa-Tafilalet': 2.6,
  'Laâyoune-Sakia El Hamra': 1.6,
}
