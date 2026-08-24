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
  password: z.string().min(1, "Parola gereklidir").max(512),
});

/**
 * Kaba kuvvete karşı savunma artık `verifyPassword` içindeki scrypt maliyeti
 * (~139 ms/deneme, bkz. src/lib/auth.ts). Buradaki tek sınır, aynı anda kaç
 * doğrulamanın çalışabileceği: iş parçacığı havuzunun tükenmesini engelliyor ve
 * sürdürülebilir deneme hızını saniyede ~11'e çekiyor.
 *
 * Eskiden burada dakikalık küresel bir kova vardı (`checkRateLimit(req, 10, …)`).
 * İstemciyi ayırt etmenin yolu olmadığı için o kova bütün uç noktayı kapsıyordu:
 * dakikada 10 yanlış denemeyle isteyen herkes kasanın SAHİBİNİ süresiz olarak
 * dışarıda bırakabiliyordu — doğru parola bile 429 alıyordu. Eşzamanlılık sınırı
 * bu kilitlenmeyi yaşatmıyor: sınıra takılan bir istek en fazla uçuştaki
 * doğrulamalar kadar (~200 ms) bekler ve tekrar denendiğinde geçer.
 */
const MAX_CONCURRENT_VERIFICATIONS = 2;

// Modül kapsamı yerine `globalThis`: geliştirme sırasında modül yeniden
// yüklendiğinde sayaç sıfırlanmasın (proje genelindeki kalıp).
const globalForLogin = globalThis as unknown as { __bluejayLoginInFlight?: number };

export async function POST(req: NextRequest) {
  if (!AUTH_ENABLED) {
    return NextResponse.json({ error: "Parola koruması yapılandırılmamış" }, { status: 400 });
  }

  if ((globalForLogin.__bluejayLoginInFlight ?? 0) >= MAX_CONCURRENT_VERIFICATIONS) {
    return NextResponse.json(
      { error: "Şu anda çok fazla giriş denemesi işleniyor. Lütfen tekrar deneyin." },
      { status: 429, headers: { "Retry-After": "1" } }
    );
  }

  const parseResult = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parseResult.success) {
    return NextResponse.json({ error: "Parola gereklidir" }, { status: 400 });
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
    // Hangi kısmın yanlış olduğunu ayırt etmeyen tek bir mesaj.
    return NextResponse.json({ error: "Parola hatalı" }, { status: 401 });
  }

  const { token, maxAge } = createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return response;
}
