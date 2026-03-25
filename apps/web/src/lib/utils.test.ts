import { describe, expect, it } from "bun:test";
import { cn } from "./utils";

describe("cn", () => {
  it("merges multiple class strings", () => {
    const result = cn("px-4", "py-2", "bg-red-500");
    expect(result).toContain("px-4");
    expect(result).toContain("py-2");
    expect(result).toContain("bg-red-500");
  });

  it("deduplicates conflicting Tailwind classes with later winning", () => {
    const result = cn("bg-red-500", "bg-blue-500");
    expect(result).toBe("bg-blue-500");
  });

  it("preserves non-conflicting Tailwind classes", () => {
    const result = cn("text-sm", "bg-red-500", "p-4");
    expect(result).toContain("text-sm");
    expect(result).toContain("bg-red-500");
    expect(result).toContain("p-4");
  });

  it("handles conditional classes with boolean values", () => {
    const result = cn("base", false, "active");
    expect(result).toContain("base");
    expect(result).toContain("active");
    expect(result).not.toContain("hidden");
  });

  it("handles undefined and null values", () => {
    const result = cn("base", undefined, null, "extra");
    expect(result).toContain("base");
    expect(result).toContain("extra");
  });

  it("deduplicates padding conflicts", () => {
    const result = cn("px-2", "px-4");
    expect(result).toBe("px-4");
  });

  it("deduplicates margin conflicts", () => {
    const result = cn("mt-2", "mt-4");
    expect(result).toBe("mt-4");
  });

  it("deduplicates width conflicts", () => {
    const result = cn("w-full", "w-1/2");
    expect(result).toBe("w-1/2");
  });

  it("handles empty input", () => {
    const result = cn();
    expect(result).toBe("");
  });

  it("handles array of classes", () => {
    const result = cn(["flex", "items-center"], "gap-2");
    expect(result).toContain("flex");
    expect(result).toContain("items-center");
    expect(result).toContain("gap-2");
  });

  it("handles mixed arrays and strings", () => {
    const result = cn("flex", ["items-center", "gap-2"], "p-4");
    expect(result).toContain("flex");
    expect(result).toContain("items-center");
    expect(result).toContain("gap-2");
    expect(result).toContain("p-4");
  });

  it("later conflicting class wins in precedence", () => {
    const result1 = cn("p-2", "p-4");
    const result2 = cn("p-4", "p-2");
    expect(result1).toBe("p-4");
    expect(result2).toBe("p-2");
  });

  it("deduplicates text color conflicts", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("deduplicates border radius conflicts", () => {
    const result = cn("rounded", "rounded-lg");
    expect(result).toBe("rounded-lg");
  });

  it("preserves arbitrary values alongside standard classes", () => {
    const result = cn("bg-[#123456]", "text-sm");
    expect(result).toContain("bg-[#123456]");
    expect(result).toContain("text-sm");
  });
});
