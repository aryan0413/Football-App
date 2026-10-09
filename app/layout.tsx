import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navigation } from "@/components/football/Navigation";

export const metadata: Metadata = {
  title: "Football Groups",
  description: "Private football groups with auctions, live matches, ratings, and stats.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Football"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060a1f"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <ClerkProvider>
          <Navigation />
          <main className="app-shell">{children}</main>
        </ClerkProvider>
      </body>
    </html>
  );
}
