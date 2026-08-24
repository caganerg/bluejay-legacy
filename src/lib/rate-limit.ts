import { NextRequest } from "next/server";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

// The map and the sweep timer are kept on `globalThis`. Held in module scope,
// every hot reload during development would reset the limits and leak one more
// uncleared timer (`prisma.ts` and `notes-service.ts` already use this
// pattern).
const globalForRateLimit = globalThis as unknown as {
  __bluejayRateLimit?: Map<string, RateLimitStore>;
  __bluejayRateLimitSweeper?: ReturnType<typeof setInterval>;
};

const rateLimitMap = (globalForRateLimit.__bluejayRateLimit ??= new Map<string, RateLimitStore>());

// The map is not allowed to grow without bound: since `x-forwarded-for` can be
// spoofed, a client sending a different value on every request could inflate the
// map as fast as it liked (memory exhaustion).
const MAX_TRACKED_KEYS = 10_000;

/**
 * How many trusted proxies sit in front of us. `x-forwarded-for` can be written
 * by the client, so it cannot be trusted blindly: a client that changes the
 * header on every request could open itself an unlimited number of new buckets
 * and bypass the limit entirely.
 *
 * We count the chain from the END — the entries on the right are appended by our
 * own proxies and cannot be spoofed; the ones on the left come from the client.
 *
 * 0 (the default, direct access): the header is not trusted at all. Since there
 * is no reliable way to tell clients apart, the limit becomes a shared budget
 * per endpoint. If you put the app behind a reverse proxy, set this to your
 * proxy count.
 */
const TRUSTED_PROXY_HOPS = Math.max(
  0,
  Number.parseInt(process.env.RATE_LIMIT_TRUSTED_PROXIES ?? "0", 10) || 0
);

if (!globalForRateLimit.__bluejayRateLimitSweeper && typeof setInterval !== "undefined") {
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 10 * 60 * 1000);

  // Do not keep the process alive.
  sweeper.unref?.();
  globalForRateLimit.__bluejayRateLimitSweeper = sweeper;
}

function clientKey(req: NextRequest): string {
  if (TRUSTED_PROXY_HOPS === 0) {
    // No trustworthy source; a shared budget per endpoint.
    return "shared";
  }

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (!forwardedFor) return "shared";

  const chain = forwardedFor
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (chain.length === 0) return "shared";

  // Walk back TRUSTED_PROXY_HOPS entries from the end: that is the address the
  // outermost trusted proxy saw.
  const index = Math.max(0, chain.length - TRUSTED_PROXY_HOPS);
  return chain[index] ?? "shared";
}

// When the map hits its cap, drop expired records first and, if that is not
// enough, evict the oldest one (Map preserves insertion order, so the first
// entry is the oldest).
function evictIfNeeded(now: number) {
  if (rateLimitMap.size < MAX_TRACKED_KEYS) return;

  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) rateLimitMap.delete(key);
  }

  while (rateLimitMap.size >= MAX_TRACKED_KEYS) {
    const oldest = rateLimitMap.keys().next();
    if (oldest.done) break;
    rateLimitMap.delete(oldest.value);
  }
}

/**
 * A simple, lightweight rate limiter.
 *
 * Note: the state lives in process memory. In a serverless or multi-instance
 * deployment each instance keeps its own counter; a real limit needs a shared
 * store (Redis or similar).
 *
 * @param req The NextRequest object
 * @param limit Maximum number of allowed requests (default: 60)
 * @param windowMs Time window in milliseconds (default: 60000ms / 1 minute)
 */
export function checkRateLimit(
  req: NextRequest,
  limit: number = 60,
  windowMs: number = 60 * 1000
): { success: boolean; limit: number; remaining: number; reset: number } {
  const endpoint = req.nextUrl.pathname;
  const key = `${clientKey(req)}:${endpoint}`;
  const now = Date.now();

  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    evictIfNeeded(now);
    const resetTime = now + windowMs;
    rateLimitMap.set(key, { count: 1, resetTime });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: resetTime,
    };
  }

  if (record.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: record.resetTime,
    };
  }

  record.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - record.count,
    reset: record.resetTime,
  };
}
