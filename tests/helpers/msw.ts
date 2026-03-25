import type { HttpHandler } from "msw";
import { setupServer } from "msw/node";

let server: ReturnType<typeof setupServer> | null = null;
let handlers: HttpHandler[] = [];

export function createTestServer(...initialHandlers: HttpHandler[]) {
  handlers = [...initialHandlers];
  server = setupServer(...handlers);
  return server;
}

export function addTestHandlers(...newHandlers: HttpHandler[]) {
  handlers = [...handlers, ...newHandlers];
  if (server) {
    server.use(...newHandlers);
  }
}

export function resetTestServer() {
  if (server) {
    server.resetHandlers();
  }
  handlers = [];
}
