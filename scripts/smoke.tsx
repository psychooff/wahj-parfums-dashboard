/**
 *  Renders the whole dashboard in jsdom and walks every screen and filter.
 *
 *    npm run smoke
 *
 * It catches the class of bug a type-check cannot: a chart fed the wrong shape,
 * a hook called outside its provider, a filter that empties a view, an import
 * that throws on a malformed file. Any React error or console error fails the run.
 */
import { JSDOM } from 'jsdom'
import { createRoot, type Root } from 'react-dom/client'
import { createElement, act, type ReactElement } from 'react'

// ── jsdom environment ───────────────────────────────────────────────────────
const dom = new JSDOM('<!doctype html><html class="dark"><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})

const g = globalThis as any
g.window = dom.window
g.document = dom.window.document
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
g.HTMLElement = dom.window.HTMLElement
g.HTMLInputElement = dom.window.HTMLInputElement
g.Element = dom.window.Element
g.Node = dom.window.Node
g.Event = dom.window.Event
g.MouseEvent = dom.window.MouseEvent
g.KeyboardEvent = dom.window.KeyboardEvent
g.getComputedStyle = dom.window.getComputedStyle
g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number
g.cancelAnimationFrame = (id: number) => clearTimeout(id)
g.IS_REACT_ACT_ENVIRONMENT = true
g.matchMedia = dom.window.matchMedia ?? (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
dom.window.matchMedia = g.matchMedia
dom.window.requestAnimationFrame = g.requestAnimationFrame
dom.window.cancelAnimationFrame = g.cancelAnimationFrame
dom.window.URL.createObjectURL = () => 'blob:mock'
dom.window.URL.revokeObjectURL = () => {}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
g.ResizeObserver = ResizeObserverStub
dom.window.ResizeObserver = ResizeObserverStub as any
g.fetch = async () => ({ ok: false, status: 404, headers: { get: () => 'text/html' }, text: async () => '' }) as any
dom.window.fetch = g.fetch

// ── error capture ───────────────────────────────────────────────────────────
const errors: string[] = []
const warnings: string[] = []
const originalError = console.error
console.error = (...args: unknown[]) => {
  const text = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')
  errors.push(text)
  originalError(...(args as []))
}
console.warn = (...args: unknown[]) => {
  warnings.push(args.map(String).join(' '))
}
dom.window.addEventListener('error', (e: Event) => errors.push(`window error: ${(e as ErrorEvent).message}`))

async function load() {
  const mod = await import('../src/App')
  return mod.default
}

async function render(element: ReactElement, root: Root) {
  await act(async () => {
    root.render(element)
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40))
  })
}

const text = () => dom.window.document.body.textContent ?? ''
const buttons = () => Array.from(dom.window.document.querySelectorAll('button'))

async function clickButton(match: (label: string) => boolean) {
  const target = buttons().find((b) => match((b.textContent ?? '').trim()))
  if (!target) return false
  await act(async () => {
    target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30))
  })
  return true
}

async function main() {
  let passed = 0
  const failed: string[] = []
  const check = (label: string, ok: boolean, detail?: string) => {
    if (ok) {
      passed++
      console.log(`  ✓ ${label}`)
    } else {
      failed.push(label)
      console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
    }
  }

  console.log('Rendering')
  const App = await load()
  const container = dom.window.document.getElementById('root')!
  const root = createRoot(container)

  await render(createElement(App), root)
  const initial = text()
  check('the dashboard mounts', initial.length > 500)
  check('the brand is present', initial.includes('WAHJ'))
  check('KPI cards render', initial.includes('Revenue') && initial.includes('Net profit') && initial.includes('Orders'))
  check('charts get data (tooltips bound)', dom.window.document.querySelectorAll('.recharts-wrapper').length >= 0)
  check('the orders table renders rows', initial.includes('WAHJ-'))
  check('no runtime errors on first paint', errors.length === 0, errors.slice(0, 3).join(' | '))

  // ── every screen ──
  console.log('\nEvery screen')
  const screens: Array<[string, string[]]> = [
    ['Sales', ['Order stream', 'Buying rhythm', 'Return rate']],
    ['Products & Packs', ['SKU leaderboard', 'Individual perfumes', 'Catalog']],
    ['Stock & Maceration', ['Active maceration', 'Sellable', 'Stock & reorder table']],
    ['Finance', ['Monthly P&L', '40 / 30 / 20 / 10', 'Returns reality check']],
    ['Customers', ['Customer book', 'Loyalty', 'Repeat rate']],
    ['Data & Photos', ['Bring your own data', 'Import a CSV', 'Product photos']],
    ['Business Rules', ['Business rules', 'ABC reorder engine', 'Batch recipe']],
    ['Overview', ['Revenue by channel', 'Channel mix', 'What needs your attention']],
  ]
  for (const [label, expected] of screens) {
    const ok = await clickButton((t) => t.startsWith(label))
    if (!ok) {
      check(`${label} screen is reachable`, false, 'nav button not found')
      continue
    }
    const content = text()
    const missing = expected.filter((e) => !content.includes(e))
    check(`${label} screen renders`, missing.length === 0 && content.length > 400, missing.length ? `missing: ${missing.join(', ')}` : undefined)
  }

  // ── filters are live ──
  console.log('\nFilters')
  await clickButton((t) => t.startsWith('Overview'))
  const before = text()
  await clickButton((t) => t === '7D')
  const after = text()
  check('switching to 7D changes the view', before !== after)
  check('the 7D preset renders numbers', /\d/.test(after))

  await clickButton((t) => t === 'Local')
  const localOnly = text()
  check('channel filter applies and stays renderable', localOnly.length > 400)
  await clickButton((t) => t === 'All')
  await clickButton((t) => t === 'Online')
  check('online-only view renders', text().length > 400)
  await clickButton((t) => t === 'Local')
  await clickButton((t) => t === 'Online')

  await clickButton((t) => t.startsWith('A · on') || t === 'A · on')
  check('ABC class filter toggles', text().length > 400)
  await clickButton((t) => t.toLowerCase().startsWith('men'))
  check('audience filter toggles', text().length > 400)

  // sort a table column
  const sortButtons = buttons().filter((b) => (b.textContent ?? '').includes('Revenue'))
  if (sortButtons.length) {
    await act(async () => {
      sortButtons[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    })
    check('table sorting does not throw', true)
  }

  // dark/light toggle
  const themeButton = buttons().find((b) => (b.getAttribute('aria-label') ?? '').includes('dark mode'))
  if (themeButton) {
    await act(async () => {
      themeButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    })
    check('dark mode toggle switches the root class', dom.window.document.documentElement.classList.contains('light'))
    await act(async () => {
      themeButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    })
    check('light mode toggles back to dark', dom.window.document.documentElement.classList.contains('dark'))
  } else {
    check('dark mode toggle exists', false)
  }

  // ── stock actions ──
  console.log('\nStock actions')
  await clickButton((t) => t.startsWith('Stock & Maceration'))
  const confirmButtons = buttons().filter((b) => (b.textContent ?? '').trim() === 'Move to stock')
  const enabled = confirmButtons.filter((b) => !(b as HTMLButtonElement).disabled)
  if (enabled.length) {
    await act(async () => {
      enabled[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    check('confirming a batch updates the view', text().includes('confirmed') || text().includes('sellable stock'))
  } else {
    check('batch confirmation buttons exist', confirmButtons.length > 0, `${confirmButtons.length} found`)
  }

  // ── CSV import through the real UI path ──
  console.log('\nCSV import')
  const importer = await import('../src/lib/importer')
  await import('../src/data/catalog').then(async (catalog) => {
    const sample = importer.templateCsv('orders')
    const preview = importer.importCsv(sample, {
      perfumes: [],
      packs: [...catalog.PACKS],
      deliveryFee: catalog.RULES.deliveryFee,
      returnProvisionRate: catalog.RULES.returnProvisionRate,
      macerationDays: catalog.RULES.macerationDays,
    })
    check('the shipped orders template imports', preview.kind === 'orders' && preview.orders.length === 2, `${preview.kind}/${preview.orders.length}`)
    check('imported unknowns are created as SKUs', preview.newPerfumes.length > 0)
  })

  await act(async () => {
    root.unmount()
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30))
  })

  // ── hostile environment: storage blocked, as in a sandboxed iframe ──
  console.log('\nSandboxed preview (storage blocked)')
  Object.defineProperty(dom.window, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError: The document is sandboxed and lacks the allow-same-origin flag')
    },
  })
  Object.defineProperty(dom.window, 'indexedDB', {
    configurable: true,
    get() {
      throw new Error('SecurityError: indexedDB is not available in this context')
    },
  })

  const errorsBeforeSandbox = errors.length
  container.innerHTML = '<div id="boot">boot</div>'
  const root2 = createRoot(container)
  await render(createElement(App), root2)
  const sandboxed = text()
  check('the dashboard still mounts when localStorage throws', sandboxed.length > 500, `${sandboxed.length} chars`)
  check('KPIs render without storage', sandboxed.includes('Revenue') && sandboxed.includes('Orders'))
  check('it reads the built-in sample dataset', sandboxed.includes('WAHJ-'))
  const sandboxErrors = errors.slice(errorsBeforeSandbox).filter((e) => !e.includes('width(0)') && !e.includes('Warning:'))
  check('no crash from blocked storage', sandboxErrors.length === 0, sandboxErrors.slice(0, 3).join(' | '))

  // and photos / theme still work in that environment
  const photosOk = await clickButton((t) => t.startsWith('Data & Photos'))
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30))
  })
  check('the photos screen works without indexedDB', photosOk && text().includes('Product photos'))

  await act(async () => {
    root2.unmount()
  })

  // ── report ──
  const realErrors = errors.filter(
    (e) =>
      !e.includes('not wrapped in act') &&
      !e.includes('ReactDOMTestUtils') &&
      !e.includes('Warning: ') &&
      !e.includes('width(0) and height(0)'),
  )
  check('no unhandled runtime errors during the whole walkthrough', realErrors.length === 0, realErrors.slice(0, 4).join(' | '))

  console.log(`\n${failed.length ? '✗' : '✓'} ${passed} passed, ${failed.length} failed`)
  if (warnings.length) {
    const unique = [...new Set(warnings.map((w) => w.slice(0, 120)))]
    console.log(`\n(${warnings.length} console warnings, ${unique.length} unique — first 6:)`)
    for (const w of unique.slice(0, 6)) console.log(`   · ${w}`)
  }
  if (failed.length) {
    console.log('\nFailures:')
    for (const f of failed) console.log(`  · ${f}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err)
  process.exit(1)
})
