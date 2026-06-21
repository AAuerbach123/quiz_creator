// Inhalts-Overrides pro Verlagsgruppe und pro Spieltag.
//
// Modell: Der globale Quiz-Inhalt (Fragen, Überschrift, Texte …) bleibt der
// Standard für ALLE Verlage. Darüber liegt diese optionale Ebene mit dem
// Schlüssel (Gruppe → Spieltag-/Quiz-ID → Feld). Ist ein Feld hier gesetzt,
// gilt es NUR für diese Gruppe an diesem Spieltag; sonst der globale Wert.
//
// Gespeichert im localStorage (überlebt Reload). Änderungen feuern ein Event,
// damit Vorschau/Editor sofort neu rendern.

export const GROUP_CONTENT_KEY = "wq.groupContent";
export const GROUP_CONTENT_EVENT = "wq:groupContentChanged";

export type ContentOverride = {
  // meta-Felder (questionsHeadline, subtitle, stoererText, termsText, …)
  meta?: Record<string, string>;
  // pro Frage (Index als String): { text?, phoneNumber?, correctAnswer? }
  questions?: Record<string, Record<string, string>>;
};
export type GroupContentStore = Record<string, Record<string, ContentOverride>>;

let cache: GroupContentStore | null = null;

export function loadGroupContent(): GroupContentStore {
  if (cache) return cache;
  if (typeof window === "undefined") return (cache = {});
  try {
    cache = JSON.parse(localStorage.getItem(GROUP_CONTENT_KEY) || "{}") as GroupContentStore;
  } catch {
    cache = {};
  }
  return cache!;
}

function persist(store: GroupContentStore) {
  cache = store;
  if (typeof window !== "undefined") {
    try { localStorage.setItem(GROUP_CONTENT_KEY, JSON.stringify(store)); } catch { /* ignore */ }
    window.dispatchEvent(new Event(GROUP_CONTENT_EVENT));
  }
}

export function getOverride(group: string, quizId: string): ContentOverride {
  const s = loadGroupContent();
  return (s[group] && s[group][quizId]) || {};
}

// Entfernt leere Zwischenobjekte, damit "kein Override" sauber zurückfällt.
function prune(store: GroupContentStore, group: string, quizId: string) {
  const ov = store[group]?.[quizId];
  if (!ov) return;
  if (ov.meta && Object.keys(ov.meta).length === 0) delete ov.meta;
  if (ov.questions) {
    for (const k of Object.keys(ov.questions)) {
      if (Object.keys(ov.questions[k]).length === 0) delete ov.questions[k];
    }
    if (Object.keys(ov.questions).length === 0) delete ov.questions;
  }
  if (!ov.meta && !ov.questions) delete store[group][quizId];
  if (store[group] && Object.keys(store[group]).length === 0) delete store[group];
}

export function setMetaOverride(group: string, quizId: string, key: string, value: string) {
  const s = { ...loadGroupContent() };
  const grp = (s[group] = { ...(s[group] || {}) });
  const ov = (grp[quizId] = { ...(grp[quizId] || {}) });
  ov.meta = { ...(ov.meta || {}) };
  if (value.trim() === "") delete ov.meta[key]; else ov.meta[key] = value;
  prune(s, group, quizId);
  persist(s);
}

export function setQuestionOverride(group: string, quizId: string, index: number, key: string, value: string) {
  const s = { ...loadGroupContent() };
  const grp = (s[group] = { ...(s[group] || {}) });
  const ov = (grp[quizId] = { ...(grp[quizId] || {}) });
  ov.questions = { ...(ov.questions || {}) };
  const q = (ov.questions[String(index)] = { ...(ov.questions[String(index)] || {}) });
  if (value.trim() === "") delete q[key]; else q[key] = value;
  prune(s, group, quizId);
  persist(s);
}

// Alle Overrides einer Gruppe für einen Spieltag löschen.
export function clearOverride(group: string, quizId: string) {
  const s = { ...loadGroupContent() };
  if (s[group]) { s[group] = { ...s[group] }; delete s[group][quizId]; }
  prune(s, group, quizId);
  persist(s);
}

type MergeableQuiz = {
  id: string;
  meta: Record<string, unknown>;
  questions: Array<Record<string, unknown>>;
};

// Legt die Gruppen-Overrides über den globalen Quiz-Inhalt. Wird zentral in
// applyPresetToQuiz aufgerufen, damit JEDE Vorschau/Export pro Verlag sie sieht.
export function applyGroupContent<T extends MergeableQuiz>(quiz: T, group: string | null | undefined): T {
  if (!group) return quiz;
  const ov = getOverride(group, quiz.id);
  if (!ov.meta && !ov.questions) return quiz;
  const meta = ov.meta ? { ...quiz.meta, ...ov.meta } : quiz.meta;
  const questions = ov.questions
    ? quiz.questions.map((q, i) => {
        const o = ov.questions![String(i)];
        return o ? { ...q, ...o } : q;
      })
    : quiz.questions;
  return { ...quiz, meta, questions };
}
