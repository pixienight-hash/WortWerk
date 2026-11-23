import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import WortwerkApp from "@/components/WortwerkApp";
import { SENTENCES_STORAGE_KEY, SENTENCES_META_KEY } from "@/lib/sentences-data";

describe("Sätze & Ausdrücke – UI integration, persistence & Wörter isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("progress-reset-v1", "1");
  });

  it("opens Sätze & Ausdrücke with all 5 tabs, imports JSON with duplicate warnings, persists across reload, and keeps Wörter isolated", async () => {
    const { unmount } = render(<WortwerkApp />);

    // Wait for WortWerk to finish loading
    const moduleNav = await waitFor(() =>
      screen.getByRole("navigation", { name: "Ενότητες WortWerk" }),
    );
    const vocabSnapshotBefore = localStorage.getItem("vocab-list");

    // Switch to Sätze & Ausdrücke
    fireEvent.click(within(moduleNav).getByRole("button", { name: /Sätze & Ausdrücke/ }));

    // Verify all 5 dedicated sub-tabs
    const sentenceNav = screen.getByRole("navigation", { name: "Πλοήγηση Sätze & Ausdrücke" });
    const tabs = within(sentenceNav).getAllByRole("button");
    expect(tabs.map((b) => b.textContent?.replace(/\d+/g, "").trim())).toEqual([
      "Alle Sätze",
      "Neue hinzufügen",
      "Lernen",
      "Übungen",
      "Fortschritt",
    ]);

    // Seed sentences are rendered in Alle Sätze
    expect(screen.getByText("Könnten Sie mir bitte das Salz reichen?")).toBeInTheDocument();
    expect(screen.getByText("Die Quadratur des Kreises.")).toBeInTheDocument();

    // Navigate to Neue hinzufügen and test JSON import + duplicate detection
    fireEvent.click(within(sentenceNav).getByRole("button", { name: "Neue hinzufügen" }));
    const textarea = screen.getByLabelText("JSON προτάσεων");
    const importPayload = JSON.stringify([
      {
        sentence: "  könnten sie mir bitte das salz reichen ",
        type: "polite_request",
        cefr: "A2",
        meaning: { el: "Διπλότυπο", en: "Duplicate" },
      },
      {
        sentence: "Das macht Sinn.",
        type: "everyday_expression",
        cefr: "B1",
        meaning: { el: "Αυτό βγάζει νόημα.", en: "That makes sense." },
      },
    ]);
    fireEvent.change(textarea, { target: { value: importPayload } });
    fireEvent.click(screen.getByRole("button", { name: /Έλεγχος JSON/ }));

    // Duplicate warning must be displayed
    expect(screen.getByRole("alert")).toHaveTextContent(/διπλότυπες προτάσεις/i);

    // Confirm import (skips duplicate, adds new)
    fireEvent.click(screen.getByRole("button", { name: /Επιβεβαίωση εισαγωγής/ }));
    expect(screen.getByRole("status")).toHaveTextContent(/1 νέες προστέθηκαν/);

    // Verify stored in independent localStorage key, while Wörter storage is untouched
    const storedSentences = JSON.parse(localStorage.getItem(SENTENCES_STORAGE_KEY) || "[]");
    expect(
      storedSentences.some((s: { sentence: string }) => s.sentence === "Das macht Sinn."),
    ).toBe(true);
    expect(localStorage.getItem("vocab-list")).toBe(vocabSnapshotBefore);

    // Simulate full reload: unmount and remount
    unmount();
    render(<WortwerkApp />);

    const reloadedNav = await waitFor(() =>
      screen.getByRole("navigation", { name: "Ενότητες WortWerk" }),
    );
    fireEvent.click(within(reloadedNav).getByRole("button", { name: /Sätze & Ausdrücke/ }));
    expect(screen.getByText("Das macht Sinn.")).toBeInTheDocument();

    // Complete an active exercise (Schreiben) and verify Fortschritt updates independently
    const reloadedSentenceNav = screen.getByRole("navigation", {
      name: "Πλοήγηση Sätze & Ausdrücke",
    });
    fireEvent.click(within(reloadedSentenceNav).getByRole("button", { name: "Übungen" }));
    fireEvent.click(screen.getByRole("button", { name: /Schreiben/ }));

    const input = screen.getByLabelText("Γερμανική πρόταση");
    fireEvent.change(input, { target: { value: "Falsche Antwort hier" } });
    fireEvent.click(screen.getByRole("button", { name: "Έλεγχος απάντησης" }));
    expect(
      screen.getByText(/Λανθασμένη απάντηση|Λείπουν λέξεις|Υπάρχουν επιπλέον/),
    ).toBeInTheDocument();

    // Close exercise and inspect Fortschritt
    fireEvent.click(screen.getByRole("button", { name: "Κλείσιμο άσκησης" }));
    fireEvent.click(within(reloadedSentenceNav).getByRole("button", { name: "Fortschritt" }));
    expect(screen.getByText("Ανεξάρτητα στατιστικά προτάσεων & εκφράσεων")).toBeInTheDocument();
    expect(screen.getByText("0/1 απαντήσεις")).toBeInTheDocument();

    // Independent meta persisted and Wörter untouched
    const savedMeta = JSON.parse(localStorage.getItem(SENTENCES_META_KEY) || "{}");
    expect(savedMeta.streak).toBe(1);
    expect(localStorage.getItem("vocab-list")).toBe(vocabSnapshotBefore);

    // Go back to Alle Sätze, open imported sentence detail, and delete with confirmation
    fireEvent.click(within(reloadedSentenceNav).getByRole("button", { name: "Alle Sätze" }));
    fireEvent.click(screen.getByText("Das macht Sinn."));
    const dialog = screen.getByRole("dialog", { name: "Das macht Sinn." });
    fireEvent.click(within(dialog).getByRole("button", { name: /Διαγραφή/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Επιβεβαίωση διαγραφής" }));
    expect(screen.queryByText("Das macht Sinn.")).not.toBeInTheDocument();

    const storedAfterDelete = JSON.parse(localStorage.getItem(SENTENCES_STORAGE_KEY) || "[]");
    expect(
      storedAfterDelete.some((s: { sentence: string }) => s.sentence === "Das macht Sinn."),
    ).toBe(false);
  }, 20000);
});
