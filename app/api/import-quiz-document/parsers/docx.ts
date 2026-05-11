import mammoth from "mammoth";
import type { ParsedQuiz, ParsedQuizQuestion, QuizDocumentParser } from "./types";

const TOPIC_ALONE_RE = /^(\d+)\.\s*$/;
const TOPIC_COMBINED_RE = /^(\d+)\.\s+(\S.*)$/;
const QUESTION_RE = /^([1-5])\.\s*(\S.*)$/;
const TRAILING_PAREN_RE = /^(.*?)\s*\(([^()]*)\)\s*$/;

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function stripTrailingParen(s: string): { text: string; note?: string } {
  const m = s.match(TRAILING_PAREN_RE);
  if (m && m[1].trim()) return { text: m[1].trim(), note: m[2].trim() };
  return { text: s.trim() };
}

// A "topic header line" is either "N." alone, or "N. Title" where N > 5 (the
// latter avoids confusing it with a Q1-Q5 question line in plain-text docs).
function topicHeaderTitle(line: string): string | null {
  if (TOPIC_ALONE_RE.test(line)) return ""; // header with no inline title
  const combined = line.match(TOPIC_COMBINED_RE);
  if (combined && parseInt(combined[1], 10) > 5) return combined[2].trim();
  return null;
}

function isAnswerLine(line: string): boolean {
  if (!line) return false;
  if (QUESTION_RE.test(line)) return false;
  if (topicHeaderTitle(line) !== null) return false;
  return true;
}

async function parse(buffer: Buffer): Promise<ParsedQuiz[]> {
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value.replace(/<img[^>]*>/g, "");
  const rawParagraphs = html.match(/<p>[\s\S]*?<\/p>/g) || [];
  const lines = rawParagraphs.map(p =>
    decodeHtml(
      p.replace(/^<p>/, "").replace(/<\/p>$/, "").replace(/<[^>]+>/g, "")
    ).trim()
  );

  const quizzes: ParsedQuiz[] = [];
  let i = 0;
  const N = lines.length;

  while (i < N) {
    while (i < N && !lines[i]) i++;
    if (i >= N) break;

    const headerTitle = topicHeaderTitle(lines[i]);
    if (headerTitle === null) {
      // Not a topic header — skip stray text.
      i++;
      continue;
    }

    let topic = headerTitle;
    i++;

    // If the header had no inline title, the next non-empty non-question line
    // is the title.
    if (!topic) {
      while (i < N && !lines[i]) i++;
      if (i < N && !QUESTION_RE.test(lines[i]) && topicHeaderTitle(lines[i]) === null) {
        topic = lines[i].trim();
        i++;
      }
    }

    const questions: ParsedQuizQuestion[] = [];
    while (questions.length < 5 && i < N) {
      while (i < N && !lines[i]) i++;
      if (i >= N) break;

      const qMatch = lines[i].match(QUESTION_RE);
      if (!qMatch) break;
      i++;

      let answer = "";
      if (i < N && isAnswerLine(lines[i])) {
        answer = lines[i].trim();
        i++;
      }

      const stripped = stripTrailingParen(qMatch[2].trim());
      const q: ParsedQuizQuestion = { text: stripped.text, answer };
      if (stripped.note) q.notes = stripped.note;
      questions.push(q);
    }

    while (questions.length < 5) questions.push({ text: "", answer: "" });

    quizzes.push({
      topic: topic || `Quiz ${quizzes.length + 1}`,
      questions,
    });
  }

  return quizzes;
}

export const docxParser: QuizDocumentParser = { parse };
