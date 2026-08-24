import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Oturum "epoch"u — sunucu tarafında oturum iptalini mümkün kılan tek durum.
 *
 * Neden gerekli: oturum jetonu kendi kendini doğrulayan imzalı bir değerdi ve
 * sunucu hiçbir şey saklamadığı için ÇIKIŞ YAPMAK JETONU GEÇERSİZ KILMIYORDU.
 * `/api/auth/logout` yalnızca isteği yapanın çerezini düşürüyordu; jetonun bir
 * kopyasını ele geçiren biri `exp`'e kadar (varsayılan 7 gün) erişmeye devam
 * edebiliyordu. "Kasayı Kilitle" düğmesi gerçekte hiçbir şeyi kilitlemiyordu.
 *
 * Epoch imza anahtarına karışıyor (bkz. `signingKey`, src/lib/auth.ts): epoch
 * döndüğü anda daha önce verilmiş bütün jetonların imzası geçersiz olur.
 *
 * Neden dosyada: bu değeri hem `proxy.ts` hem de API rotaları okuyor. Next
 * dokümanı proxy'nin uygulama koduyla modül/global paylaşmasına güvenilmemesi
 * gerektiğini söylüyor (node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/proxy.md), dolayısıyla süreç içi bir değişken yetmez.
 * Dosya ayrıca yeniden başlatmaya da dayanır — bellekte tutulsaydı sunucu her
 * yeniden başladığında iptal edilmiş jetonlar tekrar geçerli hâle gelirdi.
 *
 * Not: `rate-limit.ts` ile aynı sınırlama geçerli — çok örnekli bir dağıtımda
 * bu dosyanın örnekler arasında paylaşılan bir birimde durması gerekir.
 */

const stateDir = process.env.BLUEJAY_STATE_DIR ?? path.join(process.cwd(), ".bluejay");
const epochFile = path.join(stateDir, "session-epoch");

function newEpoch(): string {
  return randomBytes(24).toString("base64url");
}

function persist(value: string): void {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  writeFileSync(epochFile, value, { encoding: "utf8", mode: 0o600 });
}

/**
 * Geçerli epoch. Dosya yoksa (ilk çalıştırma) üretilip yazılır.
 *
 * Her istekte diskten okunuyor; ölçtüğümde 4 µs sürüyor, yani önbelleğe almaya
 * değmez. Önbelleksiz olması aynı zamanda doğruluk açısından iyi: çıkışın
 * ardından bayat bir epoch'la doğrulama yapılan bir pencere hiç oluşmuyor.
 */
export function currentSessionEpoch(): string {
  try {
    const value = readFileSync(epochFile, "utf8").trim();
    if (value) return value;
  } catch {
    // Dosya yok ya da okunamadı; aşağıda yeniden üretiliyor.
  }

  const value = newEpoch();
  persist(value);
  return value;
}

/**
 * Yeni bir epoch üretir; verilmiş bütün oturum jetonlarını anında geçersiz kılar.
 * Çıkışta çağrılır.
 */
export function rotateSessionEpoch(): void {
  persist(newEpoch());
}
