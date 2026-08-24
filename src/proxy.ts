import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_ENABLED,
  AUTH_MISCONFIGURED,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth";

// In Next.js 16 the `middleware.ts` convention was renamed to `proxy.ts` and
// the exported function is now called `proxy`
// (see node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md).

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Methods that carry a body. The JSON content-type requirement applies only to
// these: bodyless `DELETE` requests send no `Content-Type`, and since an HTML
// form can only produce GET/POST, DELETE is not a CSRF vector this way (a
// cross-site fetch DELETE from a browser triggers a preflight, and we send no
// CORS headers).
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

/**
 * CSRF protection.
 *
 * Because `req.json()` parses the body without looking at `Content-Type`, an
 * HTML form using `enctype="text/plain"` — a "simple request" for which the
 * browser sends no preflight — could write to the API with no origin check. Two
 * layers close this:
 *
 *  1. If `Origin` is present it must match the host. Browsers always send this
 *     header on cross-site POST/PUT/PATCH/DELETE requests. The header being
 *     absent entirely means the request did not come from a browser (curl,
 *     server-to-server) — those are not CSRF vectors.
 *  2. Write requests must use `Content-Type: application/json`. An HTML form
 *     cannot send that content type without triggering a preflight.
 */
function csrfRejection(request: NextRequest): NextResponse | null {
  if (!STATE_CHANGING_METHODS.has(request.method)) return null;

  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return jsonError("Invalid Origin header", 403);
    }

    const host = request.headers.get("host");
    if (!host || originHost !== host) {
      return jsonError("The request was rejected because it came from a different origin", 403);
    }
  } else if (request.headers.get("sec-fetch-site") === "cross-site") {
    return jsonError("The request was rejected because it came from a different origin", 403);
  }

  if (BODY_METHODS.has(request.method)) {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.split(";")[0].trim().toLowerCase().endsWith("/json")) {
      return jsonError("Write requests require 'Content-Type: application/json'", 415);
    }
  }

  return null;
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";

  // `style-src-attr 'unsafe-inline'`: Radix UI (Dialog, Popover, Tooltip) writes
  // inline `style` attributes for positioning. Those fall under
  // `style-src-attr`; unlike scripts, allowing inline styles is a far narrower
  // risk, and without it menus and dialogs break.
  //
  // `'unsafe-eval'` is needed in development: React uses `eval` to rebuild error
  // stacks. It is not needed in production.
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ""}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

// The only paths reachable without a password: the login screen and the route
// that backs it.
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * Session check. Since the app serves a single vault, it verifies access rather
 * than identity: requests without a valid signed cookie are redirected to the
 * login screen on pages, and get a 401 on the API.
 */
function authRejection(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Refuse to serve if no password is configured in production: a vault
  // deployed without protection is open to everyone who can reach it.
  if (AUTH_MISCONFIGURED) {
    return jsonError(
      "Server not configured: the app cannot start in production without BLUEJAY_PASSWORD.",
      503
    );
  }

  // With password protection off, the login screen is a dead end: there is no
  // password to enter and `/api/auth/login` rejects every attempt with a 400.
  // Since the vault is open anyway, we send the user back to it instead of
  // leaving them stranded there.
  if (!AUTH_ENABLED && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!AUTH_ENABLED || PUBLIC_PATHS.has(pathname)) return null;
  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return null;

  if (isApiPath(pathname)) {
    return jsonError("You need to sign in", 401);
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export function proxy(request: NextRequest) {
  const denied = authRejection(request);
  if (denied) return denied;

  const rejection = csrfRejection(request);
  if (rejection) return rejection;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // We write the nonce into the request headers; Next.js reads it from here and
  // attaches it to the scripts it injects itself.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Exclude static assets; otherwise CSS/JS/image requests would needlessly pass
  // through this code too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
