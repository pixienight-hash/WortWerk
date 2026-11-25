import React, { useState, useMemo } from "react";
import { Search, Volume2, X, Pencil, Trash2, Check, Download, Plus, Sparkles } from "lucide-react";
import {
  SENTENCE_TYPES,
  SENTENCE_CEFR_LEVELS,
  SENTENCE_TYPE_LABELS,
  SENTENCE_STATUS_LABELS,
  computeSentenceMastery,
  type SentenceEntry,
  type SentenceType,
  type SentenceCefr,
  type SentenceMasteryStatus,
} from "@/lib/sentences-data";
import { useAppLang, sentencePrimaryMeaning, sentenceSecondaryMeaning } from "@/lib/i18n";
import { speakGerman } from "./SentencePracticeRunner";

interface Props {
  sentences: SentenceEntry[];
  onOpenAdd: () => void;
  onEdit: (entry: SentenceEntry) => void;
  onDelete: (id: string) => void;
}

const STATUS_OPTIONS: readonly SentenceMasteryStatus[] = [
  "new",
  "learning",
  "consolidating",
  "mastered",
  "retained",
];

export default function SentenceListView({ sentences, onOpenAdd, onEdit, onDelete }: Props) {
  const { lang, isEn, t } = useAppLang();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SentenceType | "all">("all");
  const [cefrFilter, setCefrFilter] = useState<SentenceCefr | "all">("all");
  const [statusFilter, setStatusFilter] = useState<SentenceMasteryStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selected = useMemo(
    () => sentences.find((s) => s.id === selectedId) ?? null,
    [sentences, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sentences.filter((s) => {
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (cefrFilter !== "all" && s.cefr !== cefrFilter) return false;
      if (statusFilter !== "all" && computeSentenceMastery(s).status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.sentence.toLowerCase().includes(q) ||
        s.meaning.el.toLowerCase().includes(q) ||
        s.meaning.en.toLowerCase().includes(q) ||
        s.context.toLowerCase().includes(q) ||
        s.usage.toLowerCase().includes(q) ||
        s.tags.some((tg) => tg.toLowerCase().includes(q))
      );
    });
  }, [sentences, query, typeFilter, cefrFilter, statusFilter]);

  function exportSentencesJson() {
    const blob = new Blob([JSON.stringify(sentences, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wortwerk-saetze-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const availableCefrs = SENTENCE_CEFR_LEVELS.filter((lvl) =>
    sentences.some((s) => s.cefr === lvl),
  );

  const chipClass = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
      active
        ? "border-[#211F1C] bg-[#211F1C] text-[#F5F0E6]"
        : "border-[#E8E0CE] bg-white/70 text-[#6B655D]"
    }`;

  return (
    <div className="px-5 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="ww-display text-[26px] font-semibold leading-tight text-[#211F1C]">
            Alle Sätze
          </h1>
          <p className="mt-0.5 text-[13px] text-[#8B8680]">
            {t(
              `${sentences.length} προτάσεις & εκφράσεις · ανεξάρτητη συλλογή`,
              `${sentences.length} sentences & expressions · independent collection`,
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportSentencesJson}
            aria-label={t("Εξαγωγή προτάσεων JSON", "Export sentences JSON")}
            title={t("Εξαγωγή JSON", "Export JSON")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E8E0CE] bg-white text-[#4A453D]"
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            onClick={onOpenAdd}
            aria-label={t("Προσθήκη νέας πρότασης", "Add new sentence")}
            className="flex h-10 items-center gap-1.5 rounded-full bg-[#CB9146] px-3.5 text-xs font-semibold text-[#211F1C]"
          >
            <Plus size={15} />
            <span>{t("Νέα", "New")}</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mt-4">
        <Search size={16} className="pointer-events-none absolute top-3 left-3.5 text-[#A79F8E]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(
            "Αναζήτηση (Deutsch / Ελληνικά / English / Περίσταση)…",
            "Search (Deutsch / English / Greek / Context)…",
          )}
          className="w-full rounded-xl border border-[#E8E0CE] bg-white py-2.5 pr-4 pl-10 text-sm text-[#211F1C] outline-none focus:border-[#CB9146]"
        />
      </div>

      {/* Type filter */}
      <div className="ww-scrollbar-none mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setTypeFilter("all")}
          className={chipClass(typeFilter === "all")}
        >
          {t("Όλοι οι τύποι", "All types")}
        </button>
        {SENTENCE_TYPES.map((tp) => (
          <button
            key={tp}
            type="button"
            onClick={() => setTypeFilter(tp)}
            className={chipClass(typeFilter === tp)}
          >
            {SENTENCE_TYPE_LABELS[tp].de}
          </button>
        ))}
      </div>

      {/* CEFR & Status filter row */}
      <div className="ww-scrollbar-none mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setCefrFilter("all")}
          className={chipClass(cefrFilter === "all")}
        >
          {t("Όλα τα CEFR", "All CEFR")}
        </button>
        {availableCefrs.map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => setCefrFilter(lvl)}
            className={chipClass(cefrFilter === lvl)}
          >
            {lvl}
          </button>
        ))}
        <span className="mx-1 self-center text-[#D9D2C0]">|</span>
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={chipClass(statusFilter === "all")}
        >
          {t("Όλα τα status", "All statuses")}
        </button>
        {STATUS_OPTIONS.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={chipClass(statusFilter === st)}
          >
            {SENTENCE_STATUS_LABELS[st].label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-4 flex flex-col gap-2.5">
        {filtered.length === 0 && (
          <div className="ww-tag-card p-8 text-center text-sm text-[#8B8680]">
            {t(
              "Δεν βρέθηκαν προτάσεις με αυτά τα κριτήρια.",
              "No sentences match these filters.",
            )}
          </div>
        )}
        {filtered.map((s) => {
          const typeMeta = SENTENCE_TYPE_LABELS[s.type];
          const report = computeSentenceMastery(s);
          const statusMeta = SENTENCE_STATUS_LABELS[report.status];
          return (
            <div
              key={s.id}
              className="ww-tag-card flex items-start justify-between gap-3 p-4 transition hover:border-[#D9CEB8]"
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedId(s.id);
                  setConfirmDelete(false);
                }}
                className="flex-1 text-left"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="ww-mono rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ color: typeMeta.color, background: typeMeta.bg }}
                  >
                    {typeMeta.de}
                  </span>
                  <span className="ww-mono rounded-full bg-[#ECE4D3] px-2 py-0.5 text-[10px] font-semibold text-[#4A453D]">
                    {s.cefr}
                  </span>
                  <span
                    className="ww-mono rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ color: statusMeta.color, background: statusMeta.bg }}
                  >
                    {statusMeta.label}
                  </span>
                  <span className="ww-mono text-[10px] text-[#A79F8E]">{s.id}</span>
                </div>
                <div className="ww-display mt-2 text-[17px] font-semibold leading-snug text-[#211F1C]">
                  {s.sentence}
                </div>
                <div className="mt-1 text-[13px] text-[#5E584F]">
                  {sentencePrimaryMeaning(s, lang)}
                </div>
                {s.context && <div className="mt-1 text-[11px] text-[#8B8680]">{s.context}</div>}
              </button>
              <button
                type="button"
                onClick={() => speakGerman(s.sentence)}
                aria-label={t(`Ακρόαση ${s.sentence}`, `Listen to ${s.sentence}`)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F0E6] text-[#4A453D]"
              >
                <Volume2 size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Detail Bottom Sheet Modal */}
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selected.sentence}
          onClick={() => {
            setSelectedId(null);
            setConfirmDelete(false);
          }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="ww-pop max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl"
          >
            {(() => {
              const typeMeta = SENTENCE_TYPE_LABELS[selected.type];
              const report = computeSentenceMastery(selected);
              const statusMeta = SENTENCE_STATUS_LABELS[report.status];
              const primaryM = sentencePrimaryMeaning(selected, lang);
              const secondaryM = sentenceSecondaryMeaning(selected, lang);
              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="ww-mono rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                        style={{ color: typeMeta.color, background: typeMeta.bg }}
                      >
                        {typeMeta.de} · {isEn ? typeMeta.en : typeMeta.el}
                      </span>
                      <span className="ww-mono rounded-full bg-[#ECE4D3] px-2 py-0.5 text-[10px] font-semibold text-[#4A453D]">
                        {selected.cefr}
                      </span>
                      <span
                        className="ww-mono rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ color: statusMeta.color, background: statusMeta.bg }}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(null);
                        setConfirmDelete(false);
                      }}
                      aria-label={t("Κλείσιμο λεπτομερειών", "Close details")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ECE4D3] text-[#4A453D]"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="mt-3 flex items-start justify-between gap-3">
                    <h2 className="ww-display text-2xl font-bold leading-snug text-[#211F1C]">
                      {selected.sentence}
                    </h2>
                    <button
                      type="button"
                      onClick={() => speakGerman(selected.sentence)}
                      aria-label={t("Ακρόαση πρότασης", "Listen to sentence")}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5F0E6] text-[#211F1C]"
                    >
                      <Volume2 size={17} />
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl bg-[#F5F0E6] p-4">
                    {primaryM && (
                      <div className="text-[15px] font-semibold text-[#211F1C]">{primaryM}</div>
                    )}
                    {secondaryM && (
                      <div className="mt-1 text-xs text-[#6B655D]">{secondaryM}</div>
                    )}
                  </div>

                  {(selected.context || selected.usage) && (
                    <div className="mt-4 space-y-1.5 text-sm">
                      {selected.context && (
                        <div>
                          <span className="font-semibold text-[#211F1C]">
                            {t("Περίσταση: ", "Context: ")}
                          </span>
                          <span className="text-[#5E584F]">{selected.context}</span>
                        </div>
                      )}
                      {selected.usage && (
                        <div>
                          <span className="font-semibold text-[#211F1C]">
                            {t("Χρήση: ", "Usage: ")}
                          </span>
                          <span className="text-[#5E584F]">{selected.usage}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {(selected.grammar || selected.structure) && (
                    <div className="mt-4 rounded-2xl border border-[#ECE4D3] bg-[#FAF8F4] p-3.5 text-xs">
                      {selected.grammar && (
                        <div className="text-[#4A453D]">
                          <span className="font-semibold text-[#211F1C]">
                            {t("Γραμματική: ", "Grammar: ")}
                          </span>
                          {selected.grammar}
                        </div>
                      )}
                      {selected.structure && (
                        <div className="mt-1.5 text-[#4A453D]">
                          <span className="font-semibold text-[#211F1C]">
                            {t("Δομή: ", "Structure: ")}
                          </span>
                          <span className="ww-mono text-[11px]">{selected.structure}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {selected.examples.length > 0 && (
                    <div className="mt-4">
                      <div className="ww-mono text-[10px] font-semibold uppercase tracking-wider text-[#8B8680]">
                        {t("Παραδείγματα", "Examples")}
                      </div>
                      <div className="mt-1.5 space-y-2">
                        {selected.examples.map((ex, idx) => {
                          const trans = isEn ? ex.en || ex.el : ex.el || ex.en;
                          return (
                            <div
                              key={idx}
                              className="rounded-xl bg-[#F5F0E6]/70 px-3.5 py-2.5 text-xs"
                            >
                              <div className="font-medium text-[#211F1C]">{ex.de}</div>
                              {trans && <div className="mt-0.5 text-[#6B655D]">{trans}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(selected.alternatives.length > 0 || selected.synonyms.length > 0) && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {selected.alternatives.length > 0 && (
                        <div>
                          <div className="ww-mono text-[10px] font-semibold uppercase tracking-wider text-[#8B8680]">
                            {t("Εναλλακτικές", "Alternatives")}
                          </div>
                          <ul className="mt-1 space-y-1 text-xs text-[#4A453D]">
                            {selected.alternatives.map((a, i) => (
                              <li key={i}>• {a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selected.synonyms.length > 0 && (
                        <div>
                          <div className="ww-mono text-[10px] font-semibold uppercase tracking-wider text-[#8B8680]">
                            {t("Συνώνυμα", "Synonyms")}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {selected.synonyms.map((syn, i) => (
                              <span
                                key={i}
                                className="rounded-full bg-[#ECE4D3] px-2.5 py-0.5 text-xs text-[#4A453D]"
                              >
                                {syn}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selected.memoryHook && (
                    <div className="mt-4 flex items-start gap-2 rounded-2xl border border-[#E8DFC8] bg-[#FCF8EE] p-3 text-xs text-[#6B4F1D]">
                      <Sparkles size={14} className="mt-0.5 shrink-0 text-[#CB9146]" />
                      <span>{selected.memoryHook}</span>
                    </div>
                  )}

                  {/* Independent Mastery Progress */}
                  <div className="mt-4 rounded-2xl border border-[#ECE4D3] p-3.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#211F1C]">
                      <span>{t("Πρόοδος Κατάκτησης (Sätze)", "Mastery Progress (Sätze)")}</span>
                      <span className="ww-mono text-[11px] text-[#8B8680]">
                        {selected.learning.timesCorrect}/{selected.learning.timesSeen}{" "}
                        {t("σωστές", "correct")}
                      </span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                      {[
                        {
                          label: t(
                            `Ενεργές επιτυχίες (${report.activeSuccesses}/3)`,
                            `Active successes (${report.activeSuccesses}/3)`,
                          ),
                          ok: report.requirements.activeSuccesses,
                        },
                        {
                          label: t("Πλήρης γραφή Schreiben", "Full written recall (Schreiben)"),
                          ok: report.requirements.writtenRecall,
                        },
                        {
                          label: t(
                            `Ενεργά είδη (${report.activeModesCount}/2)`,
                            `Active modes (${report.activeModesCount}/2)`,
                          ),
                          ok: report.requirements.twoActiveModes,
                        },
                        {
                          label: t(
                            `Καθυστερημένη αλυσίδα (${report.delayedSteps}/2)`,
                            `Delayed chain (${report.delayedSteps}/2)`,
                          ),
                          ok: report.requirements.delayedChain,
                        },
                      ].map((req, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 text-[11px] text-[#5E584F]"
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                              req.ok ? "bg-[#3F8C5F] text-white" : "bg-[#ECE4D3] text-[#A79F8E]"
                            }`}
                          >
                            <Check size={10} />
                          </span>
                          <span>{req.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  {!confirmDelete ? (
                    <div className="mt-5 flex gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          const target = selected;
                          setSelectedId(null);
                          onEdit(target);
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#E8E0CE] bg-[#F5F0E6] py-3 text-xs font-semibold text-[#211F1C]"
                      >
                        <Pencil size={14} /> {t("Επεξεργασία", "Edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="flex items-center justify-center gap-1.5 rounded-full border border-[#C1543C]/30 bg-[#C1543C]/10 px-4 py-3 text-xs font-semibold text-[#C1543C]"
                      >
                        <Trash2 size={14} /> {t("Διαγραφή", "Delete")}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-[#C1543C]/40 bg-[#C1543C]/10 p-3.5">
                      <p className="text-xs font-semibold text-[#8A2F1C]">
                        {t(
                          "Σίγουρα θέλεις να διαγράψεις αυτή την πρόταση από τα Sätze & Ausdrücke;",
                          "Are you sure you want to delete this sentence from Sätze & Ausdrücke?",
                        )}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const id = selected.id;
                            setSelectedId(null);
                            setConfirmDelete(false);
                            onDelete(id);
                          }}
                          className="flex-1 rounded-full bg-[#C1543C] py-2.5 text-xs font-semibold text-white"
                        >
                          {t("Επιβεβαίωση διαγραφής", "Confirm delete")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 rounded-full border border-[#E8E0CE] bg-white py-2.5 text-xs font-semibold text-[#211F1C]"
                        >
                          {t("Ακύρωση", "Cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
