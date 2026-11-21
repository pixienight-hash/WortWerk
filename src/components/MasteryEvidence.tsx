import { mastery, todayAccuracy, type Word } from '@/lib/wortwerk-data';

export default function MasteryEvidence({ word }: { word: Word }) {
  const m = mastery(word); const today = todayAccuracy(word);
  return <section className="my-4 border-t border-border pt-4 text-sm space-y-2 text-foreground" aria-label="Evidence κατάκτησης">
    <strong>{m.level}{m.mastered ? ' · MASTERED' : ''}</strong>
    <p>{m.contexts}/7 διαφορετικά συμφραζόμενα · {m.successes}/7 ακριβείς ενεργές ανακλήσεις</p>
    <p>{m.activities}/3 δραστηριότητες · {m.days}/3 ημέρες · {m.delayed}/3 καθυστερημένοι έλεγχοι (1/3/7 ημέρες)</p>
    <p>{m.typed ? '✓' : '—'} Γραφή χωρίς βοήθεια, σωστή μορφή και άρθρο · {m.novel ? '✓' : '—'} Νέο συμφραζόμενο</p>
    {m.failed && <p className="text-destructive">Αποτυχία καθυστερημένου ελέγχου: χρειάζεται νέα επιβεβαίωση διατήρησης.</p>}
    <p className="text-muted-foreground">Σήμερα: {today.attempts ? `${Math.round(today.pct * 100)}% ακριβείς χωρίς βοήθεια (${today.attempts} βαθμολογημένες προσπάθειες)` : 'καμία βαθμολογημένη προσπάθεια'}. Οι κάρτες και οι επιλογές δεν αποδεικνύουν παραγωγική κατάκτηση.</p>
    {word.learning?.timesSeen > 0 && !word.evidence?.length && <p className="text-muted-foreground">Η παλιά πρόοδος διατηρήθηκε· δεν περιέχει τεκμήρια για πιστοποίηση κατάκτησης.</p>}
  </section>;
}