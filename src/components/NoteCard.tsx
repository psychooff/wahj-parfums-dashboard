import type { ReactNode } from 'react'
import { IconFlame } from './icons'

/** Small "how to read this" helper so the dashboard explains itself. */
export function NoteCard({ title, items, footer }: { title: string; items: ReactNode[]; footer?: ReactNode }) {
  return (
    <section className="card card-pad">
      <h3 className="card-title flex items-center gap-2">
        <IconFlame className="h-3.5 w-3.5 text-wahj-gold" />
        {title}
      </h3>
      <ul className="mt-2.5 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-wahj-smoke">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-wahj-gold/70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {footer && <p className="mt-3 border-t border-black/[0.06] pt-3 text-[11px] text-wahj-smoke dark:border-white/[0.06]">{footer}</p>}
    </section>
  )
}
