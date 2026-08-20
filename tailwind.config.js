/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/client-login.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        adblue: '#1a56c4',
        adgreen: '#7ed321',
      },
    },
  },
  plugins: [],
};