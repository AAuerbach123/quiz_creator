# Backup: Wissensquiz Juli (Fragen + fotorealistische Bilder)

Versionierte Sicherung der 27-Quiz-Sammlung. Die Arbeitsdaten liegen normal nur in
der Browser-IndexedDB (Schlüssel `wissensquiz` / `collection` / `current`) und können
dort verloren gehen (z. B. durch Neu-Import oder mehrere offene Tabs). Dieser Ordner
ist die Rücklage im Git-Repo.

## Inhalt
- `images/` — 54 Bilder als PNG, benannt `NN_slot_Antwort.png`
  - `NN` = Quiz-Nummer 01–27
  - `slot` = `oben` (Bild zu **Frage 4**) bzw. `unten` (Bild zu **Frage 5**)
  - `Antwort` = die Antwort der zugehörigen Frage (zur Kontrolle)
- `fragenkatalog_juli.json` — die 27 Themen × 5 Fragen + Antworten (Quelle der Inhalte)
- `bild_zuordnung.json` — Mapping Quiz → {oben, unten} → Dateiname + Antwort

## Wiederherstellung (falls die Sammlung wieder Bilder/Fragen verliert)
1. **Fragen/Titel**: aus `fragenkatalog_juli.json` je Quiz die 5 Fragen+Antworten in
   Reihenfolge setzen (Frage j → `prizeTierId` p(j+1)); Titel z. B.
   „Heute 1000€ gewinnen – Thema: {Thema}!".
2. **Bilder**: je Quiz `images/NN_oben_*.png` → `theme.background.image`,
   `images/NN_unten_*.png` → `theme.background.imageBottom` (als data:image/png Base64).

## Wichtig zur Vermeidung von Datenverlust
- Tool immer nur in **einem** Browser-Tab öffnen (mehrere Tabs überschreiben sich in
  der IndexedDB gegenseitig).
- **„Fix anwenden"** und erneuten **Fragen-Import** meiden, solange Bilder in der
  Sammlung sind — beides ersetzt die Sammlung ohne Bilder.
- Nach größeren Änderungen: erneut sichern (TIFF-ZIP exportieren und/oder diesen
  Ordner aktualisieren + committen).
