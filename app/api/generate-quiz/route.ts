import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_TEXT_STYLE = `Schreibe in einem freundlichen, einladenden Ton, der typisch für deutsche Lokal-Zeitungen ist.
Bleibe bei Sie-Form. Vermeide Anglizismen. Fragen kurz und prägnant, max. 8 Wörter.

Theme-Farben (titleColor, prizeColor, questionColor) müssen nach WCAG 2.1 Level AA lesbar sein,
idealerweise AAA. Statt reinem Schwarz #000000 dunkles Grau wie #1A1A1A verwenden.
Keine direkten Rot/Grün-Komplementärkontraste (Protanopie/Deuteranopie). Keine grellen
Komplementär-Kombinationen wie Blau auf Orange. Sättigung moderat, nicht vibrierend.

Wichtig: titleColor und questionColor sollen HELL sein, weil der Text auf einem
fotografischen Hintergrund mit Verdunkelung sitzt. prizeColor darf akzentuiert sein.`;

type Difficulty = "easy" | "medium" | "hard";

const buildDifficultyInstructions = (topic: string): Record<Difficulty, string> => ({
  easy: `SCHWIERIGKEITSGRAD: LEICHT

WICHTIG: Der Schwierigkeitsgrad bezieht sich auf den durchschnittlichen
deutschen Erwachsenen — NICHT auf Themen-Experten oder Lokalkenner.
Auch wenn das Thema "${topic}" speziell ist, müssen die Fragen für
Otto-Normalbürger beantwortbar sein.

TEST FÜR JEDE FRAGE: Würde ein durchschnittlicher Erwachsener in
Deutschland ohne Vorbereitung und ohne Wikipedia diese Frage
beantworten können? Wenn nein → Frage ist zu schwer für LEICHT.

ERLAUBT auf LEICHT:
- Allgemeinwissen, das praktisch jeder kennt:
  Hauptstädte, Bundesländer, größte Flüsse/Berge/Seen, Flaggenfarben
- Ikonische, weltbekannte Sehenswürdigkeiten:
  Brandenburger Tor, Kölner Dom, Neuschwanstein, Eiffelturm
- Sehr prominente Personen:
  amtierende Bundeskanzler, weltberühmte Künstler/Komponisten
- Eckdaten, die in jedem Schulbuch stehen:
  Mauerfall 1989, Wiedervereinigung, Fußball-WM-Titel-Jahre

VERBOTEN auf LEICHT:
- Lokalkenntnisse, die nur Anwohner oder Touristen einer Region wissen
- Namen von kleineren Burgen, Hallen, Akademien, Stiftungen, Kirchen,
  Plätzen, Straßen, Hotels, Restaurants
- Architekten, Gründer, Komponisten jenseits der Top-Bekannten
- Spezifische Jahreszahlen außer den ikonischen
- Fachbegriffe, die nicht im Mainstream-Vokabular sind

BEISPIELE GUTER LEICHT-FRAGEN (Thema "Hamburg"):
- "Welcher deutsche Hafen ist der größte?" → Hamburg
- "An welchem Fluss liegt Hamburg?" → Elbe
- "Welcher See liegt mitten in Hamburg?" → Alster

BEISPIELE SCHLECHTER LEICHT-FRAGEN (zu schwer, NICHT generieren):
- "Welche Halle steht am östlichen Binnenalsterufer?"   ← zu lokal
- "Welche Akademie hat ihren Sitz in Tutzing?"          ← Spezialwissen
- "Wie heißt die berühmteste Pfälzer Burgruine?"        ← Lokalkenntnis
- "Wer entwarf das Chilehaus?"                          ← Detail-Fakt

STEIGERUNG INNERHALB LEICHT — STRENG EINHALTEN:
Die 5 Fragen haben steigendes Preisgeld (50€ → 1000€). Bei LEICHT
bleibt jede Frage — auch die 1000€-Frage — im Allgemeinwissens-
Bereich. Die Steigerung erfolgt durch weniger bekannte Allgemein-
wissens-Fakten, NICHT durch Abrutschen in Lokal- oder Spezialwissen.

BEISPIELE STEIGERUNG (Thema "Hamburg"):
- 50€:   "Liegt Hamburg an der Nordsee oder Ostsee?"     (trivial)
- 1000€: "An welche zwei Bundesländer grenzt Hamburg?"   (leicht aber
         nicht trivial — bleibt Allgemeinwissen)

VERBOTEN AUF 1000€ BEI LEICHT:
- "Wer war der erste Bürgermeister Hamburgs nach dem Krieg?"
  ← zu speziell, gehört auf SCHWER, NICHT auf LEICHT

UMGANG MIT NISCHEN-THEMEN:
Wenn das Thema "${topic}" so speziell ist, dass es kaum LEICHT-Fragen
hergibt, dann nutze verwandte Allgemeinwissen-Fragen mit Themen-Bezug
(Bundesland, Region, Fluss, Epoche, übergeordnete Kategorie) statt
in Themen-Detailwissen abzurutschen.

UMGANG MIT ABSTRAKTEN THEMEN (Sprichwörter, Redewendungen, Begriffe,
Philosophie-Konzepte, Zitate):
Bei abstrakten Themen fehlt der geographische oder faktische Anker.
Die KI rutscht hier besonders leicht in Spezialwissen (Etymologie,
Autoren-Zuschreibung, literarische Herkunft). Das ist auf LEICHT
verboten — auch nicht auf der 1000€-Frage.

ERLAUBT bei abstrakten Themen auf LEICHT:
- Lückentext-Fragen, die das Sprichwort/Zitat selbst kennen lassen:
  "Wie geht das Sprichwort weiter: 'Steter Tropfen höhlt den ___'?"
  → Stein
- Element-Identifikation innerhalb des Sprichworts mit Multiple Choice:
  "Welches Element kommt im Sprichwort vor: Wasser, Feuer oder Erde?"
  → Wasser
- Anwendungs-Kontext mit klarer Trennung der Optionen:
  "In welcher Situation passt das Sprichwort: schneller Erfolg oder
  langer Atem?" → langer Atem
- Bedeutungsfragen NUR als Multiple-Choice mit semantisch klar
  unterscheidbaren Optionen:
  "Bedeutet das Sprichwort, dass man aufgeben oder weitermachen soll?"
  → weitermachen

VERBOTEN bei abstrakten Themen auf LEICHT (auch nicht auf 1000€):
- "Welcher Autor/Dichter/Philosoph hat das Sprichwort geprägt?"
  ← Spezialwissen, gehört auf SCHWER
- "Aus welcher Sprache stammt das Sprichwort ursprünglich?"
  ← Etymologie, Spezialwissen
- "In welchem Jahrhundert wurde das Sprichwort erstmals belegt?"
  ← Detail-Fakt, Spezialwissen
- Offene Bedeutungsfragen mit mehreren Synonym-Antworten:
  "Welche Tugend beschreibt das Sprichwort?"
  ← Geduld/Beharrlichkeit/Ausdauer alle valide → mehrdeutig
- Offene Definitionsfragen:
  "Welches Wort bedeutet langsam und beständig?"
  ← viele Synonyme valide → mehrdeutig`,

  medium: `SCHWIERIGKEITSGRAD: MITTEL

Zielgruppe: Erwachsene mit gymnasialer Bildung, die regelmäßig
Tageszeitung lesen oder Bildungs-Medien (ARD-Wissen, Spiegel, GEO)
konsumieren.

TEST: Würde dies in einem Schulbuch, einer Reportage oder einem
Wissens-Magazin zum Thema vorkommen?

ERLAUBT auf MITTEL:
- Bildungswissen: historische Eckdaten, kulturelle Höhepunkte
- Mittelbekannte Bauwerke, Personen, Begriffe (nicht Top-3, aber
  in Reportagen erwähnt)
- Gängige Fachbegriffe, die in Bildungsmedien erklärt werden
- Geografische Fakten zweiter Reihe: zweitgrößte Stadt, zweithöchster
  Berg, größter Nebenfluss

BEISPIELE (Thema "Hamburg"):
- "Wie nennt man Hamburgs Rotlichtviertel?" → Reeperbahn
- "Welche Alster ist größer, Außen- oder Binnenalster?" → Außen
- "Wie heißt das berühmte Konzerthaus im Hamburger Hafen?" → Elbphilharmonie

VERBOTEN auf MITTEL:
- Pure Allgemeinplätze, die jeder weiß (gehört auf LEICHT)
- Insider-Detail-Fakten, exakte Jahreszahlen kleiner Ereignisse,
  Namen kaum bekannter Personen (gehört auf SCHWER)`,

  hard: `SCHWIERIGKEITSGRAD: SCHWER

Zielgruppe: Themenkenner, lokale Experten, ambitionierte Quizfreunde,
Hobby-Historiker.

ERLAUBT auf SCHWER:
- Lokalkenntnisse, Detail-Fakten, exakte Namen kleinerer
  Orte/Personen/Bauwerke
- Spezifische Jahreszahlen, Architekten, Gründer, Stifter
- Fachbegriffe, Insider-Wissen
- Multiple-Choice-Optionen plausibel und nahe beieinander

BEISPIELE (Thema "Hamburg"):
- "Welche Halle steht am östlichen Binnenalsterufer?" → Laeiszhalle
- "Wer entwarf das Chilehaus?" → Fritz Höger
- "In welchem Jahr wütete der Große Hamburger Brand?" → 1842

Höchste Frage soll auch Insider zum Nachschlagen bringen.`
});

export async function POST(req: Request) {
  try {
    const { topic, styleInstruction, difficulty } = await req.json();
    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Thema fehlt" }, { status: 400 });
    }

    const styleBlock = (styleInstruction && typeof styleInstruction === "string" && styleInstruction.trim())
      ? styleInstruction.trim()
      : DEFAULT_TEXT_STYLE;

    const diffKey: Difficulty = (difficulty === "easy" || difficulty === "medium" || difficulty === "hard")
      ? difficulty
      : "medium";
    const difficultyBlock = buildDifficultyInstructions(topic)[diffKey];

    const prompt = `Du generierst Inhalte für ein deutsches Zeitungs-Wissensquiz zum Thema "${topic}".

STIL-VORGABEN (zwingend einhalten):
${styleBlock}

${difficultyBlock}

INHALT-VORGABEN:
- Einen Intro-Text (2 kurze Sätze, erklärt dass der Leser mitmachen und täglich bis zu 1000€ gewinnen kann).
- 5 Fragen mit steigender Schwierigkeit/Preisgeld zum Thema "${topic}".

FORMAT DER HEADLINE — STRENG EINHALTEN:
- "headline" ist eine kurze, prägnante Schlagzeile zum Thema des Quiz.
- MAXIMAL 6 Wörter, MAXIMAL 35 Zeichen inkl. Leerzeichen.
- Ist KEINE Frage, sondern eine thematische Überschrift.
- Beispiele: "Hamburgs schöne Binnenalster", "Münchens Wahrzeichen", "Bremer Stadtmusikanten", "Welcher Bayernkönig?"
- Falsch: "Welches Hotel steht am Jungfernstieg in Hamburg?" (zu lang, ist Frage)
- Falsch: "Test Ihres Wissens über Hamburg" (zu generisch, kein Thema-Bezug)

FORMAT JEDER FRAGE — STRENG EINHALTEN:
- Jede Frage MUSS ein vollständiger, grammatikalisch korrekter Fragesatz sein.
- Kein Fragment, kein abgeschnittener Satz, keine "Headline"-artige Verkürzung.
- Maximal 8 Wörter pro Frage.

EINDEUTIGKEIT DER ANTWORTEN — ABSOLUT KRITISCH:
- Jede Frage MUSS exakt EINE objektiv richtige Antwort haben (Fakt, kein Meinung).
- Verboten sind subjektive Bewertungen wie "beste", "wichtigste", "schönste", "bekannteste".
- Verboten sind offene Fragen mit mehreren möglichen Lösungen wie "Welche Eigenschaft ist hier besonders wichtig?" (mehrere richtige Antworten möglich).
- SYNONYM-FALLE — KRITISCH BEI ABSTRAKTEN THEMEN: Wenn die Frage nach Bedeutung, Tugend, Eigenschaft, Gefühl oder abstraktem Konzept fragt und mehrere Synonyme als Antwort denkbar sind, ist die Frage als FREITEXT VERBOTEN.
  Unzulässig:
  - "Welche Tugend beschreibt das Sprichwort?" → Geduld, Beharrlichkeit, Ausdauer alle valide → mehrdeutig
  - "Welches Wort bedeutet langsam und beständig?" → viele Synonyme valide
  Lösung: Entweder als Multiple-Choice mit semantisch DEUTLICH UNTERSCHIEDLICHEN Optionen formulieren ("Geduld oder Hektik?"), oder so umbauen, dass die Antwort wörtlich im Quelltext (Sprichwort, Zitat, Begriff) vorkommt ("Welches Wort steht vor 'höhlt' im Sprichwort?" → Tropfen).
- Verboten sind unscharfe Mengenangaben wie "etwa", "ungefähr", "rund" wenn die genaue Zahl nicht eindeutig festliegt.
- ERLAUBT: Faktenfragen mit präzisen, prüfbaren Antworten:
  - Jahr ("In welchem Jahr fiel die Berliner Mauer?" → 1989)
  - Name ("Wer komponierte die Zauberflöte?" → Mozart)
  - Ort ("Welcher Fluss fließt durch Berlin?" → Spree)
  - Anzahl ("Wie viele Bundesländer hat Deutschland?" → 16)
  - Zuordnung ("In welchem Bundesland liegt München?" → Bayern)
- Bei Multiple-Choice (Frage 1) darf nur EINE Option richtig sein, alle anderen müssen klar falsch sein.

BEISPIELE FÜR KORREKTE FRAGEN:
- Beispiele für korrekte Fragen:
  - "Wer gründete München?"
  - "Welcher Fluss fließt durch Berlin?"
  - "Wie heißt der höchste Berg?"
  - "In welchem Jahr fiel die Berliner Mauer?"
  - "Liegt München südlich von Berlin?"
- Falsch (NICHT generieren): "Welcher Monarch gründete?" oder "Welcher Herzog gründete?" — Verb ohne Objekt ist unvollständig.

WEITERE VORGABEN:
- Die erste Frage ist eine Entscheidungsfrage mit genau 2 Optionen (answerType "choice").
- Fragen 2-5 sind Freitext (answerType "text").
- Eine Farbpalette aus 3 Farben (hex), die zum Thema passen UND die WCAG-Vorgaben erfüllen: titleColor, prizeColor, questionColor.
- Eine englische, sehr bildhafte Bildbeschreibung (imagePrompt) für ein EINZIGES kohärentes Hintergrundbild, das ALLE Themen aus "${topic}" in EINER zusammenhängenden Szene vereint. KEIN Split-Screen, KEIN Diptychon, KEINE Collage. Beschreibung erwähnt explizit volles Tageslicht und klaren Sonnenschein.
- PERSÖNLICHKEITSRECHT — ABSOLUT KRITISCH: Die imagePrompt darf KEINE real existierenden Personen namentlich nennen oder eindeutig identifizierend beschreiben (kein "with the iconic features of [Name]", kein "resembling [Name]", kein "in the famous pose of [Name]", keine Beschreibung markanter Frisuren/Bärte/Brillen historisch verbürgter Personen). Das gilt für lebende UND verstorbene Personen (postmortales Persönlichkeitsrecht nach KUG §22). Bei Personen-zentrierten Themen (Sportler, Politiker, Künstler, Adelige, historische Persönlichkeiten) stattdessen anonyme oder symbolische Szenen beschreiben: generische Figuren in Trikots/Kostümen/Gewändern der Epoche, Stadion-Atmosphäre mit anonymer Menge, ikonische Trophäen oder Objekte ohne Person, historische Settings ohne erkennbare Gesichter, Crowd-Silhouetten von hinten, Schauplätze ohne Protagonisten.
- Eine Liste der erkannten Hauptthemen (topicElements) als Array.

Antworte AUSSCHLIESSLICH mit gültigem JSON in genau diesem Format, ohne Markdown-Code-Blöcke:

{
  "headline": "Kurze Schlagzeile",
  "subtitle": "...",
  "questions": [
    { "text": "Vollständiger Fragesatz?", "answerType": "choice", "options": ["A", "B"], "correctAnswer": "A" },
    { "text": "Vollständiger Fragesatz?", "answerType": "text", "correctAnswer": "..." },
    { "text": "Vollständiger Fragesatz?", "answerType": "text", "correctAnswer": "..." },
    { "text": "Vollständiger Fragesatz?", "answerType": "text", "correctAnswer": "..." },
    { "text": "Vollständiger Fragesatz?", "answerType": "text", "correctAnswer": "..." }
  ],
  "theme": { "titleColor": "#......", "prizeColor": "#......", "questionColor": "#......" },
  "imagePrompt": "...",
  "topicElements": ["...", "..."]
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .replace(/^```(?:json)?\s*|\s*```\s*$/g, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("JSON konnte nicht geparst werden");
      parsed = JSON.parse(m[0]);
    }

    return NextResponse.json(parsed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    console.error("generate-quiz error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
