import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import WortwerkApp from "@/components/WortwerkApp";

describe("Navigation, Home progress overview, and Fortschritt layout", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("progress-reset-v1", "1");
  });

  it("renders 5 bottom nav tabs with Lernen centered, shows daily/monthly progress on Home, keeps add inside Wörter, and omits Μάθηση ανά λέξη in Fortschritt", async () => {
    render(<WortwerkApp />);

    const nav = await waitFor(() => screen.getByRole("navigation", { name: "Κύρια πλοήγηση" }));
    const navButtons = within(nav).getAllByRole("button");
    expect(navButtons).toHaveLength(5);
    expect(navButtons.map((b) => b.textContent?.replace(/\d+/g, "").trim())).toEqual([
      "Home",
      "Wörter",
      "Lernen",
      "Οικογένειες",
      "Fortschritt",
    ]);
    expect(within(nav).queryByText("Neu")).not.toBeInTheDocument();

    // Home shows Daily & Monthly progress instead of "Deine Wörter"
    expect(screen.getByText(/Ημερήσια & Μηνιαία πρόοδος/)).toBeInTheDocument();
    expect(screen.getByLabelText("Ημερήσια πρόοδος")).toBeInTheDocument();
    expect(screen.getByLabelText("Μηνιαία πρόοδος")).toBeInTheDocument();
    expect(screen.queryByText("Deine Wörter")).not.toBeInTheDocument();

    // Wörter tab keeps "+ Νέα λέξη" and replaces the second button with "Γνωρίζω ήδη"
    fireEvent.click(within(nav).getByRole("button", { name: "Wörter" }));
    expect(screen.getByRole("button", { name: "Νέα λέξη" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Γνωρίζω ήδη" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Προσθήκη από κείμενο" })).not.toBeInTheDocument();

    // Fortschritt tab does NOT render "Μάθηση ανά λέξη"
    fireEvent.click(within(nav).getByRole("button", { name: "Fortschritt" }));
    expect(screen.queryByText("Μάθηση ανά λέξη")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Μάθηση ανά λέξη")).not.toBeInTheDocument();

    // Lernen tab (centered) → B2 module renders the B2 Goal Tracker ring
    fireEvent.click(within(nav).getByRole("button", { name: /Lernen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Μόνο B2/ }));
    expect(
      screen.getByRole("progressbar", { name: "Πρόοδος κατάκτησης λέξεων B2" }),
    ).toBeInTheDocument();
  }, 15000);

  it("allows selecting multiple words in Γνωρίζω ήδη, saving previously_known status, and undoing selections", async () => {
    render(<WortwerkApp />);

    const nav = await waitFor(() => screen.getByRole("navigation", { name: "Κύρια πλοήγηση" }));
    fireEvent.click(within(nav).getByRole("button", { name: "Wörter" }));

    // Open Γνωρίζω ήδη modal and verify all existing words are listed in Λίστα
    fireEvent.click(screen.getByRole("button", { name: "Γνωρίζω ήδη" }));
    const dialog = screen.getByRole("dialog", { name: "Γνωρίζω ήδη" });
    const initialBoxes = dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const initialCount = initialBoxes.length;
    expect(initialCount).toBeGreaterThan(100);
    expect(
      within(dialog).getByRole("button", { name: `Λίστα (${initialCount})` }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Γνωστές (0)" })).toBeInTheDocument();

    // Selecting 2 words removes them from Λίστα and moves them to Γνωστές
    fireEvent.click(initialBoxes[0]!);
    const afterFirstBoxes = dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(afterFirstBoxes.length).toBe(initialCount - 1);
    fireEvent.click(afterFirstBoxes[0]!);
    expect(
      within(dialog).getByRole("button", { name: `Λίστα (${initialCount - 2})` }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Γνωστές (2)" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Αποθήκευση" }));
    expect(screen.queryByRole("dialog", { name: "Γνωρίζω ήδη" })).not.toBeInTheDocument();

    // Verify previously_known status persisted in localStorage
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("vocab-list") || "[]");
      const known = saved.filter((w: { status?: string }) => w.status === "previously_known");
      expect(known).toHaveLength(2);
    });

    // Reopen dialog, switch to Γνωστές, verify selections persisted, and undo one selection
    fireEvent.click(screen.getByRole("button", { name: "Γνωρίζω ήδη" }));
    const reopened = screen.getByRole("dialog", { name: "Γνωρίζω ήδη" });
    expect(
      within(reopened).getByRole("button", { name: `Λίστα (${initialCount - 2})` }),
    ).toBeInTheDocument();
    fireEvent.click(within(reopened).getByRole("button", { name: "Γνωστές (2)" }));
    const knownBoxes = reopened.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(knownBoxes).toHaveLength(2);
    expect(knownBoxes[0]).toBeChecked();
    expect(knownBoxes[1]).toBeChecked();

    fireEvent.click(knownBoxes[0]!);
    expect(
      within(reopened).getByRole("button", { name: `Λίστα (${initialCount - 1})` }),
    ).toBeInTheDocument();
    expect(within(reopened).getByRole("button", { name: "Γνωστές (1)" })).toBeInTheDocument();
    fireEvent.click(within(reopened).getByRole("button", { name: "Αποθήκευση" }));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("vocab-list") || "[]");
      const known = saved.filter((w: { status?: string }) => w.status === "previously_known");
      expect(known).toHaveLength(1);
    });
  }, 15000);
});
