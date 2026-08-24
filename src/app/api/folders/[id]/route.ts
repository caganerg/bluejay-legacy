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
      { error: "Too many update requests. Please wait a moment." },
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
          error: "Invalid folder data",
          details: parseResult.error.issues.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const updated = await updateFolder(id, parseResult.data);

    if (updated === "cycle") {
      return NextResponse.json(
        { error: "A folder cannot be moved inside one of its own subfolders" },
        { status: 400 }
      );
    }

    if (!updated) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return NextResponse.json({ folder: updated });
  } catch (error) {
    console.error("Failed to update the folder:", error);
    return NextResponse.json(
      { error: "Something went wrong while updating the folder" },
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
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const success = await deleteFolder(id);

    if (!success) {
      return NextResponse.json(
        { error: "The folder was not found or could not be deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete the folder:", error);
    return NextResponse.json(
      { error: "Something went wrong while deleting the folder" },
      { status: 500 }
    );
  }
}
