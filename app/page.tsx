"use client";

import { useState, useReducer, useEffect, useRef, useLayoutEffect, useContext, Fragment, createContext } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Undo2, Redo2, Download, Upload, ChevronDown, ChevronRight, Sparkles, Loader2, X, Wand2, Settings, RotateCcw, Eye, Lightbulb, FileText, HelpCircle, Coins, Trophy, Image as ImageIcon, Layers, Palette, Building2, Receipt, Package, ExternalLink } from "lucide-react";
import type { ParsedQuiz } from "./api/import-quiz-document/parsers/types";
import VerlagsVorlage, { parseAdSize } from "./components/VerlagsVorlage";
import type { VerlagsPreset } from "./lib/verlage";
import { mapFont, parseColor, saveCustomPreset, saveGroupOverride, loadGroupOverrides } from "./lib/verlage";

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
// Freie Anpassung eines Layout-Elements: Versatz (Anteile der Anzeigenmaße),
// Skalierung (Schriftgröße via transform), Breite (Anteil der Anzeigenbreite —
// ändert den Textumbruch!) und Ausblenden. Alles relativ, damit Vorschau und
// hochauflösender PDF-Render identisch aussehen.
type ElementTransform = { dx: number; dy: number; scale: number; w?: number; h?: number; hidden?: boolean };
type Readability = {
  scrim: number;
  textShadow: number;
  blockBackdrop: "none" | "subtle" | "strong";
};
type Winner = { id: string; text: string; photo: string | null };

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
    howToText?: string;          // "So geht's: 1. … 2. … 3. …"
    solutionWords?: string;      // "Lösungsworte vom Vortag"
    winnerCount?: number;        // 0–5: wie viele Gewinner oben angezeigt werden
    winners?: Winner[];          // bis zu 5 Gewinner (Foto + kurzer Text)
    // Eigener Text im runden Störer. Wenn leer/undefined wird der höchste
    // Geldbetrag verwendet (z. B. "1'000€"). Wenn gesetzt, überschreibt
    // das diesen Default. Pro-Verlag-Overrides können später über
    // stoererPerVerlag (Record<id, string>) ergänzt werden.
    stoererText?: string;
    // Überschrift über der Fragenliste (z. B. "Welche Sehenswürdigkeiten
    // suchen wir? Jetzt mitraten!"). Wird beim Import aus dem Quiz-Thema
    // generiert; leer = neutraler Default im Renderer.
    questionsHeadline?: string;
    // --- Geldregen-spezifisch (Format "schatzsuche") ---
    // Spieltag-Nummer im Eck-Badge (z. B. "4"). Leer = "1".
    spieltag?: string;
    // Kicker-Zeile über dem Titel (Standard "Schatzsuche: Anrufen und kassieren").
    geldregenKicker?: string;
    // Überschreibt die 8 Spielregel-Schritte links (eine Zeile pro Schritt).
    geldregenRules?: string;
    // Gewählte Schatztruhen-Grafik (1–12) aus /public/chests. 0/undefined = keine.
    chestId?: number;
    // true = geschlossene Variante (chestNN_closed.png), sonst offen (chestNN.png).
    chestClosed?: boolean;
  };
  theme: {
    fontFamily: string;
    colors: Record<string, string>;
    fontSizes: Record<string, number>;
    // image = oberes Bild (Frage 4), imageBottom = unteres Bild (Frage 5)
    background: { image: string | null; imageBottom?: string | null; opacity: number; position: { x: number; y: number } };
    readability: Readability;
    // Optionales Zeitungslogo (Data-URL aus Upload oder Pfad in public/).
    // Erscheint unten rechts im Footer neben den Teilnahmebedingungen.
    publisherLogo?: string | null;
    // Wenn true, wird das Footer-Logo deutlich größer dargestellt und der
    // Teilnahmebedingungen-Text umfließt es links + unten. Nur für Verlage
    // mit ausdrücklich gewünschtem Sonderlayout.
    bigFooterLogo?: boolean;
    // Klartext-Name der Zeitung (z. B. "Rhein-Zeitung"). Wird im Querformat-
    // Layout im Titel ergänzt. Kommt aus preset.titelKanonisch oder titel.
    publisherName?: string;
  };
  // customSize: optionale, exakte Anzeigengröße in mm (kommt z. B. aus einer
  // Verlags-Vorlage). Wenn gesetzt, überschreibt sie FORMATS[format].
  layout: {
    format: string; orientation: string;
    customSize?: { w: number; h: number };
    variant?: "beilage" | "querformat" | "redaktionell";
    // Freie Element-Anpassungen (Redaktionell-Layout): Versatz in Anteilen
    // der Anzeigenbreite/-höhe (auflösungsunabhängig), Skalierung und
    // Ausblenden ("Löschen") pro Element-ID. Gilt in Vorschau UND PDF.
    transforms?: Record<string, ElementTransform>;
  };
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

// Überlagert ein Quiz mit Schrift, Farben und Anzeigengröße einer Verlags-Vorlage.
// Der Editor-Stand bleibt unverändert; die Funktion erzeugt nur eine Kopie für
// Vorschau und Export.
// Verlage mit ausdrücklich gewünschtem Sonderlayout: großes Footer-Logo,
// von Teilnahmebedingungen umflossen. Match per RegExp gegen Verlag + Titel
// + kanonischen Titel — toleranter gegen Schreibvarianten (Bindestrich vs.
// Leerzeichen, Unter-/Großschreibung etc.).
const BIG_FOOTER_LOGO_PATTERNS: RegExp[] = [
  /fehmarn/i,
];

// === LOGO-NORMALISIERUNG ====================================================
// Logo-Größe wird mm-basiert berechnet, sodass das Logo in JEDER Anzeigen-
// größe physisch GLEICH groß erscheint. Referenz: Berliner Halbformat
// (315×220 mm) mit den bisherigen Prozent-Werten (4,5 % Fläche, max 32×10 %).
const LOGO_REF_AREA_MM2 = 0.045 * 315 * 220;   // ≈ 3119 mm²
const LOGO_REF_MAX_W_MM = 0.32 * 315;          // ≈ 100,8 mm
const LOGO_REF_MAX_H_MM = 0.10 * 220;          // ≈ 22 mm

// === DEUTSCHER GENITIV FÜR ZEITUNGSNAMEN ====================================
// Title-Template: "Das große Wissensquiz <genitive>". Heuristik anhand der
// Endung des letzten Worts; Sonderfälle per Override-Tabelle.
const GENITIVE_OVERRIDES: Record<string, string> = {
  // Verlag::Titel (matched gegen preset.verlag + preset.titel)
  "Ippen::HNA": "der HNA",
  "Ippen::TZ": "der tz",
  "SAAR::PM": "des Pfälzischen Merkurs",
  "SAAR::SZ": "der Saarbrücker Zeitung",
  "SAAR::TV": "des Trierischen Volksfreunds",
  "SHZ::shz": "der shz",
  "SHZ::Beig": "des Bremer Eishockey-Internet-Gazette",
  "SHZ::NOZ": "der Neuen Osnabrücker Zeitung",
  "Ippen::Westfaelischer-Anz": "des Westfälischen Anzeigers",
  "Ippen::Schwarzwälder Bote, Neckarquelle, Lahrer Zeitung": "des Schwarzwälder Boten",
  "SWMH::Schwarzwälder Bote, Neckarquelle, Lahrer Zeitung": "des Schwarzwälder Boten",
  "Augsburger Allgemeinen::Augsburger Allgemeine": "der Augsburger Allgemeinen",
};
function germanGenitive(rawName: string): string {
  const name = (rawName || "").trim();
  if (!name) return "";
  const words = name.split(/\s+/);
  const lastLow = (words[words.length - 1] || "").toLowerCase();
  // Neutrum (Genitiv: des … -s)
  if (/(blatt|wort|jahrgang|volksblatt|tageblatt)$/.test(lastLow)) {
    return "des " + name + "s";
  }
  // Maskulin auf -e (n-Deklination: des Boten)
  if (/(bote)$/.test(lastLow)) {
    return "des " + name.replace(/Bote$/, "Boten");
  }
  // Feminin substantiviertes Adjektiv (schwache Deklination):
  // die Allgemeine → der Allgemeinen, die Neue → der Neuen.
  if (/(allgemeine|neue|rundschau)$/.test(lastLow)) {
    return /(allgemeine|neue)$/.test(lastLow) ? "der " + name + "n" : "der " + name;
  }
  // Maskulin (Genitiv: des -s, Adjektiv-Endung -en)
  if (/(anzeiger|merkur|kurier)$/.test(lastLow)) {
    // Adjektive vor dem letzten Wort: -er → -en (sehr heuristisch)
    const declined = words.map((w, i) =>
      i < words.length - 1 && /^[A-ZÄÖÜ].+er$/.test(w) ? w.slice(0, -2) + "en" : w
    );
    declined[declined.length - 1] = declined[declined.length - 1] + "s";
    return "des " + declined.join(" ");
  }
  // Feminin (Genitiv: der …) — Default für Zeitungen, Posten etc.
  return "der " + name;
}
function buildPublisherTitle(preset: VerlagsPreset | null, publisherName?: string): string {
  if (!preset && !publisherName) return "";
  const key = preset ? `${preset.verlag}::${preset.titel}` : "";
  const genitive = (key && GENITIVE_OVERRIDES[key])
    || germanGenitive(publisherName || preset?.titelKanonisch || preset?.titel || preset?.verlag || "");
  return `Das große Wissensquiz ${genitive}`;
}
function presetWantsBigFooterLogo(p: VerlagsPreset): boolean {
  const hay = `${p.verlag} ${p.titel} ${p.titelKanonisch || ""}`;
  return BIG_FOOTER_LOGO_PATTERNS.some(re => re.test(hay));
}

// Mapping Verlag → Variante der Teilnahmebedingungen. Texte stehen in
// public/teilnahmebedingungen.json und werden zur Laufzeit geladen.
function termsVariantForPreset(p: VerlagsPreset): string {
  const v = (p.verlag || "").toLowerCase();
  if (v.includes("augsburg")) return "Augsburg";
  if (v.includes("funke")) return "FUNKE";
  if (v.includes("ippen")) return "IPPEN";
  if (v.includes("rhein")) return "Mittelrhein";
  if (v.includes("westf")) return "NW";
  if (v.includes("nürnberg") || v.includes("nuernberg")) return "Nuernberg";
  if (v.includes("saar")) return "Saarbruecker";
  if (v.includes("shz")) return "SHZ";
  if (v.includes("swmh")) return "SWMH";
  if (v.includes("swp")) return "SWP";
  return "Neutral";
}

// Lädt das JSON-Mapping einmalig im Browser.
type TermsVariant = { termsText: string; servicePhone: string; introText: string };
type TermsMap = Record<string, TermsVariant>;
let CACHED_TERMS: TermsMap | null = null;
async function loadTermsMap(): Promise<TermsMap> {
  if (CACHED_TERMS) return CACHED_TERMS;
  try {
    const res = await fetch("/teilnahmebedingungen.json");
    CACHED_TERMS = await res.json();
    return CACHED_TERMS!;
  } catch {
    return {};
  }
}
// Vollständiger Text für den Footer: Bedingungen + am Ende die
// Service-Hotline ("Fragen zur Teilnahme … 0800-…").
function buildFullTerms(v: TermsVariant): string {
  return v.introText
    ? `${v.termsText} ${v.introText}`.trim().replace(/\s+/g, " ")
    : v.termsText;
}

function applyPresetToQuiz(q: Quiz, preset: VerlagsPreset | null, _opts?: { preferPresetLogo?: boolean }): Quiz {
  if (!preset) return q;
  const size = parseAdSize(preset.format);
  // Verlags-Presets haben die Hoheit über das Logo — auch wenn es null ist.
  // Sonst bliebe das zuletzt gesetzte Logo an der nächsten Zeitung kleben.
  // AUSNAHME: "Eigene Vorlagen" (custom_*, aus KI-Analyse) haben nie ein
  // eigenes Logo — sie dürfen ein bereits gesetztes Quiz-Logo (z. B. vom
  // Gruppen-Upload) NICHT löschen.
  const isCustom = preset.id.startsWith("custom_");
  const logo = preset.logoUrl || (isCustom ? q.theme.publisherLogo || null : null);
  const bigLogo = presetWantsBigFooterLogo(preset);
  // Verlagsname für Querformat-Layout: bevorzugt der kanonische Klartext-
  // Titel, sonst der Quell-Titel, sonst der Verlag.
  const pubName = (preset.titelKanonisch && preset.titelKanonisch !== "n/a")
    ? preset.titelKanonisch
    : (preset.titel && preset.titel !== "n/a" ? preset.titel : preset.verlag);
  // Teilnahmebedingungen aus Cache (synchron) — bei Cache-Miss bleibt der
  // bisherige Quiz-Text. Vorschau holt den Wert beim ersten Render nach.
  // Hotline-Hinweis hängen wir hinten an den Bedingungstext.
  const tv = CACHED_TERMS?.[termsVariantForPreset(preset)];
  const newTerms = tv ? buildFullTerms(tv) : q.meta.termsText;
  // Titel mit Verlagsnamen im deutschen Genitiv — überschreibt einen
  // alten verlagsspezifischen Auto-Titel, lässt aber individuell ge-
  // setzte Titel unverändert (Heuristik: Titel beginnt mit
  // "Das große Wissensquiz" → Auto-Titel, sonst Manuell).
  const autoTitle = buildPublisherTitle(preset, pubName);
  const isPrevAutoTitle = !q.meta.title || /^Das große Wissensquiz/i.test(q.meta.title);
  const newTitle = isPrevAutoTitle && autoTitle ? autoTitle : q.meta.title;
  return {
    ...q,
    meta: { ...q.meta, termsText: newTerms, title: newTitle, titleAuto: isPrevAutoTitle },
    theme: {
      ...q.theme,
      fontFamily: preset.fontFamily,
      colors: { ...q.theme.colors, ...preset.colors },
      publisherLogo: logo,
      bigFooterLogo: bigLogo,
      publisherName: pubName
    },
    layout: {
      ...q.layout,
      ...(size ? { customSize: size } : {}),
      ...(preset.layoutVariant ? { variant: preset.layoutVariant } : {})
    }
  };
}

// Liefert die effektive Anzeigengröße in mm: bevorzugt das vom Layout
// explizit gesetzte customSize (z. B. Verlags-Vorlage), sonst die named
// FORMATS-Vorlage. Orientierung wird respektiert (w/h ggf. getauscht).
function getQuizSize(layout: { format: string; orientation: string; customSize?: { w: number; h: number } }): { w: number; h: number } {
  if (layout.customSize) {
    const { w, h } = layout.customSize;
    return layout.orientation === "portrait" ? { w: Math.min(w, h), h: Math.max(w, h) } : { w: Math.max(w, h), h: Math.min(w, h) };
  }
  return FORMATS[layout.format]?.[layout.orientation] || FORMATS.berliner_halbformat.landscape;
}

const FORMATS: Record<string, Record<string, { w: number; h: number }>> = {
  a4: { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } },
  berliner_halbformat: { landscape: { w: 315, h: 235 }, portrait: { w: 235, h: 315 } },
  a5: { portrait: { w: 148, h: 210 }, landscape: { w: 210, h: 148 } },
  // Visuelle Layout-Vorlage. Größe ist immer A4 portrait, Orientation-Selector
  // wird beim Wechsel hierher auf "portrait" gezwungen.
  schwedenraetsel: { portrait: { w: 210, h: 297 }, landscape: { w: 210, h: 297 } },
  // Schatzsuche-Anzeige (Geldregen-Mechanik, 8 Stellen × 2 Antworten):
  // immer 315×220, Orientation wird beim Wechsel auf "landscape" gezwungen.
  schatzsuche: { landscape: { w: 315, h: 220 }, portrait: { w: 315, h: 220 } }
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
    phoneTermsText: "",
    howToText: "So geht's: 1. Frage beantworten · 2. Telefonnummer zur Frage anrufen · 3. Nach Aufforderung Frage in einem Wort beantworten. Mehrfachteilnahmen zu einzelnen Fragen sind erlaubt. Viel Glück!",
    solutionWords: "",
    winnerCount: 1,
    winners: [
      { id: "w1", text: "", photo: null },
      { id: "w2", text: "", photo: null },
      { id: "w3", text: "", photo: null },
      { id: "w4", text: "", photo: null },
      { id: "w5", text: "", photo: null }
    ]
  },
  theme: {
    fontFamily: "Georgia, serif",
    // Weißer Hintergrund → dunkle Schriftfarben. Akzent (Titel/Preise) dunkelrot.
    colors: { title: "#8A1A2B", intro: "#1A1A1A", prize: "#8A1A2B", question: "#1A1A1A", phone: "#8A1A2B", winners: "#333333", terms: "#555555" },
    fontSizes: { title: 80, intro: 32, prize: 46, question: 52, phone: 36, telemedia: 11, winners: 13, terms: 13 },
    background: { image: null, imageBottom: null, opacity: 1, position: { x: 50, y: 50 } },
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

// Auto-Titel: NIE eine Frage als Titel (Kundenvorgabe!). Stattdessen wird
// deterministisch — stabil pro Quiz-ID, kein Wackeln beim Re-Render — ein
// generierter Satz mit der Gewinnsumme gewählt. Der frühere Fallback auf die
// höchstdotierte Frage ist bewusst entfernt und darf nicht zurückkehren.
function deriveTitleFromQuestions(quiz: Quiz): string {
  const prize = topPrizeLabel(quiz);
  const key = quiz.id || "quiz";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  const tpl = TITLE_TEMPLATES_NO_TOPIC[Math.abs(h) % TITLE_TEMPLATES_NO_TOPIC.length];
  return tpl(prize);
}
function effectiveTitle(quiz: Quiz): string {
  // Gesetzter Titel gewinnt IMMER (z. B. generierter Satz mit Gewinnsumme
  // oder Verlags-Titel). Die Automatik ist nur noch Fallback bei leerem
  // Titel — und liefert nie eine Frage.
  if (quiz.meta.title) return quiz.meta.title;
  if (quiz.meta.titleAuto) return deriveTitleFromQuestions(quiz);
  return "";
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
async function generateImage(prompt: string, styleInstruction: string, topicElements?: string[], preferredModel?: string, styleHint?: "vivid" | "natural") {
  const r = await fetch("/api/generate-image", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, styleInstruction, topicElements, preferredModel, styleHint })
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

// Erzeugt bis zu zwei Bilder und legt sie als oberes (Frage 4) und unteres
// (Frage 5) Karten-Bild ab. Stil-Präfix steht VOR dem Motiv, damit OpenAI
// den Stil zuverlässig übernimmt (Anfang des Prompts hat höheres Gewicht).
// Baut den vollständigen Bild-Prompt: "<Stil-Präfix> <Motiv> <Umgebungs-Suffix>"
// — Stil-Präfix vorne, weil OpenAI Anfang des Prompts stärker gewichtet, und
// Suffix forciert die Umgebung statt eines isolierten Freistellers.
function buildImagePrompt(subject: string, mode: ImageStyleMode): string {
  const preset = IMAGE_STYLE_PRESETS[mode];
  return `${preset.subjectPrefix} ${subject}, ${preset.subjectSuffix}`;
}

// Schneidet (fast) weiße Ränder eines generierten Bildes ab — Sicherheitsnetz,
// falls das Bildmodell trotz Full-Bleed-Vorgabe unbemalten Papierrand lässt.
// Aquarellpapier ist selten reinweiß, deshalb bewusst tolerant: Eine Kante
// gilt als "weiß", wenn ≥90 % ihrer Pixel hell sind (alle Kanäle > 232).
// Pro Kante werden maximal 22 % der Bildgröße entfernt.
async function trimWhiteBorders(dataUrl: string): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    const isWhiteRow = (y: number) => {
      let white = 0;
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (data[o] > 222 && data[o + 1] > 222 && data[o + 2] > 222) white++;
      }
      return white / w >= 0.82;
    };
    const isWhiteCol = (x: number) => {
      let white = 0;
      for (let y = 0; y < h; y++) {
        const o = (y * w + x) * 4;
        if (data[o] > 222 && data[o + 1] > 222 && data[o + 2] > 222) white++;
      }
      return white / h >= 0.82;
    };
    const maxY = Math.floor(h * 0.30), maxX = Math.floor(w * 0.30);
    let top = 0; while (top < maxY && isWhiteRow(top)) top++;
    let bottom = 0; while (bottom < maxY && isWhiteRow(h - 1 - bottom)) bottom++;
    let left = 0; while (left < maxX && isWhiteCol(left)) left++;
    let right = 0; while (right < maxX && isWhiteCol(w - 1 - right)) right++;
    if (!top && !bottom && !left && !right) return dataUrl;
    const cw = w - left - right, ch = h - top - bottom;
    const out = document.createElement("canvas");
    out.width = cw; out.height = ch;
    const octx = out.getContext("2d");
    if (!octx) return dataUrl;
    octx.drawImage(canvas, left, top, cw, ch, 0, 0, cw, ch);
    return out.toDataURL("image/png");
  } catch {
    return dataUrl; // Im Zweifel Original behalten.
  }
}

// Seitenverhältnis der Bild-Boxen im Layout (Spalte 2, halbe Höhe) — gemessen
// am Redaktionell-Layout bei 315×220 mm: Box ≈ 1,25:1 (Breite:Höhe).
const CARD_IMAGE_ASPECT = 1.25;

// Macht ein Karten-Bild passgenau: erst Weißränder wegschneiden, dann mittig
// auf das Box-Seitenverhältnis zuschneiden. Ergebnis füllt die Bild-Box exakt.
async function fitCardImage(dataUrl: string): Promise<string> {
  const trimmed = await trimWhiteBorders(dataUrl);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = trimmed;
    });
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return trimmed;
    let cw = w, ch = h, ox = 0, oy = 0;
    if (w / h > CARD_IMAGE_ASPECT) {
      cw = Math.round(h * CARD_IMAGE_ASPECT);
      ox = Math.round((w - cw) / 2);
    } else {
      ch = Math.round(w / CARD_IMAGE_ASPECT);
      oy = Math.round((h - ch) / 2);
    }
    if (cw === w && ch === h) return trimmed;
    const out = document.createElement("canvas");
    out.width = cw; out.height = ch;
    const ctx = out.getContext("2d");
    if (!ctx) return trimmed;
    ctx.drawImage(img, ox, oy, cw, ch, 0, 0, cw, ch);
    return out.toDataURL("image/png");
  } catch {
    return trimmed;
  }
}

// Kodiert ein Karten-Bild als unkomprimiertes TIFF — "offenes",
// verlustfreies Druckformat, das InDesign direkt platzieren kann.
async function encodeImageToTiff(dataUrl: string): Promise<ArrayBuffer> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar.");
  ctx.drawImage(img, 0, 0);
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // Typen kommen aus types/utif.d.ts (utif liefert selbst keine mit).
  const UTIF = await import("utif");
  return UTIF.encodeImage(rgba.data.buffer as ArrayBuffer, canvas.width, canvas.height);
}

// Browser-Download eines Blobs mit verzögertem URL-Revoke (sofortiges
// Revoke kann den Download abbrechen, bevor der Browser ihn startet).
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// Einzelbild als TIFF — Dateiname: <Antwort>_Bild_oben.tif / _Bild_unten.tif.
async function downloadImageAsTiff(dataUrl: string, filename: string) {
  const tiff = await encodeImageToTiff(dataUrl);
  downloadBlob(new Blob([tiff], { type: "image/tiff" }), filename);
}

// Dateiname-sicher machen (Umlaute bleiben, Rest wird zu Unterstrich).
function safeFilePart(s: string): string {
  return (s || "Bild").trim()
    .replace(/[^a-zA-Z0-9äöüÄÖÜß\- ]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60) || "Bild";
}

async function generateTwoCardImages(dispatch: React.Dispatch<Action>, subjects: string[], mode: ImageStyleMode) {
  const preset = IMAGE_STYLE_PRESETS[mode];
  const keys = ["image", "imageBottom"] as const;
  for (let i = 0; i < 2; i++) {
    const s = (subjects[i] || "").trim();
    if (!s) continue;
    const url = await generateImage(buildImagePrompt(s, mode), preset.instruction, [s], preset.preferredModel, preset.styleHint);
    dispatch({ type: "UPDATE_BACKGROUND", payload: { [keys[i]]: await fitCardImage(url) } });
  }
}

// Einzelnes Bild im gewählten Stil — wird bei den Sammel-Pfaden benutzt.
async function generateCardImageForSubject(subject: string, mode: ImageStyleMode): Promise<string> {
  const preset = IMAGE_STYLE_PRESETS[mode];
  const url = await generateImage(buildImagePrompt(subject, mode), preset.instruction, [subject], preset.preferredModel, preset.styleHint);
  return fitCardImage(url);
}

// Liefert (Frage4-Motiv, Frage5-Motiv) für ein Quiz. correctAnswer hat Vorrang,
// sonst der Fragetext, sonst der fallbackTopic (z. B. der Quiz-Titel).
function cardImageSubjects(q: Quiz, fallbackTopic: string): [string, string] {
  const subj = (i: number) => (q.questions[i]?.correctAnswer?.trim() || q.questions[i]?.text?.trim() || fallbackTopic);
  return [subj(3), subj(4)];
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

// Titel-Vorlagen: kreative Sätze, die das Thema UND den Hauptgewinn
// (z. B. "1000€") enthalten. Kundenwunsch: KEINE Frage als Titel.
// Alle Vorlagen funktionieren mit jedem Themen-Nomen ohne
// grammatikalische Stolperstellen (Thema steht immer alleinstehend,
// kein Genitiv/Artikel nötig).
const TITLE_TEMPLATES = [
  (t: string, p: string) => `${t} kennen, ${p} gewinnen!`,
  (t: string, p: string) => `Wer ${t} kennt, gewinnt – bis zu ${p}!`,
  (t: string, p: string) => `Heute ${p} gewinnen – Thema: ${t}!`,
  (t: string, p: string) => `Mit ${t} zu ${p}!`,
  (t: string, p: string) => `${p} zu gewinnen: Wie gut kennen Sie ${t}?`,
  (t: string, p: string) => `Rätselspaß mit ${t} – ${p} warten!`,
  (t: string, p: string) => `${t} im Kopf? ${p} im Spiel!`,
  (t: string, p: string) => `Punkten Sie bei ${t} und gewinnen Sie ${p}!`,
  (t: string, p: string) => `Gewinnen Sie ${p} – heute dreht sich alles um ${t}!`,
  (t: string, p: string) => `${p} für kluge Köpfe: unser Quiz rund um ${t}!`,
  (t: string, p: string) => `Mitraten bei ${t} – ${p} sichern!`,
  (t: string, p: string) => `${t} gefragt – ${p} zu gewinnen!`,
];

// Fallback ohne Thema — der Hauptgewinn muss trotzdem im Titel stehen.
const TITLE_TEMPLATES_NO_TOPIC = [
  (p: string) => `Mitraten und ${p} gewinnen!`,
  (p: string) => `Heute ${p} gewinnen!`,
  (p: string) => `${p} für kluge Köpfe!`,
  (p: string) => `Quiz-Zeit: ${p} zu gewinnen!`,
];

const DEFAULT_TOP_PRIZE_LABEL = "1000€";

// Fragen-Überschriften: kurze Sätze mit Themenbezug über der Fragenliste
// (Vorbild Augsburger: "Welche Sehenswürdigkeiten suchen wir? Jetzt
// mitraten!"). Alle Vorlagen funktionieren mit jedem Themen-Nomen.
const QUESTIONS_HEADLINE_TEMPLATES = [
  (t: string) => `Fünf Fragen rund um ${t} — jetzt mitraten!`,
  (t: string) => `Heute dreht sich alles um ${t} — raten Sie mit!`,
  (t: string) => `Wie gut kennen Sie ${t}? Jetzt mitraten!`,
  (t: string) => `${t}: Fünf Fragen, fünf Gewinnchancen!`,
  (t: string) => `Fünf Fragen zu ${t} — mitraten und gewinnen!`,
  (t: string) => `Heute gefragt: ${t} — raten Sie mit!`,
];

const DEFAULT_QUESTIONS_HEADLINE = "Heute haben wir fünf Fragen rund um diese Bilder — jetzt mitraten!";

// Standard-Story-Text des Redaktionell-Layouts — wörtlich aus der
// Original-Vorlage der Augsburger Redaktion übernommen. Greift, wenn das
// "So geht's"-Gefäß leer ist; manuell jederzeit überschreibbar.
const REDAKTIONELL_DEFAULT_HOWTO =
  "Beantworten Sie eine oder mehrere Fragen und gewinnen Sie täglich bis zu 1000 €! " +
  "Alle Preise werden morgen unter den richtigen Antworten verlost. Rufen Sie an und " +
  "sagen Sie uns ihre Lösung! Mehrfachteilnahmen sind erlaubt. Teilnahmeschluss ist " +
  "um Mitternacht.\n\nDen Gewinner und die Auflösung erfahren Sie in der nächsten Ausgabe.";

// Wählt eine Fragen-Überschrift per Zufallsprinzip (wie pickTitleForTopic:
// einmal beim Import gewürfelt, dann fest in meta.questionsHeadline).
function pickQuestionsHeadline(topic: string): string {
  const t = simplifyTopic(topic);
  if (!t) return DEFAULT_QUESTIONS_HEADLINE;
  const tpl = QUESTIONS_HEADLINE_TEMPLATES[Math.floor(Math.random() * QUESTIONS_HEADLINE_TEMPLATES.length)];
  return tpl(t);
}

// Vereinfacht das Thema für den Titel: hängende Zusätze wie "weltweit"
// oder "von A bis Z" fallen weg ("Tiere weltweit" → "Tiere"). Muss laut
// Kunde nicht 1:1 dem Thema entsprechen.
const TOPIC_TRIM_PATTERNS: RegExp[] = [
  /\s+(weltweit|international|national|regional|heute|aktuell|im überblick|im alltag|und mehr|und co\.?|von a bis z|in aller welt|rund um die welt|rund um den globus|in deutschland|in europa|gestern und heute|im wandel der zeit|früher und heute)$/i,
];
function simplifyTopic(topic: string): string {
  let t = topic.trim().replace(/^(thema|rund um|alles über|alles rund um)\s+/i, "");
  for (let guard = 0; guard < 4; guard++) {
    let changed = false;
    for (const re of TOPIC_TRIM_PATTERNS) {
      const next = t.replace(re, "").trim();
      if (next && next !== t) { t = next; changed = true; }
    }
    if (!changed) break;
  }
  return t || topic.trim();
}

// Wählt eine Titel-Vorlage per Zufallsprinzip (Kundenwunsch). Der Titel
// wird beim Import/Generieren EINMAL gewürfelt und dann in meta.title
// gespeichert — er wackelt also nicht bei Reloads.
function pickTitleForTopic(topic: string, prizeLabel: string = DEFAULT_TOP_PRIZE_LABEL): string {
  const t = simplifyTopic(topic);
  if (!t) {
    const tpl = TITLE_TEMPLATES_NO_TOPIC[Math.floor(Math.random() * TITLE_TEMPLATES_NO_TOPIC.length)];
    return tpl(prizeLabel);
  }
  const tpl = TITLE_TEMPLATES[Math.floor(Math.random() * TITLE_TEMPLATES.length)];
  return tpl(t, prizeLabel);
}

// Liefert das Label des höchsten Preises eines Quiz (z. B. "1000€").
function topPrizeLabel(quiz: Quiz): string {
  if (!quiz.prizes.length) return DEFAULT_TOP_PRIZE_LABEL;
  const top = quiz.prizes.reduce((a, b) => (b.valueCents > a.valueCents ? b : a));
  return getPrizeLabel(top) || DEFAULT_TOP_PRIZE_LABEL;
}

// Liefert einen leserlichen Zeitstempel im Format YYYY-MM-DD_HHmm,
// passend zum Anhängen an Dateinamen.
function timestampForFilename(): string {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function parsedQuizToQuiz(p: ParsedQuiz, template: Quiz): Quiz {
  const incoming = p.questions || [];
  // Reihenfolge (Kundenwunsch): Die Fragen behalten ihre Datei-Reihenfolge
  // bei AUFSTEIGENDEN Preisen — File-Frage 1 landet auf dem Slot mit dem
  // NIEDRIGSTEN Preis (50€), File-Frage 5 auf dem höchsten (1000€). Die
  // Euro-Beträge selbst bleiben an ihrer Position in der Anzeige.
  // (Früher war das Mapping umgekehrt: File-Q1 → 1000€.)
  // Nebeneffekt gewollt: Die bildgebenden File-Fragen 4 + 5 liegen damit
  // auf den Slots 3 + 4, aus denen cardImageSubjects die Bildmotive zieht.
  const slotsByPriceAsc = template.questions
    .map((q, idx) => ({
      idx,
      value: template.prizes.find(pp => pp.id === q.prizeTierId)?.valueCents ?? 0,
    }))
    .sort((a, b) => a.value - b.value)
    .map(r => r.idx);

  const newQuestions = [...template.questions];
  slotsByPriceAsc.forEach((qIdx, fileIdx) => {
    const src = incoming[fileIdx];
    newQuestions[qIdx] = {
      ...template.questions[qIdx],
      text: src?.text || "",
      answerType: "text" as const,
      options: undefined,
      correctAnswer: src?.answer || "",
    };
  });

  // Titel: zufällig gewählter kreativer Satz mit Thema + Hauptgewinn
  // (Kundenwunsch: KEINE Frage als Titel, Gewinnsumme muss vorkommen).
  // Der Würfelwurf passiert genau einmal hier beim Import; das Ergebnis
  // steht danach fest in meta.title. Manuell jederzeit im Inhalt-Tab
  // überschreibbar. Untertitel bleibt leer — kommt vom KI-Subtitle.
  const titleFromTopic = pickTitleForTopic(p.topic || "", topPrizeLabel(template));
  return {
    ...template,
    meta: {
      ...template.meta,
      title: titleFromTopic,
      // Fragen-Überschrift ebenfalls aus dem Thema würfeln (einmalig hier).
      questionsHeadline: pickQuestionsHeadline(p.topic || ""),
      subtitle: template.meta.subtitle || "",
      titleAuto: false,
      winnersText: template.meta.winnersText || DEFAULT_WINNERS_TEXT,
      termsText: template.meta.termsText || DEFAULT_TERMS_TEXT,
      phoneTermsText: template.meta.phoneTermsText || DEFAULT_PHONE_TERMS_TEXT,
    },
    theme: {
      ...template.theme,
      // BEIDE Karten-Bilder nullen — sonst erbt jedes importierte Quiz das
      // untere Bild des Vorlage-Quiz (führte zu identischen Bildern überall).
      background: { ...template.theme.background, image: null, imageBottom: null },
    },
    questions: newQuestions,
  };
}

type Action = { type: string; [k: string]: unknown };

// ---------------------------------------------------------------------------
// Layout-Vorlagen: gespeicherte händische Anpassungen (Element-Positionen,
// Größen, Breiten, Ausblendungen + Layout-Variante), wiederverwendbar für
// das nächste Quiz. Persistenz in localStorage. Die Element-IDs (title,
// stoerer, question_q1 … question_q5, winners, …) sind über alle Standard-
// Quizze stabil, daher sind die Vorlagen quiz-übergreifend anwendbar.
type LayoutTemplate = {
  id: string;
  name: string;
  variant: "beilage" | "querformat" | "redaktionell";
  transforms: Record<string, ElementTransform>;
  createdAt: number;
};
const LAYOUT_TEMPLATES_KEY = "wq.layoutTemplates";
function loadLayoutTemplates(): LayoutTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LAYOUT_TEMPLATES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
function persistLayoutTemplates(list: LayoutTemplate[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LAYOUT_TEMPLATES_KEY, JSON.stringify(list)); } catch { /* voll/blockiert */ }
}

const LIGHT_COLORS: Record<string, string> = {
  title: "#FFFFFF", intro: "#F5F5F5", prize: "#FFD27A",
  question: "#FFFFFF", phone: "#FFD27A", winners: "#F0F0F0", terms: "#F0F0F0"
};

function quizReducer(state: Quiz, action: Action): Quiz {
  switch (action.type) {
    case "UPDATE_META": return { ...state, meta: { ...state.meta, ...(action.payload as object) } };
    case "UPDATE_WINNER": {
      const existing = state.meta.winners ?? [];
      const patch = action.payload as Partial<Winner>;
      const exists = existing.some(w => w.id === action.id);
      const list = exists
        ? existing.map(w => w.id === action.id ? { ...w, ...patch } : w)
        : [...existing, { id: action.id as string, text: "", photo: null as string | null, ...patch }];
      return { ...state, meta: { ...state.meta, winners: list } };
    }
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
    case "UPDATE_TRANSFORM": {
      const id = action.id as string;
      const cur = state.layout.transforms?.[id] || { dx: 0, dy: 0, scale: 1 };
      return { ...state, layout: { ...state.layout,
        transforms: { ...(state.layout.transforms || {}), [id]: { ...cur, ...(action.payload as object) } } } };
    }
    case "RESET_TRANSFORM": {
      const id = action.id as string;
      const next = { ...(state.layout.transforms || {}) };
      delete next[id];
      return { ...state, layout: { ...state.layout, transforms: next } };
    }
    case "UPDATE_PARTICIPATION": return { ...state, participation: { ...state.participation, ...(action.payload as object) } };
    case "FORCE_LIGHT_COLORS": return { ...state, theme: { ...state.theme, colors: { ...state.theme.colors, ...LIGHT_COLORS } } };
    case "SET_TITLE_AUTO": {
      const auto = action.value as boolean;
      // Automatik AN: Titel leeren, damit der generierte Fallback greift.
      if (auto) return { ...state, meta: { ...state.meta, titleAuto: true, title: "" } };
      // Automatik AUS: generierten Titel als editierbaren Wert übernehmen.
      if (state.meta.titleAuto) {
        return { ...state, meta: { ...state.meta, titleAuto: false, title: deriveTitleFromQuestions(state) } };
      }
      return state;
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
      const p = action.payload as { headline?: string; subtitle?: string; topic?: string; questions?: { text: string; answerType: AnswerType; options?: string[]; correctAnswer: string }[]; theme?: { titleColor?: string; prizeColor?: string; questionColor?: string } };
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
      // Titel = zufälliger kreativer Satz mit Thema + Hauptgewinn
      // (Kundenwunsch: KEINE Frage als Titel, Gewinnsumme muss vorkommen).
      const aiQuestions = p.questions || [];
      const autoTitle = pickTitleForTopic(p.topic || "", topPrizeLabel(state));
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

// Kontext für die neue Shell-Navigation: wenn gesetzt, blenden Sections aus,
// deren tabKey nicht zur aktuellen Sektion passt. Ohne Kontext (Legacy/Embedded
// = false) zeigt jede Section sich wie bisher.
const SectionContext = createContext<{ active: string | null }>({ active: null });

function Section({ title, children, defaultOpen = true, icon, tabKey }: { title: string; children: React.ReactNode; defaultOpen?: boolean; icon?: React.ReactNode; tabKey?: string }) {
  const ctx = useContext(SectionContext);
  const [open, setOpen] = useState(defaultOpen);
  // In der neuen Shell: wenn ein aktiver Tab gesetzt ist, nur passende Sections zeigen.
  if (ctx.active && tabKey && ctx.active !== tabKey) return null;
  // In der Shell zeigen wir Sections immer aufgeklappt (kein doppeltes Falten).
  const isShell = !!ctx.active;
  if (isShell) {
    return (
      <div className="rounded-2xl bg-white" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.05)" }}>
        <div className="px-5 py-3 text-[15px] font-semibold text-stone-800 flex items-center gap-2">{icon}{title}</div>
        <div className="px-5 pb-4 pt-1 space-y-3" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>{children}</div>
      </div>
    );
  }
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
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><label className="block text-[12px] text-stone-500 mb-1.5 font-medium">{label}</label>{children}</div>
);
const inputBase = "w-full px-3 py-2 text-[13.5px] rounded-lg bg-white text-stone-900 focus:outline-none transition-shadow";
const inputShadow: React.CSSProperties = { boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" };
const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p}
    className={`${inputBase} ${p.className || ""}`}
    style={{ ...inputShadow, ...(p.style || {}) }}
    onFocus={e => { e.currentTarget.style.boxShadow = "inset 0 0 0 1px rgba(0,0,0,0.12), 0 0 0 3px rgba(14,165,233,0.25)"; p.onFocus?.(e); }}
    onBlur={e => { e.currentTarget.style.boxShadow = "inset 0 0 0 1px rgba(0,0,0,0.12)"; p.onBlur?.(e); }}
  />
);
const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p}
    className={`${inputBase} ${p.className || ""}`}
    style={{ ...inputShadow, ...(p.style || {}) }}
    onFocus={e => { e.currentTarget.style.boxShadow = "inset 0 0 0 1px rgba(0,0,0,0.12), 0 0 0 3px rgba(14,165,233,0.25)"; p.onFocus?.(e); }}
    onBlur={e => { e.currentTarget.style.boxShadow = "inset 0 0 0 1px rgba(0,0,0,0.12)"; p.onBlur?.(e); }}
  />
);
const Select = ({ value, onChange, options }: { value: string; onChange: React.ChangeEventHandler<HTMLSelectElement>; options: { value: string; label: string }[] }) => (
  <select value={value} onChange={onChange} className={inputBase} style={inputShadow}>
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

function AIGeneratorPanel({ quiz, dispatch, styleText, styleImage, difficulty, setDifficulty, onBulkImport, bulkDisabled, imageStyleMode, onPresetCreated }: {
  quiz: Quiz; dispatch: React.Dispatch<Action>; styleText: string; styleImage: string;
  difficulty: Difficulty; setDifficulty: (d: Difficulty) => void;
  imageStyleMode: ImageStyleMode;
  onBulkImport: (parsedQuizzes: ParsedQuiz[]) => void;
  bulkDisabled: boolean;
  // Wird nach erfolgreicher Vorlagen-Analyse mit dem neuen Preset gerufen
  // (z. B. um es direkt in der Vorschau zu zeigen).
  onPresetCreated?: (p: VerlagsPreset) => void;
}) {
  const [status, setStatus] = useState<"idle" | "generating" | "imaging" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [importedQuizzes, setImportedQuizzes] = useState<ParsedQuiz[] | null>(null);
  const [importing, setImporting] = useState(false);

  // Verlags-Vorlage (PDF/Bild) hochladen → KI-Analyse → Übertragung auf die
  // gewählte Verlagsgruppe (oder als freie eigene Vorlage).
  const tplFileRef = useRef<HTMLInputElement>(null);
  const [tplBusy, setTplBusy] = useState(false);
  const [tplStatus, setTplStatus] = useState("");
  const [tplError, setTplError] = useState("");
  // Gewählte Verlagsgruppe ("" = nur als eigene Vorlage speichern, ohne Übertragung).
  const [tplGroup, setTplGroup] = useState("");
  // Was aus der Vorlage übernommen wird. Abgewählt = Werte aus der Datenbank
  // (also den bestehenden Presets) bleiben aktiv.
  const [tplTakeColors, setTplTakeColors] = useState(true);
  const [tplTakeFont, setTplTakeFont] = useState(true);
  // Vorlagen-Elemente, für die es im Tool kein Gefäß gibt — werden dem
  // Nutzer zur Entscheidung angezeigt ("frage mich").
  const [tplUnmapped, setTplUnmapped] = useState<string[]>([]);
  // Verfügbare Gruppen aus den Presets ableiten (verlag-Feld = Verlagsgruppe).
  // logoUrl: erstes hinterlegtes Logo der Gruppe — wird beim Upload mit
  // Gruppenwahl direkt aufs aktive Quiz gesetzt.
  const [tplGroups, setTplGroups] = useState<{ name: string; count: number; logoUrl?: string; firstPreset?: VerlagsPreset }[]>([]);
  useEffect(() => {
    fetch("/verlage-presets.json")
      .then(r => (r.ok ? r.json() : []))
      .then((d: VerlagsPreset[]) => {
        if (!Array.isArray(d)) return;
        const m = new Map<string, { count: number; logoUrl?: string; firstPreset?: VerlagsPreset }>();
        for (const p of d) {
          const key = p.verlag || p.gruppe || "Sonstige";
          const cur = m.get(key) || { count: 0, logoUrl: undefined, firstPreset: undefined };
          cur.count += 1;
          if (!cur.logoUrl && p.logoUrl) cur.logoUrl = p.logoUrl;
          if (!cur.firstPreset) cur.firstPreset = p;
          m.set(key, cur);
        }
        setTplGroups([...m.entries()].map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => { /* Dropdown bleibt leer — Upload ohne Gruppe weiterhin möglich */ });
  }, []);

  const handleTemplateUpload: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (tplFileRef.current) tplFileRef.current.value = "";
    if (!file) return;
    setTplBusy(true); setTplError(""); setTplUnmapped([]);
    setTplStatus("Analysiere Vorlage … (kann ~20 Sekunden dauern)");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/analyze-template", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const a = (j.analysis || {}) as Record<string, unknown>;
      const { css, available } = mapFont(String(a.fontSuggestion || a.fontRaw || ""));
      const baseName = String(a.titel || a.verlag || file.name.replace(/\.[^.]+$/, "")).trim() || "Eigene Vorlage";
      const c = (a.colors || {}) as Record<string, unknown>;
      const colors = {
        title: parseColor(c.title, "#1A1A1A"),
        question: parseColor(c.question, "#1A1A1A"),
        intro: parseColor(c.intro, "#1A1A1A"),
        prize: parseColor(c.prize, "#8A1A2B"),
        phone: parseColor(c.phone, "#8A1A2B"),
        winners: parseColor(c.winners, "#333333"),
        terms: parseColor(c.terms, "#555555"),
      };
      const fontRaw = String(a.fontRaw || a.fontSuggestion || "");
      const layoutVariant = a.layoutVariant === "querformat" ? "querformat" as const
        : a.layoutVariant === "redaktionell" ? "redaktionell" as const
        : "beilage" as const;
      const conf = a.confidence ? ` — ${String(a.confidence)}` : "";

      // --- Texte der Vorlage in die vorhandenen Gefäße des aktiven Quiz ---
      // Fragen/Antworten/Preise/Nummern werden bewusst NICHT angefasst —
      // die kommen aus der Datenbank (Fragenkatalog-Import).
      const t = (a.texts || {}) as Record<string, unknown>;
      const metaPatch: Record<string, string> = {};
      const filled: string[] = [];
      const put = (key: string, val: unknown, label: string) => {
        const s = String(val ?? "").trim();
        if (s) { metaPatch[key] = s; filled.push(label); }
      };
      // WICHTIG (Kundenvorgabe): Titel und Fragen-Überschrift werden NIE aus
      // der Vorlage übernommen — sie bleiben die zufällig generierten Texte
      // (Titel enthält den Hauptgewinn, z. B. 1000€; Fragen-Überschrift
      // entsteht aus dem Quiz-Thema). Die Vorlage liefert nur die übrigen
      // Gefäße.
      put("subtitle", t.subtitle, "Untertitel");
      put("howToText", t.howTo, "So geht's");
      // Störer NICHT aus der Vorlage — er zeigt standardmäßig den Hauptgewinn
      // ("Heute 1'000€ gewinnen") und bleibt nur manuell überschreibbar.
      put("winnersText", t.winners, "Gewinner");
      // Teilnahmebedingungen nur als Lückenfüller: Wenn das Quiz schon TNB
      // hat (aus teilnahmebedingungen.json / Preset), bleiben die bestehen —
      // die Vorlage füllt sie nur, wenn das Gefäß leer ist.
      if (!quiz.meta.termsText?.trim()) {
        put("termsText", t.terms, "Teilnahmebedingungen (waren leer)");
      }
      put("phoneTermsText", t.phoneTerms, "Telefon-Hinweis");
      // Überschrift ("Auflösung der letzten Ausgabe/Folge:") ggf. heraus-
      // filtern — der Renderer setzt sie selbst, sonst stünde sie doppelt da.
      put("solutionWords",
        String(t.solutionWords ?? "").replace(/auflösung der letzten (folge|ausgabe):?\s*/gi, "").trim(),
        "Lösungswörter");
      if (Object.keys(metaPatch).length) {
        dispatch({ type: "UPDATE_META", payload: metaPatch });
      }

      // Layout der Vorlage direkt aufs aktive Quiz übernehmen.
      const tplSize = parseAdSize(String(a.format || ""));
      dispatch({ type: "UPDATE_LAYOUT", payload: { variant: layoutVariant, ...(tplSize ? { customSize: tplSize } : {}) } });

      // Elemente ohne Gefäß sammeln und dem Nutzer zur Entscheidung zeigen.
      const unmapped = Array.isArray(a.unmappedElements)
        ? (a.unmappedElements as unknown[]).map(x => String(x ?? "").trim()).filter(Boolean)
        : [];
      setTplUnmapped(unmapped);
      const filledNote =
        (filled.length ? ` Texte übernommen: ${filled.join(", ")}.` : " Keine Texte in der Vorlage gefunden.") +
        ` Layout erkannt: ${layoutVariant === "querformat" ? "Querformat" : layoutVariant === "redaktionell" ? "Redaktionell (Augsburger Stil)" : "Beilage"}${tplSize ? `, ${tplSize.w}×${tplSize.h} mm` : ""}.`;

      if (tplGroup) {
        // Übertragung auf die Gruppe: nur die angehakten Teile (Farben/Schrift)
        // kommen aus der Vorlage — abgewählte bleiben aus der Datenbank.
        // Layout-Variante kommt immer aus der Vorlage. Logos, Anzeigengrößen
        // und Hotlines der einzelnen Titel bleiben in jedem Fall erhalten.
        saveGroupOverride(tplGroup, {
          ...(tplTakeColors ? { colors } : {}),
          ...(tplTakeFont ? { fontFamily: css, fontAvailable: available, fontRaw } : {}),
          layoutVariant, sourceName: baseName,
        });
        const groupInfo = tplGroups.find(g => g.name === tplGroup);
        const count = groupInfo?.count;
        // Logo der Gruppe (aus den Presets) direkt aufs aktive Quiz setzen,
        // damit es — wie in der Vorlage — sofort an seinem Platz erscheint.
        if (groupInfo?.logoUrl) {
          dispatch({ type: "UPDATE_THEME", payload: { publisherLogo: groupInfo.logoUrl } });
        }
        // Kuratierte Teilnahmebedingungen der Gruppe (teilnahmebedingungen.json)
        // setzen — sie haben Vorrang vor evtl. aus der Vorlage gelesenen TNB.
        let tnbSet = false;
        if (groupInfo?.firstPreset) {
          try {
            const termsMap = await loadTermsMap();
            const tv = termsMap?.[termsVariantForPreset(groupInfo.firstPreset)];
            if (tv) {
              dispatch({ type: "UPDATE_META", payload: { termsText: buildFullTerms(tv) } });
              tnbSet = true;
            }
          } catch (e) {
            console.warn("Teilnahmebedingungen konnten nicht geladen werden:", e);
          }
        }
        const parts = [
          tplTakeColors ? "Farben" : "Farben aus DB",
          tplTakeFont ? "Schrift" : "Schrift aus DB",
          "Layout",
          ...(groupInfo?.logoUrl ? ["Logo"] : []),
          ...(tnbSet ? ["TNB aus Datenbank"] : []),
        ].join(", ");
        setTplStatus(`„${baseName}" auf die Gruppe ${tplGroup} übertragen${count ? ` (${count} Titel)` : ""} — ${parts}.${filledNote}${conf}`);
      } else {
        // Ohne Gruppe: als freie eigene Vorlage speichern (altes Verhalten).
        const preset: VerlagsPreset = {
          id: genId("custom"),
          gruppe: "Eigene Vorlagen",
          verlag: "Eigene Vorlagen",
          titel: baseName,
          titelKanonisch: baseName,
          fontFamily: css,
          fontAvailable: available,
          fontRaw,
          colors,
          format: String(a.format || ""),
          logoPosition: String(a.logoPosition || "n/a"),
          logoUrl: "",
          layoutVariant,
        };
        saveCustomPreset(preset);
        onPresetCreated?.(preset);
        setTplStatus(`„${baseName}" gespeichert. Anwendbar im Tab „Verlag" unter „Eigene Vorlagen".${filledNote}${conf}`);
      }
    } catch (err) {
      setTplStatus("");
      setTplError(`Analyse fehlgeschlagen: ${(err as Error).message}`);
    } finally {
      setTplBusy(false);
    }
  };

  // Erzeugt KI-Untertitel (falls leer) + beide Karten-Bilder. Motive kommen
  // IMMER aus den Fragen des aktiven Quiz: Frage 4 → Bild oben, Frage 5 →
  // Bild unten. Fragen/Titel werden hier nie verändert — die kommen aus der
  // Datenbank (Fragenkatalog) bzw. der Vorlage.
  const handleGenerateImages = async () => {
    setError("");
    const fallback = quiz.meta.title || "Zeitungsquiz";
    try {
      if (!quiz.meta.subtitle?.trim()) {
        setStatus("generating");
        try {
          const result = await generateQuizContent(fallback, styleText, difficulty);
          if (result?.subtitle) {
            dispatch({ type: "UPDATE_META", payload: { subtitle: String(result.subtitle) } });
          }
        } catch (e) {
          console.warn("KI-Untertitel fehlgeschlagen — fahre ohne fort:", e);
        }
      }
      setStatus("imaging");
      await generateTwoCardImages(dispatch, cardImageSubjects(quiz, fallback), imageStyleMode);
      setStatus("done");
    } catch (e) {
      setError(`Bildgenerierung fehlgeschlagen: ${(e as Error).message}`);
      setStatus("error");
    }
  };

  // Schneidet die BEREITS vorhandenen Bilder des aktiven Quiz passend zu
  // (Weißränder weg + exakt auf Box-Seitenverhältnis) — ohne Neugenerierung.
  const handleFitImages = async () => {
    setError("");
    const top = quiz.theme.background?.image;
    const bottom = quiz.theme.background?.imageBottom;
    if (!top && !bottom) { setError("Das Quiz hat noch keine Bilder."); return; }
    try {
      setStatus("imaging");
      if (top) dispatch({ type: "UPDATE_BACKGROUND", payload: { image: await fitCardImage(top) } });
      if (bottom) dispatch({ type: "UPDATE_BACKGROUND", payload: { imageBottom: await fitCardImage(bottom) } });
      setStatus("done");
    } catch (e) {
      setError(`Zuschneiden fehlgeschlagen: ${(e as Error).message}`);
      setStatus("error");
    }
  };

  const handleDocumentPick = async (file: File | null) => {
    if (!file) return;
    setError("");
    if (!/\.(docx|xlsx|xlsm|xls|csv|tsv)$/i.test(file.name)) {
      setError("Erlaubte Formate: .docx, .xlsx oder .csv.");
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
    setImportedQuizzes(null);
  };

  const busy = status === "generating" || status === "imaging";

  return (
    <div className="border-2 border-blue-300 rounded-md bg-blue-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
        <Sparkles className="w-4 h-4" /> KI-Werkzeuge
      </div>
      <div className="text-xs text-stone-600">
        Fragen kommen aus dem Fragenkatalog (Datenbank), Texte und Layout aus der
        Verlags-Vorlage. Die KI generiert nur noch Bilder und Untertitel.
      </div>

      <Field label="Schwierigkeit (für KI-Untertitel)">
        <DifficultyPicker value={difficulty} onChange={setDifficulty} disabled={busy} />
      </Field>

      <div className="flex gap-2">
        <label className={`px-3 py-2 text-sm border border-stone-300 bg-white rounded cursor-pointer hover:bg-stone-50 flex items-center gap-1 whitespace-nowrap ${busy || importing ? "opacity-50 pointer-events-none" : ""}`}
          title="Fragenkatalog aus Word/Excel importieren — Fragen und Antworten kommen aus der Datei">
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Fragenkatalog importieren
          <input type="file"
            accept=".docx,.xlsx,.xlsm,.xls,.csv,.tsv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values"
            className="hidden"
            onChange={e => { handleDocumentPick(e.target.files?.[0] || null); e.target.value = ""; }}
            disabled={busy || importing} />
        </label>
        <div className="flex-1" />
        <button onClick={handleFitImages} disabled={busy}
          title="Schneidet die vorhandenen Bilder passend zu: Weißränder entfernen + exakt auf das Box-Format bringen. Keine Neugenerierung."
          className="px-3 py-2 text-sm border border-stone-300 bg-white rounded hover:bg-stone-50 disabled:opacity-50 whitespace-nowrap">
          Bilder passend zuschneiden
        </button>
        <button onClick={handleGenerateImages} disabled={busy}
          title="Erzeugt die beiden Aquarell-Bilder aus Frage 4 (oben) und Frage 5 (unten); Untertitel wird ergänzt, falls leer."
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap font-medium">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {status === "generating" ? "Untertitel …" : status === "imaging" ? "Bilder …" : "Bilder generieren (Frage 4 + 5)"}
        </button>
      </div>

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

      {error && (
        <div className="text-xs text-red-700 bg-red-100 border border-red-300 rounded px-2 py-1 flex items-start gap-2">
          <X className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Verlags-Vorlage hochladen → KI extrahiert Farben, Schrift und Layout */}
      <div className="bg-white border border-stone-200 rounded px-2.5 py-2 space-y-1.5">
        <div className="text-xs font-medium text-stone-800 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-blue-600" /> Verlags-Vorlage analysieren
        </div>
        <div className="text-[11px] text-stone-500 leading-relaxed">
          Beispielanzeige eines Verlags (PDF, PNG oder JPG) hochladen — die KI übernimmt die
          TEXTE der Vorlage in die Gefäße des aktiven Quiz (Untertitel, So geht&apos;s, Störer,
          Gewinner, Teilnahmebedingungen, Telefon-Hinweis, Lösungswörter) sowie das Layout.
          Titel und Fragen-Überschrift bleiben generiert (mit Gewinnsumme bzw. Themenbezug),
          die Fragen kommen aus der Datenbank. Mit gewählter Verlagsgruppe gelten
          Farben/Schrift/Layout zusätzlich für ALLE Titel der Gruppe. Vorlagen-Elemente ohne
          passendes Gefäß werden unten aufgelistet.
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={tplGroup} onChange={e => setTplGroup(e.target.value)} disabled={tplBusy}
            className="h-8 px-2 text-xs rounded border border-stone-300 bg-white text-stone-800 max-w-[220px]">
            <option value="">Keine Gruppe (nur speichern)</option>
            {tplGroups.map(g => (
              <option key={g.name} value={g.name}>{g.name} ({g.count} Titel)</option>
            ))}
          </select>
          {tplGroup && (
            <>
              <label className="flex items-center gap-1 text-[11px] text-stone-700 cursor-pointer"
                title="Abgewählt: Die Farben aus der Datenbank (bestehendes Preset) bleiben aktiv.">
                <input type="checkbox" checked={tplTakeColors} disabled={tplBusy}
                  onChange={e => setTplTakeColors(e.target.checked)} className="accent-blue-600" />
                Farben aus Vorlage
              </label>
              <label className="flex items-center gap-1 text-[11px] text-stone-700 cursor-pointer"
                title="Abgewählt: Die Schrift aus der Datenbank (bestehendes Preset) bleibt aktiv.">
                <input type="checkbox" checked={tplTakeFont} disabled={tplBusy}
                  onChange={e => setTplTakeFont(e.target.checked)} className="accent-blue-600" />
                Schrift aus Vorlage
              </label>
            </>
          )}
          <button onClick={() => tplFileRef.current?.click()} disabled={tplBusy}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 font-medium">
            {tplBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {tplBusy ? "Analysiere …" : "Vorlage hochladen"}
          </button>
          {tplStatus && <span className="text-[11px] text-emerald-700">{tplStatus}</span>}
          {tplError && <span className="text-[11px] text-rose-600">{tplError}</span>}
        </div>
        <input ref={tplFileRef} type="file" className="hidden" onChange={handleTemplateUpload}
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" />
        {tplUnmapped.length > 0 && (
          <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-300 rounded px-2.5 py-2 space-y-1">
            <div className="font-semibold">⚠ Kein passendes Gefäß für diese Vorlagen-Elemente:</div>
            <ul className="list-disc pl-4 space-y-0.5">
              {tplUnmapped.map((u, i) => <li key={i}>{u}</li>)}
            </ul>
            <div className="text-amber-700">
              Diese Inhalte wurden NICHT übernommen. Bitte entscheide, ob dafür neue Felder
              ins Tool sollen oder ob sie entfallen können.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Galerie über ALLE Quizze der Sammlung: Bild oben (Frage 4) und Bild unten
// (Frage 5) untereinander prüfen und einzeln neu generieren. Die Sammel-
// Generierung fehlender Bilder läuft über den bestehenden Bulk-Pfad.
function ImageGalleryPanel({ collection, imageStyleMode, setImageStyleMode, onUpdateQuizImage, onGenerateMissingImages, onRegenerateAllImages, bulkBusy }: {
  collection: QuizCollection | null;
  imageStyleMode: ImageStyleMode;
  setImageStyleMode: (m: ImageStyleMode) => void;
  onUpdateQuizImage: (index: number, patch: { image?: string; imageBottom?: string }) => void;
  onGenerateMissingImages: () => void;
  onRegenerateAllImages: (keys: string[]) => void;
  bulkBusy: boolean;
}) {
  // `${index}:${slot}` des gerade laufenden Einzel-Jobs.
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // Offenes Prompt-Eingabefeld (`${index}:${slot}`) + dessen Text und Stil
  // (Stil gilt nur für DIESE eine Generierung; Default = globaler Stil).
  const [promptKey, setPromptKey] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [promptStyle, setPromptStyle] = useState<ImageStyleMode>(imageStyleMode);
  // Fortschritt des TIFF-Sammel-Exports (z. B. "12/54"), null = inaktiv.
  const [tiffProgress, setTiffProgress] = useState<string | null>(null);
  // Vom Sammellauf ABGEWÄHLTE Bilder (Checkbox aus = wird nicht neu generiert).
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const toggleExcluded = (key: string) => setExcluded(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  if (!collection) {
    return (
      <div className="text-xs text-stone-500">
        Keine Sammlung geladen — erst den Fragenkatalog importieren, dann erscheinen hier
        alle Quizze mit ihren beiden Bildern.
      </div>
    );
  }

  const missingCount = collection.quizzes.reduce((n, q) =>
    n + (q.theme.background?.image ? 0 : 1) + (q.theme.background?.imageBottom ? 0 : 1), 0);

  const allKeys = collection.quizzes.flatMap((_, i) => [`${i}:image`, `${i}:imageBottom`]);
  const selectedKeys = allKeys.filter(k => !excluded.has(k));
  const presentCount = collection.quizzes.length * 2 - missingCount;

  // Alle vorhandenen Bilder als TIFF in ein ZIP packen. Dateinamen:
  // <Nr>_<Antwort>_Bild_oben.tif — die Nummer verhindert Kollisionen bei
  // gleichen Antworten und hält die Reihenfolge der Quizze.
  const exportAllTiffs = async () => {
    setTiffProgress("0");
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      let done = 0;
      for (let i = 0; i < collection.quizzes.length; i++) {
        const q = collection.quizzes[i];
        for (const slot of ["image", "imageBottom"] as const) {
          const url = slot === "image" ? q.theme.background?.image : q.theme.background?.imageBottom;
          if (!url) continue;
          const question = slot === "image" ? q.questions[3] : q.questions[4];
          const answer = question?.correctAnswer || question?.text || `Quiz_${i + 1}`;
          const part = slot === "image" ? "Bild_oben" : "Bild_unten";
          const name = `${String(i + 1).padStart(2, "0")}_${safeFilePart(answer)}_${part}.tif`;
          zip.file(name, await encodeImageToTiff(url));
          done++;
          setTiffProgress(`${done}/${presentCount}`);
        }
      }
      setTiffProgress("ZIP packen …");
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      downloadBlob(blob, `Quiz-Bilder_TIFF_${timestampForFilename()}.zip`);
    } catch (e) {
      alert(`TIFF-Export fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setTiffProgress(null);
    }
  };

  const regen = async (index: number, slot: "image" | "imageBottom", subject: string, style?: ImageStyleMode) => {
    if (!subject.trim()) return;
    const key = `${index}:${slot}`;
    setBusyKey(key);
    try {
      const url = await generateCardImageForSubject(subject.trim(), style ?? imageStyleMode);
      onUpdateQuizImage(index, { [slot]: url });
    } catch (e) {
      alert(`Bildgenerierung fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusyKey(null);
    }
  };

  const slotCell = (index: number, slot: "image" | "imageBottom") => {
    const q = collection.quizzes[index];
    const url = slot === "image" ? q.theme.background?.image : q.theme.background?.imageBottom;
    const question = slot === "image" ? q.questions[3] : q.questions[4];
    const key = `${index}:${slot}`;
    const busy = busyKey === key;
    const [subjTop, subjBot] = cardImageSubjects(q, q.meta.title || `Quiz ${index + 1}`);
    const defaultSubject = slot === "image" ? subjTop : subjBot;
    const promptOpen = promptKey === key;
    return (
      <div className="flex-1 min-w-0">
        <label className="flex items-center gap-1.5 text-[11px] text-stone-500 mb-1 cursor-pointer"
          title={question?.text || ""}>
          <input type="checkbox" checked={!excluded.has(key)}
            onChange={() => toggleExcluded(key)}
            className="accent-sky-500 shrink-0"
            title="Häkchen entfernen = beim Sammellauf NICHT neu generieren" />
          <span className="truncate">
            {slot === "image" ? "Bild oben — Frage 4: " : "Bild unten — Frage 5: "}
            <span className="text-stone-700 font-medium">{question?.correctAnswer || question?.text || "—"}</span>
          </span>
        </label>
        <div className="rounded-lg overflow-hidden bg-stone-100 relative"
          style={{ aspectRatio: "1.25", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }}>
          {url
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={url} alt="" className="w-full h-full object-cover block" />
            : <div className="w-full h-full flex items-center justify-center text-[11px] text-stone-400">
                Kein Bild
              </div>}
          {busy && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          )}
        </div>
        {promptOpen ? (
          /* Sichtbares Prompt-Feld: vorbefüllt mit dem Standard-Motiv, frei
             editierbar. Enter oder "Erzeugen" startet die Generierung. */
          <div className="mt-1 space-y-1">
            <textarea value={promptText} autoFocus rows={2}
              onChange={e => setPromptText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  setPromptKey(null);
                  regen(index, slot, promptText, promptStyle);
                }
                if (e.key === "Escape") setPromptKey(null);
              }}
              placeholder={`Motiv / Prompt (${IMAGE_STYLE_PRESETS[promptStyle].label}-Stil kommt automatisch dazu)`}
              className="w-full text-[11.5px] rounded-md border border-blue-300 p-1.5 bg-white focus:outline-none" />
            {/* Stil NUR für diese eine Generierung — ändert den globalen Stil nicht. */}
            <label className="flex items-center gap-1.5 text-[11px] text-stone-500">
              <span className="shrink-0">Stil:</span>
              <select value={promptStyle}
                onChange={e => setPromptStyle(e.target.value as ImageStyleMode)}
                className="flex-1 h-6 text-[11px] rounded-md border border-stone-200 bg-white px-1 focus:outline-none">
                {(Object.keys(IMAGE_STYLE_PRESETS) as ImageStyleMode[]).map(k => (
                  <option key={k} value={k}>{IMAGE_STYLE_PRESETS[k].label}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-1">
              <button onClick={() => { setPromptKey(null); regen(index, slot, promptText, promptStyle); }}
                disabled={!!busyKey || bulkBusy || !promptText.trim()}
                className="flex-1 h-7 text-[11.5px] rounded-md text-white font-medium disabled:opacity-40"
                style={{ background: "#0071e3" }}>
                Erzeugen
              </button>
              <button onClick={() => setPromptKey(null)}
                className="h-7 px-2.5 text-[11.5px] rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700">
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex gap-1">
            <button onClick={() => { setPromptKey(key); setPromptText(defaultSubject); setPromptStyle(imageStyleMode); }}
              disabled={!!busyKey || bulkBusy}
              className="flex-1 h-7 text-[11.5px] rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              {url ? "Neu generieren …" : "Generieren …"}
            </button>
            {url && (
              <button
                onClick={async () => {
                  try {
                    const answer = question?.correctAnswer || question?.text || defaultSubject;
                    const part = slot === "image" ? "Bild_oben" : "Bild_unten";
                    await downloadImageAsTiff(url, `${safeFilePart(answer)}_${part}.tif`);
                  } catch (e) {
                    alert(`TIFF-Export fehlgeschlagen: ${(e as Error).message}`);
                  }
                }}
                disabled={!!busyKey || bulkBusy}
                title="Als offenes TIFF speichern (verlustfrei, für InDesign) — Dateiname: Antwort + Bild oben/unten"
                className="h-7 px-2.5 text-[11.5px] rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1">
                <Download className="w-3 h-3" /> TIFF
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* flex-wrap + shrink-0: das Panel ist schmal — ohne Umbruch schoben
          sich Stil-Select und Buttons übereinander. */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-[11.5px] text-stone-500 w-full">
          {collection.quizzes.length} Quizze · {missingCount === 0
            ? "alle Bilder vorhanden"
            : `${missingCount} Bild(er) fehlen`}
        </div>
        {/* Globaler Stil: gilt für Sammelläufe UND als Voreinstellung der
            Einzel-Generierung (dort pro Bild übersteuerbar). */}
        <label className="flex items-center gap-1.5 text-[11.5px] text-stone-600 shrink-0">
          <span className="shrink-0">Stil für alle:</span>
          <select value={imageStyleMode}
            onChange={e => setImageStyleMode(e.target.value as ImageStyleMode)}
            disabled={bulkBusy || !!busyKey}
            className="h-8 text-[12px] rounded-lg border border-stone-200 bg-white px-2 focus:outline-none disabled:opacity-40 max-w-[180px]">
            {(Object.keys(IMAGE_STYLE_PRESETS) as ImageStyleMode[]).map(k => (
              <option key={k} value={k}>{IMAGE_STYLE_PRESETS[k].label}</option>
            ))}
          </select>
        </label>
        <button onClick={onGenerateMissingImages} disabled={bulkBusy || !!busyKey || missingCount === 0}
          title={missingCount === 0 ? "Kein Bild fehlt — dieser Knopf füllt nur LEERE Bildplätze. Zum Neu-Generieren im gewählten Stil: 'Ausgewählte neu generieren'." : undefined}
          className="h-8 px-3 text-[12px] rounded-lg text-white disabled:opacity-40 font-medium shrink-0"
          style={{ background: "#0071e3" }}>
          {bulkBusy ? "Generiere …" : `Alle fehlenden generieren (${missingCount})`}
        </button>
        <button onClick={() => onRegenerateAllImages(selectedKeys)}
          disabled={bulkBusy || !!busyKey || selectedKeys.length === 0}
          title="Erzeugt alle ANGEWÄHLTEN Bilder neu (Häkchen an den Bildern) im gewählten Stil. Abgewählte bleiben unangetastet. Sicherheitsabfrage folgt."
          className="h-8 px-3 text-[12px] rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-40 font-medium transition-colors shrink-0">
          Ausgewählte neu generieren ({selectedKeys.length})
        </button>
        <button onClick={exportAllTiffs}
          disabled={bulkBusy || !!busyKey || !!tiffProgress || presentCount === 0}
          title="Alle vorhandenen Bilder als TIFF (verlustfrei, für InDesign) in ein ZIP packen. Dateinamen: Nr_Antwort_Bild_oben/unten.tif"
          className="h-8 px-3 text-[12px] rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-40 font-medium transition-colors flex items-center gap-1.5 shrink-0">
          <Download className="w-3.5 h-3.5" />
          {tiffProgress ? `TIFF ${tiffProgress}` : `Alle als TIFF (ZIP, ${presentCount})`}
        </button>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-stone-500">
        <span>Häkchen an = wird beim Sammellauf neu generiert.</span>
        <button onClick={() => setExcluded(new Set())} className="text-sky-700 hover:underline">Alle anwählen</button>
        <button onClick={() => setExcluded(new Set(allKeys))} className="text-sky-700 hover:underline">Alle abwählen</button>
      </div>
      <div className="space-y-4">
        {/* Index als Key: die Sammlung-Quizze teilen sich teils dieselbe id
            ("quiz_new" aus dem Import-Template), die Reihenfolge ist stabil. */}
        {collection.quizzes.map((q, i) => (
          <div key={i} className="rounded-xl bg-white p-3"
            style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }}>
            <div className="text-[12.5px] font-semibold text-stone-800 mb-2 truncate">
              {i + 1}. {q.meta.title || `Quiz ${i + 1}`}
            </div>
            <div className="flex gap-3">
              {slotCell(i, "image")}
              {slotCell(i, "imageBottom")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Speichern/Anwenden der Layout-Vorlagen im Tab "Format & Layout".
function LayoutTemplatesPanel({ quiz, dispatch }: { quiz: Quiz; dispatch: React.Dispatch<Action> }) {
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  useEffect(() => { setTemplates(loadLayoutTemplates()); }, []);
  const update = (list: LayoutTemplate[]) => { setTemplates(list); persistLayoutTemplates(list); };

  const variantLabel = (v: string) =>
    v === "querformat" ? "Querformat" : v === "redaktionell" ? "Redaktionell" : "Beilage";

  const handleSave = () => {
    const suggestion = `${variantLabel(quiz.layout.variant || "beilage")} ${new Date().toLocaleDateString("de-DE")}`;
    const name = window.prompt("Name für die Layout-Vorlage:", suggestion);
    if (!name || !name.trim()) return;
    update([...templates, {
      id: genId("lt"),
      name: name.trim(),
      variant: (quiz.layout.variant || "beilage") as LayoutTemplate["variant"],
      transforms: quiz.layout.transforms || {},
      createdAt: Date.now(),
    }]);
  };
  const handleApply = (tpl: LayoutTemplate) => {
    // Variante + sämtliche Element-Anpassungen 1:1 übernehmen (ersetzt
    // vorhandene Anpassungen des aktiven Quiz).
    dispatch({ type: "UPDATE_LAYOUT", payload: { variant: tpl.variant, transforms: tpl.transforms } });
  };

  return (
    <Field label="Layout-Vorlagen (gespeicherte Anpassungen)">
      <div className="space-y-1.5">
        <button onClick={handleSave}
          className="w-full h-8 text-[12.5px] rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors">
          Aktuelles Layout als Vorlage speichern
        </button>
        {templates.length === 0 && (
          <div className="text-[11px] text-stone-400 px-1">
            Noch keine Vorlagen gespeichert. Elemente im Layout anpassen, dann hier speichern.
          </div>
        )}
        {templates.map(tpl => (
          <div key={tpl.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white"
            style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }}>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium text-stone-800 truncate">{tpl.name}</div>
              <div className="text-[10.5px] text-stone-500">
                {variantLabel(tpl.variant)} · {Object.keys(tpl.transforms).length} Anpassung(en)
              </div>
            </div>
            <button onClick={() => handleApply(tpl)}
              className="h-7 px-2 text-[11.5px] rounded-md text-emerald-700 hover:bg-emerald-100 transition-colors shrink-0">
              Anwenden
            </button>
            <button onClick={() => { if (confirm(`Layout-Vorlage „${tpl.name}" löschen?`)) update(templates.filter(t => t.id !== tpl.id)); }}
              className="h-7 px-2 text-[11.5px] rounded-md text-rose-600 hover:bg-rose-50 transition-colors shrink-0">
              ✕
            </button>
          </div>
        ))}
      </div>
    </Field>
  );
}

function StyleSettingsPanel({ styleText, setStyleText, resetText, styleImage, setStyleImage, resetImage }: {
  styleText: string; setStyleText: (s: string) => void; resetText: () => void;
  styleImage: string; setStyleImage: (s: string) => void; resetImage: () => void;
}) {
  const textIsDefault = styleText === DEFAULT_TEXT_STYLE;
  const imageIsDefault = styleImage === DEFAULT_IMAGE_STYLE;
  return (
    <Section title="KI-Stil-Vorgaben (gelten für jede Generierung)" defaultOpen={false} icon={<Settings className="w-4 h-4" />} tabKey="ki">
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
    <div className="rounded-xl bg-white p-2 flex flex-col h-full" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.05)" }}>
      <div className="flex items-center justify-between mb-1 px-1 gap-2 shrink-0">
        <div className="text-xs font-semibold text-stone-700">
          Quiz-Sammlung · {activeIndex + 1} / {quizzes.length}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onRepair}
            title="Reihenfolge umkehren (Frage 1 → 50€, Frage 5 → 1000€), neuen Titel mit Gewinnsumme setzen, Gewinner-/AGB-Text füllen. Achtung: Die beiden Karten-Bilder werden geleert und müssen über 'Fehlende Bilder generieren' neu erzeugt werden (dann aus Frage 4 + 5)."
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
      <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
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

function EditorPanel({ quiz, dispatch, canUndo, canRedo, onExport, onExportPdf, exportingPdf, onImport, onReset, styleProps, difficulty, setDifficulty, collection, bulkProgress, onSwitchQuiz, onBulkImport, onClearCollection, onRepairCollection, onPublish, publishing, onGenerateMissingImages, activeSection, embedded, previewPreset, setPreviewPreset, downloadingPresetId, onDownloadPreset, onDownloadPresetsBulk, presetBulk, onPushPresetsMonday, mondayBulk, imageStyleMode, setImageStyleMode, onUpdateQuizImage, onRegenerateAllImages }: {
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
  // Im neuen Shell-Modus: zeigt nur die ausgewählte Sektion und blendet
  // Toolbar/Sammlung/Generator aus (die rendert die Shell separat).
  activeSection?: string;
  embedded?: boolean;
  // Vorschau-/Download-Steuerung für die Verlags-Liste.
  previewPreset?: VerlagsPreset | null;
  setPreviewPreset?: (p: VerlagsPreset | null) => void;
  downloadingPresetId?: string | null;
  onDownloadPreset?: (p: VerlagsPreset) => void;
  onDownloadPresetsBulk?: (presets: VerlagsPreset[]) => Promise<void> | void;
  presetBulk?: { current: number; total: number; name: string } | null;
  onPushPresetsMonday?: (presets: VerlagsPreset[]) => Promise<void> | void;
  mondayBulk?: { current: number; total: number; name: string; failed: number } | null;
  imageStyleMode?: ImageStyleMode;
  // Bilder-Galerie: ersetzt ein Karten-Bild eines beliebigen Sammlungs-Quiz.
  onUpdateQuizImage?: (index: number, patch: { image?: string; imageBottom?: string }) => void;
  // Bilder-Galerie: generiert die angewählten Karten-Bilder der Sammlung neu.
  onRegenerateAllImages?: (keys: string[]) => void;
  setImageStyleMode?: (m: ImageStyleMode) => void;
}) {
  const r = quiz.theme.readability;
  const darkTitle = isDark(quiz.theme.colors.title);
  const darkQuestion = isDark(quiz.theme.colors.question);
  const contrastWarn = (r.blockBackdrop !== "none" || r.scrim > 0.3) && (darkTitle || darkQuestion);
  const derivedTitle = deriveTitleFromQuestions(quiz);
  const show = (key: string) => !embedded || activeSection === key;
  // Geldregen-Modus: blendet Wissensquiz-spezifische Sektionen (Foto-Hintergrund,
  // Lesbarkeits-Layer, Frage-4/5-Bilder) aus und zeigt stattdessen die auf das
  // Schatzsuche-Spielkonzept zugeschnittenen Einstellungen.
  const isGeldregen = quiz.layout.format === "schatzsuche";

  return (
    <div className={embedded ? "space-y-3 overflow-y-auto h-full pr-1" : "flex-shrink-0 space-y-2 overflow-y-auto pr-1"}
      style={embedded ? {} : { width: 400, height: "100%" }}>
      {!embedded && (
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
      )}

      {!embedded && bulkProgress && bulkProgress.phase === "imaging" && (
        <BulkProgressPanel progress={bulkProgress} />
      )}

      {!embedded && publishing && (
        <PublishingProgressPanel progress={publishing} />
      )}

      {!embedded && collection && (
        <QuizCollectionPicker collection={collection} activeTitle={quiz.meta.title}
          onSwitch={onSwitchQuiz} onClear={onClearCollection} onRepair={onRepairCollection}
          onPublish={onPublish} publishingDisabled={!!publishing || !!bulkProgress}
          onGenerateMissingImages={onGenerateMissingImages} />
      )}

      {(!embedded || activeSection === "ki") && (
      <AIGeneratorPanel quiz={quiz} dispatch={dispatch} styleText={styleProps.styleText} styleImage={styleProps.styleImage}
        difficulty={difficulty} setDifficulty={setDifficulty}
        imageStyleMode={imageStyleMode ?? "aquarell"}
        onBulkImport={onBulkImport} bulkDisabled={bulkProgress?.phase === "imaging"}
        onPresetCreated={p => setPreviewPreset?.(p)} />
      )}

      {!isGeldregen && (
      <Section title="Lesbarkeit" defaultOpen icon={<Eye className="w-4 h-4" />} tabKey="design">
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
      )}

      {!isGeldregen && (
      <Section title="Schriftgrößen" icon={<Eye className="w-4 h-4" />} tabKey="design">
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
      )}

      {/* ===== GELDREGEN: Kopf & Texte ===== */}
      {isGeldregen && (
      <Section title="Kopf & Texte" defaultOpen icon={<FileText className="w-4 h-4" />} tabKey="inhalt">
        <Field label="Kicker (kleine Zeile über dem Titel)">
          <Input value={quiz.meta.geldregenKicker ?? ""} placeholder="Schatzsuche: Anrufen und kassieren"
            onChange={e => dispatch({ type: "UPDATE_META", payload: { geldregenKicker: e.target.value } })} />
        </Field>
        <Field label="Titel (Headline)">
          <Input value={quiz.meta.title} placeholder="DIE GROSSE SCHATZSUCHE"
            onChange={e => dispatch({ type: "UPDATE_META", payload: { title: e.target.value } })} />
        </Field>
        <Field label="Untertitel (Schätze-Zeile)">
          <Input value={quiz.meta.subtitle} placeholder="8 Stellen, 8 Fragen, 357 Schätze im Wert von 140.000 € – wo graben Sie heute?"
            onChange={e => dispatch({ type: "UPDATE_META", payload: { subtitle: e.target.value } })} />
        </Field>
        <Field label="Spieltag-Nummer (Eck-Badge)">
          <Input value={quiz.meta.spieltag ?? ""} placeholder="z. B. 4"
            onChange={e => dispatch({ type: "UPDATE_META", payload: { spieltag: e.target.value } })} />
        </Field>
        <Field label="Störer-Text (rotes Badge unter der Karte)">
          <Input value={quiz.meta.stoererText ?? ""} placeholder="Jeder Anruf – eine neue Chance!"
            onChange={e => dispatch({ type: "UPDATE_META", payload: { stoererText: e.target.value } })} />
        </Field>
        <Field label="Spielregeln links (eine Zeile = ein Schritt, leer = Standard)">
          <Textarea rows={5} value={quiz.meta.geldregenRules ?? ""}
            placeholder={SZ_STEPS.join("\n")}
            onChange={e => dispatch({ type: "UPDATE_META", payload: { geldregenRules: e.target.value } })} />
        </Field>
        <Field label="Hinweis unter den Telefonnummern (klein)">
          <Textarea rows={2} value={quiz.meta.phoneTermsText}
            onChange={e => dispatch({ type: "UPDATE_META", payload: { phoneTermsText: e.target.value } })} />
        </Field>
        <Field label="Teilnahmebedingungen (Fußzeile)">
          <Textarea rows={3} value={quiz.meta.termsText}
            onChange={e => dispatch({ type: "UPDATE_META", payload: { termsText: e.target.value } })} />
        </Field>
        <Field label="Verlag">
          <Input value={quiz.meta.publisher}
            onChange={e => dispatch({ type: "UPDATE_META", payload: { publisher: e.target.value } })} />
        </Field>
      </Section>
      )}

      {/* ===== GELDREGEN: Grabungsstellen (Fragen) ===== */}
      {isGeldregen && (
      <Section title={`Grabungsstellen (${Math.min(quiz.questions.length, 8)} / 8)`} defaultOpen icon={<HelpCircle className="w-4 h-4" />} tabKey="fragen">
        <div className="text-xs text-stone-500 mb-2">
          Jede der 8 Stellen hat eine eigene Frage mit 2 Antworten. Stelle 1 trägt den
          höchsten Gewinn (oben). Antwort 1 → Rufnummer mit Endziffer 1, Antwort 2 → Endziffer 2.
          Die <b>Rufnummer</b> ist die Stamm-Nummer der Stelle (ohne Endziffer).
        </div>
        {quiz.questions.length < 8 && (
          <button onClick={() => dispatch({ type: "SET_QUESTION_COUNT", count: 8 })}
            className="w-full mb-2 px-2 py-1 text-xs border border-amber-300 bg-amber-50 text-amber-800 rounded hover:bg-amber-100">
            Auf 8 Grabungsstellen auffüllen
          </button>
        )}
        <div className="space-y-2">
          {quiz.questions.slice(0, 8).map((q, i) => (
            <GeldregenStationEditor key={q.id} question={q} index={i} prizes={quiz.prizes}
              onUpdate={payload => dispatch({ type: "UPDATE_QUESTION", id: q.id, payload })} />
          ))}
        </div>
      </Section>
      )}

      {!isGeldregen && (
      <Section title="Metadaten" tabKey="inhalt">
        <Field label="Titel (Headline)">
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs text-stone-600">
              <input type="checkbox" checked={quiz.meta.titleAuto}
                onChange={e => dispatch({ type: "SET_TITLE_AUTO", value: e.target.checked })} />
              Automatisch generieren (Zufallssatz mit Gewinnsumme — nie eine Frage)
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
        <Field label="Fragen-Überschrift">
          <Input value={quiz.meta.questionsHeadline ?? ""}
            placeholder={DEFAULT_QUESTIONS_HEADLINE}
            onChange={e => dispatch({ type: "UPDATE_META", payload: { questionsHeadline: e.target.value } })} />
        </Field>
        <Field label="Verlag"><Input value={quiz.meta.publisher} onChange={e => dispatch({ type: "UPDATE_META", payload: { publisher: e.target.value } })} /></Field>
        <Field label="Gewinner-Text"><Textarea rows={2} value={quiz.meta.winnersText} onChange={e => dispatch({ type: "UPDATE_META", payload: { winnersText: e.target.value } })} /></Field>
        <Field label="Teilnahmebedingungen"><Textarea rows={2} value={quiz.meta.termsText} onChange={e => dispatch({ type: "UPDATE_META", payload: { termsText: e.target.value } })} /></Field>
        <Field label="Hinweis unter Telefonnummern (klein)"><Textarea rows={2} value={quiz.meta.phoneTermsText} onChange={e => dispatch({ type: "UPDATE_META", payload: { phoneTermsText: e.target.value } })} /></Field>
        <Field label="So geht's-Text"><Textarea rows={3} value={quiz.meta.howToText ?? ""} onChange={e => dispatch({ type: "UPDATE_META", payload: { howToText: e.target.value } })} /></Field>
        <Field label="Störer-Text (überschreibt den automatischen Betrag)">
          <Input value={quiz.meta.stoererText ?? ""} placeholder={`z. B. "1'000€" — leer = Auto`}
            onChange={e => dispatch({ type: "UPDATE_META", payload: { stoererText: e.target.value } })} />
        </Field>
        <Field label="Lösungsworte vom Vortag"><Input value={quiz.meta.solutionWords ?? ""} onChange={e => dispatch({ type: "UPDATE_META", payload: { solutionWords: e.target.value } })} /></Field>
      </Section>
      )}

      <Section title={isGeldregen ? "Glückspilze (Gewinnerfotos)" : "Gewinner (oben rechts)"} defaultOpen={false} tabKey="gewinner">
        {isGeldregen && (
          <div className="text-xs text-stone-500 mb-2">
            Die hier gepflegten Gewinner erscheinen rechts in der Glückspilz-Spalte (Foto + Name/Ort).
            „Anzahl Gewinner“ steuert, wie viele angezeigt werden (0–5).
          </div>
        )}
        <WinnersEditor quiz={quiz} dispatch={dispatch} />
      </Section>

      {/* ===== GELDREGEN: Schatzkarte ===== */}
      {isGeldregen && (
      <Section title="Schatzkarte" defaultOpen icon={<ImageIcon className="w-4 h-4" />} tabKey="bilder">
        <div className="text-xs text-stone-500 mb-2">
          Ohne eigenes Bild wird die mitgelieferte Karte (<code>/schatzinsel.png</code>) verwendet.
          Die 8 Kreuze werden automatisch darüber gelegt. Für den Druck eine hochauflösende
          Karte hochladen.
        </div>
        <Field label="Eigene Schatzkarte (PNG/JPG)">
          <input type="file" accept="image/*" className="text-xs w-full"
            onChange={e => {
              const f = e.target.files?.[0]; if (!f) return;
              const rd = new FileReader();
              rd.onload = () => dispatch({ type: "UPDATE_BACKGROUND", payload: { image: rd.result as string } });
              rd.readAsDataURL(f);
            }} />
        </Field>
        {quiz.theme.background?.image && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={quiz.theme.background.image} alt="" style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #ddd" }} />
            <button onClick={() => dispatch({ type: "UPDATE_BACKGROUND", payload: { image: null } })}
              className="w-full mt-2 px-2 py-1 text-xs border border-stone-300 rounded hover:bg-red-50 text-red-700">
              Karte zurücksetzen (Standard verwenden)
            </button>
          </>
        )}
      </Section>
      )}

      {/* ===== GELDREGEN: Schatztruhe wählen ===== */}
      {isGeldregen && (
      <Section title="Schatztruhe" defaultOpen icon={<Coins className="w-4 h-4" />} tabKey="bilder">
        <div className="text-xs text-stone-500 mb-2">
          12 Motive, jeweils <b>offen</b> (mit Euroscheinen) und <b>geschlossen</b> im selben Look.
          Erst Zustand wählen, dann ein Motiv anklicken – es erscheint unten links auf der Anzeige.
        </div>
        {/* Offen / Geschlossen */}
        <div className="flex items-center p-0.5 rounded-lg bg-stone-100 mb-2 w-fit">
          {([["offen", false], ["geschlossen", true]] as const).map(([label, closed]) => {
            const active = !!quiz.meta.chestClosed === closed;
            return (
              <button key={label} onClick={() => dispatch({ type: "UPDATE_META", payload: { chestClosed: closed } })}
                className={`h-7 px-3 text-xs rounded-md transition-colors ${active ? "bg-white text-stone-900 font-medium shadow-sm" : "text-stone-500 hover:text-stone-700"}`}>
                {label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => {
            const sel = (quiz.meta.chestId ?? 1) === n;
            const suffix = quiz.meta.chestClosed ? "_closed" : "";
            return (
              <button key={n} onClick={() => dispatch({ type: "UPDATE_META", payload: { chestId: n } })}
                title={n === 0 ? "Keine Truhe" : `Truhe ${n}`}
                className={`aspect-square rounded-lg border-2 flex items-center justify-center overflow-hidden transition-colors ${
                  sel ? "border-amber-500 bg-amber-50" : "border-stone-200 bg-white hover:border-stone-300"
                }`}>
                {n === 0
                  ? <span className="text-[10px] text-stone-400 text-center leading-tight px-1">keine</span>
                  /* eslint-disable-next-line @next/next/no-img-element */
                  : <img src={`/chests/chest${String(n).padStart(2, "0")}${suffix}.png`} alt={`Truhe ${n}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
              </button>
            );
          })}
        </div>
      </Section>
      )}

      {!isGeldregen && (
      <Section title="Bilder (Frage 4 & 5)" defaultOpen={false} tabKey="bilder">
        <CardImages quiz={quiz} dispatch={dispatch}
          imageStyleMode={imageStyleMode ?? "aquarell"}
          setImageStyleMode={(m) => setImageStyleMode?.(m)} />
      </Section>
      )}

      {!isGeldregen && (
      <Section title="Galerie: Bilder aller Quizze" defaultOpen tabKey="bilder">
        <ImageGalleryPanel collection={collection}
          imageStyleMode={imageStyleMode ?? "aquarell"}
          setImageStyleMode={(m) => setImageStyleMode?.(m)}
          onUpdateQuizImage={(i, patch) => onUpdateQuizImage?.(i, patch)}
          onGenerateMissingImages={onGenerateMissingImages}
          onRegenerateAllImages={(keys) => onRegenerateAllImages?.(keys)}
          bulkBusy={bulkProgress?.phase === "imaging"} />
      </Section>
      )}

      <Section title="Format & Layout" tabKey="layout">
        {!isGeldregen && (
        <Field label="Layout-Variante">
          <Select value={quiz.layout.variant || "beilage"}
            onChange={e => dispatch({ type: "UPDATE_LAYOUT", payload: { variant: e.target.value } })}
            options={[
              { value: "beilage", label: "Beilage (Standard)" },
              { value: "querformat", label: "Querformat-Story (2 Spalten)" },
              { value: "redaktionell", label: "Redaktionell (Augsburger Stil, 4 Spalten)" }
            ]} />
        </Field>
        )}
        {!isGeldregen && <LayoutTemplatesPanel quiz={quiz} dispatch={dispatch} />}
        {isGeldregen && (
          <div className="text-xs text-stone-500 mb-1">
            Geldregen ist fest auf 315×220 mm (Querformat) ausgelegt. Über das Format-Menü
            kannst du jederzeit zurück zu den Wissensquiz-Layouts wechseln.
          </div>
        )}
        <Field label="Format">
          <Select value={quiz.layout.format} onChange={e => {
            const next = e.target.value;
            const payload: { format: string; orientation?: string; customSize?: { w: number; h: number } | null } = { format: next, customSize: null };
            if (next === "schwedenraetsel") payload.orientation = "portrait";
            if (next === "schatzsuche") payload.orientation = "landscape";
            dispatch({ type: "UPDATE_LAYOUT", payload });
          }}
            options={[
              { value: "berliner_halbformat", label: "Berliner Halbformat (315×235)" },
              { value: "a4", label: "A4 (210×297)" },
              { value: "a5", label: "A5 (148×210)" },
              { value: "schwedenraetsel", label: "Schwedenrätsel (A4 Vorlage)" },
              { value: "schatzsuche", label: "Schatzsuche (315×220 Vorlage)" },
              { value: "vollbild", label: "Vollbild (altes Layout)" }
            ]} />
        </Field>
        <Field label="Orientierung">
          <Select value={quiz.layout.orientation}
            onChange={e => dispatch({ type: "UPDATE_LAYOUT", payload: { orientation: e.target.value } })}
            options={[{ value: "landscape", label: "Querformat" }, { value: "portrait", label: "Hochformat" }]} />
        </Field>
      </Section>

      {!isGeldregen && (
      <Section title={`Fragen (${quiz.questions.length})`} tabKey="fragen">
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
      )}

      <Section title={`Preise (${quiz.prizes.length})`} defaultOpen={false} tabKey="preise">
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

      <Section title="Verlags-Vorlage" defaultOpen={false} tabKey="verlag">
        <VerlagsVorlage
          previewPresetId={previewPreset?.id ?? null}
          downloadingPresetId={downloadingPresetId ?? null}
          bulkProgress={presetBulk ?? null}
          mondayProgress={mondayBulk ?? null}
          onPreviewPreset={(p) => setPreviewPreset?.(p)}
          onDownloadPreset={(p) => onDownloadPreset?.(p)}
          onDownloadPresetsBulk={(list) => onDownloadPresetsBulk?.(list) || undefined}
          onPushPresetsMonday={(list) => onPushPresetsMonday?.(list) || undefined}
          applyPreset={(preset: VerlagsPreset) => {
            dispatch({ type: "APPLY_STYLE_COMMAND", payload: {
              applied: { theme: { fontFamily: preset.fontFamily }, colors: preset.colors }
            } });
            const size = parseAdSize(preset.format);
            if (size) {
              dispatch({ type: "UPDATE_LAYOUT", payload: { customSize: size } });
            }
            // Logo aus der Vorlage dauerhaft ins Quiz schreiben — überlebt
            // Reload (Quiz wird in IndexedDB persistiert). Wenn die Vorlage
            // kein Logo mitliefert, wird das Quiz-Logo explizit auf null
            // gesetzt — sonst bliebe ein Logo vom vorher ausgewählten
            // Verlag kleben.
            dispatch({ type: "UPDATE_THEME", payload: { publisherLogo: preset.logoUrl || null } });
            // Verlagsspezifische Teilnahmebedingungen mitsetzen — inkl.
            // Service-Hotline am Ende.
            loadTermsMap().then(map => {
              const v = map[termsVariantForPreset(preset)];
              if (v && v.termsText) {
                dispatch({ type: "UPDATE_META", payload: { termsText: buildFullTerms(v) } });
              }
            });
            // Auto-Titel mit Verlagsname (nur wenn der bisherige Titel
            // ebenfalls auto-generiert war oder leer ist).
            const autoT = buildPublisherTitle(preset);
            if (autoT) {
              dispatch({ type: "UPDATE_META", payload: { title: autoT, titleAuto: true } });
            }
            // Sonderlayout-Flag dauerhaft setzen (oder zurücksetzen), damit
            // das Quiz auch ohne Vorschau-Override das richtige Footer-Logo-
            // Verhalten zeigt.
            dispatch({ type: "UPDATE_THEME", payload: { bigFooterLogo: presetWantsBigFooterLogo(preset) } });
          }}
        />
      </Section>

      <Section title="Theme: Schrift & Farben" defaultOpen={false} tabKey="design">
        <Field label="Schriftart">
          <Select value={quiz.theme.fontFamily}
            onChange={e => dispatch({ type: "UPDATE_THEME", payload: { fontFamily: e.target.value } })}
            options={[
              { value: "Georgia, serif", label: "Georgia" },
              { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
              { value: "Times New Roman, serif", label: "Times New Roman" },
              { value: "Arial Black, sans-serif", label: "Arial Black" },
              { value: "Verdana, sans-serif", label: "Verdana" },
              { value: "Courier New, monospace", label: "Courier New" },
              { value: "'Myriad Pro', sans-serif", label: "Myriad Pro (Verlag)" },
              { value: "'Museo Sans', sans-serif", label: "Museo Sans (Verlag)" },
              { value: "'MuseoSansCyrl-900', sans-serif", label: "Museo Sans Cyrl 900 (Verlag)" },
              { value: "'Utopia Std', serif", label: "Utopia Std (Verlag)" },
              { value: "'Tabac Sans', sans-serif", label: "Tabac Sans (Verlag)" },
              { value: "'Roboto Condensed', sans-serif", label: "Roboto Condensed (Verlag)" }
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

      {!isGeldregen && (
      <Section title="Hintergrund-Bild" defaultOpen={false} tabKey="bilder">
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
      )}

      <Section title="Teilnahme" defaultOpen={false} tabKey="teilnahme">
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

// Editor für eine Geldregen-Grabungsstelle: Frage + 2 Antworten + Rufnummer + Preis.
// Bildet das Spielkonzept ab (immer 2 Antworten = Endziffer 1/2), ohne den
// generischen Freitext-/Zeitlimit-Ballast des Wissensquiz-QuestionEditors.
function GeldregenStationEditor({ question, index, prizes, onUpdate }: {
  question: Question; index: number; prizes: PrizeTier[];
  onUpdate: (p: Partial<Question>) => void;
}) {
  const [open, setOpen] = useState(index === 0);
  const prize = prizes.find(p => p.id === question.prizeTierId);
  const opts = question.options || [];
  const a1 = opts[0] ?? "";
  const a2 = opts[1] ?? "";
  const setAnswer = (slot: 0 | 1, val: string) => {
    const next = [a1, a2];
    next[slot] = val;
    // answerType bleibt "choice"; correctAnswer = erste Antwort als sinnvoller Default
    onUpdate({ answerType: "choice", options: next, correctAnswer: question.correctAnswer || next[0] });
  };
  return (
    <div className="border border-stone-200 rounded bg-stone-50">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center px-2 py-1.5 text-left text-xs hover:bg-stone-100">
        <span className="w-7 h-5 flex items-center justify-center rounded-full bg-amber-400 text-amber-900 font-bold mr-2 shrink-0">{index + 1}</span>
        <span className="flex-1 truncate">{question.text || "(Frage eingeben)"}</span>
        {prize && <span className="ml-1 text-stone-500 font-mono">{getPrizeLabel(prize)}</span>}
        {open ? <ChevronDown className="w-3 h-3 ml-1" /> : <ChevronRight className="w-3 h-3 ml-1" />}
      </button>
      {open && (
        <div className="p-2 space-y-2 border-t border-stone-200">
          <Field label={`Frage der Stelle ${index + 1}`}>
            <Input value={question.text} placeholder="z. B. Hauptstadt der Schweiz?"
              onChange={e => onUpdate({ text: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <div className="flex-1">
              <Field label="Antwort 1 (→ Endziffer 1)">
                <Input value={a1} onChange={e => setAnswer(0, e.target.value)} />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Antwort 2 (→ Endziffer 2)">
                <Input value={a2} onChange={e => setAnswer(1, e.target.value)} />
              </Field>
            </div>
          </div>
          <Field label="Rufnummer der Stelle (Stamm, ohne Endziffer)">
            <Input value={question.phoneNumber || ""} placeholder={`01378 4081${index + 1}`}
              onChange={e => onUpdate({ phoneNumber: e.target.value })} />
          </Field>
          <Field label="Gewinn-Stufe dieser Stelle">
            <Select value={question.prizeTierId || prizes[0]?.id} onChange={e => onUpdate({ prizeTierId: e.target.value })}
              options={prizes.map(p => ({ value: p.id, label: getPrizeLabel(p) }))} />
          </Field>
        </div>
      )}
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

function PreviewPane({ quiz, selectedBlockId, onSelectBlock, dispatch, editable }: { quiz: Quiz; selectedBlockId: string | null; onSelectBlock: (id: string | null) => void; dispatch?: React.Dispatch<Action>; editable?: boolean }) {
  const paneRef = useRef<HTMLDivElement>(null);
  const [paneSize, setPaneSize] = useState({ w: 600, h: 500 });
  const fmt = getQuizSize(quiz.layout);
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
  const padding = 8;
  const scaleX = (paneSize.w - padding * 2) / internal.w;
  const scaleY = (paneSize.h - padding * 2) / internal.h;
  const scale = Math.max(0.05, Math.min(scaleX, scaleY, 1));
  return (
    <div ref={paneRef} className="flex-1 relative overflow-hidden flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.03)", minHeight: 0 }} onClick={() => onSelectBlock(null)}>
      <div style={{ width: internal.w * scale, height: internal.h * scale, position: "relative" }}>
        <div style={{
          width: internal.w, height: internal.h,
          transform: `scale(${scale})`, transformOrigin: "top left",
          position: "absolute", top: 0, left: 0,
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)"
        }} onClick={e => e.stopPropagation()}>
          <PreviewRenderer quiz={quiz} width={internal.w} height={internal.h}
            selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock}
            editable={editable} dispatch={dispatch} />
        </div>
      </div>
      {selectedBlockId && !editable && (
        <div className="absolute top-2 left-2 text-xs text-stone-700 bg-white/85 px-2 py-1 rounded">
          Ausgewählt: <span className="font-mono">{selectedBlockId}</span>
        </div>
      )}
    </div>
  );
}

// Aquarell-Stilvorgabe — muss wie ein echtes Wasserfarbenbild auf Papier wirken.
const WATERCOLOR_STYLE = `CLASSICAL TRADITIONAL WATERCOLOR PAINTING on cold-press cotton paper, in the
artistic style of Beatrix Potter, John James Audubon, Marjolein Bastin and the
fine-art aquarelle tradition of European natural-history book illustration.

This is FINE ART made with REAL water, pigment and brush on actual paper — not
a digital image, not a photo, not a render. The viewer must immediately recognise
hand-craft and the medium of watercolour. Treat the prompt as a brief for a
human watercolourist; preserve the hand-made character.

REQUIRED PAINTING TECHNIQUES (must be visible):
- Transparent layered washes; the white of the paper shines through the colour.
- Wet-on-wet bleeds with soft, feathered, undefined edges where wet pigments meet.
- Wet-on-dry strokes with crisp painterly edges and visible brushwork.
- Granulating pigment — small pigment particles settling into paper grain.
- Backruns / cauliflowers in some areas (a hallmark of real watercolour).
- Visible cold-press paper TEXTURE underneath the paint — rough tooth of the paper.
- Faint underlying graphite pencil sketch lines partly covered by paint.
- FULL-BLEED: the painted scene fills the entire canvas edge to edge — no white
  margins, no unpainted borders, no vignette fading to white.

PALETTE: rich, vibrant, deeply saturated, luminous. Strong warm light. Bold,
juicy pigments built up in layered transparent glazes — colourful and alive,
NEVER pale, washed-out, faded or pastel. (Saturated through real pigment
layering, not digital neon.)

COMPOSITION: depict the subject in its natural, typical environment / habitat —
characteristic landscape, weather, vegetation. The main subject is clear and
fully inside the frame; the scene continues to all four edges of the canvas.

ABSOLUTELY NOT (these styles must be avoided at all costs):
- Photography, photo-realism, photo-bashing.
- 3D render, CGI, ray-traced, Octane, Blender, Unreal.
- Digital painting with smooth airbrush gradients.
- Oil painting, acrylic, gouache (opaque media).
- Vector / flat illustration, cartoon, anime, manga, comic style.
- Line drawing, ink only, woodcut.
- Subject pasted onto a flat or photographic background.

No text, no captions, no labels, no logos, no signature, no frame, no watermark.`;

// Fotorealistische Stilvorgabe — klares Foto in natürlicher Umgebung.
const PHOTO_CARD_STYLE = `PROFESSIONAL NATURE / EDITORIAL PHOTOGRAPHY in the subject's natural environment.
- Sharp focus on the main subject.
- Subject shown in its typical habitat or characteristic setting.
- Soft natural daylight, no harsh artificial shadows.
- Color-accurate, true to life, magazine-quality composition.

ABSOLUTELY NOT: illustration, watercolor, painting, drawing, sketch, 3D render.

No text, no logos, no frame, no watermark.`;

// Gemeinsame Schutzregeln für alle Stil-Presets:
// 1) randlos (sonst weiße Ränder → trimWhiteBorders reicht nicht immer),
// 2) NUR das beschriebene Motiv (motiv-neutral — eine tier-spezifische
//    Formulierung zwang früher in JEDES Motiv ein Tier),
// 3) Querformat-Totale, Motiv nie angeschnitten (Karten-Crop 1.25).
const STYLE_FULLBLEED_RULE = `Render exactly as described. CRITICAL: the image must cover the ENTIRE canvas edge to edge — no margins, no empty borders, no vignette.`;
const STYLE_ONLY_SUBJECT_RULE = "Depict ONLY the subject described below in its natural, typical setting — do NOT add animals, people or other subjects that are not part of the description. The subject is";
const STYLE_COMMON_SUFFIX = "shown in the centre of the frame as a WIDE LANDSCAPE SHOT, fully visible with comfortable margin, never cropped. FULL-BLEED: the scene fills the entire canvas edge to edge — no margins, no empty bands, no vignette.";

const IMAGE_STYLE_PRESETS = {
  aquarell: {
    label: "Aquarell",
    instruction: `Render exactly as described. CRITICAL: the painting must cover the ENTIRE canvas edge to edge — absolutely no white margins, no unpainted paper borders, no vignette, no empty bands at any edge. Every pixel of the canvas is painted watercolour scene.`,
    // Subjekt UND Hintergrund müssen aquarelliert sein — sonst rendert das
    // Modell ein Foto-Tier vor Aquarell-Landschaft. Deshalb mehrfach betonen,
    // dass das Tier SELBST aus Pinselstrichen besteht.
    // preferredModel bewusst NICHT gesetzt: die gpt-image-Kette (2 → 1.5 → 1)
    // befolgt die Full-Bleed-Vorgabe zuverlässig; DALL-E 3 malte trotz
    // Verbots immer wieder weiße Papierränder und Vignetten.
    // WICHTIG: motiv-neutral formulieren ("main subject", nicht "animal") —
    // eine tier-spezifische Vorgabe zwang früher in JEDES Motiv ein Tier.
    subjectPrefix: "A traditional hand-painted watercolour aquarelle illustration in soft, natural colours with gentle saturation. THE WHOLE PICTURE — including the main subject itself — is rendered entirely in transparent watercolour washes and visible brushstrokes, in the style of classical illustrated-book artwork. Depict ONLY the subject described below in its natural, typical setting — do NOT add animals, people or other subjects that are not part of the description. The subject is",
    subjectSuffix: "shown in the centre of the frame as a WIDE LANDSCAPE SHOT. COMPOSITION: the main subject is fully visible with comfortable margin — no part of it touching any edge, NEVER cropped. FULL-BLEED RULE (very important): the painted scene fills the ENTIRE canvas edge to edge — sky, water, landscape, architecture or interior continue all the way to all four borders. ABSOLUTELY NO white margins, NO unpainted borders, NO vignette fading to white at the edges, NO empty paper bands at the top or bottom — every part of the canvas is painted scene. The subject is formed by loose painterly brushstrokes and soft pigment bleeds — NOT photographic detail. COLOUR (very important): soft, natural watercolour colours with GENTLE, restrained saturation — like a classic, tasteful illustrated book. Colours stay fresh and friendly but slightly muted rather than vivid. Avoid strong saturation, garish or neon tones; equally avoid a completely washed-out, greyish pallor. Still unmistakably real watercolour: transparent washes, wet-on-wet bleeds, visible cold-press paper texture shining through the paint. ABSOLUTELY NO photo-realistic rendering, NO smooth gradients, NO photographic surface textures, NO 3D rendering, NO close-up cropping, NO portrait framing.",
    preferredModel: undefined,
    styleHint: undefined
  },
  fotorealistisch: {
    label: "Fotorealistisch",
    instruction: PHOTO_CARD_STYLE,
    subjectPrefix: "A professional editorial photograph of",
    subjectSuffix: "in its natural environment",
    preferredModel: undefined,
    styleHint: undefined
  },
  // ───── Stile übernommen aus ChatGPT Images 2.0 (gpt-image-2) ─────
  // gpt-image-2 hat KEINE Stil-Parameter in der API — auch ChatGPT setzt
  // seine Stile rein als Prompt-Formulierungen um. Die folgenden Presets
  // entsprechen den etablierten ChatGPT-Stilen (Ghibli, Pixar, Disney,
  // Retro-Anime, Claymation, Filz, Lego, Muppet, Cyberpunk, Pop Art,
  // Bauhaus, Jugendstil, Tusche, Wes Anderson, Charlie & Lola), jeweils
  // ergänzt um die Schutzregeln des Tools (randlos, NUR das beschriebene
  // Motiv, kein Text). Quelle der Formulierungen: ChatGPT-Stil-Guides 2026.
  ghibli: {
    label: "Studio Ghibli",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A Studio Ghibli–inspired illustration with soft painterly backgrounds, diffused natural lighting, vibrant yet grounded colors, a whimsical and nostalgic mood, a hand-drawn anime aesthetic and gentle organic texture. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO photo-realism, NO 3D rendering, NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  pixar: {
    label: "Pixar (3D)",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A Pixar-style 3D render with rounded friendly shapes, smooth detailed textures, cinematic soft lighting, shallow depth of field and polished character design. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO photo-realism, NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  disney: {
    label: "Disney-Animation",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A Disney-style animated illustration with clean linework, soft painterly shading, warm lighting and a polished storybook animation aesthetic. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO photo-realism, NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  retroAnime: {
    label: "Retro-Anime (80er/90er)",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A retro anime illustration inspired by 80s–90s cel animation with bold outlines, flat color shading, subtle grain, slightly muted tones and a nostalgic hand-painted animation feel. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO photo-realism, NO 3D rendering, NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  claymation: {
    label: "Claymation (Knete)",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A claymation-style scene with hand-molded clay textures, visible imperfections, soft studio lighting, shallow depth of field and a whimsical stop-motion aesthetic. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  filz: {
    label: "Filz-Figur",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A felt-toy style scene with soft fabric textures, visible stitching, simplified shapes, muted colors and a cozy handmade craft aesthetic. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  lego: {
    label: "Lego",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A LEGO-style scene rendered entirely from interlocking plastic bricks with smooth glossy surfaces, simplified features, bright primary colors and clean studio lighting. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  muppet: {
    label: "Muppet-Puppe",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A Muppet-style puppet scene with fuzzy felt textures, visible stitching, googly expressive eyes, soft studio lighting and playful puppet-like proportions. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  cyberpunk: {
    label: "Cyberpunk",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A cyberpunk-style scene with neon lighting, high-contrast shadows, futuristic details, holographic accents, saturated blues and magentas and a gritty sci-fi atmosphere. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  popart: {
    label: "Pop Art",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A pop art style image with bold graphic shapes, high-contrast colors, halftone patterns, thick outlines and a vibrant poster-like aesthetic inspired by print art. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO photo-realism, NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  bauhaus: {
    label: "Bauhaus",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A Bauhaus-inspired design with geometric forms, minimal ornamentation, flat color fields, strong contrast and a functional modernist aesthetic. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO photo-realism, NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  jugendstil: {
    label: "Art Nouveau (Jugendstil)",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "An Art Nouveau–inspired illustration with flowing organic lines, decorative patterns, elegant curves, muted jewel tones and an ornamental poster-like look. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO photo-realism, NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  tusche: {
    label: "Tuschemalerei (chinesisch)",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A traditional Chinese ink painting with expressive brushwork, limited ink washes, visible paper texture, soft gradients and a calm, poetic atmosphere. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO photo-realism, NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  wesAnderson: {
    label: "Wes Anderson",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A Wes Anderson–inspired photograph with symmetrical framing, a centered subject, pastel color palettes, soft even lighting and a whimsical storybook aesthetic. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  },
  charlieLola: {
    label: "Charlie & Lola (Kinderbuch)",
    instruction: STYLE_FULLBLEED_RULE,
    subjectPrefix: "A Charlie and Lola–inspired children's book illustration with collage-like textures, hand-drawn scribbles, uneven outlines, pastel colors and a playful childlike aesthetic. " + STYLE_ONLY_SUBJECT_RULE,
    subjectSuffix: STYLE_COMMON_SUFFIX + " NO photo-realism, NO text or labels.",
    preferredModel: undefined,
    styleHint: undefined
  }
} as const;
type ImageStyleMode = keyof typeof IMAGE_STYLE_PRESETS;

const IMAGE_STYLE_KEY = "wq.imageStyleMode";
function useImageStyleMode(): [ImageStyleMode, (m: ImageStyleMode) => void] {
  const [mode, setMode] = useState<ImageStyleMode>("aquarell");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(IMAGE_STYLE_KEY) : null;
    if (saved && saved in IMAGE_STYLE_PRESETS) setMode(saved as ImageStyleMode);
  }, []);
  const set = (m: ImageStyleMode) => {
    setMode(m);
    try { localStorage.setItem(IMAGE_STYLE_KEY, m); } catch {}
  };
  return [mode, set];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    r.readAsDataURL(file);
  });
}

// Erzeugt/verwaltet die zwei Karten-Bilder (oben = Frage 4, unten = Frage 5).
function CardImages({ quiz, dispatch, imageStyleMode, setImageStyleMode }: {
  quiz: Quiz; dispatch: React.Dispatch<Action>;
  imageStyleMode: ImageStyleMode;
  setImageStyleMode: (m: ImageStyleMode) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const q4 = quiz.questions[3];
  const q5 = quiz.questions[4];
  const topRef = useRef<HTMLInputElement>(null);
  const botRef = useRef<HTMLInputElement>(null);

  const subjectOf = (q?: Question) => (q ? (q.correctAnswer?.trim() || q.text?.trim() || "") : "");

  const genBoth = async () => {
    setError("");
    const targets: { key: "image" | "imageBottom"; q?: Question }[] = [
      { key: "image", q: q4 }, { key: "imageBottom", q: q5 }
    ];
    setBusy(true);
    try {
      for (const t of targets) {
        const subject = subjectOf(t.q);
        if (!subject) continue;
        const url = await generateCardImageForSubject(subject, imageStyleMode);
        dispatch({ type: "UPDATE_BACKGROUND", payload: { [t.key]: url } });
      }
      // (generateCardImageForSubject schickt automatisch preferredModel mit)
    } catch (e) {
      setError(`Bildgenerierung fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const upload = (key: "image" | "imageBottom"): React.ChangeEventHandler<HTMLInputElement> => async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const url = await fileToDataUrl(f);
    dispatch({ type: "UPDATE_BACKGROUND", payload: { [key]: url } });
  };

  const slot = (label: string, q: Question | undefined, key2: "image" | "imageBottom",
    src: string | null | undefined, inputRef: React.RefObject<HTMLInputElement | null>) => (
    <div className="border border-stone-200 rounded p-2 space-y-1">
      <div className="text-xs font-medium text-stone-700">{label}</div>
      <div className="text-[11px] text-stone-500 truncate">Motiv: {subjectOf(q) || "—"}</div>
      <div className="flex gap-1">
        <button onClick={() => inputRef.current?.click()}
          className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-white hover:bg-stone-50">Hochladen</button>
        {src && (
          <button onClick={() => dispatch({ type: "UPDATE_BACKGROUND", payload: { [key2]: null } })}
            className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50">Entfernen</button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={upload(key2)} />
    </div>
  );

  const logoRef = useRef<HTMLInputElement>(null);
  const uploadLogo: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const url = await fileToDataUrl(f);
    dispatch({ type: "UPDATE_THEME", payload: { publisherLogo: url } });
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-stone-600">
        Zwei Bilder — oben aus Frage 4, unten aus Frage 5. Stil-Wahl gilt für alle KI-Generierungen (auch Sammlung, Sammel-Import, „Fehlende Bilder").
      </div>
      <Field label="Bild-Stil">
        <Select value={imageStyleMode}
          onChange={e => setImageStyleMode(e.target.value as ImageStyleMode)}
          options={(Object.keys(IMAGE_STYLE_PRESETS) as ImageStyleMode[]).map(k => ({ value: k, label: IMAGE_STYLE_PRESETS[k].label }))} />
      </Field>
      <button onClick={genBoth} disabled={busy}
        className="w-full px-2 py-1.5 text-xs border border-blue-300 rounded bg-blue-50 text-blue-900 hover:bg-blue-100 disabled:opacity-50">
        {busy ? "Erzeuge Bilder …" : `Beide Bilder erzeugen (${IMAGE_STYLE_PRESETS[imageStyleMode].label})`}
      </button>
      {slot("Bild oben — Frage 4", q4, "image", quiz.theme.background?.image, topRef)}
      {slot("Bild unten — Frage 5", q5, "imageBottom", quiz.theme.background?.imageBottom, botRef)}

      {/* Zeitungslogo (unten rechts im Footer) */}
      <div className="border border-stone-200 rounded p-2 space-y-1">
        <div className="text-xs font-medium text-stone-700">Zeitungslogo (Footer)</div>
        <div className="text-[11px] text-stone-500">
          Wird unten rechts neben den Teilnahmebedingungen angezeigt. Akzeptiert PNG, JPG, SVG, WebP.
        </div>
        <div className="flex gap-1 items-center">
          <button onClick={() => logoRef.current?.click()}
            className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-white hover:bg-stone-50">
            {quiz.theme.publisherLogo ? "Logo ersetzen" : "Logo hochladen"}
          </button>
          {quiz.theme.publisherLogo && (
            <>
              <img src={quiz.theme.publisherLogo} alt="" className="h-7 max-w-16 object-contain bg-white border border-stone-200 rounded p-0.5" />
              <button onClick={() => dispatch({ type: "UPDATE_THEME", payload: { publisherLogo: null } })}
                className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50">Entfernen</button>
            </>
          )}
        </div>
        <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
          className="hidden" onChange={uploadLogo} />
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}

// Gewinner-Box: Anzahl (0–5) wählbar, je Foto + kurzer Text.
function WinnersEditor({ quiz, dispatch }: { quiz: Quiz; dispatch: React.Dispatch<Action> }) {
  const winners = quiz.meta.winners ?? [];
  const count = quiz.meta.winnerCount ?? 0;
  const photoRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Immer "count" Zeilen anzeigen — fehlende Slots werden als Stub gezeichnet,
  // damit Text-/Foto-Eingaben auch bei leerem winners-Array funktionieren.
  // Der Reducer "UPDATE_WINNER" macht ein Upsert (legt fehlende IDs an).
  const rows = Array.from({ length: Math.max(0, count) }, (_, i): Winner =>
    winners[i] ?? { id: `w${i + 1}`, text: "", photo: null }
  );

  const setPhoto = (id: string): React.ChangeEventHandler<HTMLInputElement> => async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const url = await fileToDataUrl(f);
    dispatch({ type: "UPDATE_WINNER", id, payload: { photo: url } });
  };

  return (
    <div className="space-y-2">
      <Field label="Anzahl veröffentlichter Gewinner">
        <Select value={String(count)}
          onChange={e => dispatch({ type: "UPDATE_META", payload: { winnerCount: Number(e.target.value) } })}
          options={[0, 1, 2, 3, 4, 5].map(n => ({ value: String(n), label: String(n) }))} />
      </Field>
      {rows.map((w, i) => (
        <div key={w.id} className="border border-stone-200 rounded p-2 space-y-1">
          <div className="text-xs font-medium text-stone-700">Gewinner {i + 1}</div>
          <Textarea rows={2} value={w.text} placeholder='z. B. "Gerda Müller freut sich über den Gewinn von 1.000 €"'
            onChange={e => dispatch({ type: "UPDATE_WINNER", id: w.id, payload: { text: e.target.value } })} />
          <div className="flex gap-1 items-center">
            <button onClick={() => photoRefs.current[i]?.click()}
              className="px-2 py-1 text-xs border border-stone-300 rounded bg-white hover:bg-stone-50">Foto hochladen</button>
            {w.photo && (
              <>
                <img src={w.photo} alt="" className="w-8 h-8 rounded-full object-cover border border-stone-200" />
                <button onClick={() => dispatch({ type: "UPDATE_WINNER", id: w.id, payload: { photo: null } })}
                  className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50">Entfernen</button>
              </>
            )}
          </div>
          <input ref={el => { photoRefs.current[i] = el; }} type="file" accept="image/*" className="hidden" onChange={setPhoto(w.id)} />
        </div>
      ))}
    </div>
  );
}

type RendererProps = {
  quiz: Quiz; width: number; height: number;
  selectedBlockId: string | null; onSelectBlock: (id: string | null) => void;
  // Wenn editable=true und dispatch gesetzt: Fragetext, Antwort und Telefon
  // werden im BeilageRenderer als contentEditable gerendert. Edits werden
  // beim Verlassen (onBlur) per UPDATE_QUESTION dispatcht. Für den unsichtbaren
  // PDF-Renderer bleibt editable=false, damit nichts in den Export schwappt.
  editable?: boolean;
  dispatch?: React.Dispatch<Action>;
};

function PreviewRenderer(props: RendererProps) {
  const fmt = props.quiz.layout.format;
  if (fmt === "schwedenraetsel") {
    return <SchwedenraetselRenderer quiz={props.quiz} width={props.width} height={props.height} />;
  }
  if (fmt === "schatzsuche") {
    return <SchatzsucheRenderer quiz={props.quiz} width={props.width} height={props.height} />;
  }
  if (fmt === "vollbild") {
    return <OverlayRenderer {...props} />;
  }
  // Layout-Variante: "querformat" = 2-Spalten-Story-Layout (Titel/Text links,
  // Bildcollage + Fragen rechts); "redaktionell" = 4-Spalten-Zeitungslayout
  // nach Augsburger Vorlage (Story links, Bilder Mitte, Fragen, Gewinner
  // rechts); sonst Standard-Beilage-Layout.
  if (props.quiz.layout.variant === "querformat") {
    return <QuerformatRenderer {...props} />;
  }
  if (props.quiz.layout.variant === "redaktionell") {
    return <RedaktionellRenderer {...props} />;
  }
  return <BeilageRenderer {...props} />;
}

// Inline-Editor für Texte direkt in der Vorschau. Kein <input>, sondern ein
// contentEditable-Span — so bleiben Schriftart, Farbe und Layout des
// gerenderten Textes 1:1 erhalten. Speichern beim Verlassen oder Enter.
function InlineEditable({
  value, onChange, style, multiline, placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  style?: React.CSSProperties;
  multiline?: boolean;
  // Wird angezeigt, wenn der Wert leer ist — damit das Feld auch sichtbar
  // bleibt und angeklickt werden kann.
  placeholder?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // DOM-Inhalt synchronisieren, aber NICHT während der Nutzer tippt, sonst
  // springt der Cursor an den Anfang. Während Fokus: DOM-Wert ist die
  // Wahrheit; nach Blur dispatchen wir und der State holt auf.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerText !== (value || "")) el.innerText = value || "";
  }, [value]);
  const showPlaceholder = !value;
  return (
    <span style={{ position: "relative", display: "inline-block", minWidth: "1ch" }}
      onClick={e => e.stopPropagation()}>
      {showPlaceholder && placeholder && (
        <span aria-hidden style={{
          position: "absolute", top: 0, left: 2, pointerEvents: "none",
          opacity: 0.35, fontStyle: "italic", whiteSpace: "nowrap",
        }}>{placeholder}</span>
      )}
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      // Kein Drag&Drop in editierbare Texte — sonst landen z. B. die
      // Quiz-Bilder beim Ziehen versehentlich IM Text.
      onDrop={e => e.preventDefault()}
      onMouseDown={e => e.stopPropagation()}
      onKeyDown={e => {
        // Enter beendet die Eingabe (außer mit Shift für Zeilenumbruch im
        // mehrzeiligen Modus).
        if (e.key === "Enter" && !(multiline && e.shiftKey)) {
          e.preventDefault();
          (e.currentTarget as HTMLSpanElement).blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          if (ref.current) ref.current.innerText = value || "";
          (e.currentTarget as HTMLSpanElement).blur();
        }
      }}
      onBlur={e => {
        const next = (e.currentTarget.innerText || "").replace(/ /g, " ").trim();
        if (next !== (value || "").trim()) onChange(next);
      }}
      style={{
        outline: "none",
        cursor: "text",
        borderRadius: 3,
        padding: "0 2px",
        margin: "0 -2px",
        transition: "background-color 120ms ease",
        background: "transparent",
        whiteSpace: multiline ? "pre-wrap" : "normal",
        // Auch leere Felder müssen anklickbar sein.
        display: "inline-block",
        minWidth: "8ch",
        minHeight: "1em",
        ...style,
      }}
      onFocus={e => {
        e.currentTarget.style.background = "rgba(59,130,246,0.10)";
        if (!e.currentTarget.innerText && value) e.currentTarget.innerText = value;
      }}
      suppressHydrationWarning
    />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Frei anpassbare Layout-Elemente (Redaktionell-Layout): jedes Element kann
// per Drag verschoben, über das Eck-Handle skaliert, per ✕ ausgeblendet
// ("gelöscht") und per ↺ zurückgesetzt werden. Verschieben rastet am
// 2,5 %-Gitter ein (passend zum Gitter-Overlay). Während des Ziehens wird
// nur das DOM mutiert; erst beim Loslassen wird EIN Undo-fähiger
// Reducer-Schritt dispatcht. Im PDF-Render (editable=false) werden Versatz,
// Skalierung und Ausblendung 1:1 angewendet, aber keine Editier-UI gezeigt.

const ADJ_GRID = 1 / 40; // Rasterweite: 2,5 % der Anzeigenbreite/-höhe

const ELEMENT_LABELS: Record<string, string> = {
  anzeige: "ANZEIGE-Kennzeichnung", stoerer: "Störer", title: "Titel",
  intro: "Untertitel", howto: "Story-Text", solution: "Auflösung",
  phoneTerms: "Kleingedrucktes", publisherLogo: "Logo",
  img_top: "Bild oben", img_bottom: "Bild unten",
  questionsHeadline: "Fragen-Überschrift", winners: "Gewinner",
  winnersHeadline: "Gewinner-Überschrift",
  terms: "Teilnahmebedingungen",
};
function elementLabel(id: string): string {
  if (ELEMENT_LABELS[id]) return ELEMENT_LABELS[id];
  if (id.startsWith("question_")) return "Frage";
  if (id.startsWith("prize_")) return "Betrag";
  return id;
}

const adjMiniBtn: React.CSSProperties = {
  width: 20, height: 20, borderRadius: 4, background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.15)", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
  fontSize: 12, lineHeight: "16px", cursor: "pointer", padding: 0,
};

function Adjustable({ id, transforms, dispatch, editable, width, height, selectedBlockId, onSelectBlock, block, box, children }: {
  id: string;
  transforms?: Record<string, ElementTransform>;
  dispatch?: React.Dispatch<Action>;
  editable?: boolean;
  width: number; height: number;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  // Styles, die das Element im Flex-Layout des Parents positionieren.
  block?: React.CSSProperties;
  // Box-Modus (Container wie Gewinner-Liste, Bilder): Griffe ändern ECHTE
  // Breite/Höhe — der Inhalt verteilt sich neu, die Schrift bleibt.
  // Text-Modus (Default): vertikal = proportionale Skalierung mit Schrift.
  box?: boolean;
  children: React.ReactNode;
}) {
  const t = transforms?.[id] || { dx: 0, dy: 0, scale: 1 };
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    mode: "move" | "resize" | "resizeW" | "resizeS"; sx: number; sy: number;
    px: number; py: number;
    baseDx: number; baseDy: number; baseScale: number; baseW: number; baseH: number;
    lastDx: number; lastDy: number; lastScale: number; lastW: number; lastH: number; moved: boolean;
  } | null>(null);
  const edit = !!(editable && dispatch);
  const selected = selectedBlockId === id;
  const snap = (v: number) => Math.round(v / ADJ_GRID) * ADJ_GRID;

  // Migration für Alt-Daten: Skalierung gespeichert, aber noch keine
  // sichtbare Breite (aus der Zeit vor der Breitenkompensation). Ohne w
  // würde der skalierte Text rechts aus der Spalte ragen und abgeschnitten.
  // Die natürliche Layout-Breite wird gemessen und einmalig als sichtbare
  // Breite festgeschrieben — danach bricht der Text korrekt um.
  useEffect(() => {
    if (!edit || !dispatch || !ref.current) return;
    if (t.w == null && t.scale !== 1) {
      const wFrac = ref.current.offsetWidth / width;
      if (wFrac > 0.01) {
        dispatch({ type: "UPDATE_TRANSFORM", id, payload: { w: Math.min(1.2, wFrac) } });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.w, t.scale, edit]);

  // WICHTIG: w ist die SICHTBARE Breite (Anteil der Anzeigenbreite). Die
  // Layout-Breite wird durch die Skalierung geteilt — so bleibt die sichtbare
  // Breite beim Vergrößern konstant und der Text bricht neu um, statt rechts
  // aus der Spalte geschnitten zu werden.
  const applyVisual = (dx: number, dy: number, s: number, w: number, h?: number) => {
    if (!ref.current) return;
    ref.current.style.transform = `translate(${dx * width}px, ${dy * height}px) scale(${s})`;
    ref.current.style.width = `${(w * width) / s}px`;
    if (box && h != null) ref.current.style.height = `${h * height}px`;
    ref.current.style.flex = "0 0 auto";
    // Skalierten Platz sofort reservieren (siehe Effekt unten).
    ref.current.style.marginBottom = s !== 1 ? `${ref.current.offsetHeight * (s - 1)}px` : "";
    ref.current.style.marginRight = s !== 1 ? `${ref.current.offsetWidth * (s - 1)}px` : "";
  };

  // transform:scale verändert NICHT den Layout-Fluss — nachfolgende Elemente
  // würden in die vergrößerte Darstellung hineinrutschen. Deshalb wird der
  // zusätzliche Platz über Margins reserviert (bzw. bei Verkleinerung
  // freigegeben).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (t.scale !== 1) {
      el.style.marginBottom = `${el.offsetHeight * (t.scale - 1)}px`;
      el.style.marginRight = `${el.offsetWidth * (t.scale - 1)}px`;
    } else {
      el.style.marginBottom = "";
      el.style.marginRight = "";
    }
  });
  const start = (mode: "move" | "resize" | "resizeW" | "resizeS", sx = 1, sy = 1) => (e: React.PointerEvent) => {
    if (!edit) return;
    // Klick in einen editierbaren Text: Element trotzdem AUSWÄHLEN (damit
    // Skalier-/Lösch-Handles erscheinen), aber keinen Drag starten — der
    // Klick soll den Textcursor setzen. stopPropagation ist hier PFLICHT:
    // bei verschachtelten Elementen (Betrag-Oval in Frage-Zeile) würde sonst
    // das äußere Element die Auswahl sofort wieder überschreiben.
    if (mode === "move" && (e.target as HTMLElement).isContentEditable) {
      e.stopPropagation();
      onSelectBlock(id);
      return;
    }
    e.stopPropagation();
    onSelectBlock(id);
    // Fokus aus Textfeldern/Editor-Inputs lösen, damit die Pfeiltasten
    // (auch mit Shift) sofort den Block steuern statt den Textcursor.
    // ownerDocument: funktioniert auch im Popout-Fenster.
    const ownDoc = (e.currentTarget as HTMLElement).ownerDocument;
    const ae = ownDoc.activeElement as HTMLElement | null;
    if (ae && (ae.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) ae.blur();
    // Aktuelle Breite/Höhe als Ausgangspunkt — entweder gespeichert oder die
    // natürliche Größe im Layout (gemessen).
    const baseW = t.w ?? ((ref.current?.offsetWidth || width * 0.2) / width);
    const baseH = t.h ?? ((ref.current?.offsetHeight || height * 0.2) / height);
    drag.current = {
      mode, sx, sy, px: e.clientX, py: e.clientY,
      baseDx: t.dx, baseDy: t.dy, baseScale: t.scale, baseW, baseH,
      lastDx: t.dx, lastDy: t.dy, lastScale: t.scale, lastW: baseW, lastH: baseH, moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const mx = e.clientX - d.px, my = e.clientY - d.py;
    if (Math.abs(mx) + Math.abs(my) > 3) d.moved = true;
    if (!d.moved) return;
    const clampW = (v: number) => Math.min(1.2, Math.max(0.05, v));
    const clampH = (v: number) => Math.min(1.2, Math.max(0.04, v));
    // Alt-Taste: Raster aus — pixelgenaues, feines Ziehen.
    const sn = (v: number) => (e.altKey ? v : snap(v));
    if (d.mode === "move") {
      d.lastDx = sn(d.baseDx + mx / width);
      d.lastDy = sn(d.baseDy + my / height);
    } else if (box) {
      // BOX-MODUS (Gewinner-Liste, Bilder): Griffe ändern echte Breite/Höhe,
      // der Inhalt verteilt sich neu. Keine Schrift-Skalierung.
      if (d.mode === "resizeW") {
        d.lastW = clampW(sn(d.baseW + (d.sx * mx) / width));
      } else if (d.mode === "resizeS") {
        d.lastH = clampH(sn(d.baseH + (d.sy * my) / height));
      } else {
        d.lastW = clampW(sn(d.baseW + mx / width));
        d.lastH = clampH(sn(d.baseH + my / height));
      }
    } else if (d.mode === "resizeW") {
      // Seiten-Griffe: NUR Breite — Text bricht neu um, Schrift bleibt.
      d.lastW = clampW(sn(d.baseW + (d.sx * mx) / width));
    } else {
      // Eck- und Oben/Unten-Griffe: PROPORTIONAL — die Schriftgröße folgt
      // der Boxgröße (gilt für alle Text-Boxen). Breite und Skalierung
      // wachsen mit demselben Faktor; die Umbruchstellen bleiben stabil.
      const f = d.mode === "resize"
        ? Math.max(0.1, (d.baseW + mx / width) / d.baseW)
        : Math.max(0.1, 1 + (d.sy * my) / 160);
      d.lastScale = Math.min(4, Math.max(0.25, d.baseScale * f));
      d.lastW = clampW(d.baseW * f);
    }
    applyVisual(d.lastDx, d.lastDy, d.lastScale, d.lastW, d.lastH);
  };
  const end = () => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    if (d.moved && dispatch) {
      dispatch({ type: "UPDATE_TRANSFORM", id, payload: {
        dx: d.lastDx, dy: d.lastDy, scale: d.lastScale,
        // Bei JEDEM Resize die sichtbare Breite mitspeichern — sie ist die
        // Basis für die Breitenkompensation der Skalierung (Text bricht um,
        // statt abgeschnitten zu werden). Nur reines Verschieben lässt das
        // Element im natürlichen Flex-Fluss. Box-Modus speichert zusätzlich
        // die echte Höhe.
        ...(d.mode !== "move" || t.w != null ? { w: d.lastW } : {}),
        ...(box && (d.mode !== "move" || t.h != null) ? { h: d.lastH } : {}),
      } });
    }
  };
  // Gemeinsame Optik der Griffe.
  const gripStyle = (extra: React.CSSProperties): React.CSSProperties => ({
    position: "absolute", background: "#3B82F6", zIndex: 10,
    border: "2px solid #FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    touchAction: "none", borderRadius: 3, ...extra,
  });

  // Direkte Schriftgrößen-Einstellung (A− / A+) für Text-Boxen. Nutzt die
  // Skalierung des Transform-Systems; die sichtbare Breite wird mitgesetzt,
  // damit der Text korrekt umbricht statt überzulaufen.
  const setScale = (next: number) => {
    if (!dispatch) return;
    const s = Math.min(4, Math.max(0.25, Math.round(next * 100) / 100));
    const wVal = t.w ?? ((ref.current?.offsetWidth || width * 0.2) / width);
    dispatch({ type: "UPDATE_TRANSFORM", id, payload: { scale: s, w: wVal } });
  };

  // Feinpositionierung per Pfeiltasten, wenn das Element ausgewählt ist:
  // Pfeil = 0,25 % (fein), Shift+Pfeil = ein Rasterschritt (2,5 %).
  // Eingaben in editierbare Texte/Felder bleiben unberührt.
  useEffect(() => {
    if (!edit || !selected || !dispatch) return;
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName))) return;
      const step = e.shiftKey ? ADJ_GRID : 0.0025;
      let ddx = 0, ddy = 0;
      if (e.key === "ArrowLeft") ddx = -step;
      else if (e.key === "ArrowRight") ddx = step;
      else if (e.key === "ArrowUp") ddy = -step;
      else if (e.key === "ArrowDown") ddy = step;
      else return;
      e.preventDefault();
      dispatch({ type: "UPDATE_TRANSFORM", id, payload: { dx: t.dx + ddx, dy: t.dy + ddy } });
    };
    // WICHTIG: am Dokument des Elements anmelden — die Vorschau kann in
    // einem eigenen Browser-Fenster (Popout) leben; window wäre dort das
    // falsche Fenster und Tastendrücke kämen nie an.
    const doc = ref.current?.ownerDocument ?? document;
    doc.addEventListener("keydown", onKey);
    return () => doc.removeEventListener("keydown", onKey);
  }, [edit, selected, dispatch, id, t.dx, t.dy]);

  // Ausgeblendet = "gelöscht": weder in Vorschau noch im PDF gerendert.
  // Wiederherstellen über die Chips unten links im Editor.
  if (t.hidden) return null;

  const hasTransform = t.dx !== 0 || t.dy !== 0 || t.scale !== 1 || t.w != null;
  return (
    <div ref={ref}
      onPointerDown={edit ? start("move") : undefined}
      onPointerMove={edit ? move : undefined}
      onPointerUp={edit ? end : undefined}
      onClick={edit ? (e => e.stopPropagation()) : undefined}
      style={{
        ...block,
        // block darf die Positionierung vorgeben (z. B. absolute für
        // freigestellte Elemente wie die Betrag-Ovale); Default relative.
        position: block?.position ?? "relative",
        transform: `translate(${t.dx * width}px, ${t.dy * height}px) scale(${t.scale})`,
        transformOrigin: "top left",
        // Gespeicherte SICHTBARE Breite, kompensiert um die Skalierung:
        // Layout-Breite = sichtbare Breite / scale. So bleibt die sichtbare
        // Breite konstant und der Text bricht beim Vergrößern neu um.
        ...(t.w != null ? { width: (t.w * width) / t.scale, flex: "0 0 auto", boxSizing: "border-box" as const } : {}),
        // Box-Modus: echte Höhe (Inhalt verteilt sich neu, z. B. Gewinner-Boxen).
        ...(box && t.h != null ? { height: t.h * height, flex: "0 0 auto" } : {}),
        // Vom Nutzer angepasste Elemente liegen ÜBER den unveränderten —
        // sonst verschwindet z. B. ein vergrößerter Text unter dem Bild
        // der nächsten Spalte.
        ...(hasTransform && !selected ? { zIndex: 3 } : {}),
        ...(edit ? { cursor: "move", touchAction: "none" } : {}),
        ...(selected ? { outline: "2px solid #3B82F6", outlineOffset: 2, zIndex: 5 } : {}),
      }}>
      {children}
      {edit && selected && (
        <>
          {/* Bedienleiste UNTERHALB des Elements — sie darf den Text nicht
              verdecken, sonst sieht man beim Tippen nichts. */}
          <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4,
            display: "flex", gap: 4, zIndex: 10, alignItems: "center",
            // Bei schmalen Elementen umbrechen, damit alle Knöpfe erreichbar bleiben.
            flexWrap: "wrap", justifyContent: "flex-end", minWidth: 150, rowGap: 2 }}
            onPointerDown={e => e.stopPropagation()}>
            <span title="Verschieben: hier ziehen (funktioniert auch bei Textblöcken)"
              onPointerDown={start("move")}
              onPointerMove={move}
              onPointerUp={end}
              style={{ ...adjMiniBtn, cursor: "move", display: "inline-flex",
                alignItems: "center", justifyContent: "center", touchAction: "none" }}>✥</span>
            {!box && (
              <>
                <button title="Schrift kleiner — 5 %-Schritte, mit Shift 1 %"
                  onClick={e => { e.stopPropagation(); setScale(t.scale - (e.shiftKey ? 0.01 : 0.05)); }}
                  style={{ ...adjMiniBtn, fontSize: 10, fontWeight: 700 }}>A−</button>
                <span title="Aktuelle Schriftgröße (100 % = Original)"
                  style={{ fontSize: 9, fontWeight: 700, color: "#1D4ED8",
                    background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.15)",
                    borderRadius: 4, padding: "3px 4px", lineHeight: 1,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
                  {Math.round(t.scale * 100)}%
                </span>
                <button title="Schrift größer — 5 %-Schritte, mit Shift 1 %"
                  onClick={e => { e.stopPropagation(); setScale(t.scale + (e.shiftKey ? 0.01 : 0.05)); }}
                  style={{ ...adjMiniBtn, fontSize: 10, fontWeight: 700 }}>A+</button>
              </>
            )}
            {hasTransform && (
              <button title="Position und Größe zurücksetzen"
                onClick={e => { e.stopPropagation(); dispatch!({ type: "RESET_TRANSFORM", id }); }}
                style={adjMiniBtn}>↺</button>
            )}
            <button title={`${elementLabel(id)} ausblenden (löschen)`}
              onClick={e => { e.stopPropagation(); dispatch!({ type: "UPDATE_TRANSFORM", id, payload: { hidden: true } }); onSelectBlock(null); }}
              style={{ ...adjMiniBtn, color: "#E11D48", fontWeight: 700 }}>✕</button>
          </div>
          {/* Kanten-Griffe: oben/unten = Größe (Schrift), links/rechts = Breite
              (Textumbruch). Eck-Griff unten rechts = beides zugleich. */}
          <div title="Box + Schrift proportional skalieren"
            onPointerDown={start("resizeS", 1, -1)} onPointerMove={move} onPointerUp={end}
            style={gripStyle({ top: -4, left: "50%", marginLeft: -12, width: 24, height: 8, cursor: "ns-resize" })} />
          <div title="Box + Schrift proportional skalieren"
            onPointerDown={start("resizeS", 1, 1)} onPointerMove={move} onPointerUp={end}
            style={gripStyle({ bottom: -4, left: "50%", marginLeft: -12, width: 24, height: 8, cursor: "ns-resize" })} />
          <div title="Nur Breite ändern (Text bricht neu um, Schrift bleibt)"
            onPointerDown={start("resizeW", -1, 1)} onPointerMove={move} onPointerUp={end}
            style={gripStyle({ left: -4, top: "50%", marginTop: -12, width: 8, height: 24, cursor: "ew-resize" })} />
          <div title="Nur Breite ändern (Text bricht neu um, Schrift bleibt)"
            onPointerDown={start("resizeW", 1, 1)} onPointerMove={move} onPointerUp={end}
            style={gripStyle({ right: -4, top: "50%", marginTop: -12, width: 8, height: 24, cursor: "ew-resize" })} />
          <div title="Box + Schrift proportional skalieren (diagonal ziehen)"
            onPointerDown={start("resize", 1, 1)} onPointerMove={move} onPointerUp={end}
            style={gripStyle({ right: 0, bottom: 0, width: 14, height: 14, cursor: "nwse-resize" })} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Neues Beilage-Layout: weißer Hintergrund, Titel + Gewinner-Box oben, zwei
// (Aquarell-)Bilder links (Frage 4 oben, Frage 5 unten), Fragentabelle rechts,
// Teilnahmebedingungen unten. Erste Version — Feinjustierung erfolgt live.
function BeilageRenderer({ quiz, width, height, selectedBlockId, onSelectBlock, editable, dispatch }: RendererProps) {
  const { theme, meta, questions, prizes } = quiz;
  // Edit-Helfer: nur aktiv, wenn beide Props gesetzt sind. Sonst wird das Feld
  // wie bisher als normaler Text gerendert (z. B. im versteckten PDF-Render).
  const edit = !!(editable && dispatch);
  const updateQ = (id: string, payload: Partial<Question>) => {
    if (dispatch) dispatch({ type: "UPDATE_QUESTION", id, payload });
  };
  const ws = width / 900;
  const px = (v: number) => `${v * ws}px`;
  const pad = width * 0.028;
  // Farbe sicherstellen: auf weißem Grund braucht der Text einen Minimum-
  // Kontrast. Wir lassen aber alle Verlagsfarben durch, die nicht in der
  // Nähe von Weiß liegen (Luminanz < 0,85) — auch Orange/Gelb der Vorlagen
  // bleibt damit erhalten. Nur Weiß und nahezu-Weiß wird durch eine dunkle
  // Fallback-Farbe ersetzt, damit der Text überhaupt lesbar bleibt.
  const onWhite = (hex: string | undefined, fb: string) => {
    if (!hex) return fb;
    return luminance(hex) < 0.85 ? hex : fb;
  };
  const cTitle = onWhite(theme.colors.title, "#8A1A2B");
  const cIntro = onWhite(theme.colors.intro, "#1A1A1A");
  const cPrize = onWhite(theme.colors.prize, "#8A1A2B");
  const cQuestion = onWhite(theme.colors.question, "#1A1A1A");
  const cPhone = onWhite(theme.colors.phone, "#8A1A2B");
  const cTerms = onWhite(theme.colors.terms, "#555555");

  const sel = (id: string): React.CSSProperties =>
    selectedBlockId === id ? { outline: "3px solid #3B82F6", outlineOffset: 3 } : {};
  const click = (id: string) => (e: React.MouseEvent) => { e.stopPropagation(); onSelectBlock(id); };

  const winners = (meta.winners ?? []).slice(0, Math.max(0, Math.min(5, meta.winnerCount ?? 0)))
    .filter(w => (w.text && w.text.trim()) || w.photo);

  // Fragen in Anzeige-Reihenfolge: höchster Preis zuletzt (wie Screenshot: 50€ → 1000€).
  const ordered = [...questions];

  const imgTop = theme.background?.image || null;
  const imgBottom = theme.background?.imageBottom || null;

  // Dynamische Logo-Größe: alle Logos sollen die gleiche Fläche belegen,
  // unabhängig vom Seitenverhältnis. Wir messen das Bild beim Laden, leiten
  // aus seinem Seitenverhältnis Breite und Höhe so ab, dass w·h ≈ Zielfläche.
  const [logoDim, setLogoDim] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => { setLogoDim(null); }, [theme.publisherLogo]);
  const bigLogo = !!theme.bigFooterLogo;
  // Logo-Größe wie Beilage (Standard): proportional zur jeweiligen Anzeige —
  // 4,5 % Fläche, max 32 % Breite, max 10 % Höhe. Damit ist das Logo in
  // kleineren Anzeigen automatisch kleiner.
  const targetLogoArea = width * height * 0.045;
  const onLogoLoad: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const aspect = img.naturalWidth / img.naturalHeight;
    const h = Math.sqrt(targetLogoArea / aspect);
    const w = aspect * h;
    const maxW = width * 0.32;
    const maxH = height * 0.10;
    const scale = Math.min(1, maxW / w, maxH / h);
    setLogoDim({ w: Math.round(w * scale), h: Math.round(h * scale) });
  };

  const imgSlot = (src: string | null, label: string, id: string) => (
    <div onClick={click(id)} style={{
      ...sel(id), flex: 1, width: "100%", borderRadius: px(6), overflow: "hidden",
      background: src ? "transparent" : "#EFE9E2",
      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
    }}>
      {src
        ? <img src={src} alt={label}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : <span style={{ color: "#A89F93", fontSize: px(11), fontWeight: 600 }}>{label}</span>}
    </div>
  );

  return (
    <div onClick={() => onSelectBlock(null)}
      style={{ width, height, position: "relative", background: "#FFFFFF", color: "#1A1A1A",
        fontFamily: theme.fontFamily, overflow: "hidden", boxSizing: "border-box",
        padding: pad, display: "flex", flexDirection: "column", gap: px(9),
        // Dynamic spacing: gleichmäßige Verteilung von Header → Mitte →
        // Footer, sodass kein zusammenhängender Leerraum zwischen Inhalt
        // und AGB entsteht.
        justifyContent: "space-between" as const }}>

      {/* KOPFBEREICH: links Titel/Intro/So geht's + Gewinner-Grid, rechts Störer */}
      {(() => {
        // Höchsten Preis als „Störer"-Betrag heranziehen (Schweizer Tausender mit ').
        const maxCents = Math.max(0, ...prizes.map(p => p.valueCents ?? 0));
        const fmtNum = Math.round(maxCents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
        // Override-Reihenfolge: meta.stoererText (global) → Default (Betrag).
        const stoererLabel = (meta.stoererText && meta.stoererText.trim()) || `${fmtNum}€`;
        // Störer-Größe relativ zur Karte, etwas links neben Bildkante.
        // Faktor 0.8 = 20 % kleiner als ursprünglich.
        const stoererSize = Math.min(width * 0.20, height * 0.32) * 0.8;
        const spikes = 16;
        const cx = stoererSize / 2, cy = stoererSize / 2;
        const outerR = stoererSize / 2;
        const innerR = stoererSize * 0.42;
        const pts: string[] = [];
        for (let i = 0; i < spikes * 2; i++) {
          const a = (i * Math.PI) / spikes;
          const r = i % 2 === 0 ? outerR : innerR;
          pts.push(`${cx + r * Math.sin(a)},${cy - r * Math.cos(a)}`);
        }
        return (
          <div style={{ display: "flex", gap: px(16), alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
              <div onClick={click("title")} style={{ ...sel("title"), color: cTitle, fontWeight: "bold",
                fontSize: px(24), lineHeight: 1.05 }}>
                {effectiveTitle(quiz) || "Titel der Aktion"}
              </div>
              {meta.subtitle && (
                <div onClick={click("intro")} style={{ ...sel("intro"), color: cIntro, fontSize: px(11),
                  marginTop: px(6), lineHeight: 1.3 }}>
                  {meta.subtitle}
                </div>
              )}
              {meta.howToText && (
                <div style={{ color: cIntro, fontSize: px(8.5), marginTop: px(6), lineHeight: 1.35 }}>
                  {meta.howToText}
                </div>
              )}

              {/* Überschrift über dem Gewinner-Raster — komplett fett. */}
              {winners.length > 0 && (
                <div style={{ marginTop: px(10), fontWeight: 700,
                  color: cTitle, fontSize: px(11), lineHeight: 1.2 }}>
                  Unsere neuen Gewinner
                </div>
              )}
              {/* Gewinner-Raster: 3 Spalten in Zeile 1, 2 Spalten in Zeile 2
                  (CSS Grid füllt Zellen links-nach-rechts). Das spart eine
                  Zeile vertikalen Platz, der dem Body (Bilder + Fragen)
                  zugutekommt. */}
              {winners.length > 0 && (
                <div onClick={click("winners")} style={{ ...sel("winners"), marginTop: px(4),
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                  columnGap: px(10), rowGap: px(6) }}>
                  {winners.map(w => (
                    <div key={w.id} style={{ display: "flex", gap: px(6),
                      alignItems: "center", minWidth: 0 }}>
                      <div style={{ flex: "0 0 auto", width: px(30), height: px(30),
                        borderRadius: "50%", overflow: "hidden", background: "#DDD4C7",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {w.photo
                          ? <img src={w.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ color: "#A89F93", fontSize: px(8) }}>Foto</span>}
                      </div>
                      <div style={{ color: "#333", fontSize: px(9), lineHeight: 1.2,
                        minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{w.text}</div>
                    </div>
                  ))}
                </div>
              )}

              {meta.solutionWords && (
                <div style={{ marginTop: px(10), display: "flex", gap: px(8),
                  alignItems: "baseline", flexWrap: "wrap" }}>
                  <div style={{ color: cTitle, fontSize: px(8), fontWeight: 700,
                    letterSpacing: 0.5, textTransform: "uppercase" }}>Lösungsworte vom Vortag:</div>
                  <div style={{ color: "#333", fontSize: px(9.5), fontStyle: "italic" }}>{meta.solutionWords}</div>
                </div>
              )}
            </div>

            {/* STÖRER — runder, gezackter Störer in der Anzeigen-Akzentfarbe */}
            <div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end",
              alignItems: "flex-start" }}>
              <svg width={stoererSize} height={stoererSize} viewBox={`0 0 ${stoererSize} ${stoererSize}`}
                style={{ transform: "rotate(-8deg)" }}>
                <polygon points={pts.join(" ")} fill={cPrize} />
                {/* Drei Zeilen: HEUTE (oben), Betrag (Mitte, groß), gewinnen (unten) */}
                <text x={cx} y={cy - stoererSize * 0.20} textAnchor="middle" fill="#FFFFFF"
                  fontWeight={700} fontSize={stoererSize * 0.12}
                  fontFamily={theme.fontFamily} dominantBaseline="middle"
                  style={{ letterSpacing: 1, textTransform: "uppercase" }}>
                  Heute
                </text>
                <text x={cx} y={cy + stoererSize * 0.02} textAnchor="middle" fill="#FFFFFF"
                  fontWeight="bold" fontSize={stoererSize * 0.20}
                  fontFamily={theme.fontFamily} dominantBaseline="middle">
                  {stoererLabel}
                </text>
                <text x={cx} y={cy + stoererSize * 0.22} textAnchor="middle" fill="#FFFFFF"
                  fontWeight={700} fontSize={stoererSize * 0.12}
                  fontFamily={theme.fontFamily} dominantBaseline="middle"
                  style={{ letterSpacing: 1, textTransform: "uppercase" }}>
                  gewinnen
                </text>
              </svg>
            </div>
          </div>
        );
      })()}

      {/* HAUPTBEREICH: links zwei Bilder mit fester Spaltenbreite, rechts
          Fragentabelle. */}
      <div style={{ flex: 1, display: "flex", gap: px(18), minHeight: 0 }}>
        <div style={{ flex: "0 0 42%", display: "flex", flexDirection: "column",
          gap: px(10), minHeight: 0 }}>
          {imgSlot(imgTop, "Bild zu Frage 4", "img_top")}
          {imgSlot(imgBottom, "Bild zu Frage 5", "img_bottom")}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ color: cTitle, fontSize: px(10.5), fontWeight: 700, letterSpacing: 0.5,
            textTransform: "uppercase", marginBottom: px(6) }}>
            Fünf Fragen · Fünf Gewinnstufen
          </div>
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "auto 1fr auto",
            columnGap: px(14), alignItems: "center", rowGap: px(3) }}>
            {ordered.map((q) => {
              const prize = prizes.find(p => p.id === q.prizeTierId) || prizes[0];
              // Im Edit-Modus immer rendern, damit der Nutzer leere Slots
              // ausfüllen kann. Im Export-Modus leere Zeilen weglassen.
              if (!edit && !(q.text || q.phoneNumber)) return null;
              return (
                <Fragment key={q.id}>
                  <div onClick={click(`prize_${q.id}`)} style={{ ...sel(`prize_${q.id}`), color: cPrize,
                    fontSize: px(15), fontWeight: "bold", whiteSpace: "nowrap" }}>
                    {prize ? getPrizeLabel(prize) : ""}
                  </div>
                  <div onClick={click(`question_${q.id}`)} style={{ ...sel(`question_${q.id}`),
                    color: cQuestion, fontSize: px(12), fontWeight: 600, paddingLeft: px(6),
                    fontFamily: theme.fontFamily }}>
                    {edit
                      ? <InlineEditable value={q.text || ""}
                          onChange={next => updateQ(q.id, { text: next })}
                          placeholder="Fragetext eingeben…"
                          style={{ minWidth: "20ch" }}
                          multiline />
                      : q.text}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {(edit || q.phoneNumber) && (
                      <div onClick={click(`phone_${q.id}`)} style={{ ...sel(`phone_${q.id}`), color: cPhone,
                        fontSize: px(10.5), fontWeight: "bold", whiteSpace: "nowrap" }}>
                        {edit
                          ? <InlineEditable value={q.phoneNumber || ""}
                              onChange={next => updateQ(q.id, { phoneNumber: next })}
                              placeholder="Telefon…"
                              style={{ minWidth: "10ch" }} />
                          : q.phoneNumber}
                      </div>
                    )}
                    {meta.phoneTermsText && (
                      <div style={{ color: cTerms, fontSize: px(7), lineHeight: 1.15, maxWidth: px(200),
                        marginLeft: "auto" }}>{meta.phoneTermsText}</div>
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* FUSSBEREICH: einheitliches Float-Layout für alle Verlage.
          Logo float-right, Text fließt drumherum. */}
      <div onClick={click("terms")} style={{ ...sel("terms"),
        borderTop: "1px solid #E5E0D8", paddingTop: px(6),
        color: cTerms, fontSize: px(7.5), lineHeight: 1.3,
        textAlign: "justify",
        hyphens: "auto" as const, WebkitHyphens: "auto" as const,
        display: "flow-root" as const }} lang="de">
        {theme.publisherLogo
          ? <img key={theme.publisherLogo}
              onLoad={onLogoLoad}
              onClick={e => { e.stopPropagation(); onSelectBlock("publisherLogo"); }}
              src={theme.publisherLogo} alt=""
              style={{
                float: "right",
                marginLeft: px(14), marginBottom: px(6),
                width: logoDim ? `${logoDim.w}px` : `${Math.round(Math.sqrt(targetLogoArea))}px`,
                height: logoDim ? `${logoDim.h}px` : `${Math.round(Math.sqrt(targetLogoArea))}px`,
                objectFit: "contain",
                cursor: "pointer",
              }} />
          : <span onClick={e => { e.stopPropagation(); onSelectBlock("publisherLogo"); }}
              style={{
                float: "right",
                marginLeft: px(14), marginBottom: px(6),
                width: Math.round(Math.sqrt(targetLogoArea)),
                height: Math.round(Math.sqrt(targetLogoArea)),
                border: `1px dashed ${cPrize}`, borderRadius: px(4),
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: cPrize, fontSize: px(11), fontWeight: 700, textAlign: "center",
                padding: px(4), cursor: "pointer", letterSpacing: 0.5,
                textTransform: "uppercase",
              }}>Logo fehlt</span>}
        {meta.termsText}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QUERFORMAT-STORY-LAYOUT — zweite Anzeigen-Variante.
// Linke Spalte: Titel-Streifen oben (Akzentfarbe), großer Titel, Story-Text,
// Gewinnerliste. Rechte Spalte: Bildcollage (oben Frage 4, unten Frage 5),
// runder Störer, Fragentabelle. Footer: Teilnahmebedingungen + Logo unten.

// Default-Texte für das Querformat-Layout, wenn der Editor noch nichts
// gesetzt hat. Wortlaut aus der Rhein-Zeitung-Vorlage.
const QF_DEFAULT_SUBTITLE = "Sichern Sie sich vom 1. bis 31. Juli jeden Tag Ihre Gewinnchancen.";
const QF_DEFAULT_HOWTO =
  "Beantworten Sie heute eine oder alle fünf Fragen zur rechten Abbildung " +
  "und sichern Sie sich die Chance auf die jeweils angegebenen Geldpreise. " +
  "Alle Preise werden morgen unter allen richtigen Antworten verlost. Die " +
  "Gewinnerinnen und Gewinner werden telefonisch benachrichtigt. Rufen Sie " +
  "uns an und teilen Sie Ihre Antwort mit. Mehrfachanrufe erhöhen Ihre " +
  "Gewinnchancen.\n\nTeilnahmeschluss ist jeweils um Mitternacht.\n\n" +
  "Wir wünschen Ihnen viel Glück!";

function QuerformatRenderer({ quiz, width, height, selectedBlockId, onSelectBlock }: RendererProps) {
  const { theme, meta, questions, prizes } = quiz;
  const ws = width / 1000;
  const px = (v: number) => `${v * ws}px`;
  const pad = width * 0.020;

  const onWhite = (hex: string | undefined, fb: string) => (hex && luminance(hex) < 0.85 ? hex : fb);
  const cTitle = onWhite(theme.colors.title, "#8A1A2B");
  const cIntro = onWhite(theme.colors.intro, "#1A1A1A");
  const cPrize = onWhite(theme.colors.prize, "#8A1A2B");
  const cQuestion = onWhite(theme.colors.question, "#1A1A1A");
  const cPhone = onWhite(theme.colors.phone, "#8A1A2B");
  const cTerms = onWhite(theme.colors.terms, "#555555");

  const sel = (id: string): React.CSSProperties =>
    selectedBlockId === id ? { outline: "3px solid #3B82F6", outlineOffset: 3 } : {};
  const click = (id: string) => (e: React.MouseEvent) => { e.stopPropagation(); onSelectBlock(id); };

  const winners = (meta.winners ?? []).slice(0, Math.max(0, Math.min(5, meta.winnerCount ?? 0)))
    .filter(w => (w.text && w.text.trim()) || w.photo);

  const imgTop = theme.background?.image || null;
  const imgBottom = theme.background?.imageBottom || null;

  // Logo-Größen-Logik wie Beilage (Standard): proportional 4,5 % Fläche,
  // max 32×10 % der Anzeige.
  const [logoDim, setLogoDim] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => { setLogoDim(null); }, [theme.publisherLogo]);
  const targetLogoArea = width * height * 0.045;
  const onLogoLoad: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const aspect = img.naturalWidth / img.naturalHeight;
    const h = Math.sqrt(targetLogoArea / aspect);
    const w = aspect * h;
    const maxW = width * 0.32;
    const maxH = height * 0.10;
    const scale = Math.min(1, maxW / w, maxH / h);
    setLogoDim({ w: Math.round(w * scale), h: Math.round(h * scale) });
  };

  return (
    <div onClick={() => onSelectBlock(null)}
      style={{ width, height, position: "relative", background: "#FFFFFF", color: "#1A1A1A",
        fontFamily: theme.fontFamily, overflow: "hidden", boxSizing: "border-box",
        display: "flex", flexDirection: "column" }}>

      {/* HAUPTBEREICH: zwei Spalten */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* LINKE SPALTE: Titel, Story, Gewinner */}
        <div style={{ flex: "0 0 44%", display: "flex", flexDirection: "column",
          padding: pad, gap: px(10), minHeight: 0 }}>
          {/* Heller Akzentstreifen oben (in Verlags-Akzentfarbe abgeschwächt) */}
          <div style={{ height: px(8), background: cTitle, opacity: 0.18, borderRadius: px(4) }} />

          <div onClick={click("title")} style={{ ...sel("title"), color: cTitle, fontWeight: 700,
            fontSize: px(30), lineHeight: 1.05 }}>
            {effectiveTitle(quiz) || "Titel der Aktion"}
          </div>
          {/* Verlagsname direkt unter dem Titel — kommt aus theme.publisherName,
              das beim Anwenden eines Presets gesetzt wird. */}
          {theme.publisherName && (
            <div style={{ color: cTitle, fontWeight: 600, fontSize: px(13),
              lineHeight: 1.2, opacity: 0.85 }}>
              veranstaltet von der {theme.publisherName}
            </div>
          )}

          {/* Untertitel: Editor-Wert oder Default-Text aus der Vorlage */}
          <div onClick={click("intro")} style={{ ...sel("intro"), color: cIntro,
            fontSize: px(14), lineHeight: 1.3, fontWeight: 600 }}>
            {meta.subtitle || QF_DEFAULT_SUBTITLE}
          </div>

          {/* Story-Text aus 'So geht's': Editor-Wert oder Default-Text */}
          <div style={{ color: cIntro, fontSize: px(11), lineHeight: 1.4,
            marginTop: px(2), whiteSpace: "pre-line" }}>
            {meta.howToText || QF_DEFAULT_HOWTO}
          </div>

          <div style={{ height: px(2), background: cTitle, opacity: 0.18, marginTop: px(6) }} />

          {/* Gewinner-Box */}
          {winners.length > 0 && (
            <div onClick={click("winners")} style={{ ...sel("winners") }}>
              <div style={{ color: cTitle, fontSize: px(10), fontWeight: 700, marginBottom: px(6),
                letterSpacing: 0.5, textTransform: "uppercase" }}>
                Unsere neuen Gewinner
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
                columnGap: px(8), rowGap: px(4) }}>
                {winners.map((w, i) => {
                  // Gewinner i bekommt Preisstufe i (bei 5 Gewinnern: 50€-1000€).
                  const prize = prizes[i];
                  return (
                    <div key={w.id} style={{ display: "flex", flexDirection: "column",
                      alignItems: "center", textAlign: "center", minWidth: 0 }}>
                      <div style={{ width: px(40), height: px(40), borderRadius: "50%",
                        overflow: "hidden", background: "#DDD4C7", marginBottom: px(4),
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {w.photo
                          ? <img src={w.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ color: "#A89F93", fontSize: px(8) }}>Foto</span>}
                      </div>
                      <div style={{ color: cPrize, fontWeight: 700, fontSize: px(9.5) }}>
                        {prize ? getPrizeLabel(prize) : ""}
                      </div>
                      <div style={{ color: "#333", fontSize: px(8.5), lineHeight: 1.1,
                        minWidth: 0, overflow: "hidden" }}>{w.text}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RECHTE SPALTE: Bildcollage + Störer, dann Fragen */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column",
          padding: pad, gap: px(10), minHeight: 0 }}>
          {/* Bildcollage-Container mit überlagertem Störer */}
          <div style={{ flex: "0 0 45%", position: "relative", borderRadius: px(6),
            overflow: "hidden", background: "#EFE9E2" }}>
            <div style={{ width: "100%", height: "100%", display: "flex",
              flexDirection: "column" }}>
              <div onClick={click("img_top")} style={{ ...sel("img_top"), flex: 1, overflow: "hidden" }}>
                {imgTop
                  ? <img src={imgTop} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                      width: "100%", height: "100%", color: "#A89F93", fontSize: px(11) }}>Bild zu Frage 4</div>}
              </div>
              <div onClick={click("img_bottom")} style={{ ...sel("img_bottom"), flex: 1, overflow: "hidden" }}>
                {imgBottom
                  ? <img src={imgBottom} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                      width: "100%", height: "100%", color: "#A89F93", fontSize: px(11) }}>Bild zu Frage 5</div>}
              </div>
            </div>
            {/* Runder Störer als Overlay links auf der Bildcollage */}
            {(() => {
              const sSize = Math.min(width * 0.13, height * 0.30);
              return (
                <div style={{ position: "absolute", left: px(10), top: "50%",
                  transform: "translateY(-50%)", width: sSize, height: sSize,
                  borderRadius: "50%", background: cPrize, color: "#FFFFFF",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", textAlign: "center",
                  padding: px(8), boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}>
                  <div style={{ fontSize: sSize * 0.13, fontWeight: 700, letterSpacing: 0.5 }}>Täglich</div>
                  <div style={{ fontSize: sSize * 0.22, fontWeight: 700, lineHeight: 1.0 }}>{prizes.length}</div>
                  <div style={{ fontSize: sSize * 0.10, fontWeight: 600, lineHeight: 1.1 }}>Geldpreise<br/>gewinnen!</div>
                </div>
              );
            })()}
          </div>

          {/* Fragen-Headline + Tabelle */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div onClick={click("questionsHeadline")} style={{ ...sel("questionsHeadline"),
              color: cTitle, fontSize: px(12), fontWeight: 700,
              letterSpacing: 0.5, marginBottom: px(6) }}>
              {meta.questionsHeadline || "Heute haben wir fünf Fragen rund um diese Bilder?"}
            </div>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "auto 1fr auto",
              columnGap: px(12), alignItems: "center", rowGap: px(4) }}>
              {questions.map(q => {
                const prize = prizes.find(p => p.id === q.prizeTierId) || prizes[0];
                if (!(q.text || q.phoneNumber)) return null;
                return (
                  <Fragment key={q.id}>
                    <div onClick={click(`prize_${q.id}`)} style={{ ...sel(`prize_${q.id}`), color: cPrize,
                      fontSize: px(13), fontWeight: 700, whiteSpace: "nowrap" }}>
                      {prize ? getPrizeLabel(prize) : ""}
                    </div>
                    <div onClick={click(`question_${q.id}`)} style={{ ...sel(`question_${q.id}`),
                      color: cQuestion, fontSize: px(11), fontWeight: 600, paddingLeft: px(4),
                      fontFamily: theme.fontFamily }}>
                      {q.text}
                    </div>
                    <div onClick={click(`phone_${q.id}`)} style={{ ...sel(`phone_${q.id}`), color: cPhone,
                      fontSize: px(10), fontWeight: 700, whiteSpace: "nowrap" }}>
                      {q.phoneNumber}
                    </div>
                  </Fragment>
                );
              })}
            </div>
            {meta.phoneTermsText && (
              <div style={{ color: cTerms, fontSize: px(7), lineHeight: 1.2,
                marginTop: px(4), textAlign: "right" }}>
                {meta.phoneTermsText}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FUSSBEREICH: Teilnahmebedingungen links, Logo rechts */}
      <div style={{ borderTop: "1px solid #E5E0D8", padding: pad,
        display: "flex", gap: px(14), alignItems: "flex-end" }}>
        <div onClick={click("terms")} style={{ ...sel("terms"), flex: 1, color: cTerms,
          fontSize: px(7), lineHeight: 1.3, textAlign: "justify",
          hyphens: "auto" as const, WebkitHyphens: "auto" as const }} lang="de">
          {meta.termsText}
        </div>
        <div style={{ flex: "0 0 auto" }}>
          {theme.publisherLogo
            ? <img key={theme.publisherLogo} onLoad={onLogoLoad}
                onClick={e => { e.stopPropagation(); onSelectBlock("publisherLogo"); }}
                src={theme.publisherLogo} alt=""
                style={{
                  width: logoDim ? `${logoDim.w}px` : `${Math.round(Math.sqrt(targetLogoArea))}px`,
                  height: logoDim ? `${logoDim.h}px` : `${Math.round(Math.sqrt(targetLogoArea))}px`,
                  objectFit: "contain", cursor: "pointer", display: "block",
                }} />
            : <span onClick={e => { e.stopPropagation(); onSelectBlock("publisherLogo"); }}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: Math.round(Math.sqrt(targetLogoArea)),
                  height: Math.round(Math.sqrt(targetLogoArea)),
                  border: `1px dashed ${cPrize}`, borderRadius: px(4),
                  color: cPrize, fontSize: px(12), fontWeight: 700,
                  textAlign: "center", padding: px(6), cursor: "pointer",
                  letterSpacing: 0.5, textTransform: "uppercase",
                }}>Logo fehlt</span>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Redaktionell"-Layout nach der Augsburger Vorlage (Bildschirmfoto in
// ~/Downloads/Verlage/AUGSBURGER): ANZEIGE-Kennzeichnung oben, Störer-Badge
// links neben zentrierter Headline + Untertitel; darunter vier Spalten:
// redaktionelle Textspalte (Story, Auflösung der letzten Folge, Kleingedrucktes,
// Logo), zwei gestapelte Bilder, Fragenspalte mit Preis-Badges, Gewinner-
// Spalte mit Foto-Boxen und großen Beträgen. Lange Teilnahmebedingungen
// laufen als schmale Fußzeile über die volle Breite.
function RedaktionellRenderer({ quiz, width, height, selectedBlockId, onSelectBlock, editable, dispatch }: RendererProps) {
  const { theme, meta, questions, prizes } = quiz;
  const ws = width / 1000;
  const px = (v: number) => `${v * ws}px`;
  const pad = width * 0.018;
  const edit = !!(editable && dispatch);

  const onWhite = (hex: string | undefined, fb: string) => (hex && luminance(hex) < 0.85 ? hex : fb);
  const cTitle = onWhite(theme.colors.title, "#1A1A1A");
  const cIntro = onWhite(theme.colors.intro, "#1A1A1A");
  const cPrize = onWhite(theme.colors.prize, "#2B5A8C");
  const cQuestion = onWhite(theme.colors.question, "#1A1A1A");
  const cPhone = onWhite(theme.colors.phone, "#2B5A8C");
  const cTerms = onWhite(theme.colors.terms, "#555555");

  const winners = (meta.winners ?? []).slice(0, Math.max(0, Math.min(5, meta.winnerCount ?? 0)));
  const imgTop = theme.background?.image || null;
  const imgBottom = theme.background?.imageBottom || null;
  const topPrize = prizes.length ? getPrizeLabel(prizes.reduce((a, b) => (b.valueCents > a.valueCents ? b : a))) : "1000€";

  // Auflösungs-Zeilen: solutionWords per Zeile oder Komma getrennt. Eine evtl.
  // enthaltene Überschrift wird gefiltert — die setzt der Renderer selbst.
  const solutionLines = (meta.solutionWords || "")
    .split(/\n|,|;/).map(s => s.trim())
    .filter(s => s && !/^auflösung der letzten (folge|ausgabe)/i.test(s))
    .slice(0, 5);

  // Logo-Größen-Logik wie in den anderen Layouts (4,5 % Fläche, max 32×10 %).
  const [logoDim, setLogoDim] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => { setLogoDim(null); }, [theme.publisherLogo]);
  const targetLogoArea = width * height * 0.045;
  const onLogoLoad: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const aspect = img.naturalWidth / img.naturalHeight;
    const h = Math.sqrt(targetLogoArea / aspect);
    const w = aspect * h;
    const scale = Math.min(1, (width * 0.16) / w, (height * 0.08) / h);
    setLogoDim({ w: Math.round(w * scale), h: Math.round(h * scale) });
  };

  // Runder Störer: eigener Text (meta.stoererText) oder Default
  // "Heute 1000€ gewinnen" mit dem Hauptgewinn des Quiz.
  const badgeLines = (meta.stoererText || `Heute\n${topPrize}\ngewinnen`)
    .split(/\n/).map(s => s.trim()).filter(Boolean);
  const stoererD = Math.min(width * 0.095, height * 0.19);

  // Hilfen: setMeta dispatcht Meta-Patches; wrap macht ein Element frei
  // anpassbar (verschieben, skalieren, ausblenden); ed macht Texte inline
  // editierbar (nur im Editor — PDF rendert statisch).
  const setMeta = (payload: Record<string, unknown>) => { if (dispatch) dispatch({ type: "UPDATE_META", payload }); };
  const wrap = (id: string, node: React.ReactNode, block?: React.CSSProperties, box?: boolean) => (
    <Adjustable id={id} transforms={quiz.layout.transforms} dispatch={dispatch}
      editable={editable} width={width} height={height}
      selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock} block={block} box={box}>
      {node}
    </Adjustable>
  );
  const ed = (value: string, onChange: (v: string) => void, opts?: { multiline?: boolean; placeholder?: string }) =>
    edit
      ? <InlineEditable value={value} onChange={onChange} multiline={opts?.multiline} placeholder={opts?.placeholder} />
      : <>{value}</>;

  // Ausgeblendete ("gelöschte") Elemente — als Chips wieder einblendbar.
  const hiddenIds = Object.entries(quiz.layout.transforms || {})
    .filter(([, v]) => v.hidden).map(([k]) => k);

  return (
    <div onClick={() => onSelectBlock(null)}
      style={{ width, height, position: "relative", background: "#FFFFFF", color: "#1A1A1A",
        fontFamily: theme.fontFamily, overflow: "hidden", boxSizing: "border-box",
        display: "flex", flexDirection: "column", padding: pad }}>

      {/* ANZEIGE-Kennzeichnung oben links + rechts */}
      {wrap("anzeige",
        <><span>ANZEIGE</span><span>ANZEIGE</span></>,
        { display: "flex", justifyContent: "space-between",
          fontSize: px(8), fontWeight: 700, letterSpacing: 2, color: "#1A1A1A" })}

      {/* KOPF: runder Störer links, zentrierte Headline + Untertitel */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: px(14), marginTop: px(4) }}>
        {wrap("stoerer",
          <div style={{ width: stoererD, height: stoererD, borderRadius: "50%",
            background: cPrize, color: "#FFFFFF",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", textAlign: "center",
            padding: stoererD * 0.08,
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}>
            {/* Schrift leicht nach links gedreht (klassischer Störer-Look) */}
            <div style={{ transform: "rotate(-8deg)", display: "flex",
              flexDirection: "column", alignItems: "center" }}>
              {badgeLines.map((l, i) => (
                <span key={i} style={{
                  fontSize: badgeLines.length > 1 && i === 1 ? stoererD * 0.21 : stoererD * 0.135,
                  fontWeight: 700, lineHeight: 1.12, whiteSpace: "nowrap" }}>
                  {edit
                    ? <InlineEditable value={l} onChange={v => {
                        const ls = [...badgeLines]; ls[i] = v;
                        setMeta({ stoererText: ls.filter(Boolean).join("\n") });
                      }} />
                    : l}
                </span>
              ))}
            </div>
          </div>,
          { flex: "0 0 auto", marginTop: px(2) })}
        <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
          {wrap("title",
            <div style={{ color: cTitle, fontWeight: 700, fontSize: px(34), lineHeight: 1.05 }}>
              {edit
                ? <InlineEditable value={effectiveTitle(quiz)} placeholder="Titel der Aktion"
                    onChange={v => setMeta({ title: v, titleAuto: false })} />
                : (effectiveTitle(quiz) || "Titel der Aktion")}
            </div>)}
          {wrap("intro",
            <div style={{ color: cIntro, fontSize: px(13), lineHeight: 1.25, marginTop: px(4) }}>
              {ed(meta.subtitle, v => setMeta({ subtitle: v }), { multiline: true, placeholder: "Untertitel" })}
            </div>)}
        </div>
        {/* Symmetrie-Platzhalter rechts in Störer-Breite, damit der Titel mittig sitzt */}
        <div style={{ flex: "0 0 auto", width: stoererD, visibility: "hidden" }} />
      </div>

      {/* HAUPTBEREICH: vier Spalten */}
      <div style={{ flex: 1, display: "flex", gap: px(12), marginTop: px(10), minHeight: 0 }}>

        {/* SPALTE 1: redaktioneller Text, Auflösung, Kleingedrucktes, Logo.
            Bewusst OHNE overflow:hidden — der Freiform-Editor erlaubt es,
            Elemente über die Spaltengrenze hinaus zu ziehen; Clipping würde
            sie abschneiden. */}
        <div style={{ flex: "0 0 17%", display: "flex", flexDirection: "column",
          minWidth: 0, minHeight: 0 }}>
          {wrap("howto",
            <div style={{ color: cIntro, fontSize: px(9.5),
              lineHeight: 1.45, whiteSpace: "pre-line", textAlign: "justify",
              hyphens: "auto" as const, WebkitHyphens: "auto" as const }} lang="de">
              {ed(meta.howToText || REDAKTIONELL_DEFAULT_HOWTO, v => setMeta({ howToText: v }), { multiline: true, placeholder: "Story-Text" })}
            </div>,
            { flex: "0 1 auto", minHeight: px(24) })}
          {(solutionLines.length > 0 || edit) && wrap("solution",
            <div>
              <div style={{ color: cPrize, fontSize: px(10), fontWeight: 700, marginBottom: px(2) }}>
                Auflösung der letzten Ausgabe:
              </div>
              {edit
                ? <div style={{ color: cPrize, fontSize: px(9.5), fontWeight: 700, lineHeight: 1.4 }}>
                    <InlineEditable multiline placeholder="Lösungswörter (eine pro Zeile)"
                      value={solutionLines.join("\n")}
                      onChange={v => setMeta({ solutionWords: v })} />
                  </div>
                : solutionLines.map((s, i) => (
                    <div key={i} style={{ color: cPrize, fontSize: px(9.5), fontWeight: 700, lineHeight: 1.4 }}>
                      {s}
                    </div>
                  ))}
            </div>,
            { marginTop: px(8), flexShrink: 0 })}
          <div style={{ flex: "1 0 0", minHeight: px(4) }} />
          {/* Kostenhinweis (Telemedia) steht jetzt unter jeder Telefonnummer
              in der Fragenspalte — hier links entfällt er. */}
          {wrap("publisherLogo",
            theme.publisherLogo
              ? <img key={theme.publisherLogo} onLoad={onLogoLoad}
                  src={theme.publisherLogo} alt=""
                  style={{
                    width: logoDim ? `${logoDim.w}px` : `${Math.round(Math.sqrt(targetLogoArea))}px`,
                    height: logoDim ? `${logoDim.h}px` : "auto",
                    objectFit: "contain", display: "block",
                  }} />
              : <span style={{ display: "inline-block", border: `1px dashed ${cPrize}`,
                  color: cPrize, fontSize: px(9), fontWeight: 700, padding: px(5),
                  borderRadius: px(3), textTransform: "uppercase",
                  letterSpacing: 0.5 }}>Logo fehlt</span>,
            { marginTop: px(6), flexShrink: 0 })}
        </div>

        {/* SPALTE 2: zwei gestapelte Bilder */}
        <div style={{ flex: "0 0 30%", display: "flex", flexDirection: "column", gap: px(8), minWidth: 0 }}>
          {/* Bilder werden auf Datenebene passend zugeschnitten (fitCardImage);
              objectFit:cover gleicht Rest-Differenzen aus. */}
          {wrap("img_top",
            <div style={{ height: "100%", overflow: "hidden", background: "#EFE9E2", borderRadius: px(3) }}>
              {imgTop
                ? <img src={imgTop} alt="" draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                : <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                    width: "100%", height: "100%", color: "#A89F93", fontSize: px(11) }}>Bild zu Frage 4</div>}
            </div>,
            { flex: 1, minHeight: 0 }, true)}
          {wrap("img_bottom",
            <div style={{ height: "100%", overflow: "hidden", background: "#EFE9E2", borderRadius: px(3) }}>
              {imgBottom
                ? <img src={imgBottom} alt="" draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                : <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                    width: "100%", height: "100%", color: "#A89F93", fontSize: px(11) }}>Bild zu Frage 5</div>}
            </div>,
            { flex: 1, minHeight: 0 }, true)}
        </div>

        {/* SPALTE 3: Fragen mit Preis-Badges + großes !?-Wasserzeichen.
            Ohne overflow:hidden — siehe Spalte 1. */}
        <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column",
          minWidth: 0, minHeight: 0 }}>
          <div aria-hidden style={{ position: "absolute", right: px(4), bottom: px(0),
            fontSize: px(150), fontWeight: 800, color: cPrize, opacity: 0.08,
            lineHeight: 0.8, pointerEvents: "none", userSelect: "none" }}>!?</div>
          {wrap("questionsHeadline",
            <div style={{ color: cPrize, fontSize: px(12.5), fontWeight: 700, lineHeight: 1.15 }}>
              {ed(meta.questionsHeadline ?? "", v => setMeta({ questionsHeadline: v }),
                { placeholder: DEFAULT_QUESTIONS_HEADLINE }) }
              {!edit && !meta.questionsHeadline && DEFAULT_QUESTIONS_HEADLINE}
            </div>,
            { marginBottom: px(5) })}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
            justifyContent: "space-between", gap: px(3) }}>
            {questions.map((q, qi) => {
              const prize = prizes.find(p => p.id === q.prizeTierId) || prizes[0];
              if (!(q.text || q.phoneNumber) && !edit) return null;
              return (
                <Fragment key={q.id}>
                  {wrap(`question_${q.id}`,
                    <div style={{ minWidth: 0 }}>
                      {/* Betrag-Oval FREIGESTELLT: absolut rechts neben der
                          Frage verankert, aus dem Textfluss gelöst — einzeln
                          verschieb-/skalier-/editier-/löschbar. Der Fragetext
                          reserviert rechts Platz dafür. */}
                      <div style={{ color: cQuestion, fontSize: px(10.5), fontWeight: 700,
                        lineHeight: 1.25, paddingRight: px(46) }}>
                        {edit
                          ? <InlineEditable value={q.text} placeholder="Frage eingeben"
                              onChange={v => dispatch!({ type: "UPDATE_QUESTION", id: q.id, payload: { text: v } })} />
                          : q.text}
                      </div>
                      {prize && wrap(`prize_${q.id}`,
                        <span style={{ display: "inline-block", background: cPrize, color: "#FFFFFF",
                          fontSize: px(12), fontWeight: 700, padding: `${px(1.5)} ${px(9)}`,
                          borderRadius: px(9), whiteSpace: "nowrap", textAlign: "center" }}>
                          {edit
                            ? <InlineEditable value={getPrizeLabel(prize)}
                                style={{ minWidth: "1ch", padding: 0, margin: 0 }}
                                onChange={v => dispatch!({ type: "UPDATE_PRIZE", id: prize.id, payload: { label: v || null } })} />
                            : getPrizeLabel(prize)}
                        </span>,
                        { position: "absolute", top: 0, right: 0 })}
                      {/* Telefonnummer deutlich größer; Kostenhinweis (Telemedia)
                          steht unter JEDER Nummer. */}
                      <div style={{ color: cPhone, fontSize: px(13), fontWeight: 700, letterSpacing: 0.3 }}>
                        {edit
                          ? <InlineEditable value={q.phoneNumber ?? ""} placeholder="Telefonnummer"
                              onChange={v => dispatch!({ type: "UPDATE_QUESTION", id: q.id, payload: { phoneNumber: v } })} />
                          : q.phoneNumber}
                      </div>
                      {meta.phoneTermsText && (
                        <div style={{ color: cTerms, fontSize: px(5.5), lineHeight: 1.15 }}>
                          {meta.phoneTermsText}
                        </div>
                      )}
                    </div>,
                    { minWidth: 0, minHeight: 0 })}
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* SPALTE 4: Gewinner-Boxen mit großen Beträgen. Bewusst OHNE
            overflow:hidden — sonst werden vom Nutzer verschobene/vergrößerte
            Elemente an der Spaltenkante abgeschnitten. */}
        <div style={{ flex: "0 0 24%", display: "flex", flexDirection: "column",
          minWidth: 0, minHeight: 0 }}>
          {/* Gewinner-Überschrift als EIGENER Block: separat verschieb-,
              skalier-, editier- und ausblendbar. */}
          {wrap("winnersHeadline",
            <div style={{ color: cPrize, fontSize: px(13), fontWeight: 700 }}>
              {ed(meta.winnersText || "Unsere neuen Gewinner:", v => setMeta({ winnersText: v }), { placeholder: "Gewinner-Überschrift" })}
            </div>,
            { marginBottom: px(8), flexShrink: 0 })}
          {wrap("winners",
            <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1, minHeight: 0, display: "flex",
                flexDirection: "column", justifyContent: "space-between", gap: px(5) }}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const w = winners[i];
                  const prize = prizes[i];
                  return (
                    <div key={w?.id || i} style={{ flex: 1, background: "#EDEFF2", borderRadius: px(3),
                      display: "flex", alignItems: "center", gap: px(8), padding: px(5), minHeight: 0 }}>
                      <div style={{ width: px(52), height: "92%", background: "#D7DBE0",
                        borderRadius: px(2), overflow: "hidden", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {w?.photo
                          ? <img src={w.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ color: "#A3AAB3", fontSize: px(7) }}>Foto</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: "#333", fontSize: px(13), fontWeight: 700,
                          lineHeight: 1.15, overflow: "hidden" }}>
                          {edit && w
                            ? <InlineEditable value={w.text} placeholder="Vorname Nachname"
                                onChange={v => dispatch!({ type: "UPDATE_WINNER", id: w.id, payload: { text: v } })} />
                            : (w?.text || "Vorname Nachname")}
                        </div>
                        {/* Voll deckendes Verlagsblau — keine Transparenz,
                            sonst wirken die Beträge grau. */}
                        <div style={{ color: cPrize, fontSize: px(19),
                          fontWeight: 800, lineHeight: 1.0 }}>
                          {prize ? getPrizeLabel(prize) : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>,
            { flex: 1, minHeight: 0 }, true)}
        </div>
      </div>

      {/* FUSSZEILE: lange Teilnahmebedingungen über volle Breite (sehr klein) */}
      {(meta.termsText || edit) && wrap("terms",
        <div style={{ color: cTerms, fontSize: px(6),
          lineHeight: 1.25, borderTop: "1px solid #D8D2C8", paddingTop: px(4),
          textAlign: "justify", hyphens: "auto" as const, WebkitHyphens: "auto" as const }} lang="de">
          {ed(meta.termsText, v => setMeta({ termsText: v }), { multiline: true, placeholder: "Teilnahmebedingungen" })}
        </div>,
        { marginTop: px(6), flexShrink: 0 })}

      {/* GITTER-OVERLAY (nur Editor): feine Linien alle 2,5 %, kräftigere alle
          10 % — passend zum Einrasten beim Verschieben. Im PDF unsichtbar. */}
      {edit && (
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4,
          backgroundImage: [
            "linear-gradient(to right, rgba(59,130,246,0.10) 1px, transparent 1px)",
            "linear-gradient(to bottom, rgba(59,130,246,0.10) 1px, transparent 1px)",
            "linear-gradient(to right, rgba(59,130,246,0.25) 1px, transparent 1px)",
            "linear-gradient(to bottom, rgba(59,130,246,0.25) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: [
            `${width / 40}px ${height / 40}px`,
            `${width / 40}px ${height / 40}px`,
            `${width / 10}px ${height / 10}px`,
            `${width / 10}px ${height / 10}px`,
          ].join(", "),
        }} />
      )}

      {/* Wiederherstellen-Leiste für ausgeblendete Elemente (nur Editor) */}
      {edit && hiddenIds.length > 0 && (
        <div style={{ position: "absolute", left: 8, bottom: 8, zIndex: 6,
          display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
          background: "rgba(255,255,255,0.95)", border: "1px solid #3B82F6",
          borderRadius: 10, padding: "5px 8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.18)" }}
          onPointerDown={e => e.stopPropagation()}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#1D4ED8" }}>
            Ausgeblendet — klicken zum Einblenden:
          </span>
          {hiddenIds.map(hid => (
            <button key={hid}
              onClick={e => { e.stopPropagation(); dispatch!({ type: "UPDATE_TRANSFORM", id: hid, payload: { hidden: false } }); }}
              title="Element wieder einblenden"
              style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                background: "#3B82F6", border: "none",
                color: "#FFFFFF", cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
              + {elementLabel(hid)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OverlayRenderer({ quiz, width, height, selectedBlockId, onSelectBlock }: {
  quiz: Quiz; width: number; height: number;
  selectedBlockId: string | null; onSelectBlock: (id: string | null) => void;
}) {
  if (quiz.layout.format === "schwedenraetsel") {
    return <SchwedenraetselRenderer quiz={quiz} width={width} height={height} />;
  }
  if (quiz.layout.format === "schatzsuche") {
    return <SchatzsucheRenderer quiz={quiz} width={width} height={height} />;
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

// ============================================================
// SCHATZSUCHE-RENDERER (Geldregen-Mechanik als Schatzkarte)
// 8 Grabungsstellen × je 1 Frage mit 2 Antworten = 16 Rufnummern.
// Referenzraster 1890×1320 px (= 315×220 mm); alle Maße skalieren
// über k = width/1890, damit Vorschau und PDF identisch sind.
// ============================================================
const SZ_MAP_SRC = "/schatzinsel.png";
// Merkt sich das zuletzt aktive Wissensquiz-Format, damit der
// Spiel-Reiter "Wissensquiz" nach einem Ausflug zu "Geldregen"
// (= Format "schatzsuche") wieder dorthin zurückschalten kann.
// Bewusst Modul-Variable statt Hook: rein kosmetisch, nicht reaktiv.
let lastWissensquizFormat = "berliner_halbformat";
// Grabungsstellen als Anteile der Kartenfläche (auf der Insel platziert).
const SZ_SPOTS: [number, number][] = [
  [0.380, 0.300], [0.500, 0.345], [0.700, 0.550], [0.260, 0.530],
  [0.546, 0.616], [0.630, 0.495], [0.300, 0.630], [0.470, 0.660]
];
const SZ_ROT = [-6, 4, -8, 3, 7, -3, 5, -5];
const SZ_STEPS = [
  "Suchen Sie sich eine der 8 Grabungsstellen aus – jede Stelle hat ihre eigene Gewinnfrage.",
  "Beantworten Sie die Frage Ihrer Stelle und rufen Sie deren Hotline an – mit der Endziffer Ihrer Antwort (1 oder 2).",
  "Sie hören sofort, ob an Ihrer Stelle ein Schatz vergraben war.",
  "Nichts gefunden? Jede weitere Stelle stellt eine neue Frage – und bietet eine neue Gewinnchance!"
];
const SZ_RANDOM_NOTE = "Vor Spielbeginn wurden alle Schätze per Zufallsgenerator über die Grabungsstellen und über Zeitfenster des Spieltags verteilt. Treffen Sie mit Ihrem Anruf eine Schatz-Stelle im richtigen Moment, haben Sie gewonnen – und erfahren dies sogleich am Telefon.";

function SchatzsucheRenderer({ quiz, width, height }: { quiz: Quiz; width: number; height: number }) {
  const { meta, theme } = quiz;
  const k = width / 1890;
  const P = (v: number) => v * k;
  const ff = theme.fontFamily || `Montserrat, system-ui, sans-serif`;
  const c = theme.colors || {};
  const BLUE = c.title || "#18537D";
  const TEAL = c.intro || "#1796A6";
  const QCOL = c.question || "#4A5358";
  const TERMS = c.terms || "#6E7A80";
  const GOLD = "#E8B33C"; const DGOLD = "#7A4E08"; const PEDGE = "#C9A055"; const XRED = "#9E2415";

  const qs = quiz.questions.slice(0, 8);
  const winnerCount = Math.min(meta.winnerCount ?? 0, 5);
  const winners = (meta.winners || []).slice(0, winnerCount);
  const kicker = meta.geldregenKicker?.trim() || "Schatzsuche: Anrufen und kassieren";
  const titleText = meta.title?.trim() || "DIE GROSSE SCHATZSUCHE";
  const subtitleText = meta.subtitle?.trim() || "8 Stellen, 8 Fragen – wo graben Sie heute?";
  const stoerer = meta.stoererText?.trim() || "Jeder Anruf – eine neue Chance!";
  const spieltag = meta.spieltag?.trim() || "1";
  const mapSrc = theme.background?.image || SZ_MAP_SRC;
  const chestId = meta.chestId ?? 1;   // 1–12, 0 = aus
  const chestSuffix = meta.chestClosed ? "_closed" : "";
  const chestSrc = chestId >= 1 && chestId <= 12 ? `/chests/chest${String(chestId).padStart(2, "0")}${chestSuffix}.png` : null;
  const rules = (meta.geldregenRules?.trim()
    ? meta.geldregenRules.split("\n").map(s => s.trim()).filter(Boolean)
    : SZ_STEPS);

  const card = (q: Question, i: number) => {
    const tier = quiz.prizes.find(p => p.id === q.prizeTierId);
    const prize = tier ? getPrizeLabel(tier) : "";
    const a1 = q.options?.[0] || "Antwort 1";
    const a2 = q.options?.[1] || "Antwort 2";
    const phone = (q.phoneNumber || `01378 4081${i + 1}`).trim();
    const row = (chipBg: string, chipCol: string, n: string, answer: string, numCol: string) => (
      <div style={{ display: "flex", alignItems: "center", gap: P(8), marginTop: P(5) }}>
        <div style={{ width: P(14), height: P(14), borderRadius: P(3), background: chipBg, color: chipCol, fontSize: P(11), fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</div>
        <div style={{ fontSize: P(17), fontWeight: 700, color: QCOL, whiteSpace: "nowrap", overflow: "hidden" }}>{answer}</div>
        <div style={{ marginLeft: "auto", fontSize: P(17.5), fontWeight: 700, color: numCol, whiteSpace: "nowrap" }}>{phone} {n}</div>
      </div>
    );
    return (
      <div key={q.id} style={{ position: "absolute", left: P(1080), top: P(184 + i * 119.15), width: P(350), height: P(112), background: "#FFFFFF", border: `${P(2)}px solid ${PEDGE}`, borderRadius: P(10), boxSizing: "border-box", padding: `${P(8)}px ${P(15)}px`, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: P(8) }}>
          <div style={{ width: P(26), height: P(26), borderRadius: "50%", background: GOLD, border: `${P(2)}px solid ${DGOLD}`, color: "#5C3A00", fontSize: P(15), fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
          <div style={{ fontSize: P(14), color: TERMS }}>Stelle</div>
          <div style={{ marginLeft: "auto", fontSize: P(20), fontWeight: 700, color: BLUE, whiteSpace: "nowrap" }}>{prize}</div>
        </div>
        <div style={{ fontSize: P(17.5), fontWeight: 700, color: QCOL, marginTop: P(5), whiteSpace: "nowrap", overflow: "hidden" }}>{q.text}</div>
        {row("#1796A6", "#FFFFFF", "1", a1, "#1796A6")}
        {row(GOLD, "#5C3A00", "2", a2, "#B07A14")}
      </div>
    );
  };

  return (
    <div style={{ width, height, position: "relative", overflow: "hidden", fontFamily: ff, background: "linear-gradient(180deg, #FDF9EC 0%, #F2E3B8 100%)" }}>
      {/* Kopf */}
      <div style={{ position: "absolute", left: P(56), top: P(26), fontSize: P(23), color: QCOL }}>{kicker}</div>
      <div style={{ position: "absolute", left: P(56), top: P(56), fontSize: P(64), fontWeight: 800, color: BLUE, whiteSpace: "nowrap" }}>{titleText}</div>
      <div style={{ position: "absolute", left: P(56), top: P(132), fontSize: P(31), fontWeight: 700, color: TEAL, whiteSpace: "nowrap" }}>{subtitleText}</div>
      {/* Spieltag-Badge */}
      <div style={{ position: "absolute", left: P(1700), top: P(26), width: P(150), height: P(104), background: "#FFFFFF", border: `${P(2.5)}px solid ${BLUE}`, borderRadius: P(10), boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: P(38), fontWeight: 700, color: c.prize || "#C0392B", lineHeight: 1 }}>{spieltag}.</div>
        <div style={{ fontSize: P(21), fontWeight: 700, color: BLUE }}>Spieltag</div>
      </div>
      {/* Linke Spalte: So einfach geht's */}
      <div style={{ position: "absolute", left: P(50), top: P(184), width: P(420), height: P(740), background: "rgba(255,255,255,0.8)", border: `${P(1.5)}px solid ${PEDGE}`, borderRadius: P(16), boxSizing: "border-box", padding: P(24), overflow: "hidden" }}>
        <div style={{ fontSize: P(29), fontWeight: 700, color: BLUE, marginBottom: P(14) }}>So einfach geht’s:</div>
        {rules.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: P(8), marginBottom: P(12) }}>
            <div style={{ fontSize: P(21), fontWeight: 700, color: BLUE, flexShrink: 0 }}>{i + 1}.</div>
            <div style={{ fontSize: P(21), color: QCOL, lineHeight: 1.3, textAlign: "justify" }}>{s}</div>
          </div>
        ))}
        <div style={{ fontSize: P(19), color: QCOL, lineHeight: 1.32, marginTop: P(10), textAlign: "justify" }}>{SZ_RANDOM_NOTE}</div>
      </div>
      {/* Schatzkarte (Originalbild) mit 8 Kreuzen */}
      <div style={{ position: "absolute", left: P(500), top: P(184), width: P(560), height: P(563), border: `${P(2.5)}px solid #5C4322`, boxSizing: "border-box" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mapSrc} alt="Schatzkarte" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
        {SZ_SPOTS.map(([fx, fy], i) => (
          <Fragment key={i}>
            <div style={{ position: "absolute", left: `${fx * 100}%`, top: `${fy * 100}%`, width: 0, height: 0, transform: `rotate(${SZ_ROT[i]}deg)` }}>
              <div style={{ position: "absolute", left: -P(15.5), top: -P(3.5), width: P(31), height: P(7), background: XRED, borderRadius: P(3.5), transform: "rotate(45deg)" }} />
              <div style={{ position: "absolute", left: -P(15.5), top: -P(3.5), width: P(31), height: P(7), background: XRED, borderRadius: P(3.5), transform: "rotate(-45deg)" }} />
            </div>
            <div style={{ position: "absolute", left: `calc(${fx * 100}% + ${P(18)}px)`, top: `calc(${fy * 100}% - ${P(17)}px)`, transform: "translate(-50%, -50%)", width: P(25), height: P(25), borderRadius: "50%", background: GOLD, border: `${P(2.2)}px solid ${DGOLD}`, color: "#5C3A00", fontSize: P(14), fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
          </Fragment>
        ))}
      </div>
      {/* Schatztruhe (Dekoration) unter der linken Spalte */}
      {chestSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={chestSrc} alt="Schatztruhe" style={{ position: "absolute", left: P(60), top: P(936), width: P(400), height: P(196), objectFit: "contain" }} />
      )}
      {/* Störer unter der Karte */}
      <div style={{ position: "absolute", left: P(570), top: P(880), width: P(420), height: P(160), background: c.prize || "#C0392B", borderRadius: P(26), transform: "rotate(-4deg)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#FFFFFF", fontSize: P(36), fontWeight: 700, lineHeight: 1.25, padding: P(12), boxSizing: "border-box" }}>{stoerer}</div>
      {/* Fragen-/Nummernboxen */}
      {qs.map((q, i) => card(q, i))}
      {/* Gewinner-Spalte */}
      <div style={{ position: "absolute", left: P(1460), top: P(184), width: P(380), height: P(946), background: "rgba(255,255,255,0.82)", border: `${P(1.5)}px solid ${PEDGE}`, borderRadius: P(16), boxSizing: "border-box", padding: P(20), overflow: "hidden" }}>
        <div style={{ textAlign: "center", fontSize: P(27), fontWeight: 700, color: BLUE }}>Unsere Glückspilze</div>
        <div style={{ textAlign: "center", fontSize: P(18), color: TERMS, marginBottom: P(18) }}>der letzten Spieltage</div>
        {winners.map((w, i) => (
          <div key={w.id || i} style={{ display: "flex", alignItems: "center", gap: P(16), marginBottom: P(24) }}>
            <div style={{ width: P(116), height: P(116), borderRadius: "50%", border: `${P(4)}px solid ${GOLD}`, overflow: "hidden", flexShrink: 0, background: "#F2E3B8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {w.photo
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={w.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: P(40), color: DGOLD, fontWeight: 700 }}>€</span>}
            </div>
            <div style={{ fontSize: P(18.5), fontWeight: 700, color: QCOL, lineHeight: 1.3 }}>{w.text || `Glückspilz ${i + 1}`}</div>
          </div>
        ))}
        {winners.length === 0 && (
          <div style={{ fontSize: P(18), color: TERMS, textAlign: "center", marginTop: P(40) }}>Gewinnerfotos über „Gewinner“ im Editor hinzufügen.</div>
        )}
      </div>
      {/* Fußzeile */}
      <div style={{ position: "absolute", left: P(50), right: P(50), bottom: P(96), borderTop: `${P(2)}px solid ${PEDGE}` }} />
      <div style={{ position: "absolute", left: P(60), bottom: P(64), right: P(60), fontSize: P(19), fontWeight: 700, color: QCOL, whiteSpace: "nowrap", overflow: "hidden" }}>{meta.phoneTermsText || "0,50 € pro Anruf aus dem dt. Festnetz sowie Mobilfunk (Flatrates nicht inbegriffen)."}</div>
      <div style={{ position: "absolute", left: P(60), bottom: P(14), right: P(60), fontSize: P(13.5), color: TERMS, lineHeight: 1.25, overflow: "hidden", maxHeight: P(46) }}>{meta.termsText || "Teilnahmebedingungen siehe Verlagsvorlage."}</div>
    </div>
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

// Rendert children per React-Portal in ein eigenes Browser-Fenster.
// Styles (Tailwind/Fonts) werden beim Öffnen in das neue Fenster kopiert;
// ein <base>-Element sorgt dafür, dass relative URLs (Logos, Fonts)
// weiterhin gegen den App-Origin aufgelöst werden. Schließt der Nutzer
// das Fenster, ruft die Komponente onClose auf und die Vorschau kehrt
// in das Hauptfenster zurück.
// Das Fenster selbst wird im Klick-Handler geöffnet (window.open im direkten
// User-Gesture-Kontext — sonst blockt der Popup-Blocker) und hier nur noch
// initialisiert. Die Initialisierung ist idempotent, damit der doppelte
// Effekt-Lauf im React-Dev-Modus (StrictMode) das Fenster nicht zerstört.
function PreviewPopout({ win, title, onClose, children }: { win: Window; title: string; onClose: () => void; children: React.ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (win.closed) { onCloseRef.current(); return; }
    const doc = win.document;
    // Nur einmal aufbauen — bei Re-Mounts (StrictMode) wiederverwenden.
    if (!doc.getElementById("wq-popout-root")) {
      doc.title = "Vorschau — Wissensquiz Creator";
      // Relative URLs (Bilder, @font-face) gegen den App-Origin auflösen.
      const base = doc.createElement("base");
      base.href = window.location.origin + "/";
      doc.head.appendChild(base);
      // Alle Styles des Hauptfensters übernehmen (Tailwind, Fonts, Globals).
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
        doc.head.appendChild(node.cloneNode(true));
      });
      doc.body.style.margin = "0";
      doc.body.style.background = "#fafaf9";
      const mount = doc.createElement("div");
      mount.id = "wq-popout-root";
      mount.style.cssText = "height:100vh;display:flex;flex-direction:column;overflow:hidden;";
      doc.body.appendChild(mount);
    }
    setContainer(doc.getElementById("wq-popout-root") as HTMLElement);

    // Schließen erkennen (beforeunload feuert nicht zuverlässig bei Popups).
    const poll = window.setInterval(() => {
      if (win.closed) { window.clearInterval(poll); onCloseRef.current(); }
    }, 400);
    // Bewusst KEIN win.close() im Cleanup — im StrictMode würde das Fenster
    // sonst direkt nach dem Öffnen wieder geschlossen.
    return () => { window.clearInterval(poll); };
  }, [win]);

  // Titel im Popout-Fenster aktuell halten (z. B. bei Preset-Wechsel).
  useEffect(() => {
    if (!win.closed) win.document.title = `${title} — Wissensquiz Creator`;
  }, [title, win]);

  if (!container) return null;
  return createPortal(children, container);
}

export default function Page() {
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: defaultQuiz, future: [] });
  const quiz = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("inhalt");
  const [imageStyleMode, setImageStyleMode] = useImageStyleMode();
  // Wenn gesetzt, rendert Vorschau und PDF-Export mit Schrift/Farben/Größe
  // einer Verlags-Vorlage *ohne* den Editor-Stand zu verändern.
  const [previewPreset, setPreviewPreset] = useState<VerlagsPreset | null>(null);
  // Vorschau in eigenem Browser-Fenster ("Popout"). Hält die Window-Referenz;
  // solange gesetzt, wird die schwebende Vorschau im Hauptfenster ausgeblendet
  // und der Editor nutzt die volle Breite. Das Fenster wird im Klick-Handler
  // geöffnet (Popup-Blocker erlaubt window.open nur im User-Gesture-Kontext).
  const [popoutWin, setPopoutWin] = useState<Window | null>(null);
  const previewPopped = !!popoutWin;
  const openPreviewPopout = () => {
    const win = window.open("", "wissensquizVorschau",
      "width=920,height=640,left=120,top=80,resizable=yes,scrollbars=yes");
    if (!win) {
      alert("Popup wurde vom Browser blockiert. Bitte Popups für localhost erlauben und erneut versuchen.");
      return;
    }
    setPopoutWin(win);
  };
  const closePreviewPopout = () => {
    if (popoutWin && !popoutWin.closed) popoutWin.close();
    setPopoutWin(null);
  };
  // Teilnahmebedingungen einmalig vorladen, damit applyPresetToQuiz sie
  // synchron in der Vorschau einsetzen kann.
  useEffect(() => { loadTermsMap(); }, []);
  // Einmalige Korrektur: Der KI-Farb-Override (Gelb) der Augsburger Gruppe
  // wird entfernt, damit das kuratierte Redaktions-Blau (#205077) aus der
  // Preset-Datenbank wieder greift. Schrift/Layout des Overrides bleiben.
  useEffect(() => {
    try {
      const FLAG = "wq.fix.augsburgerBlau.v1";
      if (localStorage.getItem(FLAG)) return;
      const all = loadGroupOverrides();
      const key = "Augsburger Allgemeinen";
      const ov = all[key];
      if (ov?.colors) {
        const { colors: _verworfen, ...rest } = ov;
        saveGroupOverride(key, rest);
        console.info("Augsburger Farb-Override entfernt — Redaktions-Blau aus der Datenbank aktiv.");
      }
      localStorage.setItem(FLAG, "1");
    } catch { /* localStorage nicht verfügbar — ignorieren */ }
  }, []);
  const styleProps = useStyleInstructions();
  const [difficulty, setDifficulty] = useDifficulty();
  const [exportingPdf, setExportingPdf] = useState(false);
  const pdfTargetRef = useRef<HTMLDivElement>(null);

  // Wartet, bis Fonts UND alle <img>-Elemente im PDF-Target sicher geladen
  // sind. Ohne diesen Check kann der Snapshot vor dem Font-Tausch oder vor
  // dem Logo-Bild-Load erfolgen — dann steht im PDF eine Fallback-Schrift
  // oder das alte Logo.
  const waitForRenderReady = async (node: HTMLDivElement, fallbackMs = 1200) => {
    // 1) Auf Schrift-Loading warten (Google Fonts/lokale @font-face).
    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch { /* ignorieren */ }
    }
    // 2) Auf jedes <img> warten — Standard ist `complete`, sonst Promise auf load/error.
    const imgs = Array.from(node.querySelectorAll("img"));
    await Promise.all(imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>(res => {
        const done = () => { img.removeEventListener("load", done); img.removeEventListener("error", done); res(); };
        img.addEventListener("load", done);
        img.addEventListener("error", done);
        // Sicherheitsnetz, damit ein einziges defektes Bild den Export nicht blockiert.
        setTimeout(done, fallbackMs);
      });
    }));
    // 3) Ein bisschen Reflow-Zeit für die Auto-Fit-Iterationen im Renderer.
    await new Promise(r => setTimeout(r, 120));
  };

  // Prüft, ob das gerenderte Element überhaupt sichtbare Dimensionen hat —
  // sonst wirft jsPDF.addImage mit kryptischer Fehlermeldung.
  const ensureRenderable = (node: HTMLDivElement) => {
    const w = node.clientWidth, h = node.clientHeight;
    if (!w || !h) throw new Error(`PDF-Render-Target hat keine Größe (${w}×${h}px). Bitte Seite neu laden.`);
  };

  // Auto-Zuschnitt: gespeicherte Karten-Bilder werden beim Laden/Wechseln des
  // Quiz einmalig passend gemacht (Weißränder weg + Box-Seitenverhältnis).
  // Bereits geprüfte Bilder werden über eine Signatur übersprungen, damit
  // keine Endlosschleife entsteht.
  const fittedSigsRef = useRef<Set<string>>(new Set());
  const bgImage = quiz.theme.background?.image;
  const bgImageBottom = quiz.theme.background?.imageBottom;
  useEffect(() => {
    const jobs: ["image" | "imageBottom", string | null | undefined][] = [
      ["image", bgImage],
      ["imageBottom", bgImageBottom],
    ];
    jobs.forEach(([key, url]) => {
      if (!url || !url.startsWith("data:")) return;
      const sig = `${url.length}:${url.slice(50, 120)}`;
      if (fittedSigsRef.current.has(sig)) return;
      fittedSigsRef.current.add(sig);
      fitCardImage(url).then(fitted => {
        if (fitted !== url) {
          fittedSigsRef.current.add(`${fitted.length}:${fitted.slice(50, 120)}`);
          dispatch({ type: "UPDATE_BACKGROUND", payload: { [key]: fitted } });
        }
      }).catch(() => { /* Original behalten */ });
    });
  }, [bgImage, bgImageBottom]);

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

        // Auf Re-Render + Font/Logo-Load warten.
        await new Promise(r => setTimeout(r, 120));
        ensureRenderable(pdfTargetRef.current!);
        await waitForRenderReady(pdfTargetRef.current!);

        // Zwei Captures: hochauflösend (scale 3) für PDFs (druckfähig),
        // moderat (scale 1.5) für die HTML-Übersicht (web-tauglich, kleinere Dateien).
        // Vorher: scale 4 für alles → 67 MB index.html, über Cloudflare-Limit.
        const imgDataHi = await domToJpeg(pdfTargetRef.current!, { scale: 3, quality: 0.88 });
        const imgDataLo = await domToJpeg(pdfTargetRef.current!, { scale: 1.5, quality: 0.85 });
        cardImages.push(imgDataLo);

        const fmt = getQuizSize(q.layout);
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
      a.download = `wissensquiz-publish_${timestampForFilename()}.zip`;
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

  // Wendet die AKTUELLE Mapping-Regel in-place auf eine bereits generierte
  // Sammlung an (für Sammlungen, die noch mit dem alten Mapping importiert
  // wurden): Fragentexte/Antworten werden über die Preis-Slots gespiegelt,
  // sodass File-Frage 1 auf dem 50€-Slot und File-Frage 5 (bildgebend) auf
  // dem 1000€-Slot liegt. Titel wird neu gewürfelt (kreativer Satz mit
  // Hauptgewinn — Kundenwunsch: KEINE Frage als Titel). Die beiden
  // Karten-Bilder werden geleert, weil sie aus den falschen Fragen
  // generiert wurden — "Fehlende Bilder generieren" erzeugt sie danach
  // korrekt aus Frage 4 (oben) und Frage 5 (unten). Telefonnummern,
  // Preise und Style bleiben unangetastet.
  const handleRepairCollection = () => {
    if (!collection) return;
    const fixed = collection.quizzes.map(q => {
      // Texte über die Preis-Slots spiegeln (50€-Slot ↔ 1000€-Slot etc.).
      const reversed = [...q.questions].reverse();
      const remapped = q.questions.map((qq, idx) => ({
        ...qq,
        text: reversed[idx].text,
        correctAnswer: reversed[idx].correctAnswer,
      }));
      return {
        ...q,
        meta: {
          ...q.meta,
          title: pickTitleForTopic("", topPrizeLabel(q)),
          titleAuto: false,
          winnersText: q.meta.winnersText || DEFAULT_WINNERS_TEXT,
          termsText: q.meta.termsText || DEFAULT_TERMS_TEXT,
          phoneTermsText: q.meta.phoneTermsText || DEFAULT_PHONE_TERMS_TEXT,
        },
        theme: {
          ...q.theme,
          background: { ...q.theme.background, image: null, imageBottom: null },
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
    // "Fehlend" heißt: mindestens eines der beiden Karten-Bilder (image/imageBottom)
    // fehlt ODER Untertitel ist leer. Wir holen alles nach.
    const missing = collection.quizzes
      .map((q, i) => {
        const noTop = !q.theme.background?.image;
        const noBot = !q.theme.background?.imageBottom;
        const noSubtitle = !q.meta.subtitle?.trim();
        return (noTop || noBot || noSubtitle) ? i : null;
      })
      .filter((i): i is number => i !== null);
    if (!missing.length) {
      alert("Alle Quizzes haben bereits beide Bilder und einen Untertitel.");
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

      let aiSubtitle = "";
      try {
        const result = await generateQuizContent(topic, styleProps.styleText, difficulty);
        if (result?.subtitle) aiSubtitle = String(result.subtitle);
      } catch (e) {
        console.warn(`KI-Untertitel für "${topic}" fehlgeschlagen:`, e);
      }

      let nextQuiz: Quiz = (!q.meta.subtitle?.trim() && aiSubtitle)
        ? { ...q, meta: { ...q.meta, subtitle: aiSubtitle } }
        : q;

      // Karten-Bilder einzeln nachholen — nur fehlende werden erzeugt.
      const [subjTop, subjBot] = cardImageSubjects(q, topic);
      if (!nextQuiz.theme.background?.image && subjTop) {
        try {
          const url = await generateCardImageForSubject(subjTop, imageStyleMode);
          nextQuiz = { ...nextQuiz, theme: { ...nextQuiz.theme, background: { ...nextQuiz.theme.background, image: url } } };
        } catch (e) { failed++; console.error(`Bild (oben) für "${topic}" fehlgeschlagen:`, e); }
      }
      if (!nextQuiz.theme.background?.imageBottom && subjBot) {
        try {
          const url = await generateCardImageForSubject(subjBot, imageStyleMode);
          nextQuiz = { ...nextQuiz, theme: { ...nextQuiz.theme, background: { ...nextQuiz.theme.background, imageBottom: url } } };
        } catch (e) { failed++; console.error(`Bild (unten) für "${topic}" fehlgeschlagen:`, e); }
      }
      updated[i] = nextQuiz;
    }
    setBulkProgress({ current: missing.length, total: missing.length, topic: "", phase: "done", failed });
    setCollection({ quizzes: updated, activeIndex: collection.activeIndex });
    dispatch({ type: "LOAD_QUIZ", payload: updated[collection.activeIndex] });
    setTimeout(() => setBulkProgress(null), 4000);
  };

  // Einzelnes Karten-Bild eines beliebigen Quiz der Sammlung ersetzen
  // (Bilder-Galerie). Für das aktive Quiz MUSS über den Reducer gegangen
  // werden — der Sync-Effekt würde direkte Collection-Änderungen am
  // aktiven Index sonst sofort wieder mit dem Editor-Stand überschreiben.
  const handleUpdateQuizImage = (index: number, patch: { image?: string; imageBottom?: string }) => {
    if (!collection) return;
    if (index === collection.activeIndex) {
      dispatch({ type: "UPDATE_BACKGROUND", payload: patch });
      return;
    }
    setCollection({
      ...collection,
      quizzes: collection.quizzes.map((q, i) => i === index
        ? { ...q, theme: { ...q.theme, background: { ...q.theme.background, ...patch } } }
        : q),
    });
  };

  // Galerie: AUSGEWÄHLTE Karten-Bilder neu generieren (ersetzt vorhandene).
  // keys: Liste von "<quizIndex>:image" / "<quizIndex>:imageBottom".
  // Gleiche Mechanik wie handleGenerateMissingImages: lokal sammeln,
  // Fortschritt anzeigen, am Ende Sammlung + aktives Quiz konsistent setzen.
  const handleRegenerateAllImages = async (keys: string[]) => {
    if (!collection || !keys.length) return;
    const wanted = new Set(keys);
    if (!window.confirm(`${wanted.size} ausgewählte Bild(er) neu generieren? Vorhandene werden ersetzt (verursacht API-Kosten und kann mehrere Minuten dauern).`)) return;
    let failed = 0;
    let done = 0;
    const total = wanted.size;
    const updated = [...collection.quizzes];
    setBulkProgress({ current: 0, total, topic: "", phase: "imaging", failed: 0 });
    for (let i = 0; i < updated.length; i++) {
      const doTop = wanted.has(`${i}:image`);
      const doBot = wanted.has(`${i}:imageBottom`);
      if (!doTop && !doBot) continue;
      const q = updated[i];
      const topic = q.meta.title || `Quiz ${i + 1}`;
      const [subjTop, subjBot] = cardImageSubjects(q, topic);
      let nextQuiz = q;
      if (doTop && subjTop) {
        setBulkProgress({ current: ++done, total, topic: `${topic} — Bild oben`, phase: "imaging", failed });
        try {
          const url = await generateCardImageForSubject(subjTop, imageStyleMode ?? "aquarell");
          nextQuiz = { ...nextQuiz, theme: { ...nextQuiz.theme, background: { ...nextQuiz.theme.background, image: url } } };
        } catch (e) { failed++; console.error(`Bild oben für "${topic}" fehlgeschlagen:`, e); }
      }
      if (doBot && subjBot) {
        setBulkProgress({ current: ++done, total, topic: `${topic} — Bild unten`, phase: "imaging", failed });
        try {
          const url = await generateCardImageForSubject(subjBot, imageStyleMode ?? "aquarell");
          nextQuiz = { ...nextQuiz, theme: { ...nextQuiz.theme, background: { ...nextQuiz.theme.background, imageBottom: url } } };
        } catch (e) { failed++; console.error(`Bild unten für "${topic}" fehlgeschlagen:`, e); }
      }
      updated[i] = nextQuiz;
      // Zwischenstand in die Galerie spiegeln (Bilder erscheinen nach und nach).
      setCollection({ quizzes: [...updated], activeIndex: collection.activeIndex });
    }
    setBulkProgress({ current: total, total, topic: "", phase: "done", failed });
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

      // KI-Untertitel nur — Bild-Prompts kommen aus Frage 4 / 5.
      let aiSubtitle = "";
      try {
        const result = await generateQuizContent(p.topic, styleProps.styleText, difficulty);
        if (result?.subtitle) aiSubtitle = String(result.subtitle);
      } catch (e) {
        console.warn(`KI-Untertitel für "${p.topic}" fehlgeschlagen — fahre ohne fort:`, e);
      }

      let withSubtitle: Quiz = aiSubtitle
        ? { ...base, meta: { ...base.meta, subtitle: aiSubtitle } }
        : base;

      // Zwei Karten-Bilder pro Quiz (Frage 4 oben, Frage 5 unten) im gewählten Stil.
      const [subjTop, subjBot] = cardImageSubjects(withSubtitle, p.topic);
      try {
        if (subjTop) {
          const url = await generateCardImageForSubject(subjTop, imageStyleMode);
          withSubtitle = { ...withSubtitle, theme: { ...withSubtitle.theme, background: { ...withSubtitle.theme.background, image: url } } };
        }
      } catch (e) { failed++; console.error(`Bild oben für "${p.topic}" fehlgeschlagen:`, e); }
      try {
        if (subjBot) {
          const url = await generateCardImageForSubject(subjBot, imageStyleMode);
          withSubtitle = { ...withSubtitle, theme: { ...withSubtitle.theme, background: { ...withSubtitle.theme.background, imageBottom: url } } };
        }
      } catch (e) { failed++; console.error(`Bild unten für "${p.topic}" fehlgeschlagen:`, e); }
      generated.push(withSubtitle);
      // LIVE-ANZEIGE: erstes Quiz sofort aktivieren, danach die wachsende
      // Sammlung nach jedem Quiz anzeigen — die fertigen Bilder erscheinen
      // direkt in Galerie und Vorschau statt erst am Ende des Laufs.
      if (i === 0) dispatch({ type: "LOAD_QUIZ", payload: withSubtitle });
      setCollection({ quizzes: [...generated], activeIndex: 0 });
    }
    setBulkProgress({ current: parsedQuizzes.length, total: parsedQuizzes.length, topic: "", phase: "done", failed });
    setCollection({ quizzes: generated, activeIndex: 0 });
    dispatch({ type: "LOAD_QUIZ", payload: generated[0] });
    // Progress-Panel nach kurzer Anzeigezeit ausblenden, Sammlung bleibt sichtbar.
    setTimeout(() => setBulkProgress(null), 4000);
  };

  // Bulk-Import ohne KI: legt sofort eine Sammlung aus allen Quizzen an
  // (Texte + Antworten, sonst Defaults). KI-Bilder können danach separat über
  // „Fehlende Bilder generieren" in der Sammlung nachgezogen werden.
  const handleImportAllAsCollection = (parsed: ParsedQuiz[]) => {
    if (!parsed.length) return;
    const template = quiz;
    const collectionQuizzes: Quiz[] = parsed.map(p => parsedQuizToQuiz(p, template));
    setCollection({ quizzes: collectionQuizzes, activeIndex: 0 });
    dispatch({ type: "LOAD_QUIZ", payload: collectionQuizzes[0] });
  };

  const handleExport = () => {
    const json = JSON.stringify(quiz, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const titleForFile = effectiveTitle(quiz) || "quiz";
    a.download = `${titleForFile.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}__${timestampForFilename()}.json`;
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

      // Wenn eine Verlags-Vorlage in der Vorschau aktiv ist, wenden wir
      // sie für diesen Export automatisch an. Sonst wird der reine
      // Editor-Stand genutzt.
      const exportQuiz = previewPreset
        ? applyPresetToQuiz(quiz, previewPreset, { preferPresetLogo: true })
        : quiz;
      if (previewPreset) {
        setPublishingQuiz(exportQuiz);
        // React-Re-Render abwarten.
        await new Promise(r => setTimeout(r, 120));
      }

      const fmt = getQuizSize(exportQuiz.layout);

      // Vor dem Snapshot Schrift und alle Bilder im Target sicher laden.
      ensureRenderable(pdfTargetRef.current);
      await waitForRenderReady(pdfTargetRef.current);

      const imgData = await domToJpeg(pdfTargetRef.current, {
        scale: 4,
        quality: 0.92
      });

      const orientation = exportQuiz.layout.orientation === "landscape" ? "landscape" : "portrait";
      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: [fmt.w, fmt.h]
      });

      pdf.addImage(imgData, "JPEG", 0, 0, fmt.w, fmt.h);

      const titleForFile = effectiveTitle(exportQuiz) || "quiz";
      // Filename trägt den Verlag mit, wenn ein Preset aktiv war —
      // damit man im Downloads-Ordner sieht für welche Zeitung das PDF war.
      const presetPart = previewPreset
        ? `${previewPreset.verlag}__${previewPreset.titelKanonisch || previewPreset.titel}__`
        : "";
      const safeName = `${presetPart}${titleForFile}`
        .replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
      pdf.save(`${safeName}__${timestampForFilename()}.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
      alert(`PDF-Export fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setPublishingQuiz(null);
      setExportingPdf(false);
    }
  };
  // Lädt das aktuelle Quiz als PDF für genau eine Zeitung herunter — mit deren
  // Schrift, Farben und exakter Anzeigengröße. Lässt den Editor-Stand unverändert.
  const [downloadingPresetId, setDownloadingPresetId] = useState<string | null>(null);
  // Fortschritt beim Bulk-PDF-Export mehrerer Zeitungen.
  const [presetBulk, setPresetBulk] = useState<{ current: number; total: number; name: string } | null>(null);
  // Fortschritt beim Push an monday.com (PDF erzeugen + hochladen).
  const [mondayBulk, setMondayBulk] = useState<{ current: number; total: number; name: string; failed: number } | null>(null);

  const handlePushPresetsToMonday = async (presets: VerlagsPreset[]) => {
    if (!pdfTargetRef.current || !presets.length) return;
    let failed = 0;
    try {
      const [{ domToJpeg }, { default: jsPDF }] = await Promise.all([
        import("modern-screenshot"),
        import("jspdf")
      ]);
      for (let i = 0; i < presets.length; i++) {
        const preset = presets[i];
        setMondayBulk({ current: i + 1, total: presets.length, name: `${preset.verlag} · ${preset.titel}`, failed });
        const overridden = applyPresetToQuiz(quiz, preset, { preferPresetLogo: true });
        setPublishingQuiz(overridden);
        await new Promise(r => setTimeout(r, 120));
        ensureRenderable(pdfTargetRef.current);
        await waitForRenderReady(pdfTargetRef.current);
        const fmt = getQuizSize(overridden.layout);
        const imgData = await domToJpeg(pdfTargetRef.current, { scale: 4, quality: 0.9 });
        const orientation: "portrait" | "landscape" = overridden.layout.orientation === "portrait" ? "portrait" : "landscape";
        const pdf = new jsPDF({ orientation, unit: "mm", format: [fmt.w, fmt.h] });
        pdf.addImage(imgData, "JPEG", 0, 0, fmt.w, fmt.h);
        const pdfBlob = pdf.output("blob");
        const safeFilename = `${preset.verlag}__${preset.titel}.pdf`.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const file = new File([pdfBlob], safeFilename, { type: "application/pdf" });
        const fd = new FormData();
        fd.append("file", file);
        fd.append("itemName", `${preset.titel} — ${effectiveTitle(quiz)}`);
        try {
          const r = await fetch("/api/monday-upload", { method: "POST", body: fd });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        } catch (err) {
          console.error(`monday.com Upload für ${preset.titel} fehlgeschlagen:`, err);
          failed++;
        }
      }
      setMondayBulk({ current: presets.length, total: presets.length, name: failed ? `${failed} fehlgeschlagen` : "fertig", failed });
      // Wenn alles fehlschlug, klar melden (Config-Problem o. ä.).
      if (failed === presets.length) {
        alert(`Alle Uploads fehlgeschlagen. Bitte prüfen: MONDAY_API_TOKEN, MONDAY_BOARD_ID, MONDAY_FILE_COLUMN_ID in .env.local — und Dev-Server neu starten.`);
      }
      setTimeout(() => setMondayBulk(null), 5000);
    } catch (e) {
      console.error("monday-Push fehlgeschlagen:", e);
      alert(`monday.com-Push fehlgeschlagen: ${(e as Error).message}`);
      setMondayBulk(null);
    } finally {
      setPublishingQuiz(null);
    }
  };

  const handleDownloadPresetsBulk = async (presets: VerlagsPreset[]) => {
    if (!pdfTargetRef.current || !presets.length) return;
    try {
      const [{ default: JSZip }, { domToJpeg }, { default: jsPDF }] = await Promise.all([
        import("jszip"),
        import("modern-screenshot"),
        import("jspdf")
      ]);
      const zip = new JSZip();
      const safe = (s: string) => s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
        .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
        .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      const clip = (s: string, max: number) => s.length <= max ? s : s.slice(0, max).replace(/_+$/, "");
      const titleForFile = effectiveTitle(quiz) || "quiz";

      // Dateinamen müssen eindeutig sein, sonst überschreibt JSZip
      // (3 Presets haben in der Quelle Titel="n/a" → ohne Verlag-Präfix
      // gingen 2 PDFs verloren). Filenames müssen aber auch KURZ sein —
      // Windows scheitert beim Extrahieren wenn Gesamt-Pfad > 260 Zeichen.
      // Wir kürzen aggressiv (Verlag max 20, Titel max 35, Datum kompakt
      // YYMMDD) und numerieren bei Kollisionen.
      const usedNames = new Set<string>();
      const d = new Date();
      const pad2 = (n: number) => n.toString().padStart(2, "0");
      const tsShort = `${(d.getFullYear()%100).toString().padStart(2,"0")}${pad2(d.getMonth()+1)}${pad2(d.getDate())}`;
      for (let i = 0; i < presets.length; i++) {
        const preset = presets[i];
        setPresetBulk({ current: i + 1, total: presets.length, name: `${preset.verlag} · ${preset.titel}` });
        const overridden = applyPresetToQuiz(quiz, preset, { preferPresetLogo: true });
        setPublishingQuiz(overridden);
        // Auf Re-Render + Font/Logo-Load warten.
        await new Promise(r => setTimeout(r, 120));
        ensureRenderable(pdfTargetRef.current);
        await waitForRenderReady(pdfTargetRef.current);
        const fmt = getQuizSize(overridden.layout);
        const imgData = await domToJpeg(pdfTargetRef.current, { scale: 4, quality: 0.9 });
        const orientation: "portrait" | "landscape" = overridden.layout.orientation === "portrait" ? "portrait" : "landscape";
        const pdf = new jsPDF({ orientation, unit: "mm", format: [fmt.w, fmt.h] });
        pdf.addImage(imgData, "JPEG", 0, 0, fmt.w, fmt.h);
        const titelTeil = preset.titelKanonisch && preset.titelKanonisch.trim() && preset.titelKanonisch !== "n/a"
          ? preset.titelKanonisch
          : (preset.titel && preset.titel !== "n/a" ? preset.titel : preset.verlag);
        // Aggressive Kürzung gegen Windows-260-Zeichen-Pfadlimit.
        const verlagShort = clip(safe(preset.verlag), 20);
        const titelShort = clip(safe(titelTeil), 35);
        const base = `${verlagShort}_${titelShort}`;
        let candidate = `${base}.pdf`;
        let n = 2;
        while (usedNames.has(candidate)) {
          candidate = `${base}_${n}.pdf`;
          n++;
        }
        usedNames.add(candidate);
        zip.file(candidate, pdf.output("blob"));
      }
      setPresetBulk({ current: presets.length, total: presets.length, name: "ZIP packen …" });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // ZIP-Name kompakt: max 30 Zeichen Quiz-Titel + Anzahl + 6-stelliges Datum.
      a.download = `${clip(safe(titleForFile), 30)}_${presets.length}_${tsShort}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Bulk-PDF (Verlage) fehlgeschlagen:", e);
      alert(`Bulk-PDF fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setPublishingQuiz(null);
      setPresetBulk(null);
    }
  };

  const handleDownloadPreset = async (preset: VerlagsPreset) => {
    if (!pdfTargetRef.current) return;
    setDownloadingPresetId(preset.id);
    try {
      const [{ domToJpeg }, { default: jsPDF }] = await Promise.all([
        import("modern-screenshot"),
        import("jspdf")
      ]);
      const overridden = applyPresetToQuiz(quiz, preset, { preferPresetLogo: true });
      setPublishingQuiz(overridden);
      // Auf Re-Render + Font/Logo-Load warten.
      await new Promise(r => setTimeout(r, 120));
      ensureRenderable(pdfTargetRef.current);
      await waitForRenderReady(pdfTargetRef.current);
      const fmt = getQuizSize(overridden.layout);
      const imgData = await domToJpeg(pdfTargetRef.current, { scale: 4, quality: 0.92 });
      const orientation: "portrait" | "landscape" = overridden.layout.orientation === "portrait" ? "portrait" : "landscape";
      const pdf = new jsPDF({ orientation, unit: "mm", format: [fmt.w, fmt.h] });
      pdf.addImage(imgData, "JPEG", 0, 0, fmt.w, fmt.h);
      const safe = (s: string) => s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
        .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
        .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      const titleForFile = effectiveTitle(quiz) || "quiz";
      // Konsistent mit Bulk: Verlag + bester Titel (titelKanonisch bevorzugt),
      // damit der Datei-Name auch bei preset.titel="n/a" eindeutig bleibt.
      const titelTeil = preset.titelKanonisch && preset.titelKanonisch.trim() && preset.titelKanonisch !== "n/a"
        ? preset.titelKanonisch
        : (preset.titel && preset.titel !== "n/a" ? preset.titel : preset.verlag);
      pdf.save(`${safe(preset.verlag)}__${safe(titelTeil)}__${safe(titleForFile)}__${timestampForFilename()}.pdf`);
    } catch (e) {
      console.error("PDF (Verlag) fehlgeschlagen:", e);
      alert(`PDF-Export fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setPublishingQuiz(null);
      setDownloadingPresetId(null);
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

  // Frageliste aus .docx importieren — auf Top-Bar-Ebene, damit immer sichtbar.
  const [parsedQuizzesPicker, setParsedQuizzesPicker] = useState<ParsedQuiz[] | null>(null);
  const [importingDocx, setImportingDocx] = useState(false);
  const handleQuestionnaireImport: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (!/\.(docx|xlsx|xlsm|xls|csv|tsv)$/i.test(file.name)) {
      alert([
        "Erlaubte Formate: .docx, .xlsx oder .csv.",
        "",
        "Word (.docx): Themen-Überschrift (Nr. > 5), darunter 5 Fragen 1.–5. mit Antwort in der nächsten Zeile.",
        "",
        "Excel (.xlsx) — Layout A (pro Blatt ein Quiz): Blatt-Name = Thema, Spalten 'Frage' und 'Antwort', bis zu 5 Zeilen.",
        "Layout B (alles in einem Blatt): Spalten 'Thema | Frage 1 | Antwort 1 | … | Frage 5 | Antwort 5', jede Zeile ein Quiz.",
        "",
        "CSV/TSV: gleiche Spalten-Layouts wie Excel. Trennzeichen (Semikolon, Komma, Tab) wird automatisch erkannt."
      ].join("\n"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert(`Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum 10 MB.`);
      return;
    }
    setImportingDocx(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/import-quiz-document", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const list: ParsedQuiz[] = j.quizzes || [];
      if (!list.length) { alert("Keine Quizze in der Datei gefunden."); return; }
      if (list.length === 1) {
        dispatch({ type: "APPLY_IMPORTED_QUIZ", payload: list[0] });
      } else {
        setParsedQuizzesPicker(list);
      }
    } catch (err) {
      alert(`Datei-Import fehlgeschlagen: ${(err as Error).message}`);
    } finally {
      setImportingDocx(false);
    }
  };
  const handleReset = () => { if (confirm("Wirklich auf das leere Start-Quiz zurücksetzen?")) dispatch({ type: "RESET" }); };

  // Navigation der neuen App-Shell. tabKey muss zu den Section-Komponenten
  // (siehe EditorPanel) passen, sonst werden Inhalte nicht angezeigt.
  const NAV: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { key: "inhalt",    label: "Inhalt",    icon: FileText,    color: "blue" },
    { key: "fragen",    label: "Fragen",    icon: HelpCircle,  color: "indigo" },
    { key: "preise",    label: "Preise",    icon: Coins,       color: "amber" },
    { key: "gewinner",  label: "Gewinner",  icon: Trophy,      color: "yellow" },
    { key: "bilder",    label: "Bilder",    icon: ImageIcon,   color: "purple" },
    { key: "layout",    label: "Layout",    icon: Layers,      color: "teal" },
    { key: "design",    label: "Design",    icon: Palette,     color: "rose" },
    { key: "verlag",    label: "Verlag",    icon: Building2,   color: "emerald" },
    { key: "teilnahme", label: "Teilnahme", icon: Receipt,     color: "stone" },
    { key: "ki",        label: "KI",        icon: Sparkles,    color: "sky" }
  ];
  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    blue:   { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200" },
    indigo: { bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200" },
    amber:  { bg: "bg-amber-50",   text: "text-amber-800",   border: "border-amber-200" },
    yellow: { bg: "bg-yellow-50",  text: "text-yellow-800",  border: "border-yellow-200" },
    purple: { bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200" },
    teal:   { bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-200" },
    rose:   { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200" },
    emerald:{ bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    stone:  { bg: "bg-stone-100",  text: "text-stone-700",   border: "border-stone-300" },
    sky:    { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200" }
  };

  // Apple-like Knopf-Stil: keine harten Ränder, weiches Hover, runde Form.
  const tbBtn = "h-8 px-3 text-[13px] rounded-lg bg-stone-100 hover:bg-stone-200 active:bg-stone-300 disabled:opacity-40 flex items-center gap-1.5 text-stone-700 transition-colors";
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: "#f5f5f7" }}>
      {/* TOP-BAR — App-weite Aktionen, mit Glasoptik */}
      <header className="h-12 flex items-center px-5 gap-2 shrink-0"
        style={{
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.08)"
        }}>
        <Sparkles className="w-4 h-4 text-sky-600" />
        <span className="text-[14px] font-semibold text-stone-900">Wissensquiz Creator</span>
        <span className="text-[12px] text-stone-400 ml-0.5">Phase 3.11</span>
        {/* SPIEL-REITER: Wissensquiz (Standard-Formate) vs. Geldregen (Schatzsuche-Vorlage) */}
        <div className="flex items-center p-0.5 rounded-lg bg-stone-200/70 ml-4">
          {([["wissensquiz", "Wissensquiz"], ["geldregen", "Geldregen"]] as const).map(([key, label]) => {
            const isGeldregen = quiz.layout.format === "schatzsuche";
            const active = key === "geldregen" ? isGeldregen : !isGeldregen;
            return (
              <button key={key}
                onClick={() => {
                  if (active) return;
                  if (key === "geldregen") {
                    lastWissensquizFormat = quiz.layout.format;
                    dispatch({ type: "UPDATE_LAYOUT", payload: { format: "schatzsuche", orientation: "landscape", customSize: null } });
                  } else {
                    dispatch({ type: "UPDATE_LAYOUT", payload: { format: lastWissensquizFormat === "schatzsuche" ? "berliner_halbformat" : lastWissensquizFormat, orientation: "landscape", customSize: null } });
                  }
                }}
                className={`h-7 px-3 text-[13px] rounded-md transition-colors ${
                  active ? "bg-white text-stone-900 font-medium shadow-sm" : "text-stone-500 hover:text-stone-700"
                }`}>
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <button onClick={() => dispatch({ type: "UNDO" })} disabled={!canUndo} className={tbBtn}><Undo2 className="w-3.5 h-3.5" /> Undo</button>
        <button onClick={() => dispatch({ type: "REDO" })} disabled={!canRedo} className={tbBtn}><Redo2 className="w-3.5 h-3.5" /> Redo</button>
        <div className="w-px h-5 bg-stone-300/60 mx-1" />
        <button onClick={handleExport} className={tbBtn}><Download className="w-3.5 h-3.5" /> JSON</button>
        <button onClick={handleExportPdf} disabled={exportingPdf} className={tbBtn}>
          {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} PDF
        </button>
        <label className={`${tbBtn} cursor-pointer`}>
          <Upload className="w-3.5 h-3.5" /> JSON
          <input type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
        </label>
        <label className={`${tbBtn} cursor-pointer`} title="Frageliste aus Word (.docx), Excel (.xlsx) oder CSV importieren">
          {importingDocx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          Fragen
          <input type="file"
            accept=".docx,.xlsx,.xlsm,.xls,.csv,.tsv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values"
            className="hidden" onChange={handleQuestionnaireImport} disabled={importingDocx} />
        </label>
        {collection && (
          <button onClick={handlePublish} disabled={!!publishing || !!bulkProgress}
            className="h-8 px-3.5 text-[13px] rounded-lg text-white disabled:opacity-40 flex items-center gap-1.5 transition-colors font-medium"
            style={{ background: "#0071e3" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#0077ed")}
            onMouseLeave={e => (e.currentTarget.style.background = "#0071e3")}>
            <Package className="w-3.5 h-3.5" /> Veröffentlichen
          </button>
        )}
        <button onClick={handleReset} className="h-8 px-3 text-[13px] rounded-lg text-rose-600 hover:bg-rose-50 transition-colors">Reset</button>
      </header>

      {/* HAUPTBEREICH: linke Icon-Navigation, Sammlungs-Spalte, Editor, schwebende Vorschau */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* NAV-RAIL */}
        <nav className="w-[76px] shrink-0 flex flex-col py-3 gap-1 items-center overflow-y-auto"
          style={{ background: "rgba(255,255,255,0.6)", borderRight: "1px solid rgba(0,0,0,0.06)" }}>
          {NAV.map(item => {
            const active = activeSection === item.key;
            const c = colorClasses[item.color];
            const Icon = item.icon;
            return (
              <button key={item.key} onClick={() => setActiveSection(item.key)}
                className={`w-[60px] h-[60px] rounded-xl flex flex-col items-center justify-center gap-1 text-[10.5px] transition-all ${
                  active ? `${c.bg} ${c.text} font-medium` : "text-stone-500 hover:bg-stone-100/70"
                }`}>
                <Icon className="w-[20px] h-[20px]" />
                <span className="leading-none">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* SAMMLUNGS-SPALTE */}
        {collection && (
          <aside className="w-64 shrink-0 p-3 flex flex-col"
            style={{ background: "rgba(255,255,255,0.5)", borderRight: "1px solid rgba(0,0,0,0.06)" }}>
            <QuizCollectionPicker collection={collection} activeTitle={quiz.meta.title}
              onSwitch={handleSwitchQuiz} onClear={handleClearCollection} onRepair={handleRepairCollection}
              onPublish={handlePublish} publishingDisabled={!!publishing || !!bulkProgress}
              onGenerateMissingImages={handleGenerateMissingImages} />
          </aside>
        )}

        {/* ZENTRALES EDITORFELD — der rechte Padding-Bereich entspricht der
            Breite der schwebenden Vorschau, damit Inhalte nie unter dem Bild
            landen ("Text bricht am Bild um"). */}
        <main className="flex-1 overflow-y-auto"
          style={{ padding: previewPopped ? "28px 32px 32px 32px" : "28px calc(38vw + 32px) 32px 32px" }}>
          {(bulkProgress && bulkProgress.phase === "imaging") && (
            <div className="mb-3"><BulkProgressPanel progress={bulkProgress} /></div>
          )}
          {publishing && (
            <div className="mb-3"><PublishingProgressPanel progress={publishing} /></div>
          )}
          <SectionContext.Provider value={{ active: activeSection }}>
            <EditorPanel quiz={quiz} dispatch={dispatch} canUndo={canUndo} canRedo={canRedo}
              onExport={handleExport} onExportPdf={handleExportPdf} exportingPdf={exportingPdf}
              onImport={handleImport} onReset={handleReset}
              styleProps={styleProps} difficulty={difficulty} setDifficulty={setDifficulty}
              collection={collection} bulkProgress={bulkProgress}
              onSwitchQuiz={handleSwitchQuiz} onBulkImport={handleBulkImport}
              onClearCollection={handleClearCollection} onRepairCollection={handleRepairCollection}
              onPublish={handlePublish} publishing={publishing}
              onGenerateMissingImages={handleGenerateMissingImages}
              activeSection={activeSection} embedded={true}
              onUpdateQuizImage={handleUpdateQuizImage}
              onRegenerateAllImages={handleRegenerateAllImages}
              previewPreset={previewPreset} setPreviewPreset={setPreviewPreset}
              downloadingPresetId={downloadingPresetId}
              onDownloadPreset={handleDownloadPreset}
              onDownloadPresetsBulk={handleDownloadPresetsBulk}
              presetBulk={presetBulk}
              onPushPresetsMonday={handlePushPresetsToMonday}
              mondayBulk={mondayBulk}
              imageStyleMode={imageStyleMode} setImageStyleMode={setImageStyleMode} />
          </SectionContext.Provider>
        </main>

        {/* VORSCHAU — schwebend unten rechts oder als eigenes Browser-Fenster
            (Popout). Inhalt ist identisch; nur der Rahmen wechselt. */}
        {(() => {
          const previewTitle = previewPreset ? (previewPreset.titelKanonisch || previewPreset.titel) : "Vorschau";
          const previewHeader = (
            <div className="px-4 py-2 flex items-center justify-between gap-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.5)" }}>
              <div className="flex items-baseline gap-2 min-w-0">
                <div className="text-[13px] font-semibold text-stone-800 truncate">
                  {previewTitle}
                </div>
                <div className="text-[11px] text-stone-500 truncate">
                  Tipp: Frage oder Telefonnummer anklicken zum Editieren
                </div>
                {previewPreset && presetWantsBigFooterLogo(previewPreset) && (
                  <span className="text-[10px] uppercase tracking-wider font-bold text-white px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: "#0071e3" }}>
                    Sonderlayout aktiv
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 min-w-0">
                {previewPreset && (
                  <div className="text-[11px] text-stone-500 flex items-center gap-2 min-w-0">
                    <span className="shrink-0" style={{
                      fontFamily: previewPreset.fontFamily,
                      fontWeight: 700, fontSize: 14, color: "#1A1A1A",
                      lineHeight: 1, padding: "0 4px",
                      border: "1px solid rgba(0,0,0,0.12)", borderRadius: 4,
                    }}>Aa</span>
                    {/* Lange KI-Schriftbeschreibungen abschneiden — sonst
                        schieben sie den "Eigenes Fenster"-Knopf aus dem Kopf. */}
                    <span className="truncate" style={{ maxWidth: 220 }}
                      title={`Original: ${previewPreset.fontRaw}`}>
                      {previewPreset.fontFamily.split(",")[0].replace(/['"]/g, "")}
                      {previewPreset.fontRaw && previewPreset.fontFamily.split(",")[0].replace(/['"]/g, "").toLowerCase() !== previewPreset.fontRaw.toLowerCase().split(/[\s–-]/)[0] && (
                        <span className="text-stone-400"> (statt {previewPreset.fontRaw})</span>
                      )}
                    </span>
                  </div>
                )}
                {!previewPopped && (
                  <button onClick={openPreviewPopout}
                    title="Vorschau in eigenem Fenster öffnen"
                    className="h-7 px-2.5 text-[12px] rounded-lg flex items-center gap-1.5 text-stone-600 hover:bg-stone-100 transition-colors shrink-0 whitespace-nowrap">
                    <ExternalLink className="w-3.5 h-3.5" /> Eigenes Fenster
                  </button>
                )}
              </div>
            </div>
          );
          const previewBody = (
            <div className="flex-1 min-h-0 flex flex-col">
              <PreviewPane quiz={applyPresetToQuiz(quiz, previewPreset)} selectedBlockId={selectedBlockId} onSelectBlock={setSelectedBlockId} dispatch={dispatch} editable={true} />
            </div>
          );
          if (popoutWin) {
            return (
              <>
                <PreviewPopout win={popoutWin} title={previewTitle} onClose={() => setPopoutWin(null)}>
                  {previewHeader}
                  {previewBody}
                </PreviewPopout>
                {/* Kleiner Hinweis-Pill im Hauptfenster, um die Vorschau zurückzuholen. */}
                <button onClick={closePreviewPopout}
                  className="absolute flex items-center gap-2 px-3.5 h-9 text-[12.5px] font-medium text-stone-700 transition-colors hover:bg-white"
                  style={{
                    bottom: 20, right: 20,
                    background: "rgba(255,255,255,0.85)",
                    backdropFilter: "saturate(180%) blur(24px)",
                    WebkitBackdropFilter: "saturate(180%) blur(24px)",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 99,
                    boxShadow: "0 8px 16px -8px rgba(0,0,0,0.2)"
                  }}>
                  <Eye className="w-4 h-4" /> Vorschau zurückholen
                </button>
              </>
            );
          }
          return (
            <div className="absolute overflow-hidden flex flex-col"
              style={{
                bottom: 20, right: 20,
                width: "38vw", height: "52vh", minWidth: 420, minHeight: 320,
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "saturate(180%) blur(24px)",
                WebkitBackdropFilter: "saturate(180%) blur(24px)",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 16,
                boxShadow: "0 24px 48px -16px rgba(0,0,0,0.25), 0 8px 16px -8px rgba(0,0,0,0.1)"
              }}>
              {previewHeader}
              {previewBody}
            </div>
          );
        })()}
      </div>

      {/* Auswähler, wenn die importierte .docx mehrere Quizze enthält. */}
      {parsedQuizzesPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
          onClick={() => setParsedQuizzesPicker(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-semibold text-stone-900 mb-1">Quizze importieren</div>
            <div className="text-[12.5px] text-stone-500 mb-3">
              {parsedQuizzesPicker.length} Quizze in der Datei gefunden. Wähle einen einzelnen Eintrag aus, oder importiere alle auf einmal als Sammlung.
            </div>
            <button
              onClick={() => { handleImportAllAsCollection(parsedQuizzesPicker); setParsedQuizzesPicker(null); }}
              className="w-full h-10 mb-3 rounded-lg text-white font-medium text-[13.5px] flex items-center justify-center gap-2 transition-colors"
              style={{ background: "#0071e3" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#0077ed")}
              onMouseLeave={e => (e.currentTarget.style.background = "#0071e3")}>
              <Package className="w-4 h-4" />
              Alle {parsedQuizzesPicker.length} als Sammlung importieren
            </button>
            <div className="text-[11px] text-stone-400 uppercase tracking-wider mb-2 px-1">Einzeln</div>
            <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1">
              {parsedQuizzesPicker.map((q, i) => (
                <button key={i}
                  onClick={() => { dispatch({ type: "APPLY_IMPORTED_QUIZ", payload: q }); setParsedQuizzesPicker(null); }}
                  className="w-full text-left p-3 rounded-lg hover:bg-sky-50 transition-colors"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }}>
                  <div className="text-[13.5px] font-medium text-stone-900">{q.topic || `Quiz ${i + 1}`}</div>
                  <div className="text-[11.5px] text-stone-500 truncate mt-0.5">
                    {(q.questions[0]?.text || "—")}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setParsedQuizzesPicker(null)}
              className="mt-3 h-9 text-[13px] rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Versteckter Render-Target für PDF/Publish (unverändert). */}
      <div style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }} aria-hidden>
        {(() => {
          const renderQuiz = publishingQuiz || quiz;
          const fmt = getQuizSize(renderQuiz.layout);
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
