import mammoth from "mammoth";
import type { ParsedQuiz, ParsedQuizQuestion, QuizDocumentParser } from "./types";

const HEADER_RE = /^<p>\s*<strong>(\d+)\.\s*<\/strong>\s*<\/p>$/;
const ALL_BOLD_RE = /^<p>\s*(<strong>[\s\S]*?<\/strong>\s*)+<\/p>$/;
const ALL_ITALIC_RE = /^<p>\s*(<em>[\s\S]*?<\/em>\s*)+<\/p>$/;
const QUESTION_LEAD_RE = /^\d+\.\s*/;
const TRAILING_PAREN_RE = /^(.*?)\s*\(([^()]*)\)\s*$/;

type ParaKind = "header" | "topic" | "question" | "answer" | "empty" | "unknown";
type Para = { kind: ParaKind; plain: string; quizNumber?: number };

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function classify(p: string): Para {
  const headerMatch = p.match(HEADER_RE);
  if (headerMatch) {
    return { kind: "header", plain: "", quizNumber: parseInt(headerMatch[1], 10) };
  }
  const inner = p.replace(/^<p>/, "").replace(/<\/p>$/, "");
  if (!inner.replace(/<[^>]+>/g, "").trim()) {
    return { kind: "empty", plain: "" };
  }
  const plain = decodeHtml(inner.replace(/<[^>]+>/g, "")).trim();
  if (ALL_BOLD_RE.test(p)) return { kind: "topic", plain };
  if (ALL_ITALIC_RE.test(p)) return { kind: "answer", plain };
  if (QUESTION_LEAD_RE.test(plain)) return { kind: "question", plain };
  return { kind: "unknown", plain };
}

function stripTrailingParen(s: string): { text: string; note?: string } {
  const m = s.match(TRAILING_PAREN_RE);
  if (m && m[1].trim()) return { text: m[1].trim(), note: m[2].trim() };
  return { text: s.trim() };
}

function appendNote(existing: string | undefined, note: string): string {
  return existing ? `${existing}; ${note}` : note;
}

async function parse(buffer: Buffer): Promise<ParsedQuiz[]> {
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value.replace(/<img[^>]*>/g, "");
  const paragraphs = html.match(/<p>[\s\S]*?<\/p>/g) || [];
  const classified = paragraphs.map(classify);

  const quizzes: ParsedQuiz[] = [];
  let i = 0;
  while (i < classified.length) {
    if (classified[i].kind !== "header") { i++; continue; }
    const headerNumber = classified[i].quizNumber;

    let j = i + 1;
    while (j < classified.length && classified[j].kind === "empty") j++;

    let topic = "";
    if (j < classified.length && classified[j].kind === "topic") {
      topic = classified[j].plain;
      j++;
    }

    const questions: ParsedQuizQuestion[] = [];
    let pending: ParsedQuizQuestion | null = null;
    while (j < classified.length && classified[j].kind !== "header") {
      const c = classified[j];
      if (c.kind === "question") {
        if (pending) questions.push(pending);
        const stripped = stripTrailingParen(c.plain.replace(QUESTION_LEAD_RE, "").trim());
        pending = { text: stripped.text, answer: "" };
        if (stripped.note) pending.notes = stripped.note;
      } else if (c.kind === "answer" && pending) {
        const stripped = stripTrailingParen(c.plain);
        pending.answer = stripped.text;
        if (stripped.note) pending.notes = appendNote(pending.notes, stripped.note);
        questions.push(pending);
        pending = null;
      }
      j++;
    }
    if (pending) questions.push(pending);

    const padded: ParsedQuizQuestion[] = [];
    for (let k = 0; k < 5; k++) {
      padded.push(questions[k] || { text: "", answer: "" });
    }

    quizzes.push({
      topic: topic || (headerNumber ? `Quiz ${headerNumber}` : `Quiz ${quizzes.length + 1}`),
      questions: padded,
    });
    i = j;
  }

  return quizzes;
}

export const docxParser: QuizDocumentParser = { parse };
