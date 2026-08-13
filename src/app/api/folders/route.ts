import { NextRequest, NextResponse } from "next/server";
import { getAllFolders, createFolder } from "@/lib/notes-service";

export async function GET() {
  try {
    const folders = await getAllFolders();
    return NextResponse.json({ folders });
  } catch (error) {
    console.error("Klasörler getirilemedi:", error);
    return NextResponse.json({ error: "Klasörler yüklenirken bir hata oluştu" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, parentId } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Klasör adı gereklidir" }, { status: 400 });
    }

    const folder = await createFolder(name.trim(), parentId || null);
    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error("Klasör oluşturulamadı:", error);
    return NextResponse.json({ error: "Klasör oluşturulurken bir hata oluştu" }, { status: 500 });
  }
}
