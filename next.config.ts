import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  async headers() {
    return [
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      }
    ];
  },
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
