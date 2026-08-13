import { NextResponse } from "next/server";
import { getGraphData } from "@/lib/notes-service";

export async function GET() {
  try {
    const graphData = await getGraphData();
    return NextResponse.json(graphData);
  } catch (error) {
    console.error("Graph verisi getirilemedi:", error);
    return NextResponse.json({ error: "İlişki grafiği verisi alınamadı" }, { status: 500 });
  }
}
