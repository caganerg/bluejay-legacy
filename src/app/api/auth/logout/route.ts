import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // maxAge 0: çerezi hemen düşür.
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
