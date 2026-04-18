import type { ProviderId } from "./domain";

export type AppErrorKind =
  | "auth"
  | "network"
  | "rate_limit"
  | "parse"
  | "unsupported"
  | "unknown";

interface AppErrorBase {
  readonly kind: AppErrorKind;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly providerId?: ProviderId;
  readonly debugMessage?: string;
  readonly cause?: unknown;
}

export interface AuthAppError extends AppErrorBase {
  readonly kind: "auth";
}

export interface NetworkAppError extends AppErrorBase {
  readonly kind: "network";
  readonly statusCode?: number;
}

export interface RateLimitAppError extends AppErrorBase {
  readonly kind: "rate_limit";
  readonly statusCode?: number;
  readonly retryAfterMs?: number;
}

export interface ParseAppError extends AppErrorBase {
  readonly kind: "parse";
  readonly source?: string;
}

export interface UnsupportedAppError extends AppErrorBase {
  readonly kind: "unsupported";
  readonly capability?: string;
}

export interface UnknownAppError extends AppErrorBase {
  readonly kind: "unknown";
}

export type AppError =
  | AuthAppError
  | NetworkAppError
  | RateLimitAppError
  | ParseAppError
  | UnsupportedAppError
  | UnknownAppError;
