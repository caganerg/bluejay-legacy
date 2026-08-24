import { NextRequest, NextResponse } from "next/server";
import { findOrCreateNoteByTitle } from "@/lib/notes-service";
import { resolveNoteSchema } from "@/lib/validations/note";
import { checkRateLimit } from "@/lib/rate-limit";

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
    const parseResult = resolveNoteSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid data",
          details: parseResult.error.issues.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { title, sourceNoteTitle } = parseResult.data;
    const result = await findOrCreateNoteByTitle(title, sourceNoteTitle);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to resolve or create the note:", error);
    return NextResponse.json(
      { error: "Something went wrong while resolving or creating the note" },
      { status: 500 }
    );
  }
}
