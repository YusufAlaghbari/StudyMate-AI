type RateBucket = {
  count: number;
  resetAt: number;
};

const globalStore = globalThis as typeof globalThis & {
  studyMateRateLimits?: Map<string, RateBucket>;
};

const buckets = globalStore.studyMateRateLimits ?? new Map<string, RateBucket>();
globalStore.studyMateRateLimits = buckets;

export function isRateLimited(request: Request, limit = 12, windowMs = 60_000) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const key = forwardedFor?.split(",")[0]?.trim() || "anonymous";
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (current.count >= limit) return true;

  current.count += 1;
  return false;
}
