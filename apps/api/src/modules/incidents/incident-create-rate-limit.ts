/**
 * Fixed-window limiter for API-key incident creation.
 * Uses Date.now() — not setTimeout — so it is restart-safe in spirit
 * (Redis path) and has no in-process timers.
 *
 * Session-authenticated creates are not limited here; monitors hitting
 * POST /v1/incidents with an API key are.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function incidentCreateRateLimit(): number {
  const n = Number(process.env.INCIDENT_CREATE_RATE_LIMIT ?? 30);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function incidentCreateRateWindowMs(): number {
  const n = Number(process.env.INCIDENT_CREATE_RATE_WINDOW_MS ?? 60_000);
  return Number.isFinite(n) && n > 0 ? n : 60_000;
}

export function resetIncidentCreateRateLimits(): void {
  buckets.clear();
}

export function consumeIncidentCreateLimit(orgId: string): {
  ok: boolean;
  retryAfterSec: number;
  remaining: number;
} {
  const limit = incidentCreateRateLimit();
  const windowMs = incidentCreateRateWindowMs();
  const now = Date.now();
  const key = `org:${orgId}`;
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  bucket.count += 1;
  return {
    ok: true,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    remaining: Math.max(0, limit - bucket.count),
  };
}
