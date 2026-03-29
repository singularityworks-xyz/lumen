import { check, sleep } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const latencyTrend = new Trend("latency");
const requestCounter = new Counter("requests");

export const options = {
  scenarios: {
    soak_test: {
      executor: "constant-vus",
      vus: 50,
      duration: "10m",
      tags: { test_type: "soak" },
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    errors: ["rate<0.01"],
    http_req_failed: ["rate<0.01"],
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
    "has healthy status": (r) => {
      try {
        const body = r.json();
        return body.status === "healthy";
      } catch {
        return false;
      }
    },
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);

  sleep(1);
}
