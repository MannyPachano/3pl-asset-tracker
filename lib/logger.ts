/**
 * Simple server-side logger. No PII in logs per AUTH-RULES (no passwords, tokens; prefer user id over email).
 */

function safeString(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "[object]";
  }
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    const payload = meta ? ` ${safeString(meta)}` : "";
    console.log(`[info] ${message}${payload}`);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    const payload = meta ? ` ${safeString(meta)}` : "";
    console.warn(`[warn] ${message}${payload}`);
  },
  debug(message: string, meta?: Record<string, unknown>) {
    const payload = meta ? ` ${safeString(meta)}` : "";
    console.debug(`[debug] ${message}${payload}`);
  },
  error(message: string, err?: unknown) {
    if (err instanceof Error) {
      console.error(`[error] ${message}`, err.message, err.stack);
    } else {
      console.error(`[error] ${message}`, err);
    }
  },
};
