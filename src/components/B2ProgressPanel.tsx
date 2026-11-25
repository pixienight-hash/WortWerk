import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { b2ProgressSummary, normalizedWord, type B2StageKey, type Word } from "@/lib/wortwerk-data";
import MasteryEvidence from "@/components/MasteryEvidence";
import { useAppLang, wordPrimaryMeanings, type AppLang } from "@/lib/i18n";

type HeroMetric = "readiness" | "assimilated" | "mastered";
type AnalyticsTab = "games" | "daily7d" | "pos" | "tests";
type StageFilter = "all" | "due" | B2StageKey;
type WordSort = "closest" | "weakest" | "az";

type TestLog = {
  date: string;
  total: number;
  exact: number;
  near: number;
  synonym?: number;
  wrong: number;
  scope?: string;
};

type Props = {
  vocab: Word[];
  testLogs: TestLog[];
  onStartB2Practice?: () => void;
};

const STAGE_META: {
  key: B2StageKey;
  labelEl: string;
  labelEn: string;
  shortEl: string;
  shortEn: string;
  color: string;
  bg: string;
}[] = [
  {
    key: "Retained",
    labelEl: "Διατήρηση",
    labelEn: "Retained",
    shortEl: "Διατήρ.",
    shortEn: "Retain.",
    color: "#3F8C5F",
    bg: "rgba(63,140,95,0.14)",
  },
  {
    key: "Provisionally mastered",
    labelEl: "Κατάκτηση",
    labelEn: "Mastered",
    shortEl: "Κατάκτ.",
    shortEn: "Master.",
    color: "#6FA96B",
    bg: "rgba(111,169,107,0.16)",
  },
  {
    key: "Consolidating",
    labelEl: "Αφομοίωση",
    labelEn: "Consolidating",
    shortEl: "Αφομ.",
    shortEn: "Consol.",
    color: "#CB9146",
    bg: "rgba(203,145,70,0.16)",
  },
  {
    key: "Learning",
    labelEl: "Εκμάθηση",
    labelEn: "Learning",
    shortEl: "Εκμάθ.",
    shortEn: "Learn.",
    color: "#4FA091",
    bg: "rgba(79,160,145,0.16)",
  },
  {
    key: "New",
    labelEl: "Νέες",
    labelEn: "New",
    shortEl: "Νέες",
    shortEn: "New",
    color: "#A79F8E",
    bg: "rgba(167,159,142,0.16)",
  },
];

const GAME_COLORS: Record<string, string> = {
  flashcard: "#4FA091",
  mc: "#C1543C",
  fill: "#8B7BC7",
  context: "#3F8C5F",
  recall: "#CB9146",
};

const GAME_LABELS_EN: Record<string, string> = {
  flashcard: "Flashcards",
  mc: "Multiple Choice",
  fill: "Fill Blank",
  context: "Context",
  recall: "Recall",
};

const POS_LABELS: Record<string, { el: string; en: string }> = {
  Nomen: { el: "Ουσιαστικά", en: "Nouns" },
  Verb: { el: "Ρήματα", en: "Verbs" },
  Adjektiv: { el: "Επίθετα", en: "Adjectives" },
  Sonstiges: { el: "Λοιπά", en: "Other" },
};

function formatDayShort(dateStr: string, fallback: string, lang: AppLang): string {
  if (lang !== "en") return fallback;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return fallback;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export default function B2ProgressPanel({ vocab, testLogs, onStartB2Practice }: Props) {
  const { lang, t } = useAppLang();
  const [heroMetric, setHeroMetric] = useState<HeroMetric>("readiness");
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("games");
  const [gameMetricMode, setGameMetricMode] = useState<"accuracy" | "attempts">("accuracy");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [posFilter, setPosFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<WordSort>("closest");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAllWords, setShowAllWords] = useState(false);

  const summary = useMemo(() => b2ProgressSummary(vocab, Date.now()), [vocab]);

  const localizedByGame = useMemo(
    () =>
      summary.byGame.map((g) => ({
        ...g,
        displayLabel: lang === "en" ? GAME_LABELS_EN[g.mode] || g.label : g.label,
      })),
    [summary.byGame, lang],
  );

  const localizedDaily7d = useMemo(
    () =>
      summary.daily7d.map((pt) => ({
        ...pt,
        displayDay: formatDayShort(pt.date, pt.day, lang),
      })),
    [summary.daily7d, lang],
  );

  const b2Tests = useMemo(
    () =>
      (testLogs || [])
        .filter((x) => x && x.scope === "b2" && x.total > 0)
        .map((x, idx) => ({
          ...x,
          idx: idx + 1,
          label: `${x.date.slice(8, 10)}/${x.date.slice(5, 7)}`,
          pct: Math.round(((x.exact + x.near) / x.total) * 100),
        })),
    [testLogs],
  );

  const heroStats = useMemo(() => {
    const total = summary.total;
    if (heroMetric === "mastered") {
      const pct = total > 0 ? Math.round((summary.mastered / total) * 100) : 0;
      return {
        pct,
        primary: `${summary.mastered} / ${total}`,
        subtitle: t("Πλήρως τεκμηριωμένες B2 λέξεις", "Fully verified B2 words"),
        color: "#6FA96B",
      };
    }
    if (heroMetric === "assimilated") {
      const pct = total > 0 ? Math.round((summary.assimilated / total) * 100) : 0;
      return {
        pct,
        primary: `${summary.assimilated} / ${total}`,
        subtitle: t("B2 λέξεις με 3+ ακριβείς ανακλήσεις", "B2 words with 3+ accurate recalls"),
        color: "#CB9146",
      };
    }
    return {
      pct: summary.avgReadinessPct,
      primary: t(`${summary.started} / ${total} ενεργές`, `${summary.started} / ${total} active`),
      subtitle: t("Μέσος δείκτης ετοιμότητας τεκμηρίωσης B2", "Average B2 mastery readiness score"),
      color: "#4FA091",
    };
  }, [heroMetric, summary, t]);

  const activeDayPoint = useMemo(() => {
    const fallback =
      [...localizedDaily7d].reverse().find((d) => d.attempts > 0) ||
      localizedDaily7d[localizedDaily7d.length - 1];
    return localizedDaily7d.find((d) => d.date === selectedDay) || fallback;
  }, [localizedDaily7d, selectedDay]);

  const gameInsight = useMemo(() => {
    const scored = localizedByGame.filter((g) => !g.isExposure && g.attempts > 0);
    if (!scored.length) return null;
    const sorted = [...scored].sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts);
    const best = sorted[0];
    const weakest = sorted[sorted.length - 1];
    if (!best || !weakest) return null;
    return { best, weakest };
  }, [localizedByGame]);

  const filteredWords = useMemo(() => {
    const q = normalizedWord(search);
    const list = summary.words.filter((item) => {
      if (stageFilter === "due" && !item.due) return false;
      if (stageFilter !== "all" && stageFilter !== "due" && item.level !== stageFilter) {
        return false;
      }
      if (posFilter !== "all" && item.type !== posFilter) return false;
      if (q) {
        const hitWord = normalizedWord(item.label).includes(q);
        const hitGreek = normalizedWord(item.greek).includes(q);
        const hitEnglish = ((item.word?.meaning?.english) || []).some((e: string) =>
          normalizedWord(e).includes(q),
        );
        if (!hitWord && !hitGreek && !hitEnglish) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "az") return a.label.localeCompare(b.label, "de");
      if (sortBy === "weakest") {
        const aHas = a.attempts > 0 ? 0 : 1;
        const bHas = b.attempts > 0 ? 0 : 1;
        if (aHas !== bHas) return aHas - bHas;
        if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
        return b.attempts - a.attempts;
      }
      if (a.mastered !== b.mastered) return a.mastered ? 1 : -1;
      if (b.readinessPct !== a.readinessPct) return b.readinessPct - a.readinessPct;
      if (a.due !== b.due) return a.due ? -1 : 1;
      return a.label.localeCompare(b.label, "de");
    });
  }, [summary.words, stageFilter, posFilter, search, sortBy]);

  const visibleWords = showAllWords ? filteredWords : filteredWords.slice(0, 10);

  const ringSize = 104;
  const strokeWidth = 9;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(100, Math.max(0, heroStats.pct)) / 100);

  if (summary.total === 0) {
    return (
      <div className="ww-tag-card ww-pop p-5 text-center">
        <div className="ww-display text-lg font-semibold text-[#211F1C]">
          {t("Δεν υπάρχουν ενεργές λέξεις B2", "No active B2 words")}
        </div>
        <p className="mt-1 text-xs text-[#8B8680]">
          {t(
            "Πρόσθεσε ή ενεργοποίησε λέξεις με επίπεδο B2 για να παρακολουθείς τη δυναμική τους πρόοδο.",
            "Add or enable B2 words to track their live progress.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Dynamic B2 Readiness Hero Card */}
      <div className="ww-hero-card ww-pop p-5 text-[#F5F0E6]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[#A7E3D7]">
            <Target size={15} />
            <span className="ww-mono text-[11px] uppercase tracking-wider">
              {t("Πρόοδος B2 · Live Evidence", "B2 Progress · Live Evidence")}
            </span>
          </div>
          <span className="ww-mono rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-[#F5F0E6]">
            {summary.total} {t("λέξεις", "words")}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} className="-rotate-90">
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="rgba(245,240,230,0.14)"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke={heroStats.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 450ms ease, stroke 250ms ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="ww-display ww-mono text-2xl font-bold leading-none text-[#F5F0E6]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {heroStats.pct}%
              </span>
              <span className="mt-1 text-[10px] text-[#F5F0E6]/65">B2</span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="ww-display text-xl font-bold leading-tight text-[#F5F0E6]">
              {heroStats.primary}
            </div>
            <div className="mt-1 text-xs leading-snug text-[#F5F0E6]/72">{heroStats.subtitle}</div>
            <div
              role="group"
              aria-label={t("Κριτήριο δείκτη B2", "B2 indicator metric")}
              className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-white/10 p-1"
            >
              {(
                [
                  { id: "readiness", label: t("Ετοιμ.", "Ready") },
                  { id: "assimilated", label: t("Αφομ.", "Assim.") },
                  { id: "mastered", label: t("Κατάκτ.", "Master.") },
                ] as const
              ).map((opt) => {
                const active = heroMetric === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setHeroMetric(opt.id)}
                    className="rounded-md px-1.5 py-1 text-[11px] font-semibold transition-colors"
                    style={{
                      background: active ? "#F5F0E6" : "transparent",
                      color: active ? "#211F1C" : "rgba(245,240,230,0.78)",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 border-t border-white/10 pt-3.5 text-center">
          <div>
            <div className="ww-mono text-sm font-bold text-[#A7E3D7]">
              {summary.scoredAttempts > 0 ? `${summary.evidenceAccuracy}%` : "—"}
            </div>
            <div className="text-[10px] text-[#F5F0E6]/65">{t("Συν. ακρίβεια", "Accuracy")}</div>
          </div>
          <div>
            <div className="ww-mono text-sm font-bold text-[#E5C17B]">
              {summary.activeRecallAttempts > 0 ? `${summary.activeRecallAccuracy}%` : "—"}
            </div>
            <div className="text-[10px] text-[#F5F0E6]/65">{t("Ενεργή ανάκλ.", "Active recall")}</div>
          </div>
          <div>
            <div className="ww-mono text-sm font-bold text-[#F2D9A0]">{summary.due}</div>
            <div className="text-[10px] text-[#F5F0E6]/65">{t("Οφείλονται", "Due")}</div>
          </div>
          <div>
            <div className="ww-mono text-sm font-bold text-[#F5F0E6]">{summary.typedVerified}</div>
            <div className="text-[10px] text-[#F5F0E6]/65">{t("Γραφή Recall", "Typed recall")}</div>
          </div>
        </div>

        {onStartB2Practice && (
          <button
            type="button"
            onClick={onStartB2Practice}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#F5F0E6] py-3 text-sm font-bold text-[#211F1C] transition-opacity hover:opacity-95"
          >
            <Sparkles size={15} />
            {t("Εξάσκηση & Τεστ μόνο B2", "B2-Only Practice & Test")}
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* 2. Interactive 5-Stage B2 Mastery Funnel */}
      <div className="ww-tag-card p-4">
        <div className="ww-tag-hole" />
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-[#211F1C]">
              {t("Στάδια κατάκτησης B2", "B2 Mastery Stages")}
            </div>
            <div className="text-[11px] text-[#8B8680]">
              {t(
                "Πάτησε ένα στάδιο για δυναμικό φιλτράρισμα των B2 λέξεων",
                "Tap a stage to filter B2 words dynamically",
              )}
            </div>
          </div>
          {stageFilter !== "all" && (
            <button
              type="button"
              onClick={() => setStageFilter("all")}
              className="text-[11px] font-semibold text-[#4FA091] underline"
            >
              {t("Όλα", "All")}
            </button>
          )}
        </div>

        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-[#ECE4D3]">
          {STAGE_META.map((st) => {
            const count = summary.stages[st.key] || 0;
            const widthPct = summary.total > 0 ? (count / summary.total) * 100 : 0;
            if (widthPct <= 0) return null;
            return (
              <div
                key={st.key}
                title={`${lang === "en" ? st.labelEn : st.labelEl}: ${count}`}
                style={{
                  width: `${widthPct}%`,
                  background: st.color,
                  transition: "width 350ms ease",
                }}
              />
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {STAGE_META.map((st) => {
            const count = summary.stages[st.key] || 0;
            const active = stageFilter === st.key;
            return (
              <button
                key={st.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setStageFilter(active ? "all" : st.key);
                  setShowAllWords(false);
                }}
                className="rounded-lg px-1 py-2 text-center transition-all"
                style={{
                  border: active ? `1.5px solid ${st.color}` : "1px solid #ECE4D3",
                  background: active ? st.bg : "#FAF7F0",
                }}
              >
                <div
                  className="ww-mono text-sm font-bold"
                  style={{ color: count > 0 ? st.color : "#A79F8E" }}
                >
                  {count}
                </div>
                <div className="mt-0.5 truncate text-[10px] font-medium text-[#4A453D]">
                  {lang === "en" ? st.shortEn : st.shortEl}
                </div>
              </button>
            );
          })}
        </div>
        {summary.previouslyKnown > 0 && (
          <div className="mt-2.5 flex items-center justify-between border-t border-[#ECE4D3] pt-2 text-[11px] text-[#6B655B]">
            <span>
              {t("Γνωρίζω ήδη (εκτός κατάκτησης WortWerk)", "Already know (excluded from WortWerk mastery)")}
            </span>
            <strong className="ww-mono text-[#2D6E62]">{summary.previouslyKnown}</strong>
          </div>
        )}
      </div>

      {/* 3. Dynamic Analytics Card (Games / 7-Day B2 Activity / POS / B2 Tests) */}
      <div className="ww-tag-card p-4">
        <div className="ww-tag-hole" />
        <div
          role="group"
          aria-label={t("Δυναμική ανάλυση B2", "B2 live analytics")}
          className="grid grid-cols-4 gap-1 rounded-xl border border-[#ECE4D3] bg-[#FAF7F0] p-1"
        >
          {(
            [
              { id: "games", label: t("Παιχνίδια", "Games") },
              { id: "daily7d", label: t("7 Ημ.", "7 Days") },
              { id: "pos", label: t("Είδη", "POS") },
              { id: "tests", label: t("Τεστ B2", "B2 Tests") },
            ] as const
          ).map((tab) => {
            const active = analyticsTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setAnalyticsTab(tab.id)}
                className="rounded-lg py-1.5 text-[11.5px] transition-all"
                style={{
                  background: active ? "#FFFFFF" : "transparent",
                  color: active ? "#211F1C" : "#8B8680",
                  fontWeight: active ? 700 : 500,
                  boxShadow: active ? "0 1px 3px rgba(33,31,28,0.08)" : "none",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {analyticsTab === "games" && (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#211F1C]">
                {t("Επίδοση B2 ανά παιχνίδι", "B2 performance by game")}
              </div>
              <div className="flex gap-1 rounded-lg bg-[#FAF7F0] p-0.5 text-[10.5px]">
                <button
                  type="button"
                  onClick={() => setGameMetricMode("accuracy")}
                  className="rounded-md px-2 py-0.5 font-semibold"
                  style={{
                    background: gameMetricMode === "accuracy" ? "#211F1C" : "transparent",
                    color: gameMetricMode === "accuracy" ? "#F5F0E6" : "#8B8680",
                  }}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setGameMetricMode("attempts")}
                  className="rounded-md px-2 py-0.5 font-semibold"
                  style={{
                    background: gameMetricMode === "attempts" ? "#211F1C" : "transparent",
                    color: gameMetricMode === "attempts" ? "#F5F0E6" : "#8B8680",
                  }}
                >
                  {t("Προσπ.", "Tries")}
                </button>
              </div>
            </div>

            {summary.evidenceAttempts === 0 ? (
              <div className="py-8 text-center text-xs text-[#8B8680]">
                {t(
                  "Δεν υπάρχουν ακόμα καταγεγραμμένες B2 προσπάθειες. Ξεκίνα μια εξάσκηση ή τεστ B2!",
                  "No B2 attempts logged yet. Start a B2 practice or test!",
                )}
              </div>
            ) : (
              <>
                <div className="mt-2 h-[155px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={localizedByGame}
                      margin={{ top: 8, right: 6, left: -22, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#ECE4D3" vertical={false} />
                      <XAxis
                        dataKey="displayLabel"
                        tick={{ fill: "#6B655B", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        domain={gameMetricMode === "accuracy" ? [0, 100] : [0, "auto"]}
                        tick={{ fill: "#A79F8E", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(79,160,145,0.08)" }}
                        content={({ active, payload }) => {
                          const pt = active && payload?.[0]?.payload;
                          if (!pt) return null;
                          return (
                            <div className="rounded-lg border border-[#E8E0CE] bg-white px-2.5 py-2 text-xs shadow-sm">
                              <div className="font-bold text-[#211F1C]">{pt.displayLabel}</div>
                              <div className="mt-0.5 text-[#4A453D]">
                                {pt.attempts > 0
                                  ? `${pt.correct}/${pt.attempts} (${pt.accuracy}%)`
                                  : t("Χωρίς προσπάθειες", "No attempts")}
                              </div>
                              {pt.isExposure && (
                                <div className="text-[10.5px] text-[#8B8680]">
                                  {t(
                                    "Αυτοαξιολόγηση (δεν μετράει ως κατάκτηση)",
                                    "Self-rating (does not count toward mastery)",
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey={gameMetricMode} radius={[5, 5, 0, 0]} maxBarSize={28}>
                        {localizedByGame.map((g) => (
                          <Cell
                            key={g.mode}
                            fill={g.attempts > 0 ? GAME_COLORS[g.mode] || "#4FA091" : "#E8E0CE"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {gameInsight && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#ECE4D3] pt-2 text-[11px] text-[#4A453D]">
                    <span>
                      {t("Δυνατότερο:", "Strongest:")}{" "}
                      <strong className="text-[#3F8C5F]">{gameInsight.best.displayLabel}</strong> (
                      {gameInsight.best.accuracy}%)
                    </span>
                    {gameInsight.weakest.mode !== gameInsight.best.mode && (
                      <span>
                        {t("Για ενίσχυση:", "Needs work:")}{" "}
                        <strong className="text-[#C1543C]">{gameInsight.weakest.displayLabel}</strong> (
                        {gameInsight.weakest.accuracy}%)
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {analyticsTab === "daily7d" && (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#211F1C]">
                {t("Δραστηριότητα B2 · Τελευταίες 7 ημέρες", "B2 Activity · Last 7 days")}
              </div>
              <span className="ww-mono text-[11px] text-[#4FA091]">
                {localizedDaily7d.reduce((s, d) => s + d.attempts, 0)} {t("προσπάθειες", "attempts")}
              </span>
            </div>

            <div className="mt-2 h-[145px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={localizedDaily7d}
                  margin={{ top: 8, right: 6, left: -24, bottom: 0 }}
                  onClick={(state) => {
                    const pt = state?.activePayload?.[0]?.payload;
                    if (pt?.date) setSelectedDay(pt.date);
                  }}
                >
                  <defs>
                    <linearGradient id="wwB2DailyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4FA091" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#4FA091" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECE4D3" vertical={false} />
                  <XAxis
                    dataKey="displayDay"
                    tick={{ fill: "#8B8680", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="att"
                    allowDecimals={false}
                    tick={{ fill: "#A79F8E", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis yAxisId="acc" orientation="right" hide domain={[0, 100]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      const pt = active && payload?.[0]?.payload;
                      if (!pt) return null;
                      return (
                        <div className="rounded-lg border border-[#E8E0CE] bg-white px-2.5 py-2 text-xs shadow-sm">
                          <div className="font-bold text-[#211F1C]">
                            {pt.displayDay}
                            {pt.isToday ? t(" · Σήμερα", " · Today") : ""}
                          </div>
                          <div className="mt-0.5 font-semibold text-[#4FA091]">
                            {t(
                              `${pt.attempts} προσπάθειες (${pt.uniqueWords} B2 λέξεις)`,
                              `${pt.attempts} attempts (${pt.uniqueWords} B2 words)`,
                            )}
                          </div>
                          {pt.scored > 0 && (
                            <div className="text-[11px] text-[#4A453D]">
                              {t("Ακρίβεια:", "Accuracy:")} {pt.accuracy}% ({pt.correct}/{pt.scored})
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Area
                    yAxisId="acc"
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#4FA091"
                    strokeWidth={1.75}
                    fill="url(#wwB2DailyGrad)"
                    dot={false}
                  />
                  <Bar yAxisId="att" dataKey="attempts" radius={[4, 4, 0, 0]} maxBarSize={20}>
                    {localizedDaily7d.map((pt) => (
                      <Cell
                        key={pt.date}
                        cursor="pointer"
                        fill={
                          pt.attempts === 0
                            ? "#ECE4D3"
                            : activeDayPoint?.date === pt.date
                              ? "#CB9146"
                              : "#4FA091"
                        }
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1">
              {localizedDaily7d.map((pt) => {
                const active = activeDayPoint?.date === pt.date;
                return (
                  <button
                    key={pt.date}
                    type="button"
                    onClick={() => setSelectedDay(pt.date)}
                    className="rounded-lg py-1 text-center text-[10px]"
                    style={{
                      border: active ? "1px solid #4FA091" : "1px solid #ECE4D3",
                      background: active ? "rgba(79,160,145,0.14)" : "#FAF7F0",
                      color: active ? "#211F1C" : "#8B8680",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    <div>{pt.isToday ? t("Σήμ.", "Tod.") : pt.displayDay.slice(0, 2)}</div>
                    <div className="ww-mono text-[9.5px] text-[#4FA091]">{pt.attempts}</div>
                  </button>
                );
              })}
            </div>

            {activeDayPoint && (
              <div className="mt-2 flex items-center justify-between border-t border-[#ECE4D3] pt-2 text-[11.5px] text-[#4A453D]">
                <span>
                  {activeDayPoint.displayDay}
                  {activeDayPoint.isToday ? t(" (Σήμερα)", " (Today)") : ""}
                </span>
                <span>
                  <strong>{activeDayPoint.uniqueWords}</strong> {t("B2 λέξεις", "B2 words")} ·{" "}
                  <strong>{activeDayPoint.attempts}</strong> {t("προσπ.", "tries")}
                  {activeDayPoint.scored > 0 ? ` · ${activeDayPoint.accuracy}%` : ""}
                </span>
              </div>
            )}
          </div>
        )}

        {analyticsTab === "pos" && (
          <div className="mt-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-[#211F1C]">
                {t("B2 ανά γραμματικό είδος", "B2 by part of speech")}
              </div>
              {posFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setPosFilter("all")}
                  className="text-[11px] font-semibold text-[#4FA091] underline"
                >
                  {t("Καθαρισμός φίλτρου", "Clear filter")}
                </button>
              )}
            </div>
            {summary.byPos.map((row) => {
              const mastPct = row.total ? Math.round((row.mastered / row.total) * 100) : 0;
              const assimPct = row.total
                ? Math.round(((row.assimilated - row.mastered) / row.total) * 100)
                : 0;
              const startPct = row.total
                ? Math.round(((row.started - row.assimilated) / row.total) * 100)
                : 0;
              const active = posFilter === row.type;
              const posLabel = POS_LABELS[row.type]
                ? lang === "en"
                  ? POS_LABELS[row.type].en
                  : POS_LABELS[row.type].el
                : row.type;
              return (
                <button
                  key={row.type}
                  type="button"
                  onClick={() => {
                    setPosFilter(active ? "all" : row.type);
                    setShowAllWords(false);
                  }}
                  className="w-full rounded-xl p-2.5 text-left transition-colors"
                  style={{
                    border: active ? "1.5px solid #4FA091" : "1px solid #ECE4D3",
                    background: active ? "rgba(79,160,145,0.08)" : "#FAF7F0",
                  }}
                >
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-[#211F1C]">
                      {posLabel}{" "}
                      <span className="font-normal text-[#8B8680]">({row.type})</span>
                    </span>
                    <span className="ww-mono text-[11px] font-semibold text-[#4FA091]">
                      {row.assimilated}/{row.total} ({row.pct}%)
                    </span>
                  </div>
                  <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-[#ECE4D3]">
                    <div
                      style={{
                        width: `${mastPct}%`,
                        background: "#6FA96B",
                        transition: "width 350ms ease",
                      }}
                    />
                    <div
                      style={{
                        width: `${assimPct}%`,
                        background: "#CB9146",
                        transition: "width 350ms ease",
                      }}
                    />
                    <div
                      style={{
                        width: `${startPct}%`,
                        background: "#4FA091",
                        opacity: 0.7,
                        transition: "width 350ms ease",
                      }}
                    />
                  </div>
                  <div className="mt-1 text-[10.5px] text-[#8B8680]">
                    {t(
                      `${row.mastered} κατακτημένες · ${row.assimilated} αφομοιωμένες · ${row.remaining} νέες`,
                      `${row.mastered} mastered · ${row.assimilated} assimilated · ${row.remaining} new`,
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {analyticsTab === "tests" && (
          <div className="mt-3">
            {b2Tests.length === 0 ? (
              <div className="py-6 text-center">
                <div className="text-xs font-semibold text-[#211F1C]">
                  {t("Δεν υπάρχει ακόμα ιστορικό τεστ B2", "No B2 test history yet")}
                </div>
                <p className="mt-1 text-[11.5px] text-[#8B8680]">
                  {t(
                    "Ολοκλήρωσε ένα τεστ B2 (όλα τα παιχνίδια, 20 τυχαίες λέξεις) για να δεις την εξέλιξη βαθμολογίας.",
                    "Complete a B2 test (all games, 20 random words) to see your score trend.",
                  )}
                </p>
                {onStartB2Practice && (
                  <button
                    type="button"
                    onClick={onStartB2Practice}
                    className="mt-3 rounded-full bg-[#4FA091] px-4 py-2 text-xs font-bold text-white"
                  >
                    {t("Μετάβαση στο Τεστ B2", "Go to B2 Test")}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 font-semibold text-[#211F1C]">
                    <TrendingUp size={14} color="#4FA091" />
                    {t(`Εξέλιξη Τεστ B2 (${b2Tests.length})`, `B2 Test Trend (${b2Tests.length})`)}
                  </span>
                  <span className="ww-mono text-[11px] font-semibold text-[#4FA091]">
                    {t("Καλύτερο:", "Best:")} {Math.max(...b2Tests.map((x) => x.pct))}%
                  </span>
                </div>
                <div className="mt-2 h-[140px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={b2Tests} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="wwB2TestGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4FA091" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#4FA091" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ECE4D3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#8B8680", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "#A79F8E", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          const pt = active && payload?.[0]?.payload;
                          if (!pt) return null;
                          return (
                            <div className="rounded-lg border border-[#E8E0CE] bg-white px-2.5 py-2 text-xs shadow-sm">
                              <div className="font-bold text-[#211F1C]">
                                {t(`Τεστ B2 #${pt.idx}`, `B2 Test #${pt.idx}`)} ({pt.date})
                              </div>
                              <div className="mt-0.5 font-bold text-[#4FA091]">
                                {pt.pct}% ({pt.exact}+{pt.near}/{pt.total})
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="pct"
                        stroke="#4FA091"
                        strokeWidth={2.5}
                        fill="url(#wwB2TestGrad)"
                        dot={{ r: 3.5, fill: "#FFFFFF", stroke: "#4FA091", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 divide-y divide-[#ECE4D3] border-t border-[#ECE4D3]">
                  {b2Tests
                    .slice(-4)
                    .reverse()
                    .map((x) => (
                      <div
                        key={`${x.date}-${x.idx}`}
                        className="flex items-center justify-between py-1.5 text-xs"
                      >
                        <span className="text-[#8B8680]">
                          {x.date} · {t(`Τεστ #${x.idx}`, `Test #${x.idx}`)}
                        </span>
                        <span>
                          <strong className="text-[#211F1C]">{x.pct}%</strong>{" "}
                          <span className="text-[#A79F8E]">
                            ({x.exact}+{x.near}/{x.total})
                          </span>
                        </span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 4. Interactive B2 Word Readiness Explorer */}
      <div className="ww-tag-card p-4">
        <div className="ww-tag-hole" />
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-[#211F1C]">
              {t("Λέξεις B2", "B2 Words")} ({filteredWords.length}/{summary.total})
            </div>
            <div className="text-[11px] text-[#8B8680]">
              {t(
                "Πάτησε μια λέξη για πλήρη ανάλυση τεκμηρίωσης",
                "Tap a word for full evidence breakdown",
              )}
            </div>
          </div>
          <button
            type="button"
            aria-pressed={stageFilter === "due"}
            onClick={() => {
              setStageFilter(stageFilter === "due" ? "all" : "due");
              setShowAllWords(false);
            }}
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: stageFilter === "due" ? "#C1543C" : "rgba(193,84,60,0.12)",
              color: stageFilter === "due" ? "#FFFFFF" : "#C1543C",
            }}
          >
            {t("Οφείλονται", "Due")} ({summary.due})
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A79F8E]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowAllWords(false);
              }}
              aria-label={t("Αναζήτηση B2 λέξης", "Search B2 word")}
              placeholder={t("Αναζήτηση B2 λέξης...", "Search B2 word...")}
              className="h-9 w-full rounded-lg border border-[#E8E0CE] bg-[#FAF7F0] pl-8 pr-2.5 text-xs text-[#211F1C] outline-none focus:border-[#4FA091]"
            />
          </div>
          <select
            aria-label={t("Ταξινόμηση B2 λέξεων", "Sort B2 words")}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as WordSort)}
            className="h-9 rounded-lg border border-[#E8E0CE] bg-[#FAF7F0] px-2 text-xs text-[#211F1C] outline-none"
          >
            <option value="closest">{t("Πιο κοντά", "Closest")}</option>
            <option value="weakest">{t("Ακρίβεια ↑", "Accuracy ↑")}</option>
            <option value="az">{t("Α–Ω", "A–Z")}</option>
          </select>
        </div>

        {(stageFilter !== "all" || posFilter !== "all" || search) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            {stageFilter !== "all" && (
              <span className="rounded-full bg-[#F5F0E6] px-2 py-0.5 text-[#4A453D]">
                {t("Φίλτρο:", "Filter:")}{" "}
                {stageFilter === "due"
                  ? t("Οφείλονται", "Due")
                  : (() => {
                      const st = STAGE_META.find((s) => s.key === stageFilter);
                      return st ? (lang === "en" ? st.labelEn : st.labelEl) : stageFilter;
                    })()}
              </span>
            )}
            {posFilter !== "all" && (
              <span className="rounded-full bg-[#F5F0E6] px-2 py-0.5 text-[#4A453D]">
                {t("Είδος:", "Type:")}{" "}
                {POS_LABELS[posFilter]
                  ? lang === "en"
                    ? POS_LABELS[posFilter].en
                    : POS_LABELS[posFilter].el
                  : posFilter}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setStageFilter("all");
                setPosFilter("all");
                setSearch("");
              }}
              className="font-semibold text-[#4FA091] underline"
            >
              {t("Επαναφορά", "Reset")}
            </button>
          </div>
        )}

        <div className="mt-3 divide-y divide-[#F1EBDF]">
          {visibleWords.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#8B8680]">
              {t("Καμία B2 λέξη δεν ταιριάζει με τα φίλτρα.", "No B2 words match these filters.")}
            </div>
          ) : (
            visibleWords.map((item) => {
              const isOpen = expandedId === item.id;
              const stageInfo =
                STAGE_META.find((s) => s.key === item.level) || STAGE_META[STAGE_META.length - 1]!;
              const meaningLine = wordPrimaryMeanings(item.word, lang).join(", ") || item.greek;
              return (
                <div key={item.id} className="py-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : item.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13.5px] font-semibold text-[#211F1C]">
                          {item.label}
                        </span>
                        {item.due && (
                          <span
                            title={t("Οφείλεται σήμερα", "Due today")}
                            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C1543C]"
                          />
                        )}
                      </div>
                      <div className="truncate text-[11.5px] text-[#8B8680]">
                        {meaningLine} · {item.type}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className="w-20">
                        <div className="flex items-center justify-between text-[10px]">
                          <span style={{ color: stageInfo.color, fontWeight: 700 }}>
                            {item.criteriaMet}/{item.criteriaTotal}
                          </span>
                          <span className="ww-mono text-[#8B8680]">{item.readinessPct}%</span>
                        </div>
                        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-[#ECE4D3]">
                          <div
                            style={{
                              width: `${Math.max(item.readinessPct, item.attempts > 0 ? 6 : 0)}%`,
                              background: stageInfo.color,
                              transition: "width 300ms ease",
                            }}
                            className="h-full rounded-full"
                          />
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronUp size={15} className="text-[#8B8680]" />
                      ) : (
                        <ChevronDown size={15} className="text-[#8B8680]" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-2">
                      <MasteryEvidence word={item.word} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {filteredWords.length > 10 && (
          <button
            type="button"
            onClick={() => setShowAllWords((v) => !v)}
            className="mt-3 w-full rounded-lg border border-[#E8E0CE] bg-[#FAF7F0] py-2 text-xs font-semibold text-[#211F1C]"
          >
            {showAllWords
              ? t("Εμφάνιση λιγότερων", "Show fewer")
              : t(
                  `Εμφάνιση όλων των ${filteredWords.length} B2 λέξεων`,
                  `Show all ${filteredWords.length} B2 words`,
                )}
          </button>
        )}
      </div>
    </div>
  );
}
