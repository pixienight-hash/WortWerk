import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Flame, CheckCircle2, Target, RefreshCw } from "lucide-react";
import {
  SENTENCE_CEFR_LEVELS,
  SENTENCE_TYPES,
  SENTENCE_TYPE_LABELS,
  SENTENCE_STATUS_LABELS,
  computeSentenceStats,
  sentenceWeeklyTimeline,
  type SentenceEntry,
  type SentenceMeta,
  type SentenceMasteryStatus,
} from "@/lib/sentences-data";

interface Props {
  sentences: SentenceEntry[];
  meta: SentenceMeta;
}

const STATUS_ORDER: readonly SentenceMasteryStatus[] = [
  "new",
  "learning",
  "consolidating",
  "mastered",
  "retained",
];

export default function SentenceStatsView({ sentences, meta }: Props) {
  const stats = useMemo(() => computeSentenceStats(sentences, meta), [sentences, meta]);
  const weekly = useMemo(() => sentenceWeeklyTimeline(meta, 7), [meta]);

  const masteredAndRetained = stats.byStatus.mastered + stats.byStatus.retained;
  const overallMasteryPct =
    stats.total > 0 ? Math.round((masteredAndRetained / stats.total) * 100) : 0;

  return (
    <div className="px-5 pt-4 pb-8">
      <div>
        <h1 className="ww-display text-[26px] font-semibold leading-tight text-[#211F1C]">
          Fortschritt
        </h1>
        <p className="mt-0.5 text-[13px] text-[#8B8680]">
          Ανεξάρτητα στατιστικά προτάσεων &amp; εκφράσεων
        </p>
      </div>

      {/* Primary KPI Grid */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="ww-tag-card p-4">
          <div className="flex items-center gap-1.5 text-[#8B8680]">
            <Target size={14} />
            <span className="text-[11px]">Σύνολο προτάσεων</span>
          </div>
          <div className="ww-display mt-1 text-2xl font-bold text-[#211F1C]">{stats.total}</div>
        </div>

        <div className="ww-tag-card p-4">
          <div className="flex items-center gap-1.5 text-[#3F8C5F]">
            <CheckCircle2 size={14} />
            <span className="text-[11px]">Ποσοστό επιτυχίας</span>
          </div>
          <div className="ww-display mt-1 text-2xl font-bold text-[#211F1C]">
            {stats.successRate !== null ? `${stats.successRate}%` : "—"}
          </div>
          <div className="ww-mono text-[10px] text-[#8B8680]">
            {stats.totalCorrect}/{stats.totalAttempts} απαντήσεις
          </div>
        </div>

        <div className="ww-tag-card p-4">
          <div className="flex items-center gap-1.5 text-[#4FA091]">
            <RefreshCw size={14} />
            <span className="text-[11px]">Επαναλήφθηκαν</span>
          </div>
          <div className="ww-display mt-1 text-2xl font-bold text-[#211F1C]">
            {stats.reviewedCount}
          </div>
          <div className="ww-mono text-[10px] text-[#8B8680]">{stats.dueCount} οφείλονται</div>
        </div>

        <div className="ww-tag-card p-4">
          <div className="flex items-center gap-1.5 text-[#C1543C]">
            <Flame size={14} />
            <span className="text-[11px]">Σειρά ημερών</span>
          </div>
          <div className="ww-display mt-1 text-2xl font-bold text-[#211F1C]">{stats.streak}</div>
          <div className="ww-mono text-[10px] text-[#8B8680]">
            Σήμερα: {stats.todayUnique} προτ.
          </div>
        </div>
      </div>

      {/* Mastery Status Breakdown */}
      <div className="ww-tag-card mt-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="ww-display text-lg font-semibold text-[#211F1C]">Επίπεδα Κατάκτησης</h2>
          <span className="ww-mono text-xs font-semibold text-[#3F8C5F]">
            {overallMasteryPct}% Mastered+
          </span>
        </div>

        {/* Stacked progress bar */}
        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-[#ECE4D3]">
          {STATUS_ORDER.map((st) => {
            const count = stats.byStatus[st];
            if (!count || stats.total === 0) return null;
            const pct = (count / stats.total) * 100;
            return (
              <div
                key={st}
                title={`${SENTENCE_STATUS_LABELS[st].label}: ${count}`}
                style={{
                  width: `${pct}%`,
                  background: SENTENCE_STATUS_LABELS[st].color,
                }}
              />
            );
          })}
        </div>

        {/* All 5 Status Rows */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STATUS_ORDER.map((st) => {
            const metaSt = SENTENCE_STATUS_LABELS[st];
            const count = stats.byStatus[st];
            return (
              <div
                key={st}
                className="rounded-2xl border border-[#ECE4D3] bg-[#FAF8F4] p-3 text-center"
              >
                <div
                  className="ww-mono text-[10px] font-semibold uppercase"
                  style={{ color: metaSt.color }}
                >
                  {metaSt.label}
                </div>
                <div className="ww-display mt-1 text-2xl font-bold text-[#211F1C]">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily & Overall Progress */}
      <div className="ww-tag-card mt-4 p-5">
        <h2 className="ww-display text-lg font-semibold text-[#211F1C]">
          Ημερήσια &amp; Συνολική Πρόοδος
        </h2>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-[#F5F0E6] p-3">
            <div className="ww-display text-xl font-bold text-[#211F1C]">{stats.todayAttempts}</div>
            <div className="text-[11px] text-[#8B8680]">Προσπάθειες σήμερα</div>
          </div>
          <div className="rounded-2xl bg-[#F5F0E6] p-3">
            <div className="ww-display text-xl font-bold text-[#211F1C]">{stats.todayUnique}</div>
            <div className="text-[11px] text-[#8B8680]">Προτάσεις σήμερα</div>
          </div>
          <div className="rounded-2xl bg-[#F5F0E6] p-3">
            <div className="ww-display text-xl font-bold text-[#3F8C5F]">
              {stats.todayAccuracy !== null ? `${stats.todayAccuracy}%` : "—"}
            </div>
            <div className="text-[11px] text-[#8B8680]">Ακρίβεια σήμερα</div>
          </div>
        </div>

        <div className="mt-4 h-44 w-full">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={weekly} margin={{ top: 8, right: 6, left: -24, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#8B8680" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#8B8680" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#FFFFFF",
                  border: "1px solid #ECE4D3",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="attempts" name="Προσπάθειες" fill="#ECE4D3" radius={[6, 6, 0, 0]} />
              <Bar dataKey="correct" name="Σωστές" fill="#4FA091" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CEFR & Category Breakdown */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="ww-tag-card p-5">
          <h2 className="ww-display text-base font-semibold text-[#211F1C]">
            Ανά επίπεδο CEFR (έτοιμο για B2 / C1)
          </h2>
          <div className="mt-3 space-y-2.5">
            {SENTENCE_CEFR_LEVELS.map((lvl) => {
              const row = stats.byCefr[lvl];
              if (row.total === 0 && !["B2", "C1"].includes(lvl)) return null;
              const pct = row.total > 0 ? Math.round((row.mastered / row.total) * 100) : 0;
              return (
                <div key={lvl}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="ww-mono font-semibold text-[#211F1C]">{lvl}</span>
                    <span className="text-[#8B8680]">
                      {row.mastered}/{row.total} Mastered ({pct}%)
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#ECE4D3]">
                    <div
                      className="h-full rounded-full bg-[#3F8C5F]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ww-tag-card p-5">
          <h2 className="ww-display text-base font-semibold text-[#211F1C]">
            Κατανομή ανά κατηγορία
          </h2>
          <div className="mt-3 space-y-2">
            {SENTENCE_TYPES.map((t) => {
              const count = stats.byType[t];
              const metaT = SENTENCE_TYPE_LABELS[t];
              return (
                <div key={t} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-[#4A453D]">
                    <span className="h-2 w-2 rounded-full" style={{ background: metaT.color }} />
                    {metaT.de}
                  </span>
                  <span className="ww-mono font-semibold text-[#211F1C]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mastery Rules Reference */}
      <div className="ww-tag-card mt-4 p-4 text-xs leading-relaxed text-[#6B655D]">
        <div className="font-semibold text-[#211F1C]">Πώς κατακτάται μια πρόταση;</div>
        <ul className="mt-1.5 list-disc space-y-1 pl-4">
          <li>
            <strong>Consolidating:</strong> Τουλάχιστον 2 ακριβείς ενεργές επιτυχίες (Erinnern /
            Lückentext / Schreiben) σε 2 είδη ή 2 ημέρες.
          </li>
          <li>
            <strong>Mastered:</strong> Τουλάχιστον 3 ακριβείς ενεργές επιτυχίες, τουλάχιστον 1
            πλήρης γραφή (<em>Schreiben</em>), 2 ενεργά είδη και 2 καθυστερημένες επαναλήψεις σε
            διαφορετικές ημέρες (1–7 ημέρες &amp; 3–14 ημέρες) χωρίς μεταγενέστερο λάθος.
          </li>
          <li>
            <strong>Retained:</strong> Επιπλέον ακριβής ενεργή ανάκληση τουλάχιστον 14 ημέρες μετά
            το Mastered.
          </li>
        </ul>
      </div>
    </div>
  );
}
