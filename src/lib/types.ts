/**
 * Domain types for the WAHJ PARFUMS two-channel system.
 * Mirrors the schema in the strategy doc (Phase 1) so this dashboard can later be
 * pointed at real API responses without changing a single component.
 */

export type Channel = 'LOCAL' | 'ONLINE'
export type OrderType = 'SINGLE' | 'TWO_PACK' | 'PACK'
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'returned' | 'cancelled'
export type ABCClass = 'A' | 'B' | 'C'
export type Gender = 'men' | 'women' | 'unisex'
export type PerfumeStatus = 'active' | 'new_arrival' | 'dropped'
export type BatchStatus = 'MACERATING' | 'READY' | 'IN_STOCK' | 'DEPLETED'
export type ReorderStatus = 'ok' | 'reorder' | 'urgent'

export interface BatchRecipe {
  oilMlPerBatch: number
  oilCost: number
  alcoholMlUsed: number
  alcoholPricePerLiter: number
  bottlesPerBatch: number
  bottleCost: number
  labelCost: number
}

export interface Perfume {
  id: string
  name: string
  brand: string
  gender: Gender
  family: string
  abcClass: ABCClass
  status: PerfumeStatus
  recipe: BatchRecipe
  /** Derived from the current batch recipe: (oil + alcohol + bottles + labels) / bottles */
  unitCost30ml: number
  localSinglePrice: number
  localDuoPrice: number
}

export interface PackItem {
  perfumeId: string
  quantity: number
  isFreeGift: boolean
}

export interface Pack {
  id: string
  slug: string
  name: string
  nameAr: string
  gender: Gender
  channel: 'ONLINE_ONLY'
  price: number
  story: string
  items: PackItem[]
}

export interface OrderItem {
  kind: 'perfume' | 'pack'
  refId: string
  name: string
  quantity: number
  unitPrice: number
  /** Bottles consumed from stock by this line (packs count their components, incl. the free gift) */
  bottles: number
}

export interface Order {
  id: string
  code: string
  channel: Channel
  orderType: OrderType
  status: OrderStatus
  createdAt: string // ISO
  customerId: string
  city: string
  items: OrderItem[]
  /** Absorbed by WAHJ on ONLINE packs — never charged to the customer */
  deliveryFee: number
  /** 15% of order value, reserved on every ONLINE order */
  returnProvision: number
  returned: boolean
  returnShipping: number
  /** Gross order value before refunds */
  grossRevenue: number
  /** Revenue recognised (0 when the order came back) */
  revenue: number
  productionCost: number
  totalCost: number
  netProfit: number
}

export interface ProductionBatch {
  id: string
  code: string
  perfumeId: string
  productionDate: string
  readyDate: string // production + 14 days — always calculated
  bottleCount: number
  bottlesRemaining: number
  status: BatchStatus
  salesStartedAt: string | null
  costPerBatch: number
  costPerBottle: number
}

export interface ReorderAlert {
  id: string
  perfumeId: string
  class: ABCClass
  trigger: number
  sellableAtTrigger: number
  triggeredAt: string
  status: 'open' | 'acknowledged' | 'resolved'
}

export interface StockRow {
  perfume: Perfume
  sellable: number
  macerating: number
  total: number
  trigger: number
  reorderStatus: ReorderStatus
  /** Days until the next batch becomes sellable (null when nothing is cooking) */
  nextReadyInDays: number | null
  batches: ProductionBatch[]
}

export interface Customer {
  id: string
  name: string
  phone: string
  city: string
  channelAcquired: Channel
  totalOrders: number
  totalSpent: number
  bottlesThisCycle: number
  loyaltyRewards: number
  lastOrderAt: string
}

export interface Dataset {
  perfumes: Perfume[]
  packs: Pack[]
  orders: Order[]
  batches: ProductionBatch[]
  customers: Customer[]
  alerts: ReorderAlert[]
  generatedAt: string
  historyStart: string
  historyEnd: string
}

/** Editable business settings (Phase 6: "no code changes when the courier reprices") */
export interface Settings {
  deliveryFee: number
  returnProvisionRate: number
  macerationDays: number
  reorderTriggers: Record<ABCClass, number>
  batchesOnTrigger: Record<ABCClass, number>
  allocation: { stock: number; ads: number; salary: number; savings: number }
}

export interface Filters {
  preset: RangePreset
  from: string // yyyy-mm-dd
  to: string // yyyy-mm-dd
  channels: Channel[]
  classes: ABCClass[]
  genders: Gender[]
}

export type RangePreset = '7d' | '30d' | '90d' | '6m' | '12m' | 'ytd' | 'all' | 'custom'
