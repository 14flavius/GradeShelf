import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // GradeShelf serves downloads, not image previews. Disable the unused renderer/cache.
  images: { unoptimized: true },
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "./.env*"],
  },
  async rewrites() {
    // Existing home-screen installations may still request the previous manifest URL.
    return [{ source: "/manifest.webmanifest", destination: "/manifest.json" }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      // Only the Tailwind entry needs this loader; keep CSS Modules native.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
