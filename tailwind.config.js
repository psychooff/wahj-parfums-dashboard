/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Fire in Darkness brand system ─────────────────────────────
        wahj: {
          black: '#0A0A0A',
          ink: '#121112',
          coal: '#16151A',
          gold: '#C9A84C',
          bright: '#E4C56B',
          ember: '#B8560E',
          sand: '#D9C9A3',
          smoke: '#9A968D',
          paper: '#FAF8F4',
        },
        pos: '#34D399',
        neg: '#F87171',
        warn: '#FBBF24',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        arabic: ['Cairo', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        ember: '0 0 40px -10px rgba(201,168,76,0.35)',
        emberLg: '0 0 90px -20px rgba(184,86,14,0.55)',
        card: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -16px rgba(0,0,0,0.35)',
        cardDark: '0 1px 0 rgba(255,255,255,0.03) inset, 0 18px 40px -28px rgba(0,0,0,0.9)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-soft': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        'sheen': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 300ms ease-out both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        sheen: 'sheen 2.6s linear infinite',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
