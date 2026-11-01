import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./game/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0a0f14",
        void: "#0a0f14",
        crypt: "#0a0f14",
        tomb: "#161d26",
        slab: "#1e2833",
        stone: "#1e2833",
        ridge: "#34424e",
        ash: "#8e9aa8",
        rune: "#b9c4d0",
        bone: "#f2ecdd",
        gold: "#e9b85d",
        ember: "#d9713f",
        blood: "#cf5c68",
        mana: "#8f95d9",
        moss: "#8fbd72",
      },
      fontFamily: {
        pixel: ["var(--font-display)", "ui-monospace", "monospace"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        pixel: "4px 4px 0 0 #0a0f14",
        "pixel-sm": "2px 2px 0 0 #0a0f14",
        panel: "4px 4px 0 0 #0a0f14",
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "torch-flicker": {
          "0%, 100%": { transform: "scaleY(1)", opacity: "1" },
          "50%": { transform: "scaleY(0.75)", opacity: "0.75" },
        },
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        "walk-in": {
          "0%": { transform: "translateX(-12px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        flicker: "flicker 2s infinite steps(2,end)",
        floaty: "floaty 4s infinite steps(4,end)",
        marquee: "marquee 28s linear infinite",
        torch: "torch-flicker 1.2s infinite steps(2,end)",
        bob: "bob 2.4s infinite steps(2,end)",
        "walk-in": "walk-in 400ms steps(4,end) both",
      },
    },
  },
  plugins: [],
};

export default config;
