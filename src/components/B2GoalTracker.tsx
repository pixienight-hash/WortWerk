import { useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, ChevronUp, Play, Target } from "lucide-react";
import { b2GoalProgress, type Word } from "@/lib/wortwerk-data";
import MasteryEvidence from "@/components/MasteryEvidence";

type Props = {
  vocab: Word[];
  onOpenB2Stats?: () => void;
  onPracticeClosest?: (words: Word[]) => void;
};

const RING_SIZE = 132;
const STROKE_WIDTH = 11;
const CENTER = RING_SIZE / 2;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2 - 4;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TICK_ANGLES = [0, 90, 180, 270];

export default function B2GoalTracker({ vocab, onOpenB2Stats, onPracticeClosest }: Props) {
  const goal = useMemo(() => b2GoalProgress(vocab, Date.now()), [vocab]);
  const [selectedMilestonePct, setSelectedMilestonePct] = useState<number | null>(null);
  const [showClosest, setShowClosest] = useState(false);
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);

  const activeMilestone = useMemo(() => {
    if (selectedMilestonePct != null) {
      return goal.milestones.find((m) => m.pct === selectedMilestonePct) || goal.nextMilestone;
    }
    return goal.nextMilestone || goal.milestones[goal.milestones.length - 1] || null;
  }, [goal.milestones, goal.nextMilestone, selectedMilestonePct]);

  const masteredOffset = CIRCUMFERENCE * (1 - goal.masteredRatio);
  const assimilatedOffset = CIRCUMFERENCE * (1 - goal.assimilatedRatio);
  const isComplete = goal.total > 0 && goal.mastered >= goal.total;

  if (goal.total === 0) {
    return (
      <section aria-label="Στόχος κατάκτησης B2" className="ww-tag-card mb-4 p-5">
        <div className="flex items-center gap-2 text-[#4FA091]">
          <Target size={16} aria-hidden="true" />
          <h2 className="ww-display text-lg font-bold text-[#211F1C]">Στόχος κατάκτησης B2</h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#6B655B]">
          Δεν υπάρχουν ακόμα ενεργές λέξεις επιπέδου B2. Πρόσθεσε ή ενεργοποίησε B2 λέξεις για να
          παρακολουθείς τον στόχο κατάκτησης.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Στόχος κατάκτησης B2" className="ww-tag-card ww-pop mb-4 p-5">
      {/* Header row — clean unboxed typography */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target size={16} className="shrink-0 text-[#3F8C5F]" aria-hidden="true" />
          <h2 className="ww-display text-lg font-bold leading-tight text-[#211F1C]">
            Στόχος κατάκτησης B2
          </h2>
        </div>
        <div className="ww-mono text-xs font-semibold tabular-nums text-[#6B655B]">
          {goal.mastered} / {goal.total} λέξεις
        </div>
      </div>

      {/* Main focal area: SVG Progress Ring + Evidence-Based Breakdown */}
      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div
          role="progressbar"
          aria-label="Πρόοδος κατάκτησης λέξεων B2"
          aria-valuemin={0}
          aria-valuemax={goal.total}
          aria-valuenow={goal.mastered}
          aria-valuetext={`${goal.mastered} από ${goal.total} κατακτημένες λέξεις B2 (${goal.masteredPct}%)`}
          className="relative shrink-0"
          style={{ width: RING_SIZE, height: RING_SIZE }}
        >
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="-rotate-90"
            aria-hidden="true"
          >
            {/* Base parchment track */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="#ECE4D3"
              strokeWidth={STROKE_WIDTH}
            />

            {/* Subtle 25/50/75/100% checkpoint ticks along outer edge */}
            {TICK_ANGLES.map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const innerR = RADIUS - STROKE_WIDTH / 2 - 1;
              const outerR = RADIUS + STROKE_WIDTH / 2 + 1;
              return (
                <line
                  key={deg}
                  x1={CENTER + Math.cos(rad) * innerR}
                  y1={CENTER + Math.sin(rad) * innerR}
                  x2={CENTER + Math.cos(rad) * outerR}
                  y2={CENTER + Math.sin(rad) * outerR}
                  stroke="#FAF7F0"
                  strokeWidth={1.75}
                />
              );
            })}

            {/* Secondary underlay arc: assimilated (consolidating + mastered) */}
            {goal.assimilated > 0 && (
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke="#CB9146"
                strokeOpacity={0.34}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={assimilatedOffset}
                className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500 motion-safe:ease-out"
              />
            )}

            {/* Primary foreground arc: mastered B2 words vs total */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={isComplete ? "#3F8C5F" : "#4FA091"}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={masteredOffset}
              className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500 motion-safe:ease-out"
            />
          </svg>

          {/* Center tabular readout */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="ww-display text-[28px] font-bold leading-none tabular-nums text-[#211F1C]">
              {goal.masteredPct}%
            </span>
            <span className="ww-mono mt-1 text-[11px] font-medium tabular-nums text-[#6B655B]">
              {goal.mastered}/{goal.total}
            </span>
          </div>
        </div>

        {/* Right-side status & dual-coded legend */}
        <div className="w-full min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-[#211F1C]">
            {isComplete
              ? "Όλες οι B2 λέξεις έχουν κατακτηθεί με τεκμηρίωση."
              : `${goal.remainingToMaster} ${goal.remainingToMaster === 1 ? "λέξη απομένει" : "λέξεις απομένουν"} για πλήρη κατάκτηση B2.`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#6B655B]">
            Η κατάκτηση βασίζεται αποκλειστικά σε επαληθευμένη τεκμηρίωση (όχι παλαιούς μετρητές).
          </p>

          <dl className="mt-3.5 grid grid-cols-3 gap-3 border-t border-[#ECE4D3] pt-3">
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] text-[#6B655B]">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 shrink-0 rounded-sm bg-[#4FA091]"
                />
                <span className="truncate">Κατακτημ.</span>
              </dt>
              <dd className="ww-mono mt-0.5 text-sm font-bold tabular-nums text-[#211F1C]">
                {goal.mastered}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] text-[#6B655B]">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 shrink-0 rounded-sm bg-[#CB9146]/60"
                />
                <span className="truncate">Αφομοίωση</span>
              </dt>
              <dd className="ww-mono mt-0.5 text-sm font-bold tabular-nums text-[#211F1C]">
                {goal.inConsolidation}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#6B655B]">Οφείλονται</dt>
              <dd className="ww-mono mt-0.5 text-sm font-bold tabular-nums text-[#211F1C]">
                {goal.due}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Interactive milestone checkpoints (25% / 50% / 75% / 100%) */}
      <div className="mt-4 border-t border-[#ECE4D3] pt-3.5">
        <div role="group" aria-label="Ορόσημα στόχου B2" className="grid grid-cols-4 gap-1.5">
          {goal.milestones.map((ms) => {
            const isSelected = activeMilestone?.pct === ms.pct;
            return (
              <button
                key={ms.pct}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedMilestonePct(ms.pct)}
                className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg border px-1.5 py-1.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FA091] ${
                  isSelected
                    ? "border-[#4FA091] bg-[#FAF7F0] text-[#211F1C]"
                    : ms.reached
                      ? "border-[#CBE3D4] bg-[#F3FAF6] text-[#2F6F4A] hover:border-[#4FA091]"
                      : "border-[#ECE4D3] bg-[#FAF7F0]/60 text-[#6B655B] hover:border-[#D9D0BE]"
                }`}
              >
                <span className="ww-mono flex items-center gap-0.5 text-xs font-bold tabular-nums">
                  {ms.reached && (
                    <Check size={12} className="shrink-0 text-[#3F8C5F]" aria-hidden="true" />
                  )}
                  {ms.pct}%
                </span>
                <span className="mt-0.5 w-full truncate text-[10px] leading-tight">
                  {ms.targetCount} λ.
                </span>
              </button>
            );
          })}
        </div>

        {activeMilestone && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[#4A453D]">
            <span>
              <strong className="font-semibold text-[#211F1C]">
                {activeMilestone.label} ({activeMilestone.pct}%)
              </strong>{" "}
              <span aria-hidden="true">·</span>{" "}
              <span className="tabular-nums">
                στόχος {activeMilestone.targetCount} κατακτημένες
              </span>
            </span>
            <span className="ww-mono text-[11px] font-semibold tabular-nums text-[#3F8C5F]">
              {activeMilestone.reached ? "Επιτεύχθηκε" : `Απομένουν ${activeMilestone.remaining}`}
            </span>
          </div>
        )}
      </div>

      {/* Progressive disclosure: closest B2 words to full mastery */}
      {goal.closestWords.length > 0 && (
        <div className="mt-3.5 border-t border-[#ECE4D3] pt-3">
          <button
            type="button"
            aria-expanded={showClosest}
            onClick={() => setShowClosest((v) => !v)}
            className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-1 text-left text-xs font-semibold text-[#211F1C] transition-colors hover:text-[#357A6D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FA091]"
          >
            <span>Πιο κοντά στην κατάκτηση ({goal.closestWords.length})</span>
            {showClosest ? (
              <ChevronUp size={15} className="shrink-0 text-[#6B655B]" aria-hidden="true" />
            ) : (
              <ChevronDown size={15} className="shrink-0 text-[#6B655B]" aria-hidden="true" />
            )}
          </button>

          {showClosest && (
            <div className="mt-1.5 divide-y divide-[#F1EBDF]">
              {goal.closestWords.map((item) => {
                const isWordOpen = expandedWordId === item.id;
                return (
                  <div key={item.id} className="py-2">
                    <button
                      type="button"
                      aria-expanded={isWordOpen}
                      onClick={() => setExpandedWordId(isWordOpen ? null : item.id)}
                      className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FA091]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-[#211F1C]">
                          {item.label}
                        </div>
                        <div className="truncate text-[11px] text-[#6B655B]">{item.greek}</div>
                      </div>
                      <div className="w-20 shrink-0">
                        <div className="flex items-center justify-between text-[10.5px] tabular-nums">
                          <span className="font-semibold text-[#4FA091]">
                            {item.criteriaMet}/{item.criteriaTotal}
                          </span>
                          <span className="ww-mono text-[#6B655B]">{item.readinessPct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#ECE4D3]">
                          <div
                            className="h-full rounded-full bg-[#4FA091]"
                            style={{
                              width: `${Math.max(item.readinessPct, item.attempts > 0 ? 8 : 0)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </button>
                    {isWordOpen && (
                      <div className="mt-2">
                        <MasteryEvidence word={item.word} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action footer */}
      {(onPracticeClosest || onOpenB2Stats) && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[#ECE4D3] pt-3.5">
          {onPracticeClosest && goal.closestWords.length > 0 && (
            <button
              type="button"
              onClick={() => onPracticeClosest(goal.closestWords.map((w) => w.word))}
              className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#211F1C] px-4 py-2 text-xs font-semibold text-[#F5F0E6] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#211F1C]"
            >
              <Play size={13} aria-hidden="true" />
              <span>Εξάσκηση πιο κοντινών ({goal.closestWords.length})</span>
            </button>
          )}
          {onOpenB2Stats && (
            <button
              type="button"
              onClick={onOpenB2Stats}
              className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D9D0BE] bg-[#FAF7F0] px-4 py-2 text-xs font-semibold text-[#211F1C] transition-colors hover:bg-[#F1EBDF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FA091]"
            >
              <span>Αναλυτική πρόοδος B2</span>
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
