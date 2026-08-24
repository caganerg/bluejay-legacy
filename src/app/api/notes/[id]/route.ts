import { NextRequest, NextResponse } from "next/server";
import { getNoteById, updateNote, deleteNote } from "@/lib/notes-service";
import { updateNoteSchema } from "@/lib/validations/note";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // In in-memory mode this route parses the content of every note in the vault
  // to compute backlinks; it was the most expensive read route left unlimited.
  const rateLimit = checkRateLimit(req, 240, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid note ID" }, { status: 400 });
    }

    const note = await getNoteById(id);

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error("Failed to fetch the note details:", error);
    return NextResponse.json({ error: "Something went wrong while fetching the note" }, { status: 500 });
  }
}

export async function PUT(
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
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid note ID" }, { status: 400 });
    }

    const rawBody = await req.json();
    const parseResult = updateNoteSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid update data",
          details: parseResult.error.issues.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const updated = await updateNote(id, parseResult.data);

    if (!updated) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ note: updated });
  } catch (error) {
    console.error("Failed to update the note:", error);
    return NextResponse.json({ error: "Something went wrong while updating the note" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = checkRateLimit(req, 60, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid note ID" }, { status: 400 });
    }

    const success = await deleteNote(id);

    if (!success) {
      return NextResponse.json({ error: "The note was not found or could not be deleted" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete the note:", error);
    return NextResponse.json({ error: "Something went wrong while deleting the note" }, { status: 500 });
  }
}
