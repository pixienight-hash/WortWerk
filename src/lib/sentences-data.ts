export type SentenceType =
  | "everyday_expression"
  | "polite_request"
  | "polite_question"
  | "idiom"
  | "fixed_expression"
  | "sentence"
  | "sentence_pattern"
  | "professional_expression";

export type SentenceCefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type SentenceMasteryStatus = "new" | "learning" | "consolidating" | "mastered" | "retained";

export type SentenceExerciseMode =
  "bedeutung" | "erinnern" | "lueckentext" | "situation" | "schreiben" | "flashcard";

export type SentenceAnswerVerdict = "exact" | "typo" | "wrong";

export interface SentenceExample {
  de: string;
  el?: string;
  en?: string;
}

export interface SentenceMeaning {
  el: string;
  en: string;
}

export interface SentenceEvidence {
  id: string;
  mode: SentenceExerciseMode;
  timestamp: number;
  correct: boolean;
  exact: boolean;
  verdict: SentenceAnswerVerdict;
  hintUsed: boolean;
  promptKey: string;
}

export interface SentenceLearning {
  status: SentenceMasteryStatus;
  timesSeen: number;
  timesCorrect: number;
  confidence: number;
  nextReview: number | null;
  lastReviewed?: number | null;
}

export interface SentenceEntry {
  id: string;
  sentence: string;
  type: SentenceType;
  cefr: SentenceCefr;
  meaning: SentenceMeaning;
  usage: string;
  context: string;
  grammar: string;
  structure: string;
  examples: SentenceExample[];
  alternatives: string[];
  synonyms: string[];
  memoryHook: string;
  tags: string[];
  learning: SentenceLearning;
  evidence: SentenceEvidence[];
  dateAdded: string;
}

export interface SentenceDailyLogEntry {
  attempts: number;
  correct: number;
  uniqueIds: string[];
}

export interface SentenceMeta {
  streak: number;
  lastDate: string;
  dailyLog: Record<string, SentenceDailyLogEntry>;
  deletedKeys: string[];
}

export interface SentenceImportReviewRow {
  entry: SentenceEntry;
  isDuplicate: boolean;
  duplicateSource: "existing" | "batch" | null;
  duplicateMatch: SentenceEntry | null;
  action: "add" | "skip" | "replace";
}

export interface SentenceDiffToken {
  expected: string;
  actual: string;
  status: "match" | "typo" | "wrong" | "missing" | "extra";
}

export interface SentenceEvalResult {
  verdict: SentenceAnswerVerdict;
  correct: boolean;
  exact: boolean;
  matchedAlternative: string | null;
  feedback: string;
  wordDiff: SentenceDiffToken[];
}

export interface SentenceMasteryReport {
  status: SentenceMasteryStatus;
  activeSuccesses: number;
  writtenRecalls: number;
  activeModesCount: number;
  activeDaysCount: number;
  delayedSteps: number;
  masteryTimestamp: number | null;
  hasRetentionProof: boolean;
  requirements: {
    activeSuccesses: boolean;
    writtenRecall: boolean;
    twoActiveModes: boolean;
    delayedChain: boolean;
    noRecentFailure: boolean;
    retainedCheck: boolean;
  };
}

export interface SentenceScheduleState {
  stage: "learning" | "delay_1" | "delay_2" | "retention" | "maintained";
  inWindow: boolean;
  daysUntilDue: number;
  daysLeftInWindow: number | null;
  targetDays: number;
}

export interface SentenceStatsSummary {
  total: number;
  byStatus: Record<SentenceMasteryStatus, number>;
  reviewedCount: number;
  dueCount: number;
  totalAttempts: number;
  totalCorrect: number;
  successRate: number | null;
  todayAttempts: number;
  todayCorrect: number;
  todayUnique: number;
  todayAccuracy: number | null;
  streak: number;
  byCefr: Record<SentenceCefr, { total: number; mastered: number }>;
  byType: Record<SentenceType, number>;
}

export interface SentenceQuestionOption {
  id: string;
  label: string;
  sublabel?: string;
  isCorrect: boolean;
}

export interface SentenceClozeBlank {
  index: number;
  answer: string;
  prefix: string;
  suffix: string;
}

export interface SentencePracticeQuestion {
  key: string;
  mode: Exclude<SentenceExerciseMode, "flashcard">;
  entry: SentenceEntry;
  promptLanguage?: "el" | "en";
  options?: SentenceQuestionOption[];
  clozeTokens?: Array<{ text: string; blankIndex: number | null }>;
  blanks?: SentenceClozeBlank[];
  situationPrompt?: {
    context: string;
    usage: string;
    meaningCue: string;
  };
}

export const SENTENCES_STORAGE_KEY = "wortwerk-sentences-list";
export const SENTENCES_META_KEY = "wortwerk-sentences-meta";
export const SENTENCE_DAY_MS = 24 * 60 * 60 * 1000;

export const SENTENCE_TYPES: readonly SentenceType[] = [
  "everyday_expression",
  "polite_request",
  "polite_question",
  "idiom",
  "fixed_expression",
  "sentence",
  "sentence_pattern",
  "professional_expression",
] as const;

export const SENTENCE_CEFR_LEVELS: readonly SentenceCefr[] = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
] as const;

export const SENTENCE_TYPE_LABELS: Record<
  SentenceType,
  { de: string; el: string; color: string; bg: string }
> = {
  everyday_expression: {
    de: "Alltagsausdruck",
    el: "Καθημερινή έκφραση",
    color: "#3F8C5F",
    bg: "rgba(63,140,95,0.13)",
  },
  polite_request: {
    de: "Höfliche Bitte",
    el: "Ευγενικό αίτημα",
    color: "#4FA091",
    bg: "rgba(79,160,145,0.14)",
  },
  polite_question: {
    de: "Höfliche Frage",
    el: "Ευγενική ερώτηση",
    color: "#3C7D9B",
    bg: "rgba(60,125,155,0.13)",
  },
  idiom: {
    de: "Redewendung",
    el: "Ιδιωματισμός",
    color: "#B5542E",
    bg: "rgba(181,84,46,0.13)",
  },
  fixed_expression: {
    de: "Feste Wendung",
    el: "Σταθερή έκφραση",
    color: "#CB9146",
    bg: "rgba(203,145,70,0.16)",
  },
  sentence: {
    de: "Satz",
    el: "Πρόταση",
    color: "#5E6B78",
    bg: "rgba(94,107,120,0.13)",
  },
  sentence_pattern: {
    de: "Satzmuster",
    el: "Μοτίβο πρότασης",
    color: "#8B7BC7",
    bg: "rgba(139,123,199,0.14)",
  },
  professional_expression: {
    de: "Beruf & Formell",
    el: "Επαγγελματική έκφραση",
    color: "#2D5A7B",
    bg: "rgba(45,90,123,0.13)",
  },
};

export const SENTENCE_STATUS_LABELS: Record<
  SentenceMasteryStatus,
  { label: string; de: string; color: string; bg: string }
> = {
  new: { label: "New", de: "Neu", color: "#8B8680", bg: "rgba(139,134,128,0.13)" },
  learning: { label: "Learning", de: "Lernend", color: "#CB9146", bg: "rgba(203,145,70,0.15)" },
  consolidating: {
    label: "Consolidating",
    de: "Festigend",
    color: "#4FA091",
    bg: "rgba(79,160,145,0.15)",
  },
  mastered: { label: "Mastered", de: "Beherrscht", color: "#3F8C5F", bg: "rgba(63,140,95,0.15)" },
  retained: { label: "Retained", de: "Verankert", color: "#8B7BC7", bg: "rgba(139,123,199,0.16)" },
};

export const DEFAULT_SENTENCE_META: SentenceMeta = {
  streak: 0,
  lastDate: "",
  dailyLog: {},
  deletedKeys: [],
};

const ACTIVE_SENTENCE_MODES = new Set<SentenceExerciseMode>([
  "erinnern",
  "lueckentext",
  "schreiben",
]);

const GERMAN_STOPWORDS = new Set([
  "ich",
  "du",
  "er",
  "sie",
  "es",
  "wir",
  "ihr",
  "man",
  "mir",
  "dir",
  "ihm",
  "uns",
  "euch",
  "ihnen",
  "mich",
  "dich",
  "sich",
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einen",
  "einem",
  "einer",
  "und",
  "oder",
  "aber",
  "denn",
  "doch",
  "auch",
  "noch",
  "mal",
  "bitte",
  "sehr",
  "in",
  "im",
  "an",
  "am",
  "auf",
  "aus",
  "bei",
  "mit",
  "nach",
  "von",
  "zu",
  "zum",
  "zur",
  "für",
  "ist",
  "sind",
  "bin",
  "war",
  "hat",
  "habe",
  "haben",
  "wird",
]);

export function sentenceDateStr(ts: number = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function calendarDayDiff(earlierTs: number, laterTs: number): number {
  const a = new Date(earlierTs);
  const b = new Date(laterTs);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / SENTENCE_DAY_MS);
}

/**
 * Canonical key for duplicate detection: case-insensitive, collapses spaces,
 * ignores leading/trailing punctuation.
 */
export function sentenceIdentityKey(text: string): string {
  return String(text || "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[.,!?;:„"“”«»'()\-–—\s]+|[.,!?;:„"“”«»'()\-–—\s]+$/g, "")
    .toLowerCase();
}

export function isValidSentenceType(value: unknown): value is SentenceType {
  return typeof value === "string" && (SENTENCE_TYPES as readonly string[]).includes(value);
}

export function isValidCefr(value: unknown): value is SentenceCefr {
  return (
    typeof value === "string" &&
    (SENTENCE_CEFR_LEVELS as readonly string[]).includes(value.toUpperCase())
  );
}

export function generateNextSentenceId(existing: readonly SentenceEntry[]): string {
  let maxNum = 0;
  for (const item of existing) {
    const match = /^S(\d+)$/i.exec(String(item.id || "").trim());
    if (match) {
      const n = Number.parseInt(match[1] ?? "0", 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  return `S${String(maxNum + 1).padStart(4, "0")}`;
}

function asStringList(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
}

function asExamples(val: unknown): SentenceExample[] {
  if (!Array.isArray(val)) return [];
  const out: SentenceExample[] = [];
  for (const item of val) {
    if (typeof item === "string" && item.trim()) {
      out.push({ de: item.trim() });
    } else if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const de = typeof rec["de"] === "string" ? rec["de"].trim() : "";
      if (!de) continue;
      const ex: SentenceExample = { de };
      if (typeof rec["el"] === "string" && rec["el"].trim()) ex.el = rec["el"].trim();
      if (typeof rec["en"] === "string" && rec["en"].trim()) ex.en = rec["en"].trim();
      out.push(ex);
    }
  }
  return out;
}

function normalizeEvidenceList(val: unknown): SentenceEvidence[] {
  if (!Array.isArray(val)) return [];
  const out: SentenceEvidence[] = [];
  for (const item of val) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const mode =
      typeof rec["mode"] === "string" ? (rec["mode"] as SentenceExerciseMode) : "schreiben";
    const rawTs = rec["timestamp"];
    const timestamp = typeof rawTs === "number" && Number.isFinite(rawTs) ? rawTs : Date.now();
    const correct = Boolean(rec["correct"]);
    const exact = Boolean(rec["exact"]);
    const rawVerdict = rec["verdict"];
    const verdict: SentenceAnswerVerdict =
      rawVerdict === "exact" || rawVerdict === "typo" || rawVerdict === "wrong"
        ? rawVerdict
        : exact
          ? "exact"
          : correct
            ? "typo"
            : "wrong";
    const rawId = rec["id"];
    const rawPromptKey = rec["promptKey"];
    out.push({
      id: typeof rawId === "string" && rawId ? rawId : `ev-${timestamp}-${out.length}`,
      mode,
      timestamp,
      correct,
      exact,
      verdict,
      hintUsed: Boolean(rec["hintUsed"]),
      promptKey: typeof rawPromptKey === "string" ? rawPromptKey : mode,
    });
  }
  return out;
}

export function normalizeSentenceEntry(
  raw: Record<string, unknown>,
  fallbackId = "S0001",
  nowTs: number = Date.now(),
): SentenceEntry {
  const rawSentence = raw["sentence"];
  const sentence = typeof rawSentence === "string" ? rawSentence.trim().replace(/\s+/g, " ") : "";
  const rawId = raw["id"];
  const id = typeof rawId === "string" && rawId.trim() ? rawId.trim() : fallbackId;
  const rawType = raw["type"];
  const type: SentenceType = isValidSentenceType(rawType) ? rawType : "everyday_expression";
  const rawCefr = raw["cefr"];
  const cefrRaw = typeof rawCefr === "string" ? rawCefr.trim().toUpperCase() : "B1";
  const cefr: SentenceCefr = isValidCefr(cefrRaw) ? (cefrRaw as SentenceCefr) : "B1";

  const rawMeaning = raw["meaning"];
  const meaningObj =
    rawMeaning && typeof rawMeaning === "object" ? (rawMeaning as Record<string, unknown>) : {};
  const mEl = meaningObj["el"];
  const mGreek = meaningObj["greek"];
  const meaningEl =
    typeof mEl === "string" ? mEl.trim() : typeof mGreek === "string" ? mGreek.trim() : "";
  const mEn = meaningObj["en"];
  const mEnglish = meaningObj["english"];
  const meaningEn =
    typeof mEn === "string" ? mEn.trim() : typeof mEnglish === "string" ? mEnglish.trim() : "";

  const rawLearningField = raw["learning"];
  const rawLearning =
    rawLearningField && typeof rawLearningField === "object"
      ? (rawLearningField as Record<string, unknown>)
      : {};
  const evidence = normalizeEvidenceList(raw["evidence"]);

  const rawNextReview = rawLearning["nextReview"];
  const nextReview =
    typeof rawNextReview === "number" && Number.isFinite(rawNextReview) && rawNextReview > 0
      ? rawNextReview
      : null;

  const rawUsage = raw["usage"];
  const rawContext = raw["context"];
  const rawGrammar = raw["grammar"];
  const rawStructure = raw["structure"];
  const rawMemoryHook = raw["memoryHook"];
  const rawDateAdded = raw["dateAdded"];
  const rawTimesSeen = rawLearning["timesSeen"];
  const rawTimesCorrect = rawLearning["timesCorrect"];
  const rawConfidence = rawLearning["confidence"];
  const rawLastReviewed = rawLearning["lastReviewed"];

  const entry: SentenceEntry = {
    id,
    sentence,
    type,
    cefr,
    meaning: { el: meaningEl, en: meaningEn },
    usage: typeof rawUsage === "string" ? rawUsage.trim() : "",
    context: typeof rawContext === "string" ? rawContext.trim() : "",
    grammar: typeof rawGrammar === "string" ? rawGrammar.trim() : "",
    structure: typeof rawStructure === "string" ? rawStructure.trim() : "",
    examples: asExamples(raw["examples"]),
    alternatives: asStringList(raw["alternatives"]),
    synonyms: asStringList(raw["synonyms"]),
    memoryHook: typeof rawMemoryHook === "string" ? rawMemoryHook.trim() : "",
    tags: asStringList(raw["tags"]),
    evidence,
    dateAdded:
      typeof rawDateAdded === "string" && rawDateAdded.trim()
        ? rawDateAdded.trim()
        : sentenceDateStr(nowTs),
    learning: {
      status: "new",
      timesSeen:
        typeof rawTimesSeen === "number" && Number.isFinite(rawTimesSeen) ? rawTimesSeen : 0,
      timesCorrect:
        typeof rawTimesCorrect === "number" && Number.isFinite(rawTimesCorrect)
          ? rawTimesCorrect
          : 0,
      confidence:
        typeof rawConfidence === "number" && Number.isFinite(rawConfidence)
          ? Math.max(0, Math.min(5, rawConfidence))
          : 0,
      nextReview,
      lastReviewed:
        typeof rawLastReviewed === "number" && Number.isFinite(rawLastReviewed)
          ? rawLastReviewed
          : null,
    },
  };

  // Always derive mastery status from evidence so status stays truthful and consistent.
  const report = computeSentenceMastery(entry);
  entry.learning.status = report.status;
  return entry;
}

/* ==================== INDEPENDENT MASTERY & SCHEDULING ==================== */

/**
 * Independent sentence mastery model derived strictly from recorded evidence.
 *
 * Rules:
 * - Passive exercises (flashcard, bedeutung, situation) never grant Consolidating, Mastered, or Retained.
 * - Active exercises: erinnern, lueckentext, schreiben.
 * - Only exact, unhinted active recalls advance mastery.
 * - Any active failure resets the active mastery chain (evidence before the failure no longer counts).
 * - Consolidating: >= 2 exact active successes across >= 2 active modes OR >= 2 calendar days.
 * - Mastered:
 *     1. >= 3 exact active successes after last active failure
 *     2. >= 1 exact full-sentence written recall (schreiben)
 *     3. >= 2 distinct active exercise modes
 *     4. Delayed retrieval chain across 3 calendar days:
 *        - initial active success (day 0)
 *        - 1st delayed active recall (1–7 calendar days after previous step)
 *        - 2nd delayed active recall (3–14 calendar days after step 1)
 *     5. No subsequent active failure
 * - Retained:
 *     - Already Mastered with no subsequent active failure
 *     - >= 1 additional exact active recall at least 14 calendar days after the mastery-completing success
 */
export function computeSentenceMastery(
  entry: Pick<SentenceEntry, "evidence" | "learning">,
): SentenceMasteryReport {
  const evidence = [...(entry.evidence || [])].sort((a, b) => a.timestamp - b.timestamp);
  const scoredAttempts = evidence.filter((e) => e.mode !== "flashcard");

  if (scoredAttempts.length === 0) {
    return {
      status: "new",
      activeSuccesses: 0,
      writtenRecalls: 0,
      activeModesCount: 0,
      activeDaysCount: 0,
      delayedSteps: 0,
      masteryTimestamp: null,
      hasRetentionProof: false,
      requirements: {
        activeSuccesses: false,
        writtenRecall: false,
        twoActiveModes: false,
        delayedChain: false,
        noRecentFailure: true,
        retainedCheck: false,
      },
    };
  }

  // Locate the last active failure; only active proofs strictly after it count toward mastery.
  let lastActiveFailureIdx = -1;
  for (let i = evidence.length - 1; i >= 0; i--) {
    const ev = evidence[i]!;
    if (ACTIVE_SENTENCE_MODES.has(ev.mode) && !ev.correct) {
      lastActiveFailureIdx = i;
      break;
    }
  }

  const postFailure =
    lastActiveFailureIdx >= 0 ? evidence.slice(lastActiveFailureIdx + 1) : evidence;
  const activeExact = postFailure.filter(
    (e) => ACTIVE_SENTENCE_MODES.has(e.mode) && e.correct && e.exact && !e.hintUsed,
  );

  // Deduplicate same-day same-mode proofs so repeating the identical exercise in one sitting doesn't inflate proofs.
  const uniqueProofs: SentenceEvidence[] = [];
  const seenKeys = new Set<string>();
  for (const ev of activeExact) {
    const key = `${sentenceDateStr(ev.timestamp)}::${ev.mode}::${ev.promptKey}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueProofs.push(ev);
    }
  }

  const activeSuccesses = uniqueProofs.length;
  const writtenRecalls = uniqueProofs.filter((e) => e.mode === "schreiben").length;
  const activeModesCount = new Set(uniqueProofs.map((e) => e.mode)).size;
  const activeDaysCount = new Set(uniqueProofs.map((e) => sentenceDateStr(e.timestamp))).size;

  // Evaluate delayed retrieval chain: step 0 (initial) -> step 1 (1–7d) -> step 2 (3–14d)
  let bestSteps = 0;
  let chainCompletedTs: number | null = null;

  for (let i = 0; i < uniqueProofs.length; i++) {
    const t0 = uniqueProofs[i]!.timestamp;
    let currentSteps = 0;
    let step1Ts: number | null = null;

    for (let j = i + 1; j < uniqueProofs.length; j++) {
      const tj = uniqueProofs[j]!.timestamp;
      if (step1Ts === null) {
        const diff1 = calendarDayDiff(t0, tj);
        if (diff1 >= 1 && diff1 <= 7) {
          step1Ts = tj;
          currentSteps = 1;
          if (currentSteps > bestSteps) bestSteps = currentSteps;
        }
      } else {
        const diff2 = calendarDayDiff(step1Ts, tj);
        if (diff2 >= 3 && diff2 <= 14) {
          currentSteps = 2;
          if (currentSteps > bestSteps) bestSteps = currentSteps;
          if (chainCompletedTs === null || tj < chainCompletedTs) {
            chainCompletedTs = tj;
          }
          break;
        }
      }
    }
  }

  const reqActiveSuccesses = activeSuccesses >= 3;
  const reqWrittenRecall = writtenRecalls >= 1;
  const reqTwoActiveModes = activeModesCount >= 2;
  const reqDelayedChain = bestSteps >= 2 && chainCompletedTs !== null;
  const noRecentFailure = true; // postFailure already slices after last active failure

  const isMastered =
    reqActiveSuccesses &&
    reqWrittenRecall &&
    reqTwoActiveModes &&
    reqDelayedChain &&
    noRecentFailure;

  // Determine the exact timestamp at which all mastery requirements first became satisfied.
  let masteryTimestamp: number | null = null;
  if (isMastered && chainCompletedTs !== null) {
    // Mastery is achieved once both the delayed chain and all other criteria are met.
    const thirdProofTs = uniqueProofs[2]?.timestamp ?? chainCompletedTs;
    const firstWrittenTs =
      uniqueProofs.find((e) => e.mode === "schreiben")?.timestamp ?? chainCompletedTs;
    masteryTimestamp = Math.max(chainCompletedTs, thirdProofTs, firstWrittenTs);
  }

  // Retention: at least 1 exact active recall >= 14 calendar days after masteryTimestamp
  const hasRetentionProof =
    isMastered &&
    masteryTimestamp !== null &&
    uniqueProofs.some((ev) => calendarDayDiff(masteryTimestamp!, ev.timestamp) >= 14);

  let status: SentenceMasteryStatus = "learning";
  if (hasRetentionProof) {
    status = "retained";
  } else if (isMastered) {
    status = "mastered";
  } else if (activeSuccesses >= 2 && (activeModesCount >= 2 || activeDaysCount >= 2)) {
    status = "consolidating";
  }

  return {
    status,
    activeSuccesses,
    writtenRecalls,
    activeModesCount,
    activeDaysCount,
    delayedSteps: bestSteps,
    masteryTimestamp,
    hasRetentionProof,
    requirements: {
      activeSuccesses: reqActiveSuccesses,
      writtenRecall: reqWrittenRecall,
      twoActiveModes: reqTwoActiveModes,
      delayedChain: reqDelayedChain,
      noRecentFailure,
      retainedCheck: hasRetentionProof,
    },
  };
}

export function computeSentenceScheduleState(
  entry: Pick<SentenceEntry, "evidence" | "learning">,
  nowTs: number = Date.now(),
): SentenceScheduleState {
  const report = computeSentenceMastery(entry);
  const evidence = [...(entry.evidence || [])].sort((a, b) => a.timestamp - b.timestamp);

  let lastFailIdx = -1;
  for (let i = evidence.length - 1; i >= 0; i--) {
    const ev = evidence[i]!;
    if (ACTIVE_SENTENCE_MODES.has(ev.mode) && !ev.correct) {
      lastFailIdx = i;
      break;
    }
  }
  const postFail = lastFailIdx >= 0 ? evidence.slice(lastFailIdx + 1) : evidence;
  const activeExact = postFail.filter(
    (e) => ACTIVE_SENTENCE_MODES.has(e.mode) && e.correct && e.exact && !e.hintUsed,
  );

  if (report.status === "retained") {
    const lastTs = activeExact[activeExact.length - 1]?.timestamp ?? nowTs;
    const elapsed = calendarDayDiff(lastTs, nowTs);
    return {
      stage: "maintained",
      inWindow: elapsed >= 30,
      daysUntilDue: Math.max(0, 30 - elapsed),
      daysLeftInWindow: null,
      targetDays: 30,
    };
  }

  if (report.status === "mastered" && report.masteryTimestamp !== null) {
    const elapsed = calendarDayDiff(report.masteryTimestamp, nowTs);
    return {
      stage: "retention",
      inWindow: elapsed >= 14,
      daysUntilDue: Math.max(0, 14 - elapsed),
      daysLeftInWindow: null,
      targetDays: 14,
    };
  }

  if (activeExact.length === 0) {
    return {
      stage: "learning",
      inWindow: false,
      daysUntilDue: 0,
      daysLeftInWindow: null,
      targetDays: 1,
    };
  }

  const lastActiveTs = activeExact[activeExact.length - 1]!.timestamp;
  const elapsed = calendarDayDiff(lastActiveTs, nowTs);

  if (report.delayedSteps === 0) {
    // Waiting for 1–7d delayed step 1
    return {
      stage: "delay_1",
      inWindow: elapsed >= 1 && elapsed <= 7,
      daysUntilDue: Math.max(0, 1 - elapsed),
      daysLeftInWindow: elapsed >= 1 && elapsed <= 7 ? 7 - elapsed : null,
      targetDays: 1,
    };
  }

  if (report.delayedSteps === 1) {
    // Waiting for 3–14d delayed step 2
    return {
      stage: "delay_2",
      inWindow: elapsed >= 3 && elapsed <= 14,
      daysUntilDue: Math.max(0, 3 - elapsed),
      daysLeftInWindow: elapsed >= 3 && elapsed <= 14 ? 14 - elapsed : null,
      targetDays: 3,
    };
  }

  // Delayed chain satisfied, still missing another criterion (e.g. schreiben)
  return {
    stage: "learning",
    inWindow: true,
    daysUntilDue: 0,
    daysLeftInWindow: 1,
    targetDays: 1,
  };
}

export function isSentenceDue(entry: SentenceEntry, nowTs: number = Date.now()): boolean {
  const nr = entry.learning.nextReview;
  if (nr === null || nr <= nowTs) return true;
  return computeSentenceScheduleState(entry, nowTs).inWindow;
}

export function applySentenceAnswer(
  entry: SentenceEntry,
  opts: {
    mode: SentenceExerciseMode;
    verdict: SentenceAnswerVerdict;
    hintUsed?: boolean;
    promptKey?: string;
    timestamp?: number;
  },
): SentenceEntry {
  const ts = opts.timestamp ?? Date.now();
  const hintUsed = Boolean(opts.hintUsed);
  const correct = opts.verdict !== "wrong";
  const exact = opts.verdict === "exact";

  const ev: SentenceEvidence = {
    id: `sev-${ts}-${entry.evidence.length}`,
    mode: opts.mode,
    timestamp: ts,
    correct,
    exact,
    verdict: opts.verdict,
    hintUsed,
    promptKey: opts.promptKey || opts.mode,
  };

  const nextEvidence = [...entry.evidence, ev];

  // Flashcards record light exposure without inflating scored accuracy or resetting mastery
  if (opts.mode === "flashcard") {
    const learning: SentenceLearning = {
      ...entry.learning,
      timesSeen: entry.learning.timesSeen + 1,
      lastReviewed: ts,
      nextReview: entry.learning.nextReview ?? ts + SENTENCE_DAY_MS,
    };
    const report = computeSentenceMastery({ evidence: nextEvidence, learning });
    learning.status = report.status;
    return { ...entry, evidence: nextEvidence, learning };
  }

  const prevLearning = entry.learning;
  const nextConfidence = correct
    ? Math.min(
        5,
        prevLearning.confidence +
          (ACTIVE_SENTENCE_MODES.has(opts.mode) && exact && !hintUsed ? 1 : 0.5),
      )
    : Math.max(0, prevLearning.confidence - 1);

  const draftLearning: SentenceLearning = {
    ...prevLearning,
    timesSeen: prevLearning.timesSeen + 1,
    timesCorrect: prevLearning.timesCorrect + (correct ? 1 : 0),
    confidence: Math.round(nextConfidence * 10) / 10,
    lastReviewed: ts,
    nextReview: prevLearning.nextReview,
  };

  const report = computeSentenceMastery({ evidence: nextEvidence, learning: draftLearning });
  draftLearning.status = report.status;

  // Compute independent nextReview aligned to the mastery progression
  if (!correct) {
    draftLearning.nextReview = ts + SENTENCE_DAY_MS;
  } else {
    const sched = computeSentenceScheduleState(
      { evidence: nextEvidence, learning: draftLearning },
      ts,
    );
    if (!ACTIVE_SENTENCE_MODES.has(opts.mode) && sched.inWindow) {
      // Passive success during an open active window keeps it due today for active recall
      draftLearning.nextReview = ts;
    } else if (report.status === "retained") {
      draftLearning.nextReview = ts + 30 * SENTENCE_DAY_MS;
    } else if (report.status === "mastered" && report.masteryTimestamp !== null) {
      const elapsed = calendarDayDiff(report.masteryTimestamp, ts);
      const remaining = Math.max(1, 14 - elapsed);
      draftLearning.nextReview = ts + remaining * SENTENCE_DAY_MS;
    } else if (sched.stage === "delay_2") {
      draftLearning.nextReview = ts + 3 * SENTENCE_DAY_MS;
    } else {
      draftLearning.nextReview = ts + SENTENCE_DAY_MS;
    }
  }

  return {
    ...entry,
    evidence: nextEvidence,
    learning: draftLearning,
  };
}

export function updateSentenceMetaOnAnswer(
  meta: SentenceMeta,
  entryId: string,
  correct: boolean,
  mode: SentenceExerciseMode,
  nowTs: number = Date.now(),
): SentenceMeta {
  if (mode === "flashcard") return meta;
  const today = sentenceDateStr(nowTs);
  const prevLog = meta.dailyLog[today] || { attempts: 0, correct: 0, uniqueIds: [] };
  const uniqueIds = prevLog.uniqueIds.includes(entryId)
    ? prevLog.uniqueIds
    : [...prevLog.uniqueIds, entryId];

  let streak = meta.streak || 0;
  if (meta.lastDate !== today) {
    const yesterday = sentenceDateStr(nowTs - SENTENCE_DAY_MS);
    streak = meta.lastDate === yesterday ? streak + 1 : 1;
  }

  return {
    ...meta,
    streak,
    lastDate: today,
    dailyLog: {
      ...meta.dailyLog,
      [today]: {
        attempts: prevLog.attempts + 1,
        correct: prevLog.correct + (correct ? 1 : 0),
        uniqueIds,
      },
    },
  };
}

export function sortSentencesByPriority(
  entries: readonly SentenceEntry[],
  nowTs: number = Date.now(),
): SentenceEntry[] {
  return [...entries].sort((a, b) => {
    const sa = computeSentenceScheduleState(a, nowTs);
    const sb = computeSentenceScheduleState(b, nowTs);

    const scoreA = sa.inWindow
      ? sa.daysLeftInWindow !== null
        ? 100 - sa.daysLeftInWindow
        : 60
      : isSentenceDue(a, nowTs)
        ? 30
        : 0;
    const scoreB = sb.inWindow
      ? sb.daysLeftInWindow !== null
        ? 100 - sb.daysLeftInWindow
        : 60
      : isSentenceDue(b, nowTs)
        ? 30
        : 0;

    if (scoreA !== scoreB) return scoreB - scoreA;
    const nrA = a.learning.nextReview ?? 0;
    const nrB = b.learning.nextReview ?? 0;
    return nrA - nrB;
  });
}

export function preferredExerciseModeForSentence(
  entry: SentenceEntry,
): Exclude<SentenceExerciseMode, "flashcard"> {
  const report = computeSentenceMastery(entry);
  if (report.status === "new") return "bedeutung";
  if (!report.requirements.writtenRecall && report.activeSuccesses >= 1) return "schreiben";
  if (report.activeSuccesses === 0) return "lueckentext";
  if (!report.requirements.twoActiveModes) {
    const usedModes = new Set(
      entry.evidence
        .filter((e) => ACTIVE_SENTENCE_MODES.has(e.mode) && e.correct && e.exact && !e.hintUsed)
        .map((e) => e.mode),
    );
    if (!usedModes.has("lueckentext")) return "lueckentext";
    if (!usedModes.has("erinnern")) return "erinnern";
    return "schreiben";
  }
  return report.status === "mastered" || report.status === "retained" ? "schreiben" : "erinnern";
}

/* ==================== WRITTEN ANSWER EVALUATION ==================== */

function stripOuterPunct(token: string): string {
  return token.replace(/^[.,!?;:„"“”«»'()\-–—]+|[.,!?;:„"“”«»'()\-–—]+$/g, "");
}

function tokenizeSentence(text: string): string[] {
  return String(text || "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(stripOuterPunct)
    .filter(Boolean);
}

function foldGermanDiacritics(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function stripUmlautsSimple(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[b.length]!;
}

function evaluateAgainstTarget(userRaw: string, targetRaw: string): SentenceEvalResult {
  const userTokens = tokenizeSentence(userRaw);
  const targetTokens = tokenizeSentence(targetRaw);

  if (userTokens.length === 0) {
    return {
      verdict: "wrong",
      correct: false,
      exact: false,
      matchedAlternative: null,
      feedback: "Δεν πληκτρολογήθηκε απάντηση.",
      wordDiff: targetTokens.map((t) => ({ expected: t, actual: "", status: "missing" })),
    };
  }

  // Exact match: identical tokens in exact order & casing (ignoring trailing punctuation & extra spaces)
  const isExactTokens =
    userTokens.length === targetTokens.length && targetTokens.every((t, i) => t === userTokens[i]);

  if (isExactTokens) {
    return {
      verdict: "exact",
      correct: true,
      exact: true,
      matchedAlternative: null,
      feedback: "Ακριβώς σωστό!",
      wordDiff: targetTokens.map((t, i) => ({
        expected: t,
        actual: userTokens[i]!,
        status: "match",
      })),
    };
  }

  // Structural check: missing or extra words mean the sentence structure is wrong — never accept keyword overlap!
  if (userTokens.length !== targetTokens.length) {
    const maxLen = Math.max(userTokens.length, targetTokens.length);
    const diff: SentenceDiffToken[] = [];
    for (let i = 0; i < maxLen; i++) {
      const exp = targetTokens[i] ?? "";
      const act = userTokens[i] ?? "";
      if (!exp) diff.push({ expected: "", actual: act, status: "extra" });
      else if (!act) diff.push({ expected: exp, actual: "", status: "missing" });
      else if (exp === act) diff.push({ expected: exp, actual: act, status: "match" });
      else diff.push({ expected: exp, actual: act, status: "wrong" });
    }
    return {
      verdict: "wrong",
      correct: false,
      exact: false,
      matchedAlternative: null,
      feedback:
        userTokens.length < targetTokens.length
          ? "Λείπουν λέξεις από την πρόταση — έλεγξε ολόκληρη τη δομή."
          : "Υπάρχουν επιπλέον ή διαφορετικές λέξεις στη δομή της πρότασης.",
      wordDiff: diff,
    };
  }

  // Same word count: inspect word-by-word in strict order
  let totalCharEdits = 0;
  let typoWords = 0;
  let hardWrongWords = 0;
  let onlyCaseOrUmlaut = true;
  const wordDiff: SentenceDiffToken[] = [];

  for (let i = 0; i < targetTokens.length; i++) {
    const exp = targetTokens[i]!;
    const act = userTokens[i]!;
    if (exp === act) {
      wordDiff.push({ expected: exp, actual: act, status: "match" });
      continue;
    }

    const lowerExp = exp.toLowerCase();
    const lowerAct = act.toLowerCase();

    // Pure capitalization or German umlaut/ß variation
    if (
      lowerExp === lowerAct ||
      foldGermanDiacritics(exp) === foldGermanDiacritics(act) ||
      stripUmlautsSimple(exp) === stripUmlautsSimple(act)
    ) {
      typoWords++;
      totalCharEdits += 1;
      wordDiff.push({ expected: exp, actual: act, status: "typo" });
      continue;
    }

    onlyCaseOrUmlaut = false;
    const dist = levenshtein(lowerExp, lowerAct);
    const maxAllowedForWord = exp.length <= 3 ? 0 : exp.length <= 6 ? 1 : 2;

    if (dist <= maxAllowedForWord) {
      typoWords++;
      totalCharEdits += dist;
      wordDiff.push({ expected: exp, actual: act, status: "typo" });
    } else {
      hardWrongWords++;
      totalCharEdits += dist;
      wordDiff.push({ expected: exp, actual: act, status: "wrong" });
    }
  }

  const totalChars = targetTokens.join("").length;
  const maxTotalEdits = Math.max(2, Math.min(4, Math.ceil(totalChars * 0.1)));
  const maxTypoWords = targetTokens.length <= 2 ? 1 : 2;

  if (
    hardWrongWords === 0 &&
    typoWords > 0 &&
    typoWords <= maxTypoWords &&
    totalCharEdits <= maxTotalEdits
  ) {
    return {
      verdict: "typo",
      correct: true,
      exact: false,
      matchedAlternative: null,
      feedback: onlyCaseOrUmlaut
        ? "Σχεδόν σωστό — μικρή διαφορά σε κεφαλαία ή διαλυτικά (ä/ö/ü/ß)."
        : "Σχεδόν σωστό — μικρό ορθογραφικό λάθος. Δες τη σωστή γραφή παρακάτω.",
      wordDiff,
    };
  }

  return {
    verdict: "wrong",
    correct: false,
    exact: false,
    matchedAlternative: null,
    feedback: "Λανθασμένη απάντηση — έλεγξε τις λέξεις και τη σειρά τους.",
    wordDiff,
  };
}

export function evaluateSentenceAnswer(
  userInput: string,
  expectedSentence: string,
  alternatives: readonly string[] = [],
): SentenceEvalResult {
  const primary = evaluateAgainstTarget(userInput, expectedSentence);
  if (primary.verdict === "exact") return primary;

  let best = primary;
  for (const alt of alternatives) {
    if (!alt.trim()) continue;
    const res = evaluateAgainstTarget(userInput, alt);
    if (res.verdict === "exact") {
      return {
        ...res,
        matchedAlternative: alt,
        feedback: "Ακριβώς σωστό (εναλλακτική διατύπωση)!",
      };
    }
    if (res.verdict === "typo" && best.verdict === "wrong") {
      best = { ...res, matchedAlternative: alt };
    }
  }

  return best;
}

/* ==================== JSON IMPORT & DUPLICATE CHECK ==================== */

export function parseSentenceJsonInput(
  rawJson: string,
): { ok: true; items: Record<string, unknown>[] } | { ok: false; error: string } {
  const cleaned = String(rawJson || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!cleaned) {
    return { ok: false, error: "Επικόλλησε ένα έγκυρο JSON αντικείμενο ή JSON array προτάσεων." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Μη έγκυρη σύνταξη JSON";
    return { ok: false, error: `Σφάλμα σύνταξης JSON: ${detail}` };
  }

  let list: unknown[];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === "object") {
    const rec = parsed as Record<string, unknown>;
    const wrapped = rec["sentences"];
    if (Array.isArray(wrapped)) {
      list = wrapped;
    } else {
      list = [rec];
    }
  } else {
    return {
      ok: false,
      error: "Το JSON πρέπει να είναι αντικείμενο πρότασης ή πίνακας (array) προτάσεων.",
    };
  }

  if (list.length === 0) {
    return { ok: false, error: "Ο πίνακας JSON είναι κενός." };
  }

  const validItems: Record<string, unknown>[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: `Η καταχώριση #${i + 1} δεν είναι έγκυρο αντικείμενο JSON.` };
    }
    const rec = item as Record<string, unknown>;
    const rawSentence = rec["sentence"];
    const sentence = typeof rawSentence === "string" ? rawSentence.trim() : "";
    if (!sentence) {
      return { ok: false, error: `Η καταχώριση #${i + 1} δεν έχει πεδίο "sentence".` };
    }
    const rawMeaning = rec["meaning"];
    const meaning =
      rawMeaning && typeof rawMeaning === "object" ? (rawMeaning as Record<string, unknown>) : {};
    const mEl = meaning["el"];
    const mEn = meaning["en"];
    const hasMeaning =
      (typeof mEl === "string" && mEl.trim().length > 0) ||
      (typeof mEn === "string" && mEn.trim().length > 0);
    if (!hasMeaning) {
      return {
        ok: false,
        error: `Η καταχώριση #${i + 1} («${sentence}») χρειάζεται τουλάχιστον ελληνική ή αγγλική σημασία στο πεδίο "meaning".`,
      };
    }
    validItems.push(rec);
  }

  return { ok: true, items: validItems };
}

export function reviewSentenceImport(
  existing: readonly SentenceEntry[],
  incomingRaw: readonly Record<string, unknown>[],
  nowTs: number = Date.now(),
): SentenceImportReviewRow[] {
  const existingByKey = new Map<string, SentenceEntry>();
  const usedIds = new Set<string>(existing.map((e) => e.id));
  for (const e of existing) {
    const k = sentenceIdentityKey(e.sentence);
    if (k && !existingByKey.has(k)) existingByKey.set(k, e);
  }

  const batchByKey = new Map<string, SentenceEntry>();
  const draftPool: SentenceEntry[] = [...existing];
  const rows: SentenceImportReviewRow[] = [];

  for (const raw of incomingRaw) {
    const rawId = raw["id"];
    let candidateId = typeof rawId === "string" && rawId.trim() ? rawId.trim() : "";
    if (!candidateId || usedIds.has(candidateId)) {
      candidateId = generateNextSentenceId(draftPool);
    }
    usedIds.add(candidateId);

    const normalized = normalizeSentenceEntry({ ...raw, id: candidateId }, candidateId, nowTs);
    const key = sentenceIdentityKey(normalized.sentence);
    const existingMatch = existingByKey.get(key) ?? null;
    const batchMatch = !existingMatch ? (batchByKey.get(key) ?? null) : null;

    if (existingMatch) {
      rows.push({
        entry: normalized,
        isDuplicate: true,
        duplicateSource: "existing",
        duplicateMatch: existingMatch,
        action: "skip",
      });
    } else if (batchMatch) {
      rows.push({
        entry: normalized,
        isDuplicate: true,
        duplicateSource: "batch",
        duplicateMatch: batchMatch,
        action: "skip",
      });
    } else {
      batchByKey.set(key, normalized);
      draftPool.push(normalized);
      rows.push({
        entry: normalized,
        isDuplicate: false,
        duplicateSource: null,
        duplicateMatch: null,
        action: "add",
      });
    }
  }

  return rows;
}

export function applySentenceImport(
  existing: readonly SentenceEntry[],
  rows: readonly SentenceImportReviewRow[],
): { next: SentenceEntry[]; added: number; replaced: number; skipped: number } {
  let next = [...existing];
  let added = 0;
  let replaced = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.action === "skip") {
      skipped++;
      continue;
    }

    if (row.action === "replace" && row.duplicateMatch) {
      const targetId = row.duplicateMatch.id;
      next = next.map((item) =>
        item.id === targetId
          ? {
              ...row.entry,
              id: targetId,
              // Preserve existing learning progress & evidence on replacement
              learning: item.learning,
              evidence: item.evidence,
            }
          : item,
      );
      replaced++;
      continue;
    }

    // Add as new entry with guaranteed unique ID
    const idExists = next.some((e) => e.id === row.entry.id);
    const id = idExists ? generateNextSentenceId(next) : row.entry.id;
    next.push({ ...row.entry, id });
    added++;
  }

  return { next, added, replaced, skipped };
}

/* ==================== EXERCISE GENERATORS ==================== */

function shuffleArray<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export function buildSentenceCloze(sentence: string): {
  tokens: Array<{ text: string; blankIndex: number | null }>;
  blanks: SentenceClozeBlank[];
} {
  const rawTokens = sentence.trim().replace(/\s+/g, " ").split(" ");
  const parsed = rawTokens.map((raw, idx) => {
    const leadMatch = /^([.,!?;:„"“”«»'()\-–—]*)/.exec(raw);
    const trailMatch = /([.,!?;:„"“”«»'()\-–—]*)$/.exec(raw);
    const prefix = leadMatch?.[1] ?? "";
    const suffix = trailMatch?.[1] ?? "";
    const core = raw.slice(prefix.length, raw.length - suffix.length);
    return { raw, idx, prefix, core, suffix };
  });

  // Score candidate words to blank: prefer meaningful German content words (length >= 4, not pure stopword)
  const candidates = parsed
    .filter((t) => t.core.length >= 2 && /[A-Za-zÄÖÜäöüß]/.test(t.core))
    .map((t) => {
      const lower = t.core.toLowerCase();
      const isStop = GERMAN_STOPWORDS.has(lower);
      const score = (isStop ? 0 : 10) + Math.min(8, t.core.length) + (t.idx > 0 ? 2 : 0);
      return { ...t, score };
    })
    .sort((a, b) => b.score - a.score || b.idx - a.idx);

  const desiredBlanks = parsed.length >= 6 ? 2 : 1;
  const chosenIndices = new Set<number>();
  for (const c of candidates) {
    if (chosenIndices.size >= desiredBlanks) break;
    // Avoid adjacent blanks when picking 2 blanks so context stays readable
    if (desiredBlanks > 1 && chosenIndices.size === 1) {
      const first = Array.from(chosenIndices)[0]!;
      if (
        Math.abs(first - c.idx) <= 1 &&
        candidates.some((other) => Math.abs(first - other.idx) > 1)
      ) {
        continue;
      }
    }
    chosenIndices.add(c.idx);
  }
  if (chosenIndices.size === 0 && parsed.length > 0) {
    chosenIndices.add(parsed.length - 1);
  }

  const sortedBlankIdx = Array.from(chosenIndices).sort((a, b) => a - b);
  const blanks: SentenceClozeBlank[] = sortedBlankIdx.map((tokenIdx, blankPos) => {
    const p = parsed[tokenIdx]!;
    return {
      index: blankPos,
      answer: p.core,
      prefix: p.prefix,
      suffix: p.suffix,
    };
  });

  const indexMap = new Map<number, number>();
  sortedBlankIdx.forEach((tokenIdx, blankPos) => indexMap.set(tokenIdx, blankPos));

  const tokens = parsed.map((p) => ({
    text: p.raw,
    blankIndex: indexMap.has(p.idx) ? indexMap.get(p.idx)! : null,
  }));

  return { tokens, blanks };
}

export function buildSentenceQuestion(
  entry: SentenceEntry,
  mode: Exclude<SentenceExerciseMode, "flashcard">,
  pool: readonly SentenceEntry[],
  opts: { promptLanguage?: "el" | "en"; rng?: () => number } = {},
): SentencePracticeQuestion {
  const rng = opts.rng ?? Math.random;
  const lang = opts.promptLanguage ?? (entry.meaning.el ? "el" : "en");
  const others = shuffleArray(
    pool.filter(
      (other) =>
        other.id !== entry.id &&
        sentenceIdentityKey(other.sentence) !== sentenceIdentityKey(entry.sentence),
    ),
    rng,
  );

  if (mode === "bedeutung") {
    const getLabel = (e: SentenceEntry) =>
      lang === "en" ? e.meaning.en || e.meaning.el : e.meaning.el || e.meaning.en;
    const getSub = (e: SentenceEntry) =>
      lang === "en"
        ? e.meaning.el && e.meaning.en
          ? e.meaning.el
          : undefined
        : e.meaning.en && e.meaning.el
          ? e.meaning.en
          : undefined;

    const distractors = others
      .filter((o) => getLabel(o) && getLabel(o) !== getLabel(entry))
      .slice(0, 3);

    const makeOption = (item: SentenceEntry, isCorrect: boolean): SentenceQuestionOption => {
      const sub = getSub(item);
      const opt: SentenceQuestionOption = { id: item.id, label: getLabel(item), isCorrect };
      if (sub) opt.sublabel = sub;
      return opt;
    };

    const options: SentenceQuestionOption[] = shuffleArray(
      [makeOption(entry, true), ...distractors.map((d) => makeOption(d, false))],
      rng,
    );

    return {
      key: `${entry.id}::bedeutung::${lang}`,
      mode: "bedeutung",
      entry,
      promptLanguage: lang,
      options,
    };
  }

  if (mode === "situation") {
    // Prefer distractors from different meanings/contexts so only 1 expression fits the situation cleanly
    const sameTypeFirst = [
      ...others.filter((o) => o.type === entry.type),
      ...others.filter((o) => o.type !== entry.type),
    ];
    const distractors = sameTypeFirst.slice(0, 3);
    const options: SentenceQuestionOption[] = shuffleArray(
      [
        { id: entry.id, label: entry.sentence, isCorrect: true },
        ...distractors.map((d) => ({ id: d.id, label: d.sentence, isCorrect: false })),
      ],
      rng,
    );

    return {
      key: `${entry.id}::situation`,
      mode: "situation",
      entry,
      options,
      situationPrompt: {
        context: entry.context || SENTENCE_TYPE_LABELS[entry.type].de,
        usage:
          entry.usage ||
          `Επίλεξε την κατάλληλη γερμανική έκφραση για: «${entry.meaning.el || entry.meaning.en}».`,
        meaningCue: entry.meaning.el || entry.meaning.en,
      },
    };
  }

  if (mode === "lueckentext") {
    const cloze = buildSentenceCloze(entry.sentence);
    return {
      key: `${entry.id}::lueckentext::${cloze.blanks.map((b) => b.answer).join("_")}`,
      mode: "lueckentext",
      entry,
      clozeTokens: cloze.tokens,
      blanks: cloze.blanks,
    };
  }

  if (mode === "erinnern") {
    return {
      key: `${entry.id}::erinnern`,
      mode: "erinnern",
      entry,
      promptLanguage: lang,
    };
  }

  return {
    key: `${entry.id}::schreiben`,
    mode: "schreiben",
    entry,
    promptLanguage: lang,
  };
}

export function buildSentenceSession(
  entries: readonly SentenceEntry[],
  mode: Exclude<SentenceExerciseMode, "flashcard"> | "mix" | "guided",
  pool: readonly SentenceEntry[],
  opts: { limit?: number; promptLanguage?: "el" | "en"; rng?: () => number; nowTs?: number } = {},
): SentencePracticeQuestion[] {
  const rng = opts.rng ?? Math.random;
  const limit = opts.limit ?? 10;
  const nowTs = opts.nowTs ?? Date.now();

  const ordered =
    mode === "guided"
      ? sortSentencesByPriority(entries, nowTs).slice(0, limit)
      : shuffleArray(entries, rng).slice(0, limit);

  const mixModes: Array<Exclude<SentenceExerciseMode, "flashcard">> = [
    "bedeutung",
    "erinnern",
    "lueckentext",
    "situation",
    "schreiben",
  ];

  return ordered.map((entry, idx) => {
    const chosenMode: Exclude<SentenceExerciseMode, "flashcard"> =
      mode === "guided"
        ? preferredExerciseModeForSentence(entry)
        : mode === "mix"
          ? mixModes[idx % mixModes.length]!
          : mode;
    const qOpts: { promptLanguage?: "el" | "en"; rng?: () => number } = { rng };
    if (opts.promptLanguage) qOpts.promptLanguage = opts.promptLanguage;
    return buildSentenceQuestion(entry, chosenMode, pool.length >= 4 ? pool : entries, qOpts);
  });
}

/* ==================== INDEPENDENT STATISTICS ==================== */

export function computeSentenceStats(
  entries: readonly SentenceEntry[],
  meta: SentenceMeta,
  nowTs: number = Date.now(),
): SentenceStatsSummary {
  const byStatus: Record<SentenceMasteryStatus, number> = {
    new: 0,
    learning: 0,
    consolidating: 0,
    mastered: 0,
    retained: 0,
  };

  const byCefr: Record<SentenceCefr, { total: number; mastered: number }> = {
    A1: { total: 0, mastered: 0 },
    A2: { total: 0, mastered: 0 },
    B1: { total: 0, mastered: 0 },
    B2: { total: 0, mastered: 0 },
    C1: { total: 0, mastered: 0 },
    C2: { total: 0, mastered: 0 },
  };

  const byType: Record<SentenceType, number> = {
    everyday_expression: 0,
    polite_request: 0,
    polite_question: 0,
    idiom: 0,
    fixed_expression: 0,
    sentence: 0,
    sentence_pattern: 0,
    professional_expression: 0,
  };

  let reviewedCount = 0;
  let dueCount = 0;
  let totalAttempts = 0;
  let totalCorrect = 0;

  for (const entry of entries) {
    const report = computeSentenceMastery(entry);
    byStatus[report.status]++;
    byCefr[entry.cefr].total++;
    if (report.status === "mastered" || report.status === "retained") {
      byCefr[entry.cefr].mastered++;
    }
    byType[entry.type]++;

    const scored = entry.evidence.filter((e) => e.mode !== "flashcard");
    if (scored.length > 0 || entry.learning.timesSeen > 0) reviewedCount++;
    if (isSentenceDue(entry, nowTs)) dueCount++;

    totalAttempts += scored.length;
    totalCorrect += scored.filter((e) => e.correct).length;
  }

  const today = sentenceDateStr(nowTs);
  const todayEntry = meta.dailyLog[today] || { attempts: 0, correct: 0, uniqueIds: [] };

  return {
    total: entries.length,
    byStatus,
    reviewedCount,
    dueCount,
    totalAttempts,
    totalCorrect,
    successRate: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null,
    todayAttempts: todayEntry.attempts,
    todayCorrect: todayEntry.correct,
    todayUnique: todayEntry.uniqueIds.length,
    todayAccuracy:
      todayEntry.attempts > 0 ? Math.round((todayEntry.correct / todayEntry.attempts) * 100) : null,
    streak: meta.streak || 0,
    byCefr,
    byType,
  };
}

export function sentenceWeeklyTimeline(
  meta: SentenceMeta,
  days = 7,
  nowTs: number = Date.now(),
): Array<{ date: string; label: string; attempts: number; correct: number; unique: number }> {
  const out: Array<{
    date: string;
    label: string;
    attempts: number;
    correct: number;
    unique: number;
  }> = [];
  const weekdayNames = ["Κυρ", "Δευ", "Τρί", "Τετ", "Πέμ", "Παρ", "Σάβ"];
  for (let i = days - 1; i >= 0; i--) {
    const ts = nowTs - i * SENTENCE_DAY_MS;
    const date = sentenceDateStr(ts);
    const d = new Date(ts);
    const log = meta.dailyLog[date];
    out.push({
      date,
      label: weekdayNames[d.getDay()] ?? date.slice(5),
      attempts: log?.attempts ?? 0,
      correct: log?.correct ?? 0,
      unique: log?.uniqueIds.length ?? 0,
    });
  }
  return out;
}

/* ==================== SEED & STORAGE HELPERS ==================== */

export function mergeSentenceSeed(
  stored: readonly SentenceEntry[],
  seedRaw: readonly Record<string, unknown>[],
  deletedKeys: readonly string[] = [],
): SentenceEntry[] {
  const deletedSet = new Set(deletedKeys.map((k) => sentenceIdentityKey(k)));
  const existingKeys = new Set(stored.map((s) => sentenceIdentityKey(s.sentence)));
  const next = stored.map((s) =>
    normalizeSentenceEntry(s as unknown as Record<string, unknown>, s.id),
  );

  for (const raw of seedRaw) {
    const rawId = raw["id"];
    const norm = normalizeSentenceEntry(
      raw,
      typeof rawId === "string" ? rawId : generateNextSentenceId(next),
    );
    const key = sentenceIdentityKey(norm.sentence);
    if (!key || existingKeys.has(key) || deletedSet.has(key)) continue;
    const id = next.some((e) => e.id === norm.id) ? generateNextSentenceId(next) : norm.id;
    next.push({ ...norm, id });
    existingKeys.add(key);
  }

  return next;
}
