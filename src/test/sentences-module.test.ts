import { describe, it, expect } from "vitest";
import SENTENCES_SEED from "@/data/sentences.json";
import {
  SENTENCE_TYPES,
  SENTENCE_DAY_MS,
  DEFAULT_SENTENCE_META,
  normalizeSentenceEntry,
  sentenceIdentityKey,
  parseSentenceJsonInput,
  reviewSentenceImport,
  applySentenceImport,
  evaluateSentenceAnswer,
  buildSentenceQuestion,
  computeSentenceMastery,
  applySentenceAnswer,
  updateSentenceMetaOnAnswer,
  computeSentenceStats,
  type SentenceEntry,
} from "@/lib/sentences-data";

const DAY = SENTENCE_DAY_MS;
const BASE_TS = Date.UTC(2026, 4, 1, 10, 0, 0);

describe("Sätze & Ausdrücke – Seed database & JSON schema", () => {
  const seedEntries: SentenceEntry[] = (SENTENCES_SEED as unknown as Record<string, unknown>[]).map(
    (raw, i) => normalizeSentenceEntry(raw, `S${String(i + 1).padStart(4, "0")}`, BASE_TS),
  );

  it("loads all seed entries with unique IDs and covers all 8 required content types", () => {
    expect(seedEntries.length).toBeGreaterThanOrEqual(20);
    const ids = new Set(seedEntries.map((s) => s.id));
    expect(ids.size).toBe(seedEntries.length);

    const presentTypes = new Set(seedEntries.map((s) => s.type));
    for (const requiredType of SENTENCE_TYPES) {
      expect(presentTypes.has(requiredType)).toBe(true);
    }

    // All 6 requested examples exist
    const keys = new Set(seedEntries.map((s) => sentenceIdentityKey(s.sentence)));
    expect(keys.has(sentenceIdentityKey("Könnten Sie mir bitte das Salz reichen?"))).toBe(true);
    expect(keys.has(sentenceIdentityKey("Die Quadratur des Kreises."))).toBe(true);
    expect(keys.has(sentenceIdentityKey("Gerade noch geschafft!"))).toBe(true);
    expect(keys.has(sentenceIdentityKey("Darf ich Sie kurz stören?"))).toBe(true);
    expect(keys.has(sentenceIdentityKey("Könnten Sie mich bitte kurz herauslassen?"))).toBe(true);
    expect(keys.has(sentenceIdentityKey("Pflichten und Rechte."))).toBe(true);
  });

  it("allows every single seed sentence to reach Mastered and Retained using real generated exercises", () => {
    for (const seed of seedEntries) {
      let s = seed;
      const qCloze = buildSentenceQuestion(s, "lueckentext", seedEntries);
      expect(qCloze.blanks && qCloze.blanks.length >= 1).toBe(true);

      // Day 0: exact Lückentext
      s = applySentenceAnswer(s, {
        mode: "lueckentext",
        verdict: "exact",
        promptKey: qCloze.key,
        timestamp: BASE_TS,
      });
      expect(computeSentenceMastery(s).status).toBe("learning");

      // Day 2 (1–7d delayed step 1): exact Erinnern
      const qErinnern = buildSentenceQuestion(s, "erinnern", seedEntries);
      s = applySentenceAnswer(s, {
        mode: "erinnern",
        verdict: "exact",
        promptKey: qErinnern.key,
        timestamp: BASE_TS + 2 * DAY,
      });
      expect(computeSentenceMastery(s).status).toBe("consolidating");

      // Day 6 (3–14d delayed step 2): exact full Schreiben
      const qSchreiben = buildSentenceQuestion(s, "schreiben", seedEntries);
      s = applySentenceAnswer(s, {
        mode: "schreiben",
        verdict: "exact",
        promptKey: qSchreiben.key,
        timestamp: BASE_TS + 6 * DAY,
      });
      expect(computeSentenceMastery(s).status).toBe("mastered");

      // Day 21 (>=14d after mastery): exact Schreiben -> Retained
      s = applySentenceAnswer(s, {
        mode: "schreiben",
        verdict: "exact",
        promptKey: qSchreiben.key,
        timestamp: BASE_TS + 21 * DAY,
      });
      expect(computeSentenceMastery(s).status).toBe("retained");
    }
  });
});

describe("Sätze & Ausdrücke – JSON import & duplicate detection", () => {
  const existing: SentenceEntry[] = [
    normalizeSentenceEntry(
      {
        id: "S0001",
        sentence: "Könnten Sie mir bitte das Salz reichen?",
        type: "polite_request",
        cefr: "A2",
        meaning: { el: "Θα μπορούσατε να μου δώσετε το αλάτι;", en: "Could you pass the salt?" },
      },
      "S0001",
      BASE_TS,
    ),
  ];

  it("validates single JSON objects, arrays, and rejects invalid JSON or missing fields", () => {
    const single = parseSentenceJsonInput(
      JSON.stringify({
        sentence: "Alles klar!",
        type: "everyday_expression",
        meaning: { el: "Όλα εντάξει!", en: "All clear!" },
      }),
    );
    expect(single.ok).toBe(true);
    if (single.ok) expect(single.items).toHaveLength(1);

    const broken = parseSentenceJsonInput("{ invalid json");
    expect(broken.ok).toBe(false);

    const missingMeaning = parseSentenceJsonInput(JSON.stringify({ sentence: "Ohne Bedeutung." }));
    expect(missingMeaning.ok).toBe(false);
  });

  it("detects duplicates case-insensitively regardless of extra spaces or punctuation and preserves existing data", () => {
    const incomingJson = JSON.stringify([
      {
        sentence: "   könnten   sie mir bitte das salz reichen  ",
        type: "polite_request",
        cefr: "A2",
        meaning: { el: "Διπλότυπη πρόταση" },
      },
      {
        sentence: "Kein Problem!",
        type: "everyday_expression",
        cefr: "A2",
        meaning: { el: "Κανένα πρόβλημα!", en: "No problem!" },
      },
      {
        sentence: "kein   problem",
        type: "everyday_expression",
        cefr: "A2",
        meaning: { el: "Διπλότυπη μέσα στο ίδιο batch" },
      },
    ]);

    const parsed = parseSentenceJsonInput(incomingJson);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const review = reviewSentenceImport(existing, parsed.items, BASE_TS);
    expect(review).toHaveLength(3);
    expect(review[0]!.isDuplicate).toBe(true);
    expect(review[0]!.duplicateSource).toBe("existing");
    expect(review[0]!.action).toBe("skip");

    expect(review[1]!.isDuplicate).toBe(false);
    expect(review[1]!.action).toBe("add");

    expect(review[2]!.isDuplicate).toBe(true);
    expect(review[2]!.duplicateSource).toBe("batch");
    expect(review[2]!.action).toBe("skip");

    const applied = applySentenceImport(existing, review);
    expect(applied.added).toBe(1);
    expect(applied.skipped).toBe(2);
    expect(applied.next).toHaveLength(2);
    expect(applied.next[0]!.id).toBe("S0001");
    expect(applied.next[1]!.id).toBe("S0002");
  });
});

describe("Sätze & Ausdrücke – Strict written answer evaluation", () => {
  const target = "Könnten Sie mir bitte das Salz reichen?";
  const alts = ["Würden Sie mir bitte das Salz reichen?"];

  it("distinguishes exact answers, small spelling typos, and wrong/partial answers", () => {
    // Exact (with and without trailing question mark)
    expect(
      evaluateSentenceAnswer("Könnten Sie mir bitte das Salz reichen?", target, alts).verdict,
    ).toBe("exact");
    expect(
      evaluateSentenceAnswer("  Könnten Sie mir bitte das Salz reichen  ", target, alts).verdict,
    ).toBe("exact");
    // Listed alternative accepted cleanly
    expect(
      evaluateSentenceAnswer("Würden Sie mir bitte das Salz reichen?", target, alts).verdict,
    ).toBe("exact");

    // Small typo / missing umlaut
    const umlautSlip = evaluateSentenceAnswer(
      "Konnten Sie mir bitte das Salz reichen?",
      target,
      alts,
    );
    expect(umlautSlip.verdict).toBe("typo");
    expect(umlautSlip.correct).toBe(true);
    expect(umlautSlip.exact).toBe(false);

    const charTypo = evaluateSentenceAnswer("Könnten Sie mir bitte das Salz reicen?", target, alts);
    expect(charTypo.verdict).toBe("typo");

    // Partial/keyword-only overlap or scrambled words MUST be wrong
    expect(evaluateSentenceAnswer("Salz reichen", target, alts).verdict).toBe("wrong");
    expect(
      evaluateSentenceAnswer("Könnten Sie bitte das Salz reichen?", target, alts).verdict,
    ).toBe("wrong");
    expect(
      evaluateSentenceAnswer("Das Salz reichen bitte mir Sie könnten?", target, alts).verdict,
    ).toBe("wrong");
  });
});

describe("Sätze & Ausdrücke – Independent mastery, spaced repetition & statistics", () => {
  const baseEntry = normalizeSentenceEntry(
    {
      id: "S0099",
      sentence: "Das steht außer Frage.",
      type: "fixed_expression",
      cefr: "B2",
      meaning: { el: "Αυτό είναι εκτός συζήτησης.", en: "That is beyond question." },
      context: "Argumentation",
      usage: "Για κάτι απολύτως βέβαιο.",
    },
    "S0099",
    BASE_TS,
  );

  it("never promotes to Consolidating or Mastered via flashcards or passive multiple-choice alone", () => {
    let s = baseEntry;
    s = applySentenceAnswer(s, { mode: "flashcard", verdict: "exact", timestamp: BASE_TS });
    expect(computeSentenceMastery(s).status).toBe("new");

    for (let d = 0; d < 10; d++) {
      s = applySentenceAnswer(s, {
        mode: "bedeutung",
        verdict: "exact",
        timestamp: BASE_TS + d * DAY,
      });
      s = applySentenceAnswer(s, {
        mode: "situation",
        verdict: "exact",
        timestamp: BASE_TS + d * DAY,
      });
    }
    expect(computeSentenceMastery(s).status).toBe("learning");
  });

  it("does not grant mastery for typo or hinted active recalls, and drops status on subsequent failure", () => {
    let s = baseEntry;
    // Typo + hinted answers never satisfy exact active recall proofs
    s = applySentenceAnswer(s, { mode: "lueckentext", verdict: "typo", timestamp: BASE_TS });
    s = applySentenceAnswer(s, {
      mode: "schreiben",
      verdict: "exact",
      hintUsed: true,
      timestamp: BASE_TS + 2 * DAY,
    });
    expect(computeSentenceMastery(s).activeSuccesses).toBe(0);
    expect(computeSentenceMastery(s).status).toBe("learning");

    // Clean progression to Mastered
    s = applySentenceAnswer(s, {
      mode: "lueckentext",
      verdict: "exact",
      timestamp: BASE_TS + 3 * DAY,
    });
    expect(s.learning.nextReview).toBe(BASE_TS + 4 * DAY);

    s = applySentenceAnswer(s, {
      mode: "erinnern",
      verdict: "exact",
      timestamp: BASE_TS + 5 * DAY,
    });
    expect(computeSentenceMastery(s).status).toBe("consolidating");
    expect(s.learning.nextReview).toBe(BASE_TS + 8 * DAY);

    s = applySentenceAnswer(s, {
      mode: "schreiben",
      verdict: "exact",
      timestamp: BASE_TS + 9 * DAY,
    });
    expect(computeSentenceMastery(s).status).toBe("mastered");
    expect(s.learning.nextReview).toBe(BASE_TS + 23 * DAY); // +14d for Retained

    // Active failure after Mastered drops status and schedules +1d recovery
    s = applySentenceAnswer(s, {
      mode: "schreiben",
      verdict: "wrong",
      timestamp: BASE_TS + 15 * DAY,
    });
    expect(computeSentenceMastery(s).status).toBe("learning");
    expect(s.learning.nextReview).toBe(BASE_TS + 16 * DAY);
  });

  it("computes independent sentence statistics accurately", () => {
    let meta = { ...DEFAULT_SENTENCE_META };
    let s1 = baseEntry;
    const s2 = normalizeSentenceEntry(
      {
        id: "S0100",
        sentence: "Keine Ursache!",
        type: "everyday_expression",
        cefr: "A2",
        meaning: { el: "Δεν κάνει τίποτα!", en: "Don't mention it!" },
      },
      "S0100",
      BASE_TS,
    );

    s1 = applySentenceAnswer(s1, { mode: "bedeutung", verdict: "exact", timestamp: BASE_TS });
    meta = updateSentenceMetaOnAnswer(meta, s1.id, true, "bedeutung", BASE_TS);
    s1 = applySentenceAnswer(s1, {
      mode: "schreiben",
      verdict: "wrong",
      timestamp: BASE_TS + 1000,
    });
    meta = updateSentenceMetaOnAnswer(meta, s1.id, false, "schreiben", BASE_TS + 1000);

    const stats = computeSentenceStats([s1, s2], meta, BASE_TS + 2000);
    expect(stats.total).toBe(2);
    expect(stats.byStatus.new).toBe(1);
    expect(stats.byStatus.learning).toBe(1);
    expect(stats.reviewedCount).toBe(1);
    expect(stats.totalAttempts).toBe(2);
    expect(stats.totalCorrect).toBe(1);
    expect(stats.successRate).toBe(50);
    expect(stats.todayAttempts).toBe(2);
    expect(stats.todayUnique).toBe(1);
    expect(stats.streak).toBe(1);
  });
});
