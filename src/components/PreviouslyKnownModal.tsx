import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { isPreviouslyKnown, normalizedWord, type Word } from "@/lib/wortwerk-data";

type Props = {
  vocab: Word[];
  onClose: () => void;
  onSave: (selectedIds: Set<string>) => void;
};

export default function PreviouslyKnownModal({ vocab, onClose, onSave }: Props) {
  const initialSelected = useMemo(
    () => new Set((vocab || []).filter(isPreviouslyKnown).map((w) => String(w.id))),
    [vocab],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialSelected));
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "selected">("all");

  const filtered = useMemo(() => {
    const q = normalizedWord(query);
    return (vocab || []).filter((w) => {
      if (viewMode === "selected" && !selectedIds.has(String(w.id))) return false;
      if (!q) return true;
      const hitWord = normalizedWord(w.word).includes(q);
      const hitGreek = ((w.meaning && w.meaning.greek) || []).some((g: string) =>
        normalizedWord(g).includes(q),
      );
      return hitWord || hitGreek;
    });
  }, [vocab, query, viewMode, selectedIds]);

  const changesCount = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const id of selectedIds) {
      if (!initialSelected.has(id)) added++;
    }
    for (const id of initialSelected) {
      if (!selectedIds.has(id)) removed++;
    }
    return { added, removed, total: added + removed };
  }, [initialSelected, selectedIds]);

  function toggleWord(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Γνωρίζω ήδη"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#211F1C]/45 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-3xl bg-[#FFFFFF] text-[#211F1C] shadow-xl sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#ECE4D3] px-5 pb-3.5 pt-5">
          <div className="min-w-0">
            <h2 className="ww-display text-[22px] font-bold leading-tight text-[#211F1C]">
              Γνωρίζω ήδη
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#6B655B]">
              Επίλεξε λέξεις που ήδη ξέρεις καλά. Θα εμφανίζονται σπάνια στα τεστ (~10%) χωρίς να
              μετρούν ως κατάκτηση του WortWerk.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Κλείσιμο"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5F0E6] text-[#4A453D] transition-colors hover:bg-[#ECE4D3]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Search & filter controls */}
        <div className="border-b border-[#ECE4D3] bg-[#FAF7F0] px-5 py-3">
          <div className="relative">
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A79F8E]"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Αναζήτηση στη λίστα λέξεων"
              placeholder="Αναζήτηση λέξης (Deutsch / Ελληνικά)…"
              className="h-10 w-full rounded-xl border border-[#E8E0CE] bg-[#FFFFFF] pl-9 pr-3 text-sm text-[#211F1C] outline-none focus:border-[#4FA091]"
            />
          </div>

          <div
            role="group"
            aria-label="Φίλτρο προβολής"
            className="mt-2.5 grid grid-cols-2 gap-1 rounded-lg bg-[#ECE4D3]/60 p-1"
          >
            <button
              type="button"
              aria-pressed={viewMode === "all"}
              onClick={() => setViewMode("all")}
              className={`min-h-[34px] rounded-md px-2 text-xs font-semibold transition-colors ${
                viewMode === "all"
                  ? "bg-[#FFFFFF] text-[#211F1C] shadow-xs"
                  : "text-[#6B655B] hover:text-[#211F1C]"
              }`}
            >
              Όλες ({vocab.length})
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "selected"}
              onClick={() => setViewMode("selected")}
              className={`min-h-[34px] rounded-md px-2 text-xs font-semibold transition-colors ${
                viewMode === "selected"
                  ? "bg-[#FFFFFF] text-[#211F1C] shadow-xs"
                  : "text-[#6B655B] hover:text-[#211F1C]"
              }`}
            >
              Επιλεγμένες ({selectedIds.size})
            </button>
          </div>
        </div>

        {/* Scrollable word checklist */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#8B8680]">
              {viewMode === "selected"
                ? "Δεν έχεις επιλέξει ακόμα λέξεις."
                : "Δεν βρέθηκαν λέξεις."}
            </div>
          ) : (
            <ul className="divide-y divide-[#F1EBDF]">
              {filtered.map((w) => {
                const id = String(w.id);
                const checked = selectedIds.has(id);
                const greek = ((w.meaning && w.meaning.greek) || []).join(", ");
                const metaLine = [w.cefr, w.type].filter(Boolean).join(" · ");
                return (
                  <li key={id}>
                    <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-[#FAF7F0]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleWord(id)}
                        className="h-5 w-5 shrink-0 cursor-pointer rounded border-[#C9C1B2] accent-[#4FA091]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[14.5px] font-semibold text-[#211F1C]">
                            {w.word}
                          </span>
                          {metaLine && (
                            <span className="ww-mono shrink-0 text-[10.5px] text-[#8B8680]">
                              {metaLine}
                            </span>
                          )}
                        </div>
                        {greek && <div className="truncate text-xs text-[#6B655B]">{greek}</div>}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Sticky Save / Cancel footer */}
        <div className="border-t border-[#ECE4D3] bg-[#FFFFFF] px-5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3">
          <div className="mb-2.5 flex items-center justify-between text-xs text-[#6B655B] tabular-nums">
            <span>
              Επιλεγμένες:{" "}
              <strong className="font-semibold text-[#211F1C]">{selectedIds.size}</strong>
            </span>
            {changesCount.total > 0 && (
              <span className="ww-mono text-[11px] text-[#4FA091]">
                {changesCount.added > 0 ? `+${changesCount.added}` : ""}
                {changesCount.added > 0 && changesCount.removed > 0 ? " / " : ""}
                {changesCount.removed > 0 ? `-${changesCount.removed}` : ""}
              </span>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] flex-1 rounded-full border border-[#E8E0CE] bg-[#FAF7F0] px-4 text-sm font-semibold text-[#4A453D] transition-colors hover:bg-[#ECE4D3]"
            >
              Ακύρωση
            </button>
            <button
              type="button"
              onClick={() => onSave(selectedIds)}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-[#211F1C] px-4 text-sm font-bold text-[#F5F0E6] transition-opacity hover:opacity-95"
            >
              <Check size={16} aria-hidden="true" />
              <span>Αποθήκευση</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
