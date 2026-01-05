import {
  incrementErrorCount,
  incrementRequestCount,
  recordRequestDuration,
} from "@lumen/logger/server";
import type Elysia from "elysia";

// Normalize path by replacing dynamic segments with placeholders
// This prevents high cardinality from IDs, UUIDs, and tokens
function normalizePath(pathname: string): string {
  return (
    pathname
      // Replace UUIDs (8-4-4-4-12 format)
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ":id"
      )
      // Replace numeric IDs (pure numbers of 4+ digits)
      .replace(/\/\d{4,}\b/g, "/:id")
      // Replace alphanumeric tokens/IDs (16+ chars that look like tokens)
      .replace(/\/[a-zA-Z0-9]{16,}\b/g, "/:token")
      // Replace short alphanumeric IDs (e.g., workspace IDs like "abc123XYZ")
      .replace(/\/[a-zA-Z0-9]{8,15}\b/g, "/:id")
  );
}

export const otelMetrics = (app: Elysia) => {
  return app
    .derive(() => ({
      _startTime: performance.now(),
    }))
    .onAfterResponse(({ request, set, _startTime }) => {
      const duration = (performance.now() - _startTime) / 1000;
      const method = request.method;

      // Handle status properly - only default to 200 if status is truly unset
      // set.status can be a number or string, and 0 is a valid falsy value we should preserve
      let status: string;
      if (set.status === undefined || set.status === null) {
        status = "200";
      } else {
        status = String(set.status);
      }

      const url = new URL(request.url);
      // Normalize path to avoid high cardinality from dynamic segments
      const route = normalizePath(url.pathname);

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
