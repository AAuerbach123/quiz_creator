import { NextResponse } from "next/server";
import { docxParser } from "./parsers/docx";
import { xlsxParser } from "./parsers/xlsx";
import { csvParser } from "./parsers/csv";
import type { QuizDocumentParser } from "./parsers/types";

export const runtime = "nodejs";

// Parser-Registry. Weitere Formate hier eintragen — Interface
// `QuizDocumentParser` in ./parsers/types.ts implementieren.
const parsers: Record<string, QuizDocumentParser> = {
  docx: docxParser,
  xlsx: xlsxParser,
  xlsm: xlsxParser,
  xls: xlsxParser,
  csv: csvParser,
  tsv: csvParser,
};

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
    const parser = parsers[ext];
    if (!parser) {
      const supported = Object.keys(parsers).map(e => `.${e}`).join(", ");
      return NextResponse.json(
        { error: `Dateiformat ".${ext}" wird nicht unterstützt. Aktuell: ${supported}` },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const quizzes = await parser.parse(buffer);
    return NextResponse.json({ quizzes });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    console.error("import-quiz-document error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
