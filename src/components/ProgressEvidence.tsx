import { useState } from "react";
import { normalizedWord, mastery, type Word } from "@/lib/wortwerk-data";
import MasteryEvidence from "@/components/MasteryEvidence";
import { useAppLang } from "@/lib/i18n";

export default function ProgressEvidence({ vocab }: { vocab: Word[] }) {
  const { t } = useAppLang();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const matches = vocab.filter((w) => normalizedWord(w.word).includes(normalizedWord(search)));
  const selected = vocab.find((w) => w.id === selectedId);
  return (
    <section className="mt-6 text-foreground" aria-label={t("Μάθηση ανά λέξη", "Learning by word")}>
      <h2 className="mb-3 text-sm font-semibold">{t("Μάθηση ανά λέξη", "Learning by word")}</h2>
      <div className="flex flex-col gap-2">
        <input
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t("Αναζήτηση προόδου λέξης", "Search word progress")}
          placeholder={t("Αναζήτηση λέξης…", "Search word…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t("Λέξη για προβολή προόδου", "Word to view progress")}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">
            {t(`Επιλογή λέξης (${matches.length})`, `Select a word (${matches.length})`)}
          </option>
          {selected && !matches.some((w) => w.id === selected.id) && (
            <option value={selected.id}>{selected.word}</option>
          )}
          {matches.map((w) => (
            <option key={w.id} value={w.id}>
              {w.word} · {mastery(w).level}
            </option>
          ))}
        </select>
      </div>
      {selected && <MasteryEvidence word={selected} />}
    </section>
  );
}