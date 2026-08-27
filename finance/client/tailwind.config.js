/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        school: {
          navy: '#152a5e',
          'navy-dark': '#0c1840',
          'navy-light': '#1e4080',
          red: '#c41e3a',
          'red-dark': '#9e1830',
          'red-light': '#e8354f',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
