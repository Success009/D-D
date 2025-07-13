/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'serif': ['Merriweather', 'serif'],
        'display': ['"IM Fell English SC"', 'serif'],
      },
      colors: {
          'parchment': '#fdf6e3',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out',
      }
    }
  },
  plugins: [],
}
