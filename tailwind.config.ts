import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        void: "rgb(var(--color-void) / <alpha-value>)",
        "surface-100": "rgb(var(--color-surface-100) / <alpha-value>)",
        "surface-200": "rgb(var(--color-surface-200) / <alpha-value>)",
        "card-surface": "rgb(var(--color-card-surface) / <alpha-value>)",
        "raycast-red": "#FF6363",
        "raycast-blue": "#55b3ff",
        "raycast-green": "#5fc992",
        "raycast-yellow": "#ffbc33",
        "near-white": "rgb(var(--color-near-white) / <alpha-value>)",
        "light-gray": "rgb(var(--color-light-gray) / <alpha-value>)",
        silver: "rgb(var(--color-silver) / <alpha-value>)",
        "medium-gray": "rgb(var(--color-medium-gray) / <alpha-value>)",
        "dim-gray": "rgb(var(--color-dim-gray) / <alpha-value>)",
        "dark-gray": "rgb(var(--color-dark-gray) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        "dark-border": "rgb(var(--color-dark-border) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "Inter Fallback", "system-ui", "sans-serif"],
        mono: ["GeistMono", "ui-monospace", "SFMono-Regular", "monospace"],
        brush: [
          "Ma Shan Zheng",
          "ZCOOL XiaoWei",
          "Noto Serif SC",
          "STKaiti",
          "KaiTi",
          "serif",
        ],
        "serif-cn": [
          "Noto Serif SC",
          "ZCOOL XiaoWei",
          "Songti SC",
          "STSong",
          "serif",
        ],
      },
      letterSpacing: {
        "raycast-body": "0.2px",
        "raycast-button": "0.3px",
        "raycast-small": "0.4px",
      },
      boxShadow: {
        "card-ring": "var(--shadow-card-ring)",
        "button-native": "var(--shadow-button-native)",
        floating:
          "rgba(0,0,0,0.5) 0px 0px 0px 2px, rgba(255,255,255,0.19) 0px 0px 14px",
        "warm-glow": "rgba(215,201,175,0.05) 0px 0px 20px 5px",
        "blue-glow": "rgba(0,153,255,0.15) 0px 0px 20px 5px",
        "glow-blue-sm": "0 0 10px rgba(85, 179, 255, 0.3), 0 0 20px rgba(85, 179, 255, 0.15)",
        "glow-blue-md": "0 0 20px rgba(85, 179, 255, 0.4), 0 0 40px rgba(85, 179, 255, 0.2)",
        "glow-blue-lg": "0 0 30px rgba(85, 179, 255, 0.5), 0 0 60px rgba(85, 179, 255, 0.25), 0 0 90px rgba(85, 179, 255, 0.1)",
        "glow-rainbow": "0 0 20px rgba(255, 99, 99, 0.3), 0 0 40px rgba(85, 179, 255, 0.3), 0 0 60px rgba(95, 201, 146, 0.3)",
        "glow-pulse": "0 0 15px rgba(85, 179, 255, 0.4), 0 0 30px rgba(85, 179, 255, 0.2)",
      },
      borderRadius: {
        pill: "86px",
      },
      perspective: {
        "1000": "1000px",
        "2000": "2000px",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "50%": { opacity: "0.8", filter: "brightness(1.2)" },
        },
        "particle-float": {
          "0%": { transform: "translateY(0) translateX(0)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(-100vh) translateX(20px)", opacity: "0" },
        },
        "rotate-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        scan: {
          "0%": { transform: "rotate(0deg)", opacity: "0.3" },
          "50%": { opacity: "0.5" },
          "100%": { transform: "rotate(360deg)", opacity: "0.3" },
        },
      },
      animation: {
        float: "float 4s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "particle-float": "particle-float 15s linear infinite",
        "rotate-slow": "rotate-slow 20s linear infinite",
        shimmer: "shimmer 3s linear infinite",
        scan: "scan 4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
