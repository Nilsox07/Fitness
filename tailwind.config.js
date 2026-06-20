/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette aus dem Moodboard
        sand: {
          light: '#FFE8CC',
          DEFAULT: '#FFCC99',
          dark: '#E8B27A',
        },
        ruby: {
          light: '#C0392B',
          DEFAULT: '#990000',
          dark: '#7A0000',
        },
        cream: '#FFF6EC',
        // warme Brauntöne für Text auf hellem Grund
        cocoa: {
          DEFAULT: '#5A2A1A',
          light: '#8A5A45',
          muted: '#B08968',
        },
        // Alias: „brand" zeigt jetzt auf Ruby Red (deckt bestehende Klassen ab)
        brand: {
          DEFAULT: '#990000',
          dark: '#7A0000',
        },
      },
    },
  },
  plugins: [],
}
