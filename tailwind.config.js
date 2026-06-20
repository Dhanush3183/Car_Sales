/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./owner.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        premium: {
          light: '#fdfbfb',
          DEFAULT: '#f4f4f4',
          dark: '#e2e2e2',
        },
        accent: {
          light: '#3b82f6', // blue-500
          DEFAULT: '#2563eb', // blue-600
          dark: '#1d4ed8', // blue-700
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
