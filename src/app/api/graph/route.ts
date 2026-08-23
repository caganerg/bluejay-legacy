import { NextRequest, NextResponse } from "next/server";
import { getGraphData } from "@/lib/notes-service";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // Kasadaki bütün notların içeriğini ayrıştırdığı için en pahalı rota;
  // sınırsız bırakıldığında ucuz bir hizmet dışı bırakma vektörüydü.
  const rateLimit = checkRateLimit(req, 60, 60 * 1000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyin." },
      { status: 429 }
    );
  }

  try {
    const graphData = await getGraphData();
    return NextResponse.json(graphData);
  } catch (error) {
    console.error("Graph verisi getirilemedi:", error);
    return NextResponse.json({ error: "İlişki grafiği verisi alınamadı" }, { status: 500 });
  }
}
