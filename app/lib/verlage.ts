// Verlags-Vorlagen: Typ + Parser, der eine hochgeladene Excel/ODS in Presets
// umwandelt. Quelle ist das Blatt mit den Gestaltungs-Spalten (Headline Schrift,
// Headline Farbe, …). Die Schrift wird auf die in globals.css eingebundenen
// Web-Font-Familien gemappt; Farben (CMYK oder Hex) werden zu Hex konvertiert.

import * as XLSX from "xlsx";

export type VerlagsPreset = {
  id: string;
  gruppe: string;
  verlag: string;
  titel: string;
  titelKanonisch?: string;
  fontFamily: string;      // fertiger CSS-Wert, z. B. "'Myriad Pro', sans-serif"
  fontAvailable: boolean;  // false, wenn keine Web-Font-Datei vorhanden
  fontRaw: string;         // Originaltext aus der Excel
  colors: {
    title: string; question: string; intro: string;
    prize: string; phone: string; winners: string; terms: string;
  };
  format: string;
  logoPosition: string;
  // Optionaler Pfad / URL zum Zeitungslogo (browser-renderbares Format).
  logoUrl?: string | null;
  // Optionale Layout-Variante (aus KI-Analyse einer hochgeladenen Vorlage).
  // Wenn gesetzt, schaltet applyPresetToQuiz die Renderer-Variante um.
  layoutVariant?: "beilage" | "querformat" | "redaktionell" | "rhein" | "swp";
  // Optionale Vorlagen-Texte (aus KI-Analyse). Wenn gesetzt, füllt
  // applyPresetToQuiz die entsprechenden meta-Felder. Titel und Fragen-
  // Überschrift sind bewusst NICHT enthalten (werden generiert).
  texts?: {
    subtitle?: string;
    howToText?: string;
    winnersText?: string;
    termsText?: string;
    phoneTermsText?: string;
    solutionWords?: string;
  };
  // "ohne Gewinner"-Variante: blendet beim Anwenden/Vorschauen die Gewinner-Spalte
  // aus (winnerCount → 0), das redaktionelle Layout verbreitert dann die Fragen.
  hideWinners?: boolean;
  // Verlags-Hotline (0137x) pro Frage 1–5. Wenn gesetzt, setzt applyPresetToQuiz
  // diese Rufnummern auf die fünf Fragen — so ist die Hotline an die Verlagswahl
  // gekoppelt (eine Auswahl = Design + 0800 in den TNB + 0137 pro Frage).
  phoneNumbers?: string[];
};

// Präfix (normalisiert) -> [CSS-Familie, generisch, verfügbar?]
// "Verfügbar" heißt: Web-Font ist eingebunden (lokal in public/fonts oder
// per Google Fonts CDN). Proxima Nova ist lizenzpflichtig und wird durch
// Montserrat ersetzt – das ist die naheliegendste freie Alternative.
const FONT_MAP: [string, [string, string, boolean]][] = [
  ["museosanscyrl", ["MuseoSansCyrl-900", "sans-serif", true]],
  ["museo sans", ["Museo Sans", "sans-serif", true]],
  ["myriad pro", ["Myriad Pro", "sans-serif", true]],
  ["utopia", ["Utopia Std", "serif", true]],
  ["tabac sans", ["Tabac Sans", "sans-serif", true]],
  ["roboto condensed", ["Roboto Condensed", "sans-serif", true]],
  ["roboto", ["Roboto", "sans-serif", true]],
  ["proxima nova", ["Montserrat", "sans-serif", true]],
  ["lexend", ["Lexend", "sans-serif", true]],
];

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export function mapFont(raw: string): { css: string; available: boolean } {
  const n = norm(raw);
  if (!n) return { css: "Helvetica, Arial, sans-serif", available: true };
  for (const [pref, [fam, gen, av]] of FONT_MAP) {
    if (n.startsWith(pref)) return { css: `'${fam}', ${gen}`, available: av };
  }
  return { css: `'${raw}', sans-serif`, available: false };
}

function cmykToHex(c: number, m: number, y: number, k: number): string {
  const f = (v: number) => v / 100;
  const r = Math.round(255 * (1 - f(c)) * (1 - f(k)));
  const g = Math.round(255 * (1 - f(m)) * (1 - f(k)));
  const b = Math.round(255 * (1 - f(y)) * (1 - f(k)));
  const h = (v: number) => v.toString(16).padStart(2, "0").toUpperCase();
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function parseColor(s: unknown, fallback = "#1A1A1A"): string {
  const str = String(s ?? "").trim();
  if (!str) return fallback;
  const hex = str.match(/^#([0-9A-Fa-f]{6})$/);
  if (hex) return `#${hex[1].toUpperCase()}`;
  // CMYK kann als "C0 M0 Y0 K100" ODER als "100C 0M 100Y 20K" geschrieben
  // sein. Buchstabe direkt am Wert — KEIN \s* zwischen Zahl und Buchstabe.
  // Andernfalls würde z. B. die "0" aus "Y0" über das Leerzeichen hinweg
  // dem nachfolgenden "K" zugeordnet, und aus "C0 M0 Y0 K100" würde
  // fälschlich Weiß statt Schwarz.
  const vals: Record<string, number> = {};
  for (const m of str.matchAll(/([CMYKcmyk])(\d+(?:[.,]\d+)?)/g)) {
    vals[m[1].toUpperCase()] = parseFloat(m[2].replace(",", "."));
  }
  for (const m of str.matchAll(/(\d+(?:[.,]\d+)?)([CMYKcmyk])/g)) {
    const key = m[2].toUpperCase();
    if (vals[key] === undefined) vals[key] = parseFloat(m[1].replace(",", "."));
  }
  if (["C", "M", "Y", "K"].some(k => k in vals)) {
    return cmykToHex(vals.C ?? 0, vals.M ?? 0, vals.Y ?? 0, vals.K ?? 0);
  }
  return fallback;
}

// ---- Eigene Vorlagen (per KI aus Upload analysiert) ------------------------
// Werden in localStorage gehalten und in der Verlagsliste mit den Presets aus
// verlage-presets.json gemergt. Änderungen feuern ein Window-Event, damit die
// Liste sich live aktualisiert.

export const CUSTOM_PRESETS_KEY = "wq.customPresets";
export const CUSTOM_PRESETS_EVENT = "wq:customPresetsChanged";

export function loadCustomPresets(): VerlagsPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    const list = raw ? (JSON.parse(raw) as VerlagsPreset[]) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function saveCustomPreset(p: VerlagsPreset): void {
  if (typeof window === "undefined") return;
  const list = loadCustomPresets().filter(x => x.id !== p.id);
  list.push(p);
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(CUSTOM_PRESETS_EVENT));
}

export function removeCustomPreset(id: string): void {
  if (typeof window === "undefined") return;
  const list = loadCustomPresets().filter(x => x.id !== id);
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(CUSTOM_PRESETS_EVENT));
}

// ---- Gruppen-Overrides (KI-analysierte Vorlage pro Verlagsgruppe) ----------
// Eine hochgeladene CI-Vorlage wird EINER Verlagsgruppe zugeordnet und über-
// schreibt für alle Titel dieser Gruppe Farben, Schrift und Layout-Variante.
// Titel-spezifisches (Logo, Anzeigengröße, Hotline) bleibt unangetastet.

export type GroupOverride = {
  // Wenn nicht gesetzt, bleiben die Farben aus der Datenbank (Preset) aktiv.
  colors?: VerlagsPreset["colors"];
  // Wenn nicht gesetzt, bleibt die Schrift aus der Datenbank (Preset) aktiv.
  fontFamily?: string;
  fontAvailable?: boolean;
  fontRaw?: string;
  layoutVariant?: "beilage" | "querformat" | "redaktionell" | "rhein" | "swp";
  // Dateiname/Titel der analysierten Vorlage — für die Anzeige in der Liste.
  sourceName?: string;
};

export const GROUP_OVERRIDES_KEY = "wq.groupOverrides";
export const GROUP_OVERRIDES_EVENT = "wq:groupOverridesChanged";

export function loadGroupOverrides(): Record<string, GroupOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(GROUP_OVERRIDES_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch { return {}; }
}

export function saveGroupOverride(group: string, ov: GroupOverride): void {
  if (typeof window === "undefined") return;
  const all = loadGroupOverrides();
  all[group] = ov;
  localStorage.setItem(GROUP_OVERRIDES_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(GROUP_OVERRIDES_EVENT));
}

export function removeGroupOverride(group: string): void {
  if (typeof window === "undefined") return;
  const all = loadGroupOverrides();
  delete all[group];
  localStorage.setItem(GROUP_OVERRIDES_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(GROUP_OVERRIDES_EVENT));
}

// Wendet einen evtl. vorhandenen Gruppen-Override auf ein Preset an.
// Schlüssel ist preset.verlag (die Verlagsgruppe in diesem Datenmodell).
// Nur die im Override vorhandenen Teile werden ersetzt — fehlt z. B.
// `colors`, bleiben die Datenbank-Farben des Presets aktiv.
export function applyGroupOverride(p: VerlagsPreset, overrides: Record<string, GroupOverride>): VerlagsPreset {
  const ov = overrides[p.verlag];
  if (!ov) return p;
  return {
    ...p,
    ...(ov.colors ? { colors: { ...p.colors, ...ov.colors } } : {}),
    ...(ov.fontFamily ? {
      fontFamily: ov.fontFamily,
      fontAvailable: ov.fontAvailable ?? p.fontAvailable,
      fontRaw: ov.fontRaw ?? p.fontRaw,
    } : {}),
    ...(ov.layoutVariant ? { layoutVariant: ov.layoutVariant } : {}),
  };
}

// Findet in einer Header-Zeile den Spaltenindex per Teilstring (case-insensitive).
function colIndex(header: string[], ...needles: string[]): number {
  for (let i = 0; i < header.length; i++) {
    const h = norm(header[i]);
    if (needles.some(n => h.includes(norm(n)))) return i;
  }
  return -1;
}

export function parseVerlageWorkbook(data: ArrayBuffer | Uint8Array): VerlagsPreset[] {
  const wb = XLSX.read(data, { type: "array" });
  const readRows = (name: string) =>
    XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, blankrows: false, defval: "" }) as string[][];
  const hasHeadline = (rows: string[][]) =>
    rows.length > 0 && colIndex((rows[0] as string[]).map(c => String(c ?? "")), "headline schrift", "headline") >= 0;

  // 1. Wahl: Blatt, dessen Name "gestaltung" enthält und Gestaltungsspalten hat.
  // 2. Wahl: erstes Blatt mit einer "Headline Schrift"-Spalte.
  let chosen: string[][] | null = null;
  for (const name of wb.SheetNames) {
    if (norm(name).includes("gestaltung")) {
      const rows = readRows(name);
      if (hasHeadline(rows)) { chosen = rows; break; }
    }
  }
  if (!chosen) {
    for (const name of wb.SheetNames) {
      const rows = readRows(name);
      if (hasHeadline(rows)) { chosen = rows; break; }
    }
  }
  if (!chosen) return [];

  const header = chosen[0].map(c => String(c ?? ""));
  const iVerlag = colIndex(header, "verlag");
  const iTitel = colIndex(header, "titel");
  const iGruppe = colIndex(header, "gruppe");
  const iHlS = colIndex(header, "headline schrift", "headline");
  const iTxS = colIndex(header, "text schrift");
  const iHlF = colIndex(header, "headline farbe");
  const iSlF = colIndex(header, "subline farbe", "sublie farbe");
  const iTxF = colIndex(header, "text farbe");
  const iStF = colIndex(header, "störer farbe", "stoerer farbe");
  const iSize = colIndex(header, "anzeigengröße", "anzeigengroesse", "format");
  const iLogo = colIndex(header, "logo-position", "logo position");

  const get = (row: string[], idx: number) => (idx >= 0 ? String(row[idx] ?? "").trim() : "");
  const presets: VerlagsPreset[] = [];
  for (let r = 1; r < chosen.length; r++) {
    const row = chosen[r];
    const verlag = get(row, iVerlag);
    const titel = get(row, iTitel);
    if (!verlag && !titel) continue;
    const raw = get(row, iHlS) || get(row, iTxS);
    const { css, available } = mapFont(raw);
    const head = parseColor(get(row, iHlF));
    const sub = parseColor(get(row, iSlF));
    const txt = parseColor(get(row, iTxF));
    const stoer = parseColor(get(row, iStF));
    presets.push({
      id: `${verlag}__${titel}`,
      gruppe: get(row, iGruppe),
      verlag, titel,
      fontFamily: css, fontAvailable: available, fontRaw: raw,
      colors: { title: head, question: head, intro: sub, prize: stoer, phone: stoer, winners: txt, terms: txt },
      format: get(row, iSize),
      logoPosition: get(row, iLogo),
    });
  }
  return presets;
}
