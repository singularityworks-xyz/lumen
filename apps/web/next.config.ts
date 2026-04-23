import { fileURLToPath } from "node:url";
import { withSerwist } from "@serwist/turbopack";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const isTauriBuild = process.env.IS_TAURI_BUILD === "true";
const turbopackRoot = fileURLToPath(new URL("../..", import.meta.url));
const workersApiOriginRaw =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.E2E_WORKERS_URL ??
  "http://127.0.0.1:3002";
const workersApiOrigin = workersApiOriginRaw.endsWith("/")
  ? workersApiOriginRaw.slice(0, -1)
  : workersApiOriginRaw;

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: !isTauriBuild,
  typedRoutes: false,
  turbopack: {
    root: turbopackRoot,
  },
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

export default isTauriBuild
  ? withBotId(nextConfig)
  : withBotId(withSerwist(nextConfig));
