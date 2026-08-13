import { NextRequest, NextResponse } from "next/server";
import { getAllNotes, createNote } from "@/lib/notes-service";

export async function GET() {
  try {
    const notes = await getAllNotes();
    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Notlar getirilemedi:", error);
    return NextResponse.json({ error: "Notlar yüklenirken bir hata oluştu" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, content, folderId } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Not başlığı gereklidir" }, { status: 400 });
    }

    const newNote = await createNote({ title, content, folderId });
    return NextResponse.json({ note: newNote }, { status: 201 });
  } catch (error) {
    console.error("Not oluşturulamadı:", error);
    return NextResponse.json({ error: "Not oluşturulurken bir hata oluştu" }, { status: 500 });
  }
}
