import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Hilfs-Route (nur lokal): nimmt ein Base64-Bild entgegen und legt es unter
// public/_bat/<name>.png ab, damit generierte Bilder auf der Platte landen.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { name, dataUrl } = await req.json();
    if (!name || !dataUrl || typeof dataUrl !== "string") {
      return NextResponse.json({ error: "name/dataUrl fehlt" }, { status: 400 });
    }
    const safe = String(name).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "img";
    const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const dir = path.join(process.cwd(), "public", "_bat");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${safe}.png`);
    await fs.writeFile(file, Buffer.from(b64, "base64"));
    return NextResponse.json({ ok: true, file: `/_bat/${safe}.png` });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
