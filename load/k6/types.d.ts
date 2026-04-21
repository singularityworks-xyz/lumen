declare module "k6" {
  export function check<T>(
    val: T,
    checks: Record<string, (val: T) => boolean>
  ): boolean;

  export function sleep(seconds: number): void;

  export function group<T>(name: string, fn: () => T): T;

  export const __ENV: Record<string, string | undefined>;
  export const __VU: number;
  export const __ITER: number;
}

declare module "k6/ws" {
  export interface Socket {
    close(): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
    ping(): void;
    send(data: string): void;
    sendBinary(data: ArrayBuffer | ArrayBufferLike): void;
    setInterval(callback: () => void, interval: number): void;
    setTimeout(callback: () => void, delay: number): void;
  }

  export interface Response {
    body: string;
    error?: string;
    error_code?: number;
    headers: Record<string, string>;
    status: number;
  }

  export interface WsOptions {
    headers?: Record<string, string>;
    timeout?: number;
  }

  export function connect(
    url: string,
    options: WsOptions,
    callback: (socket: Socket) => void
  ): Response;
}

declare function open(filePath: string, mode?: "b"): string | ArrayBuffer;

declare module "k6/websockets" {
  export interface WebSocketParams {
    headers?: Record<string, string>;
    tags?: Record<string, string>;
  }

  export class WebSocket {
    static readonly OPEN: number;
    static readonly CLOSED: number;

    binaryType: string;
    onopen: (() => void) | null;
    onclose: (() => void) | null;
    onerror: (() => void) | null;
    onmessage:
      | ((event: { data: string | ArrayBuffer | Uint8Array }) => void)
      | null;
    readyState: number;
    constructor(
      url: string,
      protocols?: string | string[],
      params?: WebSocketParams
    );
    addEventListener(
      event: "error" | ("close" | "open"),
      listener: () => void
    ): void;
    addEventListener(
      event: "message",
      listener: (event: { data: string | ArrayBuffer | Uint8Array }) => void
    ): void;

    close(code?: number, reason?: string): void;
    send(data: string | ArrayBuffer | Uint8Array): void;
  }
}

declare module "k6/metrics" {
  export class Metric {
    constructor(name: string, isTime?: boolean);
    add(value: number, tags?: Record<string, string>): void;
  }

  export class Counter extends Metric {
    constructor(name: string);
    add(value: number, tags?: Record<string, string>): void;
  }

  export class Gauge extends Metric {
    constructor(name: string);
    add(value: number, tags?: Record<string, string>): void;
  }

  export class Trend extends Metric {
    constructor(name: string);
    add(value: number, tags?: Record<string, string>): void;
  }

  export class Rate extends Metric {
    constructor(name: string);
    add(value: boolean | number, tags?: Record<string, string>): void;
  }
}

declare module "k6/http" {
  export interface Response {
    body: string;
    error?: string;
    error_code?: number;
    headers: Record<string, string>;
    json<T>(): T;
    status: number;
    status_text: string;
    timings: {
      duration: number;
      blocked: number;
      connecting: number;
      tls_handshake: number;
      sending: number;
      waiting: number;
      receiving: number;
    };
  }

  export interface RequestOptions {
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
    redirects?: number;
    tags?: Record<string, string>;
    timeout?: number;
  }

  export function get(url: string, params?: RequestOptions): Response;
  export function post(
    url: string,
    body?: string | object,
    params?: RequestOptions
  ): Response;
  export function put(
    url: string,
    body?: string | object,
    params?: RequestOptions
  ): Response;
  export function del(url: string, params?: RequestOptions): Response;
  export function request(
    method: string,
    url: string,
    body?: string | object,
    params?: RequestOptions
  ): Response;
  export function batch(
    requests: Array<[string, string] | [string, string, object]>
  ): Response[];
}

declare module "k6/execution" {
  export const vus: number;
  export const iterations: number;
  export const instanceIterations: number;
  export const vu: number;
  export const instanceID: string;
  export const group: string;
}

declare module "yjs" {
  export class Doc {
    clientID: number;
    constructor();
    getMap(name?: string): Map<unknown, unknown>;
    getMaps(): Map<unknown, unknown>[];
    getArray(name?: string): unknown[];
    getText(name?: string): unknown;
    encodeStateAsUpdate(doc: Doc): Uint8Array;
    encodeStateVector(doc: Doc): Uint8Array;
    applyUpdate(doc: Doc, update: Uint8Array): void;
  }
  export function encodeStateAsUpdate(doc: Doc): Uint8Array;
  export function encodeStateVector(doc: Doc): Uint8Array;
  export function applyUpdate(doc: Doc, update: Uint8Array): void;
  export function compareStateVectors(
    sv1: Uint8Array,
    sv2: Uint8Array
  ): boolean;
}
