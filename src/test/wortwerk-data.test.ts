import { describe, it, expect } from 'vitest';
import { normalizeEntry, normalizedWord, classify, safeMerge, parseImport, fullBackup, restoreState, applyImport, reviewEntries, makeEvidence, mastery, todayAccuracy, isMasteredToday, todayWordProgress, todayBatchProgress, compareTyped, checkTyped, diagnoseTyped, weeklyXpTimeline, wordAssimilationTimestamp, learningRate30d, isB2Word, filterVocabByPracticeScope, findContextExample, buildAllGamesQuestions, pickRandomTestWords, b2ProgressSummary, ALL_PRACTICE_GAMES, MAX_JSON_BYTES } from '@/lib/wortwerk-data';
import VOCAB_SEED from '@/data/vocab-seed.json';

const word = () => normalizeEntry({ word: 'der Tisch', type: 'Nomen', meaning: { greek: ['τραπέζι'] }, learning: { timesSeen: 54, timesCorrect: 40, confidence: 4, nextReview: 123 }, fav: true, tags: ['custom'], dateAdded: '2026-01-01' });
const DAY = 86400000; const base = new Date(2026, 0, 1, 12).getTime();
function evidence(w: any, i: number, mode = 'recall', context = `c${i}`, day = i) { return makeEvidence(w, true, { timestamp: base + day * DAY, mode, contextId: context, context, prompt: `prompt ${context}`, answer: 'der Tisch', exact: true, articleCorrect: true, sessionId: `s${day}`, newContext: mode === 'context' }); }
function positive() { const w = word(); w.evidence = [0, 1, 4, 11, 11, 11, 11].map((day, i) => evidence(w, i, ['recall', 'fill', 'context'][i % 3], `c${i}`, day)); return w; }
describe('WortWerk import and backup', () => {
  it('normalizes case, article, spaces and terminal punctuation', () => { expect(normalizedWord('  DIE   Tisch?! ')).toBe('tisch'); expect(classify(normalizeEntry({ ...word(), word: 'TISCH.' }), [word()]).kind).toBe('exact'); });
  it('preserves different POS and meanings', () => { expect(classify({ ...word(), type: 'Verb' }, [word()]).kind).toBe('new'); expect(classify({ ...word(), meaning: { greek: ['διαφορετική σημασία'] } }, [word()]).kind).toBe('new'); });
  it('preserves explicitly distinct sense IDs', () => { expect(classify({ ...word(), senseId: 'second' }, [{ ...word(), senseId: 'first' }]).kind).toBe('new'); });
  it('reports near words without merging them', () => { const near = normalizeEntry({ word: 'der Tish', type: 'Nomen', meaning: { greek: ['τραπέζι'] } }); expect(classify(near, [word()]).kind).toBe('near'); expect(applyImport([word()], reviewEntries([word()], [near])).next).toHaveLength(1); expect(() => applyImport([word()], [{ entry: near, action: 'merge' }])).toThrow(); });
  it('safe merge preserves ID, progress, favorites, timestamps and tags', () => { const a = word(); const b = { ...word(), id: 'other', learning: { timesSeen: 0 }, tags: ['extra'], dateAdded: 'later', usage: 'New detailed usage', unknown: { x: 1 } }; const merged = safeMerge(a, b); expect(merged.id).toBe(a.id); expect(merged.learning).toEqual(a.learning); expect(merged.fav).toBe(true); expect(merged.dateAdded).toBe('2026-01-01'); expect(merged.tags).toEqual(['custom', 'extra']); expect(merged.unknown).toEqual({ x: 1 }); expect(merged.aliasIds).toContain('other'); });
  it('only trusted richer text overwrites substantive text', () => { const a = { ...word(), usage: 'Original' }; expect(safeMerge(a, { ...word(), usage: 'Unverified much longer claim' }).usage).toBe('Original'); expect(safeMerge(a, { ...word(), usage: 'Verified longer text', verification_status: 'verified' }).usage).toBe('Verified longer text'); });
  it('supports all requested aliases and preserves unknown fields', () => { const raw = { word: 'lernen', pos: 'verb', meaning_el: 'μαθαίνω', grammar_usage: 'usage', example_de: 'Ich lerne.', example_el: 'Μαθαίνω.', morphology_word_family: ['Lerner'], etymology_note: 'history', memory_hook: 'hook', plural_or_form: 'gelernt', verification_status: 'verified', mystery: { greek: 'Ελληνικά' } }; const p = parseImport(JSON.stringify([raw])).vocab[0]; expect(p.meaning.greek).toEqual(['μαθαίνω']); expect(p.usage).toBe('usage'); expect(p.examples).toEqual([{ de: 'Ich lerne.', el: 'Μαθαίνω.' }]); expect(p.prefixFamily).toEqual(['Lerner']); expect(p.etymology).toBe('history'); expect(p.memoryHook).toBe('hook'); expect(p.plural).toBe('gelernt'); expect(p.verificationStatus).toBe('verified'); expect(p.mystery).toEqual(raw.mystery); expect(p.meaning_el).toBe('μαθαίνω'); });
  it('exports future-added words and round-trips every state field in isolation', () => { const vocab = [word(), normalizeEntry({ word: 'morgen', type: 'Sonstiges', meaning: { greek: ['αύριο'] }, unknown: 'Ω' })]; vocab[0].evidence = [evidence(vocab[0], 0)]; const meta = { xp: 123, settings: { target: 7 }, customLists: [{ name: 'Μου', ids: [vocab[0].id] }] }; const original = fullBackup(vocab, meta, { vendor: 'unknown' }, { extraState: { flag: true } }, '2026-11-11'); const parsed = parseImport(JSON.stringify(original)); const result = restoreState({ vocab: [], meta: {} }, parsed); expect(result.vocab).toEqual(vocab); expect(result.meta).toEqual(meta); expect(fullBackup(result.vocab, result.meta, result.extras, result.stateExtras, '2026-11-11')).toEqual(original); });
  it('accepts legacy backups', () => { expect(parseImport(JSON.stringify({ vocab: [word()], meta: { xp: 4 } })).meta.xp).toBe(4); expect(parseImport(JSON.stringify({ schemaVersion: 1, words: [word()] })).vocab).toHaveLength(1); });
  it('rejects corrupted JSON', () => expect(() => parseImport('[{')).toThrow('Μη έγκυρο'));
  it('rejects files over 10 MiB and over 10000 entries', () => { expect(() => parseImport(' '.repeat(MAX_JSON_BYTES + 1))).toThrow('10 MiB'); expect(() => parseImport(JSON.stringify(Array.from({ length: 10001 }, () => ({ word: 'a' }))))).toThrow('10.000'); });
  it('never adds an existing exact word even if add is requested with a reason', () => { const original = word(); const incoming = parseImport(JSON.stringify([{ ...original, word: ' TISCH. ' }])).vocab[0]; const result = applyImport([original], [{ entry: incoming, action: 'add', reason: 'Different idiom' }]); expect(result.added).toBe(0); expect(result.skipped).toBe(1); expect(result.next).toEqual([original]); });
  it('skips repeated words inside the same JSON batch', () => { const entries = parseImport(JSON.stringify([word(), word()])).vocab; const result = applyImport([], entries.map(entry => ({ entry, action: 'add' }))); expect(result.added).toBe(1); expect(result.skipped).toBe(1); expect(result.next).toHaveLength(1); });
  it('does not add a mergeable existing word with missing meaning', () => { const result = applyImport([word()], [{ entry: { word: 'Tisch', type: 'Nomen' }, action: 'add' }]); expect(result.added).toBe(0); expect(result.skipped).toBe(1); });
});
describe('Evidence-based mastery', () => {
  it('changing context IDs or sessions cannot inflate identical prompts', () => { const w = word(); w.evidence = Array.from({ length: 7 }, (_, i) => ({ ...evidence(w, i), context: 'same sentence', prompt: 'same prompt' })); expect(mastery(w).contexts).toBe(1); expect(mastery(w).successes).toBe(1); expect(mastery(w).mastered).toBe(false); });
  it('seven MC correct do not prove mastery', () => { const w = word(); w.evidence = Array.from({ length: 7 }, (_, i) => evidence(w, i, 'mc')); expect(mastery(w).mastered).toBe(false); expect(mastery(w).successes).toBe(0); });
  it('seven flashcard self-ratings do not prove mastery', () => { const w = word(); w.evidence = Array.from({ length: 7 }, (_, i) => evidence(w, i, 'flashcard')); expect(mastery(w).mastered).toBe(false); expect(w.evidence[0].correct).toBeNull(); });
  it('seven answers in same context do not prove mastery', () => { const w = word(); w.evidence = Array.from({ length: 7 }, (_, i) => evidence(w, i, 'recall', 'same', 0)); expect(mastery(w).contexts).toBe(1); expect(mastery(w).successes).toBe(1); expect(mastery(w).mastered).toBe(false); });
  it('full seven-context, seven-retrieval scenario is provisionally mastered', () => { const m = mastery(positive()); expect(m.contexts).toBe(7); expect(m.successes).toBe(7); expect(m.activities).toBe(3); expect(m.days).toBe(4); expect(m.delayed).toBe(3); expect(m.mastered).toBe(true); expect(m.level).toBe('Provisionally mastered'); });
  it('six encounters are insufficient', () => { const w = positive(); w.evidence.pop(); expect(mastery(w).mastered).toBe(false); });
  it('requires three activity types', () => { const w = positive(); w.evidence = w.evidence.map((e: any) => ({ ...e, mode: 'recall' })); expect(mastery(w).mastered).toBe(false); });
  it('requires three dates and delayed 1/3/7 retrieval', () => { const w = positive(); w.evidence = w.evidence.map((e: any) => ({ ...e, timestamp: base })); expect(mastery(w).days).toBe(1); expect(mastery(w).delayed).toBe(0); expect(mastery(w).mastered).toBe(false); });
  it('requires exact spelling, unaided retrieval and article', () => { for (const patch of [{ exact: false }, { hintUsed: true }, { articleCorrect: false }]) { const w = positive(); w.evidence = w.evidence.map((e: any) => ({ ...e, ...patch })); expect(mastery(w).mastered).toBe(false); } });
  it('requires a novel sentence context', () => { const w = positive(); w.evidence = w.evidence.map((e: any) => ({ ...e, newContext: false })); expect(mastery(w).mastered).toBe(false); });
  it('delayed failure demotes and subsequent maintenance proves retained', () => { const w = positive(); w.evidence.push(evidence(w, 8, 'recall', 'maintenance', 32)); expect(mastery(w).level).toBe('Retained'); w.evidence.push({ ...evidence(w, 9, 'recall', 'failed', 33), correct: false, exact: false }); expect(mastery(w).mastered).toBe(false); expect(mastery(w).failed).toBe(true); });
  it('does not interpret legacy counters as mastery or todays accuracy', () => { const w = word(); expect(mastery(w).mastered).toBe(false); expect(mastery(w).level).toBe('Learning'); expect(todayAccuracy(w, base)).toEqual({ attempts: 0, pct: 0 }); });
});
describe('Case-insensitive grading & incremental daily progress', () => {
  it('treats lowercase and uppercase exact spellings as exact', () => {
    expect(compareTyped('tisch', 'der Tisch')).toBe('exact');
    expect(compareTyped('DER TISCH', 'der Tisch')).toBe('exact');
    expect(compareTyped('damals', 'Damals')).toBe('exact');
    expect(compareTyped('die änderung', 'die Änderung')).toBe('exact');
    expect(compareTyped('DIE STRAẞE', 'die Straße')).toBe('exact');
    expect(compareTyped('andern', 'Ändern')).toBe('near');
    expect(compareTyped('Tish', 'Tisch')).toBe('near');
    expect(compareTyped('Stuhl', 'Tisch')).toBe('wrong');

    const noun = word();
    expect(checkTyped('der tisch', noun)).toEqual({ status: 'exact' });
    expect(checkTyped('DER TISCH', noun)).toEqual({ status: 'exact' });
    expect(checkTyped('tisch', noun)).toEqual({ status: 'near', note: 'article' });
    expect(checkTyped('das tisch', noun)).toEqual({ status: 'article', article: 'der' });
  });

  it('grants small incremental progress as todays words are practiced', () => {
    const w1 = normalizeEntry({ word: 'der Tisch', type: 'Nomen', meaning: { greek: ['τραπέζι'] } });
    const w2 = normalizeEntry({ word: 'damals', type: 'Sonstiges', meaning: { greek: ['τότε'] } });
    expect(todayWordProgress(w1, base)).toBe(0);
    expect(todayBatchProgress([w1, w2], base)).toEqual({ completed: 0, total: 2, pct: 0 });

    w1.evidence = [makeEvidence(w1, true, { timestamp: base, mode: 'flashcard', selfRating: 'Gut', prompt: w1.word, answer: 'Gut', sessionId: 's0' })];
    expect(todayWordProgress(w1, base)).toBeGreaterThan(0);
    expect(todayBatchProgress([w1, w2], base).pct).toBeGreaterThan(0);

    w1.evidence.push(evidence(w1, 1, 'mc', 'c1', 0));
    expect(todayWordProgress(w1, base)).toBe(0.2);
    expect(isMasteredToday(w1, base)).toBe(false);
    expect(todayBatchProgress([w1, w2], base)).toEqual({ completed: 0, total: 2, pct: 10 });

    for (let i = 2; i <= 5; i++) w1.evidence.push(evidence(w1, i, 'recall', `c${i}`, 0));
    expect(isMasteredToday(w1, base)).toBe(true);
    expect(todayWordProgress(w1, base)).toBe(1);
    expect(todayBatchProgress([w1, w2], base)).toEqual({ completed: 1, total: 2, pct: 50 });

    for (let i = 1; i <= 5; i++) w2.evidence = [...(w2.evidence || []), evidence(w2, i, 'recall', `d${i}`, 0)];
    expect(todayBatchProgress([w1, w2], base)).toEqual({ completed: 2, total: 2, pct: 100 });
  });

  it('diagnoses umlaut, eszett, typo, article, lemma, reflexive and split separable forms', () => {
    const noun = word();
    expect(diagnoseTyped('das tisch', noun)).toEqual({ status: 'article', article: 'der', inputArticle: 'das', reason: 'article_wrong' });
    expect(diagnoseTyped('tisch', noun)).toEqual({ status: 'near', note: 'article', reason: 'article_missing', article: 'der' });

    const umlautWord = normalizeEntry({ word: 'die Änderung', type: 'Nomen', meaning: { greek: ['αλλαγή'] } });
    expect(diagnoseTyped('die Anderung', umlautWord)).toEqual({ status: 'near', reason: 'umlaut' });

    const eszettWord = normalizeEntry({ word: 'die Straße', type: 'Nomen', meaning: { greek: ['δρόμος'] } });
    expect(diagnoseTyped('die Strasse', eszettWord)).toEqual({ status: 'near', reason: 'eszett' });

    expect(diagnoseTyped('der Tish', noun)).toEqual({ status: 'near', reason: 'typo' });

    const verb = normalizeEntry({ word: 'vorschlagen', type: 'Verb', meaning: { greek: ['προτείνω'] }, exercise: { sentence: 'Du ______ etwas ______.', answer: 'schlägst / vor' } });
    expect(diagnoseTyped('schlägst vor', verb, { target: 'schlägst / vor' })).toEqual({ status: 'exact' });
    expect(diagnoseTyped('vorschlagen', verb, { target: 'schlägst / vor' })).toEqual({ status: 'wrong', reason: 'lemma' });

    const refl = normalizeEntry({ word: 'sich freuen', type: 'Verb', meaning: { greek: ['χαίρομαι'] } });
    expect(diagnoseTyped('freuen', refl)).toEqual({ status: 'exact', isReflexiveMissing: true });

    expect(diagnoseTyped('Tisch', noun, { target: 'Tisch', contextArticle: '', requireContextArticle: true })).toEqual({ status: 'near', note: 'article', reason: 'article_missing', article: 'der' });
    expect(diagnoseTyped('Tisch', noun, { target: 'Tisch', contextArticle: 'die', requireContextArticle: true })).toEqual({ status: 'article', article: 'der', inputArticle: 'die', reason: 'article_wrong' });
  });

  it('aggregates earned XP per day over the last 7 days', () => {
    const refTs = new Date('2026-11-17T12:00:00Z').getTime();
    const logs = [
      { date: '2026-11-09', correct: 5, total: 5, xp: 50, kind: 'vocab' }, // outside 7-day window
      { date: '2026-11-11', correct: 4, total: 5, kind: 'vocab' }, // legacy fallback: 40 XP
      { date: '2026-11-11', correct: 2, total: 2, kind: 'intensive' }, // legacy fallback: 30 XP
      { date: '2026-11-17', correct: 3, total: 5, xp: 35, kind: 'vocab' },
      { date: '2026-11-17', correct: 2, total: 2, xp: 30, kind: 'intensive' },
    ];
    const timeline = weeklyXpTimeline(logs, refTs);
    expect(timeline).toHaveLength(7);
    expect(timeline[0]).toEqual({ date: '2026-11-11', day: '11/11', xp: 70, sessions: 2, isToday: false });
    expect(timeline[3]).toEqual({ date: '2026-11-14', day: '14/11', xp: 0, sessions: 0, isToday: false });
    expect(timeline[6]).toEqual({ date: '2026-11-17', day: '17/11', xp: 65, sessions: 2, isToday: true });
  });

  it('computes 30-day learning rate across started, assimilated and mastered evidence criteria', () => {
    const refDay = 40;
    const nowTs = base + refDay * DAY;

    // 1. Mastered word whose mastery chain completed on day 25, with maintenance on day 38 (stays on day 25)
    const masteredWord = normalizeEntry({ word: 'der Tisch', type: 'Nomen', meaning: { greek: ['τραπέζι'] } });
    masteredWord.evidence = [14, 15, 18, 25, 25, 25, 25].map((d, i) => evidence(masteredWord, i, ['recall', 'fill', 'context'][i % 3], `m${i}`, d));
    masteredWord.evidence.push(evidence(masteredWord, 8, 'recall', 'maint', 38));
    expect(wordAssimilationTimestamp(masteredWord, 'started')).toBe(base + 14 * DAY);
    expect(wordAssimilationTimestamp(masteredWord, 'assimilated')).toBe(base + 18 * DAY);
    expect(wordAssimilationTimestamp(masteredWord, 'mastered')).toBe(base + 25 * DAY);

    // 2. Assimilated (3+ active exact recalls) on day 35, not yet mastered
    const assimilatedWord = normalizeEntry({ word: 'die Lampe', type: 'Nomen', meaning: { greek: ['λάμπα'] } });
    assimilatedWord.evidence = [
      makeEvidence(assimilatedWord, true, { timestamp: base + 34 * DAY, mode: 'mc', contextId: 'mc1', prompt: 'die Lampe', answer: 'λάμπα', sessionId: 's34' }),
      ...[0, 1, 2].map((i) => makeEvidence(assimilatedWord, true, { timestamp: base + (34 + (i === 2 ? 1 : 0)) * DAY, mode: 'recall', contextId: `r${i}`, context: `ctx ${i}`, prompt: `p ${i}`, answer: 'die Lampe', exact: true, articleCorrect: true, sessionId: `s35-${i}` })),
    ];

    // 3. Old word mastered 45 days before nowTs (outside 30-day window [day 11 .. day 40])
    const oldWord = normalizeEntry({ word: 'alt', type: 'Adjektiv', meaning: { greek: ['παλιός'] } });
    oldWord.evidence = [0, 1, 4, 10, 10, 10, 10].map((d, i) => makeEvidence(oldWord, true, { timestamp: base + d * DAY, mode: ['recall', 'fill', 'context'][i % 3], contextId: `o${i}`, context: `octx ${i}`, prompt: `op ${i}`, answer: 'alt', exact: true, articleCorrect: true, sessionId: `so${d}`, newContext: i % 3 === 2 }));

    // 4. Unpracticed word with only legacy counter (must not count as evidence)
    const legacyOnly = word();

    const pool = [masteredWord, assimilatedWord, oldWord, legacyOnly];

    const assimilatedSummary = learningRate30d(pool, nowTs, 'assimilated', 30);
    expect(assimilatedSummary.days).toHaveLength(30);
    expect(assimilatedSummary.totalWords).toBe(2);
    expect(assimilatedSummary.ratePerDay).toBe(Number((2 / 30).toFixed(2)));
    expect(assimilatedSummary.activeDays).toBe(2);
    expect(assimilatedSummary.activeDayRate).toBe(1);
    expect(assimilatedSummary.last7dCount).toBe(1);
    expect(assimilatedSummary.prev7dCount).toBe(0);
    expect(assimilatedSummary.remainingWords).toBe(1);
    expect(assimilatedSummary.days[29]?.cumulative).toBe(2);
    const lampeDay = assimilatedSummary.days.find((d) => d.words.includes('die Lampe'));
    expect(lampeDay?.entries).toEqual([
      expect.objectContaining({ word: 'die Lampe', greek: 'λάμπα', level: 'Consolidating' }),
    ]);

    const masteredSummary = learningRate30d(pool, nowTs, 'mastered', 30);
    expect(masteredSummary.totalWords).toBe(1);
    expect(masteredSummary.ratePerDay).toBe(Number((1 / 30).toFixed(2)));
    const tischDay = masteredSummary.days.find((d) => d.words.includes('der Tisch'));
    expect(tischDay?.count).toBe(1);
    expect(tischDay?.entries[0]).toMatchObject({ word: 'der Tisch', greek: 'τραπέζι', level: 'Provisionally mastered' });

    const startedSummary = learningRate30d(pool, nowTs, 'started', 30);
    expect(startedSummary.totalWords).toBe(2);
  });
});

describe('B2-only practice scope, all-games builder & truly random test selection', () => {
  it('filters strictly B2 words across CEFR variants without mutating source vocab', () => {
    const sample = [
      normalizeEntry({ word: 'das Haus', type: 'Nomen', cefr: 'A1', meaning: { greek: ['σπίτι'] } }),
      normalizeEntry({ word: 'damals', type: 'Sonstiges', cefr: 'A2', meaning: { greek: ['τότε'] } }),
      normalizeEntry({ word: 'erklären', type: 'Verb', cefr: 'B1', meaning: { greek: ['εξηγώ'] } }),
      normalizeEntry({ word: 'fundiert', type: 'Adjektiv', cefr: 'B2', meaning: { greek: ['τεκμηριωμένος'] } }),
      normalizeEntry({ word: 'die Qualifikation', type: 'Nomen', cefr: 'b2.1', meaning: { greek: ['προσόν'] } }),
      normalizeEntry({ word: 'erörtern', type: 'Verb', cefr: 'C1', meaning: { greek: ['συζητώ διεξοδικά'] } }),
    ];
    expect(isB2Word(sample[3])).toBe(true);
    expect(isB2Word(sample[4])).toBe(true);
    expect(isB2Word(sample[2])).toBe(false);
    expect(isB2Word(sample[5])).toBe(false);

    const onlyB2 = filterVocabByPracticeScope(sample, 'b2');
    expect(onlyB2.map((w) => w.word)).toEqual(['fundiert', 'die Qualifikation']);
    expect(filterVocabByPracticeScope(sample, 'all')).toHaveLength(6);
    expect(sample).toHaveLength(6);
  });

  it('matches inflected context examples cleanly without leaving broken suffix fragments', () => {
    const adj = normalizeEntry({
      word: 'prachtvoll',
      type: 'Adjektiv',
      cefr: 'B2',
      meaning: { greek: ['μεγαλοπρεπής'] },
      examples: [{ de: 'Das Schloss hat eine prachtvolle Ausstattung.', el: 'Το κάστρο έχει μεγαλοπρεπή εξοπλισμό.' }],
    });
    const found = findContextExample(adj);
    expect(found).toEqual({
      sentence: 'Das Schloss hat eine ______ Ausstattung.',
      answer: 'prachtvolle',
      context: 'Das Schloss hat eine prachtvolle Ausstattung.',
      isNovel: true,
    });
  });

  it('builds all 5 games for daily practice and B2-only tests using only B2 words', () => {
    const normalizedSeed = (VOCAB_SEED as any[]).map(normalizeEntry);
    const b2Pool = filterVocabByPracticeScope(normalizedSeed, 'b2');
    expect(b2Pool.length).toBeGreaterThanOrEqual(20);

    const b2TestWords = pickRandomTestWords(b2Pool, 20);
    expect(b2TestWords).toHaveLength(20);
    expect(new Set(b2TestWords.map((w) => w.id)).size).toBe(20);
    expect(b2TestWords.every(isB2Word)).toBe(true);

    const b2Questions = buildAllGamesQuestions(b2TestWords, { shuffleOrder: true });
    expect(b2Questions).toHaveLength(20);
    expect(b2Questions.every((q) => isB2Word(q.word))).toBe(true);
    const presentGames = new Set(b2Questions.map((q) => q.type));
    for (const game of ALL_PRACTICE_GAMES) {
      expect(presentGames.has(game)).toBe(true);
    }
  });

  it('produces genuinely different random test selections across repeated draws', () => {
    const normalizedSeed = (VOCAB_SEED as any[]).map(normalizeEntry);
    const draws = Array.from({ length: 6 }, () =>
      pickRandomTestWords(normalizedSeed, 20).map((w) => w.id).join(',')
    );
    expect(new Set(draws).size).toBeGreaterThan(1);

    const b2Pool = filterVocabByPracticeScope(normalizedSeed, 'b2');
    const b2Draws = Array.from({ length: 6 }, () =>
      pickRandomTestWords(b2Pool, 20).map((w) => w.id).join(',')
    );
    expect(new Set(b2Draws).size).toBeGreaterThan(1);
  });

  it('computes dedicated B2-only evidence-based progress analytics without counting legacy counters', () => {
    const nowTs = base + 12 * DAY;

    // Non-B2 word (must be excluded even with full mastery evidence)
    const b1Word = normalizeEntry({ word: 'erklären', type: 'Verb', cefr: 'B1', meaning: { greek: ['εξηγώ'] } });
    b1Word.evidence = [0, 1, 4, 11, 11, 11, 11].map((day, i) =>
      makeEvidence(b1Word, true, { timestamp: base + day * DAY, mode: ['recall', 'fill', 'context'][i % 3], contextId: `b1-${i}`, context: `b1ctx-${i}`, prompt: `b1p-${i}`, answer: 'erklären', exact: true, articleCorrect: true, sessionId: `sb1-${day}`, newContext: i % 3 === 2 })
    );

    // B2 word 1: fully mastered across recall/fill/context + mc & flashcard attempts on recent days
    const b2Mastered = normalizeEntry({ word: 'die Qualifikation', type: 'Nomen', cefr: 'B2', meaning: { greek: ['προσόν'] }, learning: { confidence: 5, timesSeen: 10, timesCorrect: 9, nextReview: nowTs + 10 * DAY } });
    b2Mastered.evidence = [
      ...[0, 1, 4, 11, 11, 11, 11].map((day, i) =>
        makeEvidence(b2Mastered, true, { timestamp: base + day * DAY, mode: ['recall', 'fill', 'context'][i % 3], contextId: `q-${i}`, context: `qctx-${i}`, prompt: `qp-${i}`, answer: 'die Qualifikation', exact: true, articleCorrect: true, sessionId: `sq-${day}`, newContext: i % 3 === 2 })
      ),
      makeEvidence(b2Mastered, true, { timestamp: base + 12 * DAY, mode: 'mc', contextId: 'q-mc', prompt: 'die Qualifikation', answer: 'προσόν', sessionId: 'sq-12' }),
      makeEvidence(b2Mastered, true, { timestamp: base + 12 * DAY, mode: 'flashcard', selfRating: 'Gut', prompt: 'die Qualifikation', answer: 'Gut', sessionId: 'sq-12' }),
    ];

    // B2 word 2: consolidating (3 recall successes, 1 wrong fill) on recent days, due now
    const b2Mid = normalizeEntry({ word: 'fundiert', type: 'Adjektiv', cefr: 'b2.1', meaning: { greek: ['τεκμηριωμένος'] }, learning: { confidence: 2, timesSeen: 4, timesCorrect: 3, nextReview: nowTs - DAY } });
    b2Mid.evidence = [
      makeEvidence(b2Mid, true, { timestamp: base + 10 * DAY, mode: 'recall', contextId: 'f0', context: 'fctx0', prompt: 'fp0', answer: 'fundiert', exact: true, articleCorrect: true, sessionId: 'sf10' }),
      makeEvidence(b2Mid, true, { timestamp: base + 11 * DAY, mode: 'recall', contextId: 'f1', context: 'fctx1', prompt: 'fp1', answer: 'fundiert', exact: true, articleCorrect: true, sessionId: 'sf11' }),
      makeEvidence(b2Mid, true, { timestamp: base + 12 * DAY, mode: 'recall', contextId: 'f2', context: 'fctx2', prompt: 'fp2', answer: 'fundiert', exact: true, articleCorrect: true, sessionId: 'sf12' }),
      makeEvidence(b2Mid, false, { timestamp: base + 12 * DAY, mode: 'fill', contextId: 'f3', context: 'fctx3', prompt: 'fp3', answer: 'fundert', exact: false, articleCorrect: true, sessionId: 'sf12' }),
    ];

    // B2 word 3: untouched evidence, high legacy counters ONLY (must stay 0% readiness & 0 scored attempts)
    const b2LegacyOnly = normalizeEntry({ word: 'beeinflussen', type: 'Verb', cefr: 'B2', meaning: { greek: ['επηρεάζω'] }, learning: { confidence: 5, timesSeen: 40, timesCorrect: 39, nextReview: 0 } });

    const summary = b2ProgressSummary([b1Word, b2Mastered, b2Mid, b2LegacyOnly], nowTs);

    expect(summary.total).toBe(3);
    expect(summary.mastered).toBe(1);
    expect(summary.assimilated).toBe(2);
    expect(summary.typedVerified).toBe(2);
    expect(summary.novelVerified).toBe(1);
    expect(summary.due).toBe(2);
    expect(summary.stages['Provisionally mastered']).toBe(1);
    expect(summary.stages.Consolidating).toBe(1);
    expect(summary.stages.New).toBe(0); // legacy timesSeen marks level 'Learning' in mastery(), but readinessPct stays 0
    expect(summary.stages.Learning).toBe(1);

    const legacySnap = summary.words.find((w) => w.word.word === 'beeinflussen');
    expect(legacySnap?.criteriaMet).toBe(0);
    expect(legacySnap?.readinessPct).toBe(0);
    expect(legacySnap?.attempts).toBe(0);

    const masteredSnap = summary.words.find((w) => w.word.word === 'die Qualifikation');
    expect(masteredSnap?.criteriaMet).toBe(7);
    expect(masteredSnap?.readinessPct).toBe(100);

    // Scored attempts: 7 + 1 mc (b2Mastered) + 4 (b2Mid) = 12 (flashcard is exposure, not scored)
    expect(summary.evidenceAttempts).toBe(13);
    expect(summary.scoredAttempts).toBe(12);
    expect(summary.evidenceAccuracy).toBe(Math.round((11 / 12) * 100));

    // Per-game metrics cover all 5 games
    expect(summary.byGame).toHaveLength(5);
    const fillMetric = summary.byGame.find((g) => g.mode === 'fill');
    expect(fillMetric).toMatchObject({ attempts: 3, correct: 2, accuracy: 67, isExposure: false });
    const fcMetric = summary.byGame.find((g) => g.mode === 'flashcard');
    expect(fcMetric).toMatchObject({ attempts: 1, correct: 1, accuracy: 100, isExposure: true });

    // Per-POS breakdown covers Nomen, Verb, Adjektiv
    expect(summary.byPos.map((p) => p.type)).toEqual(['Nomen', 'Verb', 'Adjektiv']);

    // 7-day timeline has 7 days and captures today's activity
    expect(summary.daily7d).toHaveLength(7);
    const todayPoint = summary.daily7d[6];
    expect(todayPoint?.isToday).toBe(true);
    expect(todayPoint?.attempts).toBe(4); // mc + flashcard on b2Mastered + recall + fill on b2Mid
    expect(todayPoint?.correct).toBe(2); // mc + recall
    expect(todayPoint?.accuracy).toBe(67); // 2/3 scored
  });
});