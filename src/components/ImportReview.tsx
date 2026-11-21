import { Button } from '@/components/ui/button';
import type { Word } from '@/lib/wortwerk-data';

export default function ImportReview({ rows, onChange, onConfirm, onCancel }: { rows: Word[]; onChange: (rows: Word[]) => void; onConfirm: () => void; onCancel: () => void }) {
  const labels: Record<string, string> = { new: 'Νέα', exact: 'Exact duplicate', mergeable: 'Mergeable', near: 'Near duplicate' };
  return <section className="my-4 space-y-3 text-foreground" aria-label="Έλεγχος εισαγωγής">
    <p className="text-sm">{Object.entries(labels).map(([k, label]) => `${label}: ${rows.filter(r => r.kind === k).length}`).join(' · ')}</p>
    <div className="max-h-80 overflow-auto divide-y divide-border">
      {rows.map((r, i) => <div key={i} className="space-y-2 py-3">
        <div className="text-sm font-semibold break-words">{r.entry.word} · {labels[r.kind] || r.kind}</div>
        {r.match && <p className="text-xs text-muted-foreground">{r.match.word} · {(r.match.meaning?.greek || []).join(', ')}</p>}
        <select aria-label={`Απόφαση ${r.entry.word}`} className="w-full border border-input bg-background rounded-md p-2 text-sm" value={r.action} onChange={e => onChange(rows.map((row, j) => j === i ? { ...row, action: e.target.value } : row))}>
          <option value="skip">Παράλειψη</option>
          {['exact', 'mergeable'].includes(r.kind) && <option value="merge">Συγχώνευση</option>}
          {!['exact', 'mergeable'].includes(r.kind) && <option value="add">{r.kind === 'new' ? 'Προσθήκη' : 'Ξεχωριστή εγγραφή'}</option>}
        </select>
        {r.kind !== 'new' && r.action === 'add' && <input aria-label={`Αιτιολόγηση ${r.entry.word}`} className="w-full border border-input bg-background rounded-md p-2 text-sm" value={r.reason} placeholder="Διαφορετική σημασία / μορφή: αιτιολόγηση" onChange={e => onChange(rows.map((row, j) => j === i ? { ...row, reason: e.target.value } : row))} />}
      </div>)}
    </div>
    <div className="flex gap-2"><Button onClick={onConfirm}>Επιβεβαίωση εισαγωγής</Button><Button variant="outline" onClick={onCancel}>Ακύρωση</Button></div>
  </section>;
}