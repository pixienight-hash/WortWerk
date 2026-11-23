import React, { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Flame,
  Layers,
  Sparkles,
  Volume2,
  RotateCcw,
  X,
} from "lucide-react";
import {
  SENTENCE_TYPE_LABELS,
  SENTENCE_STATUS_LABELS,
  buildSentenceSession,
  computeSentenceMastery,
  computeSentenceStats,
  isSentenceDue,
  sortSentencesByPriority,
  type SentenceEntry,
  type SentenceMeta,
  type SentencePracticeQuestion,
  type SentenceAnswerVerdict,
  type SentenceExerciseMode,
} from "@/lib/sentences-data";
import SentencePracticeRunner, { speakGerman } from "./SentencePracticeRunner";

interface Props {
  sentences: SentenceEntry[];
  meta: SentenceMeta;
  onRecordAnswer: (
    entryId: string,
    payload: {
      mode: SentenceExerciseMode;
      verdict: SentenceAnswerVerdict;
      hintUsed: boolean;
      promptKey: string;
    },
  ) => SentenceEntry | null;
  onOpenExercises: () => void;
}

export default function SentenceLearnView({
  sentences,
  meta,
  onRecordAnswer,
  onOpenExercises,
}: Props) {
  const [activeSession, setActiveSession] = useState<{
    title: string;
    questions: SentencePracticeQuestion[];
    mode: "guided" | "mastery_focus";
  } | null>(null);
  const [flashcards, setFlashcards] = useState<SentenceEntry[] | null>(null);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const stats = useMemo(() => computeSentenceStats(sentences, meta), [sentences, meta]);
  const dueSentences = useMemo(
    () => sortSentencesByPriority(sentences.filter((s) => isSentenceDue(s))),
    [sentences],
  );
  const consolidatingOrReady = useMemo(
    () =>
      sentences.filter((s) => {
        const st = computeSentenceMastery(s).status;
        return st === "learning" || st === "consolidating";
      }),
    [sentences],
  );

  function startGuided() {
    const source = dueSentences.length > 0 ? dueSentences : sentences;
    const questions = buildSentenceSession(source, "guided", sentences, { limit: 10 });
    setActiveSession({
      title: "Ημερήσια Εκμάθηση (Sätze)",
      questions,
      mode: "guided",
    });
  }

  function startMasteryFocus() {
    const source = consolidatingOrReady.length > 0 ? consolidatingOrReady : sentences;
    const questions = buildSentenceSession(source, "schreiben", sentences, { limit: 8 });
    setActiveSession({
      title: "Ενεργή Ανάκληση (Schreiben)",
      questions,
      mode: "mastery_focus",
    });
  }

  function startFlashcards() {
    const deck = sortSentencesByPriority(sentences).slice(0, 15);
    setFlashcards(deck);
    setCardIdx(0);
    setFlipped(false);
  }

  // Active Practice Runner
  if (activeSession) {
    return (
      <SentencePracticeRunner
        questions={activeSession.questions}
        title={activeSession.title}
        onRecordAnswer={onRecordAnswer}
        onFinish={() => setActiveSession(null)}
        onRestart={() => {
          if (activeSession.mode === "guided") startGuided();
          else startMasteryFocus();
        }}
      />
    );
  }

  // Interactive Flashcards Deck (light exposure only, never inflates Mastered)
  if (flashcards && flashcards.length > 0) {
    const card = flashcards[cardIdx]!;
    const typeMeta = SENTENCE_TYPE_LABELS[card.type];
    const statusMeta = SENTENCE_STATUS_LABELS[computeSentenceMastery(card).status];

    function advanceCard(delta: number) {
      if (delta > 0) {
        onRecordAnswer(card.id, {
          mode: "flashcard",
          verdict: "exact",
          hintUsed: false,
          promptKey: `${card.id}::flashcard`,
        });
      }
      const next = cardIdx + delta;
      if (next >= flashcards!.length) {
        setFlashcards(null);
      } else if (next >= 0) {
        setCardIdx(next);
        setFlipped(false);
      }
    }

    return (
      <div className="px-5 py-4 pb-8">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setFlashcards(null)}
            aria-label="Κλείσιμο Flashcards"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ECE4D3] text-[#4A453D]"
          >
            <X size={16} />
          </button>
          <div className="text-center">
            <div className="text-xs font-semibold text-[#211F1C]">Flashcards (Μελέτη)</div>
            <div className="ww-mono text-[11px] text-[#8B8680]">
              {cardIdx + 1} / {flashcards.length}
            </div>
          </div>
          <button
            type="button"
            onClick={() => speakGerman(card.sentence)}
            aria-label="Ακρόαση κάρτας"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#211F1C] shadow-xs"
          >
            <Volume2 size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="ww-pop ww-tag-card mt-5 flex min-h-[300px] w-full flex-col justify-between p-6 text-left"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="ww-mono rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ color: typeMeta.color, background: typeMeta.bg }}
            >
              {typeMeta.de}
            </span>
            <span className="ww-mono rounded-full bg-[#ECE4D3] px-2 py-0.5 text-[10px] font-semibold text-[#4A453D]">
              {card.cefr}
            </span>
            <span
              className="ww-mono rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ color: statusMeta.color, background: statusMeta.bg }}
            >
              {statusMeta.label}
            </span>
          </div>

          <div className="my-6">
            <div className="ww-display text-2xl font-bold leading-snug text-[#211F1C]">
              {card.sentence}
            </div>
            {card.context && <div className="mt-2 text-xs text-[#8B8680]">{card.context}</div>}

            {flipped ? (
              <div className="ww-pop mt-5 space-y-2.5 border-t border-[#ECE4D3] pt-4">
                <div className="text-base font-semibold text-[#3F8C5F]">{card.meaning.el}</div>
                {card.meaning.en && <div className="text-xs text-[#6B655D]">{card.meaning.en}</div>}
                {card.usage && <div className="text-xs text-[#5E584F]">{card.usage}</div>}
                {card.grammar && (
                  <div className="rounded-xl bg-[#F5F0E6] px-3 py-2 text-xs text-[#4A453D]">
                    <strong>Γραμματική:</strong> {card.grammar}
                  </div>
                )}
                {card.memoryHook && (
                  <div className="text-xs text-[#8A5B1A]">💡 {card.memoryHook}</div>
                )}
              </div>
            ) : (
              <div className="mt-8 text-xs text-[#A79F8E]">
                Πάτησε την κάρτα για να δεις σημασία, χρήση &amp; γραμματική…
              </div>
            )}
          </div>

          <div className="text-[11px] text-[#A79F8E]">
            Οι Flashcards χρησιμεύουν για εξοικείωση · η κατάκτηση γίνεται μέσω ενεργών ασκήσεων.
          </div>
        </button>

        <div className="mt-4 flex items-center gap-2.5">
          <button
            type="button"
            disabled={cardIdx === 0}
            onClick={() => advanceCard(-1)}
            className="flex items-center justify-center gap-1 rounded-full border border-[#E8E0CE] bg-white px-4 py-3 text-xs font-semibold text-[#211F1C] disabled:opacity-40"
          >
            <ChevronLeft size={15} /> Προηγούμενη
          </button>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#E8E0CE] bg-[#F5F0E6] py-3 text-xs font-semibold text-[#211F1C]"
          >
            <RotateCcw size={14} /> {flipped ? "Απόκρυψη" : "Αποκάλυψη"}
          </button>
          <button
            type="button"
            onClick={() => advanceCard(1)}
            className="flex items-center justify-center gap-1 rounded-full bg-[#211F1C] px-5 py-3 text-xs font-semibold text-[#F5F0E6]"
          >
            {cardIdx + 1 >= flashcards.length ? "Τέλος" : "Επόμενη"} <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-8">
      <div>
        <div className="flex items-center gap-1.5 text-[#A79F8E]">
          <span className="ww-mono text-[11px] uppercase tracking-wider">
            Sätze &amp; Ausdrücke
          </span>
        </div>
        <h1 className="ww-display mt-0.5 text-[28px] font-bold leading-tight text-[#211F1C]">
          Lernen
        </h1>
      </div>

      {/* Top metric row */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="ww-tag-card p-4">
          <div className="ww-display text-2xl font-bold text-[#211F1C]">
            {stats.byStatus.mastered + stats.byStatus.retained}
            <span className="text-sm font-normal text-[#8B8680]"> / {stats.total}</span>
          </div>
          <div className="mt-0.5 text-xs text-[#8B8680]">Mastered &amp; Retained</div>
        </div>
        <div className="ww-tag-card p-4">
          <div className="flex items-center gap-1.5">
            <Flame size={20} className="text-[#C1543C]" />
            <span className="ww-display text-2xl font-bold text-[#211F1C]">{stats.streak}</span>
          </div>
          <div className="mt-0.5 text-xs text-[#8B8680]">Ημέρες σειράς (Sätze)</div>
        </div>
      </div>

      {/* Hero Guided Session Card */}
      <div className="ww-hero-card mt-4 p-6 text-[#F5F0E6]">
        <div className="text-xs text-[#F5F0E6]/65">Πρόγραμμα επανάληψης προτάσεων</div>
        <div className="ww-display mt-1.5 text-3xl font-bold">
          {dueSentences.length > 0
            ? `${dueSentences.length} προς επανάληψη`
            : `${sentences.length} προτάσεις`}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#F5F0E6]/75">
          Επιλέγει αυτόματα τις πιο επείγουσες προτάσεις και την άσκηση που χρειάζεται η καθεμία για
          να φτάσει σε Mastered &amp; Retained.
        </p>

        <button
          type="button"
          onClick={startGuided}
          disabled={sentences.length === 0}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#F5F0E6] py-3.5 text-sm font-bold text-[#211F1C] disabled:opacity-50"
        >
          Έναρξη εκμάθησης <ChevronRight size={16} />
        </button>

        <button
          type="button"
          onClick={startFlashcards}
          disabled={sentences.length === 0}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-full border border-[#F5F0E6]/25 bg-[#F5F0E6]/10 py-3 text-xs font-semibold text-[#F5F0E6] disabled:opacity-50"
        >
          <Layers size={14} /> Flashcards (Μελέτη καρτών)
        </button>
      </div>

      {/* Quick Mastery Focus & Exercises Shortcut */}
      <div className="mt-4 space-y-2.5">
        <button
          type="button"
          onClick={startMasteryFocus}
          disabled={sentences.length === 0}
          className="ww-tag-card flex w-full items-center justify-between gap-3 p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#B5542E]/12 text-[#B5542E]">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#211F1C]">
                Πλήρης Ανάκληση (Schreiben)
              </div>
              <div className="text-xs text-[#8B8680]">
                {consolidatingOrReady.length > 0
                  ? `${consolidatingOrReady.length} προτάσεις σε εξέλιξη προς Mastered`
                  : "Γράψε ολόκληρες προτάσεις από μνήμης"}
              </div>
            </div>
          </div>
          <ChevronRight size={17} className="text-[#8B8680]" />
        </button>

        <button
          type="button"
          onClick={onOpenExercises}
          className="ww-tag-card flex w-full items-center justify-between gap-3 p-4 text-left"
        >
          <div>
            <div className="text-sm font-semibold text-[#211F1C]">
              Επιλογή συγκεκριμένης άσκησης (Übungen)
            </div>
            <div className="text-xs text-[#8B8680]">
              Bedeutung · Erinnern · Lückentext · Situation · Schreiben
            </div>
          </div>
          <ChevronRight size={17} className="text-[#8B8680]" />
        </button>
      </div>

      {/* Today summary */}
      <div className="ww-tag-card mt-4 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#211F1C]">Σήμερα (Sätze &amp; Ausdrücke)</span>
          <span className="ww-mono text-[#8B8680]">
            {stats.todayAttempts} προσπάθειες · {stats.todayUnique} προτάσεις
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#ECE4D3]">
          <div
            className="h-full rounded-full bg-[#4FA091] transition-all"
            style={{ width: `${Math.min(100, Math.round((stats.todayUnique / 10) * 100))}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-[#8B8680]">
          <span>Ημερήσιος στόχος: 10 προτάσεις</span>
          <span>
            Ακρίβεια σήμερα: {stats.todayAccuracy !== null ? `${stats.todayAccuracy}%` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
