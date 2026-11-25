import { mastery, todayAccuracy, type Word } from "@/lib/wortwerk-data";
import { useAppLang } from "@/lib/i18n";

export default function MasteryEvidence({ word }: { word: Word }) {
  const { t } = useAppLang();
  const m = mastery(word);
  const today = todayAccuracy(word);
  return (
    <section
      className="my-4 space-y-2 border-t border-border pt-4 text-sm text-foreground"
      aria-label={t("Evidence κατάκτησης", "Mastery evidence")}
    >
      <strong>
        {m.level}
        {m.mastered ? " · MASTERED" : ""}
      </strong>
      <p>
        {t(
          `${m.contexts}/4 διαφορετικά συμφραζόμενα · ${m.successes}/4 ακριβείς ενεργές ανακλήσεις`,
          `${m.contexts}/4 distinct contexts · ${m.successes}/4 accurate active recalls`,
        )}
      </p>
      <p>
        {t(
          `${m.activities}/2 δραστηριότητες · ${m.days}/3 ημέρες · ${m.delayed}/3 καθυστερημένοι έλεγχοι (1–2 / 3–5 / 7–14 ημέρες)`,
          `${m.activities}/2 activities · ${m.days}/3 days · ${m.delayed}/3 delayed checks (1–2 / 3–5 / 7–14 days)`,
        )}
      </p>
      <p>
        {m.typed ? "✓" : "—"}{" "}
        {t(
          "Γραφή χωρίς βοήθεια (Recall), σωστή μορφή και άρθρο",
          "Unaided typed recall with exact form and article",
        )}{" "}
        · {m.novel ? "✓" : "—"} {t("Νέο συμφραζόμενο", "Novel context")}
      </p>
      {m.failed && (
        <p className="text-destructive">
          {t(
            "Αποτυχία καθυστερημένου ελέγχου: χρειάζεται νέα επιβεβαίωση διατήρησης.",
            "Delayed check failed: requires a new retention confirmation.",
          )}
        </p>
      )}
      <p className="text-muted-foreground">
        {t("Σήμερα:", "Today:")}{" "}
        {today.attempts
          ? t(
              `${Math.round(today.pct * 100)}% ακριβείς χωρίς βοήθεια (${today.attempts} βαθμολογημένες προσπάθειες)`,
              `${Math.round(today.pct * 100)}% accurate unaided (${today.attempts} graded attempts)`,
            )
          : t("καμία βαθμολογημένη προσπάθεια", "no graded attempts")}
        .{" "}
        {t(
          "Οι κάρτες και οι επιλογές δεν αποδεικνύουν παραγωγική κατάκτηση.",
          "Flashcards and multiple choice do not prove productive mastery.",
        )}
      </p>
      {word.learning?.timesSeen > 0 && !word.evidence?.length && (
        <p className="text-muted-foreground">
          {t(
            "Η παλιά πρόοδος διατηρήθηκε· δεν περιέχει τεκμήρια για πιστοποίηση κατάκτησης.",
            "Legacy progress was preserved; it does not contain evidence for mastery certification.",
          )}
        </p>
      )}
    </section>
  );
}
