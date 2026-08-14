import { NextRequest, NextResponse } from "next/server";
import { getAllFolders, createFolder } from "@/lib/notes-service";
import { createFolderSchema } from "@/lib/validations/note";
import { checkRateLimit } from "@/lib/rate-limit";

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
  const rateLimit = checkRateLimit(req, 60, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Çok fazla istek gönderildi. Lütfen bekleyin." },
      { status: 429 }
    );
  }

  try {
    const rawBody = await req.json();
    const parseResult = createFolderSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Geçersiz klasör verisi",
          details: parseResult.error.issues.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { name, parentId } = parseResult.data;
    const folder = await createFolder(name, parentId || null);
    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error("Klasör oluşturulamadı:", error);
    return NextResponse.json({ error: "Klasör oluşturulurken bir hata oluştu" }, { status: 500 });
  }
}
