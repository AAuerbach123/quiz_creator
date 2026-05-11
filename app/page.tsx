"use client";

import { useState, useReducer, useEffect, useRef, useLayoutEffect, Fragment } from "react";
import { Plus, Trash2, Undo2, Redo2, Download, Upload, ChevronDown, ChevronRight, Sparkles, Loader2, X, Wand2, Settings, RotateCcw, Eye, Lightbulb, FileText } from "lucide-react";
import type { ParsedQuiz } from "./api/import-quiz-document/parsers/types";

// ============================================================
// TYPES
// ============================================================
type AnswerType = "choice" | "text";
type Difficulty = "easy" | "medium" | "hard";
type Question = {
  id: string; text: string; answerType: AnswerType;
  options?: string[]; correctAnswer: string;
  prizeTierId: string; phoneNumber?: string; timeLimitSeconds?: number;
};
type PrizeTier = { id: string; valueCents: number; currency: "EUR" | "CHF"; label?: string | null };
type Readability = {
  scrim: number;
  textShadow: number;
  blockBackdrop: "none" | "subtle" | "strong";
};
type Quiz = {
  id: string; version: 1;
  meta: {
    title: string;
    titleAuto: boolean;
    subtitle: string;
    publisher: string;
    language: string;
    winnersText: string;
    termsText: string;
    phoneTermsText: string;
  };
  theme: {
    fontFamily: string;
    colors: Record<string, string>;
    fontSizes: Record<string, number>;
    background: { image: string | null; opacity: number; position: { x: number; y: number } };
    readability: Readability;
  };
  layout: { format: string; orientation: string };
  prizes: PrizeTier[];
  questions: Question[];
  participation: { costPerEntryCents: number; freeEntryMethod?: { type: string; address: string; description: string } | null; drawDate: string; maxEntriesPerUser: number | null };
};

const DEFAULT_TEXT_STYLE = `Schreibe in einem freundlichen, einladenden Ton, der typisch für deutsche Lokal-Zeitungen ist.
Bleibe bei Sie-Form. Vermeide Anglizismen. Fragen kurz und prägnant, max. 8 Wörter.

Theme-Farben (titleColor, prizeColor, questionColor) müssen nach WCAG 2.1 Level AA lesbar sein,
idealerweise AAA. Statt reinem Schwarz #000000 dunkles Grau wie #1A1A1A verwenden.
Keine direkten Rot/Grün-Komplementärkontraste (Protanopie/Deuteranopie). Keine grellen
Komplementär-Kombinationen wie Blau auf Orange. Sättigung moderat, nicht vibrierend.

Wichtig: titleColor und questionColor sollen HELL sein, weil der Text auf einem
fotografischen Hintergrund mit Verdunkelung sitzt. prizeColor darf akzentuiert sein.`;

const DEFAULT_IMAGE_STYLE = `Photorealistic newspaper-cover illustration. ONE single coherent scene with deliberate composition for text overlay.

CRITICAL: SINGLE-SCENE COMPOSITION
- This is ONE photograph of ONE place at ONE moment, NOT multiple images
- All listed topics must appear in the SAME continuous landscape/scene
- NO split-screen, NO diptych, NO collage, NO seam down the middle

LIGHTING — FULL DIRECT SUNLIGHT:
- BRIGHT MIDDAY SUN — clear blue cloudless sky, sun high overhead
- Crisp tourist-photo lighting, bright vivid colors
- ABSOLUTELY FORBIDDEN: golden hour, sunset, dusk, twilight, blue hour
- ABSOLUTELY FORBIDDEN: moody, atmospheric, cinematic, dim, shadowy

LAYOUT FOR TEXT OVERLAY:
- Subject focus in lower or center third
- Upper third: bright clear sky for text overlay

FORBIDDEN:
- No text, logos, watermarks, signage
- No collages, no split-screens`;

const STYLE_TEXT_KEY = "wq.styleText";
const STYLE_IMAGE_KEY = "wq.styleImage";
const DIFFICULTY_KEY = "wq.difficulty";

const FORMATS: Record<string, Record<string, { w: number; h: number }>> = {
  a4: { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } },
  berliner_halbformat: { landscape: { w: 315, h: 235 }, portrait: { w: 235, h: 315 } },
  a5: { portrait: { w: 148, h: 210 }, landscape: { w: 210, h: 148 } },
  // Visuelle Layout-Vorlage. Größe ist immer A4 portrait, Orientation-Selector
  // wird beim Wechsel hierher auf "portrait" gezwungen.
  schwedenraetsel: { portrait: { w: 210, h: 297 }, landscape: { w: 210, h: 297 } }
};

const defaultQuiz: Quiz = {
  id: "quiz_new",
  version: 1,
  meta: {
    title: "",
    titleAuto: false,
    subtitle: "",
    publisher: "",
    language: "de",
    winnersText: "",
    termsText: "",
    phoneTermsText: ""
  },
  theme: {
    fontFamily: "Georgia, serif",
    colors: { title: "#FFFFFF", intro: "#F5F5F5", prize: "#FFD27A", question: "#FFFFFF", phone: "#FFD27A", winners: "#F0F0F0", terms: "#F0F0F0" },
    fontSizes: { title: 80, intro: 32, prize: 46, question: 52, phone: 36, telemedia: 11, winners: 13, terms: 13 },
    background: { image: null, opacity: 1, position: { x: 50, y: 50 } },
    readability: { scrim: 0.3, textShadow: 0.7, blockBackdrop: "none" }
  },
  layout: { format: "berliner_halbformat", orientation: "landscape" },
  prizes: [
    { id: "p1", valueCents: 5000, currency: "EUR", label: null },
    { id: "p2", valueCents: 10000, currency: "EUR", label: null },
    { id: "p3", valueCents: 25000, currency: "EUR", label: null },
    { id: "p4", valueCents: 50000, currency: "EUR", label: null },
    { id: "p5", valueCents: 100000, currency: "EUR", label: null }
  ],
  questions: [
    { id: "q1", text: "", answerType: "choice", options: ["", ""], correctAnswer: "", prizeTierId: "p1", phoneNumber: "01378 802721" },
    { id: "q2", text: "", answerType: "text", correctAnswer: "", prizeTierId: "p2", phoneNumber: "01378 802722" },
    { id: "q3", text: "", answerType: "text", correctAnswer: "", prizeTierId: "p3", phoneNumber: "01378 802723" },
    { id: "q4", text: "", answerType: "text", correctAnswer: "", prizeTierId: "p4", phoneNumber: "01378 802724" },
    { id: "q5", text: "", answerType: "text", correctAnswer: "", prizeTierId: "p5", phoneNumber: "01378 802725" }
  ],
  participation: {
    costPerEntryCents: 50,
    freeEntryMethod: { type: "email", address: "", description: "" },
    drawDate: "", maxEntriesPerUser: 10
  }
};

const formatCents = (c: number, cur = "EUR") => {
  const sym = cur === "EUR" ? "€" : cur === "CHF" ? "CHF" : cur;
  return `${(c / 100).toFixed(0)}${sym}`;
};
const getPrizeLabel = (p: PrizeTier) => p?.label || formatCents(p.valueCents, p.currency);
const genId = (prefix = "id") => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function deriveTitleFromQuestions(quiz: Quiz): string {
  if (!quiz.questions.length) return "";
  let bestQ = quiz.questions[0];
  let bestVal = -1;
  for (const q of quiz.questions) {
    const prize = quiz.prizes.find(p => p.id === q.prizeTierId);
    if (!prize) continue;
    if (prize.valueCents > bestVal) { bestVal = prize.valueCents; bestQ = q; }
  }
  return bestQ.text || "";
}
function effectiveTitle(quiz: Quiz): string {
  if (quiz.meta.titleAuto) return deriveTitleFromQuestions(quiz);
  return quiz.meta.title;
}

function buildTextShadow(strength: number): string {
  if (strength <= 0) return "none";
  const s = Math.min(1, Math.max(0, strength));
  const a1 = (0.85 * s).toFixed(2);
  const a2 = (0.6 * s).toFixed(2);
  const a3 = (0.4 * s).toFixed(2);
  return `0 1px 2px rgba(0,0,0,${a1}), 0 0 4px rgba(0,0,0,${a2}), 0 0 12px rgba(0,0,0,${a3})`;
}
function luminance(hex: string): number {
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m || m.length < 3) return 1;
  const [r, g, b] = m.slice(0, 3).map((h) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function isDark(hex: string): boolean { return luminance(hex) < 0.45; }

function blockBackdropContainerStyle(mode: Readability["blockBackdrop"], align: "left" | "center" | "right" = "left"): React.CSSProperties {
  if (mode === "none") return {};
  const isSubtle = mode === "subtle";
  const bg = isSubtle ? "rgba(0,0,0,0.42)" : "rgba(0,0,0,0.62)";
  const blur = isSubtle ? "blur(2px)" : "blur(3px)";
  return {
    display: "inline-block",
    backgroundColor: bg,
    padding: isSubtle ? "4px 12px" : "8px 16px",
    borderRadius: 6,
    backdropFilter: blur,
    WebkitBackdropFilter: blur,
    textAlign: align,
  };
}

const SmileyPlaceholder = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="92" fill="#FFD93D" stroke="#E6B800" strokeWidth="6" />
    <ellipse cx="70" cy="80" rx="10" ry="14" fill="#1A1A1A" />
    <ellipse cx="130" cy="80" rx="10" ry="14" fill="#1A1A1A" />
    <path d="M 55 120 Q 100 165 145 120" stroke="#1A1A1A" strokeWidth="10" strokeLinecap="round" fill="none" />
    <ellipse cx="55" cy="115" rx="12" ry="6" fill="#FF9999" opacity="0.55" />
    <ellipse cx="145" cy="115" rx="12" ry="6" fill="#FF9999" opacity="0.55" />
  </svg>
);

const COLOR_WORDS: Record<string, string> = {
  rot: "#DC2626", rote: "#DC2626", rotes: "#DC2626",
  blau: "#2563EB", blaue: "#2563EB", blaues: "#2563EB", blauer: "#2563EB",
  grün: "#16A34A", grüne: "#16A34A", grüner: "#16A34A", gruen: "#16A34A",
  gelb: "#EAB308", gelbe: "#EAB308", gelber: "#EAB308",
  schwarz: "#111111", schwarze: "#111111", schwarzer: "#111111",
  weiss: "#FFFFFF", weiß: "#FFFFFF", weisse: "#FFFFFF", weiße: "#FFFFFF",
  lila: "#9333EA", violett: "#9333EA",
  orange: "#F97316",
  braun: "#92400E", braune: "#92400E",
  türkis: "#14B8A6", tuerkis: "#14B8A6",
  pink: "#EC4899", rosa: "#F472B6",
  gold: "#CA8A04", goldene: "#CA8A04",
  silber: "#94A3B8"
};
const TARGET_MAP: Record<string, string> = {
  preise: "prize", preis: "prize",
  titel: "title", title: "title",
  fragen: "question", frage: "question",
  intro: "intro", untertitel: "intro",
  telefon: "phone", phone: "phone", tel: "phone"
};

function parseStyleCommand(input: string) {
  const parts = input.split(",").map(s => s.trim()).filter(Boolean);
  const applied: { colors: Record<string, string>; layout: Record<string, string>; theme: Record<string, string> } = { colors: {}, layout: {}, theme: {} };
  const remaining: string[] = [];
  for (const p of parts) {
    if (/^querformat$/i.test(p)) { applied.layout.orientation = "landscape"; continue; }
    if (/^hochformat$/i.test(p)) { applied.layout.orientation = "portrait"; continue; }
    if (/^a4$/i.test(p)) { applied.layout.format = "a4"; continue; }
    if (/^a5$/i.test(p)) { applied.layout.format = "a5"; continue; }
    if (/berliner/i.test(p)) { applied.layout.format = "berliner_halbformat"; continue; }
    const fontMatch = p.match(/^schrift\s+(.+)$/i);
    if (fontMatch) {
      const font = fontMatch[1].trim();
      applied.theme.fontFamily = /serif|georgia|times/i.test(font) ? `${font}, serif` : `${font}, sans-serif`;
      continue;
    }
    const colorMatch = p.match(/^(\S+)\s+(preise|preis|titel|title|fragen|frage|intro|untertitel|telefon|phone|tel)$/i);
    if (colorMatch) {
      const hex = COLOR_WORDS[colorMatch[1].toLowerCase()];
      const key = TARGET_MAP[colorMatch[2].toLowerCase()];
      if (hex && key) { applied.colors[key] = hex; continue; }
    }
    remaining.push(p);
  }
  return { applied, topic: remaining.join(", ").trim() };
}

async function generateQuizContent(topic: string, styleInstruction: string, difficulty: Difficulty) {
  const r = await fetch("/api/generate-quiz", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, styleInstruction, difficulty })
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${r.status}`);
  }
  return r.json();
}
async function generateImage(prompt: string, styleInstruction: string, topicElements?: string[]) {
  const r = await fetch("/api/generate-image", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, styleInstruction, topicElements })
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${r.status}`);
  }
  const data = await r.json();
  return data.image as string;
}

// Re-encodes the file via canvas to a JPEG blob. Strips EXIF naturally,
// because the canvas pipeline drops metadata. Also caps max edge to 4096 px.
async function stripExifAndNormalize(file: File): Promise<File> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
    i.src = dataUrl;
  });
  const MAX_EDGE = 4096;
  let { width, height } = img;
  if (width > MAX_EDGE || height > MAX_EDGE) {
    const scale = MAX_EDGE / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar");
  ctx.drawImage(img, 0, 0, width, height);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error("Bild-Encoding fehlgeschlagen")), "image/jpeg", 0.92);
  });
  return new File([blob], "upload.jpg", { type: "image/jpeg" });
}

async function generateImageWithPerson(opts: {
  file: File; topic: string; prompt: string; styleInstruction: string; topicElements?: string[];
}) {
  const fd = new FormData();
  fd.append("image", opts.file);
  fd.append("topic", opts.topic);
  fd.append("prompt", opts.prompt);
  fd.append("styleInstruction", opts.styleInstruction);
  fd.append("topicElements", JSON.stringify(opts.topicElements || []));
  const r = await fetch("/api/generate-image-with-person", { method: "POST", body: fd });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${r.status}`);
  }
  const data = await r.json();
  return data.image as string;
}

type QuizCollection = { quizzes: Quiz[]; activeIndex: number };
type BulkProgress = { current: number; total: number; topic: string; phase: "imaging" | "done"; failed: number };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Erzeugt eine eigenständige statische HTML-Seite mit allen Karten als
// vorgerenderte JPEGs + Sidebar-Navigation. Funktioniert ohne JS-Build,
// kann direkt auf Cloudflare Pages oder als File geöffnet werden.
function buildViewerHtml(quizzes: Quiz[], cardImages: string[]): string {
  const nav = quizzes.map((q, i) =>
    `<a href="#quiz-${i + 1}">${i + 1}. ${escapeHtml(q.meta.title || `Quiz ${i + 1}`)}</a>`
  ).join("\n      ");

  const sections = quizzes.map((q, i) => {
    const img = cardImages[i] || "";
    const title = escapeHtml(q.meta.title || `Quiz ${i + 1}`);
    return `<section class="card" id="quiz-${i + 1}">
      <h2>${i + 1}. ${title}</h2>
      ${img ? `<img src="${img}" alt="${title}" loading="lazy">` : `<div class="placeholder">Kein Bild</div>`}
    </section>`;
  }).join("\n    ");

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wissensquiz — ${quizzes.length} Themen</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #18181b; color: #f4f4f5; }
  header { padding: 20px 40px; border-bottom: 1px solid #27272a; position: sticky; top: 0; background: rgba(24,24,27,0.95); backdrop-filter: blur(8px); z-index: 10; }
  header h1 { margin: 0; font-size: 18px; font-weight: 600; }
  header .meta { font-size: 12px; color: #a1a1aa; margin-top: 2px; }
  .layout { display: flex; min-height: calc(100vh - 70px); }
  nav { width: 280px; flex-shrink: 0; border-right: 1px solid #27272a; padding: 16px; overflow-y: auto; position: sticky; top: 70px; height: calc(100vh - 70px); }
  nav a { display: block; padding: 6px 10px; color: #a1a1aa; text-decoration: none; font-size: 13px; border-radius: 4px; margin-bottom: 1px; }
  nav a:hover { color: #fff; background: #27272a; }
  main { flex: 1; padding: 24px 40px; max-width: 1200px; }
  .card { margin-bottom: 48px; background: #0a0a0a; border-radius: 8px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.6); }
  .card h2 { margin: 0; padding: 14px 20px; font-size: 15px; font-weight: 500; color: #a1a1aa; border-bottom: 1px solid #27272a; }
  .card img { width: 100%; height: auto; display: block; }
  .placeholder { padding: 80px 20px; text-align: center; color: #71717a; font-style: italic; }
  @media (max-width: 768px) {
    nav { display: none; }
    main { padding: 16px; }
  }
</style>
</head>
<body>
<header>
  <h1>Wissensquiz</h1>
  <div class="meta">${quizzes.length} Themen · Veröffentlicht am ${new Date().toLocaleDateString("de-DE")}</div>
</header>
<div class="layout">
  <nav>
    ${nav}
  </nav>
  <main>
    ${sections}
  </main>
</div>
</body>
</html>`;
}

// Default-Texte für Gewinner/AGB, falls noch nicht gesetzt. Werden sowohl von
// APPLY_AI_CONTENT (siehe Zeile ~419) als auch vom Datei-Import verwendet, damit
// die Blöcke nicht leer und damit unsichtbar bleiben.
const DEFAULT_WINNERS_TEXT = "Gewinnerinnen und Gewinner werden hier veröffentlicht";
const DEFAULT_TERMS_TEXT = "Teilnahmebedingungen unter 0800 890 890 / Dieser Anruf ist kostenlos. Zu diesem Gewinnspiel wird keine Korrespondenz geführt.";
const DEFAULT_PHONE_TERMS_TEXT = "Telemedia interactive GmbH, 0,50€ pro Anruf aus dem dt. Festnetz, Mobilfunk teurer";

// IndexedDB-Persistenz für die Quiz-Sammlung.
// localStorage hat ~5-10 MB Limit, das reicht für 27 Quizzes mit Bildern nicht.
// IndexedDB erlaubt deutlich größere Datenmengen (oft >50% der freien Disk).
const IDB_NAME = "wissensquiz";
const IDB_VERSION = 1;
const IDB_STORE = "collection";
const IDB_KEY = "current";
// Alt-Key aus der localStorage-Phase — wir migrieren beim ersten Load.
const COLLECTION_STORAGE_KEY = "wissensquiz_collection_v1";

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbLoadCollection(): Promise<QuizCollection | null> {
  try {
    const db = await openIdb();
    return await new Promise<QuizCollection | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as QuizCollection | undefined) || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("IDB load fehlgeschlagen:", e);
    return null;
  }
}

async function idbSaveCollection(c: QuizCollection): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(c, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function idbClearCollection(): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("IDB clear fehlgeschlagen:", e);
  }
}

function parsedQuizToQuiz(p: ParsedQuiz, template: Quiz): Quiz {
  const incoming = p.questions || [];
  // Die Datei listet Fragen von höchstem zu niedrigstem Preis (Q1 = 1000€,
  // Q5 = 50€). Das Quiz-Template hat questions[0..4] aufsteigend nach Preis
  // (questions[0] = 50€). Wir mappen File-Index 0 auf den Slot mit dem
  // höchsten Preis, File-Index 4 auf den niedrigsten.
  const slotsByPriceDesc = template.questions
    .map((q, idx) => ({
      idx,
      value: template.prizes.find(pp => pp.id === q.prizeTierId)?.valueCents ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .map(r => r.idx);

  const newQuestions = [...template.questions];
  slotsByPriceDesc.forEach((qIdx, fileIdx) => {
    const src = incoming[fileIdx];
    newQuestions[qIdx] = {
      ...template.questions[qIdx],
      text: src?.text || "",
      answerType: "text" as const,
      options: undefined,
      correctAnswer: src?.answer || "",
    };
  });

  // (Variante c) — Headline-Logik: die 50€-Frage (= niedrigster Preis-Slot)
  // wird ZUSÄTZLICH zum Titel hochgezogen. Die 50€-Zeile bleibt in der Liste
  // sichtbar (Doppelung mit dem Titel ist gewollt). Untertitel bleibt hier
  // leer — er wird vom Aufrufer mit KI-Subtitle befüllt.
  const headlineSlotIdx = slotsByPriceDesc[slotsByPriceDesc.length - 1];
  const headlineText = newQuestions[headlineSlotIdx].text || "";

  return {
    ...template,
    meta: {
      ...template.meta,
      title: headlineText || p.topic,
      subtitle: template.meta.subtitle || "",
      titleAuto: false,
      winnersText: template.meta.winnersText || DEFAULT_WINNERS_TEXT,
      termsText: template.meta.termsText || DEFAULT_TERMS_TEXT,
      phoneTermsText: template.meta.phoneTermsText || DEFAULT_PHONE_TERMS_TEXT,
    },
    theme: {
      ...template.theme,
      background: { ...template.theme.background, image: null },
    },
    questions: newQuestions,
  };
}

type Action = { type: string; [k: string]: unknown };

const LIGHT_COLORS: Record<string, string> = {
  title: "#FFFFFF", intro: "#F5F5F5", prize: "#FFD27A",
  question: "#FFFFFF", phone: "#FFD27A", winners: "#F0F0F0", terms: "#F0F0F0"
};

function quizReducer(state: Quiz, action: Action): Quiz {
  switch (action.type) {
    case "UPDATE_META": return { ...state, meta: { ...state.meta, ...(action.payload as object) } };
    case "UPDATE_FONT_SIZE": {
      const p = action.payload as { key: string; value: number };
      return { ...state, theme: { ...state.theme, fontSizes: { ...state.theme.fontSizes, [p.key]: p.value } } };
    }
    case "UPDATE_THEME": return { ...state, theme: { ...state.theme, ...(action.payload as object) } };
    case "UPDATE_COLOR": return { ...state, theme: { ...state.theme, colors: { ...state.theme.colors, [action.key as string]: action.value as string } } };
    case "UPDATE_FONTSIZE": return { ...state, theme: { ...state.theme, fontSizes: { ...state.theme.fontSizes, [action.key as string]: action.value as number } } };
    case "UPDATE_BACKGROUND": return { ...state, theme: { ...state.theme, background: { ...state.theme.background, ...(action.payload as object) } } };
    case "UPDATE_BG_POSITION": return { ...state, theme: { ...state.theme, background: { ...state.theme.background, position: { ...state.theme.background.position, ...(action.payload as object) } } } };
    case "UPDATE_READABILITY": return { ...state, theme: { ...state.theme, readability: { ...state.theme.readability, ...(action.payload as object) } } };
    case "UPDATE_LAYOUT": return { ...state, layout: { ...state.layout, ...(action.payload as object) } };
    case "UPDATE_PARTICIPATION": return { ...state, participation: { ...state.participation, ...(action.payload as object) } };
    case "FORCE_LIGHT_COLORS": return { ...state, theme: { ...state.theme, colors: { ...state.theme.colors, ...LIGHT_COLORS } } };
    case "SET_TITLE_AUTO": {
      const auto = action.value as boolean;
      if (!auto && state.meta.titleAuto) {
        return { ...state, meta: { ...state.meta, titleAuto: false, title: deriveTitleFromQuestions(state) } };
      }
      return { ...state, meta: { ...state.meta, titleAuto: auto } };
    }
    case "SET_QUESTION_COUNT": {
      const target = Math.max(1, Math.min(50, action.count as number));
      const current = state.questions.length;
      if (target === current) return state;
      if (target > current) {
        const toAdd: Question[] = [];
        for (let i = current; i < target; i++) {
          const prize = state.prizes[i] || state.prizes[state.prizes.length - 1];
          toAdd.push({ id: genId("q"), text: ``, answerType: "text", correctAnswer: "", prizeTierId: prize.id, phoneNumber: "" });
        }
        return { ...state, questions: [...state.questions, ...toAdd] };
      }
      return { ...state, questions: state.questions.slice(0, target) };
    }
    case "UPDATE_QUESTION": return { ...state, questions: state.questions.map(q => q.id === action.id ? { ...q, ...(action.payload as object) } : q) };
    case "REMOVE_QUESTION": return { ...state, questions: state.questions.filter(q => q.id !== action.id) };
    case "ADD_PRIZE": {
      const last = state.prizes[state.prizes.length - 1];
      return { ...state, prizes: [...state.prizes, { id: genId("p"), valueCents: (last?.valueCents || 5000) * 2, currency: "EUR", label: null }] };
    }
    case "UPDATE_PRIZE": return { ...state, prizes: state.prizes.map(p => p.id === action.id ? { ...p, ...(action.payload as object) } : p) };
    case "REMOVE_PRIZE": return { ...state, prizes: state.prizes.filter(p => p.id !== action.id) };
    case "APPLY_STYLE_COMMAND": {
      const { applied } = action.payload as { applied: { layout?: Record<string, string>; theme?: Record<string, string>; colors?: Record<string, string> } };
      let next: Quiz = state;
      if (applied.layout?.format || applied.layout?.orientation) next = { ...next, layout: { ...next.layout, ...applied.layout } };
      if (applied.theme?.fontFamily) next = { ...next, theme: { ...next.theme, fontFamily: applied.theme.fontFamily } };
      if (applied.colors && Object.keys(applied.colors).length) next = { ...next, theme: { ...next.theme, colors: { ...next.theme.colors, ...applied.colors } } };
      return next;
    }
    case "APPLY_AI_CONTENT": {
      const p = action.payload as { headline?: string; subtitle?: string; questions?: { text: string; answerType: AnswerType; options?: string[]; correctAnswer: string }[]; theme?: { titleColor?: string; prizeColor?: string; questionColor?: string } };
      const ai = p.theme || {};
      const titleC = ai.titleColor && !isDark(ai.titleColor) ? ai.titleColor : LIGHT_COLORS.title;
      const introC = ai.titleColor && !isDark(ai.titleColor) ? ai.titleColor : LIGHT_COLORS.intro;
      const prizeC = ai.prizeColor && !isDark(ai.prizeColor) ? ai.prizeColor : LIGHT_COLORS.prize;
      const questionC = ai.questionColor && !isDark(ai.questionColor) ? ai.questionColor : LIGHT_COLORS.question;
      const newScrim = state.theme.readability.scrim === 0 ? 0.25 : state.theme.readability.scrim;
      const newShadow = state.theme.readability.textShadow < 0.9 ? 0.95 : state.theme.readability.textShadow;
      const winnersText = state.meta.winnersText || "Gewinnerinnen und Gewinner werden hier veröffentlicht";
      const termsText = state.meta.termsText || "Teilnahmebedingungen unter 0800 890 890 / Dieser Anruf ist kostenlos. Zu diesem Gewinnspiel wird keine Korrespondenz geführt.";
      const phoneTermsText = state.meta.phoneTermsText || "Telemedia interactive GmbH, 0,50€ pro Anruf aus dem dt. Festnetz, Mobilfunk teurer";
      // Titel = KI-Headline (kurz, max 35 Zeichen) — Fallback auf 1000€-Frage falls leer.
      const aiQuestions = p.questions || [];
      const highestPrizeQuestion = aiQuestions[aiQuestions.length - 1]?.text || "";
      // Titel = 1000€-Frage 1:1 (höchstdotierte Frage)
      const autoTitle = highestPrizeQuestion;
      return {
        ...state,
        meta: { ...state.meta, title: autoTitle, titleAuto: false, subtitle: p.subtitle || state.meta.subtitle, winnersText, termsText, phoneTermsText },
        theme: { ...state.theme,
          colors: { ...state.theme.colors, title: titleC, intro: introC, prize: prizeC, question: questionC, phone: prizeC },
          readability: { ...state.theme.readability, scrim: newScrim, textShadow: newShadow }
        },
        questions: aiQuestions.map((q, i) => ({
          id: genId("q"), text: q.text || `Frage ${i + 1}?`,
          answerType: q.answerType === "choice" ? "choice" : "text",
          options: q.answerType === "choice" ? (q.options || []) : undefined,
          correctAnswer: q.correctAnswer || "",
          prizeTierId: state.prizes[i]?.id || state.prizes[state.prizes.length - 1].id,
          phoneNumber: state.questions[i]?.phoneNumber || ""
        }))
      };
    }
    case "APPLY_IMPORTED_QUIZ": {
      // Befüllt Titel + 5 Fragen + 5 Antworten aus einem Datei-Import (z.B. .docx).
      // Telefonnummern, Preise und Schwierigkeit bleiben unverändert. Fragen
      // werden nach Preis absteigend gemappt (File-Q1 = höchster Preis-Slot).
      // Gewinner-/AGB-Text werden mit Defaults befüllt, falls leer.
      // Hintergrundbild wird zurückgesetzt, damit beim Klick auf „Generieren"
      // ein passendes Bild zum neuen Thema entsteht.
      return parsedQuizToQuiz(action.payload as ParsedQuiz, state);
    }
    case "SET_BACKGROUND_IMAGE": return { ...state, theme: { ...state.theme, background: { ...state.theme.background, image: action.payload as string } } };
    case "LOAD_QUIZ": {
      const loaded = action.payload as Quiz;
      const safeMeta = { ...loaded.meta, titleAuto: loaded.meta?.titleAuto ?? false, phoneTermsText: loaded.meta?.phoneTermsText ?? "" };
      const safeTheme = {
        ...loaded.theme,
        readability: loaded.theme?.readability ?? { scrim: 0.25, textShadow: 0.7, blockBackdrop: "none" as const }
      };
      return { ...loaded, meta: safeMeta, theme: safeTheme };
    }
    case "RESET": return defaultQuiz;
    default: return state;
  }
}

type HistoryState = { past: Quiz[]; present: Quiz; future: Quiz[] };
function historyReducer(state: HistoryState, action: Action): HistoryState {
  if (action.type === "UNDO") {
    if (!state.past.length) return state;
    return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] };
  }
  if (action.type === "REDO") {
    if (!state.future.length) return state;
    return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
  }
  const next = quizReducer(state.present, action);
  if (next === state.present) return state;
  return { past: [...state.past.slice(-49), state.present], present: next, future: [] };
}

function useStyleInstructions() {
  const [styleText, setStyleText] = useState(DEFAULT_TEXT_STYLE);
  const [styleImage, setStyleImage] = useState(DEFAULT_IMAGE_STYLE);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const t = localStorage.getItem(STYLE_TEXT_KEY);
      const i = localStorage.getItem(STYLE_IMAGE_KEY);
      if (t !== null) setStyleText(t);
      if (i !== null) setStyleImage(i);
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) try { localStorage.setItem(STYLE_TEXT_KEY, styleText); } catch {} }, [styleText]);
  useEffect(() => { if (loaded.current) try { localStorage.setItem(STYLE_IMAGE_KEY, styleImage); } catch {} }, [styleImage]);
  const resetText = () => setStyleText(DEFAULT_TEXT_STYLE);
  const resetImage = () => setStyleImage(DEFAULT_IMAGE_STYLE);
  return { styleText, setStyleText, resetText, styleImage, setStyleImage, resetImage };
}

function useDifficulty(): [Difficulty, (d: Difficulty) => void] {
  const [diff, setDiff] = useState<Difficulty>("medium");
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const d = localStorage.getItem(DIFFICULTY_KEY);
      if (d === "easy" || d === "medium" || d === "hard") setDiff(d);
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current) try { localStorage.setItem(DIFFICULTY_KEY, diff); } catch {}
  }, [diff]);
  return [diff, setDiff];
}

// Robust auto-fit: measures content, scales down to fit available height.
// Uses two animation frames after each reset and a ResizeObserver for changes.
function useAutoFit(parentRef: React.RefObject<HTMLDivElement | null>, childRef: React.RefObject<HTMLDivElement | null>, deps: unknown[]) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const parent = parentRef.current;
    const child = childRef.current;
    if (!parent || !child) return;
    let raf1 = 0, raf2 = 0, cancelled = false;

    const measure = () => {
      if (cancelled || !parent || !child) return;
      child.style.transform = "none";
      raf1 = requestAnimationFrame(() => {
        if (cancelled || !parent || !child) return;
        raf2 = requestAnimationFrame(() => {
          if (cancelled || !parent || !child) return;
          const parentH = parent.clientHeight;
          const childH = child.scrollHeight;
          if (childH > 0 && parentH > 0) {
            const safeParentH = parentH * 0.96;
            const newScale = Math.min(1, safeParentH / childH);
            setScale(newScale);
          }
        });
      });
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(parent);
    ro.observe(child);

    return () => {
      cancelled = true;
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return scale;
}

function Section({ title, children, defaultOpen = true, icon }: { title: string; children: React.ReactNode; defaultOpen?: boolean; icon?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-stone-300 rounded bg-white">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
        <span className="flex items-center gap-2">{icon}{title}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && <div className="px-3 pb-3 pt-2 border-t border-stone-200 space-y-2">{children}</div>}
    </div>
  );
}
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (<div><label className="block text-xs text-stone-600 mb-1">{label}</label>{children}</div>);
const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`w-full px-2 py-1 text-sm border border-stone-300 rounded bg-white focus:border-blue-500 focus:outline-none ${p.className || ""}`} />;
const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`w-full px-2 py-1 text-sm border border-stone-300 rounded bg-white focus:border-blue-500 focus:outline-none ${p.className || ""}`} />;
const Select = ({ value, onChange, options }: { value: string; onChange: React.ChangeEventHandler<HTMLSelectElement>; options: { value: string; label: string }[] }) => (
  <select value={value} onChange={onChange} className="w-full px-2 py-1 text-sm border border-stone-300 rounded bg-white">
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);
const ColorInput = ({ value, onChange }: { value: string; onChange: React.ChangeEventHandler<HTMLInputElement> }) => (
  <div className="flex items-center gap-2">
    <input type="color" value={value} onChange={onChange} className="w-8 h-7 border border-stone-300 rounded cursor-pointer bg-white" />
    <input type="text" value={value} onChange={onChange} className="flex-1 px-2 py-1 text-xs font-mono border border-stone-300 rounded bg-white" />
  </div>
);
const Slider = ({ value, min, max, step = 1, unit = "", onChange }: { value: number; min: number; max: number; step?: number; unit?: string; onChange: React.ChangeEventHandler<HTMLInputElement> }) => (
  <div className="flex items-center gap-2">
    <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} className="flex-1" />
    <span className="text-xs text-stone-600 w-12 text-right font-mono">{value}{unit}</span>
  </div>
);

function DifficultyPicker({ value, onChange, disabled }: { value: Difficulty; onChange: (d: Difficulty) => void; disabled?: boolean }) {
  const opts: { v: Difficulty; label: string }[] = [
    { v: "easy", label: "Leicht" },
    { v: "medium", label: "Mittel" },
    { v: "hard", label: "Schwer" }
  ];
  return (
    <div className="flex gap-1">
      {opts.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} disabled={disabled}
          className={`flex-1 px-2 py-1 text-xs rounded border transition ${
            value === o.v
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-stone-700 border-stone-300 hover:bg-stone-50"
          } disabled:opacity-50`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AIGeneratorPanel({ dispatch, styleText, styleImage, difficulty, setDifficulty, onBulkImport, bulkDisabled }: {
  dispatch: React.Dispatch<Action>; styleText: string; styleImage: string;
  difficulty: Difficulty; setDifficulty: (d: Difficulty) => void;
  onBulkImport: (parsedQuizzes: ParsedQuiz[]) => void;
  bulkDisabled: boolean;
}) {
  const [topicInput, setTopicInput] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "imaging" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [lastImagePrompt, setLastImagePrompt] = useState("");
  const [lastTopicElements, setLastTopicElements] = useState<string[]>([]);
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string>("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [lastTopic, setLastTopic] = useState("");
  const [importedQuizzes, setImportedQuizzes] = useState<ParsedQuiz[] | null>(null);
  const [importing, setImporting] = useState(false);
  // True solange topicInput aus einem Datei-Import stammt und der Editor ihn
  // nicht manuell überschrieben hat. Steuert, ob der Generieren-Button die
  // Quiz-Texte neu schreibt oder nur ein Bild zum geladenen Topic baut.
  const [importedFromFile, setImportedFromFile] = useState(false);

  const handleGenerate = async () => {
    const raw = topicInput.trim();
    if (!raw) return;
    setError("");
    setLastImagePrompt("");
    setLastTopicElements([]);

    // Nach Datei-Import: Fragen sind schon befüllt — wir wollen nur Untertitel +
    // passendes Bild. Fragen aus dem KI-Result werden bewusst verworfen.
    if (importedFromFile) {
      const topic = raw;
      let imagePrompt = `${topic}, photorealistic, single coherent newspaper cover scene, bright midday sunlight`;
      let topicElements: string[] = [topic];
      try {
        setStatus("generating");
        const result = await generateQuizContent(topic, styleText, difficulty);
        if (result?.subtitle) {
          dispatch({ type: "UPDATE_META", payload: { subtitle: String(result.subtitle) } });
        }
        if (result?.imagePrompt) imagePrompt = String(result.imagePrompt);
        if (Array.isArray(result?.topicElements) && result.topicElements.length) {
          topicElements = result.topicElements;
        }
      } catch (e) {
        console.warn("KI-Metadaten fehlgeschlagen — fahre mit Default-Prompt fort:", e);
      }
      try {
        setStatus("imaging");
        const dataUrl = personFile
          ? await generateImageWithPerson({ file: personFile, topic, prompt: imagePrompt, styleInstruction: styleImage, topicElements })
          : await generateImage(imagePrompt, styleImage, topicElements);
        dispatch({ type: "SET_BACKGROUND_IMAGE", payload: dataUrl });
        setLastImagePrompt(imagePrompt);
        setLastTopicElements(topicElements);
        setLastTopic(topic);
        setStatus("done");
      } catch (e) {
        setError(`Bildgenerierung fehlgeschlagen: ${(e as Error).message}`);
        setStatus("error");
      }
      return;
    }

    const { applied, topic } = parseStyleCommand(raw);
    if (applied.layout.format || applied.layout.orientation || applied.theme.fontFamily || Object.keys(applied.colors).length) {
      dispatch({ type: "APPLY_STYLE_COMMAND", payload: { applied } });
    }
    if (!topic) { setStatus("done"); return; }
    let imagePrompt = "";
    let topicElements: string[] = [];
    try {
      setStatus("generating");
      const result = await generateQuizContent(topic, styleText, difficulty);
      dispatch({ type: "APPLY_AI_CONTENT", payload: result });
      imagePrompt = result.imagePrompt || `${topic}, photorealistic, single coherent newspaper cover scene, bright midday sunlight`;
      topicElements = Array.isArray(result.topicElements) ? result.topicElements : [];
      setLastImagePrompt(imagePrompt);
      setLastTopicElements(topicElements);
      setLastTopic(topic);
    } catch (e) {
      setError(`KI-Texte fehlgeschlagen: ${(e as Error).message}`);
      setStatus("error");
      return;
    }
    try {
      setStatus("imaging");
      const dataUrl = personFile
        ? await generateImageWithPerson({ file: personFile, topic, prompt: imagePrompt, styleInstruction: styleImage, topicElements })
        : await generateImage(imagePrompt, styleImage, topicElements);
      dispatch({ type: "SET_BACKGROUND_IMAGE", payload: dataUrl });
      setStatus("done");
    } catch (e) {
      setError(`Bildgenerierung fehlgeschlagen: ${(e as Error).message}`);
      setStatus("error");
    }
  };

  const handleRegenerateImage = async () => {
    if (!lastImagePrompt) return;
    setError("");
    try {
      setStatus("imaging");
      const dataUrl = personFile
        ? await generateImageWithPerson({ file: personFile, topic: lastTopic, prompt: lastImagePrompt, styleInstruction: styleImage, topicElements: lastTopicElements })
        : await generateImage(lastImagePrompt, styleImage, lastTopicElements);
      dispatch({ type: "SET_BACKGROUND_IMAGE", payload: dataUrl });
      setStatus("done");
    } catch (e) {
      setError(`Bildgenerierung fehlgeschlagen: ${(e as Error).message}`);
      setStatus("error");
    }
  };

  const handleFilePick = (file: File | null) => {
    if (!file) return;
    setError("");
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      setError(`Bildformat nicht unterstützt: ${file.type}. Erlaubt: JPG, PNG, WEBP`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(`Bild zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum 10 MB.`);
      return;
    }
    setPendingFile(file);
    setConsentChecked(false);
  };

  const handleConsentConfirm = async () => {
    if (!pendingFile || !consentChecked) return;
    try {
      const cleaned = await stripExifAndNormalize(pendingFile);
      const url = URL.createObjectURL(cleaned);
      if (personPreview) URL.revokeObjectURL(personPreview);
      setPersonFile(cleaned);
      setPersonPreview(url);
      setPendingFile(null);
      setConsentChecked(false);
    } catch (e) {
      setError(`Bild konnte nicht verarbeitet werden: ${(e as Error).message}`);
      setPendingFile(null);
      setConsentChecked(false);
    }
  };

  const handleConsentCancel = () => {
    setPendingFile(null);
    setConsentChecked(false);
  };

  const handleRemovePerson = () => {
    if (personPreview) URL.revokeObjectURL(personPreview);
    setPersonFile(null);
    setPersonPreview("");
  };

  const handleDocumentPick = async (file: File | null) => {
    if (!file) return;
    setError("");
    if (!/\.docx$/i.test(file.name)) {
      setError("Nur .docx-Dateien werden aktuell unterstützt.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(`Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum 10 MB.`);
      return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/import-quiz-document", { method: "POST", body: fd });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const j = await r.json();
      const list: ParsedQuiz[] = j.quizzes || [];
      if (!list.length) {
        setError("Keine Quizzes in der Datei gefunden.");
        return;
      }
      setImportedQuizzes(list);
    } catch (e) {
      setError(`Datei-Import fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleSelectImportedQuiz = (quiz: ParsedQuiz) => {
    dispatch({ type: "APPLY_IMPORTED_QUIZ", payload: quiz });
    setTopicInput(quiz.topic);
    setImportedFromFile(true);
    setImportedQuizzes(null);
  };

  const busy = status === "generating" || status === "imaging";

  return (
    <div className="border-2 border-blue-300 rounded-md bg-blue-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
        <Sparkles className="w-4 h-4" /> KI-Generator
      </div>
      <div className="text-xs text-stone-600">
        Thema + Style-Kommandos kombinierbar:
        <span className="font-mono text-stone-700"> Bern, Genfersee, Querformat, rote Preise</span>
      </div>

      <Field label="Schwierigkeit">
        <DifficultyPicker value={difficulty} onChange={setDifficulty} disabled={busy} />
      </Field>

      <div className="space-y-2">
        <Input value={topicInput} placeholder="z. B. Bern, Genfersee"
          onChange={e => { setTopicInput(e.target.value); setImportedFromFile(false); }}
          onKeyDown={e => { if (e.key === "Enter" && !busy) handleGenerate(); }}
          disabled={busy}
          className="!px-4 !py-3 !text-base" />
        <div className="flex gap-2">
          <label className={`px-3 py-2 text-sm border border-stone-300 bg-white rounded cursor-pointer hover:bg-stone-50 flex items-center gap-1 whitespace-nowrap ${busy ? "opacity-50 pointer-events-none" : ""}`}
            title="Foto mit Personen hochladen (optional)">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Foto</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => { handleFilePick(e.target.files?.[0] || null); e.target.value = ""; }}
              disabled={busy} />
          </label>
          <label className={`px-3 py-2 text-sm border border-stone-300 bg-white rounded cursor-pointer hover:bg-stone-50 flex items-center gap-1 whitespace-nowrap ${busy || importing ? "opacity-50 pointer-events-none" : ""}`}
            title="Quiz-Inhalte aus Word-Datei (.docx) importieren">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <span className="hidden sm:inline">Aus Datei</span>
            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden"
              onChange={e => { handleDocumentPick(e.target.files?.[0] || null); e.target.value = ""; }}
              disabled={busy || importing} />
          </label>
          <div className="flex-1" />
          <button onClick={handleGenerate} disabled={busy || !topicInput.trim()}
            className="px-4 py-2 text-base bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap font-medium">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {status === "generating" ? "Quiz..." : status === "imaging" ? "Bild..." : importedFromFile ? "Bild generieren" : "Generieren"}
          </button>
        </div>
      </div>

      {personFile && personPreview && (
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded px-2 py-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={personPreview} alt="Personen-Foto" className="w-12 h-12 object-cover rounded border border-stone-300" />
          <div className="flex-1 text-xs text-stone-700">
            <div className="font-medium">Personen-Foto aktiv</div>
            <div className="text-stone-500">Wird in den KI-Hintergrund integriert.</div>
          </div>
          <button onClick={handleRemovePerson} disabled={busy}
            className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 flex items-center gap-1">
            <X className="w-3 h-3" /> Entfernen
          </button>
        </div>
      )}

      {importedQuizzes && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-5 space-y-3 max-h-[80vh] flex flex-col">
            <div className="text-sm font-semibold text-stone-900">
              {importedQuizzes.length} Quiz{importedQuizzes.length === 1 ? "" : "ze"} gefunden — eines auswählen
            </div>
            <div className="text-xs text-stone-500">
              Beim Klick werden Titel und die 5 Fragen+Antworten geladen. Bild, Telefonnummern,
              Preise und Schwierigkeit bleiben unverändert. Frage 1 wird auf Freitext gesetzt.
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
              {importedQuizzes.map((q, i) => {
                const filledQ = q.questions.filter(x => x.text).length;
                const emptyA = q.questions.filter(x => !x.answer).length;
                const noteCount = q.questions.filter(x => x.notes).length;
                return (
                  <button key={i} onClick={() => handleSelectImportedQuiz(q)}
                    className="w-full text-left border border-stone-200 hover:border-blue-400 hover:bg-blue-50 rounded px-3 py-2 group">
                    <div className="text-sm font-medium text-stone-900 group-hover:text-blue-900">
                      Quiz {i + 1}: {q.topic || "(ohne Titel)"}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {filledQ}/5 Fragen
                      {emptyA > 0 && `, ${emptyA} ohne Antwort`}
                      {noteCount > 0 && `, ${noteCount} mit Hinweis`}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between items-center gap-2 pt-2 border-t border-stone-200">
              <button onClick={() => setImportedQuizzes(null)}
                className="px-3 py-1 text-xs border border-stone-300 rounded hover:bg-stone-50">
                Abbrechen
              </button>
              <button
                onClick={() => {
                  const list = importedQuizzes;
                  setImportedQuizzes(null);
                  if (list) onBulkImport(list);
                }}
                disabled={bulkDisabled}
                title="Erzeugt für jedes Quiz das KI-Hintergrundbild und legt eine Sammlung an, die du danach einzeln editieren kannst."
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 font-medium">
                <Sparkles className="w-4 h-4" />
                Alle {importedQuizzes.length} mit Bild generieren
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingFile && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="text-sm font-semibold text-stone-900">Persönlichkeitsrechte bestätigen</div>
            <div className="text-xs text-stone-600 space-y-2">
              <p>Du lädst ein Foto hoch, auf dem Personen abgebildet sein können. Vor der Verarbeitung durch die KI brauchen wir deine Bestätigung:</p>
              <p className="text-stone-500">Hinweis: Bild-Metadaten werden mit übertragen, GPS- und EXIF-Daten werden vor dem Upload entfernt.</p>
            </div>
            <label className="flex items-start gap-2 text-xs text-stone-800 cursor-pointer">
              <input type="checkbox" checked={consentChecked}
                onChange={e => setConsentChecked(e.target.checked)}
                className="mt-0.5" />
              <span>Ich habe die Einwilligung der abgebildeten Personen für die werbliche Nutzung im Wissensquiz und versichere, dass ich die nötigen Rechte besitze.</span>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={handleConsentCancel}
                className="px-3 py-1 text-xs border border-stone-300 rounded hover:bg-stone-50">
                Abbrechen
              </button>
              <button onClick={handleConsentConfirm} disabled={!consentChecked}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40">
                Bestätigen & übernehmen
              </button>
            </div>
          </div>
        </div>
      )}

      {lastImagePrompt && status === "done" && (
        <div className="text-xs text-stone-600 bg-white border border-stone-200 rounded px-2 py-1">
          <div className="text-stone-500 mb-0.5">Bild-Prompt:</div>
          <div className="italic">{lastImagePrompt}</div>
          {lastTopicElements.length > 1 && (
            <div className="mt-1 text-stone-500">Themen vereint: <span className="font-mono">{lastTopicElements.join(" + ")}</span></div>
          )}
          <button onClick={handleRegenerateImage} disabled={busy}
            className="mt-1 text-blue-700 hover:text-blue-900 hover:underline disabled:opacity-40 flex items-center gap-1">
            <Wand2 className="w-3 h-3" /> Bild neu generieren
          </button>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-700 bg-red-100 border border-red-300 rounded px-2 py-1 flex items-start gap-2">
          <X className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function StyleSettingsPanel({ styleText, setStyleText, resetText, styleImage, setStyleImage, resetImage }: {
  styleText: string; setStyleText: (s: string) => void; resetText: () => void;
  styleImage: string; setStyleImage: (s: string) => void; resetImage: () => void;
}) {
  const textIsDefault = styleText === DEFAULT_TEXT_STYLE;
  const imageIsDefault = styleImage === DEFAULT_IMAGE_STYLE;
  return (
    <Section title="KI-Stil-Vorgaben (gelten für jede Generierung)" defaultOpen={false} icon={<Settings className="w-4 h-4" />}>
      <div className="text-xs text-stone-500 mb-1">
        Diese Texte werden bei jeder Generierung automatisch angehängt. Werden im Browser gespeichert.
      </div>
      <Field label={`Texte (Quiz-Inhalte) ${textIsDefault ? "— Default" : "— angepasst"}`}>
        <Textarea rows={6} value={styleText} onChange={e => setStyleText(e.target.value)} />
      </Field>
      {!textIsDefault && (
        <button onClick={resetText} className="px-2 py-1 text-xs border border-stone-300 rounded bg-white hover:bg-stone-50 flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Auf Default zurücksetzen
        </button>
      )}
      <div className="pt-2 border-t border-stone-200" />
      <Field label={`Bilder ${imageIsDefault ? "— Default" : "— angepasst"}`}>
        <Textarea rows={6} value={styleImage} onChange={e => setStyleImage(e.target.value)} />
      </Field>
      {!imageIsDefault && (
        <button onClick={resetImage} className="px-2 py-1 text-xs border border-stone-300 rounded bg-white hover:bg-stone-50 flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Auf Default zurücksetzen
        </button>
      )}
    </Section>
  );
}

function BulkProgressPanel({ progress }: { progress: BulkProgress }) {
  const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;
  return (
    <div className="border-2 border-blue-300 rounded-md bg-blue-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
        <Loader2 className="w-4 h-4 animate-spin" />
        Bilder generieren — {progress.current} / {progress.total}
        {progress.failed > 0 && (
          <span className="text-amber-700 text-xs ml-1">({progress.failed} fehlgeschlagen)</span>
        )}
      </div>
      <div className="w-full h-2 bg-stone-200 rounded overflow-hidden">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-stone-600 truncate" title={progress.topic}>
        {progress.topic || "…"}
      </div>
    </div>
  );
}

function QuizCollectionPicker({ collection, activeTitle, onSwitch, onClear, onRepair, onPublish, publishingDisabled, onGenerateMissingImages }: {
  collection: QuizCollection;
  activeTitle: string;
  onSwitch: (index: number) => void;
  onClear: () => void;
  onRepair: () => void;
  onPublish: () => void;
  publishingDisabled: boolean;
  onGenerateMissingImages: () => void;
}) {
  const { quizzes, activeIndex } = collection;
  // Zählt Quizzes mit fehlendem Bild ODER fehlendem Untertitel — der Knopf
  // löst beides nach.
  const missingImages = quizzes.filter(q =>
    !q.theme.background?.image || !q.meta.subtitle?.trim()
  ).length;
  return (
    <div className="border-2 border-stone-300 rounded-md bg-white p-2 space-y-1">
      <div className="flex items-center justify-between mb-1 px-1 gap-2">
        <div className="text-xs font-semibold text-stone-700">
          Quiz-Sammlung · {activeIndex + 1} / {quizzes.length}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onRepair}
            title="Reihenfolge umkehren (50€ ↔ 1000€-Slot), Gewinner-/AGB-Text füllen, 50€-Frage als Headline. Bilder und Edits bleiben erhalten."
            className="text-[10px] px-1.5 py-0.5 border border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 rounded">
            Fix anwenden
          </button>
          <button onClick={onClear}
            title="Sammlung schließen und aus lokalem Speicher entfernen"
            className="text-xs text-stone-400 hover:text-red-600 px-1">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="max-h-56 overflow-y-auto space-y-0.5">
        {quizzes.map((q, i) => {
          const title = i === activeIndex ? activeTitle : (q.meta.title || `Quiz ${i + 1}`);
          const hasImage = !!q.theme.background?.image;
          return (
            <button key={i} onClick={() => onSwitch(i)}
              className={`w-full text-left text-xs px-2 py-1 rounded flex items-center gap-1.5 ${
                i === activeIndex
                  ? "bg-blue-600 text-white"
                  : "hover:bg-stone-100 text-stone-700"
              }`}>
              <span className={`tabular-nums w-5 text-right ${i === activeIndex ? "text-blue-100" : "text-stone-400"}`}>{i + 1}.</span>
              <span className="flex-1 truncate">{title || "(ohne Titel)"}</span>
              {!hasImage && (
                <span title="Noch kein Bild" className={i === activeIndex ? "text-blue-200" : "text-amber-500"}>○</span>
              )}
            </button>
          );
        })}
      </div>
      {missingImages > 0 && (
        <button onClick={onGenerateMissingImages} disabled={publishingDisabled}
          title="Erzeugt für alle Quizzes ohne Bild ein KI-Bild. Texte und Untertitel bleiben unberührt."
          className="w-full mt-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5 font-medium">
          <Sparkles className="w-4 h-4" />
          Fehlende Bilder generieren ({missingImages})
        </button>
      )}
      <button onClick={onPublish} disabled={publishingDisabled || missingImages > 0}
        title={missingImages > 0
          ? `${missingImages} Quizzes haben noch kein Bild. Zuerst „Fehlende Bilder generieren" klicken.`
          : "Erzeugt 27 JSON + 27 PDFs + 1 Sammel-PDF + 1 HTML-Übersicht als ZIP-Download."}
        className="w-full mt-1 px-3 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5 font-medium">
        <Download className="w-4 h-4" />
        Veröffentlichen (ZIP)
      </button>
    </div>
  );
}

function PublishingProgressPanel({ progress }: { progress: { current: number; total: number; phase: string } }) {
  const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 100;
  return (
    <div className="border-2 border-emerald-400 rounded-md bg-emerald-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
        <Loader2 className="w-4 h-4 animate-spin" />
        Veröffentlichen — {progress.phase}
        {progress.total > 0 && <span className="ml-1">({progress.current}/{progress.total})</span>}
      </div>
      <div className="w-full h-2 bg-stone-200 rounded overflow-hidden">
        <div className="h-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EditorPanel({ quiz, dispatch, canUndo, canRedo, onExport, onExportPdf, exportingPdf, onImport, onReset, styleProps, difficulty, setDifficulty, collection, bulkProgress, onSwitchQuiz, onBulkImport, onClearCollection, onRepairCollection, onPublish, publishing, onGenerateMissingImages }: {
  quiz: Quiz; dispatch: React.Dispatch<Action>; canUndo: boolean; canRedo: boolean;
  onExport: () => void; onExportPdf: () => void; exportingPdf: boolean;
  onImport: React.ChangeEventHandler<HTMLInputElement>; onReset: () => void;
  styleProps: ReturnType<typeof useStyleInstructions>;
  difficulty: Difficulty; setDifficulty: (d: Difficulty) => void;
  collection: QuizCollection | null;
  bulkProgress: BulkProgress | null;
  onSwitchQuiz: (index: number) => void;
  onBulkImport: (parsedQuizzes: ParsedQuiz[]) => void;
  onClearCollection: () => void;
  onRepairCollection: () => void;
  onPublish: () => void;
  publishing: { current: number; total: number; phase: string } | null;
  onGenerateMissingImages: () => void;
}) {
  const r = quiz.theme.readability;
  const darkTitle = isDark(quiz.theme.colors.title);
  const darkQuestion = isDark(quiz.theme.colors.question);
  const contrastWarn = (r.blockBackdrop !== "none" || r.scrim > 0.3) && (darkTitle || darkQuestion);
  const derivedTitle = deriveTitleFromQuestions(quiz);

  return (
    <div className="flex-shrink-0 space-y-2 overflow-y-auto pr-1" style={{ width: 400, height: "100%" }}>
      <div className="sticky top-0 bg-stone-100 pb-2 z-10 flex gap-1 flex-wrap">
        <button onClick={() => dispatch({ type: "UNDO" })} disabled={!canUndo} className="px-2 py-1 text-xs border border-stone-300 rounded bg-white hover:bg-stone-50 disabled:opacity-40 flex items-center gap-1"><Undo2 className="w-3 h-3" /> Undo</button>
        <button onClick={() => dispatch({ type: "REDO" })} disabled={!canRedo} className="px-2 py-1 text-xs border border-stone-300 rounded bg-white hover:bg-stone-50 disabled:opacity-40 flex items-center gap-1"><Redo2 className="w-3 h-3" /> Redo</button>
        <div className="flex-1" />
        <button onClick={onExport} className="px-2 py-1 text-xs border border-stone-300 rounded bg-white hover:bg-stone-50 flex items-center gap-1"><Download className="w-3 h-3" /> JSON</button>
        <button onClick={onExportPdf} disabled={exportingPdf || !quiz.theme.background?.image}
          className="px-2 py-1 text-xs border border-stone-300 rounded bg-white hover:bg-stone-50 disabled:opacity-40 flex items-center gap-1">
          {exportingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />} PDF
        </button>
        <label className="px-2 py-1 text-xs border border-stone-300 rounded bg-white hover:bg-stone-50 flex items-center gap-1 cursor-pointer">
          <Upload className="w-3 h-3" /> Import
          <input type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
        </label>
        <button onClick={onReset} className="px-2 py-1 text-xs border border-stone-300 rounded bg-white hover:bg-red-50 text-red-700">Reset</button>
      </div>

      {bulkProgress && bulkProgress.phase === "imaging" && (
        <BulkProgressPanel progress={bulkProgress} />
      )}

      {publishing && (
        <PublishingProgressPanel progress={publishing} />
      )}

      {collection && (
        <QuizCollectionPicker collection={collection} activeTitle={quiz.meta.title}
          onSwitch={onSwitchQuiz} onClear={onClearCollection} onRepair={onRepairCollection}
          onPublish={onPublish} publishingDisabled={!!publishing || !!bulkProgress}
          onGenerateMissingImages={onGenerateMissingImages} />
      )}

      <AIGeneratorPanel dispatch={dispatch} styleText={styleProps.styleText} styleImage={styleProps.styleImage}
        difficulty={difficulty} setDifficulty={setDifficulty}
        onBulkImport={onBulkImport} bulkDisabled={bulkProgress?.phase === "imaging"} />

      <Section title="Lesbarkeit" defaultOpen icon={<Eye className="w-4 h-4" />}>
        <div className="text-xs text-stone-500 mb-1">
          Diese Layer wirken erst sichtbar, wenn ein Hintergrund-Bild gesetzt ist.
        </div>
        <Field label={`Bild-Verdunkelung (Scrim)`}>
          <Slider value={Math.round(r.scrim * 100)} min={0} max={90} unit="%"
            onChange={e => dispatch({ type: "UPDATE_READABILITY", payload: { scrim: Number(e.target.value) / 100 } })} />
        </Field>
        <Field label={`Schrift-Schatten`}>
          <Slider value={Math.round(r.textShadow * 100)} min={0} max={100} unit="%"
            onChange={e => dispatch({ type: "UPDATE_READABILITY", payload: { textShadow: Number(e.target.value) / 100 } })} />
        </Field>
        <Field label={`Block-Hintergrund-Boxen`}>
          <Select value={r.blockBackdrop}
            onChange={e => dispatch({ type: "UPDATE_READABILITY", payload: { blockBackdrop: e.target.value } })}
            options={[
              { value: "none", label: "Keine" },
              { value: "subtle", label: "Dezent (42% Schwarz)" },
              { value: "strong", label: "Stark (62% Schwarz)" }
            ]} />
        </Field>
        {contrastWarn && (
          <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 flex items-start gap-2">
            <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium mb-1">Schriftfarben sind dunkel</div>
              <div className="mb-2">Auf dunklem Hintergrund kaum lesbar. Mit einem Klick alle Texte auf hell setzen:</div>
              <button onClick={() => dispatch({ type: "FORCE_LIGHT_COLORS" })}
                className="px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700">
                Alle Schriftfarben hell setzen
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Schriftgrößen" icon={<Eye className="w-4 h-4" />}>
        <div className="text-xs text-stone-500 mb-2">
          Pro-Quiz manuelle Anpassung. Auto-Fit skaliert den Content-Block (Titel/Intro/Preise/Fragen/Telefon) zusätzlich, damit er die Zone füllt — diese Werte sind die Basis-Größen.
        </div>
        {([
          { key: "title", label: "Titel", min: 20, max: 140 },
          { key: "intro", label: "Untertitel / Intro", min: 10, max: 60 },
          { key: "prize", label: "Preise (1000€…)", min: 14, max: 80 },
          { key: "question", label: "Fragen", min: 14, max: 90 },
          { key: "phone", label: "Telefonnummern", min: 10, max: 60 },
          { key: "telemedia", label: "Telemedia-Hinweis (klein)", min: 6, max: 24 },
          { key: "winners", label: "Gewinner-Text (Footer)", min: 8, max: 28 },
          { key: "terms", label: "Teilnahmebed. (Footer)", min: 8, max: 28 },
        ] as const).map(item => {
          const value = quiz.theme.fontSizes[item.key] ?? 0;
          return (
            <Field key={item.key} label={`${item.label} (${value}pt)`}>
              <Slider value={value} min={item.min} max={item.max} unit="pt"
                onChange={e => dispatch({ type: "UPDATE_FONT_SIZE", payload: { key: item.key, value: Number(e.target.value) } })} />
            </Field>
          );
        })}
      </Section>

      <Section title="Metadaten">
        <Field label="Titel (Headline)">
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs text-stone-600">
              <input type="checkbox" checked={quiz.meta.titleAuto}
                onChange={e => dispatch({ type: "SET_TITLE_AUTO", value: e.target.checked })} />
              Automatisch aus höchstdotierter Frage
            </label>
            {quiz.meta.titleAuto ? (
              <div className="px-2 py-1 text-sm bg-stone-50 border border-stone-200 rounded text-stone-700">
                {derivedTitle || <span className="italic text-stone-400">(noch keine Frage mit Preis)</span>}
              </div>
            ) : (
              <Input value={quiz.meta.title} onChange={e => dispatch({ type: "UPDATE_META", payload: { title: e.target.value } })} />
            )}
          </div>
        </Field>
        <Field label="Untertitel / Intro"><Textarea rows={3} value={quiz.meta.subtitle} onChange={e => dispatch({ type: "UPDATE_META", payload: { subtitle: e.target.value } })} /></Field>
        <Field label="Verlag"><Input value={quiz.meta.publisher} onChange={e => dispatch({ type: "UPDATE_META", payload: { publisher: e.target.value } })} /></Field>
        <Field label="Gewinner-Text"><Textarea rows={2} value={quiz.meta.winnersText} onChange={e => dispatch({ type: "UPDATE_META", payload: { winnersText: e.target.value } })} /></Field>
        <Field label="Teilnahmebedingungen"><Textarea rows={2} value={quiz.meta.termsText} onChange={e => dispatch({ type: "UPDATE_META", payload: { termsText: e.target.value } })} /></Field>
        <Field label="Hinweis unter Telefonnummern (klein)"><Textarea rows={2} value={quiz.meta.phoneTermsText} onChange={e => dispatch({ type: "UPDATE_META", payload: { phoneTermsText: e.target.value } })} /></Field>
      </Section>

      <Section title="Format & Layout">
        <Field label="Format">
          <Select value={quiz.layout.format} onChange={e => {
            const next = e.target.value;
            const payload: { format: string; orientation?: string } = { format: next };
            if (next === "schwedenraetsel") payload.orientation = "portrait";
            dispatch({ type: "UPDATE_LAYOUT", payload });
          }}
            options={[
              { value: "berliner_halbformat", label: "Berliner Halbformat (315×235)" },
              { value: "a4", label: "A4 (210×297)" },
              { value: "a5", label: "A5 (148×210)" },
              { value: "schwedenraetsel", label: "Schwedenrätsel (A4 Vorlage)" }
            ]} />
        </Field>
        <Field label="Orientierung">
          <Select value={quiz.layout.orientation}
            onChange={e => dispatch({ type: "UPDATE_LAYOUT", payload: { orientation: e.target.value } })}
            options={[{ value: "landscape", label: "Querformat" }, { value: "portrait", label: "Hochformat" }]} />
        </Field>
      </Section>

      <Section title={`Fragen (${quiz.questions.length})`}>
        <div className="text-xs text-stone-500 mb-1">
          Hinweis: Höchstdotierte Frage = Headline (1:1). Gesamter Inhalt wird automatisch verkleinert wenn er nicht passt.
        </div>
        <Field label="Anzahl Fragen">
          <Slider value={quiz.questions.length} min={1} max={20}
            onChange={e => dispatch({ type: "SET_QUESTION_COUNT", count: Number(e.target.value) })} />
        </Field>
        <div className="space-y-2 mt-2">
          {[...quiz.questions].reverse().map((q, i) => (
            <QuestionEditor key={q.id} question={q} index={i} prizes={quiz.prizes}
              onUpdate={payload => dispatch({ type: "UPDATE_QUESTION", id: q.id, payload })}
              onRemove={() => dispatch({ type: "REMOVE_QUESTION", id: q.id })} />
          ))}
        </div>
      </Section>

      <Section title={`Preise (${quiz.prizes.length})`} defaultOpen={false}>
        {quiz.prizes.map((p, i) => (
          <div key={p.id} className="flex gap-2 items-end">
            <div className="flex-1">
              <Field label={`Stufe ${i + 1}`}>
                <div className="flex gap-1">
                  <Input type="number" min={0} value={p.valueCents / 100}
                    onChange={e => dispatch({ type: "UPDATE_PRIZE", id: p.id, payload: { valueCents: Number(e.target.value) * 100 } })} />
                  <Select value={p.currency}
                    onChange={e => dispatch({ type: "UPDATE_PRIZE", id: p.id, payload: { currency: e.target.value } })}
                    options={[{ value: "EUR", label: "€" }, { value: "CHF", label: "CHF" }]} />
                </div>
              </Field>
            </div>
            <button onClick={() => dispatch({ type: "REMOVE_PRIZE", id: p.id })}
              className="px-2 py-1 border border-stone-300 rounded hover:bg-red-50"><Trash2 className="w-3 h-3 text-red-600" /></button>
          </div>
        ))}
        <button onClick={() => dispatch({ type: "ADD_PRIZE" })}
          className="w-full px-2 py-1 text-xs border border-stone-300 rounded hover:bg-stone-50 flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" /> Preis-Stufe hinzufügen
        </button>
      </Section>

      <Section title="Theme: Schrift & Farben" defaultOpen={false}>
        <Field label="Schriftart">
          <Select value={quiz.theme.fontFamily}
            onChange={e => dispatch({ type: "UPDATE_THEME", payload: { fontFamily: e.target.value } })}
            options={[
              { value: "Georgia, serif", label: "Georgia" },
              { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
              { value: "Times New Roman, serif", label: "Times New Roman" },
              { value: "Arial Black, sans-serif", label: "Arial Black" },
              { value: "Verdana, sans-serif", label: "Verdana" },
              { value: "Courier New, monospace", label: "Courier New" }
            ]} />
        </Field>
        <div className="pt-2 border-t border-stone-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-stone-500">Farben</div>
            <button onClick={() => dispatch({ type: "FORCE_LIGHT_COLORS" })}
              className="px-2 py-1 text-xs border border-stone-300 rounded bg-white hover:bg-stone-50 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> Alle hell
            </button>
          </div>
          {Object.entries(quiz.theme.colors).map(([key, val]) => (
            <div key={key} className="mb-2"><Field label={key}><ColorInput value={val} onChange={e => dispatch({ type: "UPDATE_COLOR", key, value: e.target.value })} /></Field></div>
          ))}
        </div>
        <div className="pt-2 border-t border-stone-200">
          <div className="text-xs text-stone-500 mb-2">Schriftgrößen (pt) — Werden bei Platzmangel automatisch verkleinert.</div>
          {Object.entries(quiz.theme.fontSizes).map(([key, val]) => (
            <div key={key} className="mb-2"><Field label={key}><Slider value={val} min={8} max={80} unit="pt"
              onChange={e => dispatch({ type: "UPDATE_FONTSIZE", key, value: Number(e.target.value) })} /></Field></div>
          ))}
        </div>
      </Section>

      <Section title="Hintergrund-Bild" defaultOpen={false}>
        <Field label="Bild-Upload (eigenes)">
          <input type="file" accept="image/*" className="text-xs w-full"
            onChange={e => {
              const f = e.target.files?.[0]; if (!f) return;
              const r = new FileReader();
              r.onload = () => dispatch({ type: "UPDATE_BACKGROUND", payload: { image: r.result as string } });
              r.readAsDataURL(f);
            }} />
        </Field>
        {quiz.theme.background?.image && (
          <button onClick={() => dispatch({ type: "UPDATE_BACKGROUND", payload: { image: null } })}
            className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50">Bild entfernen</button>
        )}
        <Field label="Opazität">
          <Slider value={Math.round((quiz.theme.background?.opacity ?? 1) * 100)} min={0} max={100} unit="%"
            onChange={e => dispatch({ type: "UPDATE_BACKGROUND", payload: { opacity: Number(e.target.value) / 100 } })} />
        </Field>
        <Field label="Position X">
          <Slider value={quiz.theme.background?.position?.x ?? 50} min={0} max={100} unit="%"
            onChange={e => dispatch({ type: "UPDATE_BG_POSITION", payload: { x: Number(e.target.value) } })} />
        </Field>
        <Field label="Position Y">
          <Slider value={quiz.theme.background?.position?.y ?? 50} min={0} max={100} unit="%"
            onChange={e => dispatch({ type: "UPDATE_BG_POSITION", payload: { y: Number(e.target.value) } })} />
        </Field>
      </Section>

      <Section title="Teilnahme" defaultOpen={false}>
        <Field label="Kosten pro Teilnahme (Cent)">
          <Input type="number" min={0} max={500} value={quiz.participation.costPerEntryCents}
            onChange={e => dispatch({ type: "UPDATE_PARTICIPATION", payload: { costPerEntryCents: Number(e.target.value) } })} />
        </Field>
        <Field label="Max. Teilnahmen pro User">
          <Input type="number" min={1} value={quiz.participation.maxEntriesPerUser ?? ""}
            onChange={e => dispatch({ type: "UPDATE_PARTICIPATION", payload: { maxEntriesPerUser: Number(e.target.value) || null } })} />
        </Field>
        <Field label="Ziehungs-Datum">
          <Input type="date" value={quiz.participation.drawDate}
            onChange={e => dispatch({ type: "UPDATE_PARTICIPATION", payload: { drawDate: e.target.value } })} />
        </Field>
      </Section>

      <StyleSettingsPanel
        styleText={styleProps.styleText} setStyleText={styleProps.setStyleText} resetText={styleProps.resetText}
        styleImage={styleProps.styleImage} setStyleImage={styleProps.setStyleImage} resetImage={styleProps.resetImage}
      />
    </div>
  );
}

function QuestionEditor({ question, index, prizes, onUpdate, onRemove }: {
  question: Question; index: number; prizes: PrizeTier[];
  onUpdate: (p: Partial<Question>) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const prize = prizes.find(p => p.id === question.prizeTierId);
  return (
    <div className="border border-stone-200 rounded bg-stone-50">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center px-2 py-1 text-left text-xs hover:bg-stone-100">
        <span className="w-6 text-stone-500 font-mono">{index + 1}.</span>
        <span className="flex-1 truncate">{question.text || "(ohne Text)"}</span>
        {prize && <span className="ml-1 text-stone-500 font-mono">{getPrizeLabel(prize)}</span>}
        {open ? <ChevronDown className="w-3 h-3 ml-1" /> : <ChevronRight className="w-3 h-3 ml-1" />}
      </button>
      {open && (
        <div className="p-2 space-y-2 border-t border-stone-200">
          <Field label="Fragetext"><Input value={question.text} onChange={e => onUpdate({ text: e.target.value })} /></Field>
          <Field label="Antworttyp">
            <Select value={question.answerType} onChange={e => onUpdate({ answerType: e.target.value as AnswerType })}
              options={[{ value: "text", label: "Freitext" }, { value: "choice", label: "Multiple Choice" }]} />
          </Field>
          {question.answerType === "choice" && (
            <Field label="Optionen (kommagetrennt)">
              <Input value={(question.options || []).join(", ")}
                onChange={e => onUpdate({ options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
            </Field>
          )}
          <Field label="Richtige Antwort"><Input value={question.correctAnswer || ""} onChange={e => onUpdate({ correctAnswer: e.target.value })} /></Field>
          <Field label="Preis-Stufe">
            <Select value={question.prizeTierId || prizes[0]?.id} onChange={e => onUpdate({ prizeTierId: e.target.value })}
              options={prizes.map(p => ({ value: p.id, label: getPrizeLabel(p) }))} />
          </Field>
          <Field label="Telefonnummer (optional)"><Input value={question.phoneNumber || ""} onChange={e => onUpdate({ phoneNumber: e.target.value })} /></Field>
          <Field label="Zeitlimit Sekunden (optional)">
            <Input type="number" min={0} value={question.timeLimitSeconds ?? ""}
              onChange={e => onUpdate({ timeLimitSeconds: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
          <button onClick={onRemove}
            className="w-full px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50 flex items-center justify-center gap-1">
            <Trash2 className="w-3 h-3" /> Frage löschen
          </button>
        </div>
      )}
    </div>
  );
}

function PreviewPane({ quiz, selectedBlockId, onSelectBlock }: { quiz: Quiz; selectedBlockId: string | null; onSelectBlock: (id: string | null) => void }) {
  const paneRef = useRef<HTMLDivElement>(null);
  const [paneSize, setPaneSize] = useState({ w: 600, h: 500 });
  const fmt = FORMATS[quiz.layout.format]?.[quiz.layout.orientation] || FORMATS.berliner_halbformat.landscape;
  const aspect = fmt.w / fmt.h;
  const internal = aspect >= 1 ? { w: 900, h: 900 / aspect } : { w: 700 * aspect, h: 700 };
  useEffect(() => {
    if (!paneRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setPaneSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(paneRef.current);
    return () => ro.disconnect();
  }, []);
  const padding = 24;
  const scaleX = (paneSize.w - padding * 2) / internal.w;
  const scaleY = (paneSize.h - padding * 2) / internal.h;
  const scale = Math.max(0.1, Math.min(scaleX, scaleY, 1));
  return (
    <div ref={paneRef} className="flex-1 bg-stone-200 rounded relative overflow-hidden flex items-center justify-center"
      style={{ minHeight: 500 }} onClick={() => onSelectBlock(null)}>
      <div style={{ width: internal.w * scale, height: internal.h * scale, position: "relative" }}>
        <div style={{
          width: internal.w, height: internal.h,
          transform: `scale(${scale})`, transformOrigin: "top left",
          position: "absolute", top: 0, left: 0,
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)"
        }} onClick={e => e.stopPropagation()}>
          <PreviewRenderer quiz={quiz} width={internal.w} height={internal.h}
            selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock} />
        </div>
      </div>
      <div className="absolute top-2 right-2 text-xs text-stone-600 bg-white/85 px-2 py-1 rounded font-mono">
        {quiz.layout.format} · {quiz.layout.orientation} · {(scale * 100).toFixed(0)}%
      </div>
      {selectedBlockId && (
        <div className="absolute top-2 left-2 text-xs text-stone-700 bg-white/85 px-2 py-1 rounded">
          Ausgewählt: <span className="font-mono">{selectedBlockId}</span>
        </div>
      )}
    </div>
  );
}

function PreviewRenderer({ quiz, width, height, selectedBlockId, onSelectBlock }: {
  quiz: Quiz; width: number; height: number;
  selectedBlockId: string | null; onSelectBlock: (id: string | null) => void;
}) {
  if (quiz.layout.format === "schwedenraetsel") {
    return <SchwedenraetselRenderer quiz={quiz} width={width} height={height} />;
  }
  const { theme, meta, questions, prizes } = quiz;
  const bg = theme.background || { image: null, opacity: 1, position: { x: 50, y: 50 } };
  const r = theme.readability;
  const shadow = buildTextShadow(r.textShadow);
  const showBackdrop = !!bg.image && r.blockBackdrop !== "none";
  const titleText = effectiveTitle(quiz);

  // Width-scale factor: editor preview uses width=900 as baseline. When rendered
  // at higher resolution (e.g. 1800 for PDF), multiply all absolute pt values
  // and pixel offsets by this factor so the layout looks proportionally identical.
  const widthScale = width / 900;

  const Block = ({ id, children, style, align = "left", inline = false }: { id: string; children: React.ReactNode; style?: React.CSSProperties; align?: "left" | "center" | "right"; inline?: boolean }) => {
    const selected = selectedBlockId === id;
    const wrapperOuter: React.CSSProperties = {
      ...style,
      outline: selected ? "3px solid #3B82F6" : "none",
      outlineOffset: 6,
      cursor: "pointer",
      position: style?.position || "relative",
      textShadow: shadow
    };
    if (!showBackdrop) {
      return <div data-block-id={id} onClick={e => { e.stopPropagation(); onSelectBlock(id); }} style={wrapperOuter}>{children}</div>;
    }
    const backdrop = blockBackdropContainerStyle(r.blockBackdrop, align);
    if (inline) {
      return (
        <div data-block-id={id} onClick={e => { e.stopPropagation(); onSelectBlock(id); }} style={wrapperOuter}>
          <span style={backdrop}>{children}</span>
        </div>
      );
    }
    const align2: React.CSSProperties = align === "center" ? { display: "flex", justifyContent: "center" } :
                                          align === "right" ? { display: "flex", justifyContent: "flex-end" } :
                                          { display: "flex", justifyContent: "flex-start" };
    return (
      <div data-block-id={id} onClick={e => { e.stopPropagation(); onSelectBlock(id); }} style={wrapperOuter}>
        <div style={align2}><span style={backdrop}>{children}</span></div>
      </div>
    );
  };

  const padX = width * 0.05;
  const padY = height * 0.03;
  const footerHeight = Math.max(60, height * 0.11);
  const footerScrimHeight = footerHeight + 20;
  const contentBottomGap = 16; // gap between content area and footer

  const smileySize = Math.min(width, height) * 0.35;
  const showSmiley = !bg.image;

  // Wrap the whole content (headline + intro + questions) in a single auto-fit block.
  // This way headline + questions together never exceed the available height above the footer.
  const contentZoneRef = useRef<HTMLDivElement>(null);
  const contentInnerRef = useRef<HTMLDivElement>(null);
  // Iterative auto-fit: measures the VISIBLE container (which renders with current
  // contentScale) and adjusts up or down until content fills 90-96% of zone height.
  // Convergence guaranteed by max-iteration counter and step-size constraints.
  const visibleInnerRef = useRef<HTMLDivElement>(null);
  const iterCountRef = useRef(0);
  // Largest scale we have observed to NOT overflow — used as fallback when the
  // iteration cap is reached while still overflowing (oscillation due to
  // wrap nonlinearity).
  const bestSafeScaleRef = useRef(0.3);
  const [contentScale, setContentScale] = useState(1);
  useLayoutEffect(() => {
    iterCountRef.current = 0;
    bestSafeScaleRef.current = 0.3;
  }, [
    width, height, quiz.questions.length,
    titleText, meta.subtitle,
    quiz.theme.fontSizes.title, quiz.theme.fontSizes.intro,
    quiz.theme.fontSizes.question, quiz.theme.fontSizes.prize, quiz.theme.fontSizes.phone,
    ...quiz.questions.map(q => q.text + (q.phoneNumber || ""))
  ]);
  useLayoutEffect(() => {
    const zone = contentZoneRef.current;
    const visible = visibleInnerRef.current;
    if (!zone || !visible) return;
    const zoneH = zone.clientHeight;
    const renderedH = visible.scrollHeight;
    if (zoneH <= 0 || renderedH <= 0) return;

    // Record the largest scale that produced no overflow at this content.
    if (renderedH <= zoneH && contentScale > bestSafeScaleRef.current) {
      bestSafeScaleRef.current = contentScale;
    }

    if (iterCountRef.current >= 30) {
      if (renderedH > zoneH && bestSafeScaleRef.current < contentScale) {
        setContentScale(bestSafeScaleRef.current);
      }
      return;
    }

    // Aim for 97% fill — Priorität "Volle Platzausnutzung". Lieber etwas
    // randvoll als deutlich leer.
    const targetH = zoneH * 0.97;
    const ratio = targetH / renderedH;
    // Konvergenz-Band [0.93, 1.07] — stabil, aber so eng wie's Wrapping zulässt.
    if (ratio >= 0.93 && ratio <= 1.07) return;
    // Scale-Cap 2.5 bleibt.
    const newScale = Math.max(0.3, Math.min(2.5, contentScale * ratio));
    const rounded = Math.round(newScale * 100) / 100;
    if (rounded !== contentScale) {
      iterCountRef.current += 1;
      setContentScale(rounded);
    }
  });
  const longestQuestionLen = Math.max(0, ...questions.map(q => (q.text || "").length));
  const titleLen = titleText.length;

  // Reserved zone for content: from top padding down to start of footer
  const contentZoneHeight = height - 2 * padY - footerHeight - contentBottomGap;

  // Render the inner content block. Used both for visible rendering (with current
  // contentScale) and for the hidden measure container (always at scale=1).
  // The `forMeasure` flag suppresses click handlers and outlines for the hidden version.
  // `distribute=true` wraps the content in a flex-space-between layout so dass der
  // Titel-Block oben und die Fragen unten kleben (visuelle Variante). Im
  // forMeasure-Pfad steht distribute=false, damit scrollHeight die natürliche
  // Gesamthöhe für den Auto-Fit liefert.
  const renderContentBody = (s: number, forMeasure: boolean, distribute = false) => {
    const sw = s * widthScale;
    const onClickProp = forMeasure ? () => {} : undefined;
    const showSelect = !forMeasure;
    return (
      <div style={{
        width: "100%",
        height: distribute ? "100%" : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // distribute=true: Titel-Gruppe oben, Fragen-Gruppe füllt Rest mit
        // flex:1 + interner space-around-Verteilung (siehe unten).
        // distribute=false: natürliches flex-start für scrollHeight-Messung.
        justifyContent: "flex-start"
      }}>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {titleText && (() => {
          // Title-Length-Scaling nur noch als Notausgang für extreme Titel.
          // Auto-Fit shrinkt jetzt den Gesamt-Content (große Base-FontSizes)
          // — übernimmt die Hauptarbeit für die Platzausnutzung.
          const titleFactor = titleText.length > 100 ? 0.85
            : titleText.length > 75 ? 0.92
            : 1.0;
          return (
            <Block id="title" align="center"
              style={{
                color: theme.colors.title,
                fontSize: `${theme.fontSizes.title * sw * titleFactor}pt`,
                fontWeight: "bold",
                textAlign: "center",
                lineHeight: 1.05,
                marginBottom: 6 * sw,
                width: "100%"
              }}>
              {titleText}
            </Block>
          );
        })()}
        {meta.subtitle && (
          <Block id="intro" align="center"
            style={{
              color: theme.colors.intro,
              fontSize: `${theme.fontSizes.intro * sw}pt`,
              fontWeight: "bold",
              lineHeight: 1.4,
              textAlign: "center",
              maxWidth: "78%",
              marginBottom: 10 * sw
            }}>
            {meta.subtitle}
          </Block>
        )}
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: `auto 1fr auto`,
          columnGap: 48 * sw,
          rowGap: 16 * sw,
          width: "100%",
          alignItems: "baseline"
        }}>
            {[...questions].reverse().map((q) => {
              const prize = prizes.find(p => p.id === q.prizeTierId) || prizes[0];
              const hasContent = q.text || q.phoneNumber;
              if (!hasContent) return null;
              return (
                <Fragment key={q.id}>
                  <Block id={`prize_${q.id}`} align="right" inline
                    style={{ color: theme.colors.prize, fontSize: `${theme.fontSizes.prize * sw}pt`, fontWeight: "bold", textAlign: "right", whiteSpace: "nowrap" }}>
                    {prize ? getPrizeLabel(prize) : ""}
                  </Block>
                  <Block id={`question_${q.id}`} align="left" inline
                    style={{ color: theme.colors.question, fontSize: `${theme.fontSizes.question * sw}pt`, fontWeight: "bold" }}>
                    {q.text}
                  </Block>
                  {q.phoneNumber ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                      <Block id={`phone_${q.id}`} align="right" inline
                        style={{ color: theme.colors.phone, fontSize: `${theme.fontSizes.phone * sw}pt`, fontWeight: "bold", whiteSpace: "nowrap" }}>
                        {q.phoneNumber}
                      </Block>
                      {meta.phoneTermsText && (
                        <div style={{
                          color: theme.colors.terms,
                          fontSize: `${(theme.fontSizes.telemedia ?? 11) * sw}pt`,
                          fontWeight: "bold",
                          opacity: 0.95,
                          textAlign: "right",
                          marginTop: 2 * sw,
                          textShadow: forMeasure ? "none" : shadow,
                          maxWidth: 320 * sw,
                          lineHeight: 1.2
                        }}>
                          {meta.phoneTermsText}
                        </div>
                      )}
                    </div>
                  ) : <div />}
                </Fragment>
              );
            })}
          </div>
      </div>
    );
  };

  return (
    <div style={{ width, height, position: "relative", background: bg.image ? "#1E3A8A" : "#FFFFFF", fontFamily: theme.fontFamily, overflow: "hidden", color: "white" }}>
      {bg.image ? (
        <>
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${bg.image})`, backgroundSize: "cover",
            backgroundPosition: `${bg.position?.x ?? 50}% ${bg.position?.y ?? 50}%`,
            opacity: bg.opacity ?? 1
          }} />
          {r.scrim > 0 && (
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(to bottom, rgba(0,0,0,${(r.scrim * 1.0).toFixed(2)}), rgba(0,0,0,${(r.scrim * 0.85).toFixed(2)}))`,
              pointerEvents: "none"
            }} />
          )}
          <div style={{
            position: "absolute",
            left: 0, right: 0, bottom: 0,
            height: footerScrimHeight,
            background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0) 100%)",
            pointerEvents: "none"
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.35) 100%)",
            pointerEvents: "none"
          }} />
        </>
      ) : showSmiley && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.85,
          pointerEvents: "none"
        }}>
          <SmileyPlaceholder size={smileySize} />
        </div>
      )}

      {/* CONTENT ZONE — strictly bounded above the footer.
          Enthält zwei Rendering-Pässe:
          (1) versteckter Measure-Pfad mit visibleInnerRef → liefert natürliche
              Gesamt-Höhe via scrollHeight, an dem der Auto-Fit-Scale konvergiert.
          (2) sichtbarer Distribution-Pfad → Titel-Gruppe oben, Fragen-Gruppe
              unten, dazwischen wandert restlicher Platz. Verhindert Leere oben/unten. */}
      <div ref={contentZoneRef} style={{
        position: "absolute",
        top: padY,
        left: padX,
        right: padX,
        height: contentZoneHeight,
        overflow: "hidden"
      }}>
        {/* Hidden measure pass — natural top-aligned flex column */}
        <div ref={visibleInnerRef} style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          visibility: "hidden",
          pointerEvents: "none"
        }}>
          {renderContentBody(contentScale, true, false)}
        </div>

        {/* Visible pass — vertically centered. Auto-fit skaliert den Content auf
            ~93% der Zone, sodass oben und unten gleich wenig Restplatz bleibt. */}
        <div style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center"
        }}>
          {renderContentBody(contentScale, false, false)}
        </div>
      </div>

      {/* FOOTER ZONE — fixed at bottom, strictly separate from content */}
      {bg.image && (
        <div style={{
          position: "absolute",
          left: padX, right: padX, bottom: padY,
          height: footerHeight,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 20 * widthScale,
          lineHeight: 1.3
        }}>
          <Block id="winners" align="left"
            style={{ color: theme.colors.winners, maxWidth: "45%", fontSize: `${(theme.fontSizes.winners ?? 13) * widthScale}pt` }}>
            {meta.winnersText}
          </Block>
          <Block id="terms" align="right"
            style={{ color: theme.colors.terms, maxWidth: "45%", textAlign: "right", fontSize: `${(theme.fontSizes.terms ?? 13) * widthScale}pt` }}>
            {meta.termsText}
          </Block>
        </div>
      )}
    </div>
  );
}

type SwCell =
  | { kind: "letter"; highlight?: boolean; highlightIndex?: number }
  | { kind: "clue"; text: string; arrow: "right" | "down" }
  | { kind: "block" };

const SW_COLS = 12;
const SW_ROWS = 11;
const SW_SOLUTION_LEN = 7;

const SW_TITLE = "Gewinnen Sie jeden Tag 1'000 Euro!";
const SW_FONT_FAMILY = `var(--font-geist-sans), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const SW_PHONE_FALLBACK = "01378 802725";
const SW_PHONE_HEADLINE = "Teilnehmen und 1'000 Euro gewinnen!";
const SW_TELEMEDIA = "Telemedia interactive GmbH, 0,50€ pro Anruf aus dem dt. Festnetz, Mobilfunk teurer";
const SW_FOOTER_LEFT = "Gewinnerinnen und Gewinner werden hier veröffentlicht";
const SW_FOOTER_RIGHT = "Teilnahmebedingungen unter 0800 890 890 / Dieser Anruf ist kostenlos. Zu diesem Gewinnspiel wird keine Korrespondenz geführt.";

const SW_CLUES: { row: number; col: number; text: string; arrow: "right" | "down" }[] = [
  { row: 0, col: 0, text: "Haupt-\nstadt FR", arrow: "right" },
  { row: 0, col: 5, text: "Italien.\nNudel", arrow: "down" },
  { row: 0, col: 9, text: "Symbol\nGold", arrow: "down" },
  { row: 2, col: 0, text: "Größter\nPlanet", arrow: "right" },
  { row: 3, col: 7, text: "Längster\nFluss DE", arrow: "right" },
  { row: 4, col: 3, text: "Erfinder\nGlüh-\nbirne", arrow: "down" },
  { row: 6, col: 0, text: "Wiener\nSchnitzel\nLand", arrow: "right" },
  { row: 7, col: 9, text: "Edel-\nmetall\nAg", arrow: "down" },
  { row: 9, col: 2, text: "Saiten-\ninstr.", arrow: "right" },
  { row: 10, col: 6, text: "Hellster\nStern", arrow: "down" },
];

// 7 Highlights, unregelmäßig über das Gitter verstreut wie bei echten
// Schwedenrätseln. Index 0..6 entspricht den Lösungswort-Positionen 1..7.
const SW_HIGHLIGHTS: { row: number; col: number }[] = [
  { row: 1, col: 2 },
  { row: 2, col: 8 },
  { row: 4, col: 6 },
  { row: 5, col: 10 },
  { row: 7, col: 2 },
  { row: 8, col: 7 },
  { row: 10, col: 9 },
];

const SW_BLOCKS: { row: number; col: number }[] = [
  { row: 5, col: 0 }, { row: 8, col: 11 },
];

function buildSwGrid(): SwCell[][] {
  const grid: SwCell[][] = Array.from({ length: SW_ROWS }, () =>
    Array.from({ length: SW_COLS }, () => ({ kind: "letter" } as SwCell))
  );
  for (const c of SW_CLUES) if (grid[c.row]?.[c.col]) grid[c.row][c.col] = { kind: "clue", text: c.text, arrow: c.arrow };
  for (let i = 0; i < SW_HIGHLIGHTS.length; i++) {
    const h = SW_HIGHLIGHTS[i];
    if (grid[h.row]?.[h.col] && grid[h.row][h.col].kind === "letter") {
      grid[h.row][h.col] = { kind: "letter", highlight: true, highlightIndex: i + 1 };
    }
  }
  for (const b of SW_BLOCKS) if (grid[b.row]?.[b.col]) grid[b.row][b.col] = { kind: "block" };
  return grid;
}

function SwArrow({ dir, size }: { dir: "right" | "down"; size: number }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" style={{ display: "block" }}>
      {dir === "right"
        ? <path d="M 3 4 L 11 8 L 3 12 Z" fill="#1a1a1a" />
        : <path d="M 4 3 L 12 3 L 8 11 Z" fill="#1a1a1a" />}
    </svg>
  );
}

function SchwedenraetselRenderer({ quiz, width, height }: { quiz: Quiz; width: number; height: number }) {
  const { theme } = quiz;
  const bg = theme.background || { image: null, opacity: 1, position: { x: 50, y: 50 } };
  const grid = buildSwGrid();

  const sidePad = width * 0.05;
  const topPad = height * 0.045;
  const bottomPad = height * 0.018;
  const headlineH = height * 0.075;
  const gapAfterHead = height * 0.022;
  const gapAfterGrid = height * 0.022;
  const gapAfterSolution = height * 0.03;

  // Bottom stack typography. Hierarchie (groß → klein):
  // SW_TITLE > phoneHeadline > phoneNumber > telemedia.
  // SW_TITLE-Schrift = headlineH * 0.55 ≈ 0.041 * height (Referenzgröße).
  const phoneHeadlineFs = height * 0.020;
  const phoneNumberFs = height * 0.018;
  const telemediaFs = height * 0.014;
  const phoneInnerGap = height * 0.005;
  const phoneHeadlineH = phoneHeadlineFs * 1.3;
  const phoneNumberH = phoneNumberFs * 1.4;
  const telemediaH = telemediaFs * 1.5;
  const phoneSectionH = phoneHeadlineH + phoneNumberH + telemediaH + 2 * phoneInnerGap;

  // Combined block: Phone-Sektion + Footer-Sektion in einer abgerundeten Box.
  const combinedVPad = height * 0.014;
  const combinedHPad = width * 0.035;
  const combinedSectionGap = height * 0.012;
  const footerSectionFs = height * 0.011;
  const footerSectionH = footerSectionFs * 2.5;
  const combinedTotalH = combinedVPad * 2 + phoneSectionH + combinedSectionGap + footerSectionH;

  const widthBasedCell = (width - 2 * sidePad) / SW_COLS;
  const solutionCellSize = widthBasedCell * 1.1;
  const solutionCellGap = solutionCellSize * 0.05;

  const gridTop = topPad + headlineH + gapAfterHead;
  const gridAvailH = height
    - gridTop
    - gapAfterGrid
    - solutionCellSize
    - gapAfterSolution
    - combinedTotalH
    - bottomPad;
  const heightBasedCell = gridAvailH / SW_ROWS;
  const cellSize = Math.min(widthBasedCell, heightBasedCell);
  const gridW = cellSize * SW_COLS;
  const gridH = cellSize * SW_ROWS;
  const gridLeft = (width - gridW) / 2;

  const solutionTop = gridTop + gridH + gapAfterGrid;
  // Rechtsbündig zur rechten Gitter-Kante.
  const solutionTotalW = solutionCellSize * SW_SOLUTION_LEN + solutionCellGap * (SW_SOLUTION_LEN - 1);
  const solutionLeft = gridLeft + gridW - solutionTotalW;

  const combinedTop = solutionTop + solutionCellSize + gapAfterSolution;

  const phoneNumber = quiz.questions[0]?.phoneNumber || SW_PHONE_FALLBACK;

  return (
    <div style={{ width, height, position: "relative", background: bg.image ? "#1E3A8A" : "#F5F5F0", fontFamily: SW_FONT_FAMILY, overflow: "hidden" }}>
      {bg.image && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${bg.image})`,
          backgroundSize: "cover",
          backgroundPosition: `${bg.position?.x ?? 50}% ${bg.position?.y ?? 50}%`,
          opacity: bg.opacity ?? 1,
        }} />
      )}
      <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.08)" }} />

      <div style={{
        position: "absolute", left: sidePad, right: sidePad, top: topPad, height: headlineH,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#1a1a1a",
        fontSize: headlineH * 0.55, fontWeight: 700, letterSpacing: "0.02em",
        textShadow: bg.image ? "0 2px 8px rgba(255,255,255,0.6)" : "none",
        textAlign: "center", lineHeight: 1.05,
      }}>
        {SW_TITLE}
      </div>

      <div style={{
        position: "absolute", left: gridLeft, top: gridTop, width: gridW, height: gridH,
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
      }}>
        {grid.map((row, r) => row.map((cell, c) => {
          const left = c * cellSize;
          const top = r * cellSize;
          const baseStyle: React.CSSProperties = {
            position: "absolute", left, top, width: cellSize, height: cellSize,
            border: "0.5px solid rgba(0,0,0,0.45)",
            boxSizing: "border-box",
          };
          if (cell.kind === "block") {
            return <div key={`${r}-${c}`} style={{ ...baseStyle, background: "rgba(40,40,40,0.78)" }} />;
          }
          if (cell.kind === "clue") {
            return (
              <div key={`${r}-${c}`} style={{
                ...baseStyle,
                background: "rgba(220,220,220,0.82)",
                padding: cellSize * 0.06,
                fontSize: cellSize * 0.18,
                lineHeight: 1.05,
                color: "#1a1a1a",
                fontWeight: 500,
                whiteSpace: "pre-line",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}>
                <div style={{ flex: 1, overflow: "hidden" }}>{cell.text}</div>
                <div style={{ alignSelf: cell.arrow === "right" ? "flex-end" : "flex-start" }}>
                  <SwArrow dir={cell.arrow} size={cellSize * 0.32} />
                </div>
              </div>
            );
          }
          const isHighlight = cell.highlight;
          return (
            <div key={`${r}-${c}`} style={{
              ...baseStyle,
              background: isHighlight ? "rgba(255,210,90,0.55)" : "rgba(255,255,255,0.55)",
              position: "absolute",
            }}>
              {isHighlight && cell.highlightIndex && (
                <span style={{
                  position: "absolute",
                  right: cellSize * 0.08,
                  bottom: cellSize * 0.02,
                  fontSize: cellSize * 0.18,
                  color: "rgba(40,40,40,0.85)",
                  fontWeight: 600,
                  lineHeight: 1,
                }}>
                  {cell.highlightIndex}
                </span>
              )}
            </div>
          );
        }))}
      </div>

      <div style={{
        position: "absolute", left: solutionLeft, top: solutionTop,
        display: "flex", gap: solutionCellGap,
      }}>
        {Array.from({ length: SW_SOLUTION_LEN }).map((_, i) => (
          <div key={i} style={{
            width: solutionCellSize, height: solutionCellSize,
            background: "rgba(255,210,90,0.55)",
            border: "1px solid rgba(0,0,0,0.5)",
            boxSizing: "border-box",
            position: "relative",
          }}>
            <span style={{
              position: "absolute",
              right: solutionCellSize * 0.08,
              bottom: solutionCellSize * 0.02,
              fontSize: solutionCellSize * 0.18,
              color: "rgba(40,40,40,0.85)",
              fontWeight: 600,
              lineHeight: 1,
            }}>
              {i + 1}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        position: "absolute",
        left: gridLeft, width: gridW,
        top: combinedTop, height: combinedTotalH,
        background: "rgba(255,210,90,0.55)",
        border: "1px solid rgba(0,0,0,0.5)",
        borderRadius: height * 0.016,
        boxSizing: "border-box",
        padding: `${combinedVPad}px ${combinedHPad}px`,
        display: "flex", flexDirection: "column",
        gap: combinedSectionGap,
      }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
          gap: phoneInnerGap,
        }}>
          <div style={{
            height: phoneHeadlineH, display: "flex", alignItems: "center",
            fontSize: phoneHeadlineFs, fontWeight: 800, color: "#1a1a1a", letterSpacing: "0.01em",
          }}>
            {SW_PHONE_HEADLINE}
          </div>
          <div style={{
            height: phoneNumberH, display: "flex", alignItems: "center",
            fontSize: phoneNumberFs, fontWeight: 700, color: "#1a1a1a", letterSpacing: "0.04em",
          }}>
            {phoneNumber}
          </div>
          <div style={{
            height: telemediaH, display: "flex", alignItems: "center",
            fontSize: telemediaFs, color: "#222",
          }}>
            {SW_TELEMEDIA}
          </div>
        </div>
        <div style={{
          height: footerSectionH,
          borderTop: "1px solid rgba(0,0,0,0.22)",
          paddingTop: combinedSectionGap * 0.5,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: width * 0.02,
          fontSize: footerSectionFs, color: "#1a1a1a", lineHeight: 1.2,
        }}>
          <div style={{ maxWidth: "45%", textAlign: "left" }}>{SW_FOOTER_LEFT}</div>
          <div style={{ maxWidth: "53%", textAlign: "right" }}>{SW_FOOTER_RIGHT}</div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: defaultQuiz, future: [] });
  const quiz = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const styleProps = useStyleInstructions();
  const [difficulty, setDifficulty] = useDifficulty();
  const [exportingPdf, setExportingPdf] = useState(false);
  const pdfTargetRef = useRef<HTMLDivElement>(null);

  const [collection, setCollection] = useState<QuizCollection | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [publishing, setPublishing] = useState<{ current: number; total: number; phase: string } | null>(null);
  // Markiert, ob das initiale Hydrieren aus localStorage durch ist — verhindert,
  // dass der "leere" Initial-State beim ersten Render localStorage überschreibt.
  const hydratedRef = useRef(false);

  // Beim Mount aus IndexedDB laden. Migriert evtl. vorhandene localStorage-Daten
  // (alte Version) einmalig in die IDB.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let saved = await idbLoadCollection();
        if (!saved) {
          // Migration: alten localStorage-Eintrag rüberziehen, falls vorhanden
          const raw = localStorage.getItem(COLLECTION_STORAGE_KEY);
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as QuizCollection;
              if (parsed?.quizzes?.length) {
                await idbSaveCollection(parsed);
                saved = parsed;
                localStorage.removeItem(COLLECTION_STORAGE_KEY);
                console.info("Sammlung aus localStorage in IndexedDB migriert.");
              }
            } catch { /* ignore parse errors */ }
          }
        }
        if (cancelled) return;
        if (saved?.quizzes?.length) {
          const idx = Math.min(Math.max(saved.activeIndex || 0, 0), saved.quizzes.length - 1);
          setCollection({ quizzes: saved.quizzes, activeIndex: idx });
          dispatch({ type: "LOAD_QUIZ", payload: saved.quizzes[idx] });
        }
      } catch (e) {
        console.warn("Konnte gespeicherte Sammlung nicht laden:", e);
      } finally {
        hydratedRef.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persistiert die Sammlung in IndexedDB. Debounced via Timer, damit schnelle
  // Folge-Updates (jeder Tastendruck im Editor) nicht 100 Schreibzugriffe lösen.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      (async () => {
        try {
          if (!collection) {
            await idbClearCollection();
            return;
          }
          await idbSaveCollection(collection);
        } catch (e) {
          console.warn("Konnte Sammlung nicht persistieren:", e);
        }
      })();
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [collection]);

  // Hält collection.quizzes[activeIndex] mit dem laufenden Editor-State (history.present)
  // in Sync — sonst gingen Edits beim Wechsel des aktiven Quiz verloren.
  useEffect(() => {
    if (!collection) return;
    if (collection.quizzes[collection.activeIndex] === quiz) return;
    setCollection({
      ...collection,
      quizzes: collection.quizzes.map((q, i) => i === collection.activeIndex ? quiz : q),
    });
  }, [quiz, collection]);

  const handleSwitchQuiz = (newIndex: number) => {
    if (!collection) return;
    if (newIndex < 0 || newIndex >= collection.quizzes.length) return;
    if (newIndex === collection.activeIndex) return;
    // Sicherheitssicht: aktiven Editor-Stand wegspeichern (der Sync-Effect macht
    // das normalerweise schon, aber bei direkt aufeinanderfolgenden Wechseln
    // wollen wir keinen Edit verlieren).
    const snapshot = collection.quizzes.map((q, i) => i === collection.activeIndex ? quiz : q);
    setCollection({ quizzes: snapshot, activeIndex: newIndex });
    dispatch({ type: "LOAD_QUIZ", payload: snapshot[newIndex] });
  };

  const handleClearCollection = () => {
    if (!confirm("Sammlung schließen? Wird auch aus dem lokalen Speicher entfernt.")) return;
    setCollection(null);
  };

  // Quiz-Override für den Offscreen-PDF-Renderer während des Publish-Vorgangs.
  // Wenn null, rendert pdfTargetRef.current das aktive `quiz` (wie sonst).
  // Wenn gesetzt, rendert er das übergebene Quiz — so können wir nacheinander
  // alle 27 abgreifen, ohne den Editor-State zu verändern.
  const [publishingQuiz, setPublishingQuiz] = useState<Quiz | null>(null);

  const handlePublish = async () => {
    if (!collection || !pdfTargetRef.current) return;
    setPublishing({ current: 0, total: collection.quizzes.length, phase: "Bereite vor…" });
    try {
      const [{ default: JSZip }, { domToJpeg }, { default: jsPDF }] = await Promise.all([
        import("jszip"),
        import("modern-screenshot"),
        import("jspdf"),
      ]);

      const zip = new JSZip();
      const cardImages: string[] = [];
      let combined: InstanceType<typeof jsPDF> | null = null;

      for (let i = 0; i < collection.quizzes.length; i++) {
        const q = collection.quizzes[i];
        setPublishingQuiz(q);
        setPublishing({ current: i + 1, total: collection.quizzes.length, phase: "Karten rendern" });

        // Auf Re-Render + Font-Load warten (analog handleExportPdf).
        await new Promise(r => setTimeout(r, 100));
        await new Promise(r => setTimeout(r, 600));

        // Zwei Captures: hochauflösend (scale 3) für PDFs (druckfähig),
        // moderat (scale 1.5) für die HTML-Übersicht (web-tauglich, kleinere Dateien).
        // Vorher: scale 4 für alles → 67 MB index.html, über Cloudflare-Limit.
        const imgDataHi = await domToJpeg(pdfTargetRef.current!, { scale: 3, quality: 0.88 });
        const imgDataLo = await domToJpeg(pdfTargetRef.current!, { scale: 1.5, quality: 0.85 });
        cardImages.push(imgDataLo);

        const fmt = FORMATS[q.layout.format]?.[q.layout.orientation] || FORMATS.berliner_halbformat.landscape;
        const orientation: "portrait" | "landscape" = q.layout.orientation === "landscape" ? "landscape" : "portrait";

        const onePdf = new jsPDF({ orientation, unit: "mm", format: [fmt.w, fmt.h] });
        onePdf.addImage(imgDataHi, "JPEG", 0, 0, fmt.w, fmt.h);
        const onePdfBlob = onePdf.output("blob");

        if (!combined) {
          combined = new jsPDF({ orientation, unit: "mm", format: [fmt.w, fmt.h] });
        } else {
          combined.addPage([fmt.w, fmt.h], orientation);
        }
        combined.addImage(imgDataHi, "JPEG", 0, 0, fmt.w, fmt.h);

        // ASCII-only Filenames — Umlaute transliterieren, dann strippen.
        // Vorher: K+?che → mit macOS unzip nicht extrahierbar.
        const safeName = (effectiveTitle(q) || `quiz_${i + 1}`)
          .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
          .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue")
          .replace(/ß/g, "ss")
          .replace(/[^a-zA-Z0-9]/g, "_")
          .slice(0, 60);
        const baseName = `${(i + 1).toString().padStart(2, "0")}_${safeName}`;
        zip.file(`${baseName}.json`, JSON.stringify(q, null, 2));
        zip.file(`${baseName}.pdf`, onePdfBlob);
      }

      setPublishing({ current: collection.quizzes.length, total: collection.quizzes.length, phase: "Sammel-PDF + HTML" });
      if (combined) {
        zip.file("alle_quizzes.pdf", combined.output("blob"));
      }
      zip.file("index.html", buildViewerHtml(collection.quizzes, cardImages));
      zip.file("README.txt",
        "Wissensquiz-Veröffentlichung\n\n" +
        "Entpacken in dein Projekt:\n" +
        "  unzip -o wissensquiz-publish-*.zip -d ./public/quizzes/\n\n" +
        "Anschließend:\n" +
        "  git add public/quizzes && git commit -m \"Quiz-Update\" && git push\n\n" +
        "Cloudflare Pages deployt nach dem Push automatisch.\n"
      );

      setPublishing({ current: 0, total: 0, phase: "ZIP packen" });
      const zipBlob = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `wissensquiz-publish-${stamp}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Publish-Fehler:", e);
      alert(`Veröffentlichen fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setPublishingQuiz(null);
      setPublishing(null);
    }
  };

  // Wendet die neue Mapping-Regel in-place auf eine bereits generierte Sammlung
  // an: Fragentexte/Antworten werden so umgeordnet, dass die ehemals höchste
  // Position (File-Q1) zum 1000€-Slot wandert. Anschließend wird die 50€-Frage
  // als Headline (Titel + Untertitel) hochgezogen und ihr Slot geleert.
  // Bilder, Telefonnummern, Preise, Style etc. bleiben unangetastet.
  const handleRepairCollection = () => {
    if (!collection) return;
    const fixed = collection.quizzes.map(q => {
      const reversed = [...q.questions].reverse();
      // Schritt 1: Texte umsortieren (50€-Slot ↔ 1000€-Slot etc.)
      const remapped = q.questions.map((qq, idx) => ({
        ...qq,
        text: reversed[idx].text,
        correctAnswer: reversed[idx].correctAnswer,
      }));
      // Schritt 2: niedrigster Preis-Slot zur Headline machen.
      // 50€-Zeile bleibt sichtbar (Doppelung gewollt). Untertitel wird vom
      // Repair nicht angerührt — KI-Subtitle muss separat über Generieren-Flow.
      const slotsByPriceDesc = remapped
        .map((qq, idx) => ({ idx, value: q.prizes.find(pp => pp.id === qq.prizeTierId)?.valueCents ?? 0 }))
        .sort((a, b) => b.value - a.value)
        .map(r => r.idx);
      const headlineIdx = slotsByPriceDesc[slotsByPriceDesc.length - 1];
      const headlineText = remapped[headlineIdx].text;
      return {
        ...q,
        meta: {
          ...q.meta,
          title: headlineText || q.meta.title,
          titleAuto: false,
          winnersText: q.meta.winnersText || DEFAULT_WINNERS_TEXT,
          termsText: q.meta.termsText || DEFAULT_TERMS_TEXT,
          phoneTermsText: q.meta.phoneTermsText || DEFAULT_PHONE_TERMS_TEXT,
        },
        questions: remapped,
      };
    });
    setCollection({ ...collection, quizzes: fixed });
    dispatch({ type: "LOAD_QUIZ", payload: fixed[collection.activeIndex] });
  };

  // Generiert nur die fehlenden Hintergrundbilder für Quizzes der Sammlung,
  // die noch keines haben. Texte, Untertitel, Fragen bleiben unangetastet.
  // Falls der Untertitel bei einem Quiz noch leer ist, wird er aus dem
  // KI-Result mitübernommen (sonst beibehalten).
  const handleGenerateMissingImages = async () => {
    if (!collection) return;
    // "Fehlend" heißt: kein Bild ODER kein Untertitel. So holen wir
    // beides nach, falls eines davon beim ersten Lauf fehlgeschlagen ist.
    const missing = collection.quizzes
      .map((q, i) => {
        const noImage = !q.theme.background?.image;
        const noSubtitle = !q.meta.subtitle?.trim();
        return (noImage || noSubtitle) ? i : null;
      })
      .filter((i): i is number => i !== null);
    if (!missing.length) {
      alert("Alle Quizzes haben bereits Bild und Untertitel.");
      return;
    }
    let failed = 0;
    setBulkProgress({ current: 0, total: missing.length, topic: "", phase: "imaging", failed: 0 });
    const updated = [...collection.quizzes];
    for (let step = 0; step < missing.length; step++) {
      const i = missing[step];
      const q = updated[i];
      const topic = q.meta.title || `Quiz ${i + 1}`;
      setBulkProgress({ current: step + 1, total: missing.length, topic, phase: "imaging", failed });

      let imagePrompt = `${topic}, photorealistic, single coherent newspaper cover scene, bright midday sunlight`;
      let topicElements: string[] = [topic];
      let aiSubtitle = "";
      try {
        const result = await generateQuizContent(topic, styleProps.styleText, difficulty);
        if (result?.imagePrompt) imagePrompt = String(result.imagePrompt);
        if (Array.isArray(result?.topicElements) && result.topicElements.length) {
          topicElements = result.topicElements;
        }
        if (result?.subtitle) aiSubtitle = String(result.subtitle);
      } catch (e) {
        console.warn(`KI-Metadaten für "${topic}" fehlgeschlagen:`, e);
      }

      const withMaybeSubtitle: Quiz = (!q.meta.subtitle?.trim() && aiSubtitle)
        ? { ...q, meta: { ...q.meta, subtitle: aiSubtitle } }
        : q;

      // Bild nur generieren, wenn keines vorhanden — sonst sparen wir uns
      // den OpenAI-Call und behalten das bestehende.
      if (q.theme.background?.image) {
        updated[i] = withMaybeSubtitle;
      } else {
        try {
          const dataUrl = await generateImage(imagePrompt, styleProps.styleImage, topicElements);
          updated[i] = {
            ...withMaybeSubtitle,
            theme: { ...withMaybeSubtitle.theme, background: { ...withMaybeSubtitle.theme.background, image: dataUrl } },
          };
        } catch (e) {
          failed++;
          updated[i] = withMaybeSubtitle;
          console.error(`Bildgenerierung für "${topic}" fehlgeschlagen:`, e);
        }
      }
    }
    setBulkProgress({ current: missing.length, total: missing.length, topic: "", phase: "done", failed });
    setCollection({ quizzes: updated, activeIndex: collection.activeIndex });
    dispatch({ type: "LOAD_QUIZ", payload: updated[collection.activeIndex] });
    setTimeout(() => setBulkProgress(null), 4000);
  };

  const handleBulkImport = async (parsedQuizzes: ParsedQuiz[]) => {
    if (!parsedQuizzes.length) return;
    const template = quiz;
    const generated: Quiz[] = [];
    let failed = 0;
    setBulkProgress({ current: 0, total: parsedQuizzes.length, topic: "", phase: "imaging", failed: 0 });
    for (let i = 0; i < parsedQuizzes.length; i++) {
      const p = parsedQuizzes[i];
      const base = parsedQuizToQuiz(p, template);
      setBulkProgress({ current: i + 1, total: parsedQuizzes.length, topic: p.topic, phase: "imaging", failed });

      // KI-Metadaten holen: Untertitel/Intro + besseren Image-Prompt + Topic-Elements.
      // Fragen aus dem Result werden BEWUSST verworfen — die kommen aus der Datei.
      let aiSubtitle = "";
      let imagePrompt = `${p.topic}, photorealistic, single coherent newspaper cover scene, bright midday sunlight`;
      let topicElements: string[] = [p.topic];
      try {
        const result = await generateQuizContent(p.topic, styleProps.styleText, difficulty);
        if (result?.subtitle) aiSubtitle = String(result.subtitle);
        if (result?.imagePrompt) imagePrompt = String(result.imagePrompt);
        if (Array.isArray(result?.topicElements) && result.topicElements.length) {
          topicElements = result.topicElements;
        }
      } catch (e) {
        console.warn(`KI-Metadaten für "${p.topic}" fehlgeschlagen — fahre ohne fort:`, e);
      }

      const withSubtitle: Quiz = aiSubtitle
        ? { ...base, meta: { ...base.meta, subtitle: aiSubtitle } }
        : base;

      try {
        const dataUrl = await generateImage(imagePrompt, styleProps.styleImage, topicElements);
        generated.push({
          ...withSubtitle,
          theme: { ...withSubtitle.theme, background: { ...withSubtitle.theme.background, image: dataUrl } },
        });
      } catch (e) {
        failed++;
        generated.push(withSubtitle);
        console.error(`Bildgenerierung für "${p.topic}" fehlgeschlagen:`, e);
      }
    }
    setBulkProgress({ current: parsedQuizzes.length, total: parsedQuizzes.length, topic: "", phase: "done", failed });
    setCollection({ quizzes: generated, activeIndex: 0 });
    dispatch({ type: "LOAD_QUIZ", payload: generated[0] });
    // Progress-Panel nach kurzer Anzeigezeit ausblenden, Sammlung bleibt sichtbar.
    setTimeout(() => setBulkProgress(null), 4000);
  };

  const handleExport = () => {
    const json = JSON.stringify(quiz, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const titleForFile = effectiveTitle(quiz) || "quiz";
    a.download = `${titleForFile.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    if (!pdfTargetRef.current) return;
    setExportingPdf(true);
    try {
      const [{ domToJpeg }, { default: jsPDF }] = await Promise.all([
        import("modern-screenshot"),
        import("jspdf")
      ]);

      const fmt = FORMATS[quiz.layout.format]?.[quiz.layout.orientation] || FORMATS.berliner_halbformat.landscape;

      // Give the offscreen PreviewRenderer time for auto-fit iterations
      // and font loading before rasterizing.
      await new Promise(resolve => setTimeout(resolve, 600));

      const imgData = await domToJpeg(pdfTargetRef.current, {
        scale: 4,
        quality: 0.92
      });

      const orientation = quiz.layout.orientation === "landscape" ? "landscape" : "portrait";
      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: [fmt.w, fmt.h]
      });

      pdf.addImage(imgData, "JPEG", 0, 0, fmt.w, fmt.h);

      const titleForFile = effectiveTitle(quiz) || "quiz";
      pdf.save(`${titleForFile.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
      alert(`PDF-Export fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setExportingPdf(false);
    }
  };
  const handleImport: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { dispatch({ type: "LOAD_QUIZ", payload: JSON.parse(r.result as string) }); }
      catch { alert("Ungültige JSON-Datei"); }
    };
    r.readAsText(f);
    e.target.value = "";
  };
  const handleReset = () => { if (confirm("Wirklich auf das leere Start-Quiz zurücksetzen?")) dispatch({ type: "RESET" }); };

  return (
    <div className="flex flex-col bg-stone-100 gap-3 p-3" style={{ height: "100vh" }}>
      <div className="text-sm text-stone-700 font-medium">
        Wissensquiz Creator — Phase 3.11
        <span className="text-xs text-stone-500 font-normal ml-2">
          modern-screenshot Renderer
        </span>
      </div>
      <div className="flex-1 flex flex-row gap-3 min-h-0">
        <EditorPanel quiz={quiz} dispatch={dispatch} canUndo={canUndo} canRedo={canRedo}
          onExport={handleExport} onExportPdf={handleExportPdf} exportingPdf={exportingPdf}
          onImport={handleImport} onReset={handleReset}
          styleProps={styleProps} difficulty={difficulty} setDifficulty={setDifficulty}
          collection={collection} bulkProgress={bulkProgress}
          onSwitchQuiz={handleSwitchQuiz} onBulkImport={handleBulkImport}
          onClearCollection={handleClearCollection} onRepairCollection={handleRepairCollection}
          onPublish={handlePublish} publishing={publishing}
          onGenerateMissingImages={handleGenerateMissingImages} />
        <PreviewPane quiz={quiz} selectedBlockId={selectedBlockId} onSelectBlock={setSelectedBlockId} />
      </div>

      {/* Hidden offscreen render target for PDF export — same internal dimensions as editor preview.
          Während des Publish-Vorgangs wird hier statt dem aktiven Quiz das jeweils zu exportierende
          gerendert (publishingQuiz), damit der Editor-State unverändert bleibt. */}
      <div style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }} aria-hidden>
        {(() => {
          const renderQuiz = publishingQuiz || quiz;
          const fmt = FORMATS[renderQuiz.layout.format]?.[renderQuiz.layout.orientation] || FORMATS.berliner_halbformat.landscape;
          const aspect = fmt.w / fmt.h;
          const w = aspect >= 1 ? 900 : 700 * aspect;
          const h = aspect >= 1 ? 900 / aspect : 700;
          return (
            <div ref={pdfTargetRef} style={{ width: w, height: h }}>
              <PreviewRenderer quiz={renderQuiz} width={w} height={h}
                selectedBlockId={null} onSelectBlock={() => {}} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
