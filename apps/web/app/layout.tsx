import type { Metadata } from "next";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { PlayerProvider } from "@/lib/player-context";
import { Sidebar } from "@/components/layout/sidebar";
import { MiniPlayer } from "@/components/player/mini-player";

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
      <body className="font-sans antialiased">
        <ThemeProvider>
          <PlayerProvider>
            <div className="flex h-screen surface-0">
              <Sidebar />
              <main className="flex-1 overflow-y-auto pb-16 surface-0">{children}</main>
            </div>
            <MiniPlayer />
          </PlayerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
