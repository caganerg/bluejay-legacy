import { NextRequest, NextResponse } from "next/server";
import { getNoteById, updateNote, deleteNote } from "@/lib/notes-service";
import { updateNoteSchema } from "@/lib/validations/note";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Geçersiz not ID'si" }, { status: 400 });
    }

    const note = await getNoteById(id);

    if (!note) {
      return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error("Not detayı getirilemedi:", error);
    return NextResponse.json({ error: "Not getirilirken bir hata oluştu" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = checkRateLimit(req, 120, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Çok fazla güncelleme isteği gönderildi. Lütfen bekleyin." },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Geçersiz not ID'si" }, { status: 400 });
    }

    const rawBody = await req.json();
    const parseResult = updateNoteSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Geçersiz güncelleme verisi",
          details: parseResult.error.issues.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const updated = await updateNote(id, parseResult.data);

    if (!updated) {
      return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
    }

    return NextResponse.json({ note: updated });
  } catch (error) {
    console.error("Not güncellenemedi:", error);
    return NextResponse.json({ error: "Not güncellenirken bir hata oluştu" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = checkRateLimit(req, 60, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Çok fazla istek gönderildi." },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Geçersiz not ID'si" }, { status: 400 });
    }

    const success = await deleteNote(id);

    if (!success) {
      return NextResponse.json({ error: "Not bulunamadı veya silinemedi" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Not silinemedi:", error);
    return NextResponse.json({ error: "Not silinirken bir hata oluştu" }, { status: 500 });
  }
}
