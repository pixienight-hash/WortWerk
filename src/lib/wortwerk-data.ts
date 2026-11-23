// Pure, browser-safe import, backup and evidence rules. No storage side effects.
// Heterogeneous legacy records intentionally retain arbitrary source fields.
export type Word = any;
export const MAX_JSON_BYTES = 10 * 1024 * 1024;
export const MAX_WORDS = 10000;
const DAY = 86400000;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const list = (v: any): any[] => v == null ? [] : Array.isArray(v) ? v : [v];
const unique = (a: any[], b: any[]) => [...new Map([...a, ...b].map(x => [JSON.stringify(x), x])).values()];
export function normalizedWord(s: any): string {
  return String(s || '').normalize('NFC').trim().replace(/\s+/g, ' ').replace(/^(der|die|das)\s+/i, '').replace(/[.,;:!?…]+$/u, '').trim().toLocaleLowerCase('de');
}
const pos = (v: any) => (({ noun: 'Nomen', nomen: 'Nomen', verb: 'Verb', adjective: 'Adjektiv', adjektiv: 'Adjektiv' } as Record<string, string>)[String(v || '').toLowerCase()] || v || 'Sonstiges');
const senses = (w: Word) => list(w.meaning?.greek?.length ? w.meaning.greek : w.meaning?.english).map(normalizedWord).sort();
export function identity(w: Word) { return JSON.stringify([normalizedWord(w.word), pos(w.type), w.senseId || senses(w)]); }
function hash(s: string) { let n = 2166136261; for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0).toString(36); }
export function normalizeEntry(raw: Word): Word {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.word !== 'string' || !normalizedWord(raw.word)) throw new Error('Κάθε εγγραφή χρειάζεται έγκυρη λέξη.');
  const w = clone(raw);
  w.type = pos(w.type || w.pos);
  w.meaning = { ...w.meaning, greek: list(w.meaning?.greek ?? w.meaning_el), english: list(w.meaning?.english) };
  const aliases = { usage: 'grammar_usage', memoryHook: 'memory_hook', plural: 'plural_or_form', etymology: 'etymology_note', prefixFamily: 'morphology_word_family', verificationStatus: 'verification_status' };
  for (const [field, alias] of Object.entries(aliases)) if (w[field] == null && w[alias] != null) w[field] = clone(w[alias]);
  if (!w.examples && w.example_de) w.examples = list(w.example_de).map((de: any, i: number) => ({ de, el: list(w.example_el)[i] || '' }));
  if (!w.article) w.article = w.word.match(/^(der|die|das)\s/i)?.[1]?.toLowerCase() || '';
  w.id = w.id || `ww-${hash(identity(w))}`;
  // Original aliases and unknown fields remain at their original paths.
  return w;
}
function distance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { const next = [i]; for (let j = 1; j <= b.length; j++) next[j] = Math.min((next[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + Number(a[i - 1] !== b[j - 1])); prev = next; }
  return prev[b.length] ?? 0;
}
export function classify(incoming: Word, existing: Word[]) {
  const key = normalizedWord(incoming.word);
  const exact = existing.find((w: any) => identity(w) === identity(incoming));
  if (exact) return { kind: 'exact', match: exact };
  const same = existing.find((w: any) => normalizedWord(w.word) === key && pos(w.type) === pos(incoming.type) && (!w.senseId || !incoming.senseId || w.senseId === incoming.senseId) && (senses(w).length === 0 || senses(incoming).length === 0 || senses(w).some(s => senses(incoming).includes(s))));
  if (same) return { kind: 'mergeable', match: same };
  const near = existing.find((w: any) => normalizedWord(w.word) !== key && key.length >= 4 && distance(normalizedWord(w.word), key) <= 1);
  return near ? { kind: 'near', match: near } : { kind: 'new', match: undefined };
}
const unsafe = new Set(['__proto__', 'constructor', 'prototype']);
export function mergeFields(a: Word, b: Word): Word {
  const out = clone(a);
  for (const [k, v] of Object.entries(b)) {
    if (unsafe.has(k)) continue;
    if (out[k] == null || out[k] === '') out[k] = clone(v);
    else if (Array.isArray(out[k]) && Array.isArray(v)) out[k] = unique(out[k], v);
    else if (out[k] && v && typeof out[k] === 'object' && typeof v === 'object' && !Array.isArray(v)) out[k] = mergeFields(out[k], v);
    else if (typeof out[k] === 'string' && typeof v === 'string' && v.length > out[k].length) out[k] = v;
  }
  return out;
}
export function safeMerge(a: Word, b: Word, restore = false): Word {
  if (JSON.stringify(a) === JSON.stringify(b)) return clone(a);
  // Imported unverified text cannot overwrite existing substantive text.
  const trusted = ['verified', 'approved'].includes(b.verificationStatus || b.verification_status);
  let out = mergeFields(a, b);
  if (!trusted) for (const k of Object.keys(a)) if (typeof a[k] === 'string' && a[k]) out[k] = a[k];
  out.id = a.id || b.id;
  out.word = a.word;
  out.aliasIds = unique(a.aliasIds || [], [...(b.aliasIds || []), ...(b.id && b.id !== out.id ? [b.id] : [])]);
  if (!out.aliasIds.length && !a.aliasIds && !b.aliasIds) delete out.aliasIds;
  out.learning = clone(a.learning || b.learning || {});
  if (restore && b.learning) {
    out.learning = mergeFields(a.learning || {}, b.learning);
    for (const k of ['timesSeen', 'timesCorrect', 'typedSeen', 'typedCorrect', 'lastReviewed']) out.learning[k] = Math.max(a.learning?.[k] || 0, b.learning[k] || 0);
    const newer = (b.learning.lastReviewed || 0) > (a.learning?.lastReviewed || 0) ? b.learning : a.learning;
    if (newer) for (const k of ['confidence', 'nextReview']) if (newer[k] != null) out.learning[k] = newer[k];
  }
  out.fav = !!(a.fav || b.fav);
  if (!('fav' in a) && !('fav' in b)) delete out.fav;
  out.evidence = unique(a.evidence || [], b.evidence || []);
  if (!out.evidence.length && !a.evidence && !b.evidence) delete out.evidence;
  for (const k of ['dateAdded', 'createdAt', 'updatedAt']) if (a[k] != null) out[k] = a[k];
  return out;
}
export function reviewEntries(existing: Word[], incoming: Word[]) {
  const pool = [...existing];
  return incoming.map(raw => { const entry = normalizeEntry(raw); const c = classify(entry, pool); pool.push(entry); return { entry, ...c, action: c.kind === 'new' ? 'add' : 'skip', reason: '' }; });
}
export function applyImport(existing: Word[], rows: any[], restore = false) {
  const next = existing.map(normalizeEntry); let added = 0, upgraded = 0, skipped = 0;
  for (const r of rows) {
    if (r.action === 'skip') { skipped++; continue; }
    const entry = normalizeEntry(r.entry); const c = classify(entry, next);
    if (r.action === 'merge') {
      if (c.kind === 'near' || !c.match) throw new Error('Κοντινές λέξεις δεν συγχωνεύονται αυτόματα.');
      const i = next.findIndex((w: any) => w.id === c.match?.id); next[i] = safeMerge(next[i], entry, restore); upgraded++; continue;
    }
    if (c.kind === 'exact' || c.kind === 'mergeable') { skipped++; continue; }
    if (c.kind !== 'new' && !r.reason?.trim()) throw new Error('Χρειάζεται αιτιολόγηση για ξεχωριστή εγγραφή.');
    if (next.some((w: any) => w.id === entry.id)) entry.id = `${entry.id}-${hash(r.reason + JSON.stringify(entry))}`;
    if (r.reason) entry.distinctReason = r.reason;
    next.push(entry); added++;
  }
  return { next, added, upgraded, updated: upgraded, skipped };
}
export function parseImport(text: string) {
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) throw new Error('Το JSON υπερβαίνει το όριο 10 MiB.');
  let payload: any;
  try { payload = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('Μη έγκυρο JSON.'); }
  if (payload?.schemaVersion > 2) throw new Error('Νεότερη έκδοση backup· δεν μπορεί να αποκατασταθεί με ασφάλεια.');
  const state = payload?.state || payload;
  const vocab = Array.isArray(payload) ? payload : state?.vocab || state?.vocabulary || state?.words || (state?.word ? [state] : null);
  if (!Array.isArray(vocab) || vocab.length > MAX_WORDS) throw new Error('Αναμένονται έως 10.000 λέξεις.');
  const extras = !Array.isArray(payload) && !payload.word ? Object.fromEntries(Object.entries(payload).filter(([k]) => !['schemaVersion', 'format', 'exportedAt', 'state', 'vocab', 'vocabulary', 'words', 'meta'].includes(k))) : {};
  const stateExtras = state && !Array.isArray(state) && !state.word ? Object.fromEntries(Object.entries(state).filter(([k]) => !['vocab', 'vocabulary', 'words', 'meta', 'schemaVersion', 'format', 'exportedAt', 'state'].includes(k))) : {};
  return { vocab: vocab.map(normalizeEntry), meta: clone(state?.meta || {}), extras, stateExtras };
}
export function fullBackup(vocab: Word[], meta: Word, extras: Word = {}, stateExtras: Word = {}, timestamp = new Date().toISOString()) {
  return clone({ ...extras, format: 'wortwerk-full-backup', schemaVersion: 2, exportedAt: timestamp, state: { ...stateExtras, vocab, meta } });
}
export function vocabularyBackup(vocab: Word[]) { return fullBackup(vocab.map((w: any) => Object.fromEntries(Object.entries(w).filter(([k]) => !['learning', 'evidence', 'fav'].includes(k)))), {}, {}, {}, new Date().toISOString()); }
export function restoreState(current: any, parsed: any, decisions?: any[]) {
  if (!current.vocab.length) return { vocab: clone(parsed.vocab), meta: clone(parsed.meta), extras: clone(parsed.extras), stateExtras: clone(parsed.stateExtras), added: parsed.vocab.length, updated: 0 };
  const rows = decisions || reviewEntries(current.vocab, parsed.vocab).map(r => ({ ...r, action: ['exact', 'mergeable'].includes(r.kind) ? 'merge' : r.kind === 'new' ? 'add' : 'skip' }));
  const res = applyImport(current.vocab, rows, true);
  const meta = mergeFields(current.meta, parsed.meta);
  for (const k of ['xp', 'streak', 'totalStudyTimeMs']) if (k in current.meta || k in parsed.meta) meta[k] = Math.max(current.meta[k] || 0, parsed.meta[k] || 0);
  return { ...res, vocab: res.next, meta, extras: mergeFields(current.extras || {}, parsed.extras), stateExtras: mergeFields(current.stateExtras || {}, parsed.stateExtras) };
}
export const MASTERY_MIN_CONTEXTS = 4;
export const MASTERY_MIN_SUCCESSES = 4;
export const MASTERY_MIN_ACTIVITIES = 2;
export const MASTERY_MIN_DAYS = 3;
export const MASTERY_DELAYED_WINDOWS: readonly [number, number][] = [[1, 2], [3, 5], [7, 14]];
export const MASTERY_RETAINED_DAYS = 20;

function calendarDayNumber(ts: number): number {
  const d = new Date(ts);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

export function calendarDayDiff(fromTs: number, toTs: number): number {
  return calendarDayNumber(toTs) - calendarDayNumber(fromTs);
}

function canonicalContextKey(word: Word, e: any): string {
  const raw = String(e?.context || e?.prompt || '');
  if (raw.includes('______') && word?.exercise?.answer) {
    return normalizedWord(raw.replace('______', String(word.exercise.answer)));
  }
  return normalizedWord(raw);
}

export function isActiveRecallSuccess(word: Word, e: any): boolean {
  return !!(
    e &&
    e.category === 'recall/production' &&
    e.correct === true &&
    e.exact === true &&
    !e.hintUsed &&
    !e.neutral &&
    e.status !== 'synonym' &&
    e.verified !== false &&
    (!word?.article || e.articleCorrect === true)
  );
}

export function makeEvidence(word: Word, correct: boolean, opts: Word) {
  const mode = opts.mode || 'unknown';
  const timestamp = opts.timestamp ?? Date.now();
  const isNeutral = !!(opts.neutral || opts.status === 'synonym');
  const category = isNeutral
    ? 'unscored'
    : mode === 'flashcard'
      ? 'exposure'
      : mode === 'mc'
        ? 'recognition'
        : ['recall', 'fill', 'context', 'production'].includes(mode)
          ? 'recall/production'
          : 'unscored';
  return {
    id: opts.id || `${word.id}-${timestamp}-${Math.random().toString(36).slice(2)}`,
    wordId: word.id,
    timestamp,
    mode,
    contextId: opts.contextId || `${mode}:${opts.prompt || word.word}`,
    context: opts.context || opts.prompt || '',
    prompt: opts.prompt || '',
    answer: opts.answer ?? '',
    correct: mode === 'flashcard' || isNeutral ? null : correct,
    exact: isNeutral ? false : !!opts.exact,
    near: opts.status === 'near',
    neutral: isNeutral,
    status: opts.status || '',
    hintUsed: !!opts.hintUsed,
    articleCorrect: opts.articleCorrect ?? !word.article,
    responseTime: opts.responseTime ?? null,
    sessionId: opts.sessionId || '',
    category,
    selfRating: mode === 'flashcard' ? opts.selfRating || (correct ? 'Gut' : 'Nochmal') : null,
    newContext: !!opts.newContext,
    verified: mode !== 'production' || opts.verified === true,
  };
}

export function mastery(word: Word) {
  const all = [...(word.evidence || [])]
    .filter((e: any) => e && typeof e.timestamp === 'number' && Number.isFinite(e.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  const meaningful = all.filter((e: any) => e.contextId && e.prompt && e.answer !== '' && e.sessionId && e.category !== 'unscored' && !e.neutral && e.status !== 'synonym');
  // Repeating an identical prompt or simple fill/context duplicate cannot create a new context.
  const contextKey = (e: any) => canonicalContextKey(word, e);
  const active = meaningful.filter((e: any) => isActiveRecallSuccess(word, e));
  const activeContexts = new Set(active.map(contextKey).filter(Boolean)).size;
  const contexts = activeContexts;
  const successes = new Set(active.map((e: any) => `${e.mode}:${contextKey(e)}`)).size;
  const activities = new Set(active.map((e: any) => e.mode)).size;
  const days = new Set(active.map((e: any) => localDay(e.timestamp))).size;
  const typed = active.some((e: any) => ['recall', 'production'].includes(e.mode));
  const novel = active.some((e: any) => ['context', 'production'].includes(e.mode) && e.newContext && !all.some((p: any) => p.timestamp < e.timestamp && contextKey(p) === contextKey(e)));
  // Consecutive unassisted exact retrievals on different calendar days: 1–2d, 3–5d, 7–14d.
  const dated = active.filter((e: any, i: number) => !active.slice(0, i).some((p: any) => localDay(p.timestamp) === localDay(e.timestamp)));
  let delayed = 0;
  let chainEnd = 0;
  for (let start = 0; start < dated.length; start++) {
    let last = dated[start];
    let n = 0;
    for (const [lo, hi] of MASTERY_DELAYED_WINDOWS) {
      const next = dated.find((e: any) => {
        if (e.timestamp <= last.timestamp) return false;
        const diff = calendarDayDiff(last.timestamp, e.timestamp);
        return diff >= lo && diff <= hi;
      });
      if (!next) break;
      last = next;
      n++;
    }
    if (n > delayed || (n === delayed && n === MASTERY_DELAYED_WINDOWS.length && last.timestamp > chainEnd)) {
      delayed = n;
      chainEnd = last.timestamp;
    }
  }
  const latestFailure = all
    .filter(
      (e: any) =>
        e.category === 'recall/production' &&
        e.correct === false &&
        !e.neutral &&
        e.status !== 'synonym' &&
        all.some((p: any) => p.timestamp < e.timestamp && calendarDayDiff(p.timestamp, e.timestamp) >= 1 && p.correct && p.exact)
    )
    .at(-1);
  const failed = !!latestFailure && latestFailure.timestamp >= chainEnd;
  const requirements = {
    contexts: activeContexts >= MASTERY_MIN_CONTEXTS,
    successes: successes >= MASTERY_MIN_SUCCESSES,
    activities: activities >= MASTERY_MIN_ACTIVITIES,
    days: days >= MASTERY_MIN_DAYS,
    typed,
    novel,
    delayed: delayed >= MASTERY_DELAYED_WINDOWS.length,
    review: !failed,
  };
  const mastered = Object.values(requirements).every(Boolean);
  const retained =
    mastered &&
    active.some((e: any) => e.timestamp > chainEnd && calendarDayDiff(chainEnd, e.timestamp) >= MASTERY_RETAINED_DAYS) &&
    !failed;
  const level = retained
    ? 'Retained'
    : mastered
      ? 'Provisionally mastered'
      : successes >= 3 && activeContexts >= 3
        ? 'Consolidating'
        : meaningful.length || word.learning?.timesSeen
          ? 'Learning'
          : 'New';
  return { level, mastered, contexts, activeContexts, successes, activities, days, delayed, typed, novel, failed, requirements };
}

export type MasteryScheduleStage =
  | 'needs_active'
  | 'awaiting_step_1'
  | 'awaiting_step_2'
  | 'awaiting_step_3'
  | 'needs_criteria'
  | 'awaiting_retention'
  | 'retention_ready'
  | 'retained';

export interface MasteryScheduleState {
  stage: MasteryScheduleStage;
  inWindow: boolean;
  daysLeftInWindow: number | null;
  recommendedDays: number;
  chainStep: number;
}

const MASTERY_TARGET_STEP_DAYS: readonly number[] = [1, 3, 8];
const MASTERY_RETENTION_TARGET_DAYS = 21;
const MASTERY_RETAINED_MAINTENANCE_DAYS = 30;

export function masteryScheduleState(word: Word, nowTs = Date.now()): MasteryScheduleState {
  const m = mastery(word);
  if (m.level === 'Retained') {
    return {
      stage: 'retained',
      inWindow: false,
      daysLeftInWindow: null,
      recommendedDays: MASTERY_RETAINED_MAINTENANCE_DAYS,
      chainStep: MASTERY_DELAYED_WINDOWS.length,
    };
  }

  const all = [...(word?.evidence || [])]
    .filter((e: any) => e && typeof e.timestamp === 'number' && Number.isFinite(e.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  const meaningful = all.filter(
    (e: any) =>
      e.contextId &&
      e.prompt &&
      e.answer !== '' &&
      e.sessionId &&
      e.category !== 'unscored' &&
      !e.neutral &&
      e.status !== 'synonym'
  );
  const active = meaningful.filter((e: any) => isActiveRecallSuccess(word, e));
  const dated = active.filter(
    (e: any, i: number) => !active.slice(0, i).some((p: any) => localDay(p.timestamp) === localDay(e.timestamp))
  );

  const latestFailure = all
    .filter(
      (e: any) =>
        e.category === 'recall/production' &&
        e.correct === false &&
        !e.neutral &&
        e.status !== 'synonym' &&
        all.some((p: any) => p.timestamp < e.timestamp && calendarDayDiff(p.timestamp, e.timestamp) >= 1 && p.correct && p.exact)
    )
    .at(-1);

  if (m.mastered) {
    // Find latest completed 3-step delayed chain end timestamp
    let chainEnd = 0;
    for (let start = 0; start < dated.length; start++) {
      let last = dated[start];
      let n = 0;
      for (const [lo, hi] of MASTERY_DELAYED_WINDOWS) {
        const next = dated.find((e: any) => {
          if (e.timestamp <= last.timestamp) return false;
          const diff = calendarDayDiff(last.timestamp, e.timestamp);
          return diff >= lo && diff <= hi;
        });
        if (!next) break;
        last = next;
        n++;
      }
      if (n === MASTERY_DELAYED_WINDOWS.length && last.timestamp > chainEnd) {
        chainEnd = last.timestamp;
      }
    }
    const elapsed = chainEnd ? Math.max(0, calendarDayDiff(chainEnd, nowTs)) : 0;
    if (elapsed >= MASTERY_RETAINED_DAYS) {
      return {
        stage: 'retention_ready',
        inWindow: true,
        daysLeftInWindow: null,
        recommendedDays: 0,
        chainStep: MASTERY_DELAYED_WINDOWS.length,
      };
    }
    return {
      stage: 'awaiting_retention',
      inWindow: false,
      daysLeftInWindow: null,
      recommendedDays: Math.max(1, MASTERY_RETENTION_TARGET_DAYS - elapsed),
      chainStep: MASTERY_DELAYED_WINDOWS.length,
    };
  }

  // Only consider active dated successes after any unrecovered failure
  const failureCutoff = m.failed && latestFailure ? latestFailure.timestamp : -Infinity;
  const candidateDated = dated.filter((e: any) => e.timestamp > failureCutoff);
  if (!candidateDated.length) {
    return {
      stage: 'needs_active',
      inWindow: false,
      daysLeftInWindow: null,
      recommendedDays: 1,
      chainStep: 0,
    };
  }

  // Evaluate every candidate chain starting from candidateDated and keep the most advanced chain still alive at nowTs.
  let best: { n: number; lastTs: number } | null = null;
  for (let start = 0; start < candidateDated.length; start++) {
    let last = candidateDated[start];
    let n = 0;
    for (const [lo, hi] of MASTERY_DELAYED_WINDOWS) {
      const next = candidateDated.find((e: any) => {
        if (e.timestamp <= last.timestamp) return false;
        const diff = calendarDayDiff(last.timestamp, e.timestamp);
        return diff >= lo && diff <= hi;
      });
      if (!next) break;
      last = next;
      n++;
    }
    const elapsed = calendarDayDiff(last.timestamp, nowTs);
    if (n < MASTERY_DELAYED_WINDOWS.length) {
      const [, hi] = MASTERY_DELAYED_WINDOWS[n]!;
      if (elapsed > hi) continue; // Window already expired
    }
    if (!best || n > best.n || (n === best.n && last.timestamp > best.lastTs)) {
      best = { n, lastTs: last.timestamp };
    }
  }

  if (!best) {
    return {
      stage: 'needs_active',
      inWindow: false,
      daysLeftInWindow: null,
      recommendedDays: 1,
      chainStep: 0,
    };
  }

  if (best.n >= MASTERY_DELAYED_WINDOWS.length) {
    // Delayed chain is already satisfied, but another criterion (contexts/successes/recall/novel) is still missing.
    return {
      stage: 'needs_criteria',
      inWindow: true,
      daysLeftInWindow: null,
      recommendedDays: 1,
      chainStep: MASTERY_DELAYED_WINDOWS.length,
    };
  }

  const [lo, hi] = MASTERY_DELAYED_WINDOWS[best.n]!;
  const targetDays = MASTERY_TARGET_STEP_DAYS[best.n] ?? lo;
  const elapsed = Math.max(0, calendarDayDiff(best.lastTs, nowTs));
  const stage: MasteryScheduleStage =
    best.n === 0 ? 'awaiting_step_1' : best.n === 1 ? 'awaiting_step_2' : 'awaiting_step_3';

  if (elapsed >= lo && elapsed <= hi) {
    return {
      stage,
      inWindow: true,
      daysLeftInWindow: hi - elapsed,
      recommendedDays: 0,
      chainStep: best.n,
    };
  }

  return {
    stage,
    inWindow: false,
    daysLeftInWindow: null,
    recommendedDays: Math.max(1, targetDays - elapsed),
    chainStep: best.n,
  };
}

export function computeAlignedNextReview(
  word: Word,
  correct: boolean,
  fallbackMs: number,
  nowTs = Date.now()
): number {
  if (!correct) return nowTs + DAY;
  if (isPreviouslyKnown(word)) return nowTs + Math.max(DAY, fallbackMs);
  const sched = masteryScheduleState(word, nowTs);
  if (sched.inWindow && sched.recommendedDays === 0) {
    return nowTs;
  }
  const alignedMs = sched.recommendedDays * DAY;
  if (sched.stage === 'retained') {
    return nowTs + Math.max(alignedMs, fallbackMs);
  }
  return nowTs + alignedMs;
}

export const PREVIOUSLY_KNOWN_STATUS = 'previously_known' as const;
export const PREVIOUSLY_KNOWN_TEST_RATIO = 0.1;
export const PREVIOUSLY_KNOWN_DEMOTE_THRESHOLD = 2;

export function isPreviouslyKnown(word: Word): boolean {
  return word?.status === PREVIOUSLY_KNOWN_STATUS;
}

export function isMasteredThroughWortwerk(word: Word): boolean {
  return !isPreviouslyKnown(word) && mastery(word).mastered;
}

export function applyPreviouslyKnownSelection(vocab: Word[], selectedIds: Iterable<string>): Word[] {
  const chosen = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  return (vocab || []).map((w) => {
    const wantKnown = chosen.has(w.id);
    const currentlyKnown = isPreviouslyKnown(w);
    if (wantKnown && !currentlyKnown) {
      return { ...w, status: PREVIOUSLY_KNOWN_STATUS, previouslyKnownMistakes: 0 };
    }
    if (!wantKnown && currentlyKnown) {
      const next = { ...w };
      delete next.status;
      delete next.previouslyKnownMistakes;
      return next;
    }
    return w;
  });
}

export function updatePreviouslyKnownOnAnswer(
  word: Word,
  correct: boolean,
  opts?: { neutral?: boolean; status?: string; exact?: boolean; threshold?: number }
): Word {
  if (!isPreviouslyKnown(word)) return word;
  if (opts?.neutral || opts?.status === 'synonym') return word;
  const threshold = Math.max(1, opts?.threshold ?? PREVIOUSLY_KNOWN_DEMOTE_THRESHOLD);
  if (correct) {
    if (!word.previouslyKnownMistakes) return word;
    return { ...word, previouslyKnownMistakes: 0 };
  }
  const mistakes = (Number(word.previouslyKnownMistakes) || 0) + 1;
  if (mistakes >= threshold) {
    const next = { ...word };
    delete next.status;
    delete next.previouslyKnownMistakes;
    return next;
  }
  return { ...word, previouslyKnownMistakes: mistakes };
}
export function localDay(ts: number) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function todayAccuracy(word: Word, timestamp = Date.now()) {
  const scored = (word.evidence || []).filter((e: any) => !e?.neutral && e?.status !== 'synonym' && localDay(e.timestamp) === localDay(timestamp) && ['recognition', 'recall/production'].includes(e.category));
  return { attempts: scored.length, pct: scored.length ? scored.filter((e: any) => e.correct && e.exact && !e.hintUsed).length / scored.length : 0 };
}
export function isMasteredToday(word: Word, timestamp = Date.now()) {
  const t = todayAccuracy(word, timestamp);
  return t.attempts >= 5 && t.pct >= 0.9;
}
export function todayWordProgress(word: Word, timestamp = Date.now()) {
  if (isMasteredToday(word, timestamp)) return 1;
  const t = todayAccuracy(word, timestamp);
  if (t.attempts > 0) return Math.min(0.95, (Math.min(t.attempts, 5) / 5) * t.pct);
  const day = localDay(timestamp);
  const exposedToday = (word.evidence || []).some((e: any) => localDay(e.timestamp) === day && e.category === 'exposure' && e.selfRating !== 'Nochmal');
  return exposedToday ? 0.08 : 0;
}
export function todayBatchProgress(words: Word[], timestamp = Date.now()) {
  const total = words.length;
  const completed = words.filter((w) => isMasteredToday(w, timestamp)).length;
  if (!total) return { completed: 0, total: 0, pct: 0 };
  if (completed === total) return { completed, total, pct: 100 };
  const sum = words.reduce((acc, w) => acc + todayWordProgress(w, timestamp), 0);
  return { completed, total, pct: Math.min(99, Math.round((sum / total) * 100)) };
}

function leadingArticleDe(s: any) {
  const m = String(s || '').trim().match(/^(der|die|das)\s+/i);
  return m?.[1]?.toLowerCase() || '';
}
function coreFormDe(s: any) {
  let t = String(s || '').trim().replace(/\s+/g, ' ').replace(/[.,;:!?]+$/g, '');
  t = t.replace(/\s*\/\s*/g, ' ');
  t = t.replace(/^(der|die|das)\s+/i, '');
  t = t.replace(/^sich\s+/i, '');
  return t;
}
function foldGerman(s: any) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
}
function foldGreek(s: any) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ς/g, 'σ').trim();
}
function classifyNearReason(iCore: string, tCore: string): 'umlaut' | 'eszett' | 'typo' {
  const il = iCore.toLocaleLowerCase('de');
  const tl = tCore.toLocaleLowerCase('de');
  const stripUmlauts = (s: string) => s.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
  const stripEszett = (s: string) => s.replace(/ß/g, 'ss');
  if (stripEszett(il) === stripEszett(tl) && il !== tl) return 'eszett';
  if (stripUmlauts(il) === stripUmlauts(tl) && il !== tl) return 'umlaut';
  if (foldGerman(il) === foldGerman(tl)) return 'umlaut';
  return 'typo';
}
export function compareTyped(input: any, target: any): 'empty' | 'exact' | 'near' | 'wrong' {
  const i = coreFormDe(input), t = coreFormDe(target);
  if (!i) return 'empty';
  if (i.toLocaleLowerCase('de') === t.toLocaleLowerCase('de')) return 'exact';
  const fi = foldGerman(i), ft = foldGerman(t);
  if (fi === ft) return 'near';
  if (ft.length >= 5 && distance(fi, ft) <= 1) return 'near';
  return 'wrong';
}
export function checkTyped(input: any, w: Word, allWords?: Word[]) {
  const raw = String(input || '').trim();
  if (!raw) return { status: 'empty' };
  const targetArt = leadingArticleDe(w.word) || String(w.article || '').toLowerCase();
  const inArt = leadingArticleDe(raw);
  const base = compareTyped(raw, w.word);
  if (base === 'exact' || base === 'near') {
    if (targetArt && inArt && inArt !== targetArt) return { status: 'article', article: targetArt };
    if (targetArt && !inArt) return { status: 'near', note: 'article' };
    return { status: base };
  }
  const key = foldGerman(coreFormDe(raw));
  const syns: any[] = w.synonyms || [];
  if (syns.some((s) => foldGerman(coreFormDe(s)) === key)) return { status: 'synonym' };
  if (allWords) {
    const mine = ((w.meaning && w.meaning.greek) || []).map(foldGreek);
    const other = allWords.find((o) => o.word !== w.word && foldGerman(coreFormDe(o.word)) === key);
    if (other && ((other.meaning && other.meaning.greek) || []).map(foldGreek).some((g: string) => mine.indexOf(g) > -1)) {
      return { status: 'synonym' };
    }
  }
  return { status: 'wrong' };
}
export type TypedDiagnosis = {
  status: 'empty' | 'exact' | 'near' | 'article' | 'synonym' | 'wrong';
  note?: 'article';
  reason?: 'umlaut' | 'eszett' | 'typo' | 'article_missing' | 'article_wrong' | 'lemma' | 'synonym';
  article?: string;
  inputArticle?: string;
  isReflexiveMissing?: boolean;
};
export function diagnoseTyped(
  input: any,
  w: Word,
  opts?: { target?: string; allWords?: Word[]; contextArticle?: string; requireContextArticle?: boolean }
): TypedDiagnosis {
  const raw = String(input || '').trim();
  if (!raw) return { status: 'empty' };
  const target = opts?.target ?? w.word;
  const isFill = opts?.target != null;

  if (!isFill) {
    const res = checkTyped(raw, w, opts?.allWords);
    const inArt = leadingArticleDe(raw);
    const targetArt = leadingArticleDe(w.word) || String(w.article || '').toLowerCase();
    if (res.status === 'article') return { status: 'article', article: res.article || targetArt, inputArticle: inArt, reason: 'article_wrong' };
    if (res.status === 'near' && res.note === 'article') return { status: 'near', note: 'article', reason: 'article_missing', article: targetArt };
    if (res.status === 'near') return { status: 'near', reason: classifyNearReason(coreFormDe(raw), coreFormDe(w.word)) };
    if (res.status === 'synonym') return { status: 'synonym', reason: 'synonym' };
    if (res.status === 'exact') {
      const isReflexiveMissing = /^sich\s+/i.test(String(w.word || '')) && !/^sich\s+/i.test(raw);
      return isReflexiveMissing ? { status: 'exact', isReflexiveMissing: true } : { status: 'exact' };
    }
    return { status: 'wrong' };
  }

  const base = compareTyped(raw, target);
  if (opts?.requireContextArticle && w.article && (base === 'exact' || base === 'near')) {
    const targetArt = String(w.article).toLowerCase();
    const chosenArt = String(opts.contextArticle || '').toLowerCase();
    if (!chosenArt) return { status: 'near', note: 'article', reason: 'article_missing', article: targetArt };
    if (chosenArt !== targetArt) return { status: 'article', article: targetArt, inputArticle: chosenArt, reason: 'article_wrong' };
  }
  if (base === 'exact') return { status: 'exact' };
  if (base === 'near') return { status: 'near', reason: classifyNearReason(coreFormDe(raw), coreFormDe(target)) };
  if (compareTyped(raw, w.word) === 'exact') return { status: 'wrong', reason: 'lemma' };
  const key = foldGerman(coreFormDe(raw));
  if ((w.synonyms || []).some((s: any) => foldGerman(coreFormDe(s)) === key)) return { status: 'wrong', reason: 'synonym' };
  return { status: 'wrong' };
}

// Display-only family resolution: use explicit membership, never guess from spelling.
export function familyGroups(word: Word): Record<string, Word[]> {
  const seen = new Set<string>();
  const clean = (items: Word) => (Array.isArray(items) ? items : []).filter(item => {
    if (!item || typeof item.word !== 'string') return false;
    const key = normalizedWord(item.word);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const groups = Object.fromEntries(['verbs', 'nouns', 'adjectives'].map(k => [k, clean(word.family?.[k])]));
  if (!Object.values(groups).some(items => items.length)) groups['verbs'] = clean(word.prefixFamily);
  return groups;
}
export function familyMembers(word: Word): Word[] {
  return Object.values(familyGroups(word)).flat();
}
export function resolveWordFamily(word: Word, vocab: Word[]): Word | undefined {
  if (familyMembers(word).length > 1) return word;
  const key = normalizedWord(word.word);
  return vocab.find(owner => familyMembers(owner).length > 1 && familyMembers(owner).some(member => normalizedWord(member.word) === key));
}

export function familyCatalogue(vocab: Word[], query = '', sort = 'az'): Word[] {
  const owners = new Map<string, Word>();
  for (const word of vocab) {
    const members = familyMembers(word);
    if (members.length < 2) continue;
    const key = normalizedWord(word.stem || word.word);
    const previous = owners.get(key);
    if (!previous || familyMembers(previous).length < members.length) owners.set(key, word);
  }
  const q = normalizedWord(query);
  const name = (w: Word) => w.stem || w.word;
  return [...owners.values()].filter(w => !q || normalizedWord(name(w)).includes(q) || familyMembers(w).some(m => normalizedWord(m.word).includes(q)))
    .sort((a, b) => (sort === 'size' ? familyMembers(b).length - familyMembers(a).length : 0) || (sort === 'za' ? -1 : 1) * name(a).localeCompare(name(b), 'de'));
}

export type XpTimelinePoint = {
  date: string;
  day: string;
  xp: number;
  sessions: number;
  isToday: boolean;
};

export function weeklyXpTimeline(sessionLogs: any[] = [], nowTs = Date.now()): XpTimelinePoint[] {
  const days: XpTimelinePoint[] = [];
  const byDate = new Map<string, XpTimelinePoint>();
  for (let offset = 6; offset >= 0; offset--) {
    const iso = new Date(nowTs - offset * DAY).toISOString().slice(0, 10);
    const point: XpTimelinePoint = {
      date: iso,
      day: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      xp: 0,
      sessions: 0,
      isToday: offset === 0,
    };
    days.push(point);
    byDate.set(iso, point);
  }
  for (const log of sessionLogs || []) {
    if (!log || typeof log.date !== 'string') continue;
    const bucket = byDate.get(log.date);
    if (!bucket) continue;
    const xp = typeof log.xp === 'number'
      ? Math.max(0, log.xp)
      : (log.kind === 'intensive' ? (log.correct || 0) * 15 : (log.correct || 0) * 10);
    bucket.xp += xp;
    bucket.sessions += 1;
  }
  return days;
}

export type LearningRateCriterion = 'assimilated' | 'mastered' | 'started';

export type LearningTimelineEntry = {
  id: string;
  word: string;
  greek: string;
  cefr: string;
  type: string;
  level: string;
  timestamp: number;
};

export type LearningRateDayPoint = {
  date: string;
  day: string;
  count: number;
  cumulative: number;
  words: string[];
  entries: LearningTimelineEntry[];
  isToday: boolean;
};

export type LearningRateSummary = {
  criterion: LearningRateCriterion;
  windowDays: number;
  totalWords: number;
  ratePerDay: number;
  activeDays: number;
  activeDayRate: number;
  last7dCount: number;
  prev7dCount: number;
  remainingWords: number;
  estimatedDaysRemaining: number | null;
  days: LearningRateDayPoint[];
};

export function wordAssimilationTimestamp(word: Word, criterion: LearningRateCriterion = 'assimilated'): number | null {
  const sorted = [...(word?.evidence || [])]
    .filter((e: any) => e && typeof e.timestamp === 'number' && Number.isFinite(e.timestamp))
    .sort((a: any, b: any) => a.timestamp - b.timestamp);
  if (!sorted.length) return null;

  const isMeaningful = (e: any) => !!(e.contextId && e.prompt && e.answer !== '' && e.sessionId && e.category !== 'unscored');
  const meaningful = sorted.filter(isMeaningful);
  if (!meaningful.length) return null;

  if (criterion === 'started') {
    return meaningful[0].timestamp;
  }

  if (criterion === 'assimilated') {
    const activeKeys = new Set<string>();
    const activeContextKeys = new Set<string>();
    for (const e of meaningful) {
      if (isActiveRecallSuccess(word, e)) {
        const ck = canonicalContextKey(word, e);
        if (!ck) continue;
        activeKeys.add(`${e.mode}:${ck}`);
        activeContextKeys.add(ck);
        if (activeKeys.size >= 3 && activeContextKeys.size >= 3) return e.timestamp;
      }
    }
    return null;
  }

  if (!mastery(word).mastered) return null;
  let masteredAt: number | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (e.category !== 'recall/production') continue;
    const ok = mastery({ ...word, evidence: sorted.slice(0, i + 1) }).mastered;
    if (ok && masteredAt === null) masteredAt = e.timestamp;
    else if (!ok) masteredAt = null;
  }
  return masteredAt;
}

export function learningRate30d(
  vocab: Word[] = [],
  nowTs = Date.now(),
  criterion: LearningRateCriterion = 'assimilated',
  windowDays = 30
): LearningRateSummary {
  const safeDays = Math.max(1, Math.floor(windowDays));
  const days: LearningRateDayPoint[] = [];
  const byDate = new Map<string, LearningRateDayPoint>();

  for (let offset = safeDays - 1; offset >= 0; offset--) {
    const iso = localDay(nowTs - offset * DAY);
    const point: LearningRateDayPoint = {
      date: iso,
      day: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      count: 0,
      cumulative: 0,
      words: [],
      entries: [],
      isToday: offset === 0,
    };
    days.push(point);
    byDate.set(iso, point);
  }

  let totalReachedAllTime = 0;
  let eligibleTotal = 0;
  for (const w of vocab || []) {
    if (!w || isPreviouslyKnown(w)) continue;
    eligibleTotal++;
    const ts = wordAssimilationTimestamp(w, criterion);
    if (ts == null) continue;
    totalReachedAllTime++;
    const bucket = byDate.get(localDay(ts));
    if (!bucket) continue;
    bucket.count += 1;
    if (typeof w.word === 'string' && w.word) {
      bucket.words.push(w.word);
      bucket.entries.push({
        id: String(w.id || w.word),
        word: w.word,
        greek: list(w.meaning?.greek).filter(Boolean).slice(0, 2).join(', '),
        cefr: String(w.cefr || ''),
        type: String(w.type || ''),
        level: mastery(w).level,
        timestamp: ts,
      });
    }
  }

  let running = 0;
  for (const d of days) {
    running += d.count;
    d.cumulative = running;
    d.entries.sort((a, b) => a.timestamp - b.timestamp || a.word.localeCompare(b.word, 'de'));
  }

  const totalWords = running;
  const activeDays = days.filter((d) => d.count > 0).length;
  const ratePerDay = Number((totalWords / safeDays).toFixed(2));
  const activeDayRate = activeDays > 0 ? Number((totalWords / activeDays).toFixed(2)) : 0;
  const last7dCount = days.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const prev7dCount = days.slice(-14, -7).reduce((sum, d) => sum + d.count, 0);
  const remainingWords = Math.max(0, eligibleTotal - totalReachedAllTime);
  const estimatedDaysRemaining = ratePerDay > 0 && remainingWords > 0 ? Math.ceil(remainingWords / ratePerDay) : null;

  return {
    criterion,
    windowDays: safeDays,
    totalWords,
    ratePerDay,
    activeDays,
    activeDayRate,
    last7dCount,
    prev7dCount,
    remainingWords,
    estimatedDaysRemaining,
    days,
  };
}

export type PracticeScope = 'all' | 'b2';
export type PracticeGame = 'flashcard' | 'mc' | 'fill' | 'context' | 'recall';
export const ALL_PRACTICE_GAMES: readonly PracticeGame[] = ['flashcard', 'mc', 'fill', 'context', 'recall'];

export type PracticeQuestion = {
  word: Word;
  type: PracticeGame;
  newContext?: boolean;
  context?: string;
};

export function secureRandom(): number {
  const c = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return (buf[0] ?? 0) / 4294967296;
  }
  return Math.random();
}

export function trueShuffle<T>(arr: readonly T[], rng: () => number = secureRandom): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const raw = rng();
    const clamped = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 0.999999999999) : 0;
    const j = Math.floor(clamped * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export function isB2Word(word: Word): boolean {
  return /^b2(\b|[.\s/+-]|$)/i.test(String(word?.cefr || '').trim());
}

export function filterVocabByPracticeScope(vocab: Word[] = [], scope: PracticeScope = 'all'): Word[] {
  if (scope === 'b2') return (vocab || []).filter(isB2Word);
  return [...(vocab || [])];
}

export function hasFillExercise(word: Word): boolean {
  const ex = word?.exercise;
  return !!(ex && typeof ex.sentence === 'string' && ex.sentence.includes('______') && ex.answer);
}

const SEPARABLE_PREFIXES = [
  'zusammen', 'wieder', 'zurück', 'weiter', 'vorbei', 'heraus', 'herein', 'hinaus', 'hinein',
  'voraus', 'dazu', 'fest', 'frei', 'heim', 'hoch', 'klar', 'teil', 'nach', 'über', 'unter',
  'durch', 'statt', 'vor', 'weg', 'aus', 'auf', 'ein', 'mit', 'hin', 'her', 'los', 'bei',
  'ab', 'an', 'um', 'zu',
] as const;

function buildSingleBareMatchers(bare: string): RegExp[] {
  if (!bare) return [];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pats: RegExp[] = [
    new RegExp(
      `(?<![A-Za-zÄÖÜäöüß])(${esc(bare)}(?:e|en|er|es|em|n|s|t|st|te|ten)?)(?![A-Za-zÄÖÜäöüß])`,
      'i'
    ),
  ];
  const lowerBare = bare.toLocaleLowerCase('de');
  if (!bare.includes(' ')) {
    if (lowerBare.endsWith('en') && bare.length > 4) {
      const stem = bare.slice(0, -2);
      pats.push(
        new RegExp(
          `(?<![A-Za-zÄÖÜäöüß])((?:ge)?${esc(stem)}(?:e|st|est|t|et|en|te|ten|test|tet|ete|eten|etest|etet|end|ende|enden|endes|endem|er|es|em)?)(?![A-Za-zÄÖÜäöüß])`,
          'i'
        )
      );
      for (const prefix of SEPARABLE_PREFIXES) {
        if (lowerBare.startsWith(prefix) && stem.length > prefix.length + 2) {
          const rest = stem.slice(prefix.length);
          pats.push(
            new RegExp(
              `(?<![A-Za-zÄÖÜäöüß])(${esc(prefix)}(?:ge${esc(rest)}(?:t|et|en|e|er|es|em)?|zu${esc(rest)}en))(?![A-Za-zÄÖÜäöüß])`,
              'i'
            )
          );
          break;
        }
      }
    } else if (lowerBare.endsWith('n') && bare.length > 4) {
      const stem = bare.slice(0, -1);
      pats.push(
        new RegExp(
          `(?<![A-Za-zÄÖÜäöüß])((?:ge)?${esc(stem)}(?:e|st|t|n|te|ten|et|ete|eten)?)(?![A-Za-zÄÖÜäöüß])`,
          'i'
        )
      );
    }
  }
  return pats;
}

function buildContextMatchers(word: Word): RegExp[] {
  const raw = String(word?.word || '').trim();
  if (!raw) return [];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripPrefixes = (s: string) =>
    s
      .trim()
      .replace(/^(?:der\/die|die\/der|der|die|das)\s+/i, '')
      .replace(/^sich(?:\s+(?:etwas|jemanden|jemandem))?\s+/i, '')
      .trim();
  const variants = raw.includes('/')
    ? raw
        .replace(/^(?:der\/die|die\/der)\s+/i, '')
        .split('/')
        .map(stripPrefixes)
        .filter((v) => v.length >= 2)
    : [stripPrefixes(raw)].filter(Boolean);

  const pats: RegExp[] = [];
  for (const v of variants) {
    pats.push(...buildSingleBareMatchers(v));
  }
  if (word?.plural && typeof word.plural === 'string') {
    const pl = word.plural.replace(/^(die|der|das)\s+/i, '').trim();
    if (pl.length >= 3 && !pl.startsWith('-') && !pl.includes(' ')) {
      pats.push(
        new RegExp(`(?<![A-Za-zÄÖÜäöüß])(${esc(pl)}(?:n|s|en)?)(?![A-Za-zÄÖÜäöüß])`, 'i')
      );
    }
  }
  return pats;
}

export function findAllContextExamples(
  word: Word
): { sentence: string; answer: string; context: string; key: string }[] {
  const pats = buildContextMatchers(word);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fillFullKey = hasFillExercise(word)
    ? normalizedWord(String(word.exercise.sentence).replace(/_{3,}/g, String(word.exercise.answer)))
    : '';
  const examples = Array.isArray(word?.examples) ? word.examples : [];
  const seenKeys = new Set<string>();
  const out: { sentence: string; answer: string; context: string; key: string }[] = [];

  for (const ex of examples) {
    const de = typeof ex?.de === 'string' ? ex.de.trim() : '';
    if (!de) continue;
    const key = normalizedWord(de);
    if (!key || seenKeys.has(key) || (fillFullKey && key === fillFullKey)) continue;

    // Optional explicit target token/phrase (useful for multi-word expressions)
    if (typeof ex?.target === 'string' && ex.target.trim()) {
      const targetPat = new RegExp(
        `(?<![A-Za-zÄÖÜäöüß])(${esc(ex.target.trim())})(?![A-Za-zÄÖÜäöüß])`,
        'i'
      );
      const tMatch = de.match(targetPat);
      if (tMatch && tMatch[1]) {
        seenKeys.add(key);
        out.push({
          sentence: de.replace(targetPat, '______'),
          answer: tMatch[1],
          context: de,
          key,
        });
        continue;
      }
    }

    for (const pat of pats) {
      const match = de.match(pat);
      if (match && match[1]) {
        seenKeys.add(key);
        out.push({
          sentence: de.replace(pat, '______'),
          answer: match[1],
          context: de,
          key,
        });
        break;
      }
    }
  }
  return out;
}

export function mergeSeedEnrichments(stored: Word, seed: Word): Word {
  if (!seed) return stored;
  const out: Word = { ...stored };
  if (!out.memoryHook && seed.memoryHook) out.memoryHook = seed.memoryHook;
  if (!out.funFact && seed.funFact) out.funFact = seed.funFact;
  if (!out.etymology && seed.etymology) out.etymology = seed.etymology;

  const existingExamples = Array.isArray(out.examples) ? out.examples : [];
  const seedExamples = Array.isArray(seed.examples) ? seed.examples : [];
  if (seedExamples.length) {
    const existingKeys = new Set(
      existingExamples
        .map((e: any) => (typeof e?.de === 'string' ? normalizedWord(e.de) : ''))
        .filter(Boolean)
    );
    const mergedExamples = existingExamples.map((ex: any) => {
      if (ex?.target || typeof ex?.de !== 'string') return ex;
      const exKey = normalizedWord(ex.de);
      const seedMatch = seedExamples.find(
        (se: any) => typeof se?.de === 'string' && normalizedWord(se.de) === exKey && se.target
      );
      return seedMatch ? { ...ex, target: seedMatch.target } : ex;
    });
    for (const se of seedExamples) {
      const key = typeof se?.de === 'string' ? normalizedWord(se.de) : '';
      if (key && !existingKeys.has(key)) {
        existingKeys.add(key);
        mergedExamples.push(se);
      }
    }
    if (mergedExamples.length !== existingExamples.length || JSON.stringify(mergedExamples) !== JSON.stringify(existingExamples)) {
      out.examples = mergedExamples;
    }
  }

  const storedHasValidFill = !!(
    out.exercise &&
    typeof out.exercise.sentence === 'string' &&
    out.exercise.sentence.includes('______') &&
    out.exercise.answer
  );
  if (!storedHasValidFill && seed.exercise && seed.exercise.sentence && seed.exercise.answer) {
    out.exercise = { ...seed.exercise };
  }
  return out;
}

export function findContextExample(
  word: Word
): { sentence: string; answer: string; context: string; isNovel: boolean } | null {
  const candidates = findAllContextExamples(word);
  if (!candidates.length) return null;

  const evidenceList = Array.isArray(word?.evidence) ? word.evidence : [];
  const seenContexts = new Set<string>();
  const succeededContexts = new Set<string>();
  const lastSeenByKey = new Map<string, number>();

  for (const e of evidenceList) {
    const ck = canonicalContextKey(word, e);
    if (!ck) continue;
    seenContexts.add(ck);
    if (typeof e?.timestamp === 'number' && Number.isFinite(e.timestamp)) {
      const prev = lastSeenByKey.get(ck) ?? -Infinity;
      if (e.timestamp > prev) lastSeenByKey.set(ck, e.timestamp);
    }
    if (isActiveRecallSuccess(word, e)) {
      succeededContexts.add(ck);
    }
  }

  // 1. Prefer a genuinely novel example never seen in evidence
  const novelCandidate = candidates.find((c) => !seenContexts.has(c.key));
  if (novelCandidate) {
    return {
      sentence: novelCandidate.sentence,
      answer: novelCandidate.answer,
      context: novelCandidate.context,
      isNovel: true,
    };
  }

  // 2. Otherwise prefer a real example not yet actively succeeded
  const unsucceeded = candidates.find((c) => !succeededContexts.has(c.key));
  if (unsucceeded) {
    return {
      sentence: unsucceeded.sentence,
      answer: unsucceeded.answer,
      context: unsucceeded.context,
      isNovel: false,
    };
  }

  // 3. Fallback: least-recently-used real example
  const oldest = [...candidates].sort(
    (a, b) => (lastSeenByKey.get(a.key) ?? 0) - (lastSeenByKey.get(b.key) ?? 0)
  )[0]!;
  return {
    sentence: oldest.sentence,
    answer: oldest.answer,
    context: oldest.context,
    isNovel: false,
  };
}

export function eligibleGamesForWord(
  word: Word,
  candidateGames: readonly PracticeGame[] = ALL_PRACTICE_GAMES
): PracticeGame[] {
  const out: PracticeGame[] = [];
  for (const g of candidateGames) {
    if (g === 'fill' && !hasFillExercise(word)) continue;
    if (g === 'context' && !findContextExample(word)) continue;
    out.push(g);
  }
  return out.length ? out : ['recall'];
}

export function buildPracticeQuestion(word: Word, requestedGame: PracticeGame): PracticeQuestion {
  let t: PracticeGame = requestedGame;
  if (t === 'fill' && !hasFillExercise(word)) {
    t = 'recall';
  }
  if (t === 'context') {
    const ctxEx = findContextExample(word);
    if (!ctxEx) return { word, type: 'recall' };
    return {
      word: { ...word, exercise: { sentence: ctxEx.sentence, answer: ctxEx.answer } },
      type: 'context',
      newContext: ctxEx.isNovel,
      context: ctxEx.context,
    };
  }
  return { word, type: t };
}

export function preferredActiveGameForWord(
  word: Word,
  allowedGames: readonly PracticeGame[] = ['recall', 'fill', 'context']
): PracticeGame {
  const activeAllowed = allowedGames.filter((g) => g === 'recall' || g === 'fill' || g === 'context');
  const canRecall = activeAllowed.includes('recall');
  const canFill = activeAllowed.includes('fill') && hasFillExercise(word);
  const ctxEx = activeAllowed.includes('context') ? findContextExample(word) : null;
  const canContext = ctxEx !== null;

  const m = mastery(word);
  // 1. Prioritize missing typed Recall criterion
  if (!m.typed && canRecall) return 'recall';
  // 2. Prioritize genuinely novel Context example when needed or available
  if (!m.novel && ctxEx?.isNovel) return 'context';

  // 3. Check whether the Fill context has already been actively succeeded
  const evidenceList = Array.isArray(word?.evidence) ? word.evidence : [];
  const activeSucceededKeys = new Set(
    evidenceList
      .filter((e: any) => isActiveRecallSuccess(word, e))
      .map((e: any) => canonicalContextKey(word, e))
      .filter(Boolean)
  );
  if (canFill) {
    const fillKey = normalizedWord(
      String(word.exercise.sentence).replace(/_{3,}/g, String(word.exercise.answer))
    );
    if (fillKey && !activeSucceededKeys.has(fillKey)) return 'fill';
  }
  if (ctxEx?.isNovel) return 'context';
  if (canContext && ctxEx) {
    const ctxKey = normalizedWord(ctxEx.context);
    if (ctxKey && !activeSucceededKeys.has(ctxKey)) return 'context';
  }
  if (canRecall) return 'recall';
  if (canContext) return 'context';
  if (canFill) return 'fill';
  return 'recall';
}

export function sortWordsByReviewPriority(
  words: Word[],
  nowTs = Date.now(),
  rng: () => number = secureRandom
): Word[] {
  if (!words || !words.length) return [];
  const shuffled = trueShuffle(words, rng);
  const urgencyScore = (w: Word): number => {
    const sched = masteryScheduleState(w, nowTs);
    if (sched.inWindow) {
      if (sched.daysLeftInWindow !== null) {
        // Expiring delayed window: 0 days left -> score 0, 1 day left -> score 1, ...
        return sched.daysLeftInWindow;
      }
      if (sched.stage === 'retention_ready') return 20;
      if (sched.stage === 'needs_criteria') return 25;
    }
    return 100 + Math.min(10, Number(w?.learning?.confidence ?? 0));
  };
  return shuffled
    .map((word, index) => ({ word, score: urgencyScore(word), index }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((item) => item.word);
}

export function buildAllGamesQuestions(
  words: Word[],
  opts?: {
    games?: readonly PracticeGame[];
    rng?: () => number;
    shuffleOrder?: boolean;
    prioritizeMasteryWindows?: boolean;
    nowTs?: number;
  }
): PracticeQuestion[] {
  if (!words || !words.length) return [];
  const rng = opts?.rng ?? secureRandom;
  const nowTs = opts?.nowTs ?? Date.now();
  const candidateGames = opts?.games?.length ? [...opts.games] : [...ALL_PRACTICE_GAMES];
  const assigned: (PracticeGame | null)[] = words.map(() => null);
  const unassigned = new Set<number>(words.map((_, i) => i));

  // When prioritizing mastery windows (daily/mix review), lock words inside an open mastery/retention window
  // to an active recall exercise that advances their Evidence Ledger.
  if (opts?.prioritizeMasteryWindows) {
    for (let i = 0; i < words.length; i++) {
      const w = words[i]!;
      if (isPreviouslyKnown(w)) continue;
      if (masteryScheduleState(w, nowTs).inWindow) {
        assigned[i] = preferredActiveGameForWord(w, candidateGames);
        unassigned.delete(i);
      }
    }
  }

  // Assign rarer/constrained games first (context, fill) in random order, then remaining games in random order,
  // guaranteeing that every eligible game appears whenever enough eligible words exist.
  const constrained = trueShuffle(
    candidateGames.filter((g) => g === 'context' || g === 'fill'),
    rng
  );
  const open = trueShuffle(
    candidateGames.filter((g) => g !== 'context' && g !== 'fill'),
    rng
  );

  for (const game of [...constrained, ...open]) {
    if (assigned.includes(game)) continue;
    const eligibleIndices = [...unassigned].filter((idx) => {
      const w = words[idx];
      if (game === 'fill') return hasFillExercise(w);
      if (game === 'context') return findContextExample(w) !== null;
      return true;
    });
    if (!eligibleIndices.length) continue;
    const raw = rng();
    const clamped = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 0.999999999999) : 0;
    const chosenIdx = eligibleIndices[Math.floor(clamped * eligibleIndices.length)]!;
    assigned[chosenIdx] = game;
    unassigned.delete(chosenIdx);
  }

  for (const idx of unassigned) {
    const eligible = eligibleGamesForWord(words[idx], candidateGames);
    const raw = rng();
    const clamped = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 0.999999999999) : 0;
    assigned[idx] = eligible[Math.floor(clamped * eligible.length)]!;
  }

  const questions = words.map((w, i) => buildPracticeQuestion(w, assigned[i] ?? 'recall'));
  return opts?.shuffleOrder === false ? questions : trueShuffle(questions, rng);
}

export function pickRandomTestWords(
  pool: Word[],
  count = 20,
  rng: () => number = secureRandom
): Word[] {
  if (!pool || !pool.length || count <= 0) return [];
  const totalCount = Math.min(count, pool.length);
  const regular = pool.filter((w) => !isPreviouslyKnown(w));
  const known = pool.filter(isPreviouslyKnown);
  if (!known.length || !regular.length) {
    return trueShuffle(pool, rng).slice(0, totalCount);
  }

  // Reserve ~10% of test questions for previously_known words
  const exactKnown = totalCount * PREVIOUSLY_KNOWN_TEST_RATIO;
  const baseKnown = Math.floor(exactKnown);
  const fracKnown = exactKnown - baseKnown;
  const rawRoll = rng();
  const clampedRoll = Number.isFinite(rawRoll) ? Math.min(Math.max(rawRoll, 0), 0.999999999999) : 0;
  let desiredKnown = baseKnown + (clampedRoll < fracKnown ? 1 : 0);
  desiredKnown = Math.min(desiredKnown, known.length);

  const regularCount = Math.min(regular.length, totalCount - desiredKnown);
  const knownCount = Math.min(known.length, totalCount - regularCount);

  const pickedRegular = trueShuffle(regular, rng).slice(0, regularCount);
  const pickedKnown = trueShuffle(known, rng).slice(0, knownCount);
  return trueShuffle([...pickedRegular, ...pickedKnown], rng);
}

export type B2StageKey = 'New' | 'Learning' | 'Consolidating' | 'Provisionally mastered' | 'Retained';

export type B2GameMetric = {
  mode: PracticeGame;
  label: string;
  attempts: number;
  correct: number;
  accuracy: number;
  isExposure: boolean;
};

export type B2PosMetric = {
  type: string;
  total: number;
  mastered: number;
  assimilated: number;
  started: number;
  remaining: number;
  pct: number;
};

export type B2DailyEvidencePoint = {
  date: string;
  day: string;
  attempts: number;
  scored: number;
  correct: number;
  accuracy: number;
  uniqueWords: number;
  isToday: boolean;
};

export type B2WordSnapshot = {
  word: Word;
  id: string;
  label: string;
  greek: string;
  type: string;
  level: B2StageKey;
  mastered: boolean;
  assimilated: boolean;
  due: boolean;
  failed: boolean;
  criteriaMet: number;
  criteriaTotal: number;
  readinessPct: number;
  attempts: number;
  accuracy: number;
};

export type B2ProgressSummary = {
  total: number;
  previouslyKnown: number;
  due: number;
  started: number;
  learning: number;
  consolidating: number;
  assimilated: number;
  provisionallyMastered: number;
  mastered: number;
  retained: number;
  typedVerified: number;
  novelVerified: number;
  evidenceAttempts: number;
  scoredAttempts: number;
  evidenceAccuracy: number;
  activeRecallAttempts: number;
  activeRecallExact: number;
  activeRecallAccuracy: number;
  avgReadinessPct: number;
  stages: Record<B2StageKey, number>;
  byGame: B2GameMetric[];
  byPos: B2PosMetric[];
  daily7d: B2DailyEvidencePoint[];
  words: B2WordSnapshot[];
};

const B2_GAME_LABELS: Record<PracticeGame, string> = {
  flashcard: 'Κάρτες',
  mc: 'Πολλαπλή',
  fill: 'Κενό',
  context: 'Συμφραζόμενο',
  recall: 'Γράψιμο',
};

export type VocabProgressStats = {
  total: number;
  previouslyKnown: number;
  newCount: number;
  learning: number;
  consolidating: number;
  provisionallyMastered: number;
  retained: number;
  mastered: number;
  typedVerified: number;
  due: number;
  overallScored: number;
  overallCorrect: number;
  overallAccuracy: number | null;
  activeRecallAttempts: number;
  activeRecallExact: number;
  activeRecallAccuracy: number | null;
};

export function vocabProgressStats(vocab: Word[] = [], nowTs = Date.now()): VocabProgressStats {
  let previouslyKnown = 0;
  let newCount = 0;
  let learning = 0;
  let consolidating = 0;
  let provisionallyMastered = 0;
  let retained = 0;
  let typedVerified = 0;
  let due = 0;
  let overallScored = 0;
  let overallCorrect = 0;
  let activeRecallAttempts = 0;
  let activeRecallExact = 0;

  for (const w of Array.isArray(vocab) ? vocab : []) {
    if (!w) continue;
    const prevKnown = isPreviouslyKnown(w);
    if (prevKnown) {
      previouslyKnown++;
    } else {
      const m = mastery(w);
      if (m.level === 'Retained') retained++;
      else if (m.level === 'Provisionally mastered') provisionallyMastered++;
      else if (m.level === 'Consolidating') consolidating++;
      else if (m.level === 'Learning') learning++;
      else newCount++;
      if (m.typed) typedVerified++;
      if (!w?.learning?.nextReview || w.learning.nextReview <= nowTs) due++;
    }

    for (const e of Array.isArray(w.evidence) ? w.evidence : []) {
      if (!e || e.category === 'unscored' || e.neutral || e.status === 'synonym') continue;
      if (e.category === 'recognition' || e.category === 'recall/production') {
        overallScored++;
        if (e.correct) overallCorrect++;
      }
      if (e.category === 'recall/production') {
        activeRecallAttempts++;
        if (isActiveRecallSuccess(w, e)) activeRecallExact++;
      }
    }
  }

  return {
    total: Array.isArray(vocab) ? vocab.length : 0,
    previouslyKnown,
    newCount,
    learning,
    consolidating,
    provisionallyMastered,
    retained,
    mastered: provisionallyMastered + retained,
    typedVerified,
    due,
    overallScored,
    overallCorrect,
    overallAccuracy: overallScored > 0 ? Math.round((overallCorrect / overallScored) * 100) : null,
    activeRecallAttempts,
    activeRecallExact,
    activeRecallAccuracy:
      activeRecallAttempts > 0 ? Math.round((activeRecallExact / activeRecallAttempts) * 100) : null,
  };
}

export function b2ProgressSummary(vocab: Word[] = [], nowTs = Date.now()): B2ProgressSummary {
  const b2Words = filterVocabByPracticeScope(vocab, 'b2');
  const stages: Record<B2StageKey, number> = {
    New: 0,
    Learning: 0,
    Consolidating: 0,
    'Provisionally mastered': 0,
    Retained: 0,
  };

  const gameBuckets: Record<PracticeGame, { attempts: number; correct: number }> = {
    flashcard: { attempts: 0, correct: 0 },
    mc: { attempts: 0, correct: 0 },
    fill: { attempts: 0, correct: 0 },
    context: { attempts: 0, correct: 0 },
    recall: { attempts: 0, correct: 0 },
  };

  const posMap = new Map<string, { total: number; mastered: number; assimilated: number; started: number }>();

  const daily7d: (B2DailyEvidencePoint & { _ids: Set<string> })[] = [];
  const dailyByDate = new Map<string, B2DailyEvidencePoint & { _ids: Set<string> }>();
  for (let offset = 6; offset >= 0; offset--) {
    const iso = localDay(nowTs - offset * DAY);
    const pt = {
      date: iso,
      day: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      attempts: 0,
      scored: 0,
      correct: 0,
      accuracy: 0,
      uniqueWords: 0,
      isToday: offset === 0,
      _ids: new Set<string>(),
    };
    daily7d.push(pt);
    dailyByDate.set(iso, pt);
  }

  let previouslyKnown = 0;
  let due = 0;
  let started = 0;
  let learning = 0;
  let consolidating = 0;
  let assimilated = 0;
  let provisionallyMastered = 0;
  let mastered = 0;
  let retained = 0;
  let typedVerified = 0;
  let novelVerified = 0;
  let evidenceAttempts = 0;
  let scoredAttempts = 0;
  let scoredCorrect = 0;
  let activeRecallAttempts = 0;
  let activeRecallExact = 0;
  let readinessSum = 0;
  let learningB2Count = 0;

  const words: B2WordSnapshot[] = [];

  for (const w of b2Words) {
    const prevKnown = isPreviouslyKnown(w);
    if (prevKnown) previouslyKnown++;
    else learningB2Count++;
    const m = mastery(w);
    const level = m.level as B2StageKey;
    const isWordMastered = !prevKnown && m.mastered;
    const isWordRetained = !prevKnown && level === 'Retained';
    const isWordProvMastered = !prevKnown && level === 'Provisionally mastered';
    const isWordConsolidating = !prevKnown && level === 'Consolidating';
    const isWordLearning = !prevKnown && level === 'Learning';
    if (!prevKnown) {
      stages[level] = (stages[level] || 0) + 1;
    }

    const isWordDue = !prevKnown && (!w?.learning?.nextReview || w.learning.nextReview <= nowTs);
    const isWordStarted = !prevKnown && level !== 'New';
    const isWordAssimilated = !prevKnown && (m.mastered || level === 'Consolidating');
    if (isWordDue) due++;
    if (isWordStarted) started++;
    if (isWordLearning) learning++;
    if (isWordConsolidating) consolidating++;
    if (isWordAssimilated) assimilated++;
    if (isWordProvMastered) provisionallyMastered++;
    if (isWordMastered) mastered++;
    if (isWordRetained) retained++;
    if (!prevKnown && m.typed) typedVerified++;
    if (!prevKnown && m.novel) novelVerified++;

    const positiveReqs = [
      m.requirements.contexts,
      m.requirements.successes,
      m.requirements.activities,
      m.requirements.days,
      m.requirements.typed,
      m.requirements.novel,
      m.requirements.delayed,
    ];
    const criteriaMet = positiveReqs.filter(Boolean).length;
    const rawReadiness =
      (Math.min(m.contexts, MASTERY_MIN_CONTEXTS) / MASTERY_MIN_CONTEXTS +
        Math.min(m.successes, MASTERY_MIN_SUCCESSES) / MASTERY_MIN_SUCCESSES +
        Math.min(m.activities, MASTERY_MIN_ACTIVITIES) / MASTERY_MIN_ACTIVITIES +
        Math.min(m.days, MASTERY_MIN_DAYS) / MASTERY_MIN_DAYS +
        Math.min(m.delayed, MASTERY_DELAYED_WINDOWS.length) / MASTERY_DELAYED_WINDOWS.length +
        (m.typed ? 1 : 0) +
        (m.novel ? 1 : 0)) /
      7;
    const readinessPct = prevKnown ? 0 : isWordMastered ? 100 : Math.min(95, Math.round(rawReadiness * 100));
    if (!prevKnown) readinessSum += readinessPct;

    const posKey = ['Nomen', 'Verb', 'Adjektiv'].includes(w.type) ? w.type : 'Sonstiges';
    const posBucket = posMap.get(posKey) || { total: 0, mastered: 0, assimilated: 0, started: 0 };
    posBucket.total += 1;
    if (isWordMastered) posBucket.mastered += 1;
    if (isWordAssimilated) posBucket.assimilated += 1;
    if (isWordStarted) posBucket.started += 1;
    posMap.set(posKey, posBucket);

    let wordScored = 0;
    let wordCorrect = 0;
    let wordAttempts = 0;

    for (const e of Array.isArray(w.evidence) ? w.evidence : []) {
      if (!e || e.category === 'unscored' || e.neutral || e.status === 'synonym') continue;
      evidenceAttempts++;
      wordAttempts++;

      const mode = e.mode as PracticeGame;
      if (mode in gameBuckets) {
        gameBuckets[mode].attempts += 1;
        if (mode === 'flashcard') {
          if (e.selfRating !== 'Nochmal') gameBuckets[mode].correct += 1;
        } else if (mode === 'mc') {
          if (e.correct && !e.hintUsed) gameBuckets[mode].correct += 1;
        } else if (isActiveRecallSuccess(w, e)) {
          gameBuckets[mode].correct += 1;
        }
      }

      const isScored = e.category === 'recognition' || e.category === 'recall/production';
      if (isScored) {
        scoredAttempts++;
        wordScored++;
        if (e.correct) {
          scoredCorrect++;
          wordCorrect++;
        }
      }

      if (e.category === 'recall/production') {
        activeRecallAttempts++;
        if (isActiveRecallSuccess(w, e)) activeRecallExact++;
      }

      if (typeof e.timestamp === 'number' && Number.isFinite(e.timestamp)) {
        const dayPt = dailyByDate.get(localDay(e.timestamp));
        if (dayPt) {
          dayPt.attempts += 1;
          dayPt._ids.add(String(w.id || w.word));
          if (isScored) {
            dayPt.scored += 1;
            if (e.correct) dayPt.correct += 1;
          }
        }
      }
    }

    words.push({
      word: w,
      id: String(w.id || w.word),
      label: String(w.word || ''),
      greek: list(w.meaning?.greek).filter(Boolean).slice(0, 2).join(', '),
      type: posKey,
      level,
      mastered: isWordMastered,
      assimilated: isWordAssimilated,
      due: isWordDue,
      failed: m.failed,
      criteriaMet,
      criteriaTotal: 7,
      readinessPct,
      attempts: wordAttempts,
      accuracy: wordScored > 0 ? Math.round((wordCorrect / wordScored) * 100) : 0,
    });
  }

  const byGame: B2GameMetric[] = ALL_PRACTICE_GAMES.map((mode) => {
    const b = gameBuckets[mode];
    return {
      mode,
      label: B2_GAME_LABELS[mode],
      attempts: b.attempts,
      correct: b.correct,
      accuracy: b.attempts > 0 ? Math.round((b.correct / b.attempts) * 100) : 0,
      isExposure: mode === 'flashcard',
    };
  });

  const posOrder = ['Nomen', 'Verb', 'Adjektiv', 'Sonstiges'];
  const byPos: B2PosMetric[] = posOrder
    .filter((k) => posMap.has(k))
    .map((type) => {
      const b = posMap.get(type)!;
      return {
        type,
        total: b.total,
        mastered: b.mastered,
        assimilated: b.assimilated,
        started: b.started,
        remaining: Math.max(0, b.total - b.started),
        pct: b.total > 0 ? Math.round((b.assimilated / b.total) * 100) : 0,
      };
    });

  const cleanDaily7d: B2DailyEvidencePoint[] = daily7d.map(({ _ids, ...pt }) => ({
    ...pt,
    uniqueWords: _ids.size,
    accuracy: pt.scored > 0 ? Math.round((pt.correct / pt.scored) * 100) : 0,
  }));

  return {
    total: b2Words.length,
    previouslyKnown,
    due,
    started,
    learning,
    consolidating,
    assimilated,
    provisionallyMastered,
    mastered,
    retained,
    typedVerified,
    novelVerified,
    evidenceAttempts,
    scoredAttempts,
    evidenceAccuracy: scoredAttempts > 0 ? Math.round((scoredCorrect / scoredAttempts) * 100) : 0,
    activeRecallAttempts,
    activeRecallExact,
    activeRecallAccuracy:
      activeRecallAttempts > 0 ? Math.round((activeRecallExact / activeRecallAttempts) * 100) : 0,
    avgReadinessPct: learningB2Count > 0 ? Math.round(readinessSum / learningB2Count) : 0,
    stages,
    byGame,
    byPos,
    daily7d: cleanDaily7d,
    words,
  };
}

export type B2GoalMilestone = {
  pct: number;
  label: string;
  targetCount: number;
  reached: boolean;
  remaining: number;
};

export type B2GoalProgress = {
  mastered: number;
  retained: number;
  assimilated: number;
  inConsolidation: number;
  started: number;
  due: number;
  total: number;
  remainingToMaster: number;
  masteredPct: number;
  masteredRatio: number;
  assimilatedPct: number;
  assimilatedRatio: number;
  avgReadinessPct: number;
  milestones: B2GoalMilestone[];
  nextMilestone: B2GoalMilestone | null;
  closestWords: B2WordSnapshot[];
};

const B2_MILESTONE_DEFS: { pct: number; label: string }[] = [
  { pct: 25, label: 'Βάση B2' },
  { pct: 50, label: 'Μισός δρόμος' },
  { pct: 75, label: 'Ετοιμότητα' },
  { pct: 100, label: 'Ολοκλήρωση B2' },
];

export function b2GoalProgress(vocab: Word[] = [], nowTs = Date.now()): B2GoalProgress {
  const summary = b2ProgressSummary(vocab, nowTs);
  const { total, mastered, retained, assimilated, started, due, avgReadinessPct } = summary;
  const inConsolidation = Math.max(0, assimilated - mastered);
  const remainingToMaster = Math.max(0, total - mastered);
  const masteredRatio = total > 0 ? Math.min(1, Math.max(0, mastered / total)) : 0;
  const assimilatedRatio = total > 0 ? Math.min(1, Math.max(0, assimilated / total)) : 0;
  const masteredPct = total > 0 ? Math.round(masteredRatio * 100) : 0;
  const assimilatedPct = total > 0 ? Math.round(assimilatedRatio * 100) : 0;

  const milestones: B2GoalMilestone[] = B2_MILESTONE_DEFS.map((def) => {
    const targetCount = total > 0 ? Math.min(total, Math.max(1, Math.ceil((total * def.pct) / 100))) : 0;
    const reached = total > 0 && mastered >= targetCount;
    return {
      pct: def.pct,
      label: def.label,
      targetCount,
      reached,
      remaining: total > 0 ? Math.max(0, targetCount - mastered) : 0,
    };
  });

  const nextMilestone = total > 0 ? milestones.find((m) => !m.reached) || null : null;

  const closestWords = [...summary.words]
    .filter((item) => !item.mastered && !isPreviouslyKnown(item.word))
    .sort((a, b) => {
      if (b.readinessPct !== a.readinessPct) return b.readinessPct - a.readinessPct;
      if (b.criteriaMet !== a.criteriaMet) return b.criteriaMet - a.criteriaMet;
      if (a.due !== b.due) return a.due ? -1 : 1;
      return a.label.localeCompare(b.label, 'de');
    })
    .slice(0, 3);

  return {
    mastered,
    retained,
    assimilated,
    inConsolidation,
    started,
    due,
    total,
    remainingToMaster,
    masteredPct,
    masteredRatio,
    assimilatedPct,
    assimilatedRatio,
    avgReadinessPct,
    milestones,
    nextMilestone,
    closestWords,
  };
}

export type HomeProgressDay = {
  date: string;
  day: string;
  dayNum: string;
  isToday: boolean;
  wordsPracticed: number;
  attempts: number;
  assimilated: number;
  xp: number;
  sessions: number;
  active: boolean;
};

export type HomeDailyProgress = {
  date: string;
  wordsPracticed: number;
  targetWords: number;
  goalPct: number;
  goalRatio: number;
  attempts: number;
  scored: number;
  correct: number;
  accuracyPct: number | null;
  assimilated: number;
  xp: number;
  sessions: number;
  durationMs: number;
};

export type HomeMonthlyProgress = {
  windowDays: number;
  activeDays: number;
  practicedWords: number;
  assimilated: number;
  mastered: number;
  ratePerDay: number;
  attempts: number;
  scored: number;
  correct: number;
  accuracyPct: number | null;
  xp: number;
  sessions: number;
  durationMs: number;
  days: HomeProgressDay[];
};

export type HomeProgressSummary = {
  daily: HomeDailyProgress;
  monthly: HomeMonthlyProgress;
};

export function homeProgressSummary(
  vocab: Word[] = [],
  meta: Word = {},
  nowTs = Date.now()
): HomeProgressSummary {
  const windowDays = 30;
  const todayIso = localDay(nowTs);
  const targetWords = Math.max(1, Number(meta?.newPerDay) || 10);

  const lrAssimilated = learningRate30d(vocab, nowTs, 'assimilated', windowDays);
  const lrMastered = learningRate30d(vocab, nowTs, 'mastered', windowDays);
  const assimByDate = new Map(lrAssimilated.days.map((d) => [d.date, d.count]));

  const dayBuckets = new Map<
    string,
    HomeProgressDay & { _wordIds: Set<string>; _scored: number; _correct: number }
  >();
  const orderedDates: string[] = [];

  for (let offset = windowDays - 1; offset >= 0; offset--) {
    const iso = localDay(nowTs - offset * DAY);
    orderedDates.push(iso);
    dayBuckets.set(iso, {
      date: iso,
      day: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      dayNum: iso.slice(8, 10),
      isToday: offset === 0,
      wordsPracticed: 0,
      attempts: 0,
      assimilated: assimByDate.get(iso) || 0,
      xp: 0,
      sessions: 0,
      active: false,
      _wordIds: new Set<string>(),
      _scored: 0,
      _correct: 0,
    });
  }

  const monthlyWordIds = new Set<string>();
  let monthlyAttempts = 0;
  let monthlyScored = 0;
  let monthlyCorrect = 0;

  for (const w of Array.isArray(vocab) ? vocab : []) {
    const wordId = String(w?.id || w?.word || '');
    for (const e of Array.isArray(w?.evidence) ? w.evidence : []) {
      if (!e || e.category === 'unscored' || e.neutral || e.status === 'synonym' || typeof e.timestamp !== 'number' || !Number.isFinite(e.timestamp)) {
        continue;
      }
      const bucket = dayBuckets.get(localDay(e.timestamp));
      if (!bucket) continue;
      bucket.attempts += 1;
      if (wordId) {
        bucket._wordIds.add(wordId);
        monthlyWordIds.add(wordId);
      }
      monthlyAttempts += 1;

      const isScored = e.category === 'recognition' || e.category === 'recall/production';
      if (isScored) {
        bucket._scored += 1;
        monthlyScored += 1;
        if (e.correct) {
          bucket._correct += 1;
          monthlyCorrect += 1;
        }
      }
    }
  }

  let todayDurationMs = 0;
  let monthlyDurationMs = 0;
  let monthlyXp = 0;
  let monthlySessions = 0;

  for (const log of Array.isArray(meta?.sessionLogs) ? meta.sessionLogs : []) {
    if (!log || typeof log.date !== 'string') continue;
    const bucket = dayBuckets.get(log.date);
    if (!bucket) continue;
    const xpVal = Number(log.xp) || 0;
    const durVal = Number(log.durationMs) || 0;
    bucket.xp += xpVal;
    bucket.sessions += 1;
    monthlyXp += xpVal;
    monthlySessions += 1;
    monthlyDurationMs += durVal;
    if (log.date === todayIso) {
      todayDurationMs += durVal;
    }
  }

  let activeDays = 0;
  const days: HomeProgressDay[] = orderedDates.map((iso) => {
    const b = dayBuckets.get(iso)!;
    const wordsPracticed = b._wordIds.size;
    const active = b.attempts > 0 || b.sessions > 0 || b.assimilated > 0;
    if (active) activeDays += 1;
    return {
      date: b.date,
      day: b.day,
      dayNum: b.dayNum,
      isToday: b.isToday,
      wordsPracticed,
      attempts: b.attempts,
      assimilated: b.assimilated,
      xp: b.xp,
      sessions: b.sessions,
      active,
    };
  });

  const todayBucket = dayBuckets.get(todayIso)!;
  const todayWordsPracticed = todayBucket._wordIds.size;
  const goalRatio = Math.min(1, todayWordsPracticed / targetWords);
  const goalPct = Math.round(goalRatio * 100);

  return {
    daily: {
      date: todayIso,
      wordsPracticed: todayWordsPracticed,
      targetWords,
      goalPct,
      goalRatio,
      attempts: todayBucket.attempts,
      scored: todayBucket._scored,
      correct: todayBucket._correct,
      accuracyPct: todayBucket._scored > 0 ? Math.round((todayBucket._correct / todayBucket._scored) * 100) : null,
      assimilated: todayBucket.assimilated,
      xp: todayBucket.xp,
      sessions: todayBucket.sessions,
      durationMs: todayDurationMs,
    },
    monthly: {
      windowDays,
      activeDays,
      practicedWords: monthlyWordIds.size,
      assimilated: lrAssimilated.totalWords,
      mastered: lrMastered.totalWords,
      ratePerDay: lrAssimilated.ratePerDay,
      attempts: monthlyAttempts,
      scored: monthlyScored,
      correct: monthlyCorrect,
      accuracyPct: monthlyScored > 0 ? Math.round((monthlyCorrect / monthlyScored) * 100) : null,
      xp: monthlyXp,
      sessions: monthlySessions,
      durationMs: monthlyDurationMs,
      days,
    },
  };
}