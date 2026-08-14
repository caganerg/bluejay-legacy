import { NextRequest, NextResponse } from "next/server";
import { searchNotes } from "@/lib/notes-service";
import { searchQuerySchema } from "@/lib/validations/note";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // Arama için hafif rate limiting (dakikada 180 arama)
  const rateLimit = checkRateLimit(req, 180, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Çok fazla arama isteği. Lütfen biraz bekleyin." },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get("q") || "";

    const parseResult = searchQuerySchema.safeParse({ q: rawQuery });
    const query = parseResult.success ? parseResult.data.q : "";

    const results = await searchNotes(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Arama hatası:", error);
    return NextResponse.json({ error: "Arama sırasında bir hata oluştu" }, { status: 500 });
  }
}
