export function toHeaders(
  headers: Record<string, string | null | undefined>
): Headers {
  const h = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      h.set(key, value);
    }
  }
  return h;
}
