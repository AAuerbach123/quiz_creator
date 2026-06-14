import { NextResponse } from "next/server";
import { parseVerlageWorkbook } from "../../lib/verlage";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Datei fehlt" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["xlsx", "xls", "ods"].includes(ext)) {
      return NextResponse.json(
        { error: `Dateiformat ".${ext}" wird nicht unterstützt. Erlaubt: .xlsx, .xls, .ods` },
        { status: 400 }
      );
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    const presets = parseVerlageWorkbook(buffer);
    if (!presets.length) {
      return NextResponse.json(
        { error: "Keine Gestaltungs-Daten gefunden. Erwartet ein Blatt mit Spalte \"Headline Schrift\"." },
        { status: 400 }
      );
    }
    return NextResponse.json({ presets });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    console.error("import-verlage error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
