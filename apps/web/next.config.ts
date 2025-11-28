import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@lumen/logger"],
  serverExternalPackages: ["pino", "pino-pretty"],
};

export default nextConfig;
