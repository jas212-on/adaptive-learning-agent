/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'hsl(240 6% 4%)',
          muted: 'hsl(240 5% 6%)',
        },
        fg: {
          DEFAULT: 'hsl(0 0% 98%)',
          muted: 'hsl(240 5% 65%)',
        },
        card: {
          DEFAULT: 'hsl(240 5% 7%)',
          fg: 'hsl(0 0% 98%)',
        },
        border: 'rgba(255,255,255,0.07)',
        primary: {
          DEFAULT: 'rgb(129 140 248)',
          fg: 'hsl(240 6% 4%)',
          muted: 'rgba(99,102,241,0.12)',
        },
        ring: 'rgb(129 140 248)',
        danger: { DEFAULT: 'rgb(248 113 113)', fg: 'hsl(240 6% 4%)' },
        success: { DEFAULT: 'rgb(52 211 153)', fg: 'hsl(240 6% 4%)' },
        warning: { DEFAULT: 'rgb(251 191 36)', fg: 'hsl(240 6% 4%)' },
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        soft: '0 4px 24px rgba(0,0,0,0.18)',
        card: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
        glow: '0 0 0 1px rgba(99,102,241,0.3), 0 8px 30px rgba(99,102,241,0.12)',
        'glow-sm': '0 0 0 1px rgba(99,102,241,0.2), 0 4px 16px rgba(99,102,241,0.08)',
        elevated: '0 8px 32px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.16)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
        'fade-in': 'fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'glow-pulse': 'glow-pulse 2.5s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
        'count-up': 'count-up 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        '3xs': ['9px', { lineHeight: '12px' }],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
