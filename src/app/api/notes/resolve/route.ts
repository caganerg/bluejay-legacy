import { NextRequest, NextResponse } from "next/server";
import { findOrCreateNoteByTitle } from "@/lib/notes-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, sourceNoteTitle } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Not başlığı gereklidir" },
        { status: 400 }
      );
    }

    const result = await findOrCreateNoteByTitle(title, sourceNoteTitle);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Not çözümlenemedi veya oluşturulamadı:", error);
    return NextResponse.json(
      { error: "Not çözümlenirken veya oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
