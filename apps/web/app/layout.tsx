import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { PlayerProvider } from "@/lib/player-context";
import { Sidebar } from "@/components/layout/sidebar";
import { MiniPlayer } from "@/components/player/mini-player";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Track Atlas",
  description: "A map of sound — discover tracks, scenes, and collisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <PlayerProvider>
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-y-auto pb-16">{children}</main>
            </div>
            <MiniPlayer />
          </PlayerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
