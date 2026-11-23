import { describe, it, expect } from 'vitest';
import { normalizeEntry, normalizedWord, classify, safeMerge, parseImport, fullBackup, restoreState, applyImport, reviewEntries, makeEvidence, mastery, isPreviouslyKnown, isMasteredThroughWortwerk, applyPreviouslyKnownSelection, updatePreviouslyKnownOnAnswer, PREVIOUSLY_KNOWN_STATUS, vocabProgressStats, todayAccuracy, isMasteredToday, todayWordProgress, todayBatchProgress, compareTyped, checkTyped, diagnoseTyped, weeklyXpTimeline, wordAssimilationTimestamp, learningRate30d, isB2Word, filterVocabByPracticeScope, findAllContextExamples, findContextExample, buildAllGamesQuestions, pickRandomTestWords, b2ProgressSummary, b2GoalProgress, homeProgressSummary, ALL_PRACTICE_GAMES, MAX_JSON_BYTES } from '@/lib/wortwerk-data';
import VOCAB_SEED from '@/data/vocab-seed.json';

const word = () => normalizeEntry({ word: 'der Tisch', type: 'Nomen', meaning: { greek: ['τραπέζι'] }, learning: { timesSeen: 54, timesCorrect: 40, confidence: 4, nextReview: 123 }, fav: true, tags: ['custom'], dateAdded: '2026-01-01' });
const DAY = 86400000; const base = new Date(2026, 0, 1, 12).getTime();
function evidence(w: any, i: number, mode = 'recall', context = `c${i}`, day = i) { return makeEvidence(w, true, { timestamp: base + day * DAY, mode, contextId: context, context, prompt: `prompt ${context}`, answer: 'der Tisch', exact: true, articleCorrect: true, sessionId: `s${day}`, newContext: mode === 'context' }); }
function positive() { const w = word(); w.evidence = [0, 1, 4, 11].map((day, i) => evidence(w, i, ['recall', 'fill', 'context', 'context'][i]!, `c${i}`, day)); return w; }
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
  it('MC correct answers do not prove mastery or active recall successes', () => { const w = word(); w.evidence = Array.from({ length: 7 }, (_, i) => evidence(w, i, 'mc')); expect(mastery(w).mastered).toBe(false); expect(mastery(w).successes).toBe(0); });
  it('flashcard self-ratings do not prove mastery', () => { const w = word(); w.evidence = Array.from({ length: 7 }, (_, i) => evidence(w, i, 'flashcard')); expect(mastery(w).mastered).toBe(false); expect(w.evidence[0].correct).toBeNull(); });
  it('repeated answers in same context do not prove mastery', () => { const w = word(); w.evidence = Array.from({ length: 7 }, (_, i) => evidence(w, i, 'recall', 'same', 0)); expect(mastery(w).contexts).toBe(1); expect(mastery(w).successes).toBe(1); expect(mastery(w).mastered).toBe(false); });
  it('full four-context, four-retrieval scenario across 1-2/3-5/7-14d chain is provisionally mastered', () => {
    const m = mastery(positive());
    expect(m.contexts).toBe(4);
    expect(m.successes).toBe(4);
    expect(m.activities).toBe(3);
    expect(m.days).toBe(4);
    expect(m.delayed).toBe(3);
    expect(m.mastered).toBe(true);
    expect(m.level).toBe('Provisionally mastered');
  });
  it('transitions cleanly through New -> Learning -> Consolidating -> Mastered -> Retained', () => {
    const fresh = normalizeEntry({ word: 'der Tisch', type: 'Nomen', meaning: { greek: ['τραπέζι'] }, learning: { confidence: 0, timesSeen: 0, timesCorrect: 0, nextReview: 0 } });
    expect(mastery(fresh).level).toBe('New');

    // 1–2 active successes -> Learning
    fresh.evidence = [evidence(fresh, 0, 'recall', 'c0', 0), evidence(fresh, 1, 'fill', 'c1', 1)];
    expect(mastery(fresh).level).toBe('Learning');
    expect(mastery(fresh).mastered).toBe(false);

    // 3 unique active successes across 3 distinct contexts -> Consolidating (still not Mastered)
    fresh.evidence.push(evidence(fresh, 2, 'context', 'c2', 4));
    expect(mastery(fresh).level).toBe('Consolidating');
    expect(mastery(fresh).mastered).toBe(false);

    // 4th active success completing the 7–14d delayed window -> Provisionally mastered (Mastered)
    fresh.evidence.push(evidence(fresh, 3, 'context', 'c3', 11));
    expect(mastery(fresh).level).toBe('Provisionally mastered');
    expect(mastery(fresh).mastered).toBe(true);

    // 19 days after chainEnd is still Mastered (not yet Retained)
    const almostRetained = { ...fresh, evidence: [...fresh.evidence, evidence(fresh, 4, 'recall', 'c0', 30)] };
    expect(mastery(almostRetained).level).toBe('Provisionally mastered');

    // >= 20 days after chainEnd -> Retained
    fresh.evidence.push(evidence(fresh, 4, 'recall', 'c0', 31));
    expect(mastery(fresh).level).toBe('Retained');
    expect(mastery(fresh).mastered).toBe(true);
  });
  it('requires distinct contexts for Consolidating (same sentence via fill and context cannot double-count)', () => {
    const w = normalizeEntry({
      word: 'der Tisch',
      type: 'Nomen',
      meaning: { greek: ['τραπέζι'] },
      exercise: { sentence: 'Der ______ ist groß.', answer: 'Tisch' },
    });
    w.evidence = [
      evidence(w, 0, 'recall', 'τραπέζι', 0),
      evidence(w, 1, 'fill', 'Der ______ ist groß.', 1),
      evidence(w, 2, 'context', 'Der Tisch ist groß.', 4),
    ];
    // fill and context normalize to the same canonical sentence -> only 2 active contexts -> stays Learning
    expect(mastery(w).activeContexts).toBe(2);
    expect(mastery(w).level).toBe('Learning');
  });
  it('three encounters are insufficient for Mastered', () => { const w = positive(); w.evidence.pop(); expect(mastery(w).mastered).toBe(false); expect(mastery(w).level).toBe('Consolidating'); });
  it('requires at least two active activity types (1 fails, 2 succeeds)', () => {
    const oneMode = positive();
    oneMode.evidence = oneMode.evidence.map((e: any) => ({ ...e, mode: 'recall' }));
    expect(mastery(oneMode).mastered).toBe(false);

    const twoModes = word();
    twoModes.evidence = [
      evidence(twoModes, 0, 'recall', 'c0', 0),
      evidence(twoModes, 1, 'context', 'c1', 2),
      evidence(twoModes, 2, 'context', 'c2', 7),
      evidence(twoModes, 3, 'context', 'c3', 21),
    ];
    expect(mastery(twoModes).activities).toBe(2);
    expect(mastery(twoModes).delayed).toBe(3);
    expect(mastery(twoModes).mastered).toBe(true);
  });
  it('enforces real calendar-day delayed windows (1-2d, 3-5d, 7-14d)', () => {
    const sameDay = positive();
    sameDay.evidence = sameDay.evidence.map((e: any) => ({ ...e, timestamp: base }));
    expect(mastery(sameDay).days).toBe(1);
    expect(mastery(sameDay).delayed).toBe(0);
    expect(mastery(sameDay).mastered).toBe(false);

    // Upper boundary: +2d, +5d, +14d -> passes
    const upperBound = word();
    upperBound.evidence = [0, 2, 7, 21].map((day, i) => evidence(upperBound, i, ['recall', 'fill', 'context', 'context'][i]!, `c${i}`, day));
    expect(mastery(upperBound).delayed).toBe(3);
    expect(mastery(upperBound).mastered).toBe(true);

    // Outside first window (+3d instead of 1-2d) -> fails
    const badStep1 = word();
    badStep1.evidence = [0, 3, 7, 15].map((day, i) => evidence(badStep1, i, ['recall', 'fill', 'context', 'context'][i]!, `c${i}`, day));
    expect(mastery(badStep1).delayed).toBeLessThan(3);
    expect(mastery(badStep1).mastered).toBe(false);

    // Outside second window (+2d instead of 3-5d) -> fails
    const badStep2 = word();
    badStep2.evidence = [0, 1, 3, 11].map((day, i) => evidence(badStep2, i, ['recall', 'fill', 'context', 'context'][i]!, `c${i}`, day));
    expect(mastery(badStep2).delayed).toBeLessThan(3);
    expect(mastery(badStep2).mastered).toBe(false);

    // Outside third window (+16d instead of 7-14d) -> fails
    const badStep3 = word();
    badStep3.evidence = [0, 1, 4, 20].map((day, i) => evidence(badStep3, i, ['recall', 'fill', 'context', 'context'][i]!, `c${i}`, day));
    expect(mastery(badStep3).delayed).toBeLessThan(3);
    expect(mastery(badStep3).mastered).toBe(false);
  });
  it('requires exact spelling, unaided retrieval, Recall typed, and article', () => {
    for (const patch of [{ exact: false }, { hintUsed: true }, { articleCorrect: false }]) {
      const w = positive();
      w.evidence = w.evidence.map((e: any) => ({ ...e, ...patch }));
      expect(mastery(w).mastered).toBe(false);
    }
    // Missing Recall (only fill + context) cannot become Mastered
    const noRecall = word();
    noRecall.evidence = [0, 1, 4, 11].map((day, i) => evidence(noRecall, i, i === 0 ? 'fill' : 'context', `c${i}`, day));
    expect(mastery(noRecall).typed).toBe(false);
    expect(mastery(noRecall).mastered).toBe(false);
  });
  it('requires a novel sentence context', () => { const w = positive(); w.evidence = w.evidence.map((e: any) => ({ ...e, newContext: false })); expect(mastery(w).mastered).toBe(false); });
  it('delayed failure demotes, neutral synonym does not demote, and new valid chain recovers Mastered', () => {
    const w = positive();
    // Neutral synonym after mastery does NOT demote
    w.evidence.push(makeEvidence(w, false, { timestamp: base + 15 * DAY, mode: 'recall', status: 'synonym', neutral: true, prompt: 'τραπέζι', answer: 'Tafel', sessionId: 's15' }));
    expect(mastery(w).mastered).toBe(true);
    expect(mastery(w).failed).toBe(false);

    // Maintenance >= 20 days after chainEnd -> Retained
    w.evidence.push(evidence(w, 8, 'recall', 'maintenance', 32));
    expect(mastery(w).level).toBe('Retained');

    // Active-recall failure demotes from Retained/Mastered
    w.evidence.push({ ...evidence(w, 9, 'recall', 'failed', 33), correct: false, exact: false });
    expect(mastery(w).mastered).toBe(false);
    expect(mastery(w).failed).toBe(true);

    // Completing a fresh 1-2 / 3-5 / 7-14d chain after the failure restores Mastered
    w.evidence.push(
      evidence(w, 10, 'recall', 'c0', 35),
      evidence(w, 11, 'fill', 'c1', 36),
      evidence(w, 12, 'context', 'c2', 39),
      evidence(w, 13, 'context', 'c3', 47),
    );
    expect(mastery(w).failed).toBe(false);
    expect(mastery(w).mastered).toBe(true);
  });
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

  it('computes B2 goal progress ring metrics, milestones, and closest non-mastered words from evidence only', () => {
    const nowTs = base + 12 * DAY;

    const emptyGoal = b2GoalProgress([], nowTs);
    expect(emptyGoal.total).toBe(0);
    expect(emptyGoal.mastered).toBe(0);
    expect(emptyGoal.masteredPct).toBe(0);
    expect(emptyGoal.nextMilestone).toBeNull();
    expect(emptyGoal.closestWords).toEqual([]);

    const b1Ignored = normalizeEntry({ word: 'erklären', type: 'Verb', cefr: 'B1', meaning: { greek: ['εξηγώ'] } });
    b1Ignored.evidence = [0, 1, 4, 11, 11, 11, 11].map((day, i) =>
      makeEvidence(b1Ignored, true, { timestamp: base + day * DAY, mode: ['recall', 'fill', 'context'][i % 3], contextId: `ig-${i}`, context: `igctx-${i}`, prompt: `igp-${i}`, answer: 'erklären', exact: true, articleCorrect: true, sessionId: `sig-${day}`, newContext: i % 3 === 2 })
    );

    const b2Mastered = normalizeEntry({ word: 'die Qualifikation', type: 'Nomen', cefr: 'B2', meaning: { greek: ['προσόν'] } });
    b2Mastered.evidence = [0, 1, 4, 11, 11, 11, 11].map((day, i) =>
      makeEvidence(b2Mastered, true, { timestamp: base + day * DAY, mode: ['recall', 'fill', 'context'][i % 3], contextId: `gm-${i}`, context: `gmctx-${i}`, prompt: `gmp-${i}`, answer: 'die Qualifikation', exact: true, articleCorrect: true, sessionId: `sgm-${day}`, newContext: i % 3 === 2 })
    );

    const b2Consolidating = normalizeEntry({ word: 'vermeiden', type: 'Verb', cefr: 'B2', meaning: { greek: ['αποφεύγω'] } });
    b2Consolidating.evidence = [
      makeEvidence(b2Consolidating, true, { timestamp: base + 10 * DAY, mode: 'recall', contextId: 'vc-1', context: 'vc1', prompt: 'vp1', answer: 'vermeiden', exact: true, articleCorrect: true, sessionId: 'svc-10' }),
      makeEvidence(b2Consolidating, true, { timestamp: base + 11 * DAY, mode: 'fill', contextId: 'vc-2', context: 'vc2', prompt: 'vp2', answer: 'vermeiden', exact: true, articleCorrect: true, sessionId: 'svc-11' }),
      makeEvidence(b2Consolidating, true, { timestamp: nowTs, mode: 'context', contextId: 'vc-3', context: 'vc3', prompt: 'vp3', answer: 'vermeiden', exact: true, articleCorrect: true, sessionId: 'svc-12', newContext: true }),
    ];

    const b2LegacyOnly = normalizeEntry({ word: 'beeinflussen', type: 'Verb', cefr: 'B2', meaning: { greek: ['επηρεάζω'] }, learning: { confidence: 5, timesSeen: 20, timesCorrect: 20, nextReview: nowTs + 10 * DAY } });
    const b2Fresh = normalizeEntry({ word: 'ignorant', type: 'Adjektiv', cefr: 'B2', meaning: { greek: ['αδαής'] } });

    const goal = b2GoalProgress([b1Ignored, b2Mastered, b2Consolidating, b2LegacyOnly, b2Fresh], nowTs);
    expect(goal.total).toBe(4);
    expect(goal.mastered).toBe(1);
    expect(goal.remainingToMaster).toBe(3);
    expect(goal.masteredPct).toBe(25);
    expect(goal.masteredRatio).toBe(0.25);
    expect(goal.assimilated).toBe(2);
    expect(goal.inConsolidation).toBe(1);
    expect(goal.milestones.map((m) => ({ pct: m.pct, target: m.targetCount, reached: m.reached, remaining: m.remaining }))).toEqual([
      { pct: 25, target: 1, reached: true, remaining: 0 },
      { pct: 50, target: 2, reached: false, remaining: 1 },
      { pct: 75, target: 3, reached: false, remaining: 2 },
      { pct: 100, target: 4, reached: false, remaining: 3 },
    ]);
    expect(goal.nextMilestone?.pct).toBe(50);
    expect(goal.closestWords[0]?.label).toBe('vermeiden');
    expect(goal.closestWords.every((w) => !w.mastered)).toBe(true);
  });

  it('computes daily and 30-day monthly progress for Home screen from evidence and session logs only', () => {
    const nowTs = base + 20 * DAY;
    const todayIso = '2026-01-21';
    const prevIso = '2026-01-16';

    const w1 = normalizeEntry({ word: 'vermeiden', type: 'Verb', cefr: 'B2', meaning: { greek: ['αποφεύγω'] } });
    w1.evidence = [
      makeEvidence(w1, true, { timestamp: nowTs - 5 * DAY, mode: 'recall', contextId: 'h1', context: 'h1', prompt: 'p1', answer: 'vermeiden', exact: true, articleCorrect: true, sessionId: 's1' }),
      makeEvidence(w1, true, { timestamp: nowTs, mode: 'fill', contextId: 'h2', context: 'h2', prompt: 'p2', answer: 'vermeiden', exact: true, articleCorrect: true, sessionId: 's2' }),
      makeEvidence(w1, true, { timestamp: nowTs, mode: 'context', contextId: 'h3', context: 'h3', prompt: 'p3', answer: 'vermeiden', exact: true, articleCorrect: true, sessionId: 's2', newContext: true }),
    ];

    const w2 = normalizeEntry({ word: 'erklären', type: 'Verb', cefr: 'B1', meaning: { greek: ['εξηγώ'] } });
    w2.evidence = [
      makeEvidence(w2, false, { timestamp: nowTs, mode: 'mc', contextId: 'h4', context: 'h4', prompt: 'p4', answer: 'wrong', exact: false, articleCorrect: true, sessionId: 's2' }),
    ];

    // Legacy counters only, no evidence — must not inflate daily/monthly counts
    const legacy = normalizeEntry({ word: 'beeinflussen', type: 'Verb', cefr: 'B2', meaning: { greek: ['επηρεάζω'] }, learning: { confidence: 5, timesSeen: 20, timesCorrect: 20 } });

    const meta = {
      newPerDay: 5,
      sessionLogs: [
        { date: prevIso, xp: 40, durationMs: 120000 },
        { date: todayIso, xp: 90, durationMs: 300000 },
      ],
    };

    const res = homeProgressSummary([w1, w2, legacy], meta, nowTs);
    expect(res.daily.date).toBe(todayIso);
    expect(res.daily.wordsPracticed).toBe(2);
    expect(res.daily.targetWords).toBe(5);
    expect(res.daily.goalPct).toBe(40);
    expect(res.daily.scored).toBe(3);
    expect(res.daily.correct).toBe(2);
    expect(res.daily.accuracyPct).toBe(67);
    expect(res.daily.assimilated).toBe(1);
    expect(res.daily.xp).toBe(90);
    expect(res.daily.durationMs).toBe(300000);

    expect(res.monthly.windowDays).toBe(30);
    expect(res.monthly.days).toHaveLength(30);
    expect(res.monthly.activeDays).toBe(2);
    expect(res.monthly.practicedWords).toBe(2);
    expect(res.monthly.assimilated).toBe(1);
    expect(res.monthly.xp).toBe(130);
    expect(res.monthly.durationMs).toBe(420000);
  });
});

describe('Previously known words (previously_known)', () => {
  it('marks multiple words as previously_known, supports undo, and preserves existing progress and metadata untouched', () => {
    const w1 = positive();
    const w2 = normalizeEntry({ word: 'die Brücke', type: 'Nomen', meaning: { greek: ['γέφυρα'] }, fav: true, dateAdded: '2026-02-01', learning: { timesSeen: 5, timesCorrect: 4, confidence: 2, nextReview: 999 } });
    const w3 = normalizeEntry({ word: 'das Fenster', type: 'Nomen', meaning: { greek: ['παράθυρο'] } });

    const selected = applyPreviouslyKnownSelection([w1, w2, w3], [w1.id, w2.id]);
    expect(selected[0].status).toBe(PREVIOUSLY_KNOWN_STATUS);
    expect(selected[1].status).toBe(PREVIOUSLY_KNOWN_STATUS);
    expect(selected[2].status).toBeUndefined();
    expect(isPreviouslyKnown(selected[0])).toBe(true);
    expect(isPreviouslyKnown(selected[2])).toBe(false);

    // Existing progress, evidence, favorites, and metadata remain untouched
    expect(selected[0].evidence).toEqual(w1.evidence);
    expect(selected[0].learning).toEqual(w1.learning);
    expect(selected[1].fav).toBe(true);
    expect(selected[1].dateAdded).toBe('2026-02-01');
    expect(selected[1].learning).toEqual(w2.learning);

    // Undo selection for w1 while keeping w2
    const undone = applyPreviouslyKnownSelection(selected, [w2.id]);
    expect(isPreviouslyKnown(undone[0])).toBe(false);
    expect(undone[0].status).toBeUndefined();
    expect(undone[0].evidence).toEqual(w1.evidence);
    expect(isPreviouslyKnown(undone[1])).toBe(true);
  });

  it('includes ~10% previously_known words in random tests without excluding them completely', () => {
    const regular = Array.from({ length: 30 }, (_, i) =>
      normalizeEntry({ word: `lernen${i}`, type: 'Verb', meaning: { greek: [`μαθαίνω ${i}`] } })
    );
    const known = Array.from({ length: 20 }, (_, i) => ({
      ...normalizeEntry({ word: `wissen${i}`, type: 'Verb', meaning: { greek: [`ξέρω ${i}`] } }),
      status: PREVIOUSLY_KNOWN_STATUS,
    }));
    const pool = [...regular, ...known];

    // Deterministic RNG at 0.5 -> exact 10% of 20 = 2 previously_known words
    const picked20 = pickRandomTestWords(pool, 20, () => 0.5);
    expect(picked20).toHaveLength(20);
    expect(picked20.filter(isPreviouslyKnown)).toHaveLength(2);
    expect(picked20.filter((w) => !isPreviouslyKnown(w))).toHaveLength(18);

    // Works when pool has no previously_known words or only previously_known words
    expect(pickRandomTestWords(regular, 10, () => 0.5)).toHaveLength(10);
    expect(pickRandomTestWords(known, 10, () => 0.5)).toHaveLength(10);
  });

  it('excludes previously_known from WortWerk mastery metrics while still counting them in evaluation accuracy and leaving mastery() unchanged', () => {
    const nowTs = base + 12 * DAY;
    const masteredRegular = { ...positive(), cefr: 'B2' };
    const masteredKnown = {
      ...positive(),
      word: 'die Erfahrung',
      id: 'b2-known',
      cefr: 'B2',
      status: PREVIOUSLY_KNOWN_STATUS,
    };

    // Existing mastery() criteria are untouched
    expect(mastery(masteredKnown).mastered).toBe(true);
    // WortWerk mastery counter excludes previously_known
    expect(isMasteredThroughWortwerk(masteredRegular)).toBe(true);
    expect(isMasteredThroughWortwerk(masteredKnown)).toBe(false);

    // Learning rate (30d) excludes previously_known
    const lr = learningRate30d([masteredRegular, masteredKnown], nowTs, 'mastered', 30);
    expect(lr.totalWords).toBe(1);

    // B2 summary & goal tracker exclude previously_known from mastered/closestWords while keeping its scored evidence in accuracy
    const b2 = b2ProgressSummary([masteredRegular, masteredKnown], nowTs);
    expect(b2.mastered).toBe(1);
    expect(b2.scoredAttempts).toBe(8); // 4 from regular + 4 from previously_known
    expect(b2.evidenceAccuracy).toBe(100);
    expect(b2.activeRecallAccuracy).toBe(100);
    expect(b2.previouslyKnown).toBe(1);

    const goal = b2GoalProgress([masteredRegular, masteredKnown], nowTs);
    expect(goal.mastered).toBe(1);
    expect(goal.closestWords.some((item) => item.id === masteredKnown.id)).toBe(false);

    // Home progress summary counts evidence accuracy normally while excluding previously_known from monthly mastered
    const home = homeProgressSummary([masteredRegular, masteredKnown], { newPerDay: 10 }, nowTs);
    expect(home.monthly.mastered).toBe(1);
    expect(home.monthly.scored).toBe(8);
    expect(home.monthly.accuracyPct).toBe(100);
  });

  it('returns a previously_known word to normal learning after repeated mistakes and resets streak on correct answers', () => {
    const w = {
      ...normalizeEntry({ word: 'verstehen', type: 'Verb', meaning: { greek: ['καταλαβαίνω'] } }),
      status: PREVIOUSLY_KNOWN_STATUS,
      previouslyKnownMistakes: 0,
    };

    // 1st mistake keeps status but records mistake count
    const afterOneWrong = updatePreviouslyKnownOnAnswer(w, false);
    expect(isPreviouslyKnown(afterOneWrong)).toBe(true);
    expect(afterOneWrong.previouslyKnownMistakes).toBe(1);

    // Neutral/synonym answer does not increment mistakes
    const afterNeutral = updatePreviouslyKnownOnAnswer(afterOneWrong, false, { neutral: true });
    expect(afterNeutral.previouslyKnownMistakes).toBe(1);

    // A correct answer resets mistake streak
    const afterCorrect = updatePreviouslyKnownOnAnswer(afterOneWrong, true);
    expect(isPreviouslyKnown(afterCorrect)).toBe(true);
    expect(afterCorrect.previouslyKnownMistakes).toBe(0);

    // Two consecutive mistakes return the word to normal learning
    const wrong1 = updatePreviouslyKnownOnAnswer(afterCorrect, false);
    const wrong2 = updatePreviouslyKnownOnAnswer(wrong1, false);
    expect(isPreviouslyKnown(wrong2)).toBe(false);
    expect(wrong2.status).toBeUndefined();
    expect(wrong2.previouslyKnownMistakes).toBeUndefined();
  });
});

describe('Context extraction & unified vocabProgressStats', () => {
  it('uses real inflected verb/participle/plural examples, deduplicates fill overlaps, and rotates unseen contexts first', () => {
    const w = normalizeEntry({
      word: 'umsetzen',
      type: 'Verb',
      meaning: { greek: ['υλοποιώ'] },
      exercise: { sentence: 'Die Regierung hat die Reform ______.', answer: 'umgesetzt' },
      examples: [
        { de: 'Die Regierung hat die Reform umgesetzt.', el: 'Same as fill — must be skipped' },
        { de: 'Wir setzen den Plan schnell um.', el: 'Split verb — no single-token match' },
        { de: 'Das Team hat alle Ideen erfolgreich umgesetzt.', el: 'Real distinct participle example' },
        { de: 'Das Team hat alle Ideen erfolgreich umgesetzt!', el: 'Punctuation variant — must be deduplicated' },
      ],
    });
    const allCtx = findAllContextExamples(w);
    expect(allCtx).toHaveLength(1);
    expect(allCtx[0]!.answer).toBe('umgesetzt');
    expect(allCtx[0]!.context).toBe('Das Team hat alle Ideen erfolgreich umgesetzt.');

    const picked1 = findContextExample(w);
    expect(picked1?.isNovel).toBe(true);
    expect(picked1?.context).toBe('Das Team hat alle Ideen erfolgreich umgesetzt.');

    // Once seen in evidence, it is no longer marked isNovel
    w.evidence = [makeEvidence(w, true, { mode: 'context', context: picked1!.context, prompt: picked1!.sentence, answer: 'umgesetzt', exact: true, sessionId: 's1', newContext: true })];
    const picked2 = findContextExample(w);
    expect(picked2?.isNovel).toBe(false);
  });

  it('separates overall accuracy, active recall accuracy, and all progress buckets consistently in vocabProgressStats', () => {
    const wNew = normalizeEntry({ word: 'neu', type: 'Adjektiv', meaning: { greek: ['νέος'] }, learning: { confidence: 0, timesSeen: 0, timesCorrect: 0, nextReview: 0 } });
    const wLearning = normalizeEntry({ word: 'lernen', type: 'Verb', meaning: { greek: ['μαθαίνω'] }, learning: { confidence: 5, timesSeen: 20, timesCorrect: 20, nextReview: base + 100 * DAY } });
    wLearning.evidence = [
      makeEvidence(wLearning, true, { timestamp: base, mode: 'mc', prompt: 'lernen', answer: 'μαθαίνω', exact: true, sessionId: 's1' }),
      makeEvidence(wLearning, true, { timestamp: base + 1000, mode: 'recall', prompt: 'μαθαίνω', answer: 'lerne', exact: false, status: 'near', sessionId: 's1' }),
      makeEvidence(wLearning, false, { timestamp: base + 2000, mode: 'recall', prompt: 'μαθαίνω', answer: 'lernen', neutral: true, status: 'synonym', sessionId: 's1' }),
      makeEvidence(wLearning, true, { timestamp: base + 3000, mode: 'flashcard', selfRating: 'Gut', prompt: 'lernen', answer: 'Gut', sessionId: 's1' }),
    ];
    const wConsolidating = normalizeEntry({ word: 'üben', type: 'Verb', meaning: { greek: ['εξασκούμαι'] }, learning: { confidence: 3, timesSeen: 3, timesCorrect: 3, nextReview: base + 100 * DAY } });
    wConsolidating.evidence = [0, 1, 2].map((i) => evidence(wConsolidating, i, ['recall', 'fill', 'context'][i]!, `u${i}`, i));

    const wMastered = positive();
    const wRetained = positive();
    wRetained.id = 'retained-1';
    wRetained.evidence.push(evidence(wRetained, 8, 'recall', 'c0', 32));

    const wPrevKnown = { ...positive(), id: 'known-1', status: PREVIOUSLY_KNOWN_STATUS };

    const stats = vocabProgressStats([wNew, wLearning, wConsolidating, wMastered, wRetained, wPrevKnown], base + 12 * DAY);
    expect(stats.newCount).toBe(1);
    expect(stats.learning).toBe(1); // High confidence (5) does NOT make it Mastered!
    expect(stats.consolidating).toBe(1);
    expect(stats.provisionallyMastered).toBe(1);
    expect(stats.retained).toBe(1);
    expect(stats.mastered).toBe(2); // provisionallyMastered + retained, excluding previously_known
    expect(stats.previouslyKnown).toBe(1);

    // Scored evidence:
    // wLearning: 1 MC correct + 1 recall near (correct=true, exact=false); neutral synonym & flashcard excluded -> 2/2 overall, 0/1 active recall exact
    // wConsolidating: 3/3 overall, 3/3 active
    // wMastered: 4/4 overall, 4/4 active
    // wRetained: 5/5 overall, 5/5 active
    // wPrevKnown: 4/4 overall, 4/4 active (participates in accuracy!)
    expect(stats.overallScored).toBe(18);
    expect(stats.overallCorrect).toBe(18);
    expect(stats.overallAccuracy).toBe(100);
    expect(stats.activeRecallAttempts).toBe(17);
    expect(stats.activeRecallExact).toBe(16);
    expect(stats.activeRecallAccuracy).toBe(Math.round((16 / 17) * 100));
  });
});