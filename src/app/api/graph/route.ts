import { NextRequest, NextResponse } from "next/server";
import { getGraphData } from "@/lib/notes-service";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // The most expensive route, since it parses the content of every note in the
  // vault; left unlimited it was a cheap denial-of-service vector.
  const rateLimit = checkRateLimit(req, 60, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a little while." },
      { status: 429 }
    );
  }

  try {
    const graphData = await getGraphData();
    return NextResponse.json(graphData);
  } catch (error) {
    console.error("Failed to fetch graph data:", error);
    return NextResponse.json({ error: "Could not load the knowledge graph data" }, { status: 500 });
  }
}
