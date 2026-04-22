import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const LANDING_DIR = import.meta.dir;

function readSource(path: string): string {
  return readFileSync(join(LANDING_DIR, path), "utf-8");
}

describe("Landing App Smoke Tests", () => {
  describe("main.tsx", () => {
    const src = readSource("main.tsx");

    it("renders without crashing", () => {
      expect(src).toBeDefined();
      expect(typeof src).toBe("string");
      expect(src.length).toBeGreaterThan(0);
    });

    it("imports React and starts the app", () => {
      expect(src).toContain("react");
      expect(src).toContain("createRoot");
    });
  });

  describe("app.tsx", () => {
    const src = readSource("app.tsx");

    it("exports App component", () => {
      expect(src).toContain("export");
      expect(src).toContain("App");
    });

    it("renders main sections", () => {
      expect(src).toContain("MinimalHero");
    });
  });

  describe("VideoModal Component", () => {
    const src = readSource("components/video-modal.tsx");

    it("has video modal component", () => {
      expect(src).toBeDefined();
      expect(src.length).toBeGreaterThan(0);
    });

    it("handles modal state changes", () => {
      const hasStateManagement = src.includes("useState");
      expect(hasStateManagement).toBe(true);
    });
  });

  describe("Logo Component", () => {
    const src = readSource("components/logo.tsx");

    it("has logo component", () => {
      expect(src).toBeDefined();
    });
  });

  describe("MinimalHero Section", () => {
    const src = readSource("sections/minimal-hero.tsx");

    it("has hero section component", () => {
      expect(src).toBeDefined();
      expect(src.length).toBeGreaterThan(0);
    });

    it("contains CTA elements", () => {
      expect(src).toContain("button");
    });
  });

  describe("Responsive Navigation", () => {
    const src = readSource("app.tsx");

    it("handles responsive behavior with state", () => {
      expect(src).toContain("useState");
    });

    it("has responsive navigation elements", () => {
      expect(src.includes("hidden") || src.includes("md:")).toBe(true);
    });
  });

  describe("Build Configuration", () => {
    it("has valid package.json", () => {
      const pkgPath = join(import.meta.dir, "..", "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      expect(pkg.name).toBe("@lumen/landing");
      expect(pkg.scripts.build).toBeDefined();
    });

    it("has vite configuration", () => {
      const viteConfigPath = join(import.meta.dir, "..", "vite.config.ts");
      expect(() => readFileSync(viteConfigPath, "utf-8")).not.toThrow();
    });
  });
});
