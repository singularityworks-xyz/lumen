import { getMeter } from "@lumen/logger/server";

const meter = getMeter("lumen-workers");

// WebSocket connection latency histogram
const wsConnectionLatency = meter.createHistogram(
  "ws_connection_latency_seconds",
  {
    description: "WebSocket connection establishment latency in seconds",
    unit: "s",
  }
);

// Room join duration histogram
const wsRoomJoinDuration = meter.createHistogram(
  "ws_room_join_duration_seconds",
  {
    description: "Time taken to join a room and sync initial state in seconds",
    unit: "s",
  }
);

// Active connections gauge
let activeConnections = 0;
const wsActiveConnections = meter.createObservableGauge(
  "ws_active_connections",
  {
    description: "Number of currently active WebSocket connections",
  }
);

wsActiveConnections.addCallback((result) => {
  result.observe(activeConnections);
});

// Message throughput counter
const wsMessagesTotal = meter.createCounter("ws_messages_total", {
  description: "Total number of WebSocket messages processed by type",
});

// Connection error counter
const wsConnectionErrors = meter.createCounter("ws_connection_errors_total", {
  description: "Total number of WebSocket connection errors",
});

export function recordWsConnectionLatency(
  latencySeconds: number,
  attributes?: Record<string, string>
): void {
  wsConnectionLatency.record(latencySeconds, attributes);
}

export function recordWsRoomJoinDuration(
  durationSeconds: number,
  attributes?: Record<string, string>
): void {
  wsRoomJoinDuration.record(durationSeconds, attributes);
}

export function incrementActiveConnections(): void {
  activeConnections += 1;
}

export function decrementActiveConnections(): void {
  activeConnections = Math.max(0, activeConnections - 1);
}

export function recordWsMessage(attributes?: Record<string, string>): void {
  wsMessagesTotal.add(1, attributes);
}

export function recordWsConnectionError(
  attributes?: Record<string, string>
): void {
  wsConnectionErrors.add(1, attributes);
}

export function getActiveConnections(): number {
  return activeConnections;
}
