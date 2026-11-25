import React, { useState, useRef, useEffect } from "react";
import {
  Volume2,
  Check,
  X,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  Lightbulb,
  Trophy,
  Sparkles,
} from "lucide-react";
import {
  SENTENCE_TYPE_LABELS,
  SENTENCE_STATUS_LABELS,
  evaluateSentenceAnswer,
  computeSentenceMastery,
  type SentenceEntry,
  type SentencePracticeQuestion,
  type SentenceAnswerVerdict,
  type SentenceEvalResult,
  type SentenceExerciseMode,
} from "@/lib/sentences-data";
import { useAppLang, sentencePrimaryMeaning, sentenceSecondaryMeaning } from "@/lib/i18n";

const UMLAUTS = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"] as const;

const MODE_META: Record<
  Exclude<SentenceExerciseMode, "flashcard">,
  { title: string; subtitleEl: string; subtitleEn: string; color: string; bg: string; isActive: boolean }
> = {
  bedeutung: {
    title: "Bedeutung",
    subtitleEl: "Επίλεξε τη σωστή σημασία",
    subtitleEn: "Choose the right meaning",
    color: "#4FA091",
    bg: "rgba(79,160,145,0.14)",
    isActive: false,
  },
  erinnern: {
    title: "Erinnern",
    subtitleEl: "Ανακάλεσε τη γερμανική έκφραση",
    subtitleEn: "Recall the German expression",
    color: "#CB9146",
    bg: "rgba(203,145,70,0.15)",
    isActive: true,
  },
  lueckentext: {
    title: "Lückentext",
    subtitleEl: "Συμπλήρωσε τα κενά",
    subtitleEn: "Fill in the blanks",
    color: "#8B7BC7",
    bg: "rgba(139,123,199,0.14)",
    isActive: true,
  },
  situation: {
    title: "Situation",
    subtitleEl: "Επίλεξε την κατάλληλη έκφραση",
    subtitleEn: "Choose the right expression for the situation",
    color: "#3C7D9B",
    bg: "rgba(60,125,155,0.14)",
    isActive: false,
  },
  schreiben: {
    title: "Schreiben",
    subtitleEl: "Γράψε ολόκληρη την πρόταση από μνήμης",
    subtitleEn: "Type the full sentence from memory",
    color: "#B5542E",
    bg: "rgba(181,84,46,0.13)",
    isActive: true,
  },
};

export function speakGerman(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "de-DE";
    utter.rate = 0.94;
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore speech synthesis errors in unsupported environments
  }
}

interface SessionOutcome {
  entryId: string;
  sentence: string;
  mode: Exclude<SentenceExerciseMode, "flashcard">;
  verdict: SentenceAnswerVerdict;
  hintUsed: boolean;
}

interface Props {
  questions: SentencePracticeQuestion[];
  title: string;
  onRecordAnswer: (
    entryId: string,
    payload: {
      mode: SentenceExerciseMode;
      verdict: SentenceAnswerVerdict;
      hintUsed: boolean;
      promptKey: string;
    },
  ) => SentenceEntry | null;
  onFinish: () => void;
  onRestart?: () => void;
}

export default function SentencePracticeRunner({
  questions,
  title,
  onRecordAnswer,
  onFinish,
  onRestart,
}: Props) {
  const { lang, isEn, t } = useAppLang();
  const [index, setIndex] = useState(0);
  const [selectedOptId, setSelectedOptId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [clozeInputs, setClozeInputs] = useState<string[]>([]);
  const [activeBlankIdx, setActiveBlankIdx] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [checked, setChecked] = useState<{
    verdict: SentenceAnswerVerdict;
    feedback: string;
    evalResult?: SentenceEvalResult;
    blankResults?: SentenceEvalResult[];
    updatedEntry?: SentenceEntry | null;
  } | null>(null);
  const [outcomes, setOutcomes] = useState<SessionOutcome[]>([]);
  const [done, setDone] = useState(false);

  const textInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const current = questions[index];

  useEffect(() => {
    setSelectedOptId(null);
    setTyped("");
    setClozeInputs(current?.blanks ? current.blanks.map(() => "") : []);
    setActiveBlankIdx(0);
    setHintUsed(false);
    setChecked(null);
  }, [index, current?.key, current?.blanks]);

  if (questions.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <div className="ww-tag-card p-6">
          <div className="ww-display text-lg font-semibold text-[#211F1C]">
            {t("Δεν υπάρχουν διαθέσιμες ερωτήσεις", "No questions available")}
          </div>
          <p className="mt-2 text-sm text-[#8B8680]">
            {t(
              "Δοκίμασε άλλο φίλτρο ή πρόσθεσε περισσότερες προτάσεις στη συλλογή σου.",
              "Try another filter or add more sentences to your collection.",
            )}
          </p>
          <button
            type="button"
            onClick={onFinish}
            className="mt-5 rounded-full bg-[#211F1C] px-6 py-3 text-sm font-semibold text-[#F5F0E6]"
          >
            {t("Επιστροφή", "Back")}
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    const exactCount = outcomes.filter((o) => o.verdict === "exact").length;
    const typoCount = outcomes.filter((o) => o.verdict === "typo").length;
    const wrongCount = outcomes.filter((o) => o.verdict === "wrong").length;
    const correctCount = exactCount + typoCount;
    const pct = outcomes.length > 0 ? Math.round((correctCount / outcomes.length) * 100) : 0;

    return (
      <div className="px-5 py-6">
        <div className="ww-pop ww-tag-card p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#3F8C5F]/15 text-[#3F8C5F]">
            <Trophy size={26} />
          </div>
          <h2 className="ww-display mt-3 text-2xl font-bold text-[#211F1C]">
            {t("Ολοκλήρωση συνεδρίας", "Session complete")}
          </h2>
          <p className="mt-1 text-sm text-[#8B8680]">{title}</p>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl bg-[#3F8C5F]/10 p-3">
              <div className="ww-display text-2xl font-bold text-[#3F8C5F]">{exactCount}</div>
              <div className="text-[11px] font-medium text-[#3F8C5F]">
                {t("Ακριβείς", "Exact")}
              </div>
            </div>
            <div className="rounded-2xl bg-[#CB9146]/12 p-3">
              <div className="ww-display text-2xl font-bold text-[#9A6824]">{typoCount}</div>
              <div className="text-[11px] font-medium text-[#9A6824]">
                {t("Μικρό λάθος", "Minor typo")}
              </div>
            </div>
            <div className="rounded-2xl bg-[#C1543C]/10 p-3">
              <div className="ww-display text-2xl font-bold text-[#C1543C]">{wrongCount}</div>
              <div className="text-[11px] font-medium text-[#C1543C]">
                {t("Λανθασμένες", "Incorrect")}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-[#F5F0E6] px-4 py-3 text-sm text-[#4A453D]">
            {t("Ποσοστό επιτυχίας:", "Success rate:")}{" "}
            <strong className="ww-mono text-[#211F1C]">{pct}%</strong> ({correctCount}/
            {outcomes.length})
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            {onRestart && (
              <button
                type="button"
                onClick={onRestart}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#E8E0CE] bg-[#F5F0E6] py-3 text-sm font-semibold text-[#211F1C]"
              >
                <RotateCcw size={15} /> {t("Νέος γύρος", "New round")}
              </button>
            )}
            <button
              type="button"
              onClick={onFinish}
              className="flex-1 rounded-full bg-[#211F1C] py-3 text-sm font-semibold text-[#F5F0E6]"
            >
              {t("Τέλος", "Done")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const meta = MODE_META[current.mode];
  const typeMeta = SENTENCE_TYPE_LABELS[current.entry.type];
  const progressPct = Math.round(((index + (checked ? 1 : 0)) / questions.length) * 100);
  const primaryMeaning = sentencePrimaryMeaning(current.entry, lang);
  const secondaryMeaning = sentenceSecondaryMeaning(current.entry, lang);
  const qLang = current.promptLanguage ?? "el";

  function insertUmlaut(ch: string) {
    if (checked) return;
    if (current?.mode === "lueckentext") {
      setClozeInputs((prev) => prev.map((val, idx) => (idx === activeBlankIdx ? val + ch : val)));
    } else {
      setTyped((prev) => prev + ch);
      textInputRef.current?.focus();
    }
  }

  function handleOptionSelect(optId: string, isCorrect: boolean) {
    if (checked || !current) return;
    setSelectedOptId(optId);
    const verdict: SentenceAnswerVerdict = isCorrect ? "exact" : "wrong";
    const updated = onRecordAnswer(current.entry.id, {
      mode: current.mode,
      verdict,
      hintUsed: false,
      promptKey: current.key,
    });
    setOutcomes((prev) => [
      ...prev,
      {
        entryId: current.entry.id,
        sentence: current.entry.sentence,
        mode: current.mode,
        verdict,
        hintUsed: false,
      },
    ]);
    setChecked({
      verdict,
      feedback: isCorrect
        ? t("Σωστή επιλογή!", "Correct choice!")
        : t("Λάθος επιλογή — δες τη σωστή απάντηση.", "Wrong choice — see the correct answer."),
      updatedEntry: updated,
    });
  }

  function handleCheckTyped(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (checked || !current) return;

    if (current.mode === "lueckentext" && current.blanks) {
      const results = current.blanks.map((blank, idx) =>
        evaluateSentenceAnswer(clozeInputs[idx] ?? "", blank.answer, [], lang),
      );
      const hasWrong = results.some((r) => r.verdict === "wrong");
      const hasTypo = results.some((r) => r.verdict === "typo");
      const verdict: SentenceAnswerVerdict = hasWrong ? "wrong" : hasTypo ? "typo" : "exact";
      const feedback =
        verdict === "exact"
          ? t("Ακριβώς σωστό!", "Exactly right!")
          : verdict === "typo"
            ? t(
                "Σχεδόν σωστό — μικρό ορθογραφικό λάθος σε κάποιο κενό.",
                "Almost right — minor spelling typo in a blank.",
              )
            : t(
                "Λανθασμένη συμπλήρωση — δες τα σωστά κενά παρακάτω.",
                "Incorrect fill-in — see the correct blanks below.",
              );

      const updated = onRecordAnswer(current.entry.id, {
        mode: "lueckentext",
        verdict,
        hintUsed,
        promptKey: current.key,
      });
      setOutcomes((prev) => [
        ...prev,
        {
          entryId: current.entry.id,
          sentence: current.entry.sentence,
          mode: "lueckentext",
          verdict,
          hintUsed,
        },
      ]);
      setChecked({ verdict, feedback, blankResults: results, updatedEntry: updated });
      return;
    }

    const evalResult = evaluateSentenceAnswer(
      typed,
      current.entry.sentence,
      current.entry.alternatives,
      lang,
    );
    const updated = onRecordAnswer(current.entry.id, {
      mode: current.mode,
      verdict: evalResult.verdict,
      hintUsed,
      promptKey: current.key,
    });
    setOutcomes((prev) => [
      ...prev,
      {
        entryId: current.entry.id,
        sentence: current.entry.sentence,
        mode: current.mode,
        verdict: evalResult.verdict,
        hintUsed,
      },
    ]);
    setChecked({
      verdict: evalResult.verdict,
      feedback: evalResult.feedback,
      evalResult,
      updatedEntry: updated,
    });
  }

  function handleNext() {
    if (index + 1 >= questions.length) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
    }
  }

  const firstLettersHint = current.entry.sentence
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w : `${w.slice(0, 2)}${"·".repeat(Math.min(5, w.length - 2))}`))
    .join(" ");

  const updatedStatus = checked?.updatedEntry
    ? SENTENCE_STATUS_LABELS[computeSentenceMastery(checked.updatedEntry).status]
    : null;

  return (
    <div className="px-5 py-4 pb-8">
      {/* Header & progress */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onFinish}
          aria-label={t("Κλείσιμο άσκησης", "Close exercise")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ECE4D3] text-[#4A453D]"
        >
          <X size={16} />
        </button>
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-xs text-[#8B8680]">
            <span className="font-semibold text-[#211F1C]">{title}</span>
            <span className="ww-mono">
              {index + 1} / {questions.length}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#ECE4D3]">
            <div
              className="h-full rounded-full bg-[#211F1C] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="ww-pop ww-tag-card mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="ww-mono rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: meta.color, background: meta.bg }}
            >
              {meta.title}
            </span>
            <span
              className="ww-mono rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ color: typeMeta.color, background: typeMeta.bg }}
            >
              {typeMeta.de}
            </span>
            <span className="ww-mono rounded-full bg-[#ECE4D3] px-2 py-0.5 text-[10px] font-semibold text-[#4A453D]">
              {current.entry.cefr}
            </span>
          </div>
        </div>

        <p className="mt-2 text-xs text-[#8B8680]">
          {isEn ? meta.subtitleEn : meta.subtitleEl}
        </p>

        {/* A. BEDEUTUNG */}
        {current.mode === "bedeutung" && (
          <div className="mt-4">
            <div className="flex items-start justify-between gap-3 rounded-2xl bg-[#F5F0E6] p-4">
              <div className="ww-display text-xl font-semibold leading-snug text-[#211F1C]">
                {current.entry.sentence}
              </div>
              <button
                type="button"
                onClick={() => speakGerman(current.entry.sentence)}
                aria-label={t("Ακρόαση πρότασης", "Listen to sentence")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#4A453D] shadow-xs"
              >
                <Volume2 size={16} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              {(current.options || []).map((opt) => {
                const displayText =
                  lang === qLang
                    ? opt.label
                    : opt.isCorrect
                      ? primaryMeaning || opt.label
                      : opt.sublabel || opt.label;
                const isSelected = selectedOptId === opt.id;
                let border = "border-[#E8E0CE] bg-white text-[#211F1C]";
                if (checked) {
                  if (opt.isCorrect) border = "border-[#3F8C5F] bg-[#3F8C5F]/10 text-[#1F5637]";
                  else if (isSelected) border = "border-[#C1543C] bg-[#C1543C]/10 text-[#8A2F1C]";
                  else border = "border-[#ECE4D3] bg-[#FAF8F4] text-[#8B8680]";
                }
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={Boolean(checked)}
                    onClick={() => handleOptionSelect(opt.id, opt.isCorrect)}
                    className={`w-full rounded-2xl border p-3.5 text-left text-sm font-medium transition ${border}`}
                  >
                    {displayText}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* D. SITUATION */}
        {current.mode === "situation" && current.situationPrompt && (
          <div className="mt-4">
            <div className="rounded-2xl border border-[#DCE8EE] bg-[#F2F7F9] p-4">
              <div className="ww-mono text-[10px] font-semibold uppercase tracking-wider text-[#3C7D9B]">
                {t("Περίσταση", "Situation")} · {current.situationPrompt.context}
              </div>
              {(!isEn || !current.entry.usage) && (
                <div className="mt-1.5 text-sm font-medium leading-relaxed text-[#211F1C]">
                  {isEn
                    ? `Choose the right German expression for: "${primaryMeaning}".`
                    : current.situationPrompt.usage}
                </div>
              )}
              {isEn && current.entry.usage && (
                <div className="mt-1.5 text-sm font-medium leading-relaxed text-[#211F1C]">
                  You want to express: &ldquo;{primaryMeaning}&rdquo;
                </div>
              )}
              {!isEn && (
                <div className="mt-2 text-xs text-[#6B7278]">
                  Θέλεις να εκφράσεις: «{primaryMeaning}»
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              {(current.options || []).map((opt) => {
                const isSelected = selectedOptId === opt.id;
                let border = "border-[#E8E0CE] bg-white text-[#211F1C]";
                if (checked) {
                  if (opt.isCorrect) border = "border-[#3F8C5F] bg-[#3F8C5F]/10 text-[#1F5637]";
                  else if (isSelected) border = "border-[#C1543C] bg-[#C1543C]/10 text-[#8A2F1C]";
                  else border = "border-[#ECE4D3] bg-[#FAF8F4] text-[#8B8680]";
                }
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={Boolean(checked)}
                    onClick={() => handleOptionSelect(opt.id, opt.isCorrect)}
                    className={`w-full rounded-2xl border p-3.5 text-left text-sm font-medium transition ${border}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* C. LÜCKENTEXT */}
        {current.mode === "lueckentext" && current.clozeTokens && current.blanks && (
          <form onSubmit={handleCheckTyped} className="mt-4">
            <div className="rounded-2xl bg-[#F5F0E6] p-4">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2.5 text-base font-medium leading-relaxed text-[#211F1C]">
                {current.clozeTokens.map((tok, i) => {
                  if (tok.blankIndex === null) {
                    return <span key={i}>{tok.text}</span>;
                  }
                  const blank = current.blanks![tok.blankIndex]!;
                  const res = checked?.blankResults?.[tok.blankIndex];
                  const inputColor = !res
                    ? "border-[#8B7BC7] bg-white text-[#211F1C]"
                    : res.verdict === "exact"
                      ? "border-[#3F8C5F] bg-[#3F8C5F]/10 text-[#1F5637]"
                      : res.verdict === "typo"
                        ? "border-[#CB9146] bg-[#CB9146]/15 text-[#7A5114]"
                        : "border-[#C1543C] bg-[#C1543C]/10 text-[#8A2F1C]";

                  return (
                    <span key={i} className="inline-flex items-center">
                      {blank.prefix && <span>{blank.prefix}</span>}
                      <input
                        type="text"
                        aria-label={t(`Κενό ${tok.blankIndex + 1}`, `Blank ${tok.blankIndex + 1}`)}
                        disabled={Boolean(checked)}
                        value={clozeInputs[tok.blankIndex] ?? ""}
                        onFocus={() => setActiveBlankIdx(tok.blankIndex!)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setClozeInputs((prev) =>
                            prev.map((x, idx) => (idx === tok.blankIndex ? v : x)),
                          );
                        }}
                        placeholder={hintUsed ? `${blank.answer.slice(0, 2)}…` : "______"}
                        className={`w-32 rounded-lg border-2 px-2.5 py-1 text-sm font-semibold outline-none ${inputColor}`}
                      />
                      {blank.suffix && <span>{blank.suffix}</span>}
                    </span>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-[#6B655D]">
                {t("Σημασία:", "Meaning:")} {primaryMeaning}
              </div>
            </div>

            {!checked && (
              <>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {UMLAUTS.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => insertUmlaut(u)}
                        className="rounded-lg border border-[#E8E0CE] bg-[#F5F0E6] px-2.5 py-1 text-xs font-semibold text-[#211F1C]"
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setHintUsed(true)}
                    disabled={hintUsed}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#8B8680] hover:text-[#211F1C] disabled:opacity-50"
                  >
                    <Lightbulb size={13} />{" "}
                    {hintUsed ? t("Υπόδειξη ενεργή", "Hint active") : t("Υπόδειξη", "Hint")}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={clozeInputs.every((v) => !v.trim())}
                  className="mt-4 w-full rounded-full bg-[#211F1C] py-3.5 text-sm font-semibold text-[#F5F0E6] disabled:bg-[#D9D2C0] disabled:text-[#8B8680]"
                >
                  {t("Έλεγχος απάντησης", "Check answer")}
                </button>
              </>
            )}
          </form>
        )}

        {/* B. ERINNERN & E. SCHREIBEN */}
        {(current.mode === "erinnern" || current.mode === "schreiben") && (
          <form onSubmit={handleCheckTyped} className="mt-4">
            <div className="rounded-2xl bg-[#F5F0E6] p-4">
              <div className="ww-mono text-[10px] uppercase tracking-wider text-[#8B8680]">
                {current.entry.context || (isEn ? typeMeta.en : typeMeta.el)}
              </div>
              <div className="ww-display mt-1 text-lg font-semibold leading-snug text-[#211F1C]">
                {primaryMeaning}
              </div>
              {secondaryMeaning && (
                <div className="mt-1 text-xs text-[#8B8680]">{secondaryMeaning}</div>
              )}
              {current.mode === "erinnern" && !isEn && current.entry.usage && (
                <div className="mt-2 border-t border-[#E8E0CE] pt-2 text-xs text-[#6B655D]">
                  {current.entry.usage}
                </div>
              )}
            </div>

            {hintUsed && !checked && (
              <div className="mt-2.5 rounded-xl border border-[#E8DFC8] bg-[#FCF8EE] px-3.5 py-2 text-xs text-[#7A5114]">
                <span className="font-semibold">{t("Υπόδειξη:", "Hint:")}</span>{" "}
                <span className="ww-mono">{firstLettersHint}</span>
                {current.entry.structure && (
                  <div className="mt-1 text-[11px] text-[#8B8680]">
                    {t("Δομή:", "Structure:")} {current.entry.structure}
                  </div>
                )}
              </div>
            )}

            <textarea
              ref={(el) => {
                textInputRef.current = el;
              }}
              rows={2}
              aria-label={t("Γερμανική πρόταση", "German sentence")}
              disabled={Boolean(checked)}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (typed.trim() && !checked) handleCheckTyped();
                }
              }}
              placeholder={
                current.mode === "schreiben"
                  ? t(
                      "Πληκτρολόγησε ολόκληρη τη γερμανική πρόταση από μνήμης…",
                      "Type the full German sentence from memory…",
                    )
                  : t("Πληκτρολόγησε τη γερμανική έκφραση…", "Type the German expression…")
              }
              className="mt-3 w-full resize-none rounded-2xl border border-[#E8E0CE] bg-[#FAF8F4] p-3.5 text-sm font-medium text-[#211F1C] outline-none focus:border-[#211F1C] disabled:opacity-80"
            />

            {!checked && (
              <>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {UMLAUTS.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => insertUmlaut(u)}
                        className="rounded-lg border border-[#E8E0CE] bg-[#F5F0E6] px-2.5 py-1 text-xs font-semibold text-[#211F1C]"
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setHintUsed(true)}
                    disabled={hintUsed}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#8B8680] hover:text-[#211F1C] disabled:opacity-50"
                  >
                    <Lightbulb size={13} />{" "}
                    {hintUsed
                      ? t(
                          "Υπόδειξη ενεργή (δεν μετρά για Mastered)",
                          "Hint active (doesn't count toward Mastered)",
                        )
                      : t("Υπόδειξη", "Hint")}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!typed.trim()}
                  className="mt-4 w-full rounded-full bg-[#211F1C] py-3.5 text-sm font-semibold text-[#F5F0E6] disabled:bg-[#D9D2C0] disabled:text-[#8B8680]"
                >
                  {t("Έλεγχος απάντησης", "Check answer")}
                </button>
              </>
            )}
          </form>
        )}

        {/* FEEDBACK PANEL */}
        {checked && (
          <div
            className={`ww-pop mt-4 rounded-2xl border p-4 ${
              checked.verdict === "exact"
                ? "border-[#3F8C5F]/40 bg-[#3F8C5F]/10"
                : checked.verdict === "typo"
                  ? "border-[#CB9146]/50 bg-[#CB9146]/12"
                  : "border-[#C1543C]/40 bg-[#C1543C]/10"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {checked.verdict === "exact" && <Check size={18} className="text-[#3F8C5F]" />}
                {checked.verdict === "typo" && (
                  <AlertTriangle size={18} className="text-[#9A6824]" />
                )}
                {checked.verdict === "wrong" && <X size={18} className="text-[#C1543C]" />}
                <span
                  className={`text-sm font-bold ${
                    checked.verdict === "exact"
                      ? "text-[#1F5637]"
                      : checked.verdict === "typo"
                        ? "text-[#7A5114]"
                        : "text-[#8A2F1C]"
                  }`}
                >
                  {checked.feedback}
                </span>
              </div>
              {updatedStatus && (
                <span
                  className="ww-mono shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ color: updatedStatus.color, background: updatedStatus.bg }}
                >
                  {updatedStatus.label}
                </span>
              )}
            </div>

            {/* Word-by-word diff for typed exercises */}
            {checked.evalResult &&
              checked.verdict !== "exact" &&
              checked.evalResult.wordDiff.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {checked.evalResult.wordDiff.map((tok, idx) => (
                    <span
                      key={idx}
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        tok.status === "match"
                          ? "bg-[#3F8C5F]/15 text-[#1F5637]"
                          : tok.status === "typo"
                            ? "bg-[#CB9146]/25 text-[#7A5114]"
                            : "bg-[#C1543C]/15 text-[#8A2F1C]"
                      }`}
                    >
                      {tok.status === "missing"
                        ? `[${t("λείπει", "missing")}: ${tok.expected}]`
                        : tok.status === "extra"
                          ? `[${t("επιπλέον", "extra")}: ${tok.actual}]`
                          : tok.status === "match"
                            ? tok.expected
                            : `${tok.actual} → ${tok.expected}`}
                    </span>
                  ))}
                </div>
              )}

            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2.5">
              <div>
                <div className="text-sm font-semibold text-[#211F1C]">{current.entry.sentence}</div>
                <div className="text-xs text-[#6B655D]">
                  {primaryMeaning}
                  {secondaryMeaning ? ` · ${secondaryMeaning}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => speakGerman(current.entry.sentence)}
                aria-label={t("Ακρόαση σωστής πρότασης", "Listen to correct sentence")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ECE4D3] text-[#211F1C]"
              >
                <Volume2 size={15} />
              </button>
            </div>

            {current.entry.grammar && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-[#5E584F]">
                <Sparkles size={13} className="mt-0.5 shrink-0 text-[#CB9146]" />
                <span>{current.entry.grammar}</span>
              </div>
            )}

            {checked.verdict === "typo" && meta.isActive && (
              <div className="mt-1.5 text-[11px] text-[#7A5114]">
                {t(
                  "Σημείωση: Τα μικρά ορθογραφικά λάθη μετρούν στην εξάσκηση, αλλά για Mastered απαιτείται ακριβής γραφή.",
                  "Note: Minor typos count for practice, but exact spelling is required for Mastered.",
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#211F1C] py-3 text-sm font-semibold text-[#F5F0E6]"
            >
              {index + 1 >= questions.length
                ? t("Ολοκλήρωση", "Finish")
                : t("Επόμενη ερώτηση", "Next question")}
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
