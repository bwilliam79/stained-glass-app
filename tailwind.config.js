/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          50: '#fdf4e7',
          100: '#fbe8ce',
          200: '#f6c97d',
          300: '#f0a832',
          400: '#e08a10',
          500: '#c4730a',
          600: '#9e5c07',
          700: '#7a4706',
          800: '#5c3505',
          900: '#3d2303',
        }
      }
    },
  },
  plugins: [],
}
