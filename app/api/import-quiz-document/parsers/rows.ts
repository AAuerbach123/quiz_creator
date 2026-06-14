import type { ParsedQuiz, ParsedQuizQuestion } from "./types";

// Gemeinsame Tabellen-Logik für alle zeilenbasierten Formate (XLSX, CSV, TSV …).
// Wandelt einen Block roher Zeilen (string[][]) in Quizze um und erkennt drei
// gängige Layouts:
//   Layout B — alles in einem Block:
//      Spalten "Thema" | "Frage 1" | "Antwort 1" | … | "Frage 5" | "Antwort 5",
//      jede Datenzeile ist ein komplettes Quiz.
//   Layout C — Frageblock-Format ohne Header (Themen-Nr. in Spalte A,
//      Thema in Spalte B, Frage/Antwort in Spalte C/D).
//   Layout A — ein Quiz je Block, zwei Spalten Frage + Antwort (mit oder ohne
//      Header). Als Thema dient `sheetName` (bei CSV der Dateiname o. Fallback).
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

/**
 * Wandelt einen Block Zeilen in Quizze um.
 * @param rows         Rohzeilen (string[][]).
 * @param sheetName    Name des Blocks (Excel-Blattname / CSV-Dateiname); dient
 *                     in Layout A als Thema.
 * @param existingCount Anzahl bereits erkannter Quizze davor — nur für die
 *                     fortlaufende Fallback-Benennung ("Quiz N").
 */
export function rowsToQuizzes(
  rows: string[][],
  sheetName: string,
  existingCount: number
): ParsedQuiz[] {
  const quizzes: ParsedQuiz[] = [];
  const nextName = () => `Quiz ${existingCount + quizzes.length + 1}`;
  if (!rows.length) return quizzes;

  const header = rows[0].map(c => String(c ?? ""));

  // Layout B prüfen: Frage 1 + Antwort 1 als Spalten vorhanden.
  const iF1 = colIndex(header, "frage 1", "frage1", "f1", "q1", "question 1");
  const iA1 = colIndex(header, "antwort 1", "antwort1", "a1", "answer 1");
  const iTopic = colIndex(header, "thema", "topic", "titel", "title");

  if (iF1 >= 0 && iA1 >= 0) {
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const topic = iTopic >= 0 ? String(row[iTopic] ?? "").trim() : nextName();
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
    return quizzes;
  }

  // Layout C — Frageblock-Format (kein Header, alles in einem Block):
  //   Spalte A: Themen-Nr. (z. B. "1.0") NUR in der Themen-Startzeile —
  //     die Nummer ist der verlässliche Themen-Marker.
  //   Spalte B: Themen-Name in der Startzeile. ACHTUNG: In anderen Zeilen
  //     können dort HINWEISE stehen (z. B. "Bild vom, siehe Lösungswort").
  //     Die dürfen KEIN neues Thema starten — sie werden als Notiz an die
  //     Frage der Zeile gehängt.
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
          currentTopic = topicCell || nextName();
          currentQuestions = [];
        }
        if (qCell || aCell) {
          // Spalte-B-Text in Nicht-Startzeilen = Hinweis zur Frage.
          const note = !startsTopic && topicCell ? topicCell : undefined;
          currentQuestions.push({ text: qCell, answer: aCell, ...(note ? { notes: note } : {}) });
        }
      }
      flush();
      return quizzes;
    }
  }

  // Layout A: ein Quiz je Block, 2 Spalten Frage + Antwort.
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
      quizzes.push({ topic: sheetName.trim() || nextName(), questions });
    }
    return quizzes;
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
        quizzes.push({ topic: sheetName.trim() || nextName(), questions });
      }
    }
  }

  return quizzes;
}
