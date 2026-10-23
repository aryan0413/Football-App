import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Navigation } from "@/components/football/Navigation";

const geist = localFont({
  src: "../public/fonts/geist-latin.woff2",
  display: "swap",
  variable: "--font-geist",
  weight: "100 900"
});

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
  themeColor: "#101112"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable} data-scroll-behavior="smooth">
      <body>
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#c5f467",
              colorPrimaryForeground: "#18220b",
              colorBackground: "#191b19",
              colorForeground: "#f2f3f0",
              colorMuted: "#232622",
              colorMutedForeground: "#92958e",
              colorNeutral: "#f2f3f0",
              colorInput: "#131610",
              colorInputForeground: "#f2f3f0",
              colorBorder: "#383c33",
              colorDanger: "#f18183",
              borderRadius: "6px",
              fontFamily: "var(--font-geist), Arial, sans-serif"
            }
          }}
        >
          <Navigation />
          <main id="main-content" className="app-shell">
            {children}
          </main>
        </ClerkProvider>
      </body>
    </html>
  );
}
