import type { NextConfig } from "next";

// Where the NestJS API runs. The browser never calls it directly:
// requests to /api/* on the web app are proxied there (same origin, no CORS).
const apiUrl = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  logging: {
    fetches: { fullUrl: true },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "placehold.co", pathname: "/600x400/png" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
