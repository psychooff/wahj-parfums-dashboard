interface IconProps {
  className?: string
  strokeWidth?: number
}

const base = (className = 'h-4 w-4') => ({ className, viewBox: '0 0 24 24', fill: 'none' as const })

export const IconMoon = ({ className, strokeWidth = 1.7 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
)

export const IconSun = ({ className, strokeWidth = 1.7 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

export const IconTrendUp = ({ className, strokeWidth = 2 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M21 7v5h-5" />
  </svg>
)

export const IconTrendDown = ({ className, strokeWidth = 2 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7l6 6 4-4 8 8" />
    <path d="M21 17v-5h-5" />
  </svg>
)

export const IconFlame = ({ className, strokeWidth = 1.7 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3c3.2 4.6 6 7.2 6 11a6 6 0 0 1-12 0c0-4 2.8-6.4 6-11Z" />
    <path d="M12 19a2.5 2.5 0 0 0 2.5-2.5c0-1.6-1.2-2.5-2.5-4.5-1.3 2-2.5 2.9-2.5 4.5A2.5 2.5 0 0 0 12 19Z" />
  </svg>
)

export const IconBox = ({ className, strokeWidth = 1.7 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="m21 8-9-5-9 5 9 5 9-5Z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M12 13v8" />
  </svg>
)

export const IconChart = ({ className, strokeWidth = 1.7 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M7 15v3M12 10v8M17 6v12" />
  </svg>
)

export const IconUsers = ({ className, strokeWidth = 1.7 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 5.2a3.2 3.2 0 0 1 0 5.6" />
  </svg>
)

export const IconCoins = ({ className, strokeWidth = 1.7 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="6.5" rx="7" ry="3" />
    <path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    <path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
  </svg>
)

export const IconDroplet = ({ className, strokeWidth = 1.7 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3.5c3 4.3 5.5 6.8 5.5 10a5.5 5.5 0 0 1-11 0c0-3.2 2.5-5.7 5.5-10Z" />
  </svg>
)

export const IconDownload = ({ className, strokeWidth = 1.7 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
    <path d="M4 19h16" />
  </svg>
)

export const IconSearch = ({ className, strokeWidth = 1.8 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
)

export const IconChevron = ({ className, strokeWidth = 2 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const IconAlert = ({ className, strokeWidth = 1.8 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 4.3 2.6 18a1.9 1.9 0 0 0 1.7 2.8h15.4A1.9 1.9 0 0 0 21.4 18L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z" />
    <path d="M12 9v4.5M12 17.2h.01" />
  </svg>
)

export const IconCheck = ({ className, strokeWidth = 2 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 12.5 5 5L20 6.5" />
  </svg>
)

export const IconClock = ({ className, strokeWidth = 1.7 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

export const IconLayers = ({ className, strokeWidth = 1.7 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
)

export const IconClose = ({ className, strokeWidth = 2 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const IconMenu = ({ className, strokeWidth = 1.9 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)

export const IconSpark = ({ className, strokeWidth = 1.7 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
  </svg>
)

export const IconGear = ({ className, strokeWidth = 1.7 }: IconProps) => (
  <svg {...base(className)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
)
