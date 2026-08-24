import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * The session "epoch" — the only piece of state that makes server-side session
 * revocation possible.
 *
 * Why it is needed: the session token was a self-verifying signed value and,
 * because the server stored nothing, LOGGING OUT DID NOT INVALIDATE THE TOKEN.
 * `/api/auth/logout` only dropped the caller's own cookie; anyone who had
 * captured a copy of the token kept access until `exp` (7 days by default). The
 * "Lock Vault" button locked nothing at all.
 *
 * The epoch is mixed into the signing key (see `signingKey`, src/lib/auth.ts):
 * the moment the epoch rotates, the signature of every previously issued token
 * becomes invalid.
 *
 * Why it lives in a file: both `proxy.ts` and the API routes read this value.
 * The Next docs say the proxy must not be relied upon to share modules/globals
 * with application code (node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/proxy.md), so an in-process variable would not do. A file
 * also survives restarts — kept in memory, revoked tokens would become valid
 * again every time the server restarted.
 *
 * Note: the same limitation as `rate-limit.ts` applies — in a multi-instance
 * deployment this file has to live on a volume shared between the instances.
 */

const stateDir = process.env.BLUEJAY_STATE_DIR ?? path.join(process.cwd(), ".bluejay");
const epochFile = path.join(stateDir, "session-epoch");

function newEpoch(): string {
  return randomBytes(24).toString("base64url");
}

function persist(value: string): void {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  writeFileSync(epochFile, value, { encoding: "utf8", mode: 0o600 });
}

/**
 * The current epoch. If the file does not exist (first run) one is generated
 * and written.
 *
 * It is read from disk on every request; measured at 4 µs, so caching is not
 * worth it. Being uncached is also good for correctness: there is never a
 * window where verification runs against a stale epoch after a logout.
 */
export function currentSessionEpoch(): string {
  try {
    const value = readFileSync(epochFile, "utf8").trim();
    if (value) return value;
  } catch {
    // The file is missing or unreadable; it is regenerated below.
  }

  const value = newEpoch();
  persist(value);
  return value;
}

/**
 * Generates a new epoch, invalidating every issued session token instantly.
 * Called on logout.
 */
export function rotateSessionEpoch(): void {
  persist(newEpoch());
}
