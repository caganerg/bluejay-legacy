import { NextRequest, NextResponse } from "next/server";
import { searchNotes } from "@/lib/notes-service";
import { searchQuerySchema } from "@/lib/validations/note";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // Light rate limiting for search (180 searches per minute)
  const rateLimit = checkRateLimit(req, 180, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many search requests. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get("q") || "";

    const parseResult = searchQuerySchema.safeParse({ q: rawQuery });
    const query = parseResult.success ? parseResult.data.q : "";

    const results = await searchNotes(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Something went wrong during the search" }, { status: 500 });
  }
}
