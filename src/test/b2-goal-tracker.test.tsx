import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import B2GoalTracker from "@/components/B2GoalTracker";
import { makeEvidence, normalizeEntry } from "@/lib/wortwerk-data";

const DAY = 86400000;
const base = new Date(2026, 0, 1, 12).getTime();

function buildMasteredB2(word: string, greek: string) {
  const entry = normalizeEntry({
    word,
    type: "Nomen",
    cefr: "B2",
    meaning: { greek: [greek] },
  });
  entry.evidence = [0, 1, 4, 11, 11, 11, 11].map((day, i) =>
    makeEvidence(entry, true, {
      timestamp: base + day * DAY,
      mode: ["recall", "fill", "context"][i % 3],
      contextId: `${word}-${i}`,
      context: `${word}-ctx-${i}`,
      prompt: `${word}-p-${i}`,
      answer: word,
      exact: true,
      articleCorrect: true,
      sessionId: `sess-${word}-${day}`,
      newContext: i % 3 === 2,
    }),
  );
  return entry;
}

describe("B2GoalTracker", () => {
  it("renders a progress ring based on mastered vs total B2 words and handles milestones and actions", () => {
    const mastered = buildMasteredB2("die Qualifikation", "προσόν");
    const consolidating = normalizeEntry({
      word: "vermeiden",
      type: "Verb",
      cefr: "B2",
      meaning: { greek: ["αποφεύγω"] },
    });
    consolidating.evidence = [
      makeEvidence(consolidating, true, {
        timestamp: base + 10 * DAY,
        mode: "recall",
        contextId: "c1",
        context: "c1",
        prompt: "p1",
        answer: "vermeiden",
        exact: true,
        articleCorrect: true,
        sessionId: "s1",
      }),
    ];
    const untouched = normalizeEntry({
      word: "ignorant",
      type: "Adjektiv",
      cefr: "B2",
      meaning: { greek: ["αδαής"] },
    });
    const nonB2 = normalizeEntry({
      word: "erklären",
      type: "Verb",
      cefr: "B1",
      meaning: { greek: ["εξηγώ"] },
    });

    const onOpenB2Stats = vi.fn();
    const onPracticeClosest = vi.fn();

    render(
      <B2GoalTracker
        vocab={[mastered, consolidating, untouched, nonB2]}
        onOpenB2Stats={onOpenB2Stats}
        onPracticeClosest={onPracticeClosest}
      />,
    );

    const ring = screen.getByRole("progressbar", {
      name: "Πρόοδος κατάκτησης λέξεων B2",
    });
    expect(ring).toHaveAttribute("aria-valuenow", "1");
    expect(ring).toHaveAttribute("aria-valuemax", "3");
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getByText("1 / 3 λέξεις")).toBeInTheDocument();

    // Selecting a milestone updates the target readout
    fireEvent.click(screen.getByRole("button", { name: /75%/ }));
    expect(screen.getByText(/Ετοιμότητα \(75%\)/)).toBeInTheDocument();

    // Expanding closest words reveals the nearest non-mastered B2 word
    fireEvent.click(screen.getByRole("button", { name: /Πιο κοντά στην κατάκτηση/ }));
    expect(screen.getByText("vermeiden")).toBeInTheDocument();

    // Action buttons invoke callbacks with real data
    fireEvent.click(screen.getByRole("button", { name: /Εξάσκηση πιο κοντινών/ }));
    expect(onPracticeClosest).toHaveBeenCalledTimes(1);
    const practicedWords = (onPracticeClosest.mock.calls[0]?.[0] ?? []) as { word: string }[];
    expect(practicedWords.map((w) => w.word)).toContain("vermeiden");

    fireEvent.click(screen.getByRole("button", { name: /Αναλυτική πρόοδος B2/ }));
    expect(onOpenB2Stats).toHaveBeenCalledTimes(1);
  });

  it("renders a clean empty state when no B2 words exist", () => {
    const b1Only = normalizeEntry({
      word: "erklären",
      type: "Verb",
      cefr: "B1",
      meaning: { greek: ["εξηγώ"] },
    });
    render(<B2GoalTracker vocab={[b1Only]} />);
    expect(screen.getByText(/Δεν υπάρχουν ακόμα ενεργές λέξεις επιπέδου B2/)).toBeInTheDocument();
  });
});
