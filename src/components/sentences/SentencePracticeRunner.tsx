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

const UMLAUTS = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"] as const;

const MODE_META: Record<
  Exclude<SentenceExerciseMode, "flashcard">,
  { title: string; subtitle: string; color: string; bg: string; isActive: boolean }
> = {
  bedeutung: {
    title: "Bedeutung",
    subtitle: "Επίλεξε τη σωστή σημασία",
    color: "#4FA091",
    bg: "rgba(79,160,145,0.14)",
    isActive: false,
  },
  erinnern: {
    title: "Erinnern",
    subtitle: "Ανακάλεσε τη γερμανική έκφραση",
    color: "#CB9146",
    bg: "rgba(203,145,70,0.15)",
    isActive: true,
  },
  lueckentext: {
    title: "Lückentext",
    subtitle: "Συμπλήρωσε τα κενά",
    color: "#8B7BC7",
    bg: "rgba(139,123,199,0.14)",
    isActive: true,
  },
  situation: {
    title: "Situation",
    subtitle: "Επίλεξε την κατάλληλη έκφραση",
    color: "#3C7D9B",
    bg: "rgba(60,125,155,0.14)",
    isActive: false,
  },
  schreiben: {
    title: "Schreiben",
    subtitle: "Γράψε ολόκληρη την πρόταση από μνήμης",
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
  const [index, setIndex] = useState(0);
  const [selectedOptId, setSelectedOptId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [clozeInputs, setClozeInputs] = useState<string[]>([]);
  const [activeBlankIdx, setActiveBlankIdx] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [meaningLang, setMeaningLang] = useState<"el" | "en">("el");
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
            Δεν υπάρχουν διαθέσιμες ερωτήσεις
          </div>
          <p className="mt-2 text-sm text-[#8B8680]">
            Δοκίμασε άλλο φίλτρο ή πρόσθεσε περισσότερες προτάσεις στη συλλογή σου.
          </p>
          <button
            type="button"
            onClick={onFinish}
            className="mt-5 rounded-full bg-[#211F1C] px-6 py-3 text-sm font-semibold text-[#F5F0E6]"
          >
            Επιστροφή
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
            Ολοκλήρωση συνεδρίας
          </h2>
          <p className="mt-1 text-sm text-[#8B8680]">{title}</p>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl bg-[#3F8C5F]/10 p-3">
              <div className="ww-display text-2xl font-bold text-[#3F8C5F]">{exactCount}</div>
              <div className="text-[11px] font-medium text-[#3F8C5F]">Ακριβείς</div>
            </div>
            <div className="rounded-2xl bg-[#CB9146]/12 p-3">
              <div className="ww-display text-2xl font-bold text-[#9A6824]">{typoCount}</div>
              <div className="text-[11px] font-medium text-[#9A6824]">Μικρό λάθος</div>
            </div>
            <div className="rounded-2xl bg-[#C1543C]/10 p-3">
              <div className="ww-display text-2xl font-bold text-[#C1543C]">{wrongCount}</div>
              <div className="text-[11px] font-medium text-[#C1543C]">Λανθασμένες</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-[#F5F0E6] px-4 py-3 text-sm text-[#4A453D]">
            Ποσοστό επιτυχίας: <strong className="ww-mono text-[#211F1C]">{pct}%</strong> (
            {correctCount}/{outcomes.length})
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            {onRestart && (
              <button
                type="button"
                onClick={onRestart}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#E8E0CE] bg-[#F5F0E6] py-3 text-sm font-semibold text-[#211F1C]"
              >
                <RotateCcw size={15} /> Νέος γύρος
              </button>
            )}
            <button
              type="button"
              onClick={onFinish}
              className="flex-1 rounded-full bg-[#211F1C] py-3 text-sm font-semibold text-[#F5F0E6]"
            >
              Τέλος
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
      feedback: isCorrect ? "Σωστή επιλογή!" : "Λάθος επιλογή — δες τη σωστή απάντηση.",
      updatedEntry: updated,
    });
  }

  function handleCheckTyped(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (checked || !current) return;

    if (current.mode === "lueckentext" && current.blanks) {
      const results = current.blanks.map((blank, idx) =>
        evaluateSentenceAnswer(clozeInputs[idx] ?? "", blank.answer, []),
      );
      const hasWrong = results.some((r) => r.verdict === "wrong");
      const hasTypo = results.some((r) => r.verdict === "typo");
      const verdict: SentenceAnswerVerdict = hasWrong ? "wrong" : hasTypo ? "typo" : "exact";
      const feedback =
        verdict === "exact"
          ? "Ακριβώς σωστό!"
          : verdict === "typo"
            ? "Σχεδόν σωστό — μικρό ορθογραφικό λάθος σε κάποιο κενό."
            : "Λανθασμένη συμπλήρωση — δες τα σωστά κενά παρακάτω.";

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
          aria-label="Κλείσιμο άσκησης"
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
          {current.mode === "bedeutung" && current.entry.meaning.el && current.entry.meaning.en && (
            <div className="flex rounded-full border border-[#E8E0CE] bg-[#F5F0E6] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setMeaningLang("el")}
                className={`rounded-full px-2.5 py-0.5 font-semibold ${meaningLang === "el" ? "bg-[#211F1C] text-[#F5F0E6]" : "text-[#8B8680]"}`}
              >
                ΕΛ
              </button>
              <button
                type="button"
                onClick={() => setMeaningLang("en")}
                className={`rounded-full px-2.5 py-0.5 font-semibold ${meaningLang === "en" ? "bg-[#211F1C] text-[#F5F0E6]" : "text-[#8B8680]"}`}
              >
                EN
              </button>
            </div>
          )}
        </div>

        <p className="mt-2 text-xs text-[#8B8680]">{meta.subtitle}</p>

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
                aria-label="Ακρόαση πρότασης"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#4A453D] shadow-xs"
              >
                <Volume2 size={16} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              {(current.options || []).map((opt) => {
                const displayText =
                  meaningLang === "en"
                    ? opt.isCorrect
                      ? current.entry.meaning.en || opt.label
                      : opt.sublabel || opt.label
                    : opt.label;
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
                Περίσταση · {current.situationPrompt.context}
              </div>
              <div className="mt-1.5 text-sm font-medium leading-relaxed text-[#211F1C]">
                {current.situationPrompt.usage}
              </div>
              <div className="mt-2 text-xs text-[#6B7278]">
                Θέλεις να εκφράσεις: «{current.situationPrompt.meaningCue}»
              </div>
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
                        aria-label={`Κενό ${tok.blankIndex + 1}`}
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
                Σημασία: {current.entry.meaning.el || current.entry.meaning.en}
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
                    <Lightbulb size={13} /> {hintUsed ? "Υπόδειξη ενεργή" : "Υπόδειξη"}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={clozeInputs.every((v) => !v.trim())}
                  className="mt-4 w-full rounded-full bg-[#211F1C] py-3.5 text-sm font-semibold text-[#F5F0E6] disabled:bg-[#D9D2C0] disabled:text-[#8B8680]"
                >
                  Έλεγχος απάντησης
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
                {current.entry.context || typeMeta.el}
              </div>
              <div className="ww-display mt-1 text-lg font-semibold leading-snug text-[#211F1C]">
                {current.entry.meaning.el || current.entry.meaning.en}
              </div>
              {current.entry.meaning.en && current.entry.meaning.el && (
                <div className="mt-1 text-xs text-[#8B8680]">{current.entry.meaning.en}</div>
              )}
              {current.mode === "erinnern" && current.entry.usage && (
                <div className="mt-2 border-t border-[#E8E0CE] pt-2 text-xs text-[#6B655D]">
                  {current.entry.usage}
                </div>
              )}
            </div>

            {hintUsed && !checked && (
              <div className="mt-2.5 rounded-xl border border-[#E8DFC8] bg-[#FCF8EE] px-3.5 py-2 text-xs text-[#7A5114]">
                <span className="font-semibold">Υπόδειξη:</span>{" "}
                <span className="ww-mono">{firstLettersHint}</span>
                {current.entry.structure && (
                  <div className="mt-1 text-[11px] text-[#8B8680]">
                    Δομή: {current.entry.structure}
                  </div>
                )}
              </div>
            )}

            <textarea
              ref={(el) => {
                textInputRef.current = el;
              }}
              rows={2}
              aria-label="Γερμανική πρόταση"
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
                  ? "Πληκτρολόγησε ολόκληρη τη γερμανική πρόταση από μνήμης…"
                  : "Πληκτρολόγησε τη γερμανική έκφραση…"
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
                    {hintUsed ? "Υπόδειξη ενεργή (δεν μετρά για Mastered)" : "Υπόδειξη"}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!typed.trim()}
                  className="mt-4 w-full rounded-full bg-[#211F1C] py-3.5 text-sm font-semibold text-[#F5F0E6] disabled:bg-[#D9D2C0] disabled:text-[#8B8680]"
                >
                  Έλεγχος απάντησης
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
                        ? `[λείπει: ${tok.expected}]`
                        : tok.status === "extra"
                          ? `[επιπλέον: ${tok.actual}]`
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
                  {current.entry.meaning.el}
                  {current.entry.meaning.en ? ` · ${current.entry.meaning.en}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => speakGerman(current.entry.sentence)}
                aria-label="Ακρόαση σωστής πρότασης"
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
                Σημείωση: Τα μικρά ορθογραφικά λάθη μετρούν στην εξάσκηση, αλλά για Mastered
                απαιτείται ακριβής γραφή.
              </div>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#211F1C] py-3 text-sm font-semibold text-[#F5F0E6]"
            >
              {index + 1 >= questions.length ? "Ολοκλήρωση" : "Επόμενη ερώτηση"}
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
