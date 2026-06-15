# Wissensquiz Creator — Handover

## Projekt-Name
**Wissensquiz Creator** — Phase 3.11 (modern-screenshot Renderer)

## Tech-Stack
- **Framework:** Next.js 16.2.4 (App Router, React 19.2.4)
- **Sprache:** TypeScript 5
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/postcss`)
- **AI-SDKs:** `openai` (^6.34.0), `@anthropic-ai/sdk` (^0.91.1)
- **Rendering / Export:** `modern-screenshot` (Karten-Renderer), `jspdf` (PDF), `jszip` (ZIP-Publish)
- **Dokument-Parsing:** `mammoth` (DOCX → Quizfragen)
- **Icons:** `lucide-react`
- **Lint:** ESLint 9 mit `eslint-config-next`

## Kurzbeschreibung
Ein lokales Tool zum Erstellen, Bebildern und Veröffentlichen von Wissensquiz-Sammlungen. Der Nutzer
gibt Themen ein (einzeln oder als Bulk-Import), die App generiert über die OpenAI/Anthropic-APIs
Quizfragen samt Coverbildern, rendert die Karten per `modern-screenshot` und exportiert die fertige
Sammlung als HTML/PDF/ZIP-Paket. Die UI ist eine einzelne Client-Page (`app/page.tsx`) mit
serverseitigen Routen unter `app/api/` für Generierung und Import.

## Setup-Anweisungen
1. **Dependencies installieren**
   ```bash
   npm install
   ```
2. **`.env.local` anlegen** im Projekt-Root mit folgenden Variablen:
   ```
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   > Hinweis: Das `dev`-Script löscht bestehende `ANTHROPIC_*`-Shell-Variablen vor dem Start, damit
   > ausschließlich der Key aus `.env.local` verwendet wird (siehe `package.json`).
3. **Dev-Server starten**
   ```bash
   npm run dev
   ```
   Anschließend `http://localhost:3000` öffnen.

## Aktueller Phase-Marker (aus dem Code)
> `Wissensquiz Creator — Phase 3.11` &nbsp;·&nbsp; `modern-screenshot Renderer`
> (Quelle: `app/page.tsx:2754`)

## Neu: Spiel-Reiter in der Top-Bar
In der Kopfzeile gibt es einen Umschalter **"Wissensquiz" | "Geldregen"**.
"Geldregen" schaltet das Layout-Format auf `schatzsuche` (s. u.), "Wissensquiz" zurück
auf das zuvor aktive Standard-Format (gemerkt in Modul-Variable `lastWissensquizFormat`).
Daten (Fragen, Gewinner, Verlag) bleiben beim Umschalten erhalten — es wechselt nur der Renderer.

## Fotorealistische Truhen via OpenAI-Bild-API
`scripts/generate-chests.mjs` erzeugt je 12 **offene** und 12 **geschlossene** Truhen
(transparent freigestellt; offen mit überquellenden Euro-Scheinen, geschlossen im selben
Look) als `public/chests/chestNN.png` bzw. `chestNN_closed.png` – überschreibt die
mitgelieferten Vektor-Platzhalter.
- `npm run chests` → beide Zustände aller 12.
- `node scripts/generate-chests.mjs --closed` → nur geschlossene; `--open` → nur offene.
- `node scripts/generate-chests.mjs 3 7` → nur Motiv 3 und 7 (beide Zustände).
Nutzt `OPENAI_API_KEY` aus `.env.local`, Modellkette `gpt-image-2 → gpt-image-1.5 → gpt-image-1`,
1024×1024, `background:"transparent"`. Offen/geschlossen einer Nummer teilen sich die
Material-Beschreibung (gleicher Look). Banknoten bewusst „Euro-style" (EZB-Reproduktionsregeln).
Auswahl in der App: Geldregen → Bilder → „Schatztruhe" → Umschalter offen/geschlossen +
12er-Raster (`meta.chestId`, `meta.chestClosed`).

## Neu: Schatztruhen-Auswahl (Geldregen)
12 Truhen-Grafiken in `public/chests/chest01–12.png` (Vektor-gerendert, offen/halb offen,
mit Euroscheinen). Auswahl im Geldregen-Reiter unter **Bilder → "Schatztruhe"** (klickbares
4er-Raster, „keine“ = aus). Gespeichert in `meta.chestId` (0–12, Default 1). Der Renderer
zeigt die gewählte Truhe unten links unter der „So einfach geht’s“-Box.
Neu generieren/anpassen: `outputs/truhen.py` (Parameter `VARIANTS`).

## Neu: Geldregen-Einstellungen (Sidebar)
Im Geldregen-Modus (`quiz.layout.format === "schatzsuche"`) blendet `EditorPanel`
die Wissensquiz-spezifischen Sektionen aus (Lesbarkeit, Schriftgrößen, Frage-4/5-Bilder,
Galerie, Foto-Hintergrund, generische Fragen/Metadaten) und zeigt stattdessen
spielkonzept-gerechte Sektionen (Flag `isGeldregen`):
- **Inhalt → "Kopf & Texte"**: Kicker (`meta.geldregenKicker`), Titel, Untertitel,
  Spieltag-Nummer (`meta.spieltag`), Störer (`meta.stoererText`), Spielregeln
  (`meta.geldregenRules`, eine Zeile = ein Schritt), Telefon-Hinweis, Teilnahmebedingungen, Verlag.
- **Fragen → "Grabungsstellen (n/8)"**: `GeldregenStationEditor` pro Stelle —
  Frage, Antwort 1/2 (= `options[0]`/`[1]`), Stamm-Rufnummer, Gewinn-Stufe.
  Button "Auf 8 Grabungsstellen auffüllen".
- **Bilder → "Schatzkarte"**: Upload überschreibt die Standard-Karte
  (gespeichert in `theme.background.image`, vom Renderer als `mapSrc` genutzt).
- **Gewinner** heißt hier "Glückspilze (Gewinnerfotos)", sonst unverändert.
- **Preise / Verlag / Teilnahme** bleiben gemeinsam genutzt.
Neue optionale `meta`-Felder: `spieltag`, `geldregenKicker`, `geldregenRules`.

## Neu: Format "Schatzsuche" (Telefon-Gewinnspiel "Geldregen")
Neues Anzeigen-Format im Format-Dropdown (`schatzsuche`, fest 315×220 mm landscape).
Rendert die "Große Schatzsuche": Schatzkarte (`public/schatzinsel.png`) mit 8 nummerierten
Kreuzen, 8 Fragenboxen (je Frage 2 Antworten → Rufnummer + Endziffer 1/2), Gewinnstaffel
aus `prizes` (via `prizeTierId`), Glückspilz-Spalte aus `meta.winners`/`winnerCount`,
Störer aus `meta.stoererText`, Fußzeile aus `meta.termsText`/`phoneTermsText`.
- Renderer: `SchatzsucheRenderer` in `app/page.tsx` (vor `SchwedenraetselRenderer`),
  Konstanten mit `SZ_`-Präfix (Grabungsstellen-Koordinaten, Spielregeln-Texte).
- Dispatch: `PreviewRenderer` + `OverlayRenderer`; Größe in `FORMATS.schatzsuche`.
- Konvention: `Question.phoneNumber` = Stammnummer der Stelle, Endziffern "1"/"2"
  werden im Renderer angehängt. Erste 8 Fragen des Quiz werden verwendet;
  `options[0]`/`options[1]` sind die beiden Antworten (answerType "choice").
- Karte austauschbar: `public/schatzinsel.png` ersetzen (höhere Auflösung empfohlen,
  aktuelle Datei ist nur 348×350 px).

## Datei-Import (`app/api/import-quiz-document/`)
Unterstützte Formate: **DOCX** (`parsers/docx.ts`), **XLSX/XLSM/XLS** (`parsers/xlsx.ts`)
und **CSV/TSV** (`parsers/csv.ts`). Registry: `app/api/import-quiz-document/route.ts`.

Die zeilenbasierten Formate (XLSX, CSV/TSV) teilen sich die Layout-Erkennung in
`parsers/rows.ts` (`rowsToQuizzes`) — erkennt Layout A (ein Quiz je Blatt, Spalten
Frage/Antwort), Layout B (alles in einem Blatt: Thema | Frage 1 | Antwort 1 | …) und
Layout C (Frageblock ohne Header: Themen-Nr. Spalte A, Thema B, Frage C, Antwort D).
Der CSV-Parser erkennt das Trennzeichen (Semikolon/Komma/Tab) automatisch und versteht
Anführungszeichen-Felder samt verdoppelter Quotes und BOM.

Weitere Formate über die `QuizDocumentParser`-Schnittstelle (`parsers/types.ts`) ergänzen
und in der Registry eintragen; zeilenbasierte Formate können `rowsToQuizzes` wiederverwenden.

**CSV-Vorlage für die Redaktion:** `docs/vorlage-fragenkatalog.csv` — eine Zeile = ein
Quiz, Spalten `Thema | Frage 1 | Antwort 1 | … | Frage 5 | Antwort 5` (Layout B). In Excel
befüllen und als CSV speichern, dann im Tool über **Fragen** importieren. Das Trennzeichen
(Semikolon/Komma/Tab) erkennt der Parser automatisch.

## Verlags-Hotlines (Telefonnummern-Umschalter)
`public/hotlines.json` enthält je Verlag fünf fertige Rufnummern (`phoneNumbers[0..4]`,
Endziffern 1–5 = Antwort 1–5; Format wie das `phoneNumber`-Feld, z. B. `01378 408171`).
Quelle war die Excel „Hotlines a 5" (Stammnummer mit Platzhalter `x`).

In der **Sammlungs-Spalte** (links, nur wenn eine Sammlung geladen ist) gibt es das Dropdown
**„Verlag-Hotline"**: Auswahl stempelt die fünf Nummern des Verlags auf **alle** Quizze
(`questions[i].phoneNumber`), „Platzhalter zurücksetzen" stellt `01378 80272x` wieder her.
Logik: `handleApplyHotline` in `app/page.tsx`; der aktive Verlag wird per Nummern-Abgleich
erkannt (`activeHotlineVerlag`), `meta.publisher` bleibt unangetastet. Pro Verlag wird so eine
Variante erzeugt → veröffentlichen → nächsten Verlag wählen. Neu generieren der Daten:
`outputs`/Skript aus der Excel; zwei Verlage ohne Stammnummer und eine Tippfehler-Vorwahl
(`0378…`) sind in `docs/hotlines-phonenumbers.json` dokumentiert.

## Verlags-Vorlagen aus Anzeige (KI-Analyse)
`app/api/analyze-template/route.ts` analysiert eine hochgeladene Beispielanzeige
(PDF/Bild) mit Claude Vision und liefert Farben, Schrift, Format, Logo-Position,
Layout-Variante und Texte. Das KI-Panel baut daraus eine eigene Vorlage
(`saveCustomPreset`). Die Route ist robust: bis zu **3 Versuche** mit JSON-Reparatur
(`extractAnalysisJson`) — lange Teilnahmebedingungen mit Zeilenumbrüchen führten früher
zu 500-Fehlern.

Ein `VerlagsPreset` kann jetzt optionale **Texte** tragen (`texts`: subtitle, howToText,
winnersText, termsText, phoneTermsText, solutionWords). `applyPresetToQuiz` setzt sie beim
Anwenden (Titel und Fragen-Überschrift bleiben generiert; Teilnahmebedingungen nur als
Lückenfüller). So bringt „Anwenden" einer Vorlage auch deren Texte mit.

## Wichtige Hinweise
- Diese Next.js-Version (16.x) bringt **Breaking Changes** ggü. älteren Versionen. Vor Änderungen
  an Routing/APIs unbedingt die lokalen Docs unter `node_modules/next/dist/docs/` konsultieren
  (siehe `AGENTS.md`).
- Die App ist als reines Lokal-Tool gedacht — `.env.local` wird **nicht** mitgeliefert und muss
  vom Übernehmer selbst angelegt werden.
