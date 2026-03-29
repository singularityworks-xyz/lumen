import { check, sleep } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const latencyTrend = new Trend("latency");
const requestCounter = new Counter("requests");

export const options = {
  scenarios: {
    stress_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 100 },
        { duration: "1m", target: 200 },
        { duration: "30s", target: 300 },
        { duration: "1m", target: 500 },
        { duration: "30s", target: 100 },
        { duration: "10s", target: 0 },
      ],
      tags: { test_type: "stress" },
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<1000", "p(99)<2000"],
    errors: ["rate<0.05"],
    http_req_failed: ["rate<0.05"],
  },
};

// biome-ignore lint/correctness/noUndeclaredVariables: k6 injects __ENV
const BASE_URL = __ENV.PRESENCE_URL || "http://localhost:4001";

export default function () {
  const response = http.get(`${BASE_URL}/health`);

  requestCounter.add(1);
  latencyTrend.add(response.timings.duration);

  const success = check(response, {
    "status is 200": (r) => r.status === 200,
    "response time < 1000ms": (r) => r.timings.duration < 1000,
    "has valid JSON": (r) => {
      try {
        r.json();
        return true;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);

  sleep(0.5);
}
