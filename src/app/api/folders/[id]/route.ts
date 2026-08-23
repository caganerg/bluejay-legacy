import { NextRequest, NextResponse } from "next/server";
import { deleteFolder, updateFolder } from "@/lib/notes-service";
import { updateFolderSchema } from "@/lib/validations/note";
import { checkRateLimit } from "@/lib/rate-limit";

export async function PATCH(
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
    const rawBody = await req.json();
    const parseResult = updateFolderSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Geçersiz klasör verisi",
          details: parseResult.error.issues.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const updated = await updateFolder(id, parseResult.data);

    if (updated === "cycle") {
      return NextResponse.json(
        { error: "Bir klasör kendi alt klasörünün içine taşınamaz" },
        { status: 400 }
      );
    }

    if (!updated) {
      return NextResponse.json({ error: "Klasör bulunamadı" }, { status: 404 });
    }

    return NextResponse.json({ folder: updated });
  } catch (error) {
    console.error("Klasör güncellenemedi:", error);
    return NextResponse.json(
      { error: "Klasör güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = checkRateLimit(req, 60, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Çok fazla istek gönderildi. Lütfen bekleyin." },
      { status: 429 }
    );
  }

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
