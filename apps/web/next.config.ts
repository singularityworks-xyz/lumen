import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  typedRoutes: true,
  experimental: {
    cssChunking: true,
  },
  transpilePackages: [
    "@lumen/logger",
    "lib0",
    "y-protocols",
    "yjs",
    "y-indexeddb",
  ],
};

export default withBotId(nextConfig);
