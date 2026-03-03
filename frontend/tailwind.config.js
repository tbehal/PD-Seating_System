/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        body: ['Karla', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#e8f1fb',
          100: '#c5daf5',
          200: '#9ec0ed',
          300: '#6da2e3',
          400: '#3d82d6',
          500: '#0660B2',
          600: '#0554a0',
          700: '#04448a',
          800: '#033570',
          900: '#022556',
        },
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
          foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)',
        },
        border: 'rgb(var(--border) / <alpha-value>)',
        input: 'rgb(var(--input) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
        destructive: {
          DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
          foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)',
          muted: 'rgb(var(--destructive-muted) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          foreground: 'rgb(var(--success-foreground) / <alpha-value>)',
          muted: 'rgb(var(--success-muted) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          foreground: 'rgb(var(--warning-foreground) / <alpha-value>)',
          muted: 'rgb(var(--warning-muted) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          foreground: 'rgb(var(--info-foreground) / <alpha-value>)',
          muted: 'rgb(var(--info-muted) / <alpha-value>)',
        },
        'grid-available': {
          DEFAULT: 'rgb(var(--grid-available) / <alpha-value>)',
          fg: 'rgb(var(--grid-available-fg) / <alpha-value>)',
        },
        'grid-booked': {
          DEFAULT: 'rgb(var(--grid-booked) / <alpha-value>)',
          fg: 'rgb(var(--grid-booked-fg) / <alpha-value>)',
        },
        'grid-unavailable': 'rgb(var(--grid-unavailable) / <alpha-value>)',
        'grid-selected': {
          DEFAULT: 'rgb(var(--grid-selected) / <alpha-value>)',
          border: 'rgb(var(--grid-selected-border) / <alpha-value>)',
        },
        overlay: 'rgb(var(--overlay) / <alpha-value>)',
        skeleton: 'rgb(var(--skeleton) / <alpha-value>)',
      },
      borderColor: {
        DEFAULT: 'rgb(var(--border) / <alpha-value>)',
      },
      ringColor: {
        DEFAULT: 'rgb(var(--ring) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
