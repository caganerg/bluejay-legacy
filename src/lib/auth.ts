import { createHmac, timingSafeEqual, randomBytes, createHash, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { currentSessionEpoch } from "./session-store";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

/**
 * Single-user password protection.
 *
 * The app serves a single vault (`DEFAULT_USER_ID`), so there is no user
 * management here: a client that knows the correct password gets a signed
 * session cookie.
 *
 * Environment variables:
 *   BLUEJAY_PASSWORD  The password that unlocks the vault. If unset, protection
 *                     is off (development only; in production the app refuses to
 *                     serve).
 *   AUTH_SECRET       Secret key that signs the session cookie. If unset it is
 *                     derived from the password, in which case changing the
 *                     password invalidates all existing sessions.
 *   SESSION_MAX_AGE   Session lifetime in seconds. Defaults to 7 days.
 */

export const SESSION_COOKIE = "bluejay_session";

const password = process.env.BLUEJAY_PASSWORD ?? "";

/** Protection is enabled whenever a password is set. */
export const AUTH_ENABLED = password.length > 0;

/**
 * A password is mandatory in production. A vault deployed without protection is
 * open to everyone who can reach it, so when `NODE_ENV=production` and no
 * password is set the app serves no requests.
 */
export const AUTH_MISCONFIGURED = process.env.NODE_ENV === "production" && !AUTH_ENABLED;

const sessionMaxAge = Number.parseInt(process.env.SESSION_MAX_AGE ?? "", 10) || 60 * 60 * 24 * 7;

function signingKey(): Buffer {
  const explicit = process.env.AUTH_SECRET;
  const base = explicit
    ? Buffer.from(explicit, "utf8")
    : // Use a derivative of the password rather than the password itself as the key.
      createHash("sha256").update(`bluejay-session:${password}`).digest();

  // The session epoch is mixed into the key, so that when the epoch rotates (on
  // logout) the signature of every previously issued token becomes invalid at
  // once. Without this, tokens could not be revoked server-side at all.
  return createHmac("sha256", base).update(currentSessionEpoch()).digest();
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

/** Compares two strings in constant time without leaking their length. */
function safeEqual(a: string, b: string): boolean {
  // Hash them first: `timingSafeEqual` requires equal lengths, and on raw
  // strings a length difference would leak through an early return.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Password verification is deliberately EXPENSIVE.
 *
 * It used to be a single SHA-256 comparison; because an attempt cost close to
 * nothing, the only defence against brute force was the per-minute counter on
 * the login route. That counter cannot tell clients apart (see rate-limit.ts),
 * so it degenerated into a global bucket: with 10 wrong attempts a minute,
 * anyone could lock the vault's owner out indefinitely.
 *
 * The fix is not to harden the counter but to make the attempt itself costly:
 * scrypt puts ~139 ms of work into every attempt. That removes the need for
 * lockouts, and the owner's correct password is never rejected.
 *
 * The asynchronous version of `scrypt` is used: `scryptSync` would block the
 * event loop, and anyone flooding the login route could stall the whole server.
 * The async version runs on the libuv thread pool.
 */
const SCRYPT_PARAMS = { N: 2 ** 16, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const SCRYPT_SALT = "bluejay-login-v1";

// The derivative of the real password is constant; it is computed once per
// process and kept.
let expectedKeyPromise: Promise<Buffer> | null = null;
function expectedPasswordKey(): Promise<Buffer> {
  expectedKeyPromise ??= scryptAsync(password, SCRYPT_SALT, 32, SCRYPT_PARAMS);
  return expectedKeyPromise;
}

export async function verifyPassword(candidate: string): Promise<boolean> {
  if (!AUTH_ENABLED) return false;

  const [candidateKey, expectedKey] = await Promise.all([
    scryptAsync(candidate, SCRYPT_SALT, 32, SCRYPT_PARAMS),
    expectedPasswordKey(),
  ]);

  // Both derivatives are 32 bytes, so `timingSafeEqual` can be used directly.
  return timingSafeEqual(candidateKey, expectedKey);
}

/**
 * A signed session token in the form `base64url(payload).base64url(hmac)`.
 * The payload only carries the expiry; the identity is singular anyway.
 */
export function createSessionToken(): { token: string; maxAge: number } {
  const payload = JSON.stringify({
    exp: Date.now() + sessionMaxAge * 1000,
    jti: randomBytes(9).toString("base64url"),
  });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return { token: `${encoded}.${sign(encoded)}`, maxAge: sessionMaxAge };
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!AUTH_ENABLED) return true;
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  if (!safeEqual(signature, sign(encoded))) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return typeof exp === "number" && Date.now() < exp;
  } catch {
    return false;
  }
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
