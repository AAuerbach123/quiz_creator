import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

// Analysiert eine hochgeladene Verlags-Vorlage (Beispielanzeige als PDF oder
// Bild) mit Claude Vision und extrahiert Gestaltungsmerkmale: Farben, Schrift-
// Anmutung, Anzeigengröße, Logo-Position und Layout-Variante. Das Frontend
// baut daraus ein VerlagsPreset ("Eigene Vorlagen").

// Lazy init — gleiche Begründung wie in generate-quiz/route.ts: Env ist beim
// Module-Load unter Turbopack nicht garantiert gesetzt.
let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt. Lege ihn in .env.local an und starte den Dev-Server neu (npm run dev).");
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// Schriften, die in globals.css tatsächlich eingebunden sind — die KI muss
// eine davon als nächstliegende Entsprechung wählen (Mapping wie FONT_MAP
// in lib/verlage.ts).
const AVAILABLE_FONTS = [
  "Museo Sans", "MuseoSansCyrl-900", "Myriad Pro", "Utopia Std", "Tabac Sans",
  "Roboto Condensed", "Roboto", "Montserrat", "Lexend", "Georgia",
];

const ANALYZE_PROMPT = `Du bist Art-Director und analysierst die Beispielanzeige eines deutschen Zeitungsverlags
(Gewinnspiel-/Quiz-Anzeige). Extrahiere die Gestaltungsmerkmale für ein Design-Preset.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Markdown, ohne Erklärtext davor/danach:

{
  "verlag": "Name des Verlags/der Zeitung, falls erkennbar (z. B. aus Logo/Impressum), sonst leer",
  "titel": "Name der Zeitung, falls erkennbar, sonst leer",
  "colors": {
    "title": "#RRGGBB — Farbe der Haupt-Headline",
    "question": "#RRGGBB — Farbe der Fragetexte (meist dunkel)",
    "intro": "#RRGGBB — Farbe von Untertitel/Einleitung",
    "prize": "#RRGGBB — Farbe der Geldbeträge/Preise",
    "phone": "#RRGGBB — Farbe der Telefonnummern",
    "winners": "#RRGGBB — Farbe des Gewinner-Textes",
    "terms": "#RRGGBB — Farbe des Kleingedruckten"
  },
  "fontRaw": "Beschreibung der dominanten Schrift, wie ein Typograf sie benennen würde",
  "fontSuggestion": "GENAU EINE aus dieser Liste (nächstliegende Entsprechung): ${AVAILABLE_FONTS.join(", ")}",
  "format": "Anzeigengröße in mm als 'BREITExHÖHE' (z. B. '315x220'), nur wenn ablesbar/abschätzbar, sonst leer",
  "logoPosition": "Position des Zeitungslogos: 'links oben', 'rechts oben', 'links unten', 'rechts unten' oder 'n/a'",
  "layoutVariant": "GENAU EINE der drei Varianten: 'redaktionell' = mehrspaltiger Zeitungsaufbau mit zentrierter Headline oben, redaktioneller Textspalte links, Bildern in der Mitte, Fragenspalte daneben und separater Gewinner-Spalte rechts (oft mit ANZEIGE-Kennzeichnung); 'querformat' = 2 Spalten, Titel/Story/Gewinner links, Bilder + Fragen rechts; 'beilage' = klassisch, Gewinner oben, Bilder links, Fragetabelle rechts",
  "texts": {
    "subtitle": "Untertitel / Einleitungs- / Story-Text unter der Headline, wörtlich",
    "howTo": "Mitmach-Erklärung ('So geht's', Teilnahme-Schritte), wörtlich",
    "stoerer": "Text im runden Störer/Badge (kurz, z. B. 'Täglich 5 Geldpreise gewinnen!')",
    "winners": "Gewinner-Ankündigungs-/Vorstellungstext (NICHT die einzelnen Gewinnernamen)",
    "terms": "Teilnahmebedingungen / Kleingedrucktes, wörtlich und vollständig",
    "phoneTerms": "kleiner Hinweis unter/bei den Telefonnummern (z. B. Kosten pro Anruf)",
    "solutionWords": "Lösungswörter vom Vortag, falls abgedruckt"
  },
  "unmappedElements": ["Text- oder Inhaltselemente der Vorlage, die in KEINES der obigen Felder passen — je Eintrag kurz benennen und den Inhalt wörtlich mitgeben"],
  "confidence": "kurzer deutscher Hinweis, welche Angaben sicher und welche geschätzt sind"
}

Regeln:
- Farben als 6-stellige Hex-Werte. Wenn ein Element nicht vorkommt, wähle eine
  zur Palette passende, gut lesbare Farbe (Kleingedrucktes/Fragen dunkel).
- Achte auf die CI-Hauptfarbe der Zeitung (Logo, Balken, Störer) — sie sollte
  sich in title/prize/phone wiederfinden, wenn die Vorlage das so nutzt.
- WICHTIG: Die Quiz-Fragen, Antworten, Preisbeträge (50€–1000€) und die
  Telefonnummern je Frage NICHT extrahieren — die kommen aus der Datenbank.
  Sie gehören weder in "texts" noch in "unmappedElements".
- Ebenfalls NICHT extrahieren: die Haupt-Headline der Anzeige und die
  Überschrift über der Fragenliste — beide werden im Tool automatisch
  generiert (mit Gewinnsumme bzw. Themenbezug) und dürfen nicht aus der
  Vorlage übernommen werden. Auch nicht in "unmappedElements" aufführen.
- Einzelne Gewinnernamen und Gewinner-Portraitfotos gehören NICHT in
  "unmappedElements" — dafür gibt es im Tool eine eigene Gewinner-Verwaltung
  (5 Plätze mit Foto und Text).
- "solutionWords": nur die Lösungswörter/Antworten selbst, OHNE die
  Überschrift ("Auflösung der letzten Ausgabe/Folge" o. ä.).
- Text-Felder leer lassen ("") wenn das Element in der Vorlage nicht vorkommt.
  Nichts erfinden, nichts umformulieren — wörtlich übernehmen.
- Keine Phantasie-Verlagsnamen: lieber leer lassen als raten.`;

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Keine Datei erhalten." }, { status: 400 });
    }
    const MAX_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Datei größer als 20 MB." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const b64 = buf.toString("base64");
    const mime = file.type || "application/octet-stream";

    const isPdf = mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime);
    if (!isPdf && !isImage) {
      return NextResponse.json({ error: `Nicht unterstützter Dateityp: ${mime}. Bitte PDF, PNG oder JPG hochladen.` }, { status: 400 });
    }

    const mediaBlock = isPdf
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: b64 } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: mime as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: b64 } };

    const msg = await client().messages.create({
      model: "claude-sonnet-4-5",
      // Teilnahmebedingungen können lang sein — genug Platz für wörtliche Texte.
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: [mediaBlock, { type: "text", text: ANALYZE_PROMPT }],
      }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("\n");

    // JSON robust herausziehen (falls das Modell doch Text drumherum setzt).
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "KI-Antwort enthielt kein JSON.", raw: text }, { status: 502 });
    }
    const analysis = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ analysis });
  } catch (e) {
    console.error("analyze-template fehlgeschlagen:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
