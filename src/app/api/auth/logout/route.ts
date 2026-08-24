import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { rotateSessionEpoch } from "@/lib/session-store";

export async function POST() {
  // Oturum epoch'unu döndür: bu, verilmiş BÜTÜN jetonların imzasını geçersiz
  // kılar. Eskiden burada yalnızca çerez düşürülüyordu; jetonun kopyasını
  // ele geçiren biri `exp`'e kadar (varsayılan 7 gün) erişmeye devam ediyordu,
  // yani "Kasayı Kilitle" gerçekte hiçbir şeyi kilitlemiyordu.
  //
  // Hata yutulmuyor: epoch yazılamadıysa kilitleme GERÇEKLEŞMEMİŞTİR ve bunu
  // sessizce başarılı göstermek tam da düzeltilen hatanın kendisi olurdu.
  try {
    rotateSessionEpoch();
  } catch (error) {
    console.error("Oturum epoch'u döndürülemedi:", error);
    return NextResponse.json(
      {
        error:
          "Kasa kilitlenemedi: oturum durumu yazılamıyor. BLUEJAY_STATE_DIR yazılabilir olmalı.",
      },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ ok: true });
  // maxAge 0: çerezi hemen düşür.
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
