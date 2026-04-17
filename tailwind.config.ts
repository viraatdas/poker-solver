import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Inter", "Helvetica Neue", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SF Mono", "Menlo", "Monaco", "monospace"],
      },
      colors: {
        ink: {
          900: "#0a0a0a",
          800: "#1a1a1a",
          700: "#2a2a2a",
          600: "#404040",
          500: "#6b6b6b",
          400: "#9a9a9a",
          300: "#c9c9c9",
          200: "#e5e5e5",
          100: "#f4f4f4",
          50:  "#fafafa",
        },
        accent: {
          DEFAULT: "#0a0a0a",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
        ring: "0 0 0 1px rgba(0,0,0,0.08)",
      },
      borderRadius: {
        xl2: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
