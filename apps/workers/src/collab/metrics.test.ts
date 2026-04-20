import { afterAll, describe, expect, it, mock } from "bun:test";

mock.module("@lumen/logger/server", () => ({
  getMeter: () => ({
    createHistogram: () => ({
      record: mock(),
    }),
    createObservableGauge: () => ({
      addCallback: mock(),
    }),
    createCounter: () => ({
      add: mock(),
    }),
  }),
  recordSpanError: mock(),
  setSpanAttributes: mock(),
  withSpanAsync: (_name: string, fn: (span: unknown) => Promise<unknown>) =>
    fn(null),
  withSpan: (_name: string, fn: (span: unknown) => unknown) => fn(null),
}));

import {
  decrementActiveConnections,
  getActiveConnections,
  incrementActiveConnections,
  recordWsConnectionError,
  recordWsConnectionLatency,
  recordWsMessage,
  recordWsRoomJoinDuration,
} from "./metrics";

describe("metrics", () => {
  describe("activeConnectionsManager", () => {
    it("starts at zero", () => {
      expect(getActiveConnections()).toBe(0);
    });

    it("increments active connections", () => {
      const before = getActiveConnections();
      incrementActiveConnections();
      expect(getActiveConnections()).toBe(before + 1);
    });

    it("decrements active connections", () => {
      incrementActiveConnections();
      const before = getActiveConnections();
      decrementActiveConnections();
      expect(getActiveConnections()).toBe(before - 1);
    });

    it("does not decrement below zero", () => {
      // Set to known state
      while (getActiveConnections() > 0) {
        decrementActiveConnections();
      }
      decrementActiveConnections();
      expect(getActiveConnections()).toBe(0);
    });

    it("handles multiple increments and decrements", () => {
      // Reset to zero
      while (getActiveConnections() > 0) {
        decrementActiveConnections();
      }

      incrementActiveConnections();
      incrementActiveConnections();
      incrementActiveConnections();
      expect(getActiveConnections()).toBe(3);

      decrementActiveConnections();
      expect(getActiveConnections()).toBe(2);
    });
  });

  describe("recordWsConnectionLatency", () => {
    it("records latency without error", () => {
      expect(() => recordWsConnectionLatency(0.5)).not.toThrow();
    });

    it("records latency with attributes", () => {
      expect(() =>
        recordWsConnectionLatency(1.2, { region: "us-east" })
      ).not.toThrow();
    });
  });

  describe("recordWsRoomJoinDuration", () => {
    it("records duration without error", () => {
      expect(() => recordWsRoomJoinDuration(0.3)).not.toThrow();
    });

    it("records duration with attributes", () => {
      expect(() =>
        recordWsRoomJoinDuration(0.8, { workspaceId: "ws-1" })
      ).not.toThrow();
    });
  });

  describe("recordWsMessage", () => {
    it("records message without error", () => {
      expect(() => recordWsMessage()).not.toThrow();
    });

    it("records message with attributes", () => {
      expect(() =>
        recordWsMessage({ type: "sync", direction: "inbound" })
      ).not.toThrow();
    });
  });

  describe("recordWsConnectionError", () => {
    it("records error without error", () => {
      expect(() => recordWsConnectionError()).not.toThrow();
    });

    it("records error with attributes", () => {
      expect(() =>
        recordWsConnectionError({ code: "1006", reason: "abnormal" })
      ).not.toThrow();
    });
  });
});

afterAll(() => {
  mock.restore();
});
