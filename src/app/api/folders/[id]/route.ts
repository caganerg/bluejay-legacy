import { NextRequest, NextResponse } from "next/server";
import { deleteFolder } from "@/lib/notes-service";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await deleteFolder(id);

    if (!success) {
      return NextResponse.json(
        { error: "Klasör bulunamadı veya silinemedi" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Klasör silinemedi:", error);
    return NextResponse.json(
      { error: "Klasör silinirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
