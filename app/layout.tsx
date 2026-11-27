import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./game-ui.css";
import SoundDock from "@/components/ui/SoundDock";

const dmSans = localFont({
  src: [
    { path: "./fonts/DMSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/DMSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/DMSans-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});

const silkscreen = localFont({
  src: [
    { path: "./fonts/Silkscreen-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Silkscreen-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

/* Ninja Adventure font (CC0, pixel-boy), space widened to 4 px for readable words. */
const gameFont = localFont({
  src: [{ path: "./fonts/NinjaAdventureSA.ttf", weight: "400", style: "normal" }],
  variable: "--font-game",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sir, Actually",
  description: "Naskah risetmu jadi dungeon. Jawab penjaganya dengan bukti.",
};

export const viewport: Viewport = {
  themeColor: "#121a20",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${dmSans.variable} ${silkscreen.variable} ${gameFont.variable}`}>
      <body>
        {children}
        <SoundDock />
      </body>
    </html>
  );
}
