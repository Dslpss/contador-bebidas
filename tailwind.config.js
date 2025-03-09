/** @type {import('tailwindcss').Config} */
module.exports = {
  purge: ["./src/**/*.html", "./src/**/*.js"],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary-color)",
        "primary-dark": "var(--primary-dark)",
        secondary: "var(--secondary-color)",
        "secondary-dark": "var(--secondary-dark)",
        "background-light": "var(--background-light)",
        "text-light": "var(--text-light)",
        "card-light": "var(--card-light)",

        // Adicionando cores explicitamente para melhor compatibilidade
        red: {
          500: "var(--primary-color)",
          600: "var(--primary-dark)",
          700: "#b91c1c",
        },
        gray: {
          800: "var(--secondary-color)",
          900: "var(--secondary-dark)",
          700: "#374151",
          600: "#4B5563",
        },
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
      },
    },
  },
  plugins: [],
};
