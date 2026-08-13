import { NextRequest, NextResponse } from "next/server";
import { getNoteById, updateNote, deleteNote } from "@/lib/notes-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, content, folderId, isPinned, isArchived } = body;

    const updated = await updateNote(id, {
      title,
      content,
      folderId,
      isPinned,
      isArchived,
    });

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
  try {
    const { id } = await params;
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
