import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { List, PlusCircle, Sparkles, Dumbbell, BarChart3 } from "lucide-react";
import SENTENCES_SEED from "@/data/sentences.json";
import {
  SENTENCES_STORAGE_KEY,
  SENTENCES_META_KEY,
  DEFAULT_SENTENCE_META,
  applySentenceAnswer,
  applySentenceImport,
  isSentenceDue,
  mergeSentenceSeed,
  normalizeSentenceEntry,
  sentenceIdentityKey,
  updateSentenceMetaOnAnswer,
  type SentenceEntry,
  type SentenceMeta,
  type SentenceImportReviewRow,
  type SentenceAnswerVerdict,
  type SentenceExerciseMode,
} from "@/lib/sentences-data";
import SentenceListView from "./SentenceListView";
import SentenceAddView from "./SentenceAddView";
import SentenceLearnView from "./SentenceLearnView";
import SentenceExercisesView from "./SentenceExercisesView";
import SentenceStatsView from "./SentenceStatsView";

type SentencesSubTab = "list" | "add" | "learn" | "exercises" | "stats";

function readStorageItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota errors
  }
}

function loadInitialSentencesState(): { sentences: SentenceEntry[]; meta: SentenceMeta } {
  let meta: SentenceMeta = { ...DEFAULT_SENTENCE_META };
  const rawMeta = readStorageItem(SENTENCES_META_KEY);
  if (rawMeta) {
    try {
      const parsed = JSON.parse(rawMeta) as Partial<SentenceMeta>;
      meta = {
        streak: typeof parsed.streak === "number" ? parsed.streak : 0,
        lastDate: typeof parsed.lastDate === "string" ? parsed.lastDate : "",
        dailyLog: parsed.dailyLog && typeof parsed.dailyLog === "object" ? parsed.dailyLog : {},
        deletedKeys: Array.isArray(parsed.deletedKeys) ? parsed.deletedKeys : [],
      };
    } catch {
      meta = { ...DEFAULT_SENTENCE_META };
    }
  }

  const seedRaw = SENTENCES_SEED as unknown as Record<string, unknown>[];
  const rawList = readStorageItem(SENTENCES_STORAGE_KEY);
  if (rawList) {
    try {
      const parsed = JSON.parse(rawList) as Record<string, unknown>[];
      if (Array.isArray(parsed)) {
        const storedNorm = parsed.map((item, idx) =>
          normalizeSentenceEntry(item, `S${String(idx + 1).padStart(4, "0")}`),
        );
        const merged = mergeSentenceSeed(storedNorm, seedRaw, meta.deletedKeys);
        if (merged.length !== storedNorm.length) {
          writeStorageItem(SENTENCES_STORAGE_KEY, JSON.stringify(merged));
        }
        return { sentences: merged, meta };
      }
    } catch {
      // Fallback to seed below
    }
  }

  const seeded = seedRaw.map((item, idx) =>
    normalizeSentenceEntry(item, `S${String(idx + 1).padStart(4, "0")}`),
  );
  writeStorageItem(SENTENCES_STORAGE_KEY, JSON.stringify(seeded));
  return { sentences: seeded, meta };
}

interface Props {
  onDueCountChange?: (count: number) => void;
}

export default function SentencesModule({ onDueCountChange }: Props) {
  const [subTab, setSubTab] = useState<SentencesSubTab>("list");
  const [state, setState] = useState<{ sentences: SentenceEntry[]; meta: SentenceMeta }>(() =>
    loadInitialSentencesState(),
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const [editingEntry, setEditingEntry] = useState<SentenceEntry | null>(null);

  const { sentences, meta } = state;

  const dueCount = useMemo(() => sentences.filter((s) => isSentenceDue(s)).length, [sentences]);

  useEffect(() => {
    onDueCountChange?.(dueCount);
  }, [dueCount, onDueCountChange]);

  const commitState = useCallback(
    (next: { sentences: SentenceEntry[]; meta: SentenceMeta }, persistMetaFlag = false) => {
      stateRef.current = next;
      setState(next);
      writeStorageItem(SENTENCES_STORAGE_KEY, JSON.stringify(next.sentences));
      if (persistMetaFlag) {
        writeStorageItem(SENTENCES_META_KEY, JSON.stringify(next.meta));
      }
    },
    [],
  );

  const handleImportRows = useCallback(
    (rows: SentenceImportReviewRow[]) => {
      const prev = stateRef.current;
      const res = applySentenceImport(prev.sentences, rows);
      const importedKeys = new Set(
        rows.filter((r) => r.action !== "skip").map((r) => sentenceIdentityKey(r.entry.sentence)),
      );
      const nextDeleted = prev.meta.deletedKeys.filter((k) => !importedKeys.has(k));
      const metaChanged = nextDeleted.length !== prev.meta.deletedKeys.length;
      const nextMeta = metaChanged ? { ...prev.meta, deletedKeys: nextDeleted } : prev.meta;
      commitState({ sentences: res.next, meta: nextMeta }, metaChanged);
      return { added: res.added, replaced: res.replaced, skipped: res.skipped };
    },
    [commitState],
  );

  const handleSaveEdited = useCallback(
    (updated: SentenceEntry) => {
      const prev = stateRef.current;
      const nextSentences = prev.sentences.map((s) => (s.id === updated.id ? updated : s));
      commitState({ ...prev, sentences: nextSentences }, false);
      setEditingEntry(null);
      setSubTab("list");
    },
    [commitState],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const prev = stateRef.current;
      const target = prev.sentences.find((s) => s.id === id);
      const nextSentences = prev.sentences.filter((s) => s.id !== id);
      const key = target ? sentenceIdentityKey(target.sentence) : "";
      const deletedKeys = key
        ? Array.from(new Set([...prev.meta.deletedKeys, key]))
        : prev.meta.deletedKeys;
      const nextMeta = { ...prev.meta, deletedKeys };
      commitState({ sentences: nextSentences, meta: nextMeta }, true);
    },
    [commitState],
  );

  const handleRecordAnswer = useCallback(
    (
      entryId: string,
      payload: {
        mode: SentenceExerciseMode;
        verdict: SentenceAnswerVerdict;
        hintUsed: boolean;
        promptKey: string;
      },
    ): SentenceEntry | null => {
      const prev = stateRef.current;
      const ts = Date.now();
      let updatedItem: SentenceEntry | null = null;
      const nextSentences = prev.sentences.map((s) => {
        if (s.id !== entryId) return s;
        const nextEntry = applySentenceAnswer(s, { ...payload, timestamp: ts });
        updatedItem = nextEntry;
        return nextEntry;
      });
      const nextMeta = updateSentenceMetaOnAnswer(
        prev.meta,
        entryId,
        payload.verdict !== "wrong",
        payload.mode,
        ts,
      );
      commitState({ sentences: nextSentences, meta: nextMeta }, true);
      return updatedItem;
    },
    [commitState],
  );

  const navItems: Array<{
    id: SentencesSubTab;
    label: string;
    icon: typeof List;
    isCenter?: boolean;
  }> = [
    { id: "list", label: "Alle Sätze", icon: List },
    { id: "add", label: "Neue hinzufügen", icon: PlusCircle },
    { id: "learn", label: "Lernen", icon: Sparkles, isCenter: true },
    { id: "exercises", label: "Übungen", icon: Dumbbell },
    { id: "stats", label: "Fortschritt", icon: BarChart3 },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 pb-4">
        {subTab === "list" && (
          <SentenceListView
            sentences={sentences}
            onOpenAdd={() => {
              setEditingEntry(null);
              setSubTab("add");
            }}
            onEdit={(entry) => {
              setEditingEntry(entry);
              setSubTab("add");
            }}
            onDelete={handleDelete}
          />
        )}

        {subTab === "add" && (
          <SentenceAddView
            key={editingEntry?.id ?? "new"}
            existing={sentences}
            editingEntry={editingEntry}
            onImportRows={handleImportRows}
            onSaveEdited={handleSaveEdited}
            onCancelEdit={() => {
              setEditingEntry(null);
              setSubTab("list");
            }}
            onGoToList={() => {
              setEditingEntry(null);
              setSubTab("list");
            }}
          />
        )}

        {subTab === "learn" && (
          <SentenceLearnView
            sentences={sentences}
            meta={meta}
            onRecordAnswer={handleRecordAnswer}
            onOpenExercises={() => setSubTab("exercises")}
          />
        )}

        {subTab === "exercises" && (
          <SentenceExercisesView sentences={sentences} onRecordAnswer={handleRecordAnswer} />
        )}

        {subTab === "stats" && <SentenceStatsView sentences={sentences} meta={meta} />}
      </div>

      {/* Dedicated Bottom Navigation for Sätze & Ausdrücke matching WortWerk aesthetic */}
      <nav
        aria-label="Πλοήγηση Sätze & Ausdrücke"
        className="sticky right-0 bottom-0 left-0 z-20 grid grid-cols-5 items-end border-t border-[#ECE4D3] bg-[#FDFAF3]/95 px-1.5 pt-1.5 pb-[calc(8px+env(safe-area-inset-bottom))] backdrop-blur-md"
      >
        {navItems.map((it) => {
          const Icon = it.icon;
          const active = subTab === it.id;
          return (
            <button
              key={it.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (it.id !== "add") setEditingEntry(null);
                setSubTab(it.id);
              }}
              className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1 transition ${
                active ? "text-[#B5542E]" : "text-[#8B8680]"
              }`}
            >
              {it.isCenter ? (
                <span
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full transition ${
                    active ? "bg-[#211F1C] text-[#F5F0E6]" : "bg-[#ECE4D3] text-[#211F1C]"
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2.3 : 1.9} />
                  {dueCount > 0 && (
                    <span className="ww-mono absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C1543C] px-1 text-[9px] text-white">
                      {dueCount}
                    </span>
                  )}
                </span>
              ) : (
                <Icon size={20} strokeWidth={active ? 2.3 : 1.8} />
              )}
              <span
                className={`max-w-full truncate text-[10px] ${
                  active || it.isCenter ? "font-semibold" : "font-normal"
                }`}
              >
                {it.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
