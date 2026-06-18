import { NextResponse } from "next/server";

// Holt die Anmerkungen/Änderungswünsche aus dem Live-Korrekturportal.
// Serverseitig, damit es kein CORS-Problem im Browser gibt.
// g=be5ff27040 ist der interne MASTER-Schlüssel ("alle Gruppen").
export const dynamic = "force-dynamic";

const PORTAL_ALL = "https://quiz-review.pages.dev/api/comments?g=be5ff27040";

export async function GET() {
  try {
    const r = await fetch(PORTAL_ALL, { cache: "no-store" });
    const j = await r.json();
    return NextResponse.json(
      { comments: j.comments || [] },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json({ comments: [], error: String(e) });
  }
}
