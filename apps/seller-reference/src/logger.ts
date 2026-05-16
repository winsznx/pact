/**
 * Structured JSON-line logger. Each call writes one line to stdout in
 * the shape `{ "ts": "...", "level": "info", "event": "...", ... }` —
 * easy to grep during the demo, easy to tail and pipe to jq.
 *
 * Errors flow to stderr so a redirected stdout doesn't swallow them.
 */
type Level = "info" | "warn" | "error";

function emit(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit("error", event, fields),
};
