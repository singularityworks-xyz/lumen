import { check, sleep } from "k6";
import http from "k6/http";
import { Counter, Gauge, Rate, Trend } from "k6/metrics";

// Custom metrics
const classifySuccess = new Rate("classify_success_rate");
const classifyDuration = new Trend("classify_duration_ms");
const _queueLength = new Gauge("classifier_queue_length");
const errorCount = new Counter("classify_errors");

// Configuration
const BASE_URL = __ENV.AI_BASE_URL || "http://localhost:3001";
const WORKSPACE_ID = __ENV.WORKSPACE_ID || "test-workspace";

export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up to test queue behavior
    ramp_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 30 },
        { duration: "30s", target: 50 },
        { duration: "1m", target: 50 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
    // Scenario 2: Spike test to test queue overflow
    spike_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 0 },
        { duration: "5s", target: 100 },
        { duration: "30s", target: 100 },
        { duration: "5s", target: 0 },
      ],
      gracefulRampDown: "5s",
      startTime: "3m",
    },
  },
  thresholds: {
    classify_success_rate: ["rate>0.95"],
    classify_duration_ms: ["p(95)<5000"],
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<10000"],
  },
};

const MESSAGES = [
  "show me all tasks",
  "create a new task for sprint",
  "find blocked items",
  "what is the workspace overview",
  "delete the completed tasks",
  "move this task to done",
  "list high priority items",
  "update the board name",
  "search for login bug",
  "how many tasks are in progress",
];

export default function () {
  const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  const payload = JSON.stringify({
    message,
    workspaceId: WORKSPACE_ID,
    context: {
      currentBoardId: null,
      selectedBoardIds: [],
      selectedTaskIds: [],
      viewportCenter: { x: 0, y: 0 },
      viewportZoom: 1,
    },
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 30_000,
  };

  const res = http.post(`${BASE_URL}/api/ai/chat`, payload, params);

  const success = check(res, {
    "status is 200": (r) => r.status === 200,
    "response has conversationId": (r) => {
      try {
        return JSON.parse(r.body as string).conversationId !== undefined;
      } catch {
        return false;
      }
    },
    "response time < 10s": (r) => r.timings.duration < 10_000,
  });

  classifySuccess.add(success);
  classifyDuration.add(res.timings.duration);

  if (res.status !== 200) {
    errorCount.add(1);
  }

  sleep(0.5 + Math.random() * 1.5);
}

export function handleSummary(data: {
  metrics: Record<string, { values?: { avg?: number } }>;
}) {
  const avgDuration = data.metrics.classify_duration_ms?.values?.avg || 0;
  console.log(`Average classification duration: ${avgDuration.toFixed(0)}ms`);
  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
