import { useMemo, useState } from 'react';
import { ChevronRight, Search, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { familyCatalogue, familyMembers, type Word } from '@/lib/wortwerk-data';

export default function FamilyCatalogue({ vocab, onOpen }: { vocab: Word[]; onOpen: (word: Word) => void }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('az');
  const families = useMemo(() => familyCatalogue(vocab, query, sort), [vocab, query, sort]);
  return <section className="px-5 pb-6 pt-6 text-foreground">
    <h1 className="ww-display text-[26px] font-semibold">Οικογένειες</h1>
    <p className="mb-5 mt-1 text-sm text-muted-foreground">{families.length} οικογένειες λέξεων</p>
    <div className="relative mb-3">
      <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
      <input aria-label="Αναζήτηση οικογένειας" placeholder="Αναζήτηση ρίζας ή μέλους…" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" value={query} onChange={e => setQuery(e.target.value)} />
    </div>
    <select aria-label="Ταξινόμηση οικογενειών" className="mb-4 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={sort} onChange={e => setSort(e.target.value)}>
      <option value="az">Αλφαβητικά A–Z</option>
      <option value="za">Αλφαβητικά Z–A</option>
      <option value="size">Περισσότερα μέλη πρώτα</option>
    </select>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {families.map(w => <Button key={w.id || w.word} variant="outline" aria-label={`Οικογένεια ${w.stem || w.word}`} onClick={() => onOpen(w)} className="h-auto min-h-24 w-full justify-start gap-3 whitespace-normal bg-card p-4 text-left">
        <Layers size={20} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="ww-display block break-words text-lg font-semibold">{w.stem || w.word}</span>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">{familyMembers(w).length} μέλη</span>
          <span className="mt-2 block break-words text-xs font-normal text-muted-foreground">{familyMembers(w).slice(0, 3).map(m => m.word).join(' · ')}</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
      </Button>)}
    </div>
    {!families.length && <p className="py-10 text-center text-sm text-muted-foreground">Δεν βρέθηκαν οικογένειες.</p>}
  </section>;
}