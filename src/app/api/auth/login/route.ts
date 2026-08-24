import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AUTH_ENABLED,
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";

const loginSchema = z.object({
  password: z.string().min(1, "A password is required").max(512),
});

/**
 * The defence against brute force is now the scrypt cost inside `verifyPassword`
 * (~139 ms per attempt, see src/lib/auth.ts). The only limit here is how many
 * verifications may run at once: it keeps the thread pool from being exhausted
 * and caps the sustainable attempt rate at ~11 per second.
 *
 * There used to be a global per-minute bucket here (`checkRateLimit(req, 10, …)`).
 * Since there is no way to tell clients apart, that bucket covered the entire
 * endpoint: with 10 wrong attempts a minute, anyone could lock the vault's OWNER
 * out indefinitely — even the correct password got a 429. The concurrency limit
 * causes no such lockout: a request that hits the limit waits at most as long as
 * the in-flight verifications (~200 ms) and succeeds on a retry.
 */
const MAX_CONCURRENT_VERIFICATIONS = 2;

// `globalThis` rather than module scope, so the counter is not reset when the
// module is reloaded during development (the pattern used across the project).
const globalForLogin = globalThis as unknown as { __bluejayLoginInFlight?: number };

export async function POST(req: NextRequest) {
  if (!AUTH_ENABLED) {
    return NextResponse.json({ error: "Password protection is not configured" }, { status: 400 });
  }

  if ((globalForLogin.__bluejayLoginInFlight ?? 0) >= MAX_CONCURRENT_VERIFICATIONS) {
    return NextResponse.json(
      { error: "Too many login attempts are being processed right now. Please try again." },
      { status: 429, headers: { "Retry-After": "1" } }
    );
  }

  const parseResult = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parseResult.success) {
    return NextResponse.json({ error: "A password is required" }, { status: 400 });
  }

  globalForLogin.__bluejayLoginInFlight = (globalForLogin.__bluejayLoginInFlight ?? 0) + 1;
  let passwordOk: boolean;
  try {
    passwordOk = await verifyPassword(parseResult.data.password);
  } finally {
    globalForLogin.__bluejayLoginInFlight = Math.max(
      0,
      (globalForLogin.__bluejayLoginInFlight ?? 1) - 1
    );
  }

  if (!passwordOk) {
    // A single message that does not reveal which part was wrong.
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const { token, maxAge } = createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return response;
}
