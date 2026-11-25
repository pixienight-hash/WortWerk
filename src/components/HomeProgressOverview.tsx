import { useMemo, useState } from "react";
import { Calendar, ChevronRight, Sun } from "lucide-react";
import { homeProgressSummary, type Word } from "@/lib/wortwerk-data";
import { useAppLang, type AppLang } from "@/lib/i18n";

type Props = {
  vocab: Word[];
  meta: Word;
  onOpenStats: () => void;
};

const RING_SIZE = 74;
const STROKE_WIDTH = 7;
const CENTER = RING_SIZE / 2;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2 - 1;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatCompactDuration(ms: number, lang: AppLang): string {
  if (!ms || ms <= 0) return lang === "en" ? "0 min" : "0 λεπ.";
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return lang === "en" ? "<1 min" : "<1 λεπ.";
  if (totalMin < 60) return lang === "en" ? `${totalMin} min` : `${totalMin} λεπ.`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (lang === "en") return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return m > 0 ? `${h}ώ ${m}λ` : `${h}ώ`;
}

function formatDayLabel(dateStr: string, fallback: string, lang: AppLang): string {
  if (lang !== "en") return fallback;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return fallback;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function HomeProgressOverview({ vocab, meta, onOpenStats }: Props) {
  const { lang, t } = useAppLang();
  const summary = useMemo(() => homeProgressSummary(vocab, meta, Date.now()), [vocab, meta]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { daily, monthly } = summary;
  const ringOffset = CIRCUMFERENCE * (1 - daily.goalRatio);
  const dailyComplete = daily.wordsPracticed >= daily.targetWords;

  const maxDaySignal = useMemo(() => {
    return Math.max(
      1,
      ...monthly.days.map((d) => Math.max(d.wordsPracticed, d.assimilated * 2, d.sessions)),
    );
  }, [monthly.days]);

  const activeDay = useMemo(() => {
    if (selectedDate) {
      return monthly.days.find((d) => d.date === selectedDate) || null;
    }
    const latest = [...monthly.days].reverse().find((d) => d.active);
    return latest || monthly.days[monthly.days.length - 1] || null;
  }, [monthly.days, selectedDate]);

  return (
    <section aria-label={t("Ημερήσια και μηνιαία πρόοδος", "Daily and monthly progress")} className="flex flex-col gap-3">
      {/* Clean unboxed header with action link */}
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="ww-display text-[19px] font-bold leading-tight text-[#211F1C]">
          {t("Ημερήσια & Μηνιαία πρόοδος", "Daily & Monthly Progress")}
        </h2>
        <button
          type="button"
          onClick={onOpenStats}
          className="inline-flex min-h-[40px] items-center gap-0.5 whitespace-nowrap text-xs font-semibold text-[#6B655B] transition-colors hover:text-[#211F1C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FA091]"
        >
          <span>{t("Fortschritt", "Progress")}</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Card 1: Daily Progress */}
      <article aria-label={t("Ημερήσια πρόοδος", "Daily progress")} className="ww-tag-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#4A453D]">
            <Sun size={14} className="shrink-0 text-[#CB9146]" aria-hidden="true" />
            <span>{t("Ημερήσια πρόοδος", "Daily progress")}</span>
          </div>
          <span className="ww-mono text-[11px] tabular-nums text-[#8B8680]">{t("Σήμερα", "Today")}</span>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <div
            role="progressbar"
            aria-label={t("Ημερήσιος στόχος εξάσκησης", "Daily practice goal")}
            aria-valuemin={0}
            aria-valuemax={daily.targetWords}
            aria-valuenow={Math.min(daily.wordsPracticed, daily.targetWords)}
            aria-valuetext={t(
              `${daily.wordsPracticed} από ${daily.targetWords} λέξεις σήμερα (${daily.goalPct}%)`,
              `${daily.wordsPracticed} of ${daily.targetWords} words today (${daily.goalPct}%)`,
            )}
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
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke="#ECE4D3"
                strokeWidth={STROKE_WIDTH}
              />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={dailyComplete ? "#3F8C5F" : "#4FA091"}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500 motion-safe:ease-out"
              />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="ww-display text-lg font-bold leading-none tabular-nums text-[#211F1C]">
                {daily.goalPct}%
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="ww-display text-[19px] font-bold leading-tight tabular-nums text-[#211F1C]">
              {daily.wordsPracticed} / {daily.targetWords} {t("λέξεις", "words")}
            </div>
            <p className="mt-0.5 text-xs text-[#6B655B]">
              {dailyComplete
                ? t("Ολοκληρώθηκε ο σημερινός στόχος εξάσκησης.", "Today's practice goal is complete.")
                : daily.wordsPracticed > 0
                  ? t(
                      `${daily.targetWords - daily.wordsPracticed} ακόμα για τον ημερήσιο στόχο.`,
                      `${daily.targetWords - daily.wordsPracticed} more to reach today's goal.`,
                    )
                  : t(
                      "Ξεκίνα την εξάσκηση για να καταγραφεί η σημερινή πρόοδος.",
                      "Start practicing to log today's progress.",
                    )}
            </p>
          </div>
        </div>

        <dl className="mt-3.5 grid grid-cols-3 gap-2 border-t border-[#ECE4D3] pt-3">
          <div>
            <dt className="text-[11px] text-[#8B8680]">{t("Ακρίβεια", "Accuracy")}</dt>
            <dd className="ww-mono mt-0.5 text-sm font-bold tabular-nums text-[#211F1C]">
              {daily.accuracyPct != null ? `${daily.accuracyPct}%` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[#8B8680]">{t("XP σήμερα", "XP today")}</dt>
            <dd className="ww-mono mt-0.5 text-sm font-bold tabular-nums text-[#B07A2A]">
              +{daily.xp}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[#8B8680]">{t("Χρόνος", "Time")}</dt>
            <dd className="ww-mono mt-0.5 text-sm font-bold tabular-nums text-[#211F1C]">
              {formatCompactDuration(daily.durationMs, lang)}
            </dd>
          </div>
        </dl>
      </article>

      {/* Card 2: Monthly Progress (30-day rolling window) */}
      <article aria-label={t("Μηνιαία πρόοδος", "Monthly progress")} className="ww-tag-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#4A453D]">
            <Calendar size={14} className="shrink-0 text-[#4FA091]" aria-hidden="true" />
            <span>{t("Μηνιαία πρόοδος", "Monthly progress")}</span>
          </div>
          <span className="ww-mono text-[11px] tabular-nums text-[#6B655B]">
            {monthly.activeDays}/{monthly.windowDays} {t("ενεργές ημ.", "active days")}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2">
          <div>
            <dt className="text-[11px] text-[#8B8680]">{t("Αφομοιωμένες", "Assimilated")}</dt>
            <dd className="ww-display mt-0.5 text-2xl font-bold leading-none tabular-nums text-[#211F1C]">
              {monthly.assimilated}
            </dd>
            <span className="ww-mono mt-1 block text-[10.5px] tabular-nums text-[#6B655B]">
              {monthly.ratePerDay.toFixed(1)} / {t("ημ.", "day")}
            </span>
          </div>
          <div>
            <dt className="text-[11px] text-[#8B8680]">{t("Εξασκημένες", "Practiced")}</dt>
            <dd className="ww-display mt-0.5 text-2xl font-bold leading-none tabular-nums text-[#211F1C]">
              {monthly.practicedWords}
            </dd>
            <span className="ww-mono mt-1 block text-[10.5px] tabular-nums text-[#6B655B]">
              {monthly.mastered > 0
                ? t(`${monthly.mastered} κατάκτ.`, `${monthly.mastered} mastered`)
                : t("30 ημέρες", "30 days")}
            </span>
          </div>
          <div>
            <dt className="text-[11px] text-[#8B8680]">{t("XP μήνα", "30d XP")}</dt>
            <dd className="ww-display mt-0.5 text-2xl font-bold leading-none tabular-nums text-[#B07A2A]">
              {monthly.xp}
            </dd>
            <span className="ww-mono mt-1 block text-[10.5px] tabular-nums text-[#6B655B]">
              {formatCompactDuration(monthly.durationMs, lang)}
            </span>
          </div>
        </dl>

        {/* Interactive 30-day activity strip */}
        <div
          role="group"
          aria-label={t("Ημερήσια δραστηριότητα τελευταίων 30 ημερών", "Daily activity over the last 30 days")}
          className="mt-3.5 flex h-11 items-end gap-[3px] border-t border-[#ECE4D3] pt-3"
        >
          {monthly.days.map((pt) => {
            const signal = Math.max(pt.wordsPracticed, pt.assimilated * 2, pt.sessions);
            const heightPct = pt.active
              ? Math.max(24, Math.round((signal / maxDaySignal) * 100))
              : 12;
            const isSelected = activeDay?.date === pt.date;
            const dayLabel = formatDayLabel(pt.date, pt.day, lang);
            return (
              <button
                key={pt.date}
                type="button"
                aria-label={t(
                  `${dayLabel}: ${pt.wordsPracticed} λέξεις, +${pt.xp} XP`,
                  `${dayLabel}: ${pt.wordsPracticed} words, +${pt.xp} XP`,
                )}
                aria-pressed={isSelected}
                onClick={() => setSelectedDate(pt.date)}
                className="group flex h-full flex-1 items-end justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#4FA091]"
              >
                <span
                  className="block w-full rounded-t-[2px] transition-opacity"
                  style={{
                    height: `${heightPct}%`,
                    background: isSelected ? "#B5542E" : pt.active ? "#4FA091" : "#E5DEC9",
                    opacity: isSelected ? 1 : pt.active ? 0.85 : 0.7,
                  }}
                />
              </button>
            );
          })}
        </div>

        {activeDay && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#6B655B] tabular-nums">
            <span className="font-semibold text-[#211F1C]">
              {formatDayLabel(activeDay.date, activeDay.day, lang)}
              {activeDay.isToday ? t(" · Σήμερα", " · Today") : ""}
            </span>
            <span>
              {activeDay.active ? (
                <>
                  <strong className="font-semibold text-[#211F1C]">
                    {activeDay.wordsPracticed}
                  </strong>{" "}
                  {t("λέξεις", "words")} <span aria-hidden="true">·</span>{" "}
                  <strong className="font-semibold text-[#B07A2A]">+{activeDay.xp} XP</strong>
                  {activeDay.assimilated > 0 && (
                    <>
                      {" "}
                      <span aria-hidden="true">·</span> +{activeDay.assimilated}{" "}
                      {t("αφομ.", "assim.")}
                    </>
                  )}
                </>
              ) : (
                t("Χωρίς καταγεγραμμένη εξάσκηση", "No practice logged")
              )}
            </span>
          </div>
        )}
      </article>
    </section>
  );
}
