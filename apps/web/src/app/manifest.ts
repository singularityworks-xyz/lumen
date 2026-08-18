import type { MetadataRoute } from "next";

// Manifest routes are static by default; `dynamic = "force-static"` is
// incompatible with `nextConfig.cacheComponents` and breaks the build.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lumen — Work, illuminated",
    short_name: "Lumen",
    description: "Shedding light on the singularity",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/lumen.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    categories: ["productivity", "business"],
  };
}
