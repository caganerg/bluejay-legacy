import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AUTH_ENABLED,
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({
  password: z.string().min(1, "Parola gereklidir").max(512),
});

export async function POST(req: NextRequest) {
  // Kaba kuvvet denemelerine karşı dar bir bütçe.
  const rateLimit = checkRateLimit(req, 10, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Çok fazla giriş denemesi. Lütfen bir dakika bekleyin." },
      { status: 429 }
    );
  }

  if (!AUTH_ENABLED) {
    return NextResponse.json({ error: "Parola koruması yapılandırılmamış" }, { status: 400 });
  }

  const parseResult = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parseResult.success) {
    return NextResponse.json({ error: "Parola gereklidir" }, { status: 400 });
  }

  if (!verifyPassword(parseResult.data.password)) {
    // Hangi kısmın yanlış olduğunu ayırt etmeyen tek bir mesaj.
    return NextResponse.json({ error: "Parola hatalı" }, { status: 401 });
  }

  const { token, maxAge } = createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return response;
}
