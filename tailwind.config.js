/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Farben kommen aus CSS-Variablen → Light/Dark per .dark-Klasse umschaltbar
      colors: {
        sand: {
          light: 'rgb(var(--c-sand-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--c-sand) / <alpha-value>)',
          dark: 'rgb(var(--c-sand-dark) / <alpha-value>)',
        },
        cream: 'rgb(var(--c-cream) / <alpha-value>)',
        ruby: {
          light: 'rgb(var(--c-ruby-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--c-ruby) / <alpha-value>)',
          dark: 'rgb(var(--c-ruby-dark) / <alpha-value>)',
        },
        cocoa: {
          DEFAULT: 'rgb(var(--c-text) / <alpha-value>)',
          light: 'rgb(var(--c-text-muted) / <alpha-value>)',
          muted: 'rgb(var(--c-text-dim) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--c-ruby) / <alpha-value>)',
          dark: 'rgb(var(--c-ruby-dark) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
