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
          DEFAULT: "#f64b43",
          coral: "#f64b43",
          hover: "#e53e36",
          dark: "#0b0e14",
          surface: "#111520",
          border: "rgba(255, 255, 255, 0.08)",
        },
      },
    },
  },
  plugins: [],
}

