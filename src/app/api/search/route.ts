import { NextRequest, NextResponse } from "next/server";
import { searchNotes } from "@/lib/notes-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    const results = await searchNotes(q);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Arama hatası:", error);
    return NextResponse.json({ error: "Arama sırasında bir hata oluştu" }, { status: 500 });
  }
}
