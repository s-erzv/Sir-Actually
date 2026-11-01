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
        void: "#0c0e0d",
        crypt: "#0c0e0d",
        tomb: "#343a35",
        slab: "#343a35",
        ridge: "#343a35",
        rune: "#a2aa9d",
        gold: "#f0f1e8",
        ember: "#a2aa9d",
        blood: "#f0f1e8",
        mana: "#a2aa9d",
        moss: "#f0f1e8",
        bone: "#f0f1e8",
        ash: "#a2aa9d",
        ink: "#0c0e0d",
        stone: "#343a35",
      },
      fontFamily: {
        pixel: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        pixel: "4px 4px 0 0 #0c0e0d",
        "pixel-sm": "2px 2px 0 0 #0c0e0d",
        panel: "4px 4px 0 0 #0c0e0d",
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
