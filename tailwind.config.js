/** @type {import('tailwindcss').Config} */
module.exports = {
  purge: ['./src/**/*.html', './src/**/*.js'],
  theme: {
    extend: {
      colors: {
        'primary': 'var(--primary-color)',
        'secondary': 'var(--secondary-color)',
        'background-light': 'var(--background-light)',
        'text-light': 'var(--text-light)',
        'card-light': 'var(--card-light)',
      },
      fontFamily: {
        'poppins': ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
