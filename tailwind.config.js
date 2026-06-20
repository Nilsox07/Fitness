/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark + Crimson Theme
        // Hintergründe / Flächen
        sand: {
          light: '#1F2937', // Inputs / Ghost-Buttons
          DEFAULT: '#232E44', // Panels / Insets
          dark: '#344155', // Ränder / Chips
        },
        cream: '#161D2B', // Karten / Tab-Leiste
        // Akzent (Crimson)
        ruby: {
          light: '#FB7185',
          DEFAULT: '#E11D48',
          dark: '#BE123C',
        },
        // Text
        cocoa: {
          DEFAULT: '#E5E9F0',
          light: '#94A3B8',
          muted: '#64748B',
        },
        // Alias: „brand" = Crimson-Akzent
        brand: {
          DEFAULT: '#E11D48',
          dark: '#BE123C',
        },
      },
    },
  },
  plugins: [],
}
