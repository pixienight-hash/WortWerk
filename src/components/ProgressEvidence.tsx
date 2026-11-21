import { useState } from 'react';
import { normalizedWord, mastery, type Word } from '@/lib/wortwerk-data';
import MasteryEvidence from '@/components/MasteryEvidence';

export default function ProgressEvidence({ vocab }: { vocab: Word[] }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const matches = vocab.filter(w => normalizedWord(w.word).includes(normalizedWord(search)));
  const selected = vocab.find(w => w.id === selectedId);
  return <section className="mt-6 text-foreground" aria-label="Μάθηση ανά λέξη">
    <h2 className="mb-3 text-sm font-semibold">Μάθηση ανά λέξη</h2>
    <div className="flex flex-col gap-2">
      <input className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" aria-label="Αναζήτηση προόδου λέξης" placeholder="Αναζήτηση λέξης…" value={search} onChange={e => setSearch(e.target.value)} />
      <select className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" aria-label="Λέξη για προβολή προόδου" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
        <option value="">Επιλογή λέξης ({matches.length})</option>
        {selected && !matches.some(w => w.id === selected.id) && <option value={selected.id}>{selected.word}</option>}
        {matches.map(w => <option key={w.id} value={w.id}>{w.word} · {mastery(w).level}</option>)}
      </select>
    </div>
    {selected && <MasteryEvidence word={selected} />}
  </section>;
}