# monday.com-Integration einrichten

Der „An monday.com"-Knopf im Verlag-Tab erzeugt für jede gewählte Zeitung ein
PDF, legt im monday.com-Board ein neues Item an (Item-Name = Zeitungstitel) und
hängt das PDF an die konfigurierte Datei-Spalte.

## Drei Werte in `.env.local` setzen

```
MONDAY_API_TOKEN=dein_personal_token_hier
MONDAY_BOARD_ID=1234567890
MONDAY_FILE_COLUMN_ID=files
```

Nach dem Speichern Dev-Server **neu starten** (`Strg + C`, dann `npm run dev`),
sonst werden die Variablen nicht gelesen.

## Wo finde ich die drei Werte?

### 1. `MONDAY_API_TOKEN` – persönlicher API-Token

1. In monday.com oben rechts aufs Profilbild klicken → **Developers**.
2. Reiter **My Access Tokens** → **Show**.
3. Den langen String kopieren (beginnt mit `eyJ…`) und in `.env.local` einfügen.

Der Token hat dieselben Rechte wie dein Account. Wenn ein Service-Account
gewünscht ist, einen Bot/Service-User anlegen und dessen Token nehmen.

### 2. `MONDAY_BOARD_ID` – Ziel-Board

Wenn du ein Board in monday.com öffnest, steht die Board-ID in der URL:

```
https://<workspace>.monday.com/boards/1234567890
                                   ^^^^^^^^^^
```

Diese Nummer in `.env.local` eintragen.

### 3. `MONDAY_FILE_COLUMN_ID` – die Spalte, in die das PDF kommt

Auf dem Board eine **Datei-Spalte** anlegen (Spalten-Typ „Files").
Spalten-ID findest du so:

1. Drei-Punkte-Menü oben am Spalten-Titel → **Customize column** → **Edit settings**.
2. Im sich öffnenden Panel oben rechts steht „Column ID: …" — diesen Wert
   kopieren (oft `files`, `files_1`, `files0` o. ä.).

Falls dort nichts angezeigt wird: Settings → **Developer Mode** in monday.com
einschalten, dann zeigt die Spalten-Einstellung die ID.

## Test

1. Im Verlag-Tab eine oder zwei Zeitungen anhaken.
2. Den lila Knopf **„An monday.com"** drücken.
3. Fortschrittsbalken läuft. Pro Zeitung dauert es ~1–2 Sekunden plus die
   Render-/Upload-Zeit.
4. Im monday.com-Board sollten die neuen Items mit angehängten PDFs auftauchen.

Bei Fehlern: Browser-Konsole (Rechtsklick → „Untersuchen" → Console) und
Server-Terminal-Ausgabe geben Details. Häufige Fehler:

- **401 unauthorized** – Token falsch oder Server nicht neu gestartet.
- **„Board nicht gefunden"** – Board-ID prüfen.
- **„Column not found"** – Spalten-ID prüfen (nicht der angezeigte Name!).

## Datenfluss kurz

```
Browser (PDF erzeugen)  →  POST /api/monday-upload (multipart)
   ↓
Server (Next.js Route)  →  monday.com GraphQL: create_item
                       →  monday.com File-API: add_file_to_column
   ↓
Antwort {itemId, fileId}  →  zurück zum Browser
```

Der API-Token verlässt nie den Server – die `.env.local` ist nicht im
Repository.
