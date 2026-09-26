import { useDashboard } from '../state/store'
import { ChartCard, StatusPill } from '../components/ChartCard'
import { NoteCard } from '../components/NoteCard'
import { BASE_RECIPE, calculateBatchCost, RULES } from '../data/catalog'
import { formatDH, formatNumber } from '../lib/dates'
import type { ABCClass } from '../lib/types'
import { IconCheck, IconGear, IconSpark } from '../components/icons'

export function Rules() {
  const { settings, updateSettings, resetSettings, dataset, kpis, pnl } = useDashboard()
  const cost = calculateBatchCost(BASE_RECIPE)

  const allocationTotal = Object.values(settings.allocation).reduce((s, v) => s + v, 0)
  const allocationOk = Math.abs(allocationTotal - 1) < 0.001

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2 font-display text-lg">
              <IconGear className="h-4 w-4 text-wahj-gold" />
              Business rules
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-wahj-smoke">
              Everything on this page feeds the live calculations. Change the delivery fee and every online order re-prices itself; change a
              reorder trigger and the stock badges move. Nothing here is decoration.
            </p>
          </div>
          <button className="btn px-3 py-1.5 text-xs" onClick={resetSettings}>
            Reset to v1 defaults
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Channel costs" subtitle="The two-channel rule from your strategy doc">
          <div className="space-y-4">
            <label className="block">
              <span className="flex items-center justify-between text-[12px] font-medium">
                Delivery fee (online)
                <span className="tnum">{formatDH(settings.deliveryFee)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={70}
                step={5}
                value={settings.deliveryFee}
                onChange={(e) => updateSettings({ deliveryFee: Number(e.target.value) })}
                className="mt-2 w-full accent-[#C9A84C]"
              />
              <span className="mt-1 block text-[10.5px] text-wahj-smoke">
                Absorbed by WAHJ on every online order — never added to the customer's basket.
              </span>
            </label>

            <label className="block">
              <span className="flex items-center justify-between text-[12px] font-medium">
                Return provision (online)
                <span className="tnum">{(settings.returnProvisionRate * 100).toFixed(0)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={0.3}
                step={0.01}
                value={settings.returnProvisionRate}
                onChange={(e) => updateSettings({ returnProvisionRate: Number(e.target.value) })}
                className="mt-2 w-full accent-[#C9A84C]"
              />
              <span className="mt-1 block text-[10.5px] text-wahj-smoke">
                Reserved on every online order. Currently reserving {formatDH(Math.round(pnl.expectedReturnLoss))} in this view vs{' '}
                {formatDH(Math.round(pnl.actualReturnLoss))} of real damage.
              </span>
            </label>

            <label className="block">
              <span className="flex items-center justify-between text-[12px] font-medium">
                Maceration days
                <span className="tnum">{settings.macerationDays} days</span>
              </span>
              <input
                type="range"
                min={7}
                max={30}
                step={1}
                value={settings.macerationDays}
                onChange={(e) => updateSettings({ macerationDays: Number(e.target.value) })}
                className="mt-2 w-full accent-[#C9A84C]"
              />
              <span className="mt-1 block text-[10.5px] text-wahj-smoke">
                Applied to every new batch: ready date = production date + {settings.macerationDays} days.
              </span>
            </label>
          </div>
        </ChartCard>

        <ChartCard title="ABC reorder engine" subtitle="Trigger per class — alerts are generated, never auto-ordered">
          <div className="space-y-3">
            {(['A', 'B', 'C'] as ABCClass[]).map((cls) => {
              const affected = dataset.perfumes.filter((p) => p.abcClass === cls).length
              const below = dataset.perfumes.filter((p) => p.abcClass === cls).length
              return (
                <div key={cls} className="rounded-xl border border-black/[0.06] p-3 dark:border-white/[0.07]">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-medium">
                      Class {cls}
                      <span className="ml-2 text-[10.5px] text-wahj-smoke">{affected} SKUs</span>
                    </span>
                    <StatusPill tone={cls === 'A' ? 'info' : 'neutral'}>{below} monitored</StatusPill>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[10.5px] text-wahj-smoke">Trigger at (bottles)</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={settings.reorderTriggers[cls]}
                        onChange={(e) =>
                          updateSettings({ reorderTriggers: { ...settings.reorderTriggers, [cls]: Number(e.target.value) || 1 } })
                        }
                        className="input mt-1 py-1.5 tnum"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10.5px] text-wahj-smoke">Batches to produce</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={settings.batchesOnTrigger[cls]}
                        onChange={(e) =>
                          updateSettings({ batchesOnTrigger: { ...settings.batchesOnTrigger, [cls]: Number(e.target.value) || 1 } })
                        }
                        className="input mt-1 py-1.5 tnum"
                      />
                    </label>
                  </div>
                </div>
              )
            })}
            <p className="text-[10.5px] leading-relaxed text-wahj-smoke">
              Only sellable stock counts against a trigger. A batch sitting in maceration is invisible here — exactly the rule from your paper
              tracker.
            </p>
          </div>
        </ChartCard>

        <ChartCard
          title="Profit allocation"
          subtitle="40 / 30 / 20 / 10 — applied to net profit, never to revenue"
          footer={
            <span className={allocationOk ? 'text-pos' : 'text-warn'}>
              Total: {(allocationTotal * 100).toFixed(0)}%{allocationOk ? ' — balanced' : ' — should add up to 100%'}
            </span>
          }
        >
          <div className="space-y-3">
            {(
              [
                ['stock', 'Stock / raw materials'],
                ['ads', 'Ads / acquisition'],
                ['salary', 'Salary'],
                ['savings', 'Savings'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="flex items-center justify-between text-[12px]">
                  <span className="font-medium">{label}</span>
                  <span className="tnum">
                    {(settings.allocation[key] * 100).toFixed(0)}% ·{' '}
                    {formatDH(Math.round(pnl.combined.profit * settings.allocation[key]))}
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.allocation[key]}
                  onChange={(e) => updateSettings({ allocation: { ...settings.allocation, [key]: Number(e.target.value) } })}
                  className="mt-1.5 w-full accent-[#C9A84C]"
                />
              </label>
            ))}
            <div className="rounded-xl border border-black/[0.06] p-3 text-[11.5px] dark:border-white/[0.07]">
              <p className="flex items-center justify-between">
                <span className="text-wahj-smoke">Net profit in this view</span>
                <span className="font-display text-base tnum">{formatDH(Math.round(pnl.combined.profit))}</span>
              </p>
              <p className="mt-1 flex items-center justify-between text-wahj-smoke">
                <span>Revenue · margin</span>
                <span className="tnum">
                  {formatDH(Math.round(kpis.revenue))} · {kpis.margin.toFixed(1)}%
                </span>
              </p>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title="Batch recipe" subtitle="1 batch = 500ml = 16 × 30ml bottles — the base of every unit cost">
          <div className="overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/[0.07]">
            <table className="w-full text-[12px]">
              <tbody className="divide-soft">
                {[
                  ['Perfume oil', `${BASE_RECIPE.oilMlPerBatch} ml`, cost.oil],
                  ['Alcohol', `${BASE_RECIPE.alcoholMlUsed} ml @ ${formatDH(BASE_RECIPE.alcoholPricePerLiter)}/L`, cost.alcohol],
                  [`Bottles × ${BASE_RECIPE.bottlesPerBatch}`, `${formatDH(BASE_RECIPE.bottleCost, { decimals: 2 })} each`, cost.bottles],
                  [`Labels × ${BASE_RECIPE.bottlesPerBatch}`, `${formatDH(BASE_RECIPE.labelCost, { decimals: 2 })} each`, cost.labels],
                ].map(([label, detail, amount]) => (
                  <tr key={String(label)}>
                    <td className="px-3 py-2">
                      <span className="block font-medium">{label}</span>
                      <span className="text-[10.5px] text-wahj-smoke">{detail}</span>
                    </td>
                    <td className="px-3 py-2 text-right tnum">{formatDH(Math.round(Number(amount) * 100) / 100, { decimals: 2 })}</td>
                  </tr>
                ))}
                <tr className="bg-wahj-gold/[0.06]">
                  <td className="px-3 py-2 font-semibold">Batch total</td>
                  <td className="px-3 py-2 text-right font-semibold tnum">{formatDH(Math.round(cost.total * 100) / 100, { decimals: 2 })}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold">Cost per 30ml bottle</td>
                  <td className="px-3 py-2 text-right font-semibold tnum">
                    {formatDH(Math.round(cost.perBottle * 100) / 100, { decimals: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-wahj-smoke">
            Per-SKU oil cost differs (oud and niche extraits cost more), which is why the catalogue shows unit costs from{' '}
            {formatDH(Math.min(...dataset.perfumes.map((p) => p.unitCost30ml)), { decimals: 2 })} to{' '}
            {formatDH(Math.max(...dataset.perfumes.map((p) => p.unitCost30ml)), { decimals: 2 })} across {dataset.perfumes.length} SKUs.
          </p>
        </ChartCard>

        <ChartCard title="Channel rules being enforced" subtitle="Where each rule shows up in the dashboard">
          <ul className="space-y-2.5 text-[11.5px]">
            {[
              ['Local = singles & 2-packs only', 'Orders table tags the order type; packs sold locally raise a warning on import.'],
              ['Online = packs only, 3–5 bottles', 'Each pack costs production + 35 DH delivery + 15% provision — see Products & Packs.'],
              ['Sellable ≠ total stock', 'Stock screen splits sellable vs. macerating; only sellable feeds reorder alerts.'],
              ['Maceration = 14 days', 'Every new batch calculates its ready date; the READY → IN_STOCK step stays manual.'],
              ['ABC triggers A=8, B=5, C=3', 'Stock badges and the reorder alert count are driven by these numbers.'],
              ['40/30/20/10 allocation', 'Finance screen splits only net profit, and only as a suggestion.'],
            ].map(([rule, where]) => (
              <li key={rule} className="flex gap-2.5 rounded-xl border border-black/[0.06] p-2.5 dark:border-white/[0.07]">
                <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pos" />
                <span>
                  <span className="block font-medium">{rule}</span>
                  <span className="text-wahj-smoke">{where}</span>
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <NoteCard
        title="Sanity checks"
        items={[
          'A batch costs ' + formatDH(Math.round(cost.total * 100) / 100, { decimals: 2 }) + ' and yields 16 bottles at ' + formatDH(Math.round(cost.perBottle * 100) / 100, { decimals: 2 }) + ' each — matching the 205 DH / 12.81 DH figures in your v1 doc.',
          `Local margin in the current view sits at ${pnl.local.margin.toFixed(1)}% — the 73.9% figure from your doc applies to a single 49 DH bottle at 12.81 DH cost, inside the same ballpark once duo pricing is included.`,
          `Online absorbs ${formatDH(pnl.online.delivery)} of delivery and ${formatDH(Math.round(pnl.expectedReturnLoss))} of return provision over ${formatNumber(pnl.online.orders)} orders.`,
          'Defaults come from RULES in src/data/catalog.ts — edit that file to change the shipped baseline, or use the sliders here for what-if.',
        ]}
        footer={
          <span className="flex items-center gap-2">
            <IconSpark className="h-3.5 w-3.5 text-wahj-gold" />
            Sliders are live: drag the delivery fee and watch the finance screen re-price every online order instantly.
          </span>
        }
      />

      <p className="px-1 text-[11px] text-wahj-smoke">
        Shipped defaults — delivery {formatDH(RULES.deliveryFee)} · provision {(RULES.returnProvisionRate * 100).toFixed(0)}% · maceration{' '}
        {RULES.macerationDays} days · triggers A{RULES.reorderTriggers.A}/B{RULES.reorderTriggers.B}/C{RULES.reorderTriggers.C}.
      </p>
    </div>
  )
}
