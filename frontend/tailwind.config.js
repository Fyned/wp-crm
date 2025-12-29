/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E8F5E9',
          100: '#C8E6C9',
          200: '#A5D6A7',
          300: '#81C784',
          400: '#66BB6A',
          500: '#25D366', // WhatsApp green
          600: '#22C55E',
          700: '#1DB954',
          800: '#18A349',
          900: '#128C3D',
        },
        wa: {
          bg: '#111B21',
          panel: '#222E35',
          message: '#005C4B',
          hover: '#2A3942',
          border: '#313D45',
          bubble: '#005C4B',
          bubbleOut: '#056162',
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
