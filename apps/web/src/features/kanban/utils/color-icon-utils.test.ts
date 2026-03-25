import { describe, expect, it } from "bun:test";
import {
  ACCENT_COLORS,
  COLUMN_ICONS,
  getAccentColor,
  getIconComponent,
  ICON_MAP,
  isValidHexColor,
} from "./color-icon-utils";

describe("color-icon-utils", () => {
  describe("isValidHexColor", () => {
    it("rejects empty string", () => {
      expect(isValidHexColor("")).toBe(false);
    });

    it("rejects hex without hash", () => {
      expect(isValidHexColor("ffffff")).toBe(false);
    });

    it("rejects invalid characters", () => {
      expect(isValidHexColor("#gggggg")).toBe(false);
    });

    it("rejects too few characters", () => {
      expect(isValidHexColor("#fff")).toBe(true);
      expect(isValidHexColor("#ff")).toBe(false);
    });

    it("rejects too many characters", () => {
      expect(isValidHexColor("#fffffff")).toBe(false);
    });

    it("accepts valid 6-digit hex", () => {
      expect(isValidHexColor("#ffffff")).toBe(true);
      expect(isValidHexColor("#000000")).toBe(true);
      expect(isValidHexColor("#3b82f6")).toBe(true);
    });

    it("accepts valid 3-digit hex", () => {
      expect(isValidHexColor("#fff")).toBe(true);
      expect(isValidHexColor("#000")).toBe(true);
      expect(isValidHexColor("#abc")).toBe(true);
    });

    it("rejects lowercase hex outside range", () => {
      expect(isValidHexColor("#00")).toBe(false);
    });

    it("accepts mixed case hex", () => {
      expect(isValidHexColor("#AbCdEf")).toBe(true);
    });
  });

  describe("color palette outputs", () => {
    it("all accent colors are valid hex or empty", () => {
      for (const color of ACCENT_COLORS) {
        if (color.value) {
          expect(isValidHexColor(color.value)).toBe(true);
        }
      }
    });

    it("getAccentColor returns correct color", () => {
      expect(getAccentColor("#3b82f6")?.name).toBe("Blue");
      expect(getAccentColor("")).toBeUndefined();
      expect(getAccentColor("#invalid")).toBeUndefined();
    });

    it("all icon values are supported in ICON_MAP", () => {
      for (const icon of COLUMN_ICONS) {
        if (icon.value) {
          expect(ICON_MAP[icon.value]).toBeDefined();
        }
      }
    });

    it("getIconComponent returns correct icon", () => {
      const icon = getIconComponent("star");
      expect(icon).not.toBeNull();
      expect(getIconComponent("")).toBeNull();
      expect(getIconComponent("nonexistent")).toBeNull();
    });
  });

  describe("palette structure", () => {
    it("has at least 10 colors in palette", () => {
      expect(ACCENT_COLORS.length).toBeGreaterThanOrEqual(10);
    });

    it("has at least 30 icons in palette", () => {
      expect(COLUMN_ICONS.length).toBeGreaterThanOrEqual(30);
    });

    it("first color is None/empty", () => {
      expect(ACCENT_COLORS[0]!.value).toBe("");
      expect(ACCENT_COLORS[0]!.name).toBe("None");
    });

    it("first icon is None/empty", () => {
      expect(COLUMN_ICONS[0]!.value).toBe("");
      expect(COLUMN_ICONS[0]!.name).toBe("None");
    });
  });
});
