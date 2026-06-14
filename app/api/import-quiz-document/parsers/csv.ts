import type { ParsedQuiz, QuizDocumentParser } from "./types";
import { rowsToQuizzes } from "./rows";

// CSV-/TSV-Parser für Fragelisten. Liest die Datei zu Rohzeilen (string[][]) und
// übergibt sie an die gemeinsame Logik in ./rows.ts (Layouts A/B/C) — CSV verhält
// sich damit exakt wie ein einzelnes Excel-Blatt.
//
// Robust gegen:
//   - BOM am Dateianfang
//   - CRLF/LF-Zeilenenden
//   - automatische Trennzeichen-Erkennung (Semikolon, Komma, Tab) — deutsche
//     Excel-Exporte nutzen meist Semikolon
//   - in Anführungszeichen eingeschlossene Felder mit Trennzeichen, Zeilen-
//     umbrüchen und verdoppelten Anführungszeichen ("") als Escape

function detectDelimiter(sample: string): string {
  // Erste echte (nicht in Quotes liegende) Zeile betrachten und das häufigste
  // der Kandidaten-Trennzeichen wählen.
  const firstLine = sample.split(/\r?\n/).find(l => l.trim().length > 0) ?? "";
  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestCount = -1;
  for (const d of candidates) {
    let count = 0, inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) { bestCount = count; best = d; }
  }
  return best;
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // verdoppeltes Quote = ein "
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delimiter) { row.push(field); field = ""; continue; }
    if (ch === "\r") { continue; } // CR ignorieren, Zeilenende über \n
    if (ch === "\n") { row.push(field); rows.push(row); field = ""; row = []; continue; }
    field += ch;
  }
  // Letztes Feld/letzte Zeile, falls keine abschließende Newline.
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  // Komplett leere Zeilen verwerfen (z. B. Trenn-Leerzeilen).
  return rows.filter(r => r.some(c => c.trim() !== ""));
}

async function parse(buffer: Buffer): Promise<ParsedQuiz[]> {
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM entfernen
  const delimiter = detectDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  return rowsToQuizzes(rows, "", 0);
}

export const csvParser: QuizDocumentParser = { parse };
