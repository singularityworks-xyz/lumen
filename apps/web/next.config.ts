import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  typedRoutes: true,
  experimental: {
    cssChunking: true,
  },
  transpilePackages: ["@lumen/logger"],
};

export default withBotId(nextConfig);
