import { describe, expect, it } from "bun:test";
import {
  ACCENT_COLORS,
  COLUMN_ICONS,
  getAccentColor,
  getIconComponent,
  getTopColors,
  getTopIcons,
  ICON_MAP,
  incrementColorUsage,
  incrementIconUsage,
  isValidHexColor,
} from "./color-icon-utils";

describe("color-icon-utils", () => {
  describe("isValidHexColor", () => {
    it("rejects malformed hex values - no hash prefix", () => {
      expect(isValidHexColor("ffffff")).toBe(false);
      expect(isValidHexColor("f43f5e")).toBe(false);
    });

    it("rejects malformed hex values - wrong length", () => {
      expect(isValidHexColor("#ffff")).toBe(false);
      expect(isValidHexColor("#ffffffff")).toBe(false);
      expect(isValidHexColor("#fffffff")).toBe(false);
      expect(isValidHexColor("#ff")).toBe(false);
    });

    it("rejects malformed hex values - invalid characters", () => {
      expect(isValidHexColor("#gggggg")).toBe(false);
      expect(isValidHexColor("#00ff00gg")).toBe(false);
      expect(isValidHexColor("#xyzxyz")).toBe(false);
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

    it("accepts mixed case hex", () => {
      expect(isValidHexColor("#AbCdEf")).toBe(true);
      expect(isValidHexColor("#FFFFFF")).toBe(true);
    });

    it("rejects empty string and partial values", () => {
      expect(isValidHexColor("")).toBe(false);
      expect(isValidHexColor("#")).toBe(false);
      expect(isValidHexColor("#f")).toBe(false);
    });
  });

  describe("icon/color utility outputs stay within supported palette contracts", () => {
    it("all accent colors are valid hex or empty", () => {
      for (const color of ACCENT_COLORS) {
        if (color.value) {
          expect(isValidHexColor(color.value)).toBe(true);
        }
      }
    });

    it("all icon values are supported in ICON_MAP", () => {
      for (const icon of COLUMN_ICONS) {
        if (icon.value) {
          expect(ICON_MAP[icon.value]).toBeDefined();
        }
      }
    });

    it("getAccentColor returns correct color for valid values", () => {
      expect(getAccentColor("#3b82f6")?.name).toBe("Blue");
      expect(getAccentColor("#22c55e")?.name).toBe("Green");
      expect(getAccentColor("")).toBeUndefined();
      expect(getAccentColor("#invalid")).toBeUndefined();
    });

    it("getIconComponent returns correct icon for valid values", () => {
      const icon = getIconComponent("star");
      expect(icon).not.toBeNull();
      expect(getIconComponent("")).toBeNull();
      expect(getIconComponent("nonexistent")).toBeNull();
    });

    it("getTopColors returns within count limit", () => {
      const usage = { "#f43f5e": 5, "#3b82f6": 3, "#22c55e": 2 };
      const top = getTopColors(usage, 3);
      expect(top.length).toBeLessThanOrEqual(3);
    });

    it("getTopIcons returns deterministic results for same usage", () => {
      const usage = { star: 5, flag: 3 };
      const top1 = getTopIcons(usage, 5);
      const top2 = getTopIcons(usage, 5);
      expect(top1.map((i) => i.value)).toEqual(top2.map((i) => i.value));
    });

    it("incrementColorUsage returns valid usage record", () => {
      const result = incrementColorUsage({}, "#f43f5e");
      const key = "#f43f5e";
      expect(result[key]).toBe(1);
    });

    it("incrementIconUsage returns valid usage record", () => {
      const result = incrementIconUsage({}, "star");
      expect(result.star).toBe(1);
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
