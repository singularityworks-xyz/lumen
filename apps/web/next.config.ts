import { spawnSync } from "node:child_process";
import withSerwistInit from "@serwist/next";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const isTauriBuild = process.env.IS_TAURI_BUILD === "true";
const workersApiOriginRaw =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.E2E_WORKERS_URL ??
  "http://127.0.0.1:3002";
const workersApiOrigin = workersApiOriginRaw.endsWith("/")
  ? workersApiOriginRaw.slice(0, -1)
  : workersApiOriginRaw;

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf-8",
  }).stdout?.trim() ?? crypto.randomUUID();

// Only initialize Serwist for non-Tauri builds (PWA not needed in native app)
const withSerwist = isTauriBuild
  ? (config: NextConfig) => config
  : withSerwistInit({
      swSrc: "src/app/sw.ts",
      swDest: "public/sw.js",
      additionalPrecacheEntries: [{ url: "/~offline", revision }],
      cacheOnNavigation: true,
      reloadOnOnline: false,
      register: true,
      swUrl: "/sw.js",
      scope: "/",
    });

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Disable cacheComponents (PPR) for Tauri builds - not compatible with static export
  cacheComponents: !isTauriBuild,
  typedRoutes: false,
  turbopack: {},
  // Enable static export for Tauri builds
  ...(isTauriBuild && {
    output: "export",
    distDir: "out",
  }),
  experimental: {
    cssChunking: true,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${workersApiOrigin}/api/:path*`,
      },
    ];
  },
  images: {
    // Use unoptimized images for static export
    ...(isTauriBuild && { unoptimized: true }),
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  transpilePackages: [
    "@lumen/logger",
    "lib0",
    "y-protocols",
    "yjs",
    "y-indexeddb",
  ],
};

export default withBotId(withSerwist(nextConfig));
