import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  typedRoutes: true,
  experimental: {
    cssChunking: true,
  },
  transpilePackages: ["@lumen/logger"],
  serverExternalPackages: ["pino", "pino-pretty"],
};

export default nextConfig;
