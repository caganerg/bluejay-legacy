import { createHmac, timingSafeEqual, randomBytes, createHash } from "node:crypto";

/**
 * Tek kullanıcılı şifre koruması.
 *
 * Uygulama tek bir kasayı (`DEFAULT_USER_ID`) sunduğu için burada kullanıcı
 * yönetimi yok: doğru parolayı bilen istemci imzalı bir oturum çerezi alır.
 *
 * Ortam değişkenleri:
 *   BLUEJAY_PASSWORD  Kasayı açan parola. Tanımlı değilse koruma kapalıdır
 *                     (yalnızca geliştirmede; üretimde uygulama hizmet vermez).
 *   AUTH_SECRET       Oturum çerezini imzalayan gizli anahtar. Tanımlı değilse
 *                     paroladan türetilir; bu durumda parola değişince mevcut
 *                     bütün oturumlar geçersiz olur.
 *   SESSION_MAX_AGE   Oturum ömrü (saniye). Varsayılan 7 gün.
 */

export const SESSION_COOKIE = "bluejay_session";

const password = process.env.BLUEJAY_PASSWORD ?? "";

/** Parola tanımlıysa koruma etkindir. */
export const AUTH_ENABLED = password.length > 0;

/**
 * Üretimde parola zorunlu. Koruma olmadan dağıtılan bir kasa, ona erişebilen
 * herkese açık demektir; bu yüzden `NODE_ENV=production` iken parola yoksa
 * uygulama istek karşılamaz.
 */
export const AUTH_MISCONFIGURED = process.env.NODE_ENV === "production" && !AUTH_ENABLED;

const sessionMaxAge = Number.parseInt(process.env.SESSION_MAX_AGE ?? "", 10) || 60 * 60 * 24 * 7;

function signingKey(): Buffer {
  const explicit = process.env.AUTH_SECRET;
  if (explicit) return Buffer.from(explicit, "utf8");
  // Parolanın kendisini anahtar olarak kullanmak yerine türevini kullan.
  return createHash("sha256").update(`bluejay-session:${password}`).digest();
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

/** İki dizgeyi uzunluk sızdırmadan ve sabit zamanda karşılaştırır. */
function safeEqual(a: string, b: string): boolean {
  // Önce özetlerini al: `timingSafeEqual` eşit uzunluk ister, ham dizgelerde
  // uzunluk farkı erken dönüşle sızardı.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function verifyPassword(candidate: string): boolean {
  if (!AUTH_ENABLED) return false;
  return safeEqual(candidate, password);
}

/**
 * `base64url(payload).base64url(hmac)` biçiminde imzalı oturum jetonu.
 * Payload yalnızca son kullanma zamanını taşır; kimlik zaten tekil.
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
