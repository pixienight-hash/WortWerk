import React, { useState } from "react";
import { AlertTriangle, Check, FileJson, PenLine, Upload } from "lucide-react";
import {
  SENTENCE_TYPES,
  SENTENCE_CEFR_LEVELS,
  SENTENCE_TYPE_LABELS,
  parseSentenceJsonInput,
  reviewSentenceImport,
  sentenceIdentityKey,
  type SentenceEntry,
  type SentenceType,
  type SentenceCefr,
  type SentenceImportReviewRow,
} from "@/lib/sentences-data";

const SAMPLE_JSON = JSON.stringify(
  [
    {
      sentence: "Das macht Sinn.",
      type: "everyday_expression",
      cefr: "B1",
      meaning: {
        el: "Αυτό βγάζει νόημα.",
        en: "That makes sense.",
      },
      usage: "Όταν συμφωνείς με ένα λογικό επιχείρημα ή εξήγηση.",
      context: "Im Gespräch / Meeting",
      grammar: "Feste Verbindung (Sinn machen / ergeben)",
      structure: "Das macht Sinn.",
      examples: [
        {
          de: "Dein Vorschlag klingt gut – das macht absolut Sinn.",
          el: "Η πρότασή σου ακούγεται καλή – βγάζει απόλυτο νόημα.",
        },
      ],
      alternatives: ["Das ergibt Sinn."],
      synonyms: ["einleuchtend sein"],
      memoryHook: "der Sinn = νόημα.",
      tags: ["Alltag", "Gespräch"],
    },
  ],
  null,
  2,
);

interface Props {
  existing: SentenceEntry[];
  editingEntry?: SentenceEntry | null;
  onImportRows: (rows: SentenceImportReviewRow[]) => {
    added: number;
    replaced: number;
    skipped: number;
  };
  onSaveEdited?: (updated: SentenceEntry) => void;
  onCancelEdit?: () => void;
  onGoToList: () => void;
}

export default function SentenceAddView({
  existing,
  editingEntry = null,
  onImportRows,
  onSaveEdited,
  onCancelEdit,
  onGoToList,
}: Props) {
  const [mode, setMode] = useState<"json" | "form">(editingEntry ? "form" : "json");
  const [jsonText, setJsonText] = useState("");
  const [reviewRows, setReviewRows] = useState<SentenceImportReviewRow[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Manual form state (also used for editing an existing sentence)
  const [sentence, setSentence] = useState(editingEntry?.sentence ?? "");
  const [type, setType] = useState<SentenceType>(editingEntry?.type ?? "everyday_expression");
  const [cefr, setCefr] = useState<SentenceCefr>(editingEntry?.cefr ?? "B1");
  const [meaningEl, setMeaningEl] = useState(editingEntry?.meaning.el ?? "");
  const [meaningEn, setMeaningEn] = useState(editingEntry?.meaning.en ?? "");
  const [context, setContext] = useState(editingEntry?.context ?? "");
  const [usage, setUsage] = useState(editingEntry?.usage ?? "");
  const [grammar, setGrammar] = useState(editingEntry?.grammar ?? "");
  const [structure, setStructure] = useState(editingEntry?.structure ?? "");
  const [alternatives, setAlternatives] = useState((editingEntry?.alternatives ?? []).join(", "));
  const [synonyms, setSynonyms] = useState((editingEntry?.synonyms ?? []).join(", "));
  const [memoryHook, setMemoryHook] = useState(editingEntry?.memoryHook ?? "");
  const [tags, setTags] = useState((editingEntry?.tags ?? []).join(", "));
  const [examplesText, setExamplesText] = useState(
    (editingEntry?.examples ?? []).map((ex) => (ex.el ? `${ex.de} | ${ex.el}` : ex.de)).join("\n"),
  );
  const [formDuplicateWarning, setFormDuplicateWarning] = useState<SentenceEntry | null>(null);

  function parseCsv(val: string): string[] {
    return val
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function parseExamplesLines(val: string): Array<{ de: string; el?: string }> {
    return val
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [de, el] = line.split("|").map((p) => p.trim());
        return el ? { de: de || "", el } : { de: de || "" };
      })
      .filter((x) => x.de.length > 0);
  }

  function handleValidateJson() {
    setMessage(null);
    const parsed = parseSentenceJsonInput(jsonText);
    if (!parsed.ok) {
      setReviewRows(null);
      setMessage({ ok: false, text: parsed.error });
      return;
    }
    const reviewed = reviewSentenceImport(existing, parsed.items);
    setReviewRows(reviewed);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setJsonText(content);
      setReviewRows(null);
      setMessage(null);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleConfirmJsonImport() {
    if (!reviewRows) return;
    const res = onImportRows(reviewRows);
    const parts: string[] = [];
    if (res.added) parts.push(`${res.added} νέες προστέθηκαν`);
    if (res.replaced) parts.push(`${res.replaced} ενημερώθηκαν`);
    if (res.skipped) parts.push(`${res.skipped} διπλότυπες παραλείφθηκαν`);
    setReviewRows(null);
    setJsonText("");
    setMessage({
      ok: res.added + res.replaced > 0,
      text: parts.length ? `✓ ${parts.join(" · ")}` : "Δεν επιλέχθηκε καμία καταχώριση.",
    });
  }

  function buildFormRaw(): Record<string, unknown> {
    return {
      sentence: sentence.trim(),
      type,
      cefr,
      meaning: { el: meaningEl.trim(), en: meaningEn.trim() },
      context: context.trim(),
      usage: usage.trim(),
      grammar: grammar.trim(),
      structure: structure.trim(),
      examples: parseExamplesLines(examplesText),
      alternatives: parseCsv(alternatives),
      synonyms: parseCsv(synonyms),
      memoryHook: memoryHook.trim(),
      tags: parseCsv(tags),
    };
  }

  function handleSubmitForm(e: React.FormEvent, allowDuplicate = false) {
    e.preventDefault();
    setMessage(null);
    const trimmed = sentence.trim();
    if (!trimmed) {
      setMessage({ ok: false, text: "Συμπλήρωσε τη γερμανική πρόταση ή έκφραση." });
      return;
    }
    if (!meaningEl.trim() && !meaningEn.trim()) {
      setMessage({ ok: false, text: "Συμπλήρωσε τουλάχιστον ελληνική ή αγγλική σημασία." });
      return;
    }

    if (editingEntry && onSaveEdited) {
      const updated: SentenceEntry = {
        ...editingEntry,
        sentence: trimmed,
        type,
        cefr,
        meaning: { el: meaningEl.trim(), en: meaningEn.trim() },
        context: context.trim(),
        usage: usage.trim(),
        grammar: grammar.trim(),
        structure: structure.trim(),
        examples: parseExamplesLines(examplesText),
        alternatives: parseCsv(alternatives),
        synonyms: parseCsv(synonyms),
        memoryHook: memoryHook.trim(),
        tags: parseCsv(tags),
      };
      onSaveEdited(updated);
      return;
    }

    // Duplicate check before adding
    const key = sentenceIdentityKey(trimmed);
    const dup = existing.find((item) => sentenceIdentityKey(item.sentence) === key) ?? null;
    if (dup && !allowDuplicate) {
      setFormDuplicateWarning(dup);
      return;
    }

    const reviewed = reviewSentenceImport(existing, [buildFormRaw()]).map((r) => ({
      ...r,
      action: "add" as const,
    }));
    const res = onImportRows(reviewed);
    setFormDuplicateWarning(null);
    setSentence("");
    setMeaningEl("");
    setMeaningEn("");
    setContext("");
    setUsage("");
    setGrammar("");
    setStructure("");
    setAlternatives("");
    setSynonyms("");
    setMemoryHook("");
    setTags("");
    setExamplesText("");
    setMessage({ ok: res.added > 0, text: `✓ Η πρόταση αποθηκεύτηκε (${res.added} νέα).` });
  }

  const dupCount = reviewRows ? reviewRows.filter((r) => r.isDuplicate).length : 0;
  const newCount = reviewRows ? reviewRows.filter((r) => !r.isDuplicate).length : 0;

  return (
    <div className="px-5 pt-4 pb-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="ww-display text-[26px] font-semibold leading-tight text-[#211F1C]">
            {editingEntry ? "Επεξεργασία πρότασης" : "Neue hinzufügen"}
          </h1>
          <p className="mt-0.5 text-[13px] text-[#8B8680]">
            {editingEntry
              ? `Επεξεργασία ${editingEntry.id} · η πρόοδος εκμάθησης διατηρείται`
              : "Εισαγωγή προτάσεων & εκφράσεων μέσω JSON ή φόρμας"}
          </p>
        </div>
        {editingEntry && onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-full border border-[#E8E0CE] bg-white px-4 py-2 text-xs font-semibold text-[#4A453D]"
          >
            Ακύρωση
          </button>
        )}
      </div>

      {!editingEntry && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("json");
              setMessage(null);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition ${
              mode === "json"
                ? "border-[#8B7BC7] bg-[#8B7BC7]/15 text-[#5D4C9E]"
                : "border-[#E8E0CE] bg-white text-[#8B8680]"
            }`}
          >
            <FileJson size={15} /> Εισαγωγή JSON
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("form");
              setMessage(null);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition ${
              mode === "form"
                ? "border-[#CB9146] bg-[#CB9146]/15 text-[#8A5B1A]"
                : "border-[#E8E0CE] bg-white text-[#8B8680]"
            }`}
          >
            <PenLine size={15} /> Φόρμα καταχώρισης
          </button>
        </div>
      )}

      {message && (
        <div
          role="status"
          className={`ww-pop mt-4 flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold ${
            message.ok
              ? "border-[#3F8C5F]/40 bg-[#3F8C5F]/10 text-[#1F5637]"
              : "border-[#C1543C]/40 bg-[#C1543C]/10 text-[#8A2F1C]"
          }`}
        >
          <span>{message.text}</span>
          {message.ok && (
            <button type="button" onClick={onGoToList} className="shrink-0 underline">
              Προβολή όλων
            </button>
          )}
        </div>
      )}

      {/* JSON IMPORT MODE */}
      {!editingEntry && mode === "json" && (
        <div className="ww-tag-card mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs leading-relaxed text-[#6B655D]">
              Επικόλλησε <strong>μία καταχώριση</strong> ή <strong>JSON array</strong> με πολλές
              προτάσεις/εκφράσεις. Ελέγχεται αυτόματα η εγκυρότητα και τυχόν διπλότυπα.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setJsonText(SAMPLE_JSON);
                  setReviewRows(null);
                  setMessage(null);
                }}
                className="rounded-full border border-[#E8E0CE] bg-[#F5F0E6] px-3 py-1.5 text-[11px] font-semibold text-[#4A453D]"
              >
                Φόρτωση παραδείγματος
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#E8E0CE] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#4A453D]">
                <Upload size={12} /> Αρχείο .json
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <textarea
            aria-label="JSON προτάσεων"
            rows={10}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setReviewRows(null);
            }}
            placeholder={
              '[\n  {\n    "sentence": "Könnten Sie mir bitte das Salz reichen?",\n    "type": "polite_request",\n    "cefr": "A2",\n    "meaning": { "el": "Θα μπορούσατε να μου δώσετε το αλάτι;", "en": "Could you please pass me the salt?" }\n  }\n]'
            }
            className="ww-mono mt-3 w-full rounded-2xl border border-[#E8E0CE] bg-[#FAF8F4] p-3.5 text-xs text-[#211F1C] outline-none focus:border-[#8B7BC7]"
          />

          {!reviewRows && (
            <button
              type="button"
              onClick={handleValidateJson}
              disabled={!jsonText.trim()}
              className="mt-3 w-full rounded-full bg-[#211F1C] py-3.5 text-sm font-semibold text-[#F5F0E6] disabled:bg-[#D9D2C0] disabled:text-[#8B8680]"
            >
              Έλεγχος JSON &amp; Διπλοτύπων
            </button>
          )}

          {/* Review & Duplicate Warning Panel */}
          {reviewRows && (
            <div className="ww-pop mt-4 rounded-2xl border border-[#E8E0CE] bg-[#FAF8F4] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#211F1C]">
                <span>
                  Έλεγχος εισαγωγής: {reviewRows.length} εγγραφές ({newCount} νέες · {dupCount}{" "}
                  διπλότυπες)
                </span>
              </div>

              {dupCount > 0 && (
                <div
                  role="alert"
                  className="mt-2.5 flex items-start gap-2 rounded-xl border border-[#CB9146]/50 bg-[#CB9146]/12 p-3 text-xs text-[#7A5114]"
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Εντοπίστηκαν <strong>{dupCount}</strong> διπλότυπες προτάσεις (ανεξάρτητα από
                    πεζά/κεφαλαία και κενά). Από προεπιλογή παραλείπονται — μπορείς να αλλάξεις την
                    ενέργεια ανά εγγραφή.
                  </span>
                </div>
              )}

              <div className="mt-3 max-h-72 divide-y divide-[#ECE4D3] overflow-y-auto">
                {reviewRows.map((row, idx) => (
                  <div key={idx} className="space-y-1.5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[#211F1C]">
                          {row.entry.sentence}
                        </div>
                        <div className="text-xs text-[#6B655D]">
                          {row.entry.meaning.el || row.entry.meaning.en} · {row.entry.cefr} ·{" "}
                          {SENTENCE_TYPE_LABELS[row.entry.type].de}
                        </div>
                      </div>
                      <span
                        className={`ww-mono shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          row.isDuplicate
                            ? "bg-[#CB9146]/20 text-[#8A5B1A]"
                            : "bg-[#3F8C5F]/15 text-[#1F5637]"
                        }`}
                      >
                        {row.isDuplicate ? "Διπλότυπο" : "Νέα"}
                      </span>
                    </div>

                    {row.duplicateMatch && (
                      <div className="text-[11px] text-[#8A5B1A]">
                        Ταιριάζει με{" "}
                        {row.duplicateSource === "existing" ? "υπάρχουσα" : "προηγούμενη στη λίστα"}
                        : «{row.duplicateMatch.sentence}» ({row.duplicateMatch.id})
                      </div>
                    )}

                    <select
                      aria-label={`Ενέργεια για ${row.entry.sentence}`}
                      value={row.action}
                      onChange={(e) => {
                        const action = e.target.value as SentenceImportReviewRow["action"];
                        setReviewRows((prev) =>
                          prev ? prev.map((r, j) => (j === idx ? { ...r, action } : r)) : null,
                        );
                      }}
                      className="w-full rounded-xl border border-[#E8E0CE] bg-white px-3 py-2 text-xs text-[#211F1C]"
                    >
                      <option value="skip">Παράλειψη</option>
                      {row.isDuplicate && row.duplicateSource === "existing" && (
                        <option value="replace">Ενημέρωση υπάρχουσας (διατήρηση προόδου)</option>
                      )}
                      <option value="add">
                        {row.isDuplicate ? "Προσθήκη ως ξεχωριστή εγγραφή" : "Προσθήκη"}
                      </option>
                    </select>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2.5">
                <button
                  type="button"
                  onClick={handleConfirmJsonImport}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#3F8C5F] py-3 text-xs font-semibold text-white"
                >
                  <Check size={15} /> Επιβεβαίωση εισαγωγής
                </button>
                <button
                  type="button"
                  onClick={() => setReviewRows(null)}
                  className="rounded-full border border-[#E8E0CE] bg-white px-4 py-3 text-xs font-semibold text-[#4A453D]"
                >
                  Ακύρωση
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MANUAL FORM / EDIT MODE */}
      {(editingEntry || mode === "form") && (
        <form
          onSubmit={(e) => handleSubmitForm(e, false)}
          className="ww-tag-card mt-4 space-y-3.5 p-5"
        >
          <div>
            <label className="text-xs font-semibold text-[#4A453D]">
              Γερμανική πρόταση ή έκφραση *
            </label>
            <input
              type="text"
              required
              value={sentence}
              onChange={(e) => {
                setSentence(e.target.value);
                setFormDuplicateWarning(null);
              }}
              placeholder="π.χ. Könnten Sie mir bitte das Salz reichen?"
              className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#211F1C] outline-none focus:border-[#CB9146]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#4A453D]">Τύπος</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as SentenceType)}
                className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] px-3 py-2.5 text-xs text-[#211F1C]"
              >
                {SENTENCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SENTENCE_TYPE_LABELS[t].de} ({SENTENCE_TYPE_LABELS[t].el})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#4A453D]">Επίπεδο CEFR</label>
              <select
                value={cefr}
                onChange={(e) => setCefr(e.target.value as SentenceCefr)}
                className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] px-3 py-2.5 text-xs text-[#211F1C]"
              >
                {SENTENCE_CEFR_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#4A453D]">Ελληνική σημασία *</label>
            <input
              type="text"
              value={meaningEl}
              onChange={(e) => setMeaningEl(e.target.value)}
              placeholder="π.χ. Θα μπορούσατε να μου δώσετε το αλάτι, παρακαλώ;"
              className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#211F1C] outline-none focus:border-[#CB9146]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#4A453D]">Αγγλική σημασία</label>
            <input
              type="text"
              value={meaningEn}
              onChange={(e) => setMeaningEn(e.target.value)}
              placeholder="e.g. Could you please pass me the salt?"
              className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#211F1C] outline-none focus:border-[#CB9146]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-[#4A453D]">Περίσταση (Context)</label>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="π.χ. Am Esstisch / Im Büro"
                className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#211F1C] outline-none focus:border-[#CB9146]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#4A453D]">Γραμματική</label>
              <input
                type="text"
                value={grammar}
                onChange={(e) => setGrammar(e.target.value)}
                placeholder="π.χ. Konjunktiv II – höfliche Bitte"
                className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#211F1C] outline-none focus:border-[#CB9146]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#4A453D]">Χρήση (Usage)</label>
            <input
              type="text"
              value={usage}
              onChange={(e) => setUsage(e.target.value)}
              placeholder="Πότε και πώς χρησιμοποιείται αυτή η έκφραση;"
              className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#211F1C] outline-none focus:border-[#CB9146]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#4A453D]">Δομή (Structure)</label>
            <input
              type="text"
              value={structure}
              onChange={(e) => setStructure(e.target.value)}
              placeholder="π.χ. Könnten Sie mir bitte + [Akkusativ] + reichen?"
              className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#211F1C] outline-none focus:border-[#CB9146]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#4A453D]">
              Παραδείγματα (ένα ανά γραμμή: Γερμανικά | Ελληνικά)
            </label>
            <textarea
              rows={2}
              value={examplesText}
              onChange={(e) => setExamplesText(e.target.value)}
              placeholder="Entschuldigung, könnten Sie mir bitte das Salz reichen? | Συγγνώμη, θα μπορούσατε..."
              className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] p-3 text-xs text-[#211F1C] outline-none focus:border-[#CB9146]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-[#4A453D]">
                Εναλλακτικές (με κόμμα)
              </label>
              <input
                type="text"
                value={alternatives}
                onChange={(e) => setAlternatives(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] px-3.5 py-2.5 text-xs text-[#211F1C]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#4A453D]">Συνώνυμα (με κόμμα)</label>
              <input
                type="text"
                value={synonyms}
                onChange={(e) => setSynonyms(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] px-3.5 py-2.5 text-xs text-[#211F1C]"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-[#4A453D]">Memory Hook</label>
              <input
                type="text"
                value={memoryHook}
                onChange={(e) => setMemoryHook(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] px-3.5 py-2.5 text-xs text-[#211F1C]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#4A453D]">Tags (με κόμμα)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Alltag, Höflichkeit, B2"
                className="mt-1 w-full rounded-xl border border-[#E8E0CE] bg-[#FAF8F4] px-3.5 py-2.5 text-xs text-[#211F1C]"
              />
            </div>
          </div>

          {formDuplicateWarning && (
            <div
              role="alert"
              className="rounded-2xl border border-[#CB9146]/50 bg-[#CB9146]/12 p-3.5 text-xs text-[#7A5114]"
            >
              <div className="flex items-start gap-2 font-semibold">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  Αυτή η πρόταση υπάρχει ήδη ως «{formDuplicateWarning.sentence}» (
                  {formDuplicateWarning.id}).
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={(e) => handleSubmitForm(e, true)}
                  className="rounded-full bg-[#CB9146] px-4 py-2 text-xs font-semibold text-[#211F1C]"
                >
                  Προσθήκη ούτως ή άλλως
                </button>
                <button
                  type="button"
                  onClick={() => setFormDuplicateWarning(null)}
                  className="rounded-full border border-[#E8E0CE] bg-white px-4 py-2 text-xs font-semibold text-[#4A453D]"
                >
                  Ακύρωση
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-full bg-[#211F1C] py-3.5 text-sm font-semibold text-[#F5F0E6]"
          >
            {editingEntry ? "Αποθήκευση αλλαγών" : "Αποθήκευση πρότασης"}
          </button>
        </form>
      )}
    </div>
  );
}
