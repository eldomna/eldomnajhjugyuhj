/**
 * Vendor-neutral error reporting.
 *
 * The application never depends on an external monitoring service. A sink can
 * be registered at runtime (Sentry, Logtail, Datadog, CloudWatch, custom …);
 * with no sink registered, errors go to the console only.
 */

export type ErrorSeverity = "error" | "warning" | "info";

export type ErrorReportContext = Record<string, unknown>;

export type ErrorReport = {
  error: unknown;
  message: string;
  stack?: string;
  context: ErrorReportContext;
  severity: ErrorSeverity;
  handled: boolean;
  mechanism: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary" | "server";
};

export type ErrorSink = (report: ErrorReport) => void;

const sinks = new Set<ErrorSink>();

/** Registers an external reporter. Returns an unsubscribe function. */
export function registerErrorSink(sink: ErrorSink): () => void {
  sinks.add(sink);
  return () => sinks.delete(sink);
}

const SECRET_KEY_RE =
  /(key|token|secret|password|passwd|authorization|bearer|cookie|session|jwt|credential)/i;

/** Redacts values whose keys look sensitive so logs never leak secrets. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY_RE.test(key) ? "[redacted]" : redact(item, depth + 1);
  }
  return out;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export const isProduction =
  typeof import.meta !== "undefined" ? !!import.meta.env?.PROD : process.env["NODE_ENV"] === "production";

/** Reports an error to every registered sink and to the console. */
export function reportError(
  error: unknown,
  context: ErrorReportContext = {},
  options: {
    severity?: ErrorSeverity;
    handled?: boolean;
    mechanism?: ErrorReport["mechanism"];
  } = {},
) {
  const report: ErrorReport = {
    error,
    message: messageOf(error),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    context: redact({
      ...(typeof window === "undefined" ? {} : { route: window.location.pathname }),
      ...context,
    }) as ErrorReportContext,
    severity: options.severity ?? "error",
    handled: options.handled ?? false,
    mechanism: options.mechanism ?? "manual",
  };

  for (const sink of sinks) {
    try {
      sink(report);
    } catch {
      // A failing monitoring sink must never break the app.
    }
  }

  // Stack traces are kept out of production console output.
  if (isProduction) {
    console.error(`[${report.severity}] ${report.message}`, report.context);
  } else {
    console.error(error, report.context);
  }
}

/** Convenience wrapper used by React error boundaries. */
export function reportBoundaryError(error: unknown, context: ErrorReportContext = {}) {
  reportError(error, { source: "react_error_boundary", ...context }, {
    mechanism: "react_error_boundary",
    handled: false,
    severity: "error",
  });
}

let globalHandlersInstalled = false;

/** Installs window-level handlers for uncaught errors and promise rejections. */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined" || globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  window.addEventListener("error", (event) => {
    reportError(
      event.error ?? event.message,
      { filename: event.filename, lineno: event.lineno, colno: event.colno },
      { mechanism: "onerror", handled: false },
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, {}, { mechanism: "unhandledrejection", handled: false });
  });
}

/** Safe, user-facing message: never exposes internals in production. */
export function userFacingErrorMessage(error: unknown, fallback: string): string {
  if (!isProduction) return messageOf(error) || fallback;
  const message = messageOf(error);
  // Only surface messages that were written for users (short, no stack markers).
  if (!message || message.length > 200 || message.includes("at ") || message.includes("\n")) {
    return fallback;
  }
  return message;
}
