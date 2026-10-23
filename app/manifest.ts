import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Football Groups",
    short_name: "Football",
    description: "Private football groups, auctions, live matches, ratings, and stats.",
    start_url: "/",
    display: "standalone",
    background_color: "#101112",
    theme_color: "#101112",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable"
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
