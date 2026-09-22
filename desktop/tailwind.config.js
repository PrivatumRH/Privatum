/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#B91C3B",
          ruby: "#B91C3B",
          hover: "#9D1632",
          dark: "#0b0e14",
          surface: "#111520",
          border: "rgba(255, 255, 255, 0.08)",
        },
      },
    },
  },
  plugins: [],
}

