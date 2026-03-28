import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const classifySuccess = new Rate("classify_success_rate");
const classifyDuration = new Trend("classify_duration_ms");
const errorCount = new Counter("classify_errors");

const BASE_URL = __ENV.AI_BASE_URL || "http://localhost:3001";
const WORKSPACE_ID = __ENV.WORKSPACE_ID || "test-workspace";

export const options = {
  stages: [
    { duration: "10s", target: 200 },
    { duration: "30s", target: 200 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    classify_success_rate: ["rate>0.80"],
    classify_duration_ms: ["p(99)<15000"],
    http_req_failed: ["rate<0.20"],
  },
};

const MESSAGES = [
  "show me all tasks",
  "create a new task",
  "find blocked items",
  "delete the completed tasks",
  "search for login bug",
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

  const res = http.post(
    `${BASE_URL}/api/ai/chat`,
    payload,
    {
      headers: { "Content-Type": "application/json" },
      timeout: "30s",
    }
  );

  const success = check(res, {
    "status is not 500": (r) => r.status !== 500,
    "response received": (r) => r.status > 0,
  });

  classifySuccess.add(success);
  classifyDuration.add(res.timings.duration);

  if (res.status >= 500) {
    errorCount.add(1);
  }

  sleep(0.1);
}
