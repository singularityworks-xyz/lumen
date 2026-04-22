import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const NATIVE_DIR = import.meta.dir;

const configPath = join(NATIVE_DIR, "tauri.conf.json");
const config = JSON.parse(readFileSync(configPath, "utf-8"));

function _readSource(path: string): string {
  return readFileSync(join(NATIVE_DIR, path), "utf-8");
}

describe("Native App Smoke Tests", () => {
  describe("Tauri Configuration", () => {
    it("has valid tauri.conf.json", () => {
      expect(config.productName).toBe("lumen-singularityworks");
      expect(config.identifier).toBe("com.itssingularity.lumen");
      expect(config.version).toBeDefined();
    });

    it("configures deep-link plugin for single-instance forwarding", () => {
      expect(config.plugins).toBeDefined();
      expect(config.plugins["deep-link"]).toBeDefined();
      expect(config.plugins["deep-link"].desktop).toBeDefined();
      expect(config.plugins["deep-link"].desktop.schemes).toContain("lumen");
    });

    it("configures main window with correct settings", () => {
      expect(config.app.windows).toBeDefined();
      expect(config.app.windows.length).toBeGreaterThan(0);

      const mainWindow = config.app.windows[0];
      expect(mainWindow.title).toBe("Lumen by Singularity Works");
      expect(mainWindow.width).toBe(1280);
      expect(mainWindow.height).toBe(800);
      expect(mainWindow.resizable).toBe(true);
    });

    it("has bundle configuration for release builds", () => {
      expect(config.bundle).toBeDefined();
      expect(config.bundle.active).toBe(true);
      expect(config.bundle.targets).toBe("all");
      expect(config.bundle.icon).toBeDefined();
      expect(config.bundle.icon.length).toBeGreaterThan(0);
    });

    it("has security CSP configuration", () => {
      expect(config.app.security).toBeDefined();
      expect(config.app.security.csp).toContain("default-src 'self'");
    });
  });

  describe("Cargo Configuration", () => {
    it("has valid Cargo.toml", () => {
      const cargoPath = join(NATIVE_DIR, "Cargo.toml");
      const cargo = readFileSync(cargoPath, "utf-8");

      expect(cargo).toContain("[package]");
      expect(cargo).toContain("name");
      expect(cargo).toContain("version");
    });
  });

  describe("Rust Source", () => {
    it("has main.rs with lib entry", () => {
      const srcPath = join(NATIVE_DIR, "src", "main.rs");
      const src = readFileSync(srcPath, "utf-8");

      expect(src).toContain("fn main");
    });

    it("has build.rs for compilation", () => {
      const buildPath = join(NATIVE_DIR, "build.rs");
      const build = readFileSync(buildPath, "utf-8");

      expect(build).toBeDefined();
    });
  });

  describe("Build Artifacts", () => {
    it("has icons directory", () => {
      const iconsPath = join(NATIVE_DIR, "icons");
      expect(existsSync(join(iconsPath, "32x32.png"))).toBe(true);
    });

    it("has capabilities directory for permissions", () => {
      const capsPath = join(NATIVE_DIR, "capabilities");
      const { existsSync, readdirSync } = require("node:fs");
      expect(existsSync(capsPath)).toBe(true);
      expect(readdirSync(capsPath)).toBeDefined();
    });
  });

  describe("Release Build", () => {
    it("package.json has tauri script for building", () => {
      const pkgPath = join(import.meta.dir, "..", "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts.tauri).toBeDefined();
    });
  });
});
