import { expect, test } from "@playwright/test";

test.describe("Error Responses", () => {
  test("returns 404 for unknown route", async ({ request }) => {
    const response = await request.get("/nonexistent-route-12345");

    expect(response.status()).toBe(404);
  });

  test("returns JSON error for 404", async ({ request }) => {
    const response = await request.get("/api/nonexistent");

    const body = await response.json();
    expect(body.errors).toBeDefined();
    expect(body.errors.detail).toBeDefined();
  });

  test("handles POST to nonexistent route", async ({ request }) => {
    const response = await request.post("/api/nonexistent", {
      data: { test: "data" },
    });

    expect(response.status()).toBe(404);
  });

  test("handles malformed JSON", async ({ request }) => {
    const response = await request.post("/api/test", {
      data: "not valid json {{{",
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("CORS and Headers", () => {
  test("returns appropriate headers", async ({ request }) => {
    const response = await request.get("/health");

    expect(response.headers()["content-type"]).toContain("application/json");
  });
});
