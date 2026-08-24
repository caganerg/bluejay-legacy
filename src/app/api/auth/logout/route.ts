import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { rotateSessionEpoch } from "@/lib/session-store";

export async function POST() {
  // Rotate the session epoch: this invalidates the signature of EVERY issued
  // token. This used to only drop the cookie; anyone who had captured a copy of
  // the token kept access until `exp` (7 days by default), meaning "Lock Vault"
  // locked nothing at all.
  //
  // The error is not swallowed: if the epoch could not be written the lock did
  // NOT happen, and reporting that as a silent success would be exactly the bug
  // being fixed here.
  try {
    rotateSessionEpoch();
  } catch (error) {
    console.error("Failed to rotate the session epoch:", error);
    return NextResponse.json(
      {
        error:
          "Could not lock the vault: the session state cannot be written. BLUEJAY_STATE_DIR must be writable.",
      },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ ok: true });
  // maxAge 0: drop the cookie immediately.
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
