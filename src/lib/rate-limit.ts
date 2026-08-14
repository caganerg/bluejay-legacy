import { NextRequest } from "next/server";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitStore>();

// 10 dakikada bir süresi dolmuş IP kayıtlarını temizle (Memory leak koruması)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

/**
 * IP tabanlı basit ve hafif Rate Limiter
 * @param req NextRequest nesnesi
 * @param limit İzin verilen maksimum istek sayısı (varsayılan: 60)
 * @param windowMs Zaman penceresi milisaniye cinsinden (varsayılan: 60000ms / 1 dakika)
 */
export function checkRateLimit(
  req: NextRequest,
  limit: number = 60,
  windowMs: number = 60 * 1000
): { success: boolean; limit: number; remaining: number; reset: number } {
  // IP tespit et
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "127.0.0.1";
  
  const endpoint = req.nextUrl.pathname;
  const key = `${ip}:${endpoint}`;
  const now = Date.now();

  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
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
