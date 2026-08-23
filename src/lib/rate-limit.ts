import { NextRequest } from "next/server";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

// Harita ve temizlik zamanlayıcısı `globalThis` üzerinde tutulur. Modül
// kapsamında tutulduğunda geliştirme sırasında her yeniden yüklemede limitler
// sıfırlanıyor ve temizlenmemiş bir zamanlayıcı daha birikiyordu
// (`prisma.ts` ve `notes-service.ts` zaten bu kalıbı kullanıyor).
const globalForRateLimit = globalThis as unknown as {
  __bluejayRateLimit?: Map<string, RateLimitStore>;
  __bluejayRateLimitSweeper?: ReturnType<typeof setInterval>;
};

const rateLimitMap = (globalForRateLimit.__bluejayRateLimit ??= new Map<string, RateLimitStore>());

// Haritanın sınırsız büyümesine izin verilmiyor: `x-forwarded-for` sahtelenebilir
// olduğu için her istekte farklı bir değer gönderen bir istemci haritayı
// istediği hızda şişirebiliyordu (bellek tüketimi).
const MAX_TRACKED_KEYS = 10_000;

/**
 * Önünde kaç güvenilir proxy olduğu. `x-forwarded-for` istemci tarafından
 * yazılabildiği için körü körüne güvenilemez: başlığı her istekte değiştiren
 * bir istemci kendine sınırsız sayıda yeni kova açıp limiti tamamen atlatıyordu.
 *
 * Zinciri SONDAN sayıyoruz — sağdaki girdiler kendi proxy'lerimiz tarafından
 * eklenir ve sahtelenemez; soldakiler istemciden gelir.
 *
 * 0 (varsayılan, doğrudan erişim): başlığa hiç güvenilmez. İstemciyi güvenilir
 * biçimde ayırt etmenin yolu olmadığı için limit uç nokta başına ortak bir
 * bütçeye dönüşür. Uygulamayı bir ters proxy arkasına alırsanız bu değeri
 * proxy sayınıza ayarlayın.
 */
const TRUSTED_PROXY_HOPS = Math.max(
  0,
  Number.parseInt(process.env.RATE_LIMIT_TRUSTED_PROXIES ?? "0", 10) || 0
);

if (!globalForRateLimit.__bluejayRateLimitSweeper && typeof setInterval !== "undefined") {
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 10 * 60 * 1000);

  // Süreçin kapanmasını engellemesin.
  sweeper.unref?.();
  globalForRateLimit.__bluejayRateLimitSweeper = sweeper;
}

function clientKey(req: NextRequest): string {
  if (TRUSTED_PROXY_HOPS === 0) {
    // Güvenilir bir kaynak yok; uç nokta başına ortak bütçe.
    return "shared";
  }

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (!forwardedFor) return "shared";

  const chain = forwardedFor
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (chain.length === 0) return "shared";

  // Sondan TRUSTED_PROXY_HOPS kadar geri git: bu, en dıştaki güvenilir
  // proxy'nin gördüğü adrestir.
  const index = Math.max(0, chain.length - TRUSTED_PROXY_HOPS);
  return chain[index] ?? "shared";
}

// Harita üst sınıra dayandığında önce süresi dolmuş kayıtları at, yetmezse
// en erken sıfırlanacak olanı düşür (Map ekleme sırasını koruduğu için ilk
// girdi en eskisidir).
function evictIfNeeded(now: number) {
  if (rateLimitMap.size < MAX_TRACKED_KEYS) return;

  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) rateLimitMap.delete(key);
  }

  while (rateLimitMap.size >= MAX_TRACKED_KEYS) {
    const oldest = rateLimitMap.keys().next();
    if (oldest.done) break;
    rateLimitMap.delete(oldest.value);
  }
}

/**
 * Basit ve hafif rate limiter.
 *
 * Not: durum süreç belleğinde tutulur. Sunucusuz ya da çok örnekli bir
 * dağıtımda her örneğin kendi sayacı olur; gerçek bir limit için paylaşımlı
 * bir depo (Redis vb.) gerekir.
 *
 * @param req NextRequest nesnesi
 * @param limit İzin verilen maksimum istek sayısı (varsayılan: 60)
 * @param windowMs Zaman penceresi milisaniye cinsinden (varsayılan: 60000ms / 1 dakika)
 */
export function checkRateLimit(
  req: NextRequest,
  limit: number = 60,
  windowMs: number = 60 * 1000
): { success: boolean; limit: number; remaining: number; reset: number } {
  const endpoint = req.nextUrl.pathname;
  const key = `${clientKey(req)}:${endpoint}`;
  const now = Date.now();

  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    evictIfNeeded(now);
    const resetTime = now + windowMs;
    rateLimitMap.set(key, { count: 1, resetTime });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: resetTime,
    };
  }

  if (record.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: record.resetTime,
    };
  }

  record.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - record.count,
    reset: record.resetTime,
  };
}
