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
    send(data: string): void;
    close(): void;
    setInterval(callback: () => void, interval: number): void;
    setTimeout(callback: () => void, delay: number): void;
    on(event: string, callback: () => void): void;
  }

  export interface Response {
    status: number;
    body: string;
    error?: string;
    error_code?: number;
    headers: Record<string, string>;
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
    status: number;
    status_text: string;
    body: string;
    headers: Record<string, string>;
    json<T>(): T;
    error?: string;
    error_code?: number;
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
    headers?: Record<string, string>;
    timeout?: number;
    cookies?: Record<string, string>;
    tags?: Record<string, string>;
    redirects?: number;
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
  export function batch(requests: Array<[string, string] | [string, string, object]>): Response[];
}
