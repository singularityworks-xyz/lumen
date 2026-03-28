import { check, sleep } from "k6";
import http from "k6/http";
import { Counter, Gauge, Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const latencyTrend = new Trend("latency");
const requestCounter = new Counter("requests");
const concurrentConnections = new Gauge("concurrent_connections");

export const options = {
  scenarios: {
    spike_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 10 },
        { duration: "10s", target: 500 },
        { duration: "30s", target: 500 },
        { duration: "10s", target: 10 },
        { duration: "10s", target: 0 },
      ],
      tags: { test_type: "spike" },
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
    errors: ["rate<0.10"],
    http_req_failed: ["rate<0.10"],
  },
};

// biome-ignore lint/correctness/noUndeclaredVariables: k6 injects __ENV
const BASE_URL = __ENV.PRESENCE_URL || "http://localhost:4001";

export default function () {
  concurrentConnections.add(1);

  const response = http.get(`${BASE_URL}/health`);

  requestCounter.add(1);
  latencyTrend.add(response.timings.duration);

  const success = check(response, {
    "status is 200": (r) => r.status === 200,
    "response time acceptable": (r) => r.timings.duration < 5000,
  });

  errorRate.add(!success);

  concurrentConnections.add(-1);

  sleep(0.1);
}
