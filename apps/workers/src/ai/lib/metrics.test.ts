import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const mockCounterAdd = mock();
const mockHistogramRecord = mock();

// Create a single shared mock meter instance so module-level counter/histogram
// variables in metrics.ts reference the same mocks across all calls.
const mockMeter = {
  createCounter: mock(() => ({ add: mockCounterAdd })),
  createHistogram: mock(() => ({ record: mockHistogramRecord })),
};

mock.module("@lumen/logger/server", () => ({
  getMeter: mock(() => mockMeter),
}));

import {
  recordAiError,
  recordAiRequest,
  recordModelFallback,
  recordRateLimitHit,
  recordStreamDuration,
  recordTokenUsage,
} from "./metrics";

beforeEach(() => {
  mockCounterAdd.mockClear();
  mockHistogramRecord.mockClear();
  mockMeter.createCounter.mockClear();
  mockMeter.createHistogram.mockClear();
});

describe("metrics", () => {
  describe("recordAiRequest", () => {
    it("records request with success status", () => {
      recordAiRequest({
        model: "gpt-4",
        workspaceId: "ws_1",
        status: "success",
      });

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        model: "gpt-4",
        workspace_id: "ws_1",
        status: "success",
      });
    });

    it("records request with error status", () => {
      recordAiRequest({
        model: "gpt-4",
        workspaceId: "ws_2",
        status: "error",
      });

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        model: "gpt-4",
        workspace_id: "ws_2",
        status: "error",
      });
    });

    it("records request with rate_limited status", () => {
      recordAiRequest({
        model: "gpt-4o-mini",
        workspaceId: "ws_3",
        status: "rate_limited",
      });

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        model: "gpt-4o-mini",
        workspace_id: "ws_3",
        status: "rate_limited",
      });
    });
  });

  describe("recordTokenUsage", () => {
    it("records input token usage", () => {
      recordTokenUsage({
        model: "gpt-4",
        type: "input",
        count: 150,
      });

      expect(mockCounterAdd).toHaveBeenCalledWith(150, {
        model: "gpt-4",
        token_type: "input",
      });
    });

    it("records output token usage", () => {
      recordTokenUsage({
        model: "gpt-4",
        type: "output",
        count: 75,
      });

      expect(mockCounterAdd).toHaveBeenCalledWith(75, {
        model: "gpt-4",
        token_type: "output",
      });
    });

    it("records cached token usage", () => {
      recordTokenUsage({
        model: "gpt-4",
        type: "cached",
        count: 200,
      });

      expect(mockCounterAdd).toHaveBeenCalledWith(200, {
        model: "gpt-4",
        token_type: "cached",
      });
    });
  });

  describe("recordStreamDuration", () => {
    it("records successful stream duration", () => {
      recordStreamDuration(2.5, { model: "gpt-4", success: true });

      expect(mockHistogramRecord).toHaveBeenCalledWith(2.5, {
        model: "gpt-4",
        success: "true",
      });
    });

    it("records failed stream duration", () => {
      recordStreamDuration(0.8, { model: "gpt-4", success: false });

      expect(mockHistogramRecord).toHaveBeenCalledWith(0.8, {
        model: "gpt-4",
        success: "false",
      });
    });
  });

  describe("recordModelFallback", () => {
    it("records fallback with rate_limit reason", () => {
      recordModelFallback({
        fromModel: "gpt-4",
        toModel: "gpt-4o-mini",
        reason: "rate_limit",
      });

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        from_model: "gpt-4",
        to_model: "gpt-4o-mini",
        reason: "rate_limit",
      });
    });

    it("records fallback with error reason", () => {
      recordModelFallback({
        fromModel: "gpt-4",
        toModel: "claude-3",
        reason: "error",
      });

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        from_model: "gpt-4",
        to_model: "claude-3",
        reason: "error",
      });
    });
  });

  describe("recordRateLimitHit", () => {
    it("records rate limit hit", () => {
      recordRateLimitHit({ model: "gpt-4" });

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        model: "gpt-4",
      });
    });

    it("records rate limit hit with retryAfterSeconds", () => {
      recordRateLimitHit({ model: "gpt-4", retryAfterSeconds: 30 });

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        model: "gpt-4",
      });
    });
  });

  describe("recordAiError", () => {
    it("records rate_limit error", () => {
      recordAiError({ model: "gpt-4", errorType: "rate_limit" });

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        model: "gpt-4",
        error_type: "rate_limit",
      });
    });

    it("records api_error", () => {
      recordAiError({ model: "gpt-4", errorType: "api_error" });

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        model: "gpt-4",
        error_type: "api_error",
      });
    });

    it("records timeout error", () => {
      recordAiError({ model: "gpt-4", errorType: "timeout" });

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        model: "gpt-4",
        error_type: "timeout",
      });
    });

    it("records unknown error", () => {
      recordAiError({ model: "gpt-4", errorType: "unknown" });

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        model: "gpt-4",
        error_type: "unknown",
      });
    });
  });

  describe("ensureAiMetrics (initialization)", () => {
    it("initializes meters only once across multiple calls", () => {
      mockMeter.createCounter.mockClear();

      recordAiRequest({ model: "m", workspaceId: "w", status: "success" });
      recordAiRequest({ model: "m", workspaceId: "w", status: "success" });
      recordAiRequest({ model: "m", workspaceId: "w", status: "success" });

      // getMeter should only be called once since ensureAiMetrics caches the meter
      const { getMeter } = require("@lumen/logger/server");
      expect((getMeter as ReturnType<typeof mock>).mock.calls.length).toBe(1);
    });
  });
});

afterAll(() => {
  mock.restore();
});
