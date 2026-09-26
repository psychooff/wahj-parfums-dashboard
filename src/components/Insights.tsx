import { useMemo, type ReactNode } from 'react'
import { useDashboard } from '../state/store'
import { formatDH, formatDay, relativeDays } from '../lib/dates'
import { trend } from '../lib/metrics'
import { IconAlert, IconCheck, IconClock, IconDroplet, IconFlame, IconUsers } from './icons'

export interface Insight {
  tone: 'pos' | 'warn' | 'bad' | 'info'
  title: string
  body: string
  icon: ReactNode
}

/** Plain-language reading of the numbers — the "so what?" layer above the charts. */
export function useInsights(): Insight[] {
  const { kpis, prevKpis, pnl, perfumes, openAlerts, stock, settings, dataset, filters, granularity } = useDashboard()

  return useMemo(() => {
    const out: Insight[] = []
    const revDelta = trend(kpis.revenue, prevKpis.revenue)

    if (revDelta !== null) {
      out.push({
        tone: revDelta >= 0 ? 'pos' : 'bad',
        title: `Revenue ${revDelta >= 0 ? 'up' : 'down'} ${Math.abs(revDelta).toFixed(1)}%`,
        body: `${formatDH(Math.round(kpis.revenue))} this period vs ${formatDH(Math.round(prevKpis.revenue))} in the previous one${kpis.aov ? ` · average basket ${formatDH(Math.round(kpis.aov))}` : ''}.`,
        icon: <IconFlame className="h-4 w-4" />,
      })
    }

    // Channel economics
    const localMargin = pnl.local.margin
    const onlineMargin = pnl.online.margin
    if (pnl.online.revenue > 0 || pnl.local.revenue > 0) {
      out.push({
        tone: onlineMargin < localMargin ? 'info' : 'pos',
        title: `Local ${localMargin.toFixed(0)}% vs Online ${onlineMargin.toFixed(0)}% margin`,
        body: `Online carries ${formatDH(settings.deliveryFee)} delivery + ${(settings.returnProvisionRate * 100).toFixed(0)}% return provision on every order (${formatDH(Math.round(pnl.online.returns))} reserved this period), which is why packs are priced the way they are.`,
        icon: <IconDroplet className="h-4 w-4" />,
      })
    }

    // Returns vs provision
    const realised = pnl.actualReturnLoss
    const reserved = pnl.expectedReturnLoss
    if (reserved > 0) {
      const overReserved = reserved > realised
      out.push({
        tone: overReserved ? 'pos' : 'warn',
        title: overReserved ? `Returns are cheaper than provisioned` : `Returns are running above provision`,
        body: `You reserved ${formatDH(Math.round(reserved))} but real return damage was ${formatDH(Math.round(realised))}${overReserved ? ` — headroom of ${formatDH(Math.round(reserved - realised))}.` : ' — consider re-checking the courier or the pack descriptions.'} Online return rate: ${kpis.onlineReturnRate.toFixed(1)}%.`,
        icon: <IconCheck className="h-4 w-4" />,
      })
    }

    // Stock urgency
    if (openAlerts.length) {
      const worst = [...openAlerts].sort((a, b) => a.sellable - b.sellable)[0]
      const cookingSoon = stock.filter((s) => s.nextReadyInDays !== null && s.nextReadyInDays <= 3).length
      out.push({
        tone: worst.reorderStatus === 'urgent' ? 'bad' : 'warn',
        title: `${openAlerts.length} SKU${openAlerts.length > 1 ? 's' : ''} below the reorder trigger`,
        body: `Worst case: ${worst.perfume.name} (Class ${worst.perfume.abcClass}) with ${worst.sellable} sellable vs a trigger of ${worst.trigger}. ${cookingSoon ? `${cookingSoon} batch${cookingSoon > 1 ? 'es' : ''} become ready within 3 days — confirm them before producing.` : 'Nothing is close to ready, so a production run is needed.'}`,
        icon: <IconAlert className="h-4 w-4" />,
      })
    }

    // Top seller concentration
    if (perfumes.length) {
      const top = perfumes[0]
      const total = perfumes.reduce((s, p) => s + p.revenue, 0)
      const topShare = total ? (top.revenue / total) * 100 : 0
      out.push({
        tone: topShare > 40 ? 'warn' : 'info',
        title: `${top.perfume.name} leads with ${topShare.toFixed(0)}% of revenue`,
        body: `${top.bottles} bottles sold${topShare > 40 ? ' — that is a lot of dependence on one SKU. Consider pushing a second hero.' : ' while the catalogue spreads the rest of the demand.'}`,
        icon: <IconDroplet className="h-4 w-4" />,
      })
    }

    // Loyalty
    const near = dataset.customers.filter((c) => c.bottlesThisCycle >= 4).length
    if (near) {
      out.push({
        tone: 'info',
        title: `${near} loyal customers are 1 bottle from a free one`,
        body: `${dataset.customers.filter((c) => c.bottlesThisCycle >= 5).length} have already completed a 5-bottle cycle. A single WhatsApp message is the cheapest revenue in this whole dashboard.`,
        icon: <IconUsers className="h-4 w-4" />,
      })
    }

    // Best momentum in the window
    if (granularity !== 'month' && perfumes.length > 1) {
      out.push({
        tone: 'info',
        title: `View: ${formatDay(filters.from)} → ${formatDay(filters.to)}`,
        body: `${kpis.orders} orders, ${kpis.bottles} bottles, ${kpis.avgBasketBottles} bottles per order. ${kpis.newCustomers} first-time buyers joined in this window.`,
        icon: <IconClock className="h-4 w-4" />,
      })
    }

    void relativeDays
    return out
  }, [kpis, prevKpis, pnl, perfumes, openAlerts, stock, settings, dataset, filters, granularity])
}

const TONES: Record<Insight['tone'], string> = {
  pos: 'border-pos/25 bg-pos/[0.07] text-pos',
  warn: 'border-warn/25 bg-warn/[0.07] text-warn',
  bad: 'border-neg/25 bg-neg/[0.07] text-neg',
  info: 'border-wahj-gold/25 bg-wahj-gold/[0.07] text-wahj-gold',
}

export function InsightList({ limit = 5 }: { limit?: number }) {
  const insights = useInsights()
  return (
    <ul className="space-y-2.5">
      {insights.slice(0, limit).map((insight, i) => (
        <li
          key={insight.title}
          className={`flex gap-3 rounded-xl border p-3 animate-fade-up ${TONES[insight.tone]}`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <span className="mt-0.5 shrink-0">{insight.icon}</span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-semibold text-wahj-ink dark:text-wahj-sand">{insight.title}</span>
            <span className="mt-0.5 block text-[11.5px] leading-relaxed text-wahj-smoke">{insight.body}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
