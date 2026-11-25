import React, { useState, useMemo } from "react";
import {
  BookOpenCheck,
  Brain,
  PenLine,
  MessageSquareText,
  Keyboard,
  Shuffle,
  ChevronRight,
} from "lucide-react";
import {
  SENTENCE_TYPES,
  SENTENCE_CEFR_LEVELS,
  SENTENCE_TYPE_LABELS,
  buildSentenceSession,
  type SentenceEntry,
  type SentenceType,
  type SentenceCefr,
  type SentencePracticeQuestion,
  type SentenceAnswerVerdict,
  type SentenceExerciseMode,
} from "@/lib/sentences-data";
import { useAppLang } from "@/lib/i18n";
import SentencePracticeRunner from "./SentencePracticeRunner";

type ExerciseChoice = Exclude<SentenceExerciseMode, "flashcard"> | "mix";

const EXERCISE_CARDS: Array<{
  id: ExerciseChoice;
  titleEl: string;
  titleEn: string;
  tag: string;
  descEl: string;
  descEn: string;
  weightEl: string;
  weightEn: string;
  color: string;
  bg: string;
  icon: typeof BookOpenCheck;
}> = [
  {
    id: "bedeutung",
    titleEl: "Bedeutung",
    titleEn: "Bedeutung",
    tag: "A",
    descEl:
      "Εμφανίζεται η γερμανική πρόταση και επιλέγεις τη σωστή ελληνική ή αγγλική σημασία.",
    descEn: "See the German sentence and choose the right English or Greek meaning.",
    weightEl: "Αναγνώριση",
    weightEn: "Recognition",
    color: "#4FA091",
    bg: "rgba(79,160,145,0.14)",
    icon: BookOpenCheck,
  },
  {
    id: "erinnern",
    titleEl: "Erinnern",
    titleEn: "Erinnern",
    tag: "B",
    descEl: "Εμφανίζεται η ελληνική σημασία και ανακαλείς τη γερμανική έκφραση.",
    descEn: "See the English meaning and recall the German expression.",
    weightEl: "Ενεργή ανάκληση",
    weightEn: "Active recall",
    color: "#CB9146",
    bg: "rgba(203,145,70,0.15)",
    icon: Brain,
  },
  {
    id: "lueckentext",
    titleEl: "Lückentext",
    titleEn: "Lückentext",
    tag: "C",
    descEl: "Η πρόταση εμφανίζεται με ένα ή περισσότερα κενά που πρέπει να συμπληρωθούν.",
    descEn: "The sentence appears with one or more blanks to fill in.",
    weightEl: "Ενεργή ανάκληση",
    weightEn: "Active recall",
    color: "#8B7BC7",
    bg: "rgba(139,123,199,0.14)",
    icon: PenLine,
  },
  {
    id: "situation",
    titleEl: "Situation",
    titleEn: "Situation",
    tag: "D",
    descEl:
      "Εμφανίζεται μια καθημερινή ή επαγγελματική περίσταση και επιλέγεις την κατάλληλη έκφραση.",
    descEn: "See an everyday or workplace situation and pick the fitting expression.",
    weightEl: "Εφαρμογή σε πλαίσιο",
    weightEn: "Contextual choice",
    color: "#3C7D9B",
    bg: "rgba(60,125,155,0.13)",
    icon: MessageSquareText,
  },
  {
    id: "schreiben",
    titleEl: "Schreiben",
    titleEn: "Schreiben",
    tag: "E",
    descEl:
      "Πληκτρολογείς ολόκληρη την πρόταση από μνήμης με αυστηρή αξιολόγηση δομής & ορθογραφίας.",
    descEn: "Type the entire sentence from memory with strict structure & spelling evaluation.",
    weightEl: "Απαραίτητο για Mastered",
    weightEn: "Required for Mastered",
    color: "#B5542E",
    bg: "rgba(181,84,46,0.13)",
    icon: Keyboard,
  },
  {
    id: "mix",
    titleEl: "Mix (Όλες οι ασκήσεις)",
    titleEn: "Mix (All exercises)",
    tag: "★",
    descEl: "Συνδυασμός όλων των ασκήσεων σε έναν ολοκληρωμένο γύρο εξάσκησης.",
    descEn: "Combination of all 5 exercises in one complete practice round.",
    weightEl: "Ολοκληρωμένη εξάσκηση",
    weightEn: "Complete practice",
    color: "#211F1C",
    bg: "rgba(33,31,28,0.10)",
    icon: Shuffle,
  },
];

interface Props {
  sentences: SentenceEntry[];
  onRecordAnswer: (
    entryId: string,
    payload: {
      mode: SentenceExerciseMode;
      verdict: SentenceAnswerVerdict;
      hintUsed: boolean;
      promptKey: string;
    },
  ) => SentenceEntry | null;
}

export default function SentenceExercisesView({ sentences, onRecordAnswer }: Props) {
  const { lang, isEn, t } = useAppLang();
  const [cefrFilter, setCefrFilter] = useState<SentenceCefr | "all">("all");
  const [typeFilter, setTypeFilter] = useState<SentenceType | "all">("all");
  const [sessionSize, setSessionSize] = useState<number>(8);
  const [active, setActive] = useState<{
    mode: ExerciseChoice;
    title: string;
    questions: SentencePracticeQuestion[];
  } | null>(null);

  const filteredPool = useMemo(() => {
    return sentences.filter((s) => {
      if (cefrFilter !== "all" && s.cefr !== cefrFilter) return false;
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      return true;
    });
  }, [sentences, cefrFilter, typeFilter]);

  const availableCefrs = SENTENCE_CEFR_LEVELS.filter((lvl) =>
    sentences.some((s) => s.cefr === lvl),
  );

  function startExercise(mode: ExerciseChoice, title: string) {
    if (filteredPool.length === 0) return;
    const questions = buildSentenceSession(filteredPool, mode, sentences, {
      limit: Math.min(sessionSize, filteredPool.length),
      promptLanguage: lang,
    });
    setActive({ mode, title, questions });
  }

  if (active) {
    return (
      <SentencePracticeRunner
        questions={active.questions}
        title={active.title}
        onRecordAnswer={onRecordAnswer}
        onFinish={() => setActive(null)}
        onRestart={() => startExercise(active.mode, active.title)}
      />
    );
  }

  const chipClass = (isActive: boolean) =>
    `whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
      isActive
        ? "border-[#211F1C] bg-[#211F1C] text-[#F5F0E6]"
        : "border-[#E8E0CE] bg-white/70 text-[#6B655D]"
    }`;

  return (
    <div className="px-5 pt-4 pb-8">
      <div>
        <h1 className="ww-display text-[26px] font-semibold leading-tight text-[#211F1C]">
          Übungen
        </h1>
        <p className="mt-0.5 text-[13px] text-[#8B8680]">
          {t(
            `5 εξειδικευμένες ασκήσεις για προτάσεις & εκφράσεις · ${filteredPool.length} διαθέσιμες`,
            `5 dedicated exercises for sentences & expressions · ${filteredPool.length} available`,
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="mt-4 space-y-2">
        <div className="ww-scrollbar-none flex items-center gap-1.5 overflow-x-auto">
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
        </div>

        <div className="ww-scrollbar-none flex items-center gap-1.5 overflow-x-auto">
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

        <div className="flex items-center justify-between pt-1 text-xs text-[#8B8680]">
          <span>{t("Πλήθος ερωτήσεων ανά γύρο:", "Questions per round:")}</span>
          <div className="flex gap-1.5">
            {[5, 8, 12, 20].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSessionSize(n)}
                className={`ww-mono rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  sessionSize === n
                    ? "bg-[#211F1C] text-[#F5F0E6]"
                    : "border border-[#E8E0CE] bg-white text-[#6B655D]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Exercise Cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {EXERCISE_CARDS.map((card) => {
          const Icon = card.icon;
          const disabled = filteredPool.length === 0;
          const title = isEn ? card.titleEn : card.titleEl;
          const desc = isEn ? card.descEn : card.descEl;
          const weight = isEn ? card.weightEn : card.weightEl;
          return (
            <button
              key={card.id}
              type="button"
              disabled={disabled}
              onClick={() => startExercise(card.id, title)}
              className="ww-tag-card flex flex-col justify-between p-4 text-left transition hover:border-[#D9CEB8] disabled:opacity-45"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-2xl"
                      style={{ color: card.color, background: card.bg }}
                    >
                      <Icon size={18} />
                    </span>
                    <div>
                      <div className="ww-display text-[17px] font-semibold text-[#211F1C]">
                        {title}
                      </div>
                      <span
                        className="ww-mono text-[10px] font-semibold uppercase"
                        style={{ color: card.color }}
                      >
                        {weight}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[#A79F8E]" />
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-[#6B655D]">{desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
