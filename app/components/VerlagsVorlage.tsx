"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VerlagsPreset } from "../lib/verlage";
import {
  loadCustomPresets, removeCustomPreset, CUSTOM_PRESETS_EVENT,
  loadGroupOverrides, removeGroupOverride, applyGroupOverride, GROUP_OVERRIDES_EVENT,
  type GroupOverride,
} from "../lib/verlage";

type Props = {
  // Wendet die Vorlage dauerhaft auf das aktive Quiz an.
  applyPreset: (preset: VerlagsPreset) => void;
  // Zeigt die Vorlage in der Vorschau ohne das Quiz zu verändern (oder null = aus).
  onPreviewPreset: (preset: VerlagsPreset | null) => void;
  // Lädt das aktive Quiz als PDF in der Größe/Optik einer Vorlage herunter.
  onDownloadPreset: (preset: VerlagsPreset) => void;
  // Wie onDownloadPreset, aber als verlustfreies TIFF (Druck/InDesign).
  onDownloadPresetTiff?: (preset: VerlagsPreset) => void;
  // Mehrere Vorlagen: erzeugt je ein PDF und packt alles in ein ZIP.
  onDownloadPresetsBulk: (presets: VerlagsPreset[]) => Promise<void> | void;
  // Mehrere Vorlagen: erzeugt je ein verlustfreies TIFF und packt alles in ein ZIP.
  onDownloadPresetsTiffBulk?: (presets: VerlagsPreset[]) => Promise<void> | void;
  // Strukturierter Export: EIN ZIP (PDF oder TIFF) mit Ordner pro Gruppe; darin
  // pro Zeitung Variante 1/2 × mit/ohne Gewinner. Eine oder mehrere Gruppen.
  onDownloadStructuredZip?: (groups: { name: string; presets: VerlagsPreset[] }[], zipBaseName: string, format: "pdf" | "tiff") => Promise<void> | void;
  // Mehrere Vorlagen: erzeugt je ein PDF und pusht es an monday.com.
  onPushPresetsMonday: (presets: VerlagsPreset[]) => Promise<void> | void;
  downloadingPresetId: string | null;
  previewPresetId: string | null;
  bulkProgress: { current: number; total: number; name: string } | null;
  mondayProgress: { current: number; total: number; name: string; failed: number } | null;
  // Sammlungs-weiter "mit/ohne Gewinner"-Schalter (gilt für jede Zeitung).
  onSetWinners?: (show: boolean) => void;
  winnersShown?: boolean;
};

// Parst eine Anzeigengröße im Stil "315x220" / "282,5 x 215" / "325 × 240"
// in {w,h} mm. Liefert null, wenn nicht erkennbar.
export function parseAdSize(s: string): { w: number; h: number } | null {
  const m = (s || "").replace(/,/g, ".").match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  return { w: parseFloat(m[1]), h: parseFloat(m[2]) };
}

// Verlagsgruppen, die ihre Anzeige SELBST gestalten und von uns nur Bilder/
// Vorlagen bekommen (laut Mails von Yasmina/Robert). Für diese gibt es keinen
// Layout-Export (PDF/TIFF) — sie werden im Kopf entsprechend markiert.
// Die echte Südwest Presse ("SWP") liefert ihre Anzeige selbst. Den Schwabo
// (SWP-Vorlage) erzeugen WIR — der läuft als eigene Gruppe "Schwabo" und ist
// daher exportierbar.
// 25.06.2026 (Wunsch Andreas): NW, SWMH und Mittelrhein/Rhein sollen ins
// Portal — also wieder exportierbar. Nur die echte Südwest Presse bleibt außen vor.
// HCSB (Frankenpost, Neue Presse, Nordbayerischer Kurier, Suhler) gestaltet
// Robert selbst im Rhein-Stil und liefert fertige PDFs → kein Tool-Export.
// Nürnberg (VNP, 25.06.): Robert baut die Anzeige selbst und liefert sie →
// ebenfalls kein Tool-Export, wird wie SWP/HCSB als fertiges PDF importiert.
const SELF_DESIGN_GROUPS = new Set(["SWP", "HCSB", "Nürnberg"]);

export default function VerlagsVorlage({ applyPreset, onPreviewPreset, onDownloadPreset, onDownloadPresetTiff, onDownloadPresetsBulk, onDownloadPresetsTiffBulk, onDownloadStructuredZip, onPushPresetsMonday, downloadingPresetId, previewPresetId, bulkProgress, mondayProgress, onSetWinners, winnersShown }: Props) {
  const [presets, setPresets] = useState<VerlagsPreset[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const bulkBusy = !!bulkProgress || !!mondayProgress;

  // Eigene (KI-analysierte) Vorlagen aus localStorage — werden vor die
  // Standard-Presets gemergt und live aktualisiert, wenn im KI-Tab eine
  // neue Vorlage analysiert wird.
  const [customPresets, setCustomPresets] = useState<VerlagsPreset[]>([]);
  useEffect(() => {
    setCustomPresets(loadCustomPresets());
    const onChange = () => setCustomPresets(loadCustomPresets());
    window.addEventListener(CUSTOM_PRESETS_EVENT, onChange);
    return () => window.removeEventListener(CUSTOM_PRESETS_EVENT, onChange);
  }, []);

  // CI-Vorlagen pro Verlagsgruppe (aus KI-Analyse) — überschreiben Farben/
  // Schrift/Layout aller Titel der Gruppe. Live-Update über Window-Event.
  const [groupOverrides, setGroupOverrides] = useState<Record<string, GroupOverride>>({});
  useEffect(() => {
    setGroupOverrides(loadGroupOverrides());
    const onChange = () => setGroupOverrides(loadGroupOverrides());
    window.addEventListener(GROUP_OVERRIDES_EVENT, onChange);
    return () => window.removeEventListener(GROUP_OVERRIDES_EVENT, onChange);
  }, []);

  useEffect(() => {
    fetch("/verlage-presets.json")
      .then(r => (r.ok ? r.json() : []))
      .then((d: VerlagsPreset[]) => setPresets(Array.isArray(d) ? d : []))
      .catch(() => setError("Vorlagen konnten nicht geladen werden."));
  }, []);

  const allPresets = useMemo(
    () => [...customPresets, ...presets].map(p => applyGroupOverride(p, groupOverrides)),
    [customPresets, presets, groupOverrides]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allPresets;
    return allPresets.filter(p =>
      p.titel.toLowerCase().includes(q) ||
      p.verlag.toLowerCase().includes(q) ||
      (p.gruppe || "").toLowerCase().includes(q)
    );
  }, [allPresets, search]);

  // Nach Verlag gruppieren.
  const groups = useMemo(() => {
    const m = new Map<string, VerlagsPreset[]>();
    for (const p of filtered) {
      const key = p.verlag || p.gruppe || "Sonstige";
      (m.get(key) || m.set(key, []).get(key)!).push(p);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Alle Gruppen, die unser Layout nehmen (Self-Design-Gruppen ausgenommen) —
  // für den globalen „Alle Layout-Gruppen"-Export. Unabhängig von der Suche.
  const layoutGroups = useMemo(() => {
    const m = new Map<string, VerlagsPreset[]>();
    for (const p of allPresets) {
      const key = p.verlag || p.gruppe || "Sonstige";
      if (SELF_DESIGN_GROUPS.has(key)) continue;
      (m.get(key) || m.set(key, []).get(key)!).push(p);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, presets]) => ({ name, presets }));
  }, [allPresets]);

  const handleUpload: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setError(""); setStatus("Importiere …");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/import-verlage", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const list: VerlagsPreset[] = j.presets || [];
      if (!list.length) throw new Error("Keine Vorlagen in der Datei gefunden.");
      setPresets(list);
      setStatus(`${list.length} Vorlagen importiert.`);
    } catch (err) {
      setStatus("");
      setError(`Import fehlgeschlagen: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-[12.5px] text-stone-500 leading-relaxed">
        Jede Zeitung einzeln vorschauen und als PDF (in der exakten Anzeigengröße,
        mit Schrift und Farben des Verlags) herunterladen. Klick auf einen Titel
        zeigt ihn rechts in der Vorschau.
      </p>

      {/* Mit/ohne Gewinner — gilt für jede Zeitung (setzt es auf allen Quizzen). */}
      {onSetWinners && (
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-stone-600">Layout:</span>
          <div className="flex p-0.5 rounded-lg bg-stone-200/70">
            {([["mit Gewinner", true], ["ohne Gewinner", false]] as const).map(([label, show]) => {
              const active = winnersShown === show;
              return (
                <button key={label} type="button"
                  onClick={() => { if (!active) onSetWinners(show); }}
                  className={`h-7 px-3 text-[12px] rounded-md transition-colors ${
                    active ? "bg-white text-stone-900 font-medium shadow-sm" : "text-stone-500 hover:text-stone-700"
                  }`}
                  title={show ? "Gewinner-Spalte anzeigen" : "Ohne Gewinner — Spalte entfällt, Fragen breiter"}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Zeitung oder Verlag suchen …"
        className="w-full px-3 py-2 text-[13.5px] rounded-lg bg-white text-stone-900 focus:outline-none"
        style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }} />

      {/* Globaler Export: ALLE Layout-Gruppen in ein ZIP (Ordner pro Gruppe;
          je Zeitung Variante 1 & 2, mit/ohne Gewinner). Self-Design-Gruppen außen vor. */}
      {onDownloadStructuredZip && (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-sky-50"
          style={{ boxShadow: "inset 0 0 0 1px rgba(14,165,233,0.22)" }}>
          <span className="text-[12px] font-medium text-stone-700 leading-tight">
            Alle Layout-Gruppen<br /><span className="text-[10.5px] font-normal text-stone-500">je Ordner = Gruppe · Datei = Zeitung × Variante 1/2 × mit/ohne</span>
          </span>
          <div className="flex-1" />
          <button type="button" disabled={bulkBusy}
            onClick={() => onDownloadStructuredZip(layoutGroups, "Alle-Gruppen", "pdf")}
            className="h-8 px-3 text-[12.5px] rounded-lg text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-40 font-medium">
            PDF-ZIP
          </button>
          <button type="button" disabled={bulkBusy}
            onClick={() => onDownloadStructuredZip(layoutGroups, "Alle-Gruppen", "tiff")}
            className="h-8 px-3 text-[12.5px] rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 font-medium">
            TIFF-ZIP
          </button>
        </div>
      )}

      {/* Auswahl-Aktionsleiste */}
      <div className="flex items-center gap-2 px-1">
        <button onClick={() => setSelectedIds(new Set(filtered.map(p => p.id)))} disabled={bulkBusy}
          className="h-7 px-2.5 text-[12px] rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors disabled:opacity-40">
          Alle wählen
        </button>
        <button onClick={() => setSelectedIds(new Set())} disabled={bulkBusy || selectedIds.size === 0}
          className="h-7 px-2.5 text-[12px] rounded-md text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-40">
          Auswahl aufheben
        </button>
        <span className="text-[12px] text-stone-500">
          {selectedIds.size} von {allPresets.length} ausgewählt
        </span>
        <div className="flex-1" />
        <button onClick={() => {
            const list = allPresets.filter(p => selectedIds.has(p.id));
            onDownloadPresetsBulk(list);
          }}
          disabled={bulkBusy || selectedIds.size === 0}
          className="h-8 px-3.5 text-[12.5px] rounded-lg text-white disabled:opacity-40 transition-colors font-medium"
          style={{ background: "#0071e3" }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#0077ed"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#0071e3"; }}>
          {bulkProgress ? `${bulkProgress.current}/${bulkProgress.total} …` : `PDFs (ZIP)`}
        </button>
        {onDownloadPresetsTiffBulk && (
          <button onClick={() => {
              const list = allPresets.filter(p => selectedIds.has(p.id));
              onDownloadPresetsTiffBulk(list);
            }}
            disabled={bulkBusy || selectedIds.size === 0}
            title="Verlustfreie TIFFs (Scale 2) als ZIP — für Druck/InDesign"
            className="h-8 px-3.5 text-[12.5px] rounded-lg text-white disabled:opacity-40 transition-colors font-medium"
            style={{ background: "#059669" }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#0a7d56"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#059669"; }}>
            TIFFs (ZIP)
          </button>
        )}
        <button onClick={() => {
            const list = allPresets.filter(p => selectedIds.has(p.id));
            onPushPresetsMonday(list);
          }}
          disabled={bulkBusy || selectedIds.size === 0}
          className="h-8 px-3.5 text-[12.5px] rounded-lg text-white disabled:opacity-40 transition-colors font-medium"
          style={{ background: "#8b5cf6" }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#9061f9"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#8b5cf6"; }}>
          {mondayProgress ? `monday ${mondayProgress.current}/${mondayProgress.total} …` : `An monday.com`}
        </button>
      </div>

      {bulkProgress && (
        <div className="rounded-lg bg-sky-50 px-3 py-2 text-[12px] text-sky-800 flex items-center gap-2">
          <span className="font-medium">{bulkProgress.current}/{bulkProgress.total}</span>
          <span className="truncate">{bulkProgress.name}</span>
          <div className="flex-1 ml-1 h-1 bg-sky-200 rounded overflow-hidden">
            <div className="h-full bg-sky-500 transition-all"
              style={{ width: `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%` }} />
          </div>
        </div>
      )}
      {mondayProgress && (
        <div className="rounded-lg bg-violet-50 px-3 py-2 text-[12px] text-violet-800 flex items-center gap-2">
          <span className="font-medium">{mondayProgress.current}/{mondayProgress.total}</span>
          <span className="truncate">{mondayProgress.name}</span>
          {mondayProgress.failed > 0 && (
            <span className="text-rose-600 text-[11px] font-medium">{mondayProgress.failed} Fehler</span>
          )}
          <div className="flex-1 ml-1 h-1 bg-violet-200 rounded overflow-hidden">
            <div className="h-full bg-violet-500 transition-all"
              style={{ width: `${Math.round((mondayProgress.current / mondayProgress.total) * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="rounded-xl bg-stone-50 max-h-[58vh] overflow-y-auto"
        style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)" }}>
        {groups.length === 0 && (
          <div className="px-4 py-6 text-center text-[12.5px] text-stone-400">
            Keine Treffer. Suche zurücksetzen, um alle Zeitungen zu sehen.
          </div>
        )}
        {groups.map(([verlagName, items]) => (
          <div key={verlagName}>
            <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-stone-400 font-semibold flex items-center gap-2">
              <span>{verlagName}</span>
              {groupOverrides[verlagName] && (
                <>
                  <span className="normal-case tracking-normal font-medium text-[10px] text-white px-1.5 py-0.5 rounded"
                    style={{ background: "#8b5cf6" }}
                    title={`Hochgeladene CI-Vorlage${groupOverrides[verlagName].sourceName ? ` „${groupOverrides[verlagName].sourceName}"` : ""} überschreibt Farben/Schrift/Layout aller Titel dieser Gruppe.`}>
                    CI-Vorlage aktiv
                  </span>
                  <button
                    onClick={() => { if (confirm(`CI-Vorlage für ${verlagName} entfernen? Die Titel nutzen danach wieder ihre ursprünglichen Farben/Schriften.`)) removeGroupOverride(verlagName); }}
                    className="normal-case tracking-normal font-normal text-[10px] text-rose-600 hover:underline">
                    entfernen
                  </button>
                </>
              )}
              {/* Gruppen-Export rechts. Self-Design-Gruppen liefern selbst → kein Layout-Export. */}
              {SELF_DESIGN_GROUPS.has(verlagName) ? (
                <span className="ml-auto normal-case tracking-normal font-medium text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded"
                  title="Diese Gruppe gestaltet ihre Anzeige selbst und bekommt von uns nur Bilder/Vorlagen. Kein Layout-Export.">
                  liefert selbst – nur Bilder
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-1">
                  {(() => {
                    const groupPresets = allPresets.filter(p => (p.verlag || p.gruppe || "Sonstige") === verlagName);
                    const grp = [{ name: verlagName, presets: groupPresets }];
                    return (<>
                      <button type="button" disabled={bulkBusy}
                        onClick={() => onDownloadStructuredZip?.(grp, verlagName, "pdf")}
                        title={`PDF-ZIP: Ordner „${verlagName}" mit je Zeitung Variante 1 & 2, mit und ohne Gewinner.`}
                        className="normal-case tracking-normal font-semibold text-[10.5px] text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-40 px-2 py-1 rounded">
                        PDF-ZIP
                      </button>
                      <button type="button" disabled={bulkBusy}
                        onClick={() => onDownloadStructuredZip?.(grp, verlagName, "tiff")}
                        title={`TIFF-ZIP: Ordner „${verlagName}" mit je Zeitung Variante 1 & 2, mit und ohne Gewinner.`}
                        className="normal-case tracking-normal font-semibold text-[10.5px] text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 px-2 py-1 rounded">
                        TIFF-ZIP
                      </button>
                    </>);
                  })()}
                </span>
              )}
            </div>
            <div>
              {items.map(p => {
                const previewing = previewPresetId === p.id;
                const downloading = downloadingPresetId === p.id;
                return (
                  <div key={p.id}
                    className={`flex items-center gap-3 px-3 py-2 mx-2 my-1 rounded-lg transition-colors ${
                      previewing ? "bg-emerald-50" : selectedIds.has(p.id) ? "bg-sky-50" : "bg-white hover:bg-stone-100"
                    }`}
                    style={previewing ? { boxShadow: "inset 0 0 0 1px rgba(5,150,105,0.35)" } : selectedIds.has(p.id) ? { boxShadow: "inset 0 0 0 1px rgba(14,165,233,0.35)" } : { boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)" }}>
                    <input type="checkbox" checked={selectedIds.has(p.id)} disabled={bulkBusy}
                      onChange={() => toggleSelect(p.id)}
                      className="w-4 h-4 accent-sky-500 cursor-pointer shrink-0" />
                    <button onClick={() => onPreviewPreset(previewing ? null : p)}
                      className="flex-1 text-left min-w-0">
                      <div className="text-[13.5px] font-medium text-stone-900 truncate">
                        {p.titel}
                      </div>
                      <div className="text-[11.5px] text-stone-500 truncate flex items-center gap-2">
                        <span className="font-mono">{p.format || "—"} mm</span>
                        <span className="text-stone-300">·</span>
                        <span className="truncate">{p.fontRaw || "—"}</span>
                        {!p.fontAvailable && (
                          <span className="text-amber-700 text-[10.5px] shrink-0">⚠ Schrift fehlt</span>
                        )}
                      </div>
                    </button>
                    <button onClick={() => applyPreset(p)} title="Auf aktives Quiz anwenden"
                      className="h-7 px-2 text-[11.5px] rounded-md text-emerald-700 hover:bg-emerald-100 transition-colors shrink-0">
                      Anwenden
                    </button>
                    {p.id.startsWith("custom_") && (
                      <button
                        onClick={() => { if (confirm(`Eigene Vorlage „${p.titel}" löschen?`)) removeCustomPreset(p.id); }}
                        title="Eigene Vorlage löschen"
                        className="h-7 px-2 text-[11.5px] rounded-md text-rose-600 hover:bg-rose-50 transition-colors shrink-0">
                        ✕
                      </button>
                    )}
                    <button onClick={() => onDownloadPreset(p)} disabled={downloading}
                      className="h-7 px-3 text-[11.5px] rounded-md text-white disabled:opacity-50 transition-colors shrink-0"
                      style={{ background: "#0071e3" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#0077ed")}
                      onMouseLeave={e => (e.currentTarget.style.background = "#0071e3")}>
                      {downloading ? "…" : "PDF"}
                    </button>
                    {onDownloadPresetTiff && (
                      <button onClick={() => onDownloadPresetTiff(p)} disabled={downloading}
                        title="Als verlustfreies TIFF herunterladen (Druck/InDesign)"
                        className="h-7 px-3 text-[11.5px] rounded-md text-white disabled:opacity-50 transition-colors shrink-0"
                        style={{ background: "#0E7C66" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#0F8C72")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#0E7C66")}>
                        {downloading ? "…" : "TIFF"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => fileRef.current?.click()}
          className="h-8 px-3 text-[12.5px] rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors">
          Excel/ODS importieren
        </button>
        {previewPresetId && (
          <button onClick={() => onPreviewPreset(null)}
            className="h-8 px-3 text-[12.5px] rounded-lg text-stone-600 hover:bg-stone-100 transition-colors">
            Vorschau zurücksetzen
          </button>
        )}
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.ods" className="hidden" onChange={handleUpload} />
        <div className="flex-1" />
        {status && <span className="text-[12px] text-emerald-700">{status}</span>}
        {error && <span className="text-[12px] text-rose-600">{error}</span>}
      </div>
    </div>
  );
}
