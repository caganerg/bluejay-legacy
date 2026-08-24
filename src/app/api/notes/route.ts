import { NextRequest, NextResponse } from "next/server";
import { getAllNotes, createNote } from "@/lib/notes-service";
import { createNoteSchema } from "@/lib/validations/note";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // Kasanın tamamını (bütün notların tam içeriğiyle) serileştiren rota;
  // limitsiz bırakıldığında ucuz bir hizmet dışı bırakma vektörü.
  const rateLimit = checkRateLimit(req, 240, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Çok fazla istek gönderildi. Lütfen bekleyin." },
      { status: 429 }
    );
  }

  try {
    const notes = await getAllNotes();
    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Notlar getirilemedi:", error);
    return NextResponse.json({ error: "Notlar yüklenirken bir hata oluştu" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 60, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyin." },
      { status: 429 }
    );
  }

  try {
    const rawBody = await req.json();
    const parseResult = createNoteSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Geçersiz veri",
          details: parseResult.error.issues.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { title, content, folderId } = parseResult.data;
    const newNote = await createNote({ title, content, folderId });
    return NextResponse.json({ note: newNote }, { status: 201 });
  } catch (error) {
    console.error("Not oluşturulamadı:", error);
    return NextResponse.json({ error: "Not oluşturulurken bir hata oluştu" }, { status: 500 });
  }
}
