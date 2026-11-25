import { Button } from "@/components/ui/button";
import type { Word } from "@/lib/wortwerk-data";
import { useAppLang, wordPrimaryMeanings } from "@/lib/i18n";

export default function ImportReview({
  rows,
  onChange,
  onConfirm,
  onCancel,
}: {
  rows: Word[];
  onChange: (rows: Word[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { lang, t } = useAppLang();
  const labels: Record<string, string> = {
    new: t("Νέα", "New"),
    exact: t("Ακριβές διπλότυπο", "Exact duplicate"),
    mergeable: t("Προς συγχώνευση", "Mergeable"),
    near: t("Πιθανό διπλότυπο", "Near duplicate"),
  };
  return (
    <section className="my-4 space-y-3 text-foreground" aria-label={t("Έλεγχος εισαγωγής", "Import review")}>
      <p className="text-sm">
        {Object.entries(labels)
          .map(([k, label]) => `${label}: ${rows.filter((r) => r.kind === k).length}`)
          .join(" · ")}
      </p>
      <div className="max-h-80 divide-y divide-border overflow-auto">
        {rows.map((r, i) => (
          <div key={i} className="space-y-2 py-3">
            <div className="break-words text-sm font-semibold">
              {r.entry.word} · {labels[r.kind] || r.kind}
            </div>
            {r.match && (
              <p className="text-xs text-muted-foreground">
                {r.match.word} · {wordPrimaryMeanings(r.match, lang).join(", ")}
              </p>
            )}
            <select
              aria-label={t(`Απόφαση ${r.entry.word}`, `Action for ${r.entry.word}`)}
              className="w-full rounded-md border border-input bg-background p-2 text-sm"
              value={r.action}
              onChange={(e) =>
                onChange(rows.map((row, j) => (j === i ? { ...row, action: e.target.value } : row)))
              }
            >
              <option value="skip">{t("Παράλειψη", "Skip")}</option>
              {["exact", "mergeable"].includes(r.kind) && (
                <option value="merge">{t("Συγχώνευση", "Merge")}</option>
              )}
              {!["exact", "mergeable"].includes(r.kind) && (
                <option value="add">
                  {r.kind === "new" ? t("Προσθήκη", "Add") : t("Ξεχωριστή εγγραφή", "Separate entry")}
                </option>
              )}
            </select>
            {r.kind !== "new" && r.action === "add" && (
              <input
                aria-label={t(`Αιτιολόγηση ${r.entry.word}`, `Reason for ${r.entry.word}`)}
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                value={r.reason}
                placeholder={t(
                  "Διαφορετική σημασία / μορφή: αιτιολόγηση",
                  "Different meaning / form: reason",
                )}
                onChange={(e) =>
                  onChange(rows.map((row, j) => (j === i ? { ...row, reason: e.target.value } : row)))
                }
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={onConfirm}>{t("Επιβεβαίωση εισαγωγής", "Confirm import")}</Button>
        <Button variant="outline" onClick={onCancel}>
          {t("Ακύρωση", "Cancel")}
        </Button>
      </div>
    </section>
  );
}