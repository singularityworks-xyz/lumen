import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const LOAD_DIR = join(import.meta.dir);

function readSource(path: string): string {
  return readFileSync(join(LOAD_DIR, path), "utf-8");
}

// ─── AI Classifier Load Test Config ────────────────────────────

describe("ai-classifier-load config", () => {
  const src = readSource("ai-classifier-load.ts");

  it("defines ramp_test scenario", () => {
    expect(src).toContain("ramp_test:");
    expect(src).toContain('executor: "ramping-vus"');
  });

  it("defines spike_test scenario", () => {
    expect(src).toContain("spike_test:");
    expect(src).toContain("startTime: ");
  });

  it("has 5 ramp stages in ramp_test", () => {
    // ramp_test has 5 stages, spike_test has 4 stages = 9 total
    const durationMatches = src.match(/{ duration:/g);
    expect(durationMatches?.length).toBe(9);
  });

  it("defines custom metrics", () => {
    expect(src).toContain('new Rate("classify_success_rate")');
    expect(src).toContain('new Trend("classify_duration_ms")');
    expect(src).toContain('new Gauge("classifier_queue_length")');
    expect(src).toContain('new Counter("classify_errors")');
  });

  it("defines success rate threshold above 95%", () => {
    expect(src).toContain("rate>0.95");
  });

  it("sends POST to /api/ai/chat", () => {
    expect(src).toContain("/api/ai/chat");
    expect(src).toContain("http.post(");
  });

  it("includes workspace context in payload", () => {
    expect(src).toContain("workspaceId:");
    expect(src).toContain("currentBoardId:");
    expect(src).toContain("selectedBoardIds:");
    expect(src).toContain("viewportCenter:");
  });

  it("defines 10 test messages", () => {
    const msgMatch = src.match(/MESSAGES = \[([\s\S]*?)\]/);
    expect(msgMatch).toBeTruthy();
    const messages = msgMatch![1].match(/"/g);
    // 10 messages = 20 quotes (opening + closing)
    expect(messages?.length).toBe(20);
  });

  it("exports handleSummary function", () => {
    expect(src).toContain("export function handleSummary");
    expect(src).toContain("classify_duration_ms");
  });

  it("includes sleep between iterations", () => {
    expect(src).toContain("sleep(");
  });
});

// ─── AI Classifier Stress Test Config ──────────────────────────

describe("ai-classifier-stress config", () => {
  const src = readSource("ai-classifier-stress.ts");

  it("targets 200 VUs", () => {
    expect(src).toContain("target: 200");
  });

  it("has 3 stages", () => {
    const stages = src.match(/{ duration:/g);
    expect(stages?.length).toBe(3);
  });

  it("defines lenient stress thresholds", () => {
    expect(src).toContain("rate>0.80");
    expect(src).toContain("p(99)<15000");
    expect(src).toContain("rate<0.20");
  });

  it("uses shorter sleep", () => {
    expect(src).toContain("sleep(0.1)");
  });
});

// ─── WS Collab Ramp Config ─────────────────────────────────────

describe("ws-collab-ramp config", () => {
  const src = readSource("ws-collab-ramp.ts");

  it("defines ramp_up scenario", () => {
    expect(src).toContain("ramp_up:");
  });

  it("has 5 ramp stages", () => {
    const stages = src.match(/{ duration:/g);
    expect(stages?.length).toBe(5);
  });

  it("targets up to 100 VUs", () => {
    expect(src).toContain("target: 100");
  });

  it("requires 99% WS success rate", () => {
    expect(src).toContain("ws_connect_success: [\"rate>0.99\"]");
  });

  it("imports connectCollabSession", () => {
    expect(src).toContain('from "./lib/collab-session"');
  });

  it("sends 10 sync updates per session", () => {
    expect(src).toContain("i < 10");
  });

  it("uses workspace ID from VU ID", () => {
    expect(src).toContain("ws-ramp-");
    expect(src).toContain("__VU");
  });
});

// ─── WS Collab Spike Config ────────────────────────────────────

describe("ws-collab-spike config", () => {
  const src = readSource("ws-collab-spike.ts");

  it("defines spike scenario", () => {
    expect(src).toContain("spike:");
  });

  it("has 3 stages", () => {
    const stages = src.match(/{ duration:/g);
    expect(stages?.length).toBe(3);
  });

  it("targets 100 VUs", () => {
    expect(src).toContain("target: 100");
  });

  it("sends 5 sync updates per session", () => {
    expect(src).toContain("i < 5");
  });

  it("includes origin marker", () => {
    expect(src).toContain('"spike-test"');
  });
});

// ─── WS Collab Soak Config ─────────────────────────────────────

describe("ws-collab-soak config", () => {
  const src = readSource("ws-collab-soak.ts");

  it("uses constant-vus executor", () => {
    expect(src).toContain('executor: "constant-vus"');
  });

  it("runs 20 concurrent VUs", () => {
    expect(src).toContain("vus: 20");
  });

  it("has configurable soak duration", () => {
    expect(src).toContain("SOAK_DURATION_MINUTES");
    expect(src).toContain("soakDuration");
  });

  it("defines active connections gauge", () => {
    expect(src).toContain('new Gauge("soak_active_connections")');
  });

  it("includes awareness updates every 3rd iteration", () => {
    expect(src).toContain("updateCounter % 3 === 0");
    expect(src).toContain("sendAwarenessUpdate");
  });

  it("has 5 second sleep between iterations", () => {
    expect(src).toContain("sleep(5)");
  });

  it("tracks session duration", () => {
    expect(src).toContain("sessionDuration");
    expect(src).toContain("soak_session_duration_ms");
  });
});

// ─── collab-session.ts Source ───────────────────────────────────

describe("collab-session source", () => {
  const src = readSource("lib/collab-session.ts");

  it("defines custom metrics", () => {
    expect(src).toContain('new Rate("ws_connect_success")');
    expect(src).toContain('new Trend("ws_connect_duration")');
    expect(src).toContain('new Counter("ws_disconnect_count")');
    expect(src).toContain('new Counter("ws_message_failures")');
  });

  it("exports connectCollabSession function", () => {
    expect(src).toContain("export function connectCollabSession");
  });

  it("builds URL with workspace and token", () => {
    expect(src).toContain("/ws/collab/");
    expect(src).toContain("?token=");
  });

  it("checks for 101 status code", () => {
    expect(src).toContain("status !== 101");
  });

  it("sends init message on connect", () => {
    expect(src).toContain('type: "sync"');
    expect(src).toContain('action: "init"');
  });

  it("sets up ping interval at 30 seconds", () => {
    expect(src).toContain("setInterval");
    expect(src).toContain("30000");
  });

  it("handles close and error events", () => {
    expect(src).toContain('socket.on("close"');
    expect(src).toContain('socket.on("error"');
  });

  it("sendSyncUpdate returns boolean", () => {
    expect(src).toContain("return true");
    expect(src).toContain("return false");
  });

  it("disconnect sends disconnect message", () => {
    expect(src).toContain('type: "disconnect"');
    expect(src).toContain("socket.close()");
  });

  it("wraps send in try-catch for error handling", () => {
    const tryCount = (src.match(/try \{/g) || []).length;
    expect(tryCount).toBeGreaterThanOrEqual(2);
  });
});

// ─── Fixtures Structure ────────────────────────────────────────

describe("collab-payloads fixture", () => {
  const payloads = JSON.parse(
    readFileSync(join(LOAD_DIR, "fixtures/collab-payloads.json"), "utf-8")
  );

  it("has small, medium, and large sizes", () => {
    expect(payloads.small).toBeDefined();
    expect(payloads.medium).toBeDefined();
    expect(payloads.large).toBeDefined();
  });

  it("each size has label and description", () => {
    for (const size of ["small", "medium", "large"]) {
      expect(payloads[size].label).toBe(size);
      expect(typeof payloads[size].description).toBe("string");
    }
  });

  it("each size has syncStep1 as string", () => {
    for (const size of ["small", "medium", "large"]) {
      expect(typeof payloads[size].syncStep1).toBe("string");
    }
  });

  it("each size has syncStep2 with fromDoc and fromRemote", () => {
    for (const size of ["small", "medium", "large"]) {
      expect(payloads[size].syncStep2.fromDoc).toBeDefined();
      expect(payloads[size].syncStep2.fromRemote).toBeDefined();
    }
  });

  it("small has fewer sync updates than medium which has fewer than large", () => {
    const smallCount = Object.keys(payloads.small.syncUpdates).length;
    const medCount = Object.keys(payloads.medium.syncUpdates).length;
    const largeCount = Object.keys(payloads.large.syncUpdates).length;
    expect(smallCount).toBeLessThan(medCount);
    expect(medCount).toBeLessThan(largeCount);
  });

  it("awareness updates have at least 2 clients", () => {
    for (const size of ["small", "medium", "large"]) {
      const keys = Object.keys(payloads[size].awarenessUpdates);
      expect(keys.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ─── tsconfig ──────────────────────────────────────────────────

describe("tsconfig", () => {
  const config = JSON.parse(
    readFileSync(join(LOAD_DIR, "tsconfig.json"), "utf-8")
  );

  it("targets ES2020", () => {
    expect(config.compilerOptions.target).toBe("ES2020");
  });

  it("uses bundler module resolution", () => {
    expect(config.compilerOptions.moduleResolution).toBe("bundler");
  });

  it("is in strict mode", () => {
    expect(config.compilerOptions.strict).toBe(true);
  });

  it("includes all TS files", () => {
    expect(config.include).toContain("./**/*.ts");
    expect(config.include).toContain("./types.d.ts");
  });
});
