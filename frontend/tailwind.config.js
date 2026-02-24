/** @type {import('tailwindcss').Config} */
export default {
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
          500: '#0660B2',  // Primary
          600: '#0554a0',
          700: '#04448a',
          800: '#033570',
          900: '#022556',
        },
      },
    },
  },
  plugins: [],
}
