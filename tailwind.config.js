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
          DEFAULT: "#C4857A",
          light:   "#E8C8C0",
          dark:    "#7A4A40",
        },
      },
      typography: {
        DEFAULT: {
          css: {
            color: "#525252",
            a: { color: "#C4857A", "&:hover": { color: "#7A4A40" } },
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
