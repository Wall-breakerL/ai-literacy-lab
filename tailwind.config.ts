import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        void: "#07080a",
        "surface-100": "#101111",
        "surface-200": "#1b1c1e",
        "card-surface": "#1b1c1e",
        "raycast-red": "#FF6363",
        "raycast-blue": "#55b3ff",
        "raycast-green": "#5fc992",
        "raycast-yellow": "#ffbc33",
        "near-white": "#f9f9f9",
        "light-gray": "#cecece",
        silver: "#c0c0c0",
        "medium-gray": "#9c9c9d",
        "dim-gray": "#6a6b6c",
        "dark-gray": "#434345",
        border: "#252829",
        "dark-border": "#2f3031",
      },
      fontFamily: {
        sans: ["Inter", "Inter Fallback", "system-ui", "sans-serif"],
        mono: ["GeistMono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        "raycast-body": "0.2px",
        "raycast-button": "0.3px",
        "raycast-small": "0.4px",
      },
      boxShadow: {
        "card-ring":
          "rgb(27, 28, 30) 0px 0px 0px 1px, rgb(7, 8, 10) 0px 0px 0px 1px inset",
        "button-native":
          "rgba(255,255,255,0.05) 0px 1px 0px 0px inset, rgba(255,255,255,0.25) 0px 0px 0px 1px, rgba(0,0,0,0.2) 0px -1px 0px 0px inset",
        floating:
          "rgba(0,0,0,0.5) 0px 0px 0px 2px, rgba(255,255,255,0.19) 0px 0px 14px",
        "warm-glow": "rgba(215,201,175,0.05) 0px 0px 20px 5px",
        "blue-glow": "rgba(0,153,255,0.15) 0px 0px 20px 5px",
      },
      borderRadius: {
        pill: "86px",
      },
    },
  },
  plugins: [],
};

export default config;
