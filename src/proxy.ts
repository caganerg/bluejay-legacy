import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_ENABLED,
  AUTH_MISCONFIGURED,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth";

// Next.js 16'da `middleware.ts` konvansiyonu `proxy.ts` olarak yeniden
// adlandırıldı ve dışa aktarılan fonksiyonun adı `proxy` oldu
// (bkz. node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md).

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Gövde taşıyan metotlar. JSON içerik türü şartı yalnızca bunlara uygulanır:
// gövdesiz `DELETE` istekleri `Content-Type` göndermez ve bir HTML formu zaten
// yalnızca GET/POST üretebildiği için DELETE bu yolla CSRF vektörü değildir
// (tarayıcıdan siteler arası fetch DELETE ön kontrol tetikler, CORS başlığı da yok).
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

/**
 * CSRF koruması.
 *
 * `req.json()` gövdeyi `Content-Type`'a bakmadan ayrıştırdığı için
 * `enctype="text/plain"` kullanan bir HTML formu — tarayıcının ön kontrol
 * (preflight) göndermediği "basit istek" — API'ye kaynak doğrulaması olmadan
 * yazabiliyordu. İki katmanla kapatılıyor:
 *
 *  1. `Origin` varsa host ile eşleşmek zorunda. Tarayıcılar siteler arası
 *     POST/PUT/PATCH/DELETE isteklerinde bu başlığı her zaman gönderir.
 *     Başlığın hiç olmaması tarayıcı kaynaklı olmadığı anlamına gelir
 *     (curl, sunucudan sunucuya) — bunlar CSRF vektörü değildir.
 *  2. Yazma isteklerinde `Content-Type: application/json` şart. Bir HTML formu
 *     bu içerik türünü ön kontrol tetiklemeden gönderemez.
 */
function csrfRejection(request: NextRequest): NextResponse | null {
  if (!STATE_CHANGING_METHODS.has(request.method)) return null;

  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return jsonError("Geçersiz Origin başlığı", 403);
    }

    const host = request.headers.get("host");
    if (!host || originHost !== host) {
      return jsonError("İstek farklı bir kaynaktan geldiği için reddedildi", 403);
    }
  } else if (request.headers.get("sec-fetch-site") === "cross-site") {
    return jsonError("İstek farklı bir kaynaktan geldiği için reddedildi", 403);
  }

  if (BODY_METHODS.has(request.method)) {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.split(";")[0].trim().toLowerCase().endsWith("/json")) {
      return jsonError("Yazma istekleri 'Content-Type: application/json' gerektirir", 415);
    }
  }

  return null;
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";

  // `style-src-attr 'unsafe-inline'`: Radix UI (Dialog, Popover, Tooltip)
  // konumlandırma için satır içi `style` niteliği yazıyor. Bunlar `style-src-attr`
  // kapsamında; script'ten farklı olarak satır içi stile izin vermek çok daha
  // dar bir risk ve olmadan menüler/diyaloglar bozuluyor.
  //
  // Geliştirmede `'unsafe-eval'` gerekiyor: React hata yığınlarını yeniden
  // kurmak için `eval` kullanıyor. Üretimde gerekmiyor.
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

// Parola sorulmadan erişilebilen tek yollar: giriş ekranı ve onu besleyen rota.
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * Oturum kontrolü. Uygulama tek bir kasayı sunduğu için kimlik değil erişim
 * doğrulanıyor: geçerli imzalı çerezi olmayan istekler sayfalarda giriş
 * ekranına yönlendiriliyor, API'de 401 alıyor.
 */
function authRejection(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Üretimde parola yapılandırılmamışsa hizmet verme: korumasız dağıtılan bir
  // kasa, ona erişebilen herkese açıktır.
  if (AUTH_MISCONFIGURED) {
    return jsonError(
      "Sunucu yapılandırılmamış: üretimde BLUEJAY_PASSWORD tanımlanmadan uygulama açılamaz.",
      503
    );
  }

  if (!AUTH_ENABLED || PUBLIC_PATHS.has(pathname)) return null;
  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return null;

  if (isApiPath(pathname)) {
    return jsonError("Oturum açmanız gerekiyor", 401);
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

  // Nonce'u istek başlıklarına yazıyoruz; Next.js kendi enjekte ettiği
  // script'lere bu değeri buradan okuyarak ekliyor.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Statik varlıkları dışarıda bırak; aksi halde CSS/JS/görsel istekleri de
  // gereksiz yere bu koddan geçer.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
