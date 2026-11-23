import { describe, it, expect } from "vitest";
import {
  buildAllGamesQuestions,
  calendarDayDiff,
  computeAlignedNextReview,
  findAllContextExamples,
  hasFillExercise,
  isB2Word,
  isMasteredThroughWortwerk,
  makeEvidence,
  mastery,
  masteryScheduleState,
  mergeSeedEnrichments,
  normalizeEntry,
  preferredActiveGameForWord,
  PREVIOUSLY_KNOWN_STATUS,
  sortWordsByReviewPriority,
  vocabProgressStats,
  wordAssimilationTimestamp,
} from "@/lib/wortwerk-data";
import VOCAB_SEED from "@/data/vocab-seed.json";

const DAY = 86_400_000;
const BASE_TS = new Date(2026, 0, 1, 12, 0, 0).getTime();

type Mode = "flashcard" | "mc" | "recall" | "fill" | "context" | "production";

interface EvidenceOverrides {
  mode?: Mode;
  context?: string;
  contextId?: string;
  prompt?: string;
  answer?: string;
  day?: number;
  timestamp?: number;
  correct?: boolean;
  exact?: boolean;
  hintUsed?: boolean;
  articleCorrect?: boolean;
  newContext?: boolean;
  neutral?: boolean;
  status?: string;
  selfRating?: string;
  sessionId?: string;
  verified?: boolean;
}

function createNoun(overrides: Record<string, unknown> = {}) {
  const entry = normalizeEntry({
    word: "der Tisch",
    type: "Nomen",
    meaning: { greek: ["τραπέζι"] },
    exercise: { sentence: "Der ______ steht im Zimmer.", answer: "Tisch" },
    learning: { timesSeen: 0, timesCorrect: 0, confidence: 0, nextReview: 0 },
    ...overrides,
  });
  entry.evidence = Array.isArray(entry.evidence) ? entry.evidence : [];
  return entry;
}

function createVerb(overrides: Record<string, unknown> = {}) {
  const entry = normalizeEntry({
    word: "vermeiden",
    type: "Verb",
    meaning: { greek: ["αποφεύγω"] },
    exercise: { sentence: "Wir wollen Fehler ______.", answer: "vermeiden" },
    learning: { timesSeen: 0, timesCorrect: 0, confidence: 0, nextReview: 0 },
    ...overrides,
  });
  entry.evidence = Array.isArray(entry.evidence) ? entry.evidence : [];
  return entry;
}

function addEvidence(word: ReturnType<typeof normalizeEntry>, overrides: EvidenceOverrides = {}) {
  const mode = overrides.mode ?? "recall";
  const day = overrides.day ?? 0;
  const context = overrides.context ?? `ctx-${day}-${mode}`;
  const timestamp = overrides.timestamp ?? BASE_TS + day * DAY;
  const correct = overrides.correct ?? true;
  return makeEvidence(word, correct, {
    timestamp,
    mode,
    contextId: overrides.contextId ?? `${mode}:${context}`,
    context,
    prompt: overrides.prompt ?? `prompt:${context}`,
    answer: overrides.answer ?? word.word,
    exact: overrides.exact ?? correct,
    hintUsed: overrides.hintUsed ?? false,
    articleCorrect: overrides.articleCorrect ?? true,
    newContext: overrides.newContext ?? mode === "context",
    neutral: overrides.neutral ?? false,
    status: overrides.status ?? "",
    selfRating: overrides.selfRating,
    sessionId: overrides.sessionId ?? `session-d${day}`,
    verified: overrides.verified,
  });
}

function createMasteredWord() {
  const w = createNoun();
  w.evidence = [
    addEvidence(w, {
      mode: "recall",
      context: "τραπέζι",
      day: 0,
      newContext: false,
    }),
    addEvidence(w, {
      mode: "fill",
      context: "Der ______ steht im Zimmer.",
      day: 1,
      newContext: false,
    }),
    addEvidence(w, {
      mode: "context",
      context: "Auf dem Tisch liegen zwei Bücher.",
      day: 4,
      newContext: true,
    }),
    addEvidence(w, {
      mode: "context",
      context: "Wir decken den Tisch für das Abendessen.",
      day: 11,
      newContext: true,
    }),
  ];
  return w;
}

describe("Evidence Ledger state transitions (New -> Learning -> Consolidating -> Mastered -> Retained)", () => {
  it("progresses sequentially through every state and aligns timestamps and progress stats", () => {
    const w = createNoun();

    // 0. New
    expect(mastery(w).level).toBe("New");
    expect(mastery(w).mastered).toBe(false);
    expect(wordAssimilationTimestamp(w, "started")).toBeNull();
    expect(vocabProgressStats([w], BASE_TS).newCount).toBe(1);

    // 1. New -> Learning (1 active success)
    w.evidence.push(
      addEvidence(w, {
        mode: "recall",
        context: "τραπέζι",
        day: 0,
        newContext: false,
      }),
    );
    expect(mastery(w).level).toBe("Learning");
    expect(mastery(w).mastered).toBe(false);
    expect(wordAssimilationTimestamp(w, "started")).toBe(BASE_TS);
    expect(wordAssimilationTimestamp(w, "assimilated")).toBeNull();
    expect(vocabProgressStats([w], BASE_TS).learning).toBe(1);

    // Still Learning after 2 unique active successes
    w.evidence.push(
      addEvidence(w, {
        mode: "fill",
        context: "Der ______ steht im Zimmer.",
        day: 1,
        newContext: false,
      }),
    );
    expect(mastery(w).level).toBe("Learning");
    expect(mastery(w).successes).toBe(2);
    expect(mastery(w).activeContexts).toBe(2);

    // 2. Learning -> Consolidating (3rd unique active success in a 3rd distinct context)
    w.evidence.push(
      addEvidence(w, {
        mode: "context",
        context: "Auf dem Tisch liegen zwei Bücher.",
        day: 4,
        newContext: true,
      }),
    );
    const consolidating = mastery(w);
    expect(consolidating.level).toBe("Consolidating");
    expect(consolidating.mastered).toBe(false);
    expect(consolidating.successes).toBe(3);
    expect(consolidating.activeContexts).toBe(3);
    expect(consolidating.requirements.successes).toBe(false);
    expect(consolidating.requirements.contexts).toBe(false);
    expect(consolidating.requirements.delayed).toBe(false);
    expect(wordAssimilationTimestamp(w, "assimilated")).toBe(BASE_TS + 4 * DAY);
    expect(wordAssimilationTimestamp(w, "mastered")).toBeNull();
    expect(vocabProgressStats([w], BASE_TS + 4 * DAY).consolidating).toBe(1);

    // 3. Consolidating -> Mastered (4th unique active success completing 7-14d window)
    w.evidence.push(
      addEvidence(w, {
        mode: "context",
        context: "Wir decken den Tisch für das Abendessen.",
        day: 11,
        newContext: true,
      }),
    );
    const mastered = mastery(w);
    expect(mastered.level).toBe("Provisionally mastered");
    expect(mastered.mastered).toBe(true);
    expect(Object.values(mastered.requirements).every(Boolean)).toBe(true);
    expect(wordAssimilationTimestamp(w, "mastered")).toBe(BASE_TS + 11 * DAY);
    const masteredStats = vocabProgressStats([w], BASE_TS + 11 * DAY);
    expect(masteredStats.provisionallyMastered).toBe(1);
    expect(masteredStats.retained).toBe(0);
    expect(masteredStats.mastered).toBe(1);

    // 4. Mastered -> Retained (>= 20 calendar days after chainEnd)
    w.evidence.push(
      addEvidence(w, {
        mode: "recall",
        context: "τραπέζι",
        day: 31, // 31 - 11 = 20 days
        newContext: false,
      }),
    );
    const retained = mastery(w);
    expect(retained.level).toBe("Retained");
    expect(retained.mastered).toBe(true);
    const retainedStats = vocabProgressStats([w], BASE_TS + 31 * DAY);
    expect(retainedStats.retained).toBe(1);
    expect(retainedStats.provisionallyMastered).toBe(0);
    expect(retainedStats.mastered).toBe(1);
  });

  describe("New -> Learning guards", () => {
    it("stays New when ledger only contains neutral synonyms or incomplete unscored records", () => {
      const w = createNoun();
      w.evidence = [
        addEvidence(w, {
          mode: "recall",
          correct: false,
          exact: false,
          neutral: true,
          status: "synonym",
          answer: "die Tafel",
          day: 0,
        }),
        {
          ...addEvidence(w, { mode: "recall", day: 1 }),
          sessionId: "",
        },
        {
          ...addEvidence(w, { mode: "recall", day: 2 }),
          prompt: "",
        },
        {
          ...addEvidence(w, { mode: "recall", day: 3 }),
          answer: "",
        },
      ];
      expect(mastery(w).level).toBe("New");
      expect(mastery(w).successes).toBe(0);
    });

    it("never skips from legacy counters to Consolidating or Mastered without Evidence Ledger entries", () => {
      const legacy = createNoun({
        learning: {
          timesSeen: 80,
          timesCorrect: 80,
          confidence: 5,
          nextReview: BASE_TS + 30 * DAY,
        },
      });
      const m = mastery(legacy);
      expect(m.level).toBe("Learning");
      expect(m.mastered).toBe(false);
      expect(m.successes).toBe(0);
      expect(m.contexts).toBe(0);
    });
  });

  describe("Learning -> Consolidating guards", () => {
    it("does not advance to Consolidating from Flashcards or Multiple Choice alone", () => {
      const w = createVerb();
      w.evidence = [
        addEvidence(w, { mode: "flashcard", context: "fc1", day: 0 }),
        addEvidence(w, { mode: "flashcard", context: "fc2", day: 1 }),
        addEvidence(w, { mode: "mc", context: "mc1", day: 2 }),
        addEvidence(w, { mode: "mc", context: "mc2", day: 4 }),
        addEvidence(w, { mode: "mc", context: "mc3", day: 8 }),
        addEvidence(w, { mode: "mc", context: "mc4", day: 16 }),
      ];
      const m = mastery(w);
      expect(m.level).toBe("Learning");
      expect(m.successes).toBe(0);
      expect(m.activeContexts).toBe(0);
      expect(m.contexts).toBe(0);
      expect(m.mastered).toBe(false);
    });

    it("rejects near, hinted, wrong-article, and unverified answers from advancing to Consolidating", () => {
      const w = createNoun();
      w.evidence = [
        addEvidence(w, {
          mode: "recall",
          context: "c1",
          day: 0,
          exact: false,
          status: "near",
        }),
        addEvidence(w, {
          mode: "fill",
          context: "c2",
          day: 1,
          hintUsed: true,
        }),
        addEvidence(w, {
          mode: "context",
          context: "c3",
          day: 4,
          articleCorrect: false,
        }),
        addEvidence(w, {
          mode: "production",
          context: "c4",
          day: 11,
          verified: false,
        }),
      ];
      const m = mastery(w);
      expect(m.level).toBe("Learning");
      expect(m.successes).toBe(0);
      expect(m.activeContexts).toBe(0);
    });

    it("blocks Consolidating when 3+ active successes reuse fewer than 3 distinct canonical contexts", () => {
      const w = createNoun();
      // Fill sentence "Der ______ steht im Zimmer." canonicalizes identically to
      // "Der Tisch steht im Zimmer." so only 2 distinct contexts exist despite 3 unique mode:context pairs.
      w.evidence = [
        addEvidence(w, {
          mode: "recall",
          context: "τραπέζι",
          day: 0,
          newContext: false,
        }),
        addEvidence(w, {
          mode: "fill",
          context: "Der ______ steht im Zimmer.",
          day: 1,
          newContext: false,
        }),
        addEvidence(w, {
          mode: "context",
          context: "Der Tisch steht im Zimmer.",
          day: 4,
          newContext: true,
        }),
      ];
      const m = mastery(w);
      expect(m.successes).toBe(3);
      expect(m.activeContexts).toBe(2);
      expect(m.level).toBe("Learning");
    });
  });

  describe("Consolidating -> Mastered anti-skipping ablation matrix", () => {
    it("blocks Mastered when fewer than 4 unique active successes exist (even with 4 days and 3-step delayed chain)", () => {
      const w = createNoun();
      // Day 0, 1, 4, 11 complete the delayed chain, but Day 11 repeats recall on the Day 0 context.
      w.evidence = [
        addEvidence(w, { mode: "recall", context: "c0", day: 0 }),
        addEvidence(w, { mode: "fill", context: "c1", day: 1 }),
        addEvidence(w, {
          mode: "context",
          context: "c2",
          day: 4,
          newContext: true,
        }),
        addEvidence(w, { mode: "recall", context: "c0", day: 11 }),
      ];
      const m = mastery(w);
      expect(m.delayed).toBe(3);
      expect(m.successes).toBe(3);
      expect(m.requirements.successes).toBe(false);
      expect(m.mastered).toBe(false);
      expect(m.level).toBe("Consolidating");
    });

    it("blocks Mastered when 4th context comes only from MC, Flashcard, or a failed attempt instead of an active success", () => {
      const w = createNoun();
      // 4 unique mode:contextKey successes across only 3 distinct active contexts (c1 reused by fill + recall)
      w.evidence = [
        addEvidence(w, { mode: "recall", context: "c0", day: 0 }),
        addEvidence(w, { mode: "fill", context: "c1", day: 1 }),
        addEvidence(w, {
          mode: "context",
          context: "c2",
          day: 4,
          newContext: true,
        }),
        addEvidence(w, { mode: "recall", context: "c1", day: 11 }),
        // Non-active attempts in extra contexts must NOT satisfy the 4-context requirement
        addEvidence(w, { mode: "mc", context: "c3-mc", day: 11 }),
        addEvidence(w, { mode: "flashcard", context: "c4-fc", day: 11 }),
        addEvidence(w, {
          mode: "context",
          context: "c5-wrong",
          day: 11,
          correct: false,
          exact: false,
        }),
      ];
      const m = mastery(w);
      expect(m.successes).toBe(4);
      expect(m.activeContexts).toBe(3);
      expect(m.contexts).toBe(3);
      expect(m.requirements.contexts).toBe(false);
      expect(m.mastered).toBe(false);
      expect(m.level).toBe("Consolidating");
    });

    it("blocks Mastered when only 1 active activity type is used", () => {
      const w = createNoun();
      w.evidence = [0, 1, 4, 11].map((day, idx) =>
        addEvidence(w, {
          mode: "recall",
          context: `c${idx}`,
          day,
          newContext: false,
        }),
      );
      const m = mastery(w);
      expect(m.successes).toBe(4);
      expect(m.contexts).toBe(4);
      expect(m.delayed).toBe(3);
      expect(m.activities).toBe(1);
      expect(m.requirements.activities).toBe(false);
      expect(m.mastered).toBe(false);
      expect(m.level).toBe("Consolidating");
    });

    it("blocks Mastered when successes occur on fewer than 3 distinct calendar days", () => {
      const w = createNoun();
      w.evidence = [
        addEvidence(w, { mode: "recall", context: "c0", day: 0 }),
        addEvidence(w, { mode: "fill", context: "c1", day: 0 }),
        addEvidence(w, {
          mode: "context",
          context: "c2",
          day: 1,
          newContext: true,
        }),
        addEvidence(w, {
          mode: "context",
          context: "c3",
          day: 1,
          newContext: true,
        }),
      ];
      const m = mastery(w);
      expect(m.days).toBe(2);
      expect(m.requirements.days).toBe(false);
      expect(m.requirements.delayed).toBe(false);
      expect(m.mastered).toBe(false);
      expect(m.level).toBe("Consolidating");
    });

    it("blocks Mastered when exact typed Recall is missing (only Fill + Context)", () => {
      const w = createNoun();
      w.evidence = [
        addEvidence(w, { mode: "fill", context: "c0", day: 0 }),
        addEvidence(w, {
          mode: "context",
          context: "c1",
          day: 1,
          newContext: true,
        }),
        addEvidence(w, {
          mode: "context",
          context: "c2",
          day: 4,
          newContext: true,
        }),
        addEvidence(w, {
          mode: "context",
          context: "c3",
          day: 11,
          newContext: true,
        }),
      ];
      const m = mastery(w);
      expect(m.typed).toBe(false);
      expect(m.requirements.typed).toBe(false);
      expect(m.mastered).toBe(false);
      expect(m.level).toBe("Consolidating");
    });

    it("blocks Mastered when no genuinely novel Context exists (flag false or context seen previously)", () => {
      // Case A: newContext flag false on all entries
      const noFlag = createMasteredWord();
      noFlag.evidence = (noFlag.evidence as Record<string, unknown>[]).map((e) => ({
        ...e,
        newContext: false,
      }));
      expect(mastery(noFlag).requirements.novel).toBe(false);
      expect(mastery(noFlag).mastered).toBe(false);
      expect(mastery(noFlag).level).toBe("Consolidating");

      // Case B: context entries claim newContext=true, but those sentences were already seen earlier
      const recycled = createNoun();
      const seenBefore = "Auf dem Tisch liegen zwei Bücher.";
      recycled.evidence = [
        // Earlier failed/exposure encounter of the context sentence
        addEvidence(recycled, {
          mode: "flashcard",
          context: seenBefore,
          day: 0,
        }),
        addEvidence(recycled, { mode: "recall", context: "c0", day: 0 }),
        addEvidence(recycled, { mode: "fill", context: "c1", day: 1 }),
        addEvidence(recycled, {
          mode: "context",
          context: seenBefore,
          day: 4,
          newContext: true,
        }),
        addEvidence(recycled, {
          mode: "fill",
          context: "c3",
          day: 11,
          newContext: false,
        }),
      ];
      const m = mastery(recycled);
      expect(m.novel).toBe(false);
      expect(m.requirements.novel).toBe(false);
      expect(m.mastered).toBe(false);
      expect(m.level).toBe("Consolidating");
    });

    it("enforces exact local calendar-day delayed chain windows (1-2d, 3-5d, 7-14d)", () => {
      // Verify lower bound (0, +1, +3, +7 -> days 0, 1, 4, 11) and upper bound (0, +2, +5, +14 -> days 0, 2, 7, 21)
      for (const days of [
        [0, 1, 4, 11],
        [0, 2, 7, 21],
      ]) {
        const w = createNoun();
        const chainModes: Mode[] = ["recall", "fill", "context", "context"];
        w.evidence = days.map((day, idx) =>
          addEvidence(w, {
            mode: chainModes[idx] ?? "context",
            context: `c${idx}`,
            day,
            newContext: idx >= 2,
          }),
        );
        expect(mastery(w).delayed).toBe(3);
        expect(mastery(w).mastered).toBe(true);
      }

      // Calendar day diff works across midnight (late night Day 0 -> early morning Day 1 = 1 day)
      const day0Late = new Date(2026, 0, 1, 23, 30, 0).getTime();
      const day1Early = new Date(2026, 0, 2, 0, 30, 0).getTime();
      const day4Morning = new Date(2026, 0, 5, 9, 0, 0).getTime();
      const day11Morning = new Date(2026, 0, 12, 9, 0, 0).getTime();
      expect(calendarDayDiff(day0Late, day1Early)).toBe(1);
      const midnightWord = createNoun();
      midnightWord.evidence = [
        addEvidence(midnightWord, {
          mode: "recall",
          context: "c0",
          timestamp: day0Late,
          sessionId: "m0",
        }),
        addEvidence(midnightWord, {
          mode: "fill",
          context: "c1",
          timestamp: day1Early,
          sessionId: "m1",
        }),
        addEvidence(midnightWord, {
          mode: "context",
          context: "c2",
          timestamp: day4Morning,
          newContext: true,
          sessionId: "m2",
        }),
        addEvidence(midnightWord, {
          mode: "context",
          context: "c3",
          timestamp: day11Morning,
          newContext: true,
          sessionId: "m3",
        }),
      ];
      expect(mastery(midnightWord).mastered).toBe(true);

      // Invalid chains violating each window's lower or upper bound must stay Consolidating
      const invalidChains: number[][] = [
        [0, 0, 4, 11], // step 1 too early (0d < 1d)
        [0, 3, 7, 15], // step 1 too late (3d > 2d)
        [0, 1, 3, 11], // step 2 too early (2d < 3d)
        [0, 1, 7, 15], // step 2 too late (6d > 5d)
        [0, 1, 4, 10], // step 3 too early (6d < 7d)
        [0, 1, 4, 19], // step 3 too late (15d > 14d)
      ];
      for (const days of invalidChains) {
        const w = createNoun();
        const chainModes: Mode[] = ["recall", "fill", "context", "context"];
        w.evidence = days.map((day, idx) =>
          addEvidence(w, {
            mode: chainModes[idx] ?? "context",
            context: `c${idx}`,
            day,
            newContext: idx >= 2,
          }),
        );
        const m = mastery(w);
        expect(m.requirements.delayed).toBe(false);
        expect(m.mastered).toBe(false);
        expect(m.level).toBe("Consolidating");
      }
    });

    it("demotes from Mastered on subsequent active-recall failure, ignores neutral synonyms and non-active errors", () => {
      const w = createMasteredWord();
      expect(mastery(w).level).toBe("Provisionally mastered");

      // Neutral synonym after mastery does not demote
      w.evidence.push(
        addEvidence(w, {
          mode: "recall",
          context: "τραπέζι",
          day: 13,
          correct: false,
          exact: false,
          neutral: true,
          status: "synonym",
          answer: "die Tafel",
        }),
      );
      expect(mastery(w).mastered).toBe(true);
      expect(mastery(w).failed).toBe(false);

      // Flashcard "Nochmal" or MC mistake does not count as active-recall failure
      w.evidence.push(
        addEvidence(w, {
          mode: "flashcard",
          context: "fc-miss",
          day: 14,
          correct: false,
          selfRating: "Nochmal",
        }),
        addEvidence(w, {
          mode: "mc",
          context: "mc-miss",
          day: 14,
          correct: false,
          exact: false,
        }),
      );
      expect(mastery(w).mastered).toBe(true);
      expect(mastery(w).failed).toBe(false);

      // Active-recall failure after chain completion demotes back to Consolidating
      w.evidence.push(
        addEvidence(w, {
          mode: "recall",
          context: "τραπέζι",
          day: 15,
          correct: false,
          exact: false,
          answer: "der Stuhl",
        }),
      );
      const demoted = mastery(w);
      expect(demoted.failed).toBe(true);
      expect(demoted.requirements.review).toBe(false);
      expect(demoted.mastered).toBe(false);
      expect(demoted.level).toBe("Consolidating");
    });
  });

  describe("Mastered -> Retained guards & recovery", () => {
    it("prevents skipping Mastered to reach Retained even with a 20+ day active recall", () => {
      // Missing Recall typed requirement (only fill + context), plus +25d later retrieval
      const w = createNoun();
      w.evidence = [
        addEvidence(w, { mode: "fill", context: "c0", day: 0 }),
        addEvidence(w, {
          mode: "context",
          context: "c1",
          day: 1,
          newContext: true,
        }),
        addEvidence(w, {
          mode: "context",
          context: "c2",
          day: 4,
          newContext: true,
        }),
        addEvidence(w, {
          mode: "context",
          context: "c3",
          day: 11,
          newContext: true,
        }),
        addEvidence(w, {
          mode: "context",
          context: "c4",
          day: 40,
          newContext: true,
        }),
      ];
      const m = mastery(w);
      expect(m.mastered).toBe(false);
      expect(m.level).toBe("Consolidating");
    });

    it("enforces the exact 20-calendar-day boundary and active-recall quality for Retained", () => {
      // 19 calendar days after chainEnd (day 11 + 19 = day 30) -> still Provisionally mastered
      const day19 = createMasteredWord();
      day19.evidence.push(addEvidence(day19, { mode: "recall", context: "τραπέζι", day: 30 }));
      expect(mastery(day19).level).toBe("Provisionally mastered");

      // Non-qualifying events at +25 days (day 36) cannot unlock Retained
      const invalidMaintenanceEvents: EvidenceOverrides[] = [
        { mode: "flashcard", context: "fc", day: 36 },
        { mode: "mc", context: "mc", day: 36 },
        { mode: "recall", context: "τραπέζι", day: 36, exact: false },
        { mode: "recall", context: "τραπέζι", day: 36, hintUsed: true },
        { mode: "recall", context: "τραπέζι", day: 36, articleCorrect: false },
        {
          mode: "recall",
          context: "τραπέζι",
          day: 36,
          correct: false,
          exact: false,
          neutral: true,
          status: "synonym",
        },
      ];
      for (const evt of invalidMaintenanceEvents) {
        const w = createMasteredWord();
        w.evidence.push(addEvidence(w, evt));
        expect(mastery(w).level).toBe("Provisionally mastered");
      }

      // Exact unassisted active recall at +20 calendar days (day 31) -> Retained
      const day20 = createMasteredWord();
      day20.evidence.push(addEvidence(day20, { mode: "fill", context: "c-ret", day: 31 }));
      expect(mastery(day20).level).toBe("Retained");
      expect(mastery(day20).mastered).toBe(true);
    });

    it("requires a full new delayed chain to recover Mastered after failure, and a new +20d check for Retained", () => {
      const w = createMasteredWord();
      // Reach Retained at day 32
      w.evidence.push(addEvidence(w, { mode: "recall", context: "τραπέζι", day: 32 }));
      expect(mastery(w).level).toBe("Retained");

      // Fail at day 33 -> demotes to Consolidating
      w.evidence.push(
        addEvidence(w, {
          mode: "recall",
          context: "τραπέζι",
          day: 33,
          correct: false,
          exact: false,
        }),
      );
      expect(mastery(w).level).toBe("Consolidating");
      expect(mastery(w).mastered).toBe(false);

      // A single success after failure (even +25 days later) does NOT recover Mastered or Retained
      const singleRetry = {
        ...w,
        evidence: [...w.evidence, addEvidence(w, { mode: "recall", context: "τραπέζι", day: 58 })],
      };
      expect(mastery(singleRetry).level).toBe("Consolidating");
      expect(mastery(singleRetry).mastered).toBe(false);

      // Completing a fresh 1-2 / 3-5 / 7-14d chain (days 35, 36, 39, 46) recovers Provisionally mastered
      w.evidence.push(
        addEvidence(w, { mode: "recall", context: "τραπέζι", day: 35 }),
        addEvidence(w, {
          mode: "fill",
          context: "Der ______ steht im Zimmer.",
          day: 36,
        }),
        addEvidence(w, {
          mode: "context",
          context: "Auf dem Tisch liegen zwei Bücher.",
          day: 39,
          newContext: false,
        }),
        addEvidence(w, {
          mode: "context",
          context: "Wir decken den Tisch für das Abendessen.",
          day: 46,
          newContext: false,
        }),
      );
      expect(mastery(w).failed).toBe(false);
      expect(mastery(w).mastered).toBe(true);
      expect(mastery(w).level).toBe("Provisionally mastered");

      // Needs +20 days from the NEW chainEnd (day 46 -> day 66) to become Retained again
      const tooSoon = {
        ...w,
        evidence: [...w.evidence, addEvidence(w, { mode: "recall", context: "τραπέζι", day: 65 })],
      };
      expect(mastery(tooSoon).level).toBe("Provisionally mastered");

      w.evidence.push(addEvidence(w, { mode: "recall", context: "τραπέζι", day: 66 }));
      expect(mastery(w).level).toBe("Retained");
    });
  });

  describe("Ledger ordering & previously_known isolation", () => {
    it("produces identical transition results regardless of ledger entry order", () => {
      const ordered = createMasteredWord();
      ordered.evidence.push(addEvidence(ordered, { mode: "recall", context: "τραπέζι", day: 31 }));

      const shuffled = {
        ...ordered,
        evidence: [...ordered.evidence].reverse(),
      };
      expect(mastery(shuffled)).toEqual(mastery(ordered));
      expect(mastery(shuffled).level).toBe("Retained");
    });

    it("tracks Evidence Ledger level normally while keeping previously_known out of WortWerk mastery counts", () => {
      const known = {
        ...createMasteredWord(),
        status: PREVIOUSLY_KNOWN_STATUS,
      };
      known.evidence.push(addEvidence(known, { mode: "recall", context: "τραπέζι", day: 35 }));

      expect(mastery(known).level).toBe("Retained");
      expect(isMasteredThroughWortwerk(known)).toBe(false);

      const stats = vocabProgressStats([known], BASE_TS + 35 * DAY);
      expect(stats.previouslyKnown).toBe(1);
      expect(stats.mastered).toBe(0);
      expect(stats.retained).toBe(0);
    });
  });

  describe("Full vocabulary corpus reachability & safe seed enrichment", () => {
    it("allows all 455 seed words (including all 50 B2 words) to reach Mastered and Retained using only real exercises and examples", () => {
      const words = (VOCAB_SEED as Record<string, unknown>[]).map(normalizeEntry);
      expect(words).toHaveLength(455);
      const b2Words = words.filter(isB2Word);
      expect(b2Words).toHaveLength(50);

      for (const w of words) {
        expect(hasFillExercise(w), `Missing Fill exercise for ${w.word}`).toBe(true);
        const ctxs = findAllContextExamples(w);
        expect(
          ctxs.length,
          `Fewer than 2 real Context examples for ${w.word}`,
        ).toBeGreaterThanOrEqual(2);

        const simulated = {
          ...w,
          learning: { timesSeen: 0, timesCorrect: 0, confidence: 0, nextReview: 0 },
          evidence: [] as ReturnType<typeof makeEvidence>[],
        };
        const recallPrompt = (w.meaning?.greek || []).join(", ") || w.word;
        simulated.evidence.push(
          addEvidence(simulated, {
            mode: "recall",
            context: recallPrompt,
            prompt: recallPrompt,
            day: 0,
            newContext: false,
          }),
          addEvidence(simulated, {
            mode: "fill",
            context: w.exercise.sentence,
            prompt: w.exercise.sentence,
            answer: w.exercise.answer,
            day: 1,
            newContext: false,
          }),
          addEvidence(simulated, {
            mode: "context",
            context: ctxs[0]!.context,
            prompt: ctxs[0]!.sentence,
            answer: ctxs[0]!.answer,
            day: 4,
            newContext: true,
          }),
        );
        expect(mastery(simulated).level, `${w.word} failed to reach Consolidating`).toBe(
          "Consolidating",
        );

        simulated.evidence.push(
          addEvidence(simulated, {
            mode: "context",
            context: ctxs[1]!.context,
            prompt: ctxs[1]!.sentence,
            answer: ctxs[1]!.answer,
            day: 11,
            newContext: true,
          }),
        );
        expect(mastery(simulated).level, `${w.word} failed to reach Mastered`).toBe(
          "Provisionally mastered",
        );
        expect(mastery(simulated).mastered, `${w.word} mastered flag false`).toBe(true);

        simulated.evidence.push(
          addEvidence(simulated, {
            mode: "recall",
            context: recallPrompt,
            prompt: recallPrompt,
            day: 31,
            newContext: false,
          }),
        );
        expect(mastery(simulated).level, `${w.word} failed to reach Retained`).toBe("Retained");
      }
    });

    it("safely merges new seed examples and normalized blanks into stored words without touching user progress", () => {
      const stored = normalizeEntry({
        word: "die Annahme",
        type: "Nomen",
        meaning: { greek: ["η υπόθεση"] },
        examples: [
          { de: "Seine Annahme war falsch.", el: "Η υπόθεσή του ήταν λάθος." },
          { de: "Mein eigenes Beispiel mit Annahme.", el: "Δικό μου παράδειγμα." },
        ],
        exercise: { sentence: "Ohne Beweise bleibt das nur eine ____.", answer: "Annahme" },
        learning: { timesSeen: 7, timesCorrect: 5, confidence: 3, nextReview: BASE_TS + 5 * DAY },
        fav: true,
        status: PREVIOUSLY_KNOWN_STATUS,
      });
      stored.evidence = [addEvidence(stored, { mode: "recall", context: "η υπόθεση", day: 0 })];

      const seed = normalizeEntry({
        word: "die Annahme",
        type: "Nomen",
        meaning: { greek: ["η υπόθεση"] },
        examples: [
          { de: "Seine Annahme war falsch.", el: "Η υπόθεσή του ήταν λάθος." },
          {
            de: "Diese Annahme muss erst geprüft werden.",
            el: "Αυτή η υπόθεση πρέπει πρώτα να ελεγχθεί.",
          },
        ],
        exercise: { sentence: "Ohne Beweise bleibt das nur eine ______.", answer: "Annahme" },
      });

      const merged = mergeSeedEnrichments(stored, seed);
      expect(merged.examples).toHaveLength(3);
      expect(merged.examples[1]?.de).toBe("Mein eigenes Beispiel mit Annahme.");
      expect(merged.examples[2]?.de).toBe("Diese Annahme muss erst geprüft werden.");
      expect(merged.exercise.sentence).toBe("Ohne Beweise bleibt das nur eine ______.");
      expect(merged.learning).toEqual(stored.learning);
      expect(merged.evidence).toEqual(stored.evidence);
      expect(merged.fav).toBe(true);
      expect(merged.status).toBe(PREVIOUSLY_KNOWN_STATUS);
    });
  });

  describe("Mastery-aligned nextReview scheduling & review queue priority", () => {
    it("guides a word seamlessly through 1d -> 3d -> 8d -> 21d -> 30d without skipping windows even with multiple same-day answers", () => {
      const w = createNoun({
        examples: [
          {
            de: "Auf dem Tisch liegen zwei Bücher.",
            el: "Πάνω στο τραπέζι βρίσκονται δύο βιβλία.",
          },
          {
            de: "Wir decken den Tisch für das Abendessen.",
            el: "Στρώνουμε το τραπέζι για το δείπνο.",
          },
        ],
      });

      // Day 0: Flashcard + MC + Recall all on the same day (high fallback 15d must NOT skip the 1-2d window!)
      let currentTs = BASE_TS;
      w.evidence.push(
        addEvidence(w, {
          mode: "flashcard",
          context: "fc0",
          timestamp: currentTs,
          sessionId: "d0",
        }),
        addEvidence(w, {
          mode: "mc",
          context: "mc0",
          timestamp: currentTs + 1000,
          sessionId: "d0",
        }),
        addEvidence(w, {
          mode: "recall",
          context: "τραπέζι",
          timestamp: currentTs + 2000,
          newContext: false,
          sessionId: "d0",
        }),
      );
      const next1 = computeAlignedNextReview(w, true, 15 * DAY, currentTs + 2000);
      expect(calendarDayDiff(currentTs, next1)).toBe(1);

      // Day 1: In 1-2d window -> answer Fill -> schedules +3 days (Day 4)
      currentTs = next1;
      expect(masteryScheduleState(w, currentTs)).toMatchObject({
        stage: "awaiting_step_1",
        inWindow: true,
        daysLeftInWindow: 1,
      });
      w.evidence.push(
        addEvidence(w, {
          mode: "fill",
          context: "Der ______ steht im Zimmer.",
          timestamp: currentTs,
          newContext: false,
          sessionId: "d1",
        }),
      );
      const next2 = computeAlignedNextReview(w, true, 15 * DAY, currentTs);
      expect(calendarDayDiff(currentTs, next2)).toBe(3);

      // Day 4: In 3-5d window -> answer Context #1 -> Consolidating -> schedules +8 days (Day 12)
      currentTs = next2;
      expect(masteryScheduleState(w, currentTs)).toMatchObject({
        stage: "awaiting_step_2",
        inWindow: true,
        daysLeftInWindow: 2,
      });
      w.evidence.push(
        addEvidence(w, {
          mode: "context",
          context: "Auf dem Tisch liegen zwei Bücher.",
          timestamp: currentTs,
          newContext: true,
          sessionId: "d4",
        }),
      );
      expect(mastery(w).level).toBe("Consolidating");
      const next3 = computeAlignedNextReview(w, true, 30 * DAY, currentTs);
      expect(calendarDayDiff(currentTs, next3)).toBe(8);

      // Day 12: In 7-14d window -> answer Context #2 -> Provisionally mastered -> schedules +21 days (Day 33)
      currentTs = next3;
      expect(masteryScheduleState(w, currentTs)).toMatchObject({
        stage: "awaiting_step_3",
        inWindow: true,
        daysLeftInWindow: 6,
      });
      w.evidence.push(
        addEvidence(w, {
          mode: "context",
          context: "Wir decken den Tisch für das Abendessen.",
          timestamp: currentTs,
          newContext: true,
          sessionId: "d12",
        }),
      );
      expect(mastery(w).level).toBe("Provisionally mastered");
      const next4 = computeAlignedNextReview(w, true, 10 * DAY, currentTs);
      expect(calendarDayDiff(currentTs, next4)).toBe(21);

      // Early review on Day 20 (8d after chainEnd) keeps target anchored to Day 33 (+13d remaining, NOT +21d!)
      const earlyTs = currentTs + 8 * DAY;
      const anchored = computeAlignedNextReview(w, true, 30 * DAY, earlyTs);
      expect(calendarDayDiff(earlyTs, anchored)).toBe(13);

      // Day 33 (>= 20d after chainEnd): retention_ready -> active recall -> Retained -> +30d maintenance
      currentTs = next4;
      expect(masteryScheduleState(w, currentTs)).toMatchObject({
        stage: "retention_ready",
        inWindow: true,
      });
      w.evidence.push(
        addEvidence(w, {
          mode: "recall",
          context: "τραπέζι",
          timestamp: currentTs,
          newContext: false,
          sessionId: "d33",
        }),
      );
      expect(mastery(w).level).toBe("Retained");
      const next5 = computeAlignedNextReview(w, true, 30 * DAY, currentTs);
      expect(calendarDayDiff(currentTs, next5)).toBe(30);
    });

    it("schedules +1d after active-recall failure and guides a fresh recovery chain back to Mastered", () => {
      const w = createMasteredWord();
      const failTs = BASE_TS + 14 * DAY;
      w.evidence.push(
        addEvidence(w, {
          mode: "recall",
          context: "τραπέζι",
          timestamp: failTs,
          correct: false,
          exact: false,
          sessionId: "fail",
        }),
      );
      expect(mastery(w).failed).toBe(true);
      const retryTs = computeAlignedNextReview(w, false, 30 * DAY, failTs);
      expect(calendarDayDiff(failTs, retryTs)).toBe(1);

      // Follow the aligned schedule through a fresh 1 -> 3 -> 8 chain after failure
      let ts = retryTs;
      const steps = [
        { mode: "recall" as const, context: "τραπέζι" },
        { mode: "fill" as const, context: "Der ______ steht im Zimmer." },
        { mode: "context" as const, context: "Auf dem Tisch liegen zwei Bücher." },
        { mode: "context" as const, context: "Wir decken den Tisch für das Abendessen." },
      ];
      for (let i = 0; i < steps.length; i++) {
        w.evidence.push(
          addEvidence(w, {
            mode: steps[i]!.mode,
            context: steps[i]!.context,
            timestamp: ts,
            newContext: false,
            sessionId: `rec-${i}`,
          }),
        );
        ts = computeAlignedNextReview(w, true, 30 * DAY, ts);
      }
      expect(mastery(w).failed).toBe(false);
      expect(mastery(w).mastered).toBe(true);
      expect(mastery(w).level).toBe("Provisionally mastered");
    });

    it("sorts due words by expiring mastery window urgency first, then retention-ready, then regular due words", () => {
      const nowTs = BASE_TS + 40 * DAY;

      // 1. Expiring today (day 2 of 1-2d window -> 0 days left)
      const expiringToday = createNoun({ word: "der Apfel" });
      expiringToday.evidence = [
        addEvidence(expiringToday, { mode: "recall", context: "μήλο", day: 38 }),
      ];

      // 2. Expiring in 2 days (day 3 of 3-5d window -> 2 days left)
      const expiringIn2d = createNoun({ word: "die Birne" });
      expiringIn2d.evidence = [
        addEvidence(expiringIn2d, { mode: "recall", context: "αχλάδι", day: 36 }),
        addEvidence(expiringIn2d, { mode: "fill", context: "c1", day: 37 }),
      ];

      // 3. Ready for Retained (mastered 25 days ago)
      const retentionReady = createMasteredWord();
      retentionReady.word = "die Kirsche";

      // 4. Ordinary due word (no open delayed window)
      const ordinary = createNoun({ word: "die Traube" });

      const sorted = sortWordsByReviewPriority(
        [ordinary, retentionReady, expiringIn2d, expiringToday],
        nowTs,
        () => 0.5,
      );
      expect(sorted.map((w) => w.word)).toEqual([
        "der Apfel",
        "die Birne",
        "die Kirsche",
        "die Traube",
      ]);
    });

    it("assigns active recall games targeting missing criteria for in-window words while keeping all 5 games for others", () => {
      const nowTs = BASE_TS + 2 * DAY;

      // Word in 1-2d window with only Fill so far -> needs Recall first
      const needsRecall = createNoun({
        word: "das Buch",
        examples: [
          { de: "Das Buch liegt auf dem Tisch.", el: "Το βιβλίο είναι πάνω στο τραπέζι." },
          { de: "Ich lese gern ein gutes Buch.", el: "Μου αρέσει να διαβάζω ένα καλό βιβλίο." },
        ],
      });
      needsRecall.evidence = [
        addEvidence(needsRecall, {
          mode: "fill",
          context: "Der ______ steht im Zimmer.",
          day: 0,
        }),
      ];
      expect(preferredActiveGameForWord(needsRecall)).toBe("recall");

      // Word in 1-2d window with Recall already done -> needs novel Context
      const needsNovel = createNoun({
        word: "das Haus",
        examples: [
          { de: "Das Haus hat einen großen Garten.", el: "Το σπίτι έχει μεγάλο κήπο." },
          {
            de: "Unser Haus liegt in einer ruhigen Straße.",
            el: "Το σπίτι μας είναι σε ήσυχο δρόμο.",
          },
        ],
      });
      needsNovel.evidence = [addEvidence(needsNovel, { mode: "recall", context: "σπίτι", day: 0 })];
      expect(preferredActiveGameForWord(needsNovel)).toBe("context");

      // In buildAllGamesQuestions with prioritizeMasteryWindows=true, in-window words never get flashcard/mc
      const regularPool = Array.from({ length: 8 }, (_, i) =>
        createNoun({
          word: `das Wort${i}`,
          examples: [
            { de: `Hier steht das Wort${i} im Satz.`, el: `Πρόταση ${i}.` },
            { de: `Ein zweites Beispiel mit Wort${i}.`, el: `Δεύτερο ${i}.` },
          ],
        }),
      );
      const questions = buildAllGamesQuestions([needsRecall, needsNovel, ...regularPool], {
        prioritizeMasteryWindows: true,
        nowTs,
        shuffleOrder: false,
        rng: () => 0.5,
      });
      expect(questions[0]?.type).toBe("recall");
      expect(questions[1]?.type).toBe("context");
      const allTypes = new Set(questions.map((q) => q.type));
      expect(allTypes.has("flashcard")).toBe(true);
      expect(allTypes.has("mc")).toBe(true);
      expect(allTypes.has("fill")).toBe(true);
    });
  });
});
