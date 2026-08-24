import { NextRequest, NextResponse } from "next/server";
import { getAllNotes, createNote } from "@/lib/notes-service";
import { createNoteSchema } from "@/lib/validations/note";
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
    const notes = await getAllNotes();
    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Failed to fetch notes:", error);
    return NextResponse.json({ error: "Something went wrong while loading the notes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 60, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a little while." },
      { status: 429 }
    );
  }

  try {
    const rawBody = await req.json();
    const parseResult = createNoteSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid data",
          details: parseResult.error.issues.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { title, content, folderId } = parseResult.data;
    const newNote = await createNote({ title, content, folderId });
    return NextResponse.json({ note: newNote }, { status: 201 });
  } catch (error) {
    console.error("Failed to create the note:", error);
    return NextResponse.json({ error: "Something went wrong while creating the note" }, { status: 500 });
  }
}
