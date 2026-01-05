import {
  type Span,
  type SpanOptions,
  SpanStatusCode,
  type Tracer,
  trace,
} from "@opentelemetry/api";

const DEFAULT_TRACER_NAME = "lumen";

export function getTracer(name: string = DEFAULT_TRACER_NAME): Tracer {
  return trace.getTracer(name);
}

export function getActiveSpan(): Span | undefined {
  return trace.getActiveSpan();
}

export function withSpan<T>(
  name: string,
  fn: (span: Span) => T,
  options?: SpanOptions
): T {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, options ?? {}, (span) => {
    try {
      const result = fn(span);
      span.end();
      return result;
    } catch (error) {
      recordSpanError(span, error);
      span.end();
      throw error;
    }
  });
}

export function withSpanAsync<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: SpanOptions
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, options ?? {}, async (span) => {
    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (error) {
      recordSpanError(span, error);
      span.end();
      throw error;
    }
  });
}

export function setSpanAttributes(
  attributes: Record<string, string | number | boolean>
): void {
  const span = getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const span = getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

export function recordSpanError(span: Span, error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error));
  span.recordException(err);
  span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
}

export function recordError(
  error: unknown,
  attributes?: Record<string, string | number | boolean>
): void {
  const span = getActiveSpan();
  if (!span) {
    return;
  }

  const err = error instanceof Error ? error : new Error(String(error));
  span.recordException(err);
  span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });

  if (attributes) {
    span.setAttributes(attributes);
  }
}

export function getTraceContext(): { traceId: string; spanId: string } | null {
  const span = getActiveSpan();
  if (!span) {
    return null;
  }

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}
