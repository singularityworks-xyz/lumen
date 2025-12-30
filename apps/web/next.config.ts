import { spawnSync } from "node:child_process";
import withSerwistInit from "@serwist/next";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf-8",
  }).stdout?.trim() ?? crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  cacheOnNavigation: true,
  reloadOnOnline: false,
  register: true,
  swUrl: "/sw.js",
  scope: "/",
});

const isTauriBuild = process.env.IS_TAURI_BUILD === "true";

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  typedRoutes: true,
  turbopack: {},
  ...(isTauriBuild && {
    output: "export",
    distDir: "out",
  }),
  experimental: {
    cssChunking: true,
  },
  images: {
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
