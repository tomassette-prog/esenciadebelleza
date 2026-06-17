/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-cormorant)", "Georgia", "serif"],
      },
      colors: {
        oro: {
          DEFAULT: "#C9A84C",
          light:   "#E8D5A3",
          dark:    "#8B6914",
        },
      },
      typography: {
        DEFAULT: {
          css: {
            color: "#525252",
            a: { color: "#C9A84C", "&:hover": { color: "#8B6914" } },
            h2: { fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: "300" },
            h3: { fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: "400" },
          },
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};
