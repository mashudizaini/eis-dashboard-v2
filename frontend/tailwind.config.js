/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        pharma: {
          50: '#e8f4f8',
          100: '#d1e9f1',
          200: '#a3d3e3',
          300: '#75bdd5',
          400: '#47a7c7',
          500: '#1a8fb4',
          600: '#156f8c',
          700: '#1a5a73',
          800: '#1f4e64',
          900: '#1b3a4a',
          950: '#0f2a37',
        },
        accent: {
          gold: '#d4a843',
          emerald: '#10b981',
          coral: '#ef6c4a',
          slate: '#64748b',
        },
      },
      fontFamily: {
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
