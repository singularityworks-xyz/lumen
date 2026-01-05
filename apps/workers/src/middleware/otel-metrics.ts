import {
  incrementErrorCount,
  incrementRequestCount,
  recordRequestDuration,
} from "@lumen/logger/server";
import type Elysia from "elysia";

export const otelMetrics = (app: Elysia) => {
  return app
    .derive(() => ({
      _startTime: performance.now(),
    }))
    .onAfterResponse(({ request, set, _startTime }) => {
      const duration = (performance.now() - _startTime) / 1000;
      const method = request.method;
      const status = set.status ? String(set.status) : "200";
      // Normalize path to avoid high cardinality (e.g. replace IDs)
      // Elysia's `path` in context is the matched path pattern, which is what we want!
      // Wait, onAfterResponse context might not have route pattern if 404.
      // let route = ...
      // For now, simplicity:
      const url = new URL(request.url);
      // This might be high cardinality if IDs involved. Ideally use matched route.
      const route = url.pathname;

      const attributes = {
        method,
        route,
        status,
        service_name: "lumen-workers",
      };

      incrementRequestCount(attributes);
      recordRequestDuration(duration, attributes);

      if (status.startsWith("5") || status.startsWith("4")) {
        incrementErrorCount(attributes);
      }
    });
};
