import { NextRequest, NextResponse } from "next/server";
import { getAllFolders, createFolder } from "@/lib/notes-service";
import { createFolderSchema } from "@/lib/validations/note";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // A route that serialises the whole vault (with the full content of every
  // note); left unlimited it is a cheap denial-of-service vector.
  const rateLimit = checkRateLimit(req, 240, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const folders = await getAllFolders();
    return NextResponse.json({ folders });
  } catch (error) {
    console.error("Failed to fetch folders:", error);
    return NextResponse.json({ error: "Something went wrong while loading the folders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 60, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const rawBody = await req.json();
    const parseResult = createFolderSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid folder data",
          details: parseResult.error.issues.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { name, parentId } = parseResult.data;
    const folder = await createFolder(name, parentId || null);
    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error("Failed to create the folder:", error);
    return NextResponse.json({ error: "Something went wrong while creating the folder" }, { status: 500 });
  }
}
