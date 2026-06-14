import * as XLSX from "xlsx";
import type { ParsedQuiz, QuizDocumentParser } from "./types";
import { rowsToQuizzes } from "./rows";

// XLSX-Parser für Fragelisten. Jedes Tabellenblatt wird zu Rohzeilen gelesen und
// von der gemeinsamen Logik in ./rows.ts ausgewertet (Layouts A/B/C). Der
// Blatt-Name dient in Layout A als Quiz-Thema.

async function parse(buffer: Buffer): Promise<ParsedQuiz[]> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const quizzes: ParsedQuiz[] = [];

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<string[]>(
      wb.Sheets[sheetName],
      { header: 1, blankrows: false, defval: "" }
    ) as string[][];
    quizzes.push(...rowsToQuizzes(rows, sheetName, quizzes.length));
  }

  return quizzes;
}

export const xlsxParser: QuizDocumentParser = { parse };
