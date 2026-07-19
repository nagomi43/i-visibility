import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: {
          950: "#05060a",
          900: "#0a0c14",
          800: "#0f1220",
          700: "#151a2e",
          600: "#1c2340",
        },
        cyan: {
          glow: "#22d3ee",
          soft: "#67e8f9",
        },
        violet: {
          glow: "#a78bfa",
          soft: "#c4b5fd",
        },
        blue: {
          glow: "#60a5fa",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(34, 211, 238, 0.15)",
        "glow-violet": "0 0 40px rgba(167, 139, 250, 0.15)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34, 211, 238, 0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(167, 139, 250, 0.08), transparent)",
      },
    },
  },
  plugins: [],
};

export default config;
