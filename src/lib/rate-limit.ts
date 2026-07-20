type RateLimitEntry = {
  windowStartedAt: number;
  count: number;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_TRACKED_KEYS = 10_000;

// This is intentionally process-local. It protects a warm serverless instance
// from bursts without adding a paid database or external rate-limit service.
const entries = new Map<string, RateLimitEntry>();

function prune(now: number): void {
  for (const [key, entry] of entries) {
    if (now - entry.windowStartedAt >= WINDOW_MS) entries.delete(key);
  }

  while (entries.size > MAX_TRACKED_KEYS) {
    const oldestKey = entries.keys().next().value;
    if (!oldestKey) break;
    entries.delete(oldestKey);
  }
}

export function consumeAnalysisRateLimit(
  key: string,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  prune(now);

  const current = entries.get(key);
  if (!current || now - current.windowStartedAt >= WINDOW_MS) {
    entries.set(key, { windowStartedAt: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((WINDOW_MS - (now - current.windowStartedAt)) / 1000)
      ),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

