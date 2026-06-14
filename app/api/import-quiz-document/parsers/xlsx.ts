import * as XLSX from "xlsx";
import type { ParsedQuiz, ParsedQuizQuestion, QuizDocumentParser } from "./types";

// XLSX-Parser für Fragelisten. Erkennt zwei gängige Layouts:
//   Layout A — pro Tabellenblatt ein Quiz:
//      - Blatt-Name = Quiz-Thema
//      - Spalte "Frage" / "Question" und Spalte "Antwort" / "Answer"
//      - bis zu 5 Datenzeilen
//   Layout B — alle Quizze in einem Blatt:
//      - Spalten "Thema" | "Frage 1" | "Antwort 1" | … | "Frage 5" | "Antwort 5"
//      - jede Datenzeile ist ein komplettes Quiz
//
// Tippfehler, andere Bindestriche und Schreibvarianten (Frage1, Frage 1, F1, Q1)
// werden über Teilstring-Matching toleriert.

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

function colIndex(header: string[], ...needles: string[]): number {
  for (let i = 0; i < header.length; i++) {
    const h = norm(header[i]);
    if (needles.some(n => h === norm(n) || h.includes(norm(n)))) return i;
  }
  return -1;
}

function emptyQuestion(): ParsedQuizQuestion { return { text: "", answer: "" }; }

async function parse(buffer: Buffer): Promise<ParsedQuiz[]> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const quizzes: ParsedQuiz[] = [];

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<string[]>(
      wb.Sheets[sheetName],
      { header: 1, blankrows: false, defval: "" }
    ) as string[][];
    if (!rows.length) continue;

    const header = rows[0].map(c => String(c ?? ""));

    // Layout B prüfen: Frage 1 + Antwort 1 als Spalten vorhanden.
    const iF1 = colIndex(header, "frage 1", "frage1", "f1", "q1", "question 1");
    const iA1 = colIndex(header, "antwort 1", "antwort1", "a1", "answer 1");
    const iTopic = colIndex(header, "thema", "topic", "titel", "title");

    if (iF1 >= 0 && iA1 >= 0) {
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const topic = iTopic >= 0 ? String(row[iTopic] ?? "").trim() : `Quiz ${quizzes.length + 1}`;
        const questions: ParsedQuizQuestion[] = [];
        for (let i = 1; i <= 5; i++) {
          const iF = colIndex(header, `frage ${i}`, `frage${i}`, `f${i}`, `q${i}`, `question ${i}`);
          const iA = colIndex(header, `antwort ${i}`, `antwort${i}`, `a${i}`, `answer ${i}`);
          const text = iF >= 0 ? String(row[iF] ?? "").trim() : "";
          const answer = iA >= 0 ? String(row[iA] ?? "").trim() : "";
          questions.push({ text, answer });
        }
        while (questions.length < 5) questions.push(emptyQuestion());
        if (topic && questions.some(q => q.text)) {
          quizzes.push({ topic, questions });
        }
      }
      continue;
    }

    // Layout C — Frageblock-Format (kein Header, alles in einem Blatt):
    //   Spalte A: Themen-Nr. (z. B. "1.0") NUR in der Themen-Startzeile —
    //     die Nummer ist der verlässliche Themen-Marker.
    //   Spalte B: Themen-Name in der Startzeile. ACHTUNG: In anderen Zeilen
    //     können dort HINWEISE stehen (z. B. "Bild vom, siehe Lösungswort").
    //     Die dürfen KEIN neues Thema starten — sie werden als Notiz an die
    //     Frage der Zeile gehängt. (Genau dieser Fall hat früher die Themen
    //     zerrissen: Fragen verrutschten und die Bilder entstanden aus den
    //     falschen Antworten.)
    //   Spalte C: Frage. Spalte D: Antwort. Spalten E+ : Antwort-Alternativen
    //     (für die Hotline relevant, hier ignoriert).
    {
      const cNum = 0, cTopic = 1, cQuestion = 2, cAnswer = 3;
      const isNum = (s: string) => !!s && Number.isFinite(parseFloat(s.replace(",", ".")));
      let numMarkers = 0, topicMarkers = 0, longQuestions = 0;
      for (let r = 0; r < Math.min(rows.length, 12); r++) {
        if (isNum(String(rows[r]?.[cNum] ?? "").trim())) numMarkers++;
        if (String(rows[r]?.[cTopic] ?? "").trim()) topicMarkers++;
        if (String(rows[r]?.[cQuestion] ?? "").trim().length > 5) longQuestions++;
      }
      // Bevorzugt die Themen-Nummern in Spalte A als Marker; nur wenn es
      // dort keine gibt, fällt die Erkennung auf "Spalte B gefüllt" zurück.
      const useNumMarker = numMarkers >= 1;
      const markers = useNumMarker ? numMarkers : topicMarkers;
      if (markers >= 1 && longQuestions >= markers * 3) {
        let currentTopic = "";
        let currentQuestions: ParsedQuizQuestion[] = [];
        const flush = () => {
          if (currentTopic && currentQuestions.some(q => q.text)) {
            while (currentQuestions.length < 5) currentQuestions.push(emptyQuestion());
            quizzes.push({ topic: currentTopic, questions: currentQuestions.slice(0, 5) });
          }
        };
        for (let r = 0; r < rows.length; r++) {
          const numCell = String(rows[r]?.[cNum] ?? "").trim();
          const topicCell = String(rows[r]?.[cTopic] ?? "").trim();
          const qCell = String(rows[r]?.[cQuestion] ?? "").trim();
          const aCell = String(rows[r]?.[cAnswer] ?? "").trim();
          const startsTopic = useNumMarker ? isNum(numCell) : !!topicCell;
          if (startsTopic) {
            flush();
            currentTopic = topicCell || `Quiz ${quizzes.length + 1}`;
            currentQuestions = [];
          }
          if (qCell || aCell) {
            // Spalte-B-Text in Nicht-Startzeilen = Hinweis zur Frage.
            const note = !startsTopic && topicCell ? topicCell : undefined;
            currentQuestions.push({ text: qCell, answer: aCell, ...(note ? { notes: note } : {}) });
          }
        }
        flush();
        continue;
      }
    }

    // Layout A: pro Blatt ein Quiz, 2 Spalten Frage + Antwort.
    const iFrage = colIndex(header, "frage", "question");
    const iAntw = colIndex(header, "antwort", "answer", "lösung", "loesung");
    if (iFrage >= 0 && iAntw >= 0) {
      const questions: ParsedQuizQuestion[] = [];
      for (let r = 1; r < rows.length && questions.length < 5; r++) {
        const text = String(rows[r][iFrage] ?? "").trim();
        const answer = String(rows[r][iAntw] ?? "").trim();
        if (!text && !answer) continue;
        questions.push({ text, answer });
      }
      while (questions.length < 5) questions.push(emptyQuestion());
      if (questions.some(q => q.text)) {
        quizzes.push({ topic: sheetName.trim() || `Quiz ${quizzes.length + 1}`, questions });
      }
      continue;
    }

    // Fallback Layout A ohne Header: nimmt die ersten beiden Spalten als
    // Frage/Antwort an, wenn die erste Zeile nicht nach Header aussieht.
    if (header.length >= 2 && !iFrage && !iAntw && !iF1) {
      const looksLikeData = !!(rows[0][0] && rows[0][1]) && !norm(rows[0][0]).includes("frage") && !norm(rows[0][0]).includes("question");
      if (looksLikeData) {
        const questions: ParsedQuizQuestion[] = [];
        for (let r = 0; r < rows.length && questions.length < 5; r++) {
          const text = String(rows[r][0] ?? "").trim();
          const answer = String(rows[r][1] ?? "").trim();
          if (!text && !answer) continue;
          questions.push({ text, answer });
        }
        while (questions.length < 5) questions.push(emptyQuestion());
        if (questions.some(q => q.text)) {
          quizzes.push({ topic: sheetName.trim() || `Quiz ${quizzes.length + 1}`, questions });
        }
      }
    }
  }

  return quizzes;
}

export const xlsxParser: QuizDocumentParser = { parse };
