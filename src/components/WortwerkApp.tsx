// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from "react";
import {
  Home, BookOpen, GraduationCap, BarChart3, Plus, X, Check, RotateCcw,
  Flame, Sparkles, ChevronRight, ChevronLeft, Search, Trash2, Trophy,
  Layers, ListChecks, PenLine, Shuffle, Loader2, Volume2, Star,
  TrendingUp, TrendingDown, Minus, MessageSquareQuote
} from "lucide-react";
import { normalizeEntry, identity, reviewEntries, applyImport, parseImport, fullBackup, vocabularyBackup, restoreState, makeEvidence, mastery, masteryScheduleState, computeAlignedNextReview, preferredActiveGameForWord, sortWordsByReviewPriority, isPreviouslyKnown, isMasteredThroughWortwerk, applyPreviouslyKnownSelection, updatePreviouslyKnownOnAnswer, vocabProgressStats, todayAccuracy, isMasteredToday, todayBatchProgress, compareTyped, checkTyped, diagnoseTyped, weeklyXpTimeline, learningRate30d, MAX_JSON_BYTES, normalizedWord, familyMembers, familyGroups, resolveWordFamily, trueShuffle, isB2Word, filterVocabByPracticeScope, hasFillExercise, findContextExample, mergeSeedEnrichments, buildPracticeQuestion, buildAllGamesQuestions, pickRandomTestWords } from '@/lib/wortwerk-data';
import ImportReview from '@/components/ImportReview';
import HomeProgressOverview from '@/components/HomeProgressOverview';
import FamilyCatalogue from '@/components/FamilyCatalogue';
import B2ProgressPanel from '@/components/B2ProgressPanel';
import B2GoalTracker from '@/components/B2GoalTracker';
import PreviouslyKnownModal from '@/components/PreviouslyKnownModal';
import SentencesModule from '@/components/sentences/SentencesModule';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, Cell, AreaChart, Area, ComposedChart, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import VOCAB_SEED from '@/data/vocab-seed.json';
import { LanguageProvider, useAppLang, wordPrimaryMeanings, wordSecondaryMeanings } from '@/lib/i18n';

/* ============================== DATA ============================== */



const PREFIX_MEANINGS = {
  "-": { label: "Βασική μορφή", meaning: "Η αμετάβλητη σημασία της ρίζας, χωρίς πρόθεμα." },
  "be-": { label: "be-", meaning: "Συχνά κάνει ένα ρήμα μεταβατικό (με άμεσο αντικείμενο) και στρέφει τη δράση κατευθείαν σε κάτι/κάποιον — π.χ. suchen → besuchen (όχι απλώς 'ψάχνω', αλλά στοχευμένα 'επισκέπτομαι')." },
  "ent-": { label: "ent-", meaning: "Δηλώνει απομάκρυνση, αποχωρισμό ή το αντίθετο — κάτι φεύγει, εξαφανίζεται ή αναιρείται (entschließen = αποφασίζω, entkommen = ξεφεύγω)." },
  "er-": { label: "er-", meaning: "Δείχνει την επίτευξη ενός αποτελέσματος ή την ολοκλήρωση μιας διαδικασίας — συχνά 'φέρνω κάτι επιτυχώς σε πέρας' (erreichen = πετυχαίνω, erfahren = μαθαίνω)." },
  "ge-": { label: "ge-", meaning: "Συχνά έχει συλλογική ή περιληπτική σημασία, ή είναι καθαρά γραμματικό (Partizip II)." },
  "ver-": { label: "ver-", meaning: "Πολύ ευέλικτο πρόθεμα: μπορεί να εκφράζει αλλαγή κατάστασης, κάτι λάθος/χαμένο, ή μια πλήρη ολοκλήρωση της δράσης (verschließen = κλείνω εντελώς, versuchen = δοκιμάζω)." },
  "zer-": { label: "zer-", meaning: "Δηλώνει καταστροφή ή διάλυση — κάτι χαλάει ή διασπάται σε κομμάτια (zerstören = καταστρέφω, zerreißen = σκίζω)." },
  "an-": { label: "an-", meaning: "Δηλώνει προσέγγιση, επαφή ή την έναρξη μιας δράσης (ankommen = φτάνω, anschließen = συνδέω)." },
  "auf-": { label: "auf-", meaning: "Κίνηση προς τα πάνω, άνοιγμα, ή η αρχή μιας διαδικασίας (aufgehen = ανατέλλω, aufschließen = ξεκλειδώνω)." },
  "aus-": { label: "aus-", meaning: "Κίνηση προς τα έξω ή η πλήρης ολοκλήρωση μιας δράσης (ausschließen = αποκλείω, aussuchen = διαλέγω)." },
  "ein-": { label: "ein-", meaning: "Κίνηση προς τα μέσα ή το κλείσιμο/περιορισμός κάτι μέσα σε κάτι άλλο (einschließen = συμπεριλαμβάνω, einsteigen = επιβιβάζομαι)." },
  "mit-": { label: "mit-", meaning: "Συμμετοχή, κοινή δράση με άλλους (mitkommen = έρχομαι μαζί, mitmachen = συμμετέχω)." },
  "nach-": { label: "nach-", meaning: "Χρονική ή χωρική ακολουθία — κάτι συμβαίνει μετά ή ύστερα (nachdenken = σκέφτομαι προσεκτικά, nachgehen = ακολουθώ)." },
  "vor-": { label: "vor-", meaning: "Χωρικά ή χρονικά 'μπροστά' — συχνά με την έννοια του να προτείνεις ή να παρουσιάζεις κάτι (vorschlagen = προτείνω, vorstellen = συστήνω)." },
  "zu-": { label: "zu-", meaning: "Κατεύθυνση προς κάτι, συχνά αύξηση ή προσθήκη (zunehmen = αυξάνομαι, zuschließen = κλειδώνω)." },
  "ab-": { label: "ab-", meaning: "Απομάκρυνση, μείωση, ή η ολοκλήρωση μιας διαδικασίας (abnehmen = αδυνατίζω, abschließen = ολοκληρώνω)." },
  "um-": { label: "um-", meaning: "Αλλαγή κατεύθυνσης, μορφής ή κατάστασης — κάτι 'αναδιαμορφώνεται' (umsteigen = αλλάζω μέσο, umziehen = μετακομίζω)." },
  "unter-": { label: "unter-", meaning: "Χωρικά 'από κάτω', ή μια διεξοδική, προσεκτική εξέταση (untergehen = βυθίζομαι/δύω, untersuchen = εξετάζω)." },
  "über-": { label: "über-", meaning: "Χωρικά 'από πάνω', υπερβολή, ή η ανάληψη κάτι (übernehmen = αναλαμβάνω, überzeugen = πείθω)." },
  "durch-": { label: "durch-", meaning: "Κίνηση 'από την αρχή ως το τέλος', ή διεξοδική πληρότητα (durchlesen = διαβάζω ολόκληρο, durchführen = διεξάγω)." },
  "wider-": { label: "wider-", meaning: "Δηλώνει αντίσταση ή αντίθεση (widersprechen = αντιμιλάω, widerstehen = αντιστέκομαι)." },
  "wieder-": { label: "wieder-", meaning: "Επανάληψη μιας δράσης (wiederholen = επαναλαμβάνω, wiedersehen = ξανασυναντώ)." },
  "teil-": { label: "teil-", meaning: "Μερική συμμετοχή σε κάτι (teilnehmen = συμμετέχω)." },
  "weg-": { label: "weg-", meaning: "Κίνηση μακριά, απομάκρυνση από τον τρέχοντα τόπο (weggehen = φεύγω, wegnehmen = αφαιρώ)." },
};

const PREFIX_MEANINGS_EN = {
  "-": { label: "Base form", meaning: "The unchanged meaning of the root, without a prefix." },
  "be-": { label: "be-", meaning: "Often makes a verb transitive (taking a direct object) and directs the action straight at something/someone — e.g. suchen → besuchen (to visit)." },
  "ent-": { label: "ent-", meaning: "Indicates removal, separation, or reversal — something leaves, disappears, or is undone (entschließen = decide, entkommen = escape)." },
  "er-": { label: "er-", meaning: "Shows achieving a result or completing a process — bringing something to a successful outcome (erreichen = achieve, erfahren = learn/find out)." },
  "ge-": { label: "ge-", meaning: "Often has a collective or summarizing meaning, or is purely grammatical (Partizip II)." },
  "ver-": { label: "ver-", meaning: "Very versatile prefix: can express a change of state, a mistake/loss, or complete fulfillment of an action (verschließen = lock completely, versuchen = try)." },
  "zer-": { label: "zer-", meaning: "Indicates destruction or breaking apart — something breaks into pieces (zerstören = destroy, zerreißen = tear apart)." },
  "an-": { label: "an-", meaning: "Indicates approach, contact, or the start of an action (ankommen = arrive, anschließen = connect)." },
  "auf-": { label: "auf-", meaning: "Upward movement, opening, or the start of a process (aufgehen = rise, aufschließen = unlock)." },
  "aus-": { label: "aus-", meaning: "Outward movement or full completion of an action (ausschließen = exclude, aussuchen = choose)." },
  "ein-": { label: "ein-", meaning: "Inward movement or enclosing/including something inside another (einschließen = include, einsteigen = board/get in)." },
  "mit-": { label: "mit-", meaning: "Participation, shared action with others (mitkommen = come along, mitmachen = take part)." },
  "nach-": { label: "nach-", meaning: "Temporal or spatial sequence — something happens after or follows (nachdenken = think over, nachgehen = follow/pursue)." },
  "vor-": { label: "vor-", meaning: "Spatially or temporally 'in front' — often suggesting or presenting something (vorschlagen = suggest, vorstellen = introduce)." },
  "zu-": { label: "zu-", meaning: "Direction toward something, often increase or addition (zunehmen = increase, zuschließen = lock)." },
  "ab-": { label: "ab-", meaning: "Movement away, reduction, or completion of a process (abnehmen = decrease/lose weight, abschließen = conclude)." },
  "um-": { label: "um-", meaning: "Change of direction, form, or state — reshaping or switching (umsteigen = transfer, umziehen = move house)." },
  "unter-": { label: "unter-", meaning: "Spatially 'underneath', or thorough, careful examination (untergehen = sink/set, untersuchen = examine)." },
  "über-": { label: "über-", meaning: "Spatially 'over', excess, or taking something on (übernehmen = take over, überzeugen = convince)." },
  "durch-": { label: "durch-", meaning: "Movement 'from start to finish', or thorough completeness (durchlesen = read through, durchführen = carry out)." },
  "wider-": { label: "wider-", meaning: "Indicates resistance or opposition (widersprechen = contradict, widerstehen = resist)." },
  "wieder-": { label: "wieder-", meaning: "Repetition of an action (wiederholen = repeat, wiedersehen = see again)." },
  "teil-": { label: "teil-", meaning: "Partial participation in something (teilnehmen = participate)." },
  "weg-": { label: "weg-", meaning: "Movement away from the current place (weggehen = leave, wegnehmen = take away)." },
};

/* ============================== HELPERS ============================== */

const now = () => Date.now();
const DAY = 24 * 60 * 60 * 1000;
// Στάδιο (= confidence 0-5) -> μέρες μέχρι την επόμενη επανάληψη: 1, 3, 7, 10, 15, μετά σταθερά ανά 30 (μηνιαία συντήρηση)
const STAGE_DAYS = [1, 3, 7, 10, 15, 30];
const INTERVALS = STAGE_DAYS.map((d) => d * DAY);
const MASTERED_STAGE = STAGE_DAYS.length - 1; // Scheduling stage only, not proof of mastery
const MAINTENANCE_MIN_GAP = 20 * DAY; // αν μια κατακτημένη λέξη δεν ξαναφανεί >20 μέρες, μπορεί να τραβηχτεί νωρίς για έλεγχο

function isDue(word) {
  if (isPreviouslyKnown(word)) return false;
  const nr = word?.learning?.nextReview;
  if (!nr || nr <= now()) return true;
  return masteryScheduleState(word, now()).inWindow;
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function applyAnswer(word, correct, boost = 1, opts = {}) {
  word = normalizeEntry(word);
  const currentTs = opts.timestamp ?? now();
  const evidence = [...(word.evidence || []), makeEvidence(word, correct, { ...opts, timestamp: currentTs })];
  if (opts.neutral) return { ...word, evidence };
  const learning = { ...(word.learning || { confidence: 0, timesSeen: 0, timesCorrect: 0, nextReview: 0, lastReviewed: 0 }) };
  learning.timesSeen = (learning.timesSeen || 0) + 1;
  learning.lastReviewed = currentTs;
  const today = dateStr(currentTs);
  if (opts.typed) {
    learning.typedSeen = (learning.typedSeen || 0) + 1;
    if (correct && opts.exact) {
      learning.typedCorrect = (learning.typedCorrect || 0) + 1;
      const days = (learning.typedDays || []).filter((d) => d !== today);
      days.push(today);
      learning.typedDays = days.slice(-10);
    }
  }
  if (correct) {
    learning.timesCorrect = (learning.timesCorrect || 0) + 1;
    const cur = learning.confidence || 0;
    const nDays = (learning.typedDays || []).length;
    // "κατακτημένη" μόνο μετά από σωστή γραφή σε 2 διαφορετικές μέρες
    const cap = nDays >= 2 ? MASTERED_STAGE : nDays === 1 ? 4 : 3;
    learning.confidence = clamp(Math.min(cur + boost, Math.max(cap, cur)), 0, MASTERED_STAGE);
    learning.nextReview = computeAlignedNextReview({ ...word, learning, evidence }, true, INTERVALS[learning.confidence], currentTs);
  } else {
    learning.confidence = clamp((learning.confidence || 0) - 1, 0, MASTERED_STAGE);
    learning.nextReview = computeAlignedNextReview({ ...word, learning, evidence }, false, DAY, currentTs);
  }
  return updatePreviouslyKnownOnAnswer({ ...word, learning, evidence }, correct, {
    neutral: opts.neutral,
    status: opts.status,
    exact: opts.exact,
  });
}

// Daily practice completion is not mastery; only today's scored attempts count.
function todayMasteryPct(word) { return todayAccuracy(word).pct; }

function daysSince(ts) {
  if (!ts) return Infinity;
  return (now() - ts) / DAY;
}

// Λέξεις για την "Ημερήσια Εξάσκηση": όλες οι οφειλόμενες (κατά το πρόγραμμα 1/3/7/10/15 ημερών)
// + λίγες τυχαίες "κατακτημένες" λέξεις που δεν έχουν ξαναφανεί εδώ και καιρό, για έλεγχο μακροπρόθεσμης διατήρησης
// (έτσι ώστε μια λέξη που θυμάσαι σήμερα αλλά μπορεί να ξεχάσεις σε έναν μήνα να ελέγχεται ξανά τακτικά).
function getDailyPracticeWords(vocab, maintenanceCount = 4) {
  const currentTs = now();
  const due = sortWordsByReviewPriority(vocab.filter(isDue), currentTs);
  const maintenanceCandidates = vocab.filter(
    (w) =>
      !isPreviouslyKnown(w) &&
      !isDue(w) &&
      ((w.learning?.confidence || 0) >= MASTERED_STAGE || mastery(w).mastered) &&
      daysSince(w.learning?.lastReviewed) > 20
  );
  const maintenance = trueShuffle(maintenanceCandidates).slice(0, maintenanceCount);
  return { due, maintenance, all: [...due, ...maintenance] };
}

function dateStr(ts) {
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

function shuffle(arr) {
  return trueShuffle(arr);
}

function pickRoundWords(vocab, size = 10, mode = "mix") {
  if (vocab.length === 0) return [];
  const currentTs = now();
  const matchesMode = (w) => {
    if (mode === "fill") return hasFillExercise(w);
    if (mode === "context") return findContextExample(w) !== null;
    return true;
  };
  const regular = vocab.filter((w) => !isPreviouslyKnown(w));
  const known = vocab.filter(isPreviouslyKnown);
  const orderPool = (list) => {
    const due = sortWordsByReviewPriority(list.filter(isDue), currentTs);
    const rest = trueShuffle(list.filter((w) => !isDue(w))).sort(
      (a, b) => (a.learning?.confidence ?? 1) - (b.learning?.confidence ?? 1)
    );
    return [...due, ...rest];
  };
  const orderedRegular = [...orderPool(regular.filter(matchesMode)), ...orderPool(regular.filter((w) => !matchesMode(w)))];
  const orderedKnown = [...orderPool(known.filter(matchesMode)), ...orderPool(known.filter((w) => !matchesMode(w)))];
  const pool = [...orderedRegular, ...orderedKnown];
  return pool.slice(0, Math.min(size, vocab.length));
}

function typeLabel(t) {
  if (t === "Verb") return "Verb";
  if (t === "Adjektiv") return "Adj.";
  if (t === "Nomen") return "Nomen";
  return "Wort";
}

const DEFAULT_META = { streak: 0, lastPlayDate: null, xp: 0, sessionLogs: [], totalStudyTimeMs: 0, testLogs: [], newPerDay: 10, lastActivation: "", deletedKeys: [] };

/* ============================== ΚΕΙΜΕΝΟ & ΑΝΑΓΝΩΡΙΣΗ ΑΠΑΝΤΗΣΕΩΝ ============================== */

const GREEK_RE = /[\u0370-\u03ff\u1f00-\u1fff]/;
const LATIN_RE = /[A-Za-zÄÖÜäöüß]/;

function leadingArticle(s) {
  const m = String(s || "").trim().match(/^(der|die|das)\s+/i);
  return m ? m[1].toLowerCase() : "";
}
function stripArticle(s) {
  return String(s || "").trim().replace(/^(der|die|das)\s+/i, "");
}
function wordKey(s) {
  return stripArticle(String(s || "").trim().replace(/\s+/g, " ")).toLowerCase();
}
function coreForm(s) {
  let t = String(s || "").trim().replace(/\s+/g, " ").replace(/[.,;:!?]+$/g, "");
  t = t.replace(/^(der|die|das)\s+/i, "");
  t = t.replace(/^sich\s+/i, "");
  return t;
}
function makeHint(target, lang = "el") {
  const t = coreForm(target);
  if (!t) return "";
  const parts = t.split(" ").map((p) => p.charAt(0) + new Array(p.length).join("_"));
  return parts.join("  ") + "   (" + t.replace(/ /g, "").length + (lang === "en" ? " letters)" : " γράμματα)");
}
function hasFill(w) {
  const ex = w && w.exercise;
  return !!(ex && ex.sentence && ex.sentence.indexOf("______") > -1 && ex.answer);
}

/* ============================== ΕΝΩΣΗ / ΟΥΡΑ ============================== */

function mergeIncoming(prev, incoming, decisions) {
  return applyImport(prev, decisions || reviewEntries(prev, incoming));
}
function activateQueued(vocab, n, today) {
  let left = n, activated = 0;
  const next = vocab.map((w) => {
    if (left > 0 && w.queued) { left--; activated++; return Object.assign({}, w, { queued: false, dateAdded: today }); }
    return w;
  });
  return { next, activated };
}

/* ============================== ΑΝΑΛΥΣΗ ΚΕΙΜΕΝΟΥ ============================== */

function splitMeanings(t) {
  const out = [];
  let depth = 0, cur = "";
  const s = String(t || "");
  for (let k = 0; k < s.length; k++) {
    const ch = s.charAt(k);
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (depth <= 0 && (ch === "," || ch === ";" || ch === "/" || ch === "·")) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim().replace(/[.]+$/, "").trim()).filter(Boolean).slice(0, 5);
}
function inferType(word, hint) {
  const w = String(word || "").trim();
  const art = leadingArticle(w);
  const toks = w.split(/\s+/);
  if (art) return /^[A-ZÄÖÜ]/.test(toks[toks.length - 1]) ? "Nomen" : "Sonstiges";
  if (/^sich\s+/i.test(w)) return "Verb";
  if (hint) {
    if (/ρήμα/i.test(hint)) return "Verb";
    if (/ουσιαστικ/i.test(hint)) return "Nomen";
    if (/επίθετο/i.test(hint)) return "Adjektiv";
  }
  if (toks.length === 1) {
    if (/^[a-zäöüß]+(?:en|ern|eln)$/.test(w)) return "Verb";
    if (/^[A-ZÄÖÜ][a-zäöüß]+$/.test(w)) return "Nomen";
  }
  return "Sonstiges";
}
function buildEntry(p) {
  const word = String(p.word || "").trim();
  const type = p.type || inferType(word);
  return {
    word, type, cefr: p.cefr || "", article: type === "Nomen" ? leadingArticle(word) : "",
    plural: p.plural || "",
    meaning: { greek: p.greek || [], english: p.english || [] },
    usage: p.usage || "", examples: p.examples || [], memoryHook: p.memoryHook || "",
    etymology: p.etymology || "", funFact: "", synonyms: p.synonyms || [], antonyms: p.antonyms || [],
    exercise: p.exercise || { sentence: "", answer: "" },
    tags: [], stem: "", prefixFamily: [], family: null,
    dateAdded: p.dateAdded || "", lite: !!p.lite, queued: !!p.queued,
    learning: { confidence: 0, timesSeen: 0, timesCorrect: 0, nextReview: 0 },
  };
}
function parseListLine(line) {
  let l = String(line || "").trim();
  if (!l) return null;
  l = l.replace(/^(?:\d+[.)]\s+|[-*•]\s+)/, "");
  const m = l.match(/^(.*?)\s*(?:;|\t|=|\s[–—-]\s)\s*(.+)$/);
  if (!m) return null;
  const de = m[1].trim();
  let rest = m[2].trim();
  let cefr = "";
  const cm = rest.match(/^(.*?)\s*[;\t]\s*(A1|A2|B1|B2|C1|C2)\s*$/i);
  if (cm) { rest = cm[1].trim(); cefr = cm[2].toUpperCase(); }
  if (!de || !rest || !LATIN_RE.test(de)) return null;
  const meanings = splitMeanings(rest);
  if (!meanings.length) return null;
  const isGreek = GREEK_RE.test(rest);
  return buildEntry({
    word: de, cefr, lite: true,
    greek: isGreek ? meanings : [], english: isGreek ? [] : meanings,
  });
}

const HEADING_RE = /^(μετάφραση|σημασία|σημασίες|ετυμολογία|μορφολογ|γραμματική|σύνταξη|παραδείγματα|παράδειγμα|ιστορικό|συγγενικ|οικογένεια|διάκριση|διαφορά|προσοχή|πρόσεξε|χρήσιμ|μνημονικό|συνώνυμ|αντίθετο|αντώνυμ|πληθυντικός|ρήμα|ουσιαστικό|επίθετο|επίρρημα|ανάλυση|εκφράσεις|σύνθετη|δομή)/i;
const STOP_RE = /^(επανάληψη|μικρό τεστ|μικρή εξάσκηση|έλεγχος γνώσεων|τα σημαντικότερα σημεία|τι να συγκρατήσεις|ολοκλήρωση της|σωστές απαντήσεις|ξανακάνω)/i;

function stripBullet(s) {
  return String(s || "").replace(/\*\*/g, "").replace(/^\s*(?:[*•▪]\s+|[-–]\s+|\d+[.)]\s+)/, "").trim();
}
function isHeading(l) {
  if (!HEADING_RE.test(l)) return false;
  const ci = l.indexOf(":");
  return l.length < 70 || (ci > -1 && ci < 45);
}
function getSection(L, startRe, maxLines) {
  const i = L.findIndex((l) => startRe.test(l));
  if (i < 0) return "";
  const parts = [];
  const first = L[i];
  const ci = first.indexOf(":");
  if (ci > -1 && ci < 60 && first.slice(ci + 1).trim()) parts.push(first.slice(ci + 1).trim());
  for (let j = i + 1; j < L.length && parts.length < (maxLines || 8); j++) {
    if (isHeading(L[j])) break;
    parts.push(L[j]);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
function isMostlyGreek(s) {
  const g = (String(s).match(/[\u0370-\u03ff\u1f00-\u1fff]/g) || []).length;
  const l = (String(s).match(/[A-Za-zÄÖÜäöüß]/g) || []).length;
  return g > 0 && g >= l * 2;
}
function isGermanSentence(s) {
  const t = String(s || "").trim();
  if (!t || GREEK_RE.test(t)) return false;
  if (t.split(/\s+/).length < 3) return false;
  if (/^[A-Za-zÄÖÜäöüß]+:\s/.test(t)) return false;
  return /[.!?]["”»]?$/.test(t) && /^["„«]?[A-ZÄÖÜ]/.test(t);
}
function tidyGreek(el) {
  const m = String(el).match(/^(.+?[.!?;·])(\s|$)/);
  return (m ? m[1] : String(el)).replace(/\s+/g, " ").trim();
}
function extractExamples(L) {
  const out = [];
  for (let k = 0; k < L.length && out.length < 2; k++) {
    const l = L[k];
    if (isHeading(l) && l.indexOf(":") > -1 && l.indexOf(":") < 30) continue;
    const gi = l.search(GREEK_RE);
    if (gi > 0) {
      const de = l.slice(0, gi).replace(/\s*[—–→-]+\s*$/, "").trim();
      if (isGermanSentence(de)) { out.push({ de, el: tidyGreek(l.slice(gi)) }); continue; }
    } else if (gi === -1 && isGermanSentence(l)) {
      const nxt = L[k + 1];
      if (nxt && isMostlyGreek(nxt) && !isHeading(nxt)) { out.push({ de: l, el: tidyGreek(nxt) }); k++; }
    }
  }
  return out;
}
function extractLatinList(t) {
  return String(t || "").split(/[,;]/).map((p) => p.replace(/\(.*?\)/g, "").split(/\s[—–-]\s/)[0].trim().replace(/[.]+$/, ""))
    .filter((p) => p && LATIN_RE.test(p) && !GREEK_RE.test(p) && p.split(/\s+/).length <= 3).slice(0, 4);
}
function makeExercise(sentence, word, type) {
  const core = coreForm(word);
  if (!core || core.split(" ").length > 3) return null;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const L = "A-Za-zÄÖÜäöüß";
  let re = new RegExp("(^|[^" + L + "])(" + esc(core) + ")(?![" + L + "])", "i");
  let m = sentence.match(re);
  if (m) return { sentence: sentence.replace(re, "$1______"), answer: m[2] };
  if (type !== "Nomen" && core.indexOf(" ") === -1 && core.length >= 5) {
    const stem = core.slice(0, Math.max(4, core.length - 3));
    re = new RegExp("(^|[^" + L + "])(" + esc(stem) + "[" + L + "]*)(?![" + L + "])", "i");
    m = sentence.match(re);
    if (m) return { sentence: sentence.replace(re, "$1______"), answer: m[2] };
  }
  return null;
}
function parseBlock(head, body) {
  const h = String(head).replace(/\*\*/g, "").trim();
  let left = h, right = "";
  const dm = h.match(/^(.*?)\s+[—–-]\s+(.*)$/);
  if (dm) { left = dm[1].trim(); right = dm[2].trim(); }
  left = left.replace(/[.:]+$/, "").trim();
  left = left.replace(/\s+(?:auf|um|von|für|an|mit|über|vor|nach|bei|zu|in|aus)\s*\+\s*(?:Akkusativ|Dativ|Genitiv)\s*$/i, "");
  let plural = "";
  const pm = left.match(/^((?:der|die|das)\s+[^,]+?),\s*(die\s+[^,]+)$/i);
  let sentenceHead = false;
  if (pm) { left = pm[1].trim(); plural = pm[2].trim(); }
  else {
    const sm = left.match(/^((?:der|die|das)\s+[^/,]+?)\s*\/\s*(?:der|die|das)\s+/i);
    if (sm) left = sm[1].trim();
    else if (!/^(?:der|die|das)\s/i.test(left) && left.indexOf(",") > -1) {
      const before = left.split(",")[0].trim();
      if (before.split(/\s+/).length >= 3) { left = before; sentenceHead = true; }
    }
  }
  const Lb = body.map((raw) => ({ t: stripBullet(raw).trim(), b: /^\s*(?:[*•▪]|[-–])\s+/.test(raw) })).filter((x) => x.t);
  const L = Lb.map((x) => x.t);
  const fromRight = right && GREEK_RE.test(right) ? splitMeanings(right) : [];
  const fromLabel = (() => {
    const i = L.findIndex((l) => /^(μετάφραση|σημασία|σημασίες)/i.test(l));
    if (i < 0) return [];
    const ci = L[i].indexOf(":");
    if (ci > -1 && ci < 60 && L[i].slice(ci + 1).trim()) return splitMeanings(L[i].slice(ci + 1));
    const items = [];
    for (let j = i + 1; j < Lb.length && items.length < 4; j++) {
      if (isHeading(Lb[j].t)) break;
      if (Lb[j].b) items.push(Lb[j].t.split(/,|·|\sπ\.χ\./)[0].trim());
      else { if (!items.length) items.push(Lb[j].t); break; }
    }
    return items.map((x) => x.replace(/[.]+$/, "").trim()).filter(Boolean);
  })();
  const fromDef = (() => {
    const key = left.toLowerCase();
    for (let j = 0; j < L.length; j++) {
      const low = L[j].toLowerCase();
      if (low.indexOf(key) === 0) {
        const rest = L[j].slice(key.length);
        const dm2 = rest.match(/^\s*[—–-]\s+(.+)$/);
        if (dm2 && GREEK_RE.test(dm2[1])) return splitMeanings(dm2[1]);
      }
    }
    return [];
  })();
  const greek = sentenceHead ? (fromDef.length ? fromDef : fromLabel.length ? fromLabel : fromRight)
                             : (fromRight.length ? fromRight : fromLabel.length ? fromLabel : fromDef);
  const type = inferType(left, L.slice(0, 3).join(" "));
  const examples = extractExamples(L);
  const plLine = L.find((l) => /^πληθυντικός/i.test(l));
  if (!plural && plLine) {
    const t = plLine.replace(/^πληθυντικός\s*:?\s*/i, "").split(/[,·]/)[0].trim();
    if (t && LATIN_RE.test(t)) plural = t;
  }
  const etym = getSection(L, /^ετυμολογία/i, 8).slice(0, 700);
  const gram = getSection(L, /^(γραμματική|σύνταξη)/i, 6);
  const extra = L.filter((l) => /^(χρήσιμο|προσοχή|πρόσεξε|διάκριση)/i.test(l)).slice(0, 2).join(" ");
  const usage = (gram + " " + extra).replace(/\s+/g, " ").trim().slice(0, 450);
  const mnLine = L.find((l) => /^μνημονικό/i.test(l));
  const memoryHook = mnLine ? mnLine.replace(/^μνημονικό\s*:?\s*/i, "").trim() : "";
  const synLine = L.find((l) => /^(συνώνυμο|συνώνυμα)/i.test(l));
  const antLine = L.find((l) => /^(αντίθετο|αντώνυμο|αντώνυμα)/i.test(l));
  const synonyms = synLine ? extractLatinList(synLine.replace(/^[^:]*:\s*/, "")) : [];
  const antonyms = antLine ? extractLatinList(antLine.replace(/^[^:]*:\s*/, "")) : [];
  const exercise = examples.length ? makeExercise(examples[0].de, left, type) : null;
  return buildEntry({ word: left, type, plural, greek, usage, examples, etymology: etym, memoryHook, synonyms, antonyms, exercise: exercise || undefined });
}
function parseBlocks(text) {
  const lines = String(text).replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, ""));
  const numRe = /^\s*(\d+(?:\.\d+)?)[.)]\s+(.+)$/;
  let heads = [];
  lines.forEach((l, i) => { const m = l.match(numRe); if (m) heads.push({ i, num: m[1], text: m[2].trim() }); });
  const hasDotted = heads.some((x) => x.num.indexOf(".") > -1);
  heads = heads.filter((x) => LATIN_RE.test(x.text) && (!hasDotted || x.num.indexOf(".") > -1));
  if (!heads.length) return [];
  let stopAt = lines.length;
  for (let i = heads[0].i; i < lines.length; i++) {
    if (STOP_RE.test(stripBullet(lines[i]))) { stopAt = i; break; }
  }
  heads = heads.filter((x) => x.i < stopAt);
  const out = [];
  heads.forEach((h, k) => {
    const end = k + 1 < heads.length ? heads[k + 1].i : stopAt;
    const e = parseBlock(h.text, lines.slice(h.i + 1, end));
    if (e.word) out.push(e);
  });
  return out;
}
function detectFormat(text) {
  const nonEmpty = String(text).split(/\r?\n/).filter((l) => l.trim());
  const numbered = nonEmpty.filter((l) => /^\s*\d+(?:\.\d+)?[.)]\s+\S/.test(l));
  if (!numbered.length) return "list";
  const prose = nonEmpty.filter((l) => !LATIN_RE.test(l) || isHeading(stripBullet(l))).length;
  return prose >= 2 ? "blocks" : "list";
}
function parseTextEntries(text) {
  const format = detectFormat(text);
  let entries = [];
  if (format === "blocks") entries = parseBlocks(text);
  if (entries.length) return { format: "blocks", entries };
  entries = String(text).split(/\r?\n/).map(parseListLine).filter(Boolean);
  if (!entries.length && format === "list") {
    const b = parseBlocks(text);
    if (b.length) return { format: "blocks", entries: b };
  }
  return { format: "list", entries };
}

/* ============================== ΑΝΤΙΓΡΑΦΑ ΑΣΦΑΛΕΙΑΣ ============================== */

function fixArticleWord(w) {
  if (w && w.article && w.word && w.word.toLowerCase().indexOf(w.article.toLowerCase() + " ") !== 0) {
    return Object.assign({}, w, { word: w.article + " " + w.word });
  }
  return w;
}
const AppCtx = createContext({ vocab: [], toggleFav: () => {}, importWords: () => ({ added: 0, upgraded: 0, skipped: 0 }), activateMore: () => 0, restoreBackup: () => ({ added: 0, updated: 0 }), deleteWord: () => {}, queuedCount: 0 });


/* ============================== SMALL UI ============================== */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
      * { box-sizing: border-box; }
      .ww-root {
        font-family: 'Inter', -apple-system, sans-serif;
        background: #F5F0E6;
        background-image:
          linear-gradient(rgba(203,145,70,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(203,145,70,0.05) 1px, transparent 1px);
        background-size: 28px 28px;
        min-height: 100vh;
        color: #211F1C;
        display: flex;
        flex-direction: column;
      }
      .ww-display { font-family: 'Fraunces', serif; }
      .ww-mono { font-family: 'Space Mono', monospace; }
      .ww-root ::-webkit-scrollbar { width: 6px; height: 6px; }
      .ww-root ::-webkit-scrollbar-thumb { background: #D9D2C0; border-radius: 4px; }
      button { font-family: inherit; cursor: pointer; }
      input, select, textarea { font-family: inherit; }
      .ww-tag-card {
        position: relative;
        border-radius: 20px;
        background: #FFFFFF;
        border: 1px solid rgba(0,0,0,0.04);
        box-shadow: 0 1px 2px rgba(60,50,30,0.04), 0 6px 16px rgba(60,50,30,0.06);
      }
      .ww-tag-hole { display: none; }
      .ww-hero-card {
        border-radius: 24px;
        background: linear-gradient(160deg, #211F1C, #2A2824);
        box-shadow: 0 10px 28px rgba(33,31,28,0.25);
      }
      @keyframes ww-pop {
        0% { transform: scale(0.94); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
      .ww-pop { animation: ww-pop 0.22s ease-out; }
      @keyframes ww-flip-in {
        0% { transform: rotateY(90deg); opacity: 0.3; }
        100% { transform: rotateY(0deg); opacity: 1; }
      }
      .ww-flip { animation: ww-flip-in 0.28s ease-out; }
      @media (prefers-reduced-motion: reduce) {
        .ww-pop, .ww-flip { animation: none; }
      }
      .ww-scrollbar-none::-webkit-scrollbar { display: none; }
    `}</style>
  );
}

function ConfidenceDots({ confidence = 1 }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            width: 5, height: 5, borderRadius: "50%",
            background: i < confidence ? "#CB9146" : "#D9D2C0",
          }}
        />
      ))}
    </div>
  );
}

const CONFIDENCE_COLORS = ["#E0584A", "#E0794A", "#CB9146", "#B8A23E", "#8FAE5A", "#6FA96B"];

function ConfidenceBar({ confidence = 0, width = 56 }) {
  const { t } = useAppLang();
  const c = clamp(confidence, 0, 5);
  const pct = Math.max(10, (c / 5) * 100);
  return (
    <div
      title={t(`Πρόγραμμα επανάληψης (στάδιο ${c}/5)`, `Review schedule (stage ${c}/5)`)}
      aria-label={t(`Στάδιο επανάληψης ${c} από 5`, `Review stage ${c} of 5`)}
      style={{ width, height: 5, background: "#ECE4D3", borderRadius: 999, overflow: "hidden", flexShrink: 0 }}
    >
      <div style={{ height: "100%", width: `${pct}%`, background: CONFIDENCE_COLORS[c], borderRadius: 999, transition: "width 0.3s" }} />
    </div>
  );
}

function Pill({ children, color = "#8B8680", bg = "rgba(141,147,163,0.12)", outline = false }) {
  return (
    <span
      className="ww-mono"
      style={{
        fontSize: 10, letterSpacing: 0.4, color: outline ? "#211F1C" : color,
        background: outline ? "transparent" : bg,
        border: outline ? "1.5px solid #211F1C" : "none",
        padding: "3px 7px", borderRadius: 999, textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function TopBar({ title, subtitle, right }) {
  return (
    <div style={{ padding: "18px 20px 14px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
      <div>
        <div className="ww-display" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: "#8B8680", marginTop: 3 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

/* ============================== BOTTOM NAV ============================== */

function BottomNav({ tab, setTab, dueCount }) {
  const { t } = useAppLang();
  const items = [
    { id: "home", label: "Home", icon: Home },
    { id: "vocab", label: "Wörter", icon: BookOpen },
    { id: "learn", label: "Lernen", icon: Sparkles, isCenter: true },
    { id: "families", label: t("Οικογένειες", "Families"), icon: Layers },
    { id: "stats", label: "Fortschritt", icon: BarChart3 },
  ];
  return (
    <nav
      aria-label={t("Κύρια πλοήγηση", "Main navigation")}
      style={{
        position: "sticky", bottom: 0, left: 0, right: 0,
        background: "rgba(253,250,243,0.94)", backdropFilter: "blur(10px)",
        borderTop: "1px solid #ECE4D3",
        display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", alignItems: "end",
        padding: "6px 6px calc(8px + env(safe-area-inset-bottom))",
        zIndex: 20,
      }}
    >
      {items.map((it) => {
        const Icon = it.icon;
        const active = tab === it.id;
        return (
          <Button variant="ghost" aria-current={active ? "page" : undefined}
            key={it.id}
            onClick={() => setTab(it.id)}
            style={{
              background: "none", border: "none", display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
              padding: "4px 2px", position: "relative", minWidth: 0, minHeight: 48, height: "auto",
              color: active ? "#B5542E" : "#8B8680",
            }}
          >
            {it.isCenter ? (
              <span
                style={{
                  position: "relative",
                  width: 36, height: 36, borderRadius: 999,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: active ? "#211F1C" : "#ECE4D3",
                  color: active ? "#F5F0E6" : "#211F1C",
                  transition: "background 160ms ease, color 160ms ease",
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.3 : 1.9} />
                {dueCount > 0 && (
                  <span
                    className="ww-mono"
                    style={{
                      position: "absolute", top: -4, right: -6, background: "#C1543C",
                      color: "#FFFFFF", fontSize: 9, borderRadius: 999,
                      minWidth: 16, height: 16, display: "flex", alignItems: "center",
                      justifyContent: "center", padding: "0 4px",
                    }}
                  >
                    {dueCount}
                  </span>
                )}
              </span>
            ) : (
              <Icon size={20} strokeWidth={active ? 2.3 : 1.8} />
            )}
            <span style={{ fontSize: 10, fontWeight: active || it.isCenter ? 600 : 400, whiteSpace: "nowrap" }}>{it.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}

/* ============================== PLAY SCREEN ============================== */

function buildQuestions(words, mode) {
  if (mode === "mix" || mode === "daily") {
    return buildAllGamesQuestions(words, { shuffleOrder: true, prioritizeMasteryWindows: true });
  }
  return words.map((w) => buildPracticeQuestion(w, mode));
}

function InfoButton({ word, onHelp }) {
  const ctx = useContext(AppCtx);
  const { t } = useAppLang();
  const [show, setShow] = useState(false);
  const [cur, setCur] = useState(word);
  return (
    <>
      <FavStar
        word={word}
        style={{
          position: "absolute", top: 14, right: 50, width: 28, height: 28, borderRadius: "50%",
          background: "rgba(203,145,70,0.10)", border: "1px solid #E8D6B0",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
        }}
      />
      <button
        onClick={(e) => { e.stopPropagation(); onHelp?.(); setCur(word); setShow(true); }}
        aria-label={t("Πληροφορίες λέξης", "Word details")}
        style={{
          position: "absolute", top: 14, right: 14, width: 28, height: 28, borderRadius: "50%",
          background: "rgba(139,123,199,0.14)", border: "1px solid #D9CFEF", color: "#8B7BC7",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700,
          zIndex: 2,
        }}
      >
        ⓘ
      </button>
      {show && <WordDetailSheet word={cur} onClose={() => setShow(false)} vocab={ctx.vocab} onOpenWord={(w) => setCur(w)} />}
    </>
  );
}

function FlashcardQ({ item, onAnswer }) {
  const { lang, t } = useAppLang();
  const [flipped, setFlipped] = useState(false);
  const questionStart = useRef(now());
  const w = item.word;
  const primaryMeaning = wordPrimaryMeanings(w, lang).join(" · ");
  const secondaryMeaning = wordSecondaryMeanings(w, lang).join(", ");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div
        onClick={() => setFlipped((f) => !f)}
        className="ww-tag-card ww-pop"
        style={{
          width: "100%", maxWidth: 340, minHeight: 220, padding: "26px 22px",
          display: "flex", flexDirection: "column", justifyContent: "center",
          alignItems: "center", textAlign: "center", cursor: "pointer",
          background: flipped ? "#211F1C" : "#FFFFFF",
          color: flipped ? "#F5F0E6" : "#211F1C",
        }}
      >
        <div className="ww-tag-hole" style={{ background: flipped ? "#211F1C" : "#F5F0E6" }} />
        <InfoButton word={w} onHelp={() => { item.helpUsed = true; }} />
        {!flipped ? (
          <div key="front" className="ww-flip">
            <Pill color="#CB9146" bg="rgba(203,145,70,0.15)">{w.cefr ? w.cefr + " · " : ""}{typeLabel(w.type)}</Pill>
            <div className="ww-display" style={{ fontSize: 32, fontWeight: 600, marginTop: 14 }}>
              {w.word}
            </div>
            <div style={{ fontSize: 12, color: "#A79F8E", marginTop: 10 }}>
              {t("Tippen zum Umdrehen", "Tap to flip")}
            </div>
          </div>
        ) : (
          <div key="back" className="ww-flip" style={{ width: "100%" }}>
            <div className="ww-display" style={{ fontSize: 23, fontWeight: 700, color: "#FFFFFF" }}>
              {primaryMeaning}
            </div>
            {secondaryMeaning && (
              <div style={{ fontSize: 14, color: "#D8D2C4", marginTop: 5 }}>
                {secondaryMeaning}
              </div>
            )}
            {w.examples?.[0]?.de && (
              <div style={{ fontSize: 14, marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.18)", paddingTop: 12, lineHeight: 1.55, color: "#F0EBDD" }}>
                <div>„{w.examples[0].de}“</div>
                <div style={{ color: "#C9BFA5", marginTop: 3 }}>
                  {lang === "en" ? (w.examples[0].en || w.examples[0].el) : w.examples[0].el}
                </div>
              </div>
            )}
            {((w.synonyms || []).length > 0 || (w.antonyms || []).length > 0) && (
              <div style={{ fontSize: 13.5, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.18)", paddingTop: 12, display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", color: "#F0EBDD" }}>
                {(w.synonyms || []).length > 0 && <div><span style={{ fontWeight: 700, color: "#8FD6C4" }}>≈</span> {w.synonyms.join(", ")}</div>}
                {(w.antonyms || []).length > 0 && <div><span style={{ fontWeight: 700, color: "#F2A99A" }}>↔</span> {w.antonyms.join(", ")}</div>}
              </div>
            )}
            {w.memoryHook && (
              <div style={{ fontSize: 13.5, marginTop: 12, color: "#F2D9A0", fontStyle: "italic", lineHeight: 1.5 }}>
                💡 {w.memoryHook}
              </div>
            )}
            {w.etymology && (
              <div style={{ fontSize: 13.5, marginTop: 10, color: "#E8E2D4", borderTop: "1px solid rgba(255,255,255,0.18)", paddingTop: 10, lineHeight: 1.55, textAlign: "left" }}>
                <span style={{ fontWeight: 700, color: "#FFFFFF" }}>{t("📜 Προέλευση:", "📜 Origin:")}</span> {w.etymology}
              </div>
            )}
            {w.funFact && (
              <div style={{ fontSize: 13.5, marginTop: 10, color: "#F2D9A0", borderTop: "1px solid rgba(255,255,255,0.18)", paddingTop: 10, lineHeight: 1.55, textAlign: "left" }}>
                <span style={{ fontWeight: 700, color: "#FFC877" }}>🌟 {t("Wissenswert:", "Good to know:")}</span> {w.funFact}
              </div>
            )}
          </div>
        )}
      </div>
      {flipped && (
        <div className="ww-pop" style={{ display: "flex", gap: 8, width: "100%", maxWidth: 340 }}>
          <button
            onClick={() => onAnswer(false, 1, { mode: "flashcard", selfRating: "Nochmal", prompt: w.word, answer: "Nochmal", responseTime: now() - questionStart.current })}
            style={{ flex: 1, padding: "10px 4px", borderRadius: 12, border: "1px solid #F0C9C2", background: "rgba(224,88,74,0.12)", color: "#E0584A", fontWeight: 600, fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
          >
            <span>Nochmal</span>
            <span style={{ fontSize: 10.5, fontWeight: 400, opacity: 0.8 }}>{t("Ξανά σύντομα", "Again soon")}</span>
          </button>
          <button
            onClick={() => onAnswer(true, 1, { mode: "flashcard", selfRating: "Gut", prompt: w.word, answer: "Gut", responseTime: now() - questionStart.current })}
            style={{ flex: 1, padding: "10px 4px", borderRadius: 12, border: "1px solid #C8E0C5", background: "rgba(111,169,107,0.12)", color: "#6FA96B", fontWeight: 600, fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
          >
            <span>Gut</span>
            <span style={{ fontSize: 10.5, fontWeight: 400, opacity: 0.85 }}>{t("Καλά", "Good")}</span>
          </button>
          <button
            onClick={() => onAnswer(true, 2, { mode: "flashcard", selfRating: "Super", prompt: w.word, answer: "Super", responseTime: now() - questionStart.current })}
            style={{ flex: 1, padding: "10px 4px", borderRadius: 12, border: "1px solid #E8D6B0", background: "rgba(203,145,70,0.15)", color: "#CB9146", fontWeight: 600, fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
          >
            <span>Super</span>
            <span style={{ fontSize: 10.5, fontWeight: 400, opacity: 0.85 }}>{t("Άνετα", "Easy")}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function McQ({ item, allWords, onAnswer }) {
  const { lang, t } = useAppLang();
  const w = item.word;
  const [picked, setPicked] = useState(null);
  const questionStart = useRef(now());
  const continueRef = useRef(null);
  const correctList = wordPrimaryMeanings(w, lang);
  const correctAnswer = correctList[0] || "—";
  const options = useMemo(() => {
    const correct = wordPrimaryMeanings(w, lang)[0] || "—";
    const distractorPool = shuffle(
      allWords.filter((x) => x.word !== w.word && wordPrimaryMeanings(x, lang)[0] && wordPrimaryMeanings(x, lang)[0] !== correct)
    ).slice(0, 3).map((x) => wordPrimaryMeanings(x, lang)[0]);
    return shuffle([correct, ...distractorPool]);
  }, [w.word, lang]);

  useEffect(() => {
    if (picked) continueRef.current?.focus();
  }, [picked]);

  function pick(opt) {
    if (picked) return;
    setPicked(opt);
  }

  const isCorrect = picked === correctAnswer;
  const allMeanings = correctList.join(" · ");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div className="ww-tag-card ww-pop" style={{ width: "100%", maxWidth: 340, padding: "24px 20px", textAlign: "center" }}>
        <div className="ww-tag-hole" />
        <InfoButton word={w} onHelp={() => { item.helpUsed = true; }} />
        <Pill color="#4FA091" bg="rgba(79,160,145,0.15)">{w.cefr ? w.cefr + " · " : ""}{typeLabel(w.type)}</Pill>
        <div className="ww-display" style={{ fontSize: 28, fontWeight: 600, marginTop: 12 }}>
          {w.word}
        </div>
        <div style={{ fontSize: 12, color: "#A79F8E", marginTop: 6 }}>
          {t("Was bedeutet das?", "What does this mean?")}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", maxWidth: 340 }}>
        {options.map((opt, i) => {
          let bg = "#FFFFFF", border = "#E8E0CE", color = "#211F1C";
          if (picked) {
            if (opt === correctAnswer) { bg = "rgba(111,169,107,0.18)"; border = "#6FA96B"; color = "#3F8C5F"; }
            else if (opt === picked) { bg = "rgba(224,88,74,0.18)"; border = "#E0584A"; color = "#E0584A"; }
          }
          return (
            <button
              key={i}
              onClick={() => pick(opt)}
              disabled={!!picked}
              style={{
                padding: "14px 10px", borderRadius: 12, background: bg,
                border: `1px solid ${border}`, color, fontSize: 13.5, fontWeight: 500,
                minHeight: 56, cursor: picked ? "default" : "pointer",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {picked && (
        <div
          className="ww-pop"
          style={{
            width: "100%", maxWidth: 340, padding: "12px 14px", borderRadius: 12,
            background: isCorrect ? "rgba(111,169,107,0.10)" : "rgba(224,88,74,0.09)",
            border: `1px solid ${isCorrect ? "#C8E0C5" : "#F0C9C2"}`,
            borderLeft: `3.5px solid ${isCorrect ? "#3F8C5F" : "#E0584A"}`,
            fontSize: 13, lineHeight: 1.5, color: "#211F1C",
          }}
        >
          <div style={{ fontWeight: 700, color: isCorrect ? "#3F8C5F" : "#E0584A" }}>
            {isCorrect ? t("✓ Σωστά!", "✓ Correct!") : t(`Λάθος — σωστό: ${correctAnswer}`, `Incorrect — correct: ${correctAnswer}`)}
          </div>
          {allMeanings && (correctList.length > 1 || !isCorrect) && (
            <div style={{ color: "#4A453D", marginTop: 3 }}>{allMeanings}</div>
          )}
          {w.examples?.[0]?.de && (
            <div style={{ fontSize: 12, color: "#8B8680", marginTop: 5 }}>
              „{w.examples[0].de}“ {(lang === "en" ? (w.examples[0].en || w.examples[0].el) : w.examples[0].el) ? `— ${lang === "en" ? (w.examples[0].en || w.examples[0].el) : w.examples[0].el}` : ""}
            </div>
          )}
          {!isCorrect && w.memoryHook && (
            <div style={{ fontSize: 12, color: "#B07A2A", marginTop: 5 }}>💡 {w.memoryHook}</div>
          )}
        </div>
      )}
      {picked && (
        <button
          ref={continueRef}
          onClick={() => onAnswer(isCorrect, 1, { mode: "mc", exact: isCorrect, status: isCorrect ? "exact" : "wrong", prompt: w.word, answer: picked, hintUsed: !!item.helpUsed, responseTime: now() - questionStart.current })}
          style={{ width: "100%", maxWidth: 340, padding: "14px 0", borderRadius: 12, background: "#211F1C", border: "none", color: "#F5F0E6", fontWeight: 700, fontSize: 14 }}
        >
          {t("Συνέχεια", "Continue")}
        </button>
      )}
    </div>
  );
}

function FillQ({ item, onAnswer, testMode = false }) {
  const { lang, t } = useAppLang();
  const w = item.word;
  const [value, setValue] = useState("");
  const questionStart = useRef(now());
  const [result, setResult] = useState(null);
  const [detail, setDetail] = useState(null);
  const [hint, setHint] = useState(false);
  const [articleValue, setArticleValue] = useState("");
  const continueRef = useRef(null);
  const target = (w.exercise && w.exercise.answer) || "";
  const parts = ((w.exercise && w.exercise.sentence) || "").split("______");
  const meaningHint = wordPrimaryMeanings(w, lang).join(", ");

  useEffect(() => {
    if (result) continueRef.current?.focus();
  }, [result]);

  function submit() {
    if (result || !value.trim()) return;
    const diag = diagnoseTyped(value, w, {
      target,
      contextArticle: articleValue,
      requireContextArticle: item.type === "context",
    });
    setDetail({ ...diag, hinted: hint, userAnswer: value.trim() });
    if (diag.status === "article") { setResult("article"); return; }
    if (diag.status === "exact") setResult(hint ? "hinted" : "exact");
    else if (diag.status === "near") setResult("near");
    else setResult("wrong");
  }
  function finish() {
    const targetArt = leadingArticle(target);
    const articleOk = !w.article || (item.type === "context" ? articleValue.toLowerCase() === String(w.article).toLowerCase() : (!targetArt || leadingArticle(value) === targetArt));
    const ok = result === "exact" || result === "near" || result === "hinted";
    onAnswer(ok, result === "exact" ? 1 : 0, { typed: true, exact: result === "exact" && !item.helpUsed, status: result, reason: detail?.reason, mode: item.type === "context" ? "context" : item.type, prompt: item.type === "recall" ? wordPrimaryMeanings(w, lang).join(" · ") : w.exercise?.sentence, answer: value, hintUsed: hint || !!item.helpUsed, articleCorrect: articleOk, responseTime: now() - questionStart.current, newContext: !!item.newContext });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div className="ww-tag-card ww-pop" style={{ width: "100%", maxWidth: 340, padding: "24px 20px", textAlign: "center" }}>
        <InfoButton word={w} onHelp={() => { item.helpUsed = true; }} />
        <Pill color="#C1543C" bg="rgba(193,84,60,0.15)">{w.cefr ? w.cefr + " · " : ""}{item.type === "context" ? t("Νέο συμφραζόμενο", "New context") : "Lückentext"}</Pill>
        <div style={{ fontSize: 17, marginTop: 14, lineHeight: 1.6 }}>
          {parts[0]}
          {result ? (
            <strong style={{ color: typedBorder(result), borderBottom: `2px solid ${typedBorder(result)}`, padding: "0 3px" }}>{target}</strong>
          ) : (
            <span style={{ borderBottom: "2px solid #A79F8E", padding: "0 4px", color: "#A79F8E" }}>____</span>
          )}
          {parts[1]}
        </div>
        <div style={{ fontSize: 11.5, color: "#A79F8E", marginTop: 8 }}>
          ({meaningHint})
        </div>
      </div>
      {item.type === "context" && w.article && <select aria-label={t("Άρθρο", "Article")} value={articleValue} onChange={e => setArticleValue(e.target.value)} disabled={!!result} className="border border-input bg-background text-foreground rounded-md p-2"><option value="">{t("Άρθρο", "Article")}</option><option>der</option><option>die</option><option>das</option></select>}
      {!result && !testMode && <HintBar show={hint} text={makeHint(target, lang)} onShow={() => setHint(true)} />}
      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 340 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={!!result}
          placeholder={t("Antwort eingeben...", "Type your answer...")}
          autoCapitalize="off"
          autoCorrect="off"
          style={{
            flex: 1, padding: "16px 16px", borderRadius: 12, fontWeight: 600,
            border: `1.5px solid ${typedBorder(result)}`,
            background: "#FFFFFF", color: "#211F1C", fontSize: 17, outline: "none",
          }}
        />
        {!result && (
          <button onClick={submit} style={{ padding: "0 18px", borderRadius: 12, background: "#CB9146", border: "none", color: "#211F1C", fontWeight: 600 }}>
            OK
          </button>
        )}
      </div>
      {result && <TypedFeedback result={result} answer={target} detail={detail} word={w} />}
      {result && (
        <button ref={continueRef} onClick={finish} style={{ width: "100%", maxWidth: 340, padding: "14px 0", borderRadius: 12, background: "#211F1C", border: "none", color: "#F5F0E6", fontWeight: 700, fontSize: 14 }}>
          {t("Συνέχεια", "Continue")}
        </button>
      )}
    </div>
  );
}

function RecallQ({ item, onAnswer, allWords, testMode }) {
  const { lang, t } = useAppLang();
  const w = item.word;
  const [value, setValue] = useState("");
  const questionStart = useRef(now());
  const [result, setResult] = useState(null);
  const [hint, setHint] = useState(false);
  const [synonymFirst, setSynonymFirst] = useState(false);
  const [detail, setDetail] = useState(null);
  const continueRef = useRef(null);
  const promptText = wordPrimaryMeanings(w, lang).join(" · ");

  useEffect(() => {
    if (result) continueRef.current?.focus();
  }, [result]);

  function submit() {
    if (result || !value.trim()) return;
    const diag = diagnoseTyped(value, w, { allWords });
    if (diag.status === "synonym") {
      if (testMode || synonymFirst) { setResult("synonym"); setDetail({ ...diag, userAnswer: value.trim() }); return; }
      setSynonymFirst(true); setValue(""); return;
    }
    const usedHint = hint;
    setDetail({ ...diag, hinted: usedHint, userAnswer: value.trim() });
    if (diag.status === "article") { setResult("article"); return; }
    if (diag.status === "exact") setResult(usedHint ? "hinted" : "exact");
    else if (diag.status === "near") setResult("near");
    else setResult("wrong");
  }
  function finish() {
    if (result === "synonym") { onAnswer(false, 0, { typed: true, exact: false, status: "synonym", reason: "synonym", neutral: true, mode: "recall", prompt: promptText, answer: value, responseTime: now() - questionStart.current }); return; }
    const ok = result === "exact" || result === "near" || result === "hinted";
    const exactOk = result === "exact" && !hint && !item.helpUsed;
    onAnswer(ok, exactOk ? 1 : 0, { typed: true, exact: exactOk, status: result, reason: detail?.reason, mode: item.type === "context" ? "context" : item.type, prompt: item.type === "recall" ? promptText : w.exercise?.sentence, answer: value, hintUsed: hint || !!item.helpUsed, articleCorrect: !w.article || leadingArticle(value) === String(w.article).toLowerCase(), responseTime: now() - questionStart.current, newContext: !!item.newContext });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div className="ww-tag-card ww-pop" style={{ width: "100%", maxWidth: 340, padding: "24px 20px", textAlign: "center" }}>
        <InfoButton word={w} onHelp={() => { item.helpUsed = true; }} />
        <Pill color="#8B7BC7" bg="rgba(139,123,199,0.15)">{testMode ? t("Τεστ", "Test") : t("Ενεργητική ανάκληση", "Active recall")} · {w.cefr ? w.cefr + " · " : ""}{typeLabel(w.type)}</Pill>
        <div className="ww-display" style={{ fontSize: 22, fontWeight: 600, marginTop: 14 }}>
          {promptText}
        </div>
        <div style={{ fontSize: 12, color: "#A79F8E", marginTop: 8 }}>
          {t("Γράψε τη γερμανική λέξη (με άρθρο, αν είναι ουσιαστικό)", "Type the German word (with article if it's a noun)")}
        </div>
      </div>
      {synonymFirst && !result && (
        <div className="ww-pop" style={{ fontSize: 13.5, color: "#B07A2A", textAlign: "center", maxWidth: 340, lineHeight: 1.5 }}>
          {t("✓ Δεκτό συνώνυμο! Ψάχνουμε όμως άλλη λέξη — δοκίμασε ξανά (χωρίς ποινή).", "✓ Valid synonym! We're looking for a different word — try again (no penalty).")}
        </div>
      )}
      {!result && !testMode && <HintBar show={hint} text={makeHint(w.word, lang)} onShow={() => setHint(true)} />}
      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 340 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={!!result}
          placeholder={t("z. B. der Tisch", "e.g. der Tisch")}
          autoCapitalize="off"
          autoCorrect="off"
          style={{
            flex: 1, padding: "16px 16px", borderRadius: 12, fontWeight: 600,
            border: `1.5px solid ${typedBorder(result)}`,
            background: "#FFFFFF", color: "#211F1C", fontSize: 17, outline: "none",
          }}
        />
        {!result && (
          <button onClick={submit} style={{ padding: "0 18px", borderRadius: 12, background: "#8B7BC7", border: "none", color: "#211F1C", fontWeight: 600 }}>
            OK
          </button>
        )}
      </div>
      {result && <TypedFeedback result={result} answer={w.word} detail={detail} word={w} />}
      {result && (
        <button ref={continueRef} onClick={finish} style={{ width: "100%", maxWidth: 340, padding: "14px 0", borderRadius: 12, background: "#211F1C", border: "none", color: "#F5F0E6", fontWeight: 700, fontSize: 14 }}>
          {t("Συνέχεια", "Continue")}
        </button>
      )}
    </div>
  );
}

function pickIntensiveType(word) {
  if (!isPreviouslyKnown(word) && masteryScheduleState(word, now()).inWindow) {
    return preferredActiveGameForWord(word);
  }
  const seen = (word.learning && word.learning.timesSeen) || 0;
  if (seen === 0) return "flashcard";
  const cycle = ["mc"];
  if (hasFillExercise(word)) cycle.push("fill");
  if (findContextExample(word)) cycle.push("context");
  cycle.push("recall");
  return cycle[seen % cycle.length];
}

function IntensiveSession({ initialWords, onUpdateWords, onFinish, onExit, distractorPool }) {
  const ctx = useContext(AppCtx);
  const { t } = useAppLang();
  const [liveWords, setLiveWords] = useState(() => initialWords.map((w) => ({ ...w })));
  const [currentItem, setCurrentItem] = useState(null);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const startTimeRef = useRef(now());
  const sessionId = useRef(crypto.randomUUID());
  const liveRef = useRef(liveWords);
  liveRef.current = liveWords;

  const remaining = liveWords.filter((w) => !isMasteredToday(w));
  const batch = todayBatchProgress(liveWords);
  const masteredCount = batch.completed;

  useEffect(() => {
    if (remaining.length === 0) { setDone(true); return; }
    if (!currentItem) {
      const next = trueShuffle(remaining)[0];
      setCurrentItem(buildPracticeQuestion(next, pickIntensiveType(next)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem, liveWords]);

  if (done) {
    const elapsedMs = now() - startTimeRef.current;
    return (
      <div className="ww-pop" style={{ padding: "40px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 88, height: 88, borderRadius: "50%", border: "4px solid #6FA96B", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="ww-display" style={{ fontSize: 30, fontWeight: 700 }}>✓</span>
        </div>
        <div className="ww-display" style={{ fontSize: 22, fontWeight: 600 }}>
          {t("Η σημερινή εξάσκηση ολοκληρώθηκε!", "Today's practice is complete!")}
        </div>
        <div style={{ fontSize: 13.5, color: "#8B8680" }}>
          {t(`${liveWords.length} λέξεις εξασκήθηκαν· η κατάκτηση κρίνεται χωριστά.`, `${liveWords.length} words practiced; mastery is verified separately.`)}
        </div>
        <button
          onClick={() => { onUpdateWords(liveWords); onFinish({ elapsedMs, masteredCount: liveWords.length, total: liveWords.length }); }}
          style={{ marginTop: 10, padding: "13px 30px", borderRadius: 999, background: "#CB9146", border: "none", color: "#211F1C", fontWeight: 700, fontSize: 14 }}
        >
          {t("Τέλεια!", "Awesome!")}
        </button>
      </div>
    );
  }
  if (!currentItem) return null;

  const baseCurrentWord = liveWords.find((w) => w.id === currentItem.word.id) || currentItem.word;

  function handleAnswer(correct, boost, info) {
    const inf = info || {};
    const updated = applyAnswer(baseCurrentWord, correct, boost, { ...inf, mode: currentItem.type, context: currentItem.context || inf.prompt, contextId: `${currentItem.context || inf.prompt}`, sessionId: sessionId.current });
    const nextLive = liveRef.current.map((w) => (w.id === updated.id ? updated : w));
    setLiveWords(nextLive);
    onUpdateWords(nextLive);
    setRound((r) => r + 1);
    setCurrentItem(null);
  }

  const todayStats = todayAccuracy(baseCurrentWord);
  const pct = Math.round(todayStats.pct * 100);
  const mcWords = distractorPool && distractorPool.length >= 4 ? distractorPool : liveWords;

  return (
    <div style={{ padding: "6px 18px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div style={{ width: "100%", maxWidth: 340, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onExit} style={{ background: "none", border: "none", color: "#8B8680", fontSize: 12.5, padding: 0 }}>{t("← Έξοδος", "← Exit")}</button>
        <span className="ww-mono" style={{ fontSize: 11.5, color: "#8B8680" }}>
          {masteredCount}/{liveWords.length} {t("σημερινή εξάσκηση 90%+", "today's practice 90%+")} · {batch.pct}%
        </span>
      </div>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ height: 5, background: "#ECE4D3", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${batch.pct}%`, background: "#6FA96B", transition: "width 0.3s" }} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#8B8680", textAlign: "center" }}>
        {t("«", "“")}{baseCurrentWord.word}{t("» — σήμερα:", "” — today:")} <strong>{todayStats.attempts}/5</strong> {t("βαθμολογημένες", "graded")} · <strong style={{ color: pct >= 90 ? "#6FA96B" : "#CB9146" }}>{pct}%</strong>
      </div>
      {currentItem.type === "flashcard" && <FlashcardQ key={round} item={currentItem} onAnswer={handleAnswer} />}
      {currentItem.type === "mc" && <McQ key={round} item={currentItem} allWords={mcWords} onAnswer={handleAnswer} />}
      {["fill", "context"].includes(currentItem.type) && <FillQ key={round} item={currentItem} onAnswer={handleAnswer} />}
      {currentItem.type === "recall" && <RecallQ key={round} item={currentItem} allWords={ctx.vocab} onAnswer={handleAnswer} />}
    </div>
  );
}

function VocabSession({ vocab, mode, onFinish, onUpdateWords, customWords, size = 10, distractorPool, scopeLabel, onExit }) {
  const ctx = useContext(AppCtx);
  const { t } = useAppLang();
  const words = useMemo(() => customWords || pickRoundWords(vocab, size, mode), []);
  const questions = useMemo(() => buildQuestions(words, mode), [words, mode]);
  const [idx, setIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [scored, setScored] = useState(0);
  const [outcomes, setOutcomes] = useState([]);
  const [updates, setUpdates] = useState({});
  const startTimeRef = useRef(now());
  const sessionId = useRef(crypto.randomUUID());

  if (questions.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#8B8680" }}>
        <div>{t("Δεν βρέθηκαν διαθέσιμες λέξεις για αυτή την εξάσκηση.", "No available words found for this practice.")}</div>
        {onExit && (
          <button onClick={onExit} style={{ marginTop: 14, padding: "10px 20px", borderRadius: 999, background: "#ECE4D3", border: "none", color: "#211F1C", fontWeight: 600, fontSize: 13 }}>
            {t("Επιστροφή", "Back")}
          </button>
        )}
      </div>
    );
  }

  const item = questions[idx];
  const mcWords = distractorPool && distractorPool.length >= 4 ? distractorPool : vocab;

  function handleAnswer(correct, boost, info) {
    const inf = info || {};
    const neutral = !!inf.neutral || item.type === "flashcard";
    const updatedWord = applyAnswer(updates[item.word.id] || vocab.find(w => w.id === item.word.id) || item.word, correct, boost, { ...inf, mode: item.type, context: item.context || inf.prompt, contextId: `${item.context || inf.prompt}`, sessionId: sessionId.current });
    const newUpdates = { ...updates, [item.word.id]: updatedWord };
    const newScored = scored + (neutral ? 0 : 1);
    const newCorrect = correctCount + (correct && !neutral ? 1 : 0);
    const status = inf.status || (correct ? "exact" : "wrong");
    const nextOutcomes = neutral
      ? outcomes
      : [...outcomes, { word: updatedWord, status, exact: !!inf.exact, ok: correct, reason: inf.reason, userAnswer: inf.answer }];
    setUpdates(newUpdates);
    onUpdateWords(newUpdates);
    setScored(newScored);
    setCorrectCount(newCorrect);
    setOutcomes(nextOutcomes);
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
    } else {
      onUpdateWords(newUpdates);
      onFinish({ total: newScored, exposures: questions.filter(q => q.type === "flashcard").length, correct: newCorrect, elapsedMs: now() - startTimeRef.current, outcomes: nextOutcomes });
    }
  }

  return (
    <div style={{ padding: "6px 18px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#A79F8E", marginBottom: 6, gap: 8 }}>
          {onExit ? (
            <button onClick={onExit} style={{ background: "none", border: "none", color: "#8B8680", fontSize: 12.5, padding: 0 }}>{t("← Έξοδος", "← Exit")}</button>
          ) : (
            <span className="ww-mono">{idx + 1} / {questions.length}</span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {scopeLabel && <Pill color="#4FA091" bg="rgba(79,160,145,0.14)">{scopeLabel}</Pill>}
            <span className="ww-mono">{idx + 1} / {questions.length} · {correctCount} {t("σωστά", "correct")}</span>
          </div>
        </div>
        <div style={{ height: 5, background: "#ECE4D3", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(idx / questions.length) * 100}%`, background: "#CB9146", transition: "width 0.3s" }} />
        </div>
      </div>
      {item.type === "flashcard" && <FlashcardQ key={idx} item={item} onAnswer={handleAnswer} />}
      {item.type === "mc" && <McQ key={idx} item={item} allWords={mcWords} onAnswer={handleAnswer} />}
      {["fill", "context"].includes(item.type) && <FillQ key={idx} item={item} onAnswer={handleAnswer} />}
      {item.type === "recall" && <RecallQ key={idx} item={item} allWords={ctx.vocab || vocab} onAnswer={handleAnswer} />}
    </div>
  );
}

function FavStar({ word, size = 15, style }) {
  const ctx = useContext(AppCtx);
  const { t } = useAppLang();
  const live = (ctx.vocab || []).find((x) => x.id === word.id) || word;
  const on = !!live.fav;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); ctx.toggleFav(word.id); }}
      aria-label={t("Αγαπημένο", "Favorite")}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", ...(style || {}) }}
    >
      <Star size={size} fill={on ? "#CB9146" : "none"} color={on ? "#CB9146" : "#A79F8E"} />
    </button>
  );
}

function nearReasonText(reason, detail, lang = "el") {
  if (lang === "en") {
    if (reason === "umlaut") return "Watch the umlauts (ä / ö / ü).";
    if (reason === "eszett") return "Watch the ß letter (instead of ss).";
    if (reason === "typo") return "Minor typo (1 character).";
    if (reason === "article_missing") return `Remember the article${detail?.article ? ` (${detail.article})` : ""}.`;
    if (reason === "article_wrong") return detail?.inputArticle && detail?.article ? `You wrote “${detail.inputArticle}” instead of “${detail.article}”.` : "Wrong article.";
    if (reason === "lemma") return "You typed the base form — this sentence needs the inflected form.";
    if (reason === "synonym") return "Valid synonym, though we are testing the target word here.";
    return "";
  }
  if (reason === "umlaut") return "Προσοχή στα διαλυτικά (ä / ö / ü).";
  if (reason === "eszett") return "Προσοχή στο γράμμα ß (αντί για ss).";
  if (reason === "typo") return "Μικρό τυπογραφικό λάθος (1 γράμμα).";
  if (reason === "article_missing") return `Θυμήσου και το άρθρο${detail?.article ? ` (${detail.article})` : ""}.`;
  if (reason === "article_wrong") return detail?.inputArticle && detail?.article ? `Έγραψες «${detail.inputArticle}» αντί για «${detail.article}».` : "Λάθος άρθρο.";
  if (reason === "lemma") return "Έγραψες τη βασική μορφή — εδώ χρειάζεται η μορφή της πρότασης.";
  if (reason === "synonym") return "Δεκτό συνώνυμο, αλλά εδώ ζητάμε τη λέξη-στόχο.";
  return "";
}

function TypedFeedback({ result, answer, note, detail, word }) {
  const { lang, t } = useAppLang();
  const green = "#3F8C5F", amber = "#B07A2A", red = "#E0584A";
  const reason = detail?.reason;
  const userAnswer = detail?.userAnswer;
  const hinted = !!detail?.hinted;
  const reasonLine = nearReasonText(reason, detail, lang) || (note === "article" ? t("Θυμήσου και το άρθρο.", "Remember the article.") : "");

  const box = (color, bg, border, title, extra) => (
    <div
      className="ww-pop"
      style={{
        width: "100%", maxWidth: 340, padding: "12px 14px", borderRadius: 12,
        background: bg, border: `1px solid ${border}`, borderLeft: `3.5px solid ${color}`,
        fontSize: 13.5, color: "#211F1C", textAlign: "left", lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 700, color }}>{title}</div>
      {extra}
    </div>
  );

  if (result === "exact") {
    return box(
      green, "rgba(111,169,107,0.10)", "#C8E0C5",
      t("✓ Σωστά!", "✓ Correct!"),
      <>
        {detail?.isReflexiveMissing && (
          <div style={{ fontSize: 12, color: "#4A453D", marginTop: 3 }}>
            {t("Σημείωση: αυτοπαθές ρήμα", "Note: reflexive verb")} (<strong>{word?.word}</strong>).
          </div>
        )}
        {word?.examples?.[0]?.de && word.word !== answer && (
          <div style={{ fontSize: 12, color: "#8B8680", marginTop: 4 }}>„{word.examples[0].de}“</div>
        )}
      </>
    );
  }

  const primaryMeanings = wordPrimaryMeanings(word, lang);
  const reinforcement = word && (
    <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(0,0,0,0.07)", fontSize: 12, color: "#4A453D" }}>
      {primaryMeanings.length > 0 && <div>{primaryMeanings.join(" · ")}</div>}
      {word.memoryHook && <div style={{ color: "#8B6928", marginTop: 2 }}>💡 {word.memoryHook}</div>}
    </div>
  );

  if (result === "near") {
    return box(
      amber, "rgba(203,145,70,0.11)", "#E8D6B0",
      t(`Σχεδόν σωστά!${hinted ? " (με υπόδειξη)" : ""}`, `Almost right!${hinted ? " (with hint)" : ""}`),
      <>
        {reasonLine && <div style={{ fontSize: 12.5, color: "#8B6928", marginTop: 2 }}>{reasonLine}</div>}
        {userAnswer && <div style={{ fontSize: 12.5, color: "#8B8680", marginTop: 4 }}>{t(`Έγραψες: «${userAnswer}»`, `You wrote: “${userAnswer}”`)}</div>}
        <div style={{ fontSize: 13.5, marginTop: 2 }}>{t("Σωστή γραφή:", "Correct spelling:")} <strong style={{ fontSize: 16 }}>{answer}</strong></div>
        {reinforcement}
      </>
    );
  }
  if (result === "hinted") {
    return box(
      amber, "rgba(203,145,70,0.11)", "#E8D6B0",
      t("Σωστά, αλλά με υπόδειξη — δεν ανεβάζει τη γνώση", "Correct with hint — does not count toward mastery"),
      <>
        <div style={{ fontSize: 13.5, marginTop: 3 }}>{t("Απάντηση:", "Answer:")} <strong style={{ fontSize: 16 }}>{answer}</strong></div>
        {reinforcement}
      </>
    );
  }
  if (result === "article") {
    return box(
      red, "rgba(224,88,74,0.09)", "#F0C9C2",
      t("Σωστή λέξη, λάθος άρθρο", "Right word, wrong article"),
      <>
        {reasonLine && <div style={{ fontSize: 12.5, color: "#B84336", marginTop: 2 }}>{reasonLine}</div>}
        <div style={{ fontSize: 13.5, marginTop: 4 }}>{t("Σωστό:", "Correct:")} <strong style={{ fontSize: 16 }}>{answer}</strong></div>
        {reinforcement}
      </>
    );
  }
  if (result === "synonym") {
    return box(
      amber, "rgba(203,145,70,0.11)", "#E8D6B0",
      t("Συνώνυμο — μετράει μόνο η λέξη-στόχος", "Synonym — only the target word counts"),
      <>
        {userAnswer && <div style={{ fontSize: 12.5, color: "#8B8680", marginTop: 3 }}>{t(`Έγραψες: «${userAnswer}»`, `You wrote: “${userAnswer}”`)}</div>}
        <div style={{ fontSize: 13.5, marginTop: 2 }}>{t("Στόχος:", "Target:")} <strong style={{ fontSize: 16 }}>{answer}</strong></div>
        {reinforcement}
      </>
    );
  }
  return box(
    red, "rgba(224,88,74,0.09)", "#F0C9C2",
    t("Λάθος απάντηση", "Incorrect answer"),
    <>
      {reasonLine && <div style={{ fontSize: 12.5, color: "#B84336", marginTop: 2 }}>{reasonLine}</div>}
      {userAnswer && <div style={{ fontSize: 12.5, color: "#8B8680", marginTop: 3 }}>{t(`Έγραψες: «${userAnswer}»`, `You wrote: “${userAnswer}”`)}</div>}
      <div style={{ fontSize: 13.5, marginTop: 2 }}>{t("Σωστό:", "Correct:")} <strong style={{ fontSize: 16 }}>{answer}</strong></div>
      {reinforcement}
    </>
  );
}

function typedBorder(result) {
  if (result === "exact") return "#6FA96B";
  if (result === "near" || result === "hinted" || result === "synonym") return "#CB9146";
  if (result === "wrong" || result === "article") return "#E0584A";
  return "#E8E0CE";
}

function HintBar({ show, text, onShow }) {
  const { t } = useAppLang();
  if (show) {
    return <div className="ww-mono" style={{ fontSize: 14, color: "#8B7BC7", letterSpacing: 1, textAlign: "center" }}>💡 {text}</div>;
  }
  return (
    <button onClick={onShow} style={{ background: "none", border: "1px dashed #D9CFEF", color: "#8B7BC7", borderRadius: 999, padding: "6px 14px", fontSize: 12.5 }}>
      {t("💡 Υπόδειξη (πρώτο γράμμα)", "💡 Hint (first letter)")}
    </button>
  );
}

const TEST_GAME_LABELS = {
  flashcard: { el: "Κάρτα", en: "Flashcard" },
  mc: { el: "Πολλαπλή επιλογή", en: "Multiple Choice" },
  fill: { el: "Κενό", en: "Fill Blank" },
  context: { el: "Συμφραζόμενο", en: "Context" },
  recall: { el: "Γράψιμο", en: "Typed Recall" },
};

function TestSession({ words, onFinish, onUpdateWords, onExit, scope = "all", distractorPool }) {
  const ctx = useContext(AppCtx);
  const { lang, t } = useAppLang();
  const questions = useMemo(() => buildAllGamesQuestions(words, { shuffleOrder: true }), [words]);
  const [idx, setIdx] = useState(0);
  const [tally, setTally] = useState({ exact: 0, near: 0, synonym: 0, wrong: 0, exposures: 0 });
  const [missed, setMissed] = useState([]);
  const [synonymWords, setSynonymWords] = useState([]);
  const [updates, setUpdates] = useState({});
  const [summary, setSummary] = useState(null);
  const startRef = useRef(now());
  const sessionId = useRef(crypto.randomUUID());
  const gameLabel = (g) => (TEST_GAME_LABELS[g] ? (lang === "en" ? TEST_GAME_LABELS[g].en : TEST_GAME_LABELS[g].el) : g);

  function handle(correct, boost, info) {
    const inf = info || {};
    const item = questions[idx];
    const w = item.word;
    const baseWord = updates[w.id] || (ctx.vocab || []).find((x) => x.id === w.id) || w;
    const isFlashcard = item.type === "flashcard";
    const st = inf.status || (correct ? "exact" : "wrong");
    const nt = { ...tally };
    let nm = missed, ns = synonymWords;

    if (isFlashcard) {
      nt.exposures += 1;
      if (!correct) {
        nm = [...missed, { word: baseWord, status: "flashcard", answer: inf.selfRating || "Nochmal", game: item.type }];
      }
    } else if (st === "exact") {
      nt.exact += 1;
    } else if (st === "near") {
      nt.near += 1;
    } else if (st === "synonym") {
      nt.synonym += 1;
      ns = [...synonymWords, baseWord];
    } else {
      nt.wrong += 1;
      nm = [...missed, { word: baseWord, status: st, answer: inf.answer, game: item.type }];
    }

    const updatedWord = applyAnswer(baseWord, correct, boost, {
      ...inf,
      mode: item.type,
      context: item.context || inf.prompt,
      contextId: `${item.context || inf.prompt}`,
      sessionId: sessionId.current,
    });
    const nu = { ...updates, [baseWord.id]: updatedWord };
    onUpdateWords(nu);
    setTally(nt); setMissed(nm); setSynonymWords(ns); setUpdates(nu);

    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
    } else {
      onUpdateWords(nu);
      const scored = nt.exact + nt.near + nt.wrong;
      setSummary({
        total: scored || questions.length,
        scored,
        questionsTotal: questions.length,
        exposures: nt.exposures,
        exact: nt.exact,
        near: nt.near,
        synonym: nt.synonym,
        wrong: nt.wrong,
        missed: nm,
        synonymWords: ns,
        scope,
        elapsedMs: now() - startRef.current,
      });
    }
  }

  if (summary) {
    const pct = summary.scored > 0 ? Math.round(((summary.exact + summary.near) / summary.scored) * 100) : 100;
    return (
      <div className="ww-pop" style={{ padding: "28px 20px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ width: 96, height: 96, borderRadius: "50%", border: `4px solid ${pct >= 80 ? "#6FA96B" : pct >= 50 ? "#CB9146" : "#E0584A"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="ww-display" style={{ fontSize: 28, fontWeight: 700 }}>{pct}%</span>
        </div>
        <div className="ww-display" style={{ fontSize: 20, fontWeight: 600 }}>
          {scope === "b2" ? t("Αποτέλεσμα τεστ B2", "B2 Test Result") : t("Αποτέλεσμα τεστ", "Test Result")}
        </div>
        <div style={{ fontSize: 13.5, color: "#4A453D", textAlign: "center", lineHeight: 1.7 }}>
          {t("Ακριβή:", "Exact:")} <strong>{summary.exact}</strong> · {t("Σχεδόν σωστά:", "Almost right:")} <strong>{summary.near}</strong> · {t("Λάθος:", "Wrong:")} <strong>{summary.wrong}</strong>
          {summary.scored > 0 ? <> ({t(`από ${summary.scored} βαθμολογημένες`, `of ${summary.scored} graded`)})</> : null}
          <br />
          {summary.exposures > 0 && <>{t("Κάρτες ανασκόπησης:", "Review flashcards:")} <strong>{summary.exposures}</strong></>}
          {summary.exposures > 0 && summary.synonym > 0 && " · "}
          {summary.synonym > 0 && <>{t("Συνώνυμα:", "Synonyms:")} <strong>{summary.synonym}</strong></>}
        </div>
        {summary.missed.length > 0 && (
          <div className="ww-tag-card" style={{ width: "100%", maxWidth: 340, padding: "14px 16px" }}>
            <div style={{ fontSize: 11.5, color: "#A79F8E", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{t("Για επανάληψη", "To review")}</div>
            {summary.missed.map((m, i) => (
              <div key={`${m.word.id || m.word.word}-${i}`} style={{ fontSize: 14, padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <div>
                  <strong>{m.word.word}</strong> <span style={{ color: "#8B8680" }}>— {wordPrimaryMeanings(m.word, lang)[0]}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#E0584A", marginTop: 2 }}>
                  {m.status === "article" ? t("Λάθος άρθρο", "Wrong article") : m.status === "flashcard" ? t("Κάρτα · Ξανά σύντομα", "Flashcard · Again soon") : t("Λάθος", "Wrong")}
                  {m.game ? ` (${gameLabel(m.game)})` : ""}
                  {m.status !== "flashcard" && m.answer ? t(` — έγραψες: «${m.answer}»`, ` — you wrote: “${m.answer}”`) : ""}
                </div>
              </div>
            ))}
          </div>
        )}
        {summary.synonymWords.length > 0 && (
          <div style={{ fontSize: 12.5, color: "#8B8680", textAlign: "center", maxWidth: 340, lineHeight: 1.5 }}>
            {t(
              `Έδωσες συνώνυμο για: ${summary.synonymWords.map((m) => m.word).join(", ")} — δεν μετρήθηκαν ως σωστά, ούτε ως λάθη.`,
              `You gave a synonym for: ${summary.synonymWords.map((m) => m.word).join(", ")} — counted as neither right nor wrong.`,
            )}
          </div>
        )}
        <button onClick={() => onFinish(summary)} style={{ marginTop: 6, padding: "13px 30px", borderRadius: 999, background: "#CB9146", border: "none", color: "#211F1C", fontWeight: 700, fontSize: 14 }}>
          {t("Τέλος", "Done")}
        </button>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#8B8680" }}>
        {t("Δεν υπάρχουν διαθέσιμες λέξεις για το τεστ.", "No available words for this test.")}
      </div>
    );
  }

  const item = questions[idx];
  const mcPool = distractorPool && distractorPool.length >= 4 ? distractorPool : ctx.vocab;

  return (
    <div style={{ padding: "6px 18px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#A79F8E", marginBottom: 6, gap: 6 }}>
          <button onClick={onExit} style={{ background: "none", border: "none", color: "#8B8680", fontSize: 12.5, padding: 0 }}>{t("← Έξοδος", "← Exit")}</button>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {scope === "b2" && <Pill color="#4FA091" bg="rgba(79,160,145,0.14)">{t("Μόνο B2", "B2 Only")}</Pill>}
            <span className="ww-mono">{gameLabel(item.type)} · {idx + 1} / {questions.length}</span>
          </div>
        </div>
        <div style={{ height: 5, background: "#ECE4D3", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(idx / questions.length) * 100}%`, background: "#8B7BC7", transition: "width 0.3s" }} />
        </div>
      </div>
      {item.type === "flashcard" && <FlashcardQ key={idx} item={item} onAnswer={handle} />}
      {item.type === "mc" && <McQ key={idx} item={item} allWords={mcPool} onAnswer={handle} />}
      {["fill", "context"].includes(item.type) && <FillQ key={idx} item={item} testMode onAnswer={handle} />}
      {item.type === "recall" && <RecallQ key={idx} item={item} allWords={ctx.vocab} testMode onAnswer={handle} />}
    </div>
  );
}

function nextStreak(meta) {
  const today = dateStr(now());
  let streak = meta.streak || 0;
  if (meta.lastPlayDate !== today) {
    streak = meta.lastPlayDate === dateStr(now() - DAY) ? streak + 1 : 1;
  }
  return { streak, lastPlayDate: today };
}

function PctBar({ pct, width = 120 }) {
  const idx = pct >= 85 ? 5 : pct >= 70 ? 4 : pct >= 50 ? 3 : pct >= 30 ? 2 : pct >= 10 ? 1 : 0;
  return (
    <div style={{ width, height: 5, background: "#ECE4D3", borderRadius: 999, overflow: "hidden", flexShrink: 0 }}>
      <div style={{ height: "100%", width: `${Math.max(pct, 6)}%`, background: CONFIDENCE_COLORS[idx], borderRadius: 999 }} />
    </div>
  );
}

async function storeGet(key) {
  try {
    if (typeof window !== "undefined" && window.storage && window.storage.get) {
      const r = await window.storage.get(key, false);
      return r && r.value ? r.value : null;
    }
  } catch (e) {
    return null;
  }
  try { return window.localStorage.getItem(key); } catch (e) { return null; }
}

async function storeSet(key, value) {
  try {
    if (typeof window !== "undefined" && window.storage && window.storage.set) {
      await window.storage.set(key, value, false);
      return;
    }
  } catch (e) {
    return;
  }
  try { window.localStorage.setItem(key, value); } catch (e) {}
}

function RoundResult({ result, onDone, onRetryMissed }) {
  const { lang, t } = useAppLang();
  const pct = result.total ? Math.round((result.correct / result.total) * 100) : 0;
  const msg = !result.total
    ? t("Κάρτες εξασκήθηκαν — χωρίς βαθμολογία", "Flashcards reviewed — ungraded")
    : pct >= 90
      ? t("Ausgezeichnet! 🎉", "Excellent! 🎉")
      : pct >= 70
        ? t("Stark gemacht! 💪", "Great job! 💪")
        : pct >= 40
          ? t("Gut dabei — weiter so!", "Good progress — keep going!")
          : t("Übung macht die Meisterin!", "Practice makes perfect!");
  const outcomes = result.outcomes || [];
  const exactCount = outcomes.filter((o) => o.status === "exact").length;
  const nearCount = outcomes.filter((o) => o.status === "near" || o.status === "hinted").length;
  const wrongItems = outcomes.filter((o) => o.status === "wrong" || o.status === "article");
  const reviewItems = outcomes.filter((o) => o.status !== "exact");
  const retryWords = Array.from(new Map(wrongItems.map((o) => [o.word.id, o.word])).values());

  return (
    <div className="ww-pop" style={{ padding: "32px 20px 30px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ width: 88, height: 88, borderRadius: "50%", border: `4px solid ${!result.total ? "#4FA091" : pct >= 80 ? "#6FA96B" : pct >= 50 ? "#CB9146" : "#E0584A"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="ww-display" style={{ fontSize: 26, fontWeight: 700 }}>{result.total ? `${pct}%` : result.exposures || 0}</span>
      </div>
      <div className="ww-display" style={{ fontSize: 20, fontWeight: 600 }}>{msg}</div>
      <div style={{ fontSize: 13, color: "#8B8680" }}>
        {result.total > 0
          ? t(`${result.correct} von ${result.total} richtig`, `${result.correct} of ${result.total} correct`)
          : t(`${result.exposures || 0} κάρτες ανασκόπησης`, `${result.exposures || 0} flashcards reviewed`)}
        {result.total > 0 && result.exposures > 0 ? t(` · +${result.exposures} κάρτες`, ` · +${result.exposures} cards`) : ""}
      </div>
      {outcomes.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <Pill color="#3F8C5F" bg="rgba(111,169,107,0.14)">✓ {exactCount} {t("ακριβή", "exact")}</Pill>
          {nearCount > 0 && <Pill color="#B07A2A" bg="rgba(203,145,70,0.14)">~ {nearCount} {t("σχεδόν", "almost")}</Pill>}
          {wrongItems.length > 0 && <Pill color="#E0584A" bg="rgba(224,88,74,0.14)">✕ {wrongItems.length} {t("λάθη", "wrong")}</Pill>}
        </div>
      )}
      {reviewItems.length > 0 && (
        <div className="ww-tag-card" style={{ width: "100%", maxWidth: 340, padding: "14px 16px", textAlign: "left" }}>
          <div style={{ fontSize: 11.5, color: "#A79F8E", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            {t("Για προσοχή / επανάληψη", "Needs attention / review")}
          </div>
          {reviewItems.map((o, i) => {
            const label =
              o.status === "article"
                ? t("λάθος άρθρο", "wrong article")
                : o.status === "near"
                  ? nearReasonText(o.reason, null, lang) || t("ορθογραφία", "spelling")
                  : o.status === "hinted"
                    ? t("με υπόδειξη", "with hint")
                    : t("λάθος", "wrong");
            const color = o.status === "wrong" || o.status === "article" ? "#E0584A" : "#B07A2A";
            return (
              <div key={`${o.word.id}-${i}`} style={{ fontSize: 13.5, padding: "6px 0", borderBottom: i < reviewItems.length - 1 ? "1px solid #ECE4D3" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <strong>{o.word.word}</strong>
                  <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>
                </div>
                <div style={{ fontSize: 12, color: "#8B8680" }}>{wordPrimaryMeanings(o.word, lang).join(", ")}</div>
              </div>
            );
          })}
        </div>
      )}
      {retryWords.length > 0 && onRetryMissed && (
        <button
          onClick={() => onRetryMissed(retryWords)}
          style={{ width: "100%", maxWidth: 340, padding: "13px 20px", borderRadius: 999, background: "rgba(224,88,74,0.12)", border: "1px solid #F0C9C2", color: "#E0584A", fontWeight: 700, fontSize: 13.5 }}
        >
          {t(`Επανάληψη λαθών (${retryWords.length})`, `Retry mistakes (${retryWords.length})`)}
        </button>
      )}
      <button
        onClick={onDone}
        style={{ marginTop: 2, padding: "13px 34px", borderRadius: 999, background: "#CB9146", border: "none", color: "#211F1C", fontWeight: 700, fontSize: 14 }}
      >
        {t("Weiter", "Continue")}
      </button>
    </div>
  );
}

function HomeScreen({ vocab, meta, goTo, onStartDaily, onOpenB2Practice }) {
  const { t } = useAppLang();
  const dueCount = vocab.filter(isDue).length;
  const b2Count = useMemo(() => vocab.filter(isB2Word).length, [vocab]);

  return (
    <div style={{ padding: "18px 20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#A79F8E" }}>
        <span style={{ fontSize: 14 }}>🇩🇪</span>
        <span className="ww-mono" style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
          {t("Mein Wortschatz", "My Vocabulary")}
        </span>
      </div>
      <div className="ww-display" style={{ fontSize: 40, fontWeight: 700, marginTop: 4, marginBottom: 22 }}>WortWerk</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div className="ww-tag-card" style={{ padding: "18px 16px" }}>
          <div className="ww-display" style={{ fontSize: 30, fontWeight: 700 }}>{vocab.length}</div>
          <div style={{ fontSize: 12.5, color: "#8B8680", marginTop: 2 }}>{t("Wörter gelernt", "Words in deck")}</div>
        </div>
        <div className="ww-tag-card" style={{ padding: "18px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Flame size={22} color="#C1543C" />
            <span className="ww-display" style={{ fontSize: 30, fontWeight: 700 }}>{meta.streak || 0}</span>
          </div>
          <div style={{ fontSize: 12.5, color: "#8B8680", marginTop: 2 }}>{t("Tage Lernserie", "Day streak")}</div>
        </div>
      </div>

      <div className="ww-hero-card" style={{ padding: "26px 22px", marginBottom: 24, color: "#F5F0E6" }}>
        <div style={{ fontSize: 13, color: "rgba(245,240,230,0.62)" }}>{t("Heute lernen", "Study today")}</div>
        <div className="ww-display" style={{ fontSize: 34, fontWeight: 700, marginTop: 6, marginBottom: 22 }}>
          {dueCount > 0 ? dueCount : vocab.length} {t("Wörter", "Words")}
        </div>
        <button
          onClick={onStartDaily}
          style={{
            width: "100%", padding: "15px 0", borderRadius: 999, background: "#F5F0E6",
            border: "none", color: "#211F1C", fontWeight: 700, fontSize: 14.5,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          {t("Jetzt lernen", "Start learning")} <ChevronRight size={16} />
        </button>
        {b2Count > 0 && onOpenB2Practice && (
          <button
            onClick={onOpenB2Practice}
            style={{
              marginTop: 10, width: "100%", padding: "11px 0", borderRadius: 999,
              background: "rgba(245,240,230,0.10)", border: "1px solid rgba(245,240,230,0.22)",
              color: "#F5F0E6", fontWeight: 600, fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {t(`Εξάσκηση μόνο B2 (${b2Count} λέξεις)`, `B2-only practice (${b2Count} words)`)} <ChevronRight size={15} />
          </button>
        )}
      </div>

      <HomeProgressOverview
        vocab={vocab}
        meta={meta}
        onOpenStats={() => goTo("stats")}
      />
    </div>
  );
}

function LearnScreen({ vocab, updateVocab, meta, updateMeta, autoStartDaily, onAutoStartConsumed, practiceScope = "all", setPracticeScope, onOpenB2Stats }) {
  const ctx = useContext(AppCtx);
  const { lang, t } = useAppLang();
  const [mode, setMode] = useState(null);
  const [customWords, setCustomWords] = useState(null);
  const [result, setResult] = useState(null);
  const [showIntensive, setShowIntensive] = useState(false);
  const [testWords, setTestWords] = useState(null);
  const [note, setNote] = useState("");
  const todayStr = dateStr(now());
  const b2Vocab = useMemo(() => filterVocabByPracticeScope(vocab, "b2"), [vocab]);
  const isB2Only = practiceScope === "b2";
  const scopedVocab = useMemo(() => filterVocabByPracticeScope(vocab, practiceScope), [vocab, practiceScope]);
  const distractorPool = useMemo(() => {
    const withMeaning = scopedVocab.filter((w) => wordPrimaryMeanings(w, lang).length > 0);
    return withMeaning.length >= 4 ? scopedVocab : vocab;
  }, [scopedVocab, vocab, lang]);
  const daily = useMemo(() => getDailyPracticeWords(scopedVocab), [scopedVocab]);
  const todaysWords = useMemo(() => scopedVocab.filter((w) => w.dateAdded === todayStr), [scopedVocab, todayStr]);
  const todaysRemaining = todaysWords.filter((w) => !isMasteredToday(w));
  const todaysBatch = useMemo(() => todayBatchProgress(todaysWords), [todaysWords]);
  const todaysMasteredCount = todaysBatch.completed;
  const favs = scopedVocab.filter((w) => w.fav);
  const testPool = scopedVocab;
  const scopedTestLogs = (meta.testLogs || []).filter((l) => (isB2Only ? l.scope === "b2" : true));
  const lastTest = scopedTestLogs.slice(-1)[0];
  const daysSinceTest = lastTest ? Math.floor((now() - new Date(lastTest.date + "T12:00:00Z").getTime()) / DAY) : null;
  const queuedCount = ctx.queuedCount || 0;
  const testSize = Math.min(20, testPool.length);

  function startDaily() {
    if (!daily.all.length) {
      setNote(
        isB2Only
          ? t("Δεν υπάρχουν B2 λέξεις που οφείλονται σήμερα.", "No B2 words are due today.")
          : t("Καμία λέξη δεν οφείλεται σήμερα.", "No words are due today."),
      );
      return;
    }
    setNote("");
    setCustomWords(trueShuffle(daily.all).slice(0, 18));
    setMode("daily");
  }
  useEffect(() => {
    if (autoStartDaily && !mode && !result) {
      startDaily();
      onAutoStartConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartDaily]);

  function startFav() {
    if (!favs.length) {
      setNote(
        isB2Only
          ? t("Δεν έχεις αγαπημένες B2 λέξεις ακόμα — πάτα το ★ σε μια λέξη B2.", "No favorite B2 words yet — tap ★ on a B2 word.")
          : t("Δεν έχεις αγαπημένα ακόμα — πάτα το ★ σε μια λέξη.", "No favorites yet — tap ★ on any word."),
      );
      return;
    }
    setNote("");
    setCustomWords(trueShuffle(favs).slice(0, 20));
    setMode("mix");
  }
  function startClosestB2(words) {
    if (!words || !words.length) return;
    setNote("");
    setCustomWords(words);
    setMode("mix");
  }
  function startTest() {
    if (testPool.length < 5) {
      setNote(
        isB2Only
          ? t("Χρειάζεσαι τουλάχιστον 5 ενεργές λέξεις επιπέδου B2 για τεστ.", "You need at least 5 active B2 words to run a test.")
          : t("Χρειάζεσαι τουλάχιστον 5 ενεργές λέξεις για τεστ.", "You need at least 5 active words to run a test."),
      );
      return;
    }
    setNote("");
    setTestWords(pickRandomTestWords(testPool, 20));
  }

  function sessionMeta(extra, entry) {
    updateMeta({
      ...meta, ...nextStreak(meta), ...extra,
      sessionLogs: [...(meta.sessionLogs || []), { date: todayStr, ...entry }].slice(-40),
      totalStudyTimeMs: (meta.totalStudyTimeMs || 0) + (entry.durationMs || 0),
    });
  }
  function registerVocabSession(res) {
    const xp = res.correct * 10;
    sessionMeta({ xp: (meta.xp || 0) + xp }, { correct: res.correct, total: res.total, xp, kind: "vocab", durationMs: res.elapsedMs || 0 });
    setResult(res);
  }
  function registerIntensiveSession(res) {
    const xp = res.masteredCount * 15;
    sessionMeta({ xp: (meta.xp || 0) + xp }, { correct: res.masteredCount, total: res.total, xp, kind: "intensive", durationMs: res.elapsedMs || 0 });
    setShowIntensive(false);
  }
  function registerTest(res) {
    const xp = (res.exact + res.near) * 10;
    sessionMeta(
      {
        xp: (meta.xp || 0) + xp,
        testLogs: [...(meta.testLogs || []), { date: todayStr, total: res.total, exact: res.exact, near: res.near, synonym: res.synonym, wrong: res.wrong, scope: res.scope || practiceScope }].slice(-12),
      },
      { correct: res.exact + res.near, total: res.total, xp, kind: "test", durationMs: res.elapsedMs || 0 }
    );
    setTestWords(null);
  }
  const applyUpdates = (updates) => updateVocab((prev) => prev.map((w) => updates[w.id] || w));

  if (showIntensive) {
    return (
      <IntensiveSession
        initialWords={todaysRemaining}
        distractorPool={distractorPool}
        onUpdateWords={(updated) => updateVocab((prev) => prev.map((w) => updated.find((u) => u.id === w.id) || w))}
        onFinish={registerIntensiveSession}
        onExit={() => setShowIntensive(false)}
      />
    );
  }
  if (testWords) {
    return (
      <TestSession
        words={testWords}
        scope={practiceScope}
        distractorPool={distractorPool}
        onFinish={registerTest}
        onUpdateWords={applyUpdates}
        onExit={() => setTestWords(null)}
      />
    );
  }
  if (mode && !result) {
    return (
      <VocabSession
        vocab={scopedVocab}
        distractorPool={distractorPool}
        scopeLabel={isB2Only ? t("Μόνο B2", "B2 Only") : null}
        mode={mode}
        customWords={customWords}
        onFinish={registerVocabSession}
        onUpdateWords={applyUpdates}
        onExit={() => { setMode(null); setCustomWords(null); }}
      />
    );
  }
  if (result) {
    return (
      <RoundResult
        result={result}
        onDone={() => { setResult(null); setMode(null); setCustomWords(null); }}
        onRetryMissed={(missedWords) => { setResult(null); setCustomWords(missedWords); setMode("mix"); }}
      />
    );
  }

  const modes = [
    { id: "mix", label: "Mix", desc: t("Όλα τα 5 παιχνίδια", "All 5 exercises"), icon: Shuffle, color: "#CB9146" },
    { id: "flashcard", label: t("Karteikarten", "Flashcards"), desc: t("Umdrehen & bewerten", "Flip & self-rate"), icon: Layers, color: "#4FA091" },
    { id: "mc", label: "Multiple Choice", desc: t("4 Antworten", "4 choices"), icon: ListChecks, color: "#C1543C" },
    { id: "fill", label: "Lückentext", desc: t("Wort eintippen", "Type missing word"), icon: PenLine, color: "#8B7BC7" },
    { id: "context", label: t("Νέο συμφραζόμενο", "New context"), desc: t("Γραφή σε πρόταση", "Type in sentence"), icon: PenLine, color: "#4FA091" },
    { id: "recall", label: t("Γράψιμο", "Typed Recall"), desc: t("Ελληνικά → Γερμανικά", "English → German"), icon: PenLine, color: "#5B8DB8" },
    { id: "fav", label: t("Αγαπημένα", "Favorites"), desc: `${favs.length} ${isB2Only ? "B2 " : ""}${t("λέξεις", "words")}`, icon: Star, color: "#CB9146" },
  ];

  return (
    <div style={{ padding: "4px 20px 24px" }}>
      <div className="ww-tag-card" style={{ padding: "12px 14px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <span className="ww-mono" style={{ fontSize: 11, color: "#8B8680", textTransform: "uppercase", letterSpacing: 0.6 }}>
            {t("Επίπεδο εξάσκησης", "Practice scope")}
          </span>
          {isB2Only && <Pill color="#4FA091" bg="rgba(79,160,145,0.15)">{t("Μόνο B2 ενεργό", "B2 only active")}</Pill>}
        </div>
        <div
          role="group"
          aria-label={t("Επιλογή επιπέδου εξάσκησης", "Select practice scope")}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 4, borderRadius: 12, background: "#F5F0E6" }}
        >
          <button
            type="button"
            aria-pressed={!isB2Only}
            onClick={() => { setNote(""); setPracticeScope?.("all"); }}
            style={{
              padding: "9px 10px", borderRadius: 9, border: "none",
              background: !isB2Only ? "#211F1C" : "transparent",
              color: !isB2Only ? "#F5F0E6" : "#6B655B",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <span>{t("Όλα", "All")}</span>
            <span className="ww-mono" style={{ fontSize: 11, opacity: 0.8 }}>({vocab.length})</span>
          </button>
          <button
            type="button"
            aria-pressed={isB2Only}
            onClick={() => { setNote(""); setPracticeScope?.("b2"); }}
            style={{
              padding: "9px 10px", borderRadius: 9, border: "none",
              background: isB2Only ? "#4FA091" : "transparent",
              color: isB2Only ? "#FFFFFF" : "#6B655B",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <span>{t("Μόνο B2", "B2 Only")}</span>
            <span className="ww-mono" style={{ fontSize: 11, opacity: 0.9 }}>({b2Vocab.length})</span>
          </button>
        </div>
        {isB2Only && (
          <div style={{ fontSize: 12, color: "#4A453D", marginTop: 8, lineHeight: 1.45 }}>
            {t(
              "Ημερήσια εξάσκηση, τεστ και όλα τα παιχνίδια λειτουργούν αποκλειστικά με τις ",
              "Daily practice, tests, and all exercises run exclusively with your ",
            )}
            <strong>{b2Vocab.length}</strong> {t("λέξεις επιπέδου ", "")}<strong>B2</strong>{t(".", " words.")}
          </div>
        )}
      </div>

      {isB2Only && (
        <B2GoalTracker
          vocab={vocab}
          onOpenB2Stats={onOpenB2Stats}
          onPracticeClosest={startClosestB2}
        />
      )}

      {todaysWords.length > 0 && (
        <div className="ww-tag-card ww-pop" style={{ padding: "20px", marginBottom: 18, borderLeft: "3px solid #6FA96B" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6FA96B" }}>
            <Sparkles size={16} />
            <span className="ww-mono" style={{ fontSize: 12 }}>{t("Λέξεις της ημέρας", "Today's words")}{isB2Only ? " · B2" : ""}</span>
          </div>
          <div className="ww-display" style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>
            {todaysMasteredCount}/{todaysWords.length} {t("σημερινή εξάσκηση 90%+", "today's practice 90%+")}
            {todaysBatch.pct > 0 && todaysRemaining.length > 0 && (
              <span className="ww-mono" style={{ fontSize: 13, fontWeight: 600, color: "#6FA96B", marginLeft: 8 }}>
                {todaysBatch.pct}%
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: "#8B8680", marginTop: 4, lineHeight: 1.5 }}>
            {todaysRemaining.length > 0
              ? t(
                  "Εντατική εξάσκηση — αναγνώριση, γραφή, συμφραζόμενο και ανάκληση, σημερινές βαθμολογημένες προσπάθειες· όχι πιστοποίηση κατάκτησης.",
                  "Intensive practice — recognition, typing, context, and recall, today's graded attempts; does not certify mastery.",
                )
              : t(
                  "Ο σημερινός στόχος εξάσκησης ολοκληρώθηκε — όχι πιστοποίηση κατάκτησης.",
                  "Today's practice target is complete — does not certify mastery.",
                )}
          </div>
          <div style={{ height: 6, background: "#ECE4D3", borderRadius: 999, overflow: "hidden", marginTop: 12 }}>
            <div style={{ height: "100%", width: `${todaysBatch.pct}%`, background: "#6FA96B", transition: "width 0.3s" }} />
          </div>
          {todaysRemaining.length > 0 && (
            <button
              onClick={() => setShowIntensive(true)}
              style={{ marginTop: 16, width: "100%", padding: "14px 0", borderRadius: 999, background: "#6FA96B", border: "none", color: "#14201A", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              {t(`Εντατική εξάσκηση (${todaysRemaining.length})`, `Intensive practice (${todaysRemaining.length})`)} <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      <div className="ww-hero-card ww-pop" style={{ padding: "22px 20px", marginBottom: 18, color: "#F5F0E6" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#CB9146" }}>
            <Flame size={16} />
            <span className="ww-mono" style={{ fontSize: 12 }}>{meta.streak || 0} {t("Tage Serie", "day streak")}</span>
          </div>
          {isB2Only && <Pill color="#A7E3D7" bg="rgba(79,160,145,0.25)">{t("Μόνο B2", "B2 Only")}</Pill>}
        </div>
        <div className="ww-display" style={{ fontSize: 26, fontWeight: 600, marginTop: 8 }}>
          {t("Ημερήσια Εξάσκηση", "Daily Practice")}{isB2Only ? " · B2" : ""}
        </div>
        <div style={{ fontSize: 13, color: "rgba(245,240,230,0.74)", marginTop: 6, lineHeight: 1.5 }}>
          {daily.due.length > 0
            ? <>{daily.due.length} {isB2Only ? "B2 " : ""}{t("λέξεις οφείλονται σήμερα (πρόγραμμα 1-3-7-10-15 ημερών)", "words due today (1-3-7-10-15 day schedule)")}</>
            : <>{t(`Καμία ${isB2Only ? "B2 " : ""}λέξη δεν οφείλεται σήμερα`, `No ${isB2Only ? "B2 " : ""}words due today`)}</>}
          {daily.maintenance.length > 0 && <> · +{daily.maintenance.length} {t("για έλεγχο διατήρησης", "for retention check")}</>}
        </div>
        <div style={{ fontSize: 11.5, color: "rgba(245,240,230,0.56)", marginTop: 4 }}>
          {t(
            "Περιλαμβάνει όλα τα παιχνίδια: κάρτες, πολλαπλή επιλογή, κενό, συμφραζόμενο & γράψιμο.",
            "Includes all exercises: flashcards, multiple choice, fill blank, context & typed recall.",
          )}
        </div>
        {daily.all.length > 0 ? (
          <button
            onClick={startDaily}
            style={{ marginTop: 18, width: "100%", padding: "15px 0", borderRadius: 999, background: "#F5F0E6", border: "none", color: "#211F1C", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            {isB2Only ? t("Ξεκίνα ημερήσια εξάσκηση B2", "Start daily B2 practice") : t("Ξεκίνα την εξάσκηση", "Start daily practice")} <ChevronRight size={16} />
          </button>
        ) : (
          <div style={{ marginTop: 16, fontSize: 12.5, color: "rgba(245,240,230,0.55)" }}>
            {t("Όλα ενημερωμένα — ξαναέλα αύριο, ή κάνε ελεύθερη εξάσκηση παρακάτω.", "All caught up — come back tomorrow, or try free practice below.")}
          </div>
        )}
      </div>

      <div className="ww-tag-card" style={{ padding: "18px 18px", marginBottom: 18, borderLeft: `3px solid ${isB2Only ? "#4FA091" : "#8B7BC7"}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="ww-mono" style={{ fontSize: 12, color: isB2Only ? "#4FA091" : "#8B7BC7" }}>
            {isB2Only ? t("Τεστ B2 · Όλα τα παιχνίδια", "B2 Test · All exercises") : t("Τεστ · Όλα τα παιχνίδια", "Test · All exercises")}
            {(daysSinceTest === null || daysSinceTest >= 7) ? t(" · ώρα για τεστ!", " · time for a test!") : ""}
          </div>
          {isB2Only && <Pill color="#4FA091" bg="rgba(79,160,145,0.14)">B2</Pill>}
        </div>
        <div className="ww-display" style={{ fontSize: 19, fontWeight: 700, marginTop: 6 }}>
          {lastTest && lastTest.total > 0
            ? t(`Τελευταίο${isB2Only ? " B2" : ""}: ${Math.round(((lastTest.exact + lastTest.near) / lastTest.total) * 100)}%`, `Last${isB2Only ? " B2" : ""}: ${Math.round(((lastTest.exact + lastTest.near) / lastTest.total) * 100)}%`)
            : (isB2Only ? t("Δεν έχεις κάνει ακόμα τεστ B2", "You haven't taken a B2 test yet") : t("Δεν έχεις κάνει ακόμα τεστ", "You haven't taken a test yet"))}
        </div>
        <div style={{ fontSize: 12.5, color: "#8B8680", marginTop: 4, lineHeight: 1.5 }}>
          {t(
            `${testSize} πραγματικά τυχαίες ${isB2Only ? "B2 " : ""}λέξεις (από ${testPool.length}) · όλα τα παιχνίδια · χωρίς υποδείξεις · ειλικρινές ποσοστό στο τέλος.`,
            `${testSize} truly random ${isB2Only ? "B2 " : ""}words (of ${testPool.length}) · all exercises · no hints · honest score at the end.`,
          )}
        </div>
        <button
          onClick={startTest}
          style={{
            marginTop: 12, width: "100%", padding: "12px 0", borderRadius: 999,
            background: isB2Only ? "rgba(79,160,145,0.15)" : "rgba(139,123,199,0.15)",
            border: `1px solid ${isB2Only ? "#B8DDD6" : "#D9CFEF"}`,
            color: isB2Only ? "#357A6D" : "#8B7BC7",
            fontWeight: 700, fontSize: 13.5,
          }}
        >
          {isB2Only ? t("Ξεκίνα τεστ B2", "Start B2 test") : t("Ξεκίνα το τεστ", "Start test")}
        </button>
      </div>

      {queuedCount > 0 && (
        <div className="ww-tag-card" style={{ padding: "16px 18px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>📥 {queuedCount} {t("λέξεις σε αναμονή", "queued words")}</div>
            <div style={{ fontSize: 12, color: "#8B8680", marginTop: 2 }}>{t("Ενεργοποιούνται αυτόματα 10 τη μέρα.", "10 activate automatically each day.")}</div>
          </div>
          <button
            onClick={() => { const n = ctx.activateMore(10); setNote(n ? t(`Ενεργοποιήθηκαν ${n} ακόμα λέξεις.`, `Activated ${n} more words.`) : ""); }}
            style={{ padding: "9px 14px", borderRadius: 999, background: "#FFFFFF", border: "1px solid #E8E0CE", color: "#211F1C", fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap" }}
          >
            {t("+10 ακόμα", "+10 more")}
          </button>
        </div>
      )}

      {note && <div className="ww-pop" style={{ fontSize: 13, color: "#B07A2A", marginBottom: 12 }}>{note}</div>}

      <div style={{ fontSize: 12, color: "#A79F8E", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {t("Ελεύθερη εξάσκηση", "Free practice")}{isB2Only ? t(" · Μόνο B2", " · B2 Only") : ""}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {modes.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => {
                if (m.id === "fav") { startFav(); return; }
                if (!scopedVocab.length) {
                  setNote(isB2Only ? t("Δεν υπάρχουν διαθέσιμες λέξεις επιπέδου B2.", "No B2 words available.") : t("Δεν υπάρχουν διαθέσιμες λέξεις.", "No words available."));
                  return;
                }
                setNote("");
                setCustomWords(null);
                setMode(m.id);
              }}
              className="ww-tag-card"
              style={{ padding: "16px 14px", textAlign: "left", border: "1px solid #E8E0CE" }}
            >
              <Icon size={20} color={m.color} />
              <div style={{ fontWeight: 600, fontSize: 14, marginTop: 8 }}>{m.label}</div>
              <div style={{ fontSize: 11.5, color: "#A79F8E", marginTop: 2 }}>{m.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FamilyMemberCard({ item, accentColor, isBase, vocab, onNavigate }) {
  const { lang } = useAppLang();
  const prefixTable = lang === "en" ? PREFIX_MEANINGS_EN : PREFIX_MEANINGS;
  const info = item.prefix ? prefixTable[item.prefix] || null : null;
  const linkedWord = vocab ? vocab.find((w) => normalizedWord(w.word) === normalizedWord(item.word)) : null;
  const displayMeaning = linkedWord ? wordPrimaryMeanings(linkedWord, lang).join(", ") : item.meaning;
  const Wrapper = linkedWord ? "button" : "div";
  return (
    <Wrapper
      onClick={linkedWord ? () => onNavigate(linkedWord) : undefined}
      className="ww-tag-card"
      style={{
        padding: "14px 16px", borderLeft: `3px solid ${isBase ? "#A79F8E" : accentColor}`,
        textAlign: "left", width: "100%", cursor: linkedWord ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span className="ww-display" style={{ fontSize: 17, fontWeight: 600 }}>{item.word}</span>
            {item.prefix && !isBase && <Pill color={accentColor} bg="rgba(139,123,199,0.15)">{item.prefix}</Pill>}
            {item.separable && <Pill color="#4FA091" bg="rgba(79,160,145,0.15)">trennbar</Pill>}
          </div>
          <div style={{ fontSize: 13, color: "#4A453D", marginTop: 4 }}>{displayMeaning}</div>
        </div>
        {linkedWord && <ChevronRight size={16} color="#C4BCA9" style={{ flexShrink: 0, marginTop: 4 }} />}
      </div>
      {info && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: "#8B8680", lineHeight: 1.5, borderTop: "1px solid #ECE4D3", paddingTop: 8 }}>
          <span style={{ color: accentColor, fontWeight: 700 }}>{info.label}: </span>{info.meaning}
        </div>
      )}
    </Wrapper>
  );
}

function WordFamilyModal({ word, onClose, vocab, onOpenWord }) {
  const { lang, t } = useAppLang();
  const groups = familyGroups(word);
  const totalCount = familyMembers(word).length;
  const hasGrouped = totalCount > 0;

  function navigate(w) {
    onClose();
    if (onOpenWord) onOpenWord(w);
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,12,16,0.75)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ww-pop"
        style={{ width: "100%", maxHeight: "86vh", overflowY: "auto", background: "#FFFFFF", borderRadius: "20px 20px 0 0", padding: "22px 22px 34px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <Pill color="#8B7BC7" bg="rgba(139,123,199,0.15)">{t("Wortfamilie", "Word Family")}</Pill>
            <div className="ww-display" style={{ fontSize: 22, fontWeight: 600, marginTop: 8 }}>
              {t("Stamm:", "Stem:")} {word.stem || word.word}
            </div>
            <div style={{ fontSize: 12, color: "#8B8680", marginTop: 2 }}>
              {totalCount} {t("verwandte Wörter", "related words")}{linkHint(vocab, word, lang)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "#ECE4D3", border: "none", borderRadius: "50%", width: 30, height: 30, color: "#8B8680", flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {hasGrouped ? (
          <>
            {groups.verbs.length > 0 && (
              <>
                <div style={{ fontSize: 11.5, color: "#A79F8E", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 8 }}>🔹 {t("Ρήματα", "Verbs")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {groups.verbs.map((item, i) => (
                    <FamilyMemberCard key={i} item={item} accentColor="#8B7BC7" isBase={item.prefix === "-"} vocab={vocab} onNavigate={navigate} />
                  ))}
                </div>
              </>
            )}
            {groups.nouns.length > 0 && (
              <>
                <div style={{ fontSize: 11.5, color: "#A79F8E", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 8 }}>🔸 {t("Ουσιαστικά", "Nouns")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {groups.nouns.map((item, i) => (
                    <FamilyMemberCard key={i} item={item} accentColor="#CB9146" isBase={false} vocab={vocab} onNavigate={navigate} />
                  ))}
                </div>
              </>
            )}
            {groups.adjectives.length > 0 && (
              <>
                <div style={{ fontSize: 11.5, color: "#A79F8E", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 8 }}>🔺 {t("Επίθετα", "Adjectives")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {groups.adjectives.map((item, i) => (
                    <FamilyMemberCard key={i} item={item} accentColor="#4FA091" isBase={false} vocab={vocab} onNavigate={navigate} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
            {familyMembers(word).map((pf, i) => (
              <FamilyMemberCard key={i} item={pf} accentColor="#8B7BC7" isBase={pf.prefix === "-"} vocab={vocab} onNavigate={navigate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function linkHint(vocab, word, lang = "el") {
  if (!vocab) return "";
  const all = familyMembers(word);
  const linked = all.filter((item) => vocab.some((w) => normalizedWord(w.word) === normalizedWord(item.word))).length;
  return linked > 0 ? (lang === "en" ? ` · ${linked} with own card` : ` · ${linked} με δική τους καρτέλα`) : "";
}

function WordDetailSheet({ word, onClose, onDelete, vocab, onOpenWord }) {
  const ctx = useContext(AppCtx);
  const { lang, t } = useAppLang();
  const [showFamily, setShowFamily] = useState(false);
  const allV = vocab || ctx.vocab || [];
  const live = allV.find((x) => x.id === word.id) || word;
  const familyOwner = resolveWordFamily(live, allV);
  const familyCount = familyOwner ? familyMembers(familyOwner).length : 0;
  const hasFamily = familyCount > 1;
  const examples = (word.examples || []).filter((x) => x && x.de).slice(0, 2);
  const sectionLabel = { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 };
  const primaryMeanings = wordPrimaryMeanings(word, lang).join(" · ");
  const secondaryMeanings = wordSecondaryMeanings(word, lang).join(", ");

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,12,16,0.6)", display: "flex", alignItems: "flex-end", zIndex: 50 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="ww-tag-card ww-pop"
        style={{ width: "100%", maxHeight: "78vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "22px 22px 30px", background: "#FFFFFF" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Pill color="#CB9146" bg="rgba(203,145,70,0.15)">{word.cefr ? word.cefr + " · " : ""}{typeLabel(word.type)}</Pill>
              {live.queued && <Pill>{t("σε αναμονή", "queued")}</Pill>}
            </div>
            <div className="ww-display" style={{ fontSize: 26, fontWeight: 600, marginTop: 8 }}>{word.word}</div>
            {word.plural && <div style={{ fontSize: 12, color: "#A79F8E" }}>Plural: {word.plural}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <FavStar
              word={word}
              size={16}
              style={{ background: "rgba(203,145,70,0.10)", border: "1px solid #E8D6B0", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}
            />
            <button onClick={onClose} style={{ background: "#ECE4D3", border: "none", borderRadius: "50%", width: 30, height: 30, color: "#8B8680" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>{primaryMeanings}</div>
        {secondaryMeanings && <div style={{ fontSize: 13, color: "#8B8680" }}>{secondaryMeanings}</div>}

        {live.lite && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: "#8B8680", background: "#F5F0E6", padding: 12, borderRadius: 10, lineHeight: 1.5 }}>
            {t(
              "Βασική καταχώριση (μόνο μετάφραση). Στείλε μου τη λέξη για πλήρη ανάλυση — ετυμολογία, παραδείγματα, συνώνυμα.",
              "Basic entry (translation only). Enrich this word to add etymology, examples, and synonyms.",
            )}
          </div>
        )}

        {word.usage && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: "#4A453D", lineHeight: 1.5, background: "#F5F0E6", padding: 12, borderRadius: 10 }}>
            {word.usage}
          </div>
        )}

        {examples.map((ex, i) => (
          <div key={i} style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.6 }}>
            „{ex.de}“
            <div style={{ color: "#A79F8E", fontSize: 12.5 }}>
              {lang === "en" ? (ex.en || ex.el) : ex.el}
            </div>
          </div>
        ))}

        {((word.synonyms || []).length > 0 || (word.antonyms || []).length > 0) && (
          <div style={{ marginTop: 14, display: "flex", gap: 20, flexWrap: "wrap" }}>
            {(word.synonyms || []).length > 0 && (
              <div>
                <div style={{ ...sectionLabel, color: "#A79F8E" }}>≈ {t("Synonyme", "Synonyms")}</div>
                <div style={{ fontSize: 13, color: "#211F1C" }}>{word.synonyms.join(", ")}</div>
              </div>
            )}
            {(word.antonyms || []).length > 0 && (
              <div>
                <div style={{ ...sectionLabel, color: "#A79F8E" }}>↔ {t("Antonyme", "Antonyms")}</div>
                <div style={{ fontSize: 13, color: "#211F1C" }}>{word.antonyms.join(", ")}</div>
              </div>
            )}
          </div>
        )}

        {word.memoryHook && <div style={{ marginTop: 14, fontSize: 12.5, color: "#CB9146", fontStyle: "italic" }}>💡 {word.memoryHook}</div>}

        {word.etymology && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: "#4A453D", lineHeight: 1.5, background: "#F5F0E6", padding: 12, borderRadius: 10 }}>
            <div style={{ ...sectionLabel, color: "#A79F8E" }}>📜 {t("Herkunft & Geschichte", "Origin & Etymology")}</div>
            {word.etymology}
          </div>
        )}

        {word.funFact && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: "#211F1C", lineHeight: 1.5, background: "rgba(203,145,70,0.1)", border: "1px solid #E8D6B0", padding: 12, borderRadius: 10 }}>
            <div style={{ ...sectionLabel, color: "#CB9146" }}>🌟 {t("Wissenswertes", "Good to know")}</div>
            {word.funFact}
          </div>
        )}

        {hasFamily && (
          <Button variant="outline" className="mt-4 w-full gap-2"
            onClick={() => setShowFamily(true)}
          >
            <Shuffle size={14} /> {t("Οικογένεια λέξεων", "Word family")} ({familyCount})
          </Button>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }}>
          {(word.tags || []).map((tag, i) => <Pill key={i}>{tag}</Pill>)}
        </div>

        {onDelete && (
          <button
            onClick={() => onDelete(word)}
            style={{ marginTop: 20, width: "100%", padding: "12px 0", borderRadius: 12, background: "rgba(224,88,74,0.1)", border: "1px solid #F0C9C2", color: "#E0584A", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Trash2 size={14} /> {t("Wort löschen", "Delete word")}
          </button>
        )}
      </div>
      {showFamily && familyOwner && <WordFamilyModal word={familyOwner} onClose={() => setShowFamily(false)} vocab={allV} onOpenWord={onOpenWord} />}
    </div>
  );
}

function normalizeImportedWord(raw) { return normalizeEntry(fixArticleWord(raw)); }

function AddWordModal({ onClose, initialMode = "text" }) {
  const ctx = useContext(AppCtx);
  const { t } = useAppLang();
  const today = dateStr(now());
  const [mode, setMode] = useState(initialMode);
  const [msg, setMsg] = useState(null);
  const [review, setReview] = useState(null);
  const [importPayload, setImportPayload] = useState(null);
  const [form, setForm] = useState({
    word: "", type: "Nomen", article: "der", plural: "", cefr: "B1", greek: "", english: "",
    exampleDe: "", exampleEl: "", sentence: "", answer: "", tags: "", etymology: "", memoryHook: "", funFact: "", synonyms: "", antonyms: "",
  });
  const [jsonText, setJsonText] = useState("");
  const [text, setText] = useState("");
  const [rows, setRows] = useState(null);
  const [level, setLevel] = useState("B1");
  const [queueLite, setQueueLite] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const csv = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

  function finishWith(res) {
    const parts = [];
    if (res.added) parts.push(t(`${res.added} νέες`, `${res.added} new`));
    if (res.upgraded || res.updated) parts.push(t(`${res.upgraded || res.updated} αναβαθμίστηκαν`, `${res.upgraded || res.updated} upgraded`));
    if (res.skipped) parts.push(t(`${res.skipped} υπήρχαν ήδη (παραλείφθηκαν)`, `${res.skipped} already existed (skipped)`));
    const ok = (res.added || 0) + (res.upgraded || res.updated || 0) > 0;
    setMsg({ ok, text: (ok ? "✓ " : "") + (parts.join(" · ") || t("Τίποτα για προσθήκη", "Nothing to add")) });
    if (ok) setTimeout(onClose, 1300);
  }

  function submitForm() {
    const raw = form.word.trim();
    if (!raw) return;
    const art = form.type === "Nomen" ? form.article : "";
    const word = art && raw.toLowerCase().indexOf(art + " ") !== 0 ? `${art} ${raw}` : raw;
    const entry = {
      word, type: form.type, cefr: form.cefr, article: art, plural: form.plural,
      meaning: { greek: csv(form.greek), english: csv(form.english) }, usage: "",
      examples: form.exampleDe ? [{ de: form.exampleDe, el: form.exampleEl }] : [],
      memoryHook: form.memoryHook, etymology: form.etymology, funFact: form.funFact,
      synonyms: csv(form.synonyms), antonyms: csv(form.antonyms),
      exercise: { sentence: form.sentence, answer: form.sentence ? (form.answer || stripArticle(word)) : "" },
      tags: csv(form.tags), stem: "", prefixFamily: [], family: null, dateAdded: today, lite: false, queued: false,
      learning: { confidence: 0, timesSeen: 0, timesCorrect: 0, nextReview: 0 },
    };
    setImportPayload(null);
    setReview(reviewEntries(ctx.vocab, [entry]));
  }

  function submitJson() {
    try { const parsed = parseImport(jsonText); const payload = JSON.parse(jsonText.replace(/^\uFEFF/, "")); setImportPayload(!Array.isArray(payload) && !payload.word ? payload : null); setReview(reviewEntries(ctx.vocab, parsed.vocab)); setMsg(null); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
  }

  function analyze() {
    const r = parseTextEntries(text);
    if (!r.entries.length) {
      setRows(null);
      setMsg({
        ok: false,
        text: t(
          "Δεν αναγνωρίστηκε καμία λέξη. Δοκίμασε π.χ. «der Tisch ; το τραπέζι» (μία ανά γραμμή) ή επικόλλησε ολόκληρη την ανάλυση με αριθμημένες λέξεις.",
          "No words recognized. Try e.g. “der Tisch ; the table” (one per line) or paste a numbered vocabulary list.",
        ),
      });
      return;
    }
    const rs = r.entries.map((e) => {
      const ex = (ctx.vocab || []).find((w) => wordKey(w.word) === wordKey(e.word));
      let status = "new";
      if (ex) status = ex.lite && !e.lite ? "upgrade" : "dup";
      const gl = e.meaning.greek && e.meaning.greek.length ? e.meaning.greek : e.meaning.english;
      return { e, include: status !== "dup", word: e.word, greekText: (gl || []).join(", "), type: e.type, status };
    });
    setRows(rs);
    setMsg(null);
    setQueueLite(r.format === "list" && rs.length > 15);
    setLevel(r.format === "blocks" ? "B1" : "");
  }
  function updateRow(i, patch) { setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r))); }
  function confirmRows() {
    const chosen = rows.filter((r) => r.include && r.word.trim() && r.greekText.trim());
    if (!chosen.length) { setMsg({ ok: false, text: t("Δεν έχεις επιλέξει λέξεις με μετάφραση.", "No words with a translation selected.") }); return; }
    const entries = chosen.map((r) => {
      const base = r.e;
      const word = r.word.trim();
      const isGreek = GREEK_RE.test(r.greekText);
      const list = splitMeanings(r.greekText);
      const queued = !!base.lite && queueLite;
      return {
        ...base, word, type: r.type, article: r.type === "Nomen" ? leadingArticle(word) : "", cefr: base.cefr || level,
        meaning: { greek: isGreek ? list : [], english: isGreek ? (base.meaning.english || []) : list },
        queued, dateAdded: queued ? "" : today,
      };
    });
    setImportPayload(null);
    setReview(reviewEntries(ctx.vocab, entries));
  }

  const inputStyle = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E8E0CE", background: "#F5F0E6", color: "#211F1C", fontSize: 13.5, outline: "none", marginTop: 4 };
  const labelStyle = { fontSize: 11.5, color: "#8B8680", marginTop: 12, display: "block" };
  const tabBtn = (id, label, color) => (
    <button
      key={id}
      onClick={() => { setMode(id); setMsg(null); }}
      style={{
        flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 12.5, fontWeight: 600,
        border: `1px solid ${mode === id ? color : "#E8E0CE"}`,
        background: mode === id ? color + "1F" : "transparent", color: mode === id ? color : "#8B8680",
      }}
    >
      {label}
    </button>
  );
  const shown = rows ? rows.slice(0, 40) : [];
  const includedCount = rows ? rows.filter((r) => r.include && r.word.trim() && r.greekText.trim()).length : 0;
  const hasLite = rows ? rows.some((r) => r.e.lite) : false;
  const statusTag = (s) => (s === "new" ? { t: t("νέα", "new"), c: "#3F8C5F" } : s === "upgrade" ? { t: t("αναβάθμιση", "upgrade"), c: "#8B7BC7" } : { t: t("υπάρχει ήδη", "exists"), c: "#A79F8E" });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,12,16,0.6)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} className="ww-pop" style={{ width: "100%", maxHeight: "90vh", overflowY: "auto", background: "#FFFFFF", borderRadius: "20px 20px 0 0", padding: "20px 22px 34px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="ww-display" style={{ fontSize: 20, fontWeight: 600 }}>{t("Νέες λέξεις", "Add Words")}</div>
          <button onClick={onClose} style={{ background: "#ECE4D3", border: "none", borderRadius: "50%", width: 30, height: 30, color: "#8B8680" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {tabBtn("text", t("📝 Κείμενο/λίστα", "📝 Text/List"), "#4FA091")}
          {tabBtn("form", t("✍️ Φόρμα", "✍️ Form"), "#CB9146")}
          {tabBtn("json", "📋 JSON", "#8B7BC7")}
        </div>

        {msg && (
          <div className="ww-pop" style={{ marginTop: 12, fontSize: 13, color: msg.ok ? "#3F8C5F" : "#E0584A", lineHeight: 1.5 }}>{msg.text}</div>
        )}

        {review && <ImportReview rows={review} onChange={setReview} onCancel={() => setReview(null)} onConfirm={() => {
          try { const res = importPayload ? ctx.restoreBackup(importPayload, review) : ctx.importWords(review.map(r => r.entry), review); setReview(null); finishWith(res); }
          catch (err) { setMsg({ ok: false, text: err.message }); }
        }} />}
        {mode === "text" && (
          <>
            <div style={{ fontSize: 12, color: "#8B8680", marginTop: 12, lineHeight: 1.5 }}>
              {t(
                "Επικόλλησε είτε μια λίστα (μία λέξη ανά γραμμή, π.χ. der Tisch ; το τραπέζι) είτε ολόκληρη την ανάλυση με αριθμημένες λέξεις. Η εφαρμογή φτιάχνει τις καταχωρήσεις και ελέγχει τα διπλότυπα μόνη της.",
                "Paste either a list (one word per line, e.g. der Tisch ; the table) or a numbered word breakdown. The app creates entries and checks duplicates automatically.",
              )}
            </div>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setRows(null); }}
              placeholder={t("der Tisch ; το τραπέζι\nsich freuen = χαίρομαι", "der Tisch ; the table\nsich freuen = to be glad")}
              style={{ ...inputStyle, minHeight: 170, marginTop: 10, fontSize: 12.5, resize: "vertical" }}
            />
            {!rows && (
              <button
                onClick={analyze}
                disabled={!text.trim()}
                style={{ marginTop: 14, width: "100%", padding: "14px 0", borderRadius: 12, background: text.trim() ? "#4FA091" : "#D9D2C0", border: "none", color: "#14201A", fontWeight: 700, fontSize: 14 }}
              >
                {t("Ανάλυση κειμένου", "Analyze text")}
              </button>
            )}
            {rows && (
              <>
                <div style={{ fontSize: 12.5, color: "#4A453D", marginTop: 14 }}>
                  {t("Βρέθηκαν", "Found")} <strong>{rows.length}</strong> {t("λέξεις · νέες", "words · new")} <strong>{rows.filter((r) => r.status === "new").length}</strong> · {t("υπάρχουν ήδη", "already exist")} <strong>{rows.filter((r) => r.status === "dup").length}</strong>
                  {rows.length > shown.length && <span style={{ color: "#8B8680" }}> {t(`(δείχνω τις πρώτες ${shown.length}· οι υπόλοιπες μπαίνουν κι αυτές)`, `(showing first ${shown.length}; the rest are included too)`)}</span>}
                </div>
                <div style={{ marginTop: 8 }}>
                  {shown.map((r, i) => {
                    const tag = statusTag(r.status);
                    return (
                      <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #ECE4D3", opacity: r.include ? 1 : 0.55 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="checkbox" checked={r.include} onChange={(e) => updateRow(i, { include: e.target.checked })} />
                          <input value={r.word} onChange={(e) => updateRow(i, { word: e.target.value })} style={{ ...inputStyle, marginTop: 0, flex: 1, fontWeight: 600 }} />
                          <span style={{ fontSize: 10.5, color: tag.c, whiteSpace: "nowrap", fontWeight: 600 }}>{tag.t}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 6, paddingLeft: 26 }}>
                          <input
                            value={r.greekText}
                            onChange={(e) => updateRow(i, { greekText: e.target.value })}
                            placeholder={t("μετάφραση", "translation")}
                            style={{ ...inputStyle, marginTop: 0, flex: 1, borderColor: r.greekText.trim() ? "#E8E0CE" : "#E0584A" }}
                          />
                          <select value={r.type} onChange={(e) => updateRow(i, { type: e.target.value })} style={{ ...inputStyle, marginTop: 0, width: 96 }}>
                            <option>Nomen</option><option>Verb</option><option>Adjektiv</option><option>Sonstiges</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <label style={labelStyle}>{t("Επίπεδο για όσες δεν έχουν δικό τους", "Default CEFR level if unspecified")}</label>
                <select value={level} onChange={(e) => setLevel(e.target.value)} style={inputStyle}>
                  <option value="">{t("— (χωρίς επίπεδο)", "— (no level)")}</option><option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option><option>C2</option>
                </select>
                {hasLite && (
                  <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14, fontSize: 12.5, color: "#4A453D", lineHeight: 1.5 }}>
                    <input type="checkbox" checked={queueLite} onChange={(e) => setQueueLite(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>{t("Βάλε τις βασικές λέξεις σε ουρά — 10 νέες τη μέρα, ώστε να μη γεμίσει η Ημερήσια Εξάσκηση.", "Queue basic words — 10 new per day, so Daily Practice stays manageable.")}</span>
                  </label>
                )}
                <button
                  onClick={confirmRows}
                  disabled={!includedCount}
                  style={{ marginTop: 16, width: "100%", padding: "14px 0", borderRadius: 12, background: includedCount ? "#4FA091" : "#D9D2C0", border: "none", color: "#14201A", fontWeight: 700, fontSize: 14 }}
                >
                  {t(`Προσθήκη ${includedCount} λέξεων`, `Add ${includedCount} words`)}
                </button>
                <button onClick={() => setRows(null)} style={{ marginTop: 8, width: "100%", background: "none", border: "none", color: "#8B8680", fontSize: 12.5, padding: 6 }}>
                  {t("← Πίσω στο κείμενο", "← Back to text")}
                </button>
              </>
            )}
          </>
        )}

        {mode === "json" && (
          <>
            <div style={{ fontSize: 12, color: "#8B8680", marginTop: 12 }}>
              {t("Επικόλλησε το JSON (μία λέξη ή λίστα λέξεων).", "Paste JSON (a single word object or an array of words).")}
            </div>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='[{"word": "der Tisch", "meaning": {"greek": ["το τραπέζι"], "english": ["the table"]}}]'
              style={{ ...inputStyle, minHeight: 200, marginTop: 10, fontFamily: "'Space Mono', monospace", fontSize: 12, resize: "vertical" }}
            />
            <button
              onClick={submitJson}
              disabled={!jsonText.trim()}
              style={{ marginTop: 14, width: "100%", padding: "14px 0", borderRadius: 12, background: jsonText.trim() ? "#8B7BC7" : "#D9D2C0", border: "none", color: "#211F1C", fontWeight: 700, fontSize: 14 }}
            >
              {t("Προσθήκη", "Import")}
            </button>
          </>
        )}

        {mode === "form" && (
          <>
            <label style={labelStyle}>{t("Wort *", "Word *")}</label>
            <input style={inputStyle} value={form.word} onChange={set("word")} placeholder={t("z. B. Tisch", "e.g. Tisch")} />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{t("Wortart", "Part of speech")}</label>
                <select style={inputStyle} value={form.type} onChange={set("type")}>
                  <option>Nomen</option><option>Verb</option><option>Adjektiv</option><option>Sonstiges</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{t("Niveau", "CEFR Level")}</label>
                <select style={inputStyle} value={form.cefr} onChange={set("cefr")}>
                  <option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option><option>C2</option>
                </select>
              </div>
            </div>
            {form.type === "Nomen" && (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{t("Artikel", "Article")}</label>
                  <select style={inputStyle} value={form.article} onChange={set("article")}>
                    <option>der</option><option>die</option><option>das</option>
                  </select>
                </div>
                <div style={{ flex: 2 }}>
                  <label style={labelStyle}>Plural</label>
                  <input style={inputStyle} value={form.plural} onChange={set("plural")} placeholder="die Tische" />
                </div>
              </div>
            )}
            <label style={labelStyle}>{t("Ελληνικά (χωρισμένα με κόμμα)", "Greek (comma-separated)")}</label>
            <input style={inputStyle} value={form.greek} onChange={set("greek")} placeholder="το τραπέζι" />
            <label style={labelStyle}>{t("English (optional)", "English (comma-separated)")}</label>
            <input style={inputStyle} value={form.english} onChange={set("english")} placeholder="the table" />
            <label style={labelStyle}>{t("Beispielsatz (Deutsch)", "Example sentence (German)")}</label>
            <input style={inputStyle} value={form.exampleDe} onChange={set("exampleDe")} />
            <label style={labelStyle}>{t("Μετάφραση παραδείγματος", "Example translation")}</label>
            <input style={inputStyle} value={form.exampleEl} onChange={set("exampleEl")} />
            <label style={labelStyle}>{t("Lückensatz (με ______ στη θέση της λέξης)", "Fill-in-the-blank sentence (use ______ for the word)")}</label>
            <input style={inputStyle} value={form.sentence} onChange={set("sentence")} placeholder="Der ______ ist groß." />
            <label style={labelStyle}>{t("Απάντηση Lückensatz (αν διαφέρει από τη λέξη)", "Fill-blank answer (if different from word)")}</label>
            <input style={inputStyle} value={form.answer} onChange={set("answer")} />
            <label style={labelStyle}>{t("Synonyme (Komma-getrennt)", "Synonyms (comma-separated)")}</label>
            <input style={inputStyle} value={form.synonyms} onChange={set("synonyms")} />
            <label style={labelStyle}>{t("Antonyme (Komma-getrennt)", "Antonyms (comma-separated)")}</label>
            <input style={inputStyle} value={form.antonyms} onChange={set("antonyms")} />
            <label style={labelStyle}>{t("Eselsbrücke (optional)", "Memory hook (optional)")}</label>
            <input style={inputStyle} value={form.memoryHook} onChange={set("memoryHook")} />
            <label style={labelStyle}>{t("Herkunft / Ετυμολογία (optional)", "Origin / Etymology (optional)")}</label>
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.etymology} onChange={set("etymology")} />
            <label style={labelStyle}>{t("Wissenswertes (optional)", "Good to know (optional)")}</label>
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.funFact} onChange={set("funFact")} />
            <label style={labelStyle}>{t("Tags (Komma-getrennt)", "Tags (comma-separated)")}</label>
            <input style={inputStyle} value={form.tags} onChange={set("tags")} />
            <button
              onClick={submitForm}
              disabled={!form.word.trim()}
              style={{ marginTop: 20, width: "100%", padding: "14px 0", borderRadius: 12, background: form.word.trim() ? "#CB9146" : "#D9D2C0", border: "none", color: "#211F1C", fontWeight: 700, fontSize: 14 }}
            >
              {t("Wort hinzufügen", "Add word")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function FamiliesScreen({ vocab }) {
  const [family, setFamily] = useState(null);
  const [selected, setSelected] = useState(null);
  return <>
    <FamilyCatalogue vocab={vocab} onOpen={setFamily} />
    {family && <WordFamilyModal word={family} vocab={vocab} onClose={() => setFamily(null)} onOpenWord={setSelected} />}
    {selected && <WordDetailSheet word={selected} vocab={vocab} onClose={() => setSelected(null)} onOpenWord={setSelected} />}
  </>;
}

function VocabScreen({ vocab, updateVocab }) {
  const ctx = useContext(AppCtx);
  const { lang, t } = useAppLang();
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("Alle");
  const [filterLevel, setFilterLevel] = useState("Alle");
  const [selected, setSelected] = useState(null);
  const [addMode, setAddMode] = useState(null);
  const [showPreviouslyKnown, setShowPreviouslyKnown] = useState(false);
  const [weakFirst, setWeakFirst] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [queuedView, setQueuedView] = useState(false);
  const [limit, setLimit] = useState(80);
  useEffect(() => { setLimit(80); }, [query, filterType, filterLevel, weakFirst, favOnly, queuedView]);

  const activeCount = vocab.filter((w) => !w.queued).length;
  const queuedCount = vocab.length - activeCount;
  const favCount = vocab.filter((w) => w.fav).length;
  const types = ["Alle", ...Array.from(new Set(vocab.map((w) => w.type)))];
  const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const levels = ["Alle", ...CEFR_ORDER.filter((lvl) => vocab.some((w) => w.cefr === lvl))];
  const q = query.trim().toLowerCase();

  const filtered = vocab
    .filter((w) => {
      if (!q && (queuedView ? !w.queued : w.queued)) return false;
      const matchesQuery =
        !q ||
        w.word.toLowerCase().indexOf(q) > -1 ||
        ((w.meaning && w.meaning.greek) || []).some((g) => g.toLowerCase().indexOf(q) > -1) ||
        ((w.meaning && w.meaning.english) || []).some((e) => e.toLowerCase().indexOf(q) > -1);
      const matchesType = filterType === "Alle" || w.type === filterType;
      const matchesLevel = filterLevel === "Alle" || w.cefr === filterLevel;
      const matchesFav = !favOnly || w.fav;
      return matchesQuery && matchesType && matchesLevel && matchesFav;
    })
    .sort((a, b) => (weakFirst ? ((a.learning && a.learning.confidence) || 0) - ((b.learning && b.learning.confidence) || 0) : 0));

  const chip = (active, color, bg) => ({
    padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap", fontSize: 12, fontWeight: 500,
    border: `1px solid ${active ? color : "#E8E0CE"}`, background: active ? bg : "transparent", color: active ? color : "#8B8680",
  });

  return (
    <div style={{ padding: "4px 20px 24px" }}>
      <TopBar
        title="Wörter"
        subtitle={`${activeCount} ${t("λέξεις", "words")}${queuedCount ? ` · ${queuedCount} ${t("σε αναμονή", "queued")}` : ""}`}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setShowPreviouslyKnown(true)}
              aria-label={t("Γνωρίζω ήδη", "Already know")}
              style={{ height: 44, padding: "0 12px", borderRadius: 22, background: "rgba(79,160,145,0.15)", border: "1px solid #CFE6E0", color: "#2D6E62", fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
            >
              <ListChecks size={16} />
              <span>{t("Γνωρίζω ήδη", "Already know")}</span>
            </button>
            <button onClick={() => setAddMode("form")} aria-label={t("Νέα λέξη", "New word")} style={{ width: 44, height: 44, borderRadius: "50%", background: "#CB9146", border: "none", color: "#211F1C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Plus size={18} />
            </button>
          </div>
        }
      />

      <div style={{ position: "relative", marginTop: 6 }}>
        <Search size={16} color="#A79F8E" style={{ position: "absolute", left: 12, top: 12 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Αναζήτηση (Deutsch / Ελληνικά)…", "Search (German / English)…")}
          style={{ width: "100%", padding: "11px 12px 11px 36px", borderRadius: 12, border: "1px solid #E8E0CE", background: "#FFFFFF", color: "#211F1C", fontSize: 14, outline: "none" }}
        />
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto" }} className="ww-scrollbar-none">
        {types.map((tp) => (
          <button key={tp} onClick={() => setFilterType(tp)} style={chip(filterType === tp, "#CB9146", "rgba(203,145,70,0.15)")}>
            {tp === "Alle" ? t("Alle", "All") : tp}
          </button>
        ))}
        <button onClick={() => setWeakFirst((v) => !v)} style={chip(weakFirst, "#E0584A", "rgba(224,88,74,0.12)")}>
          🔴 {t("Αδύναμες πρώτα", "Weakest first")}
        </button>
        <button onClick={() => setFavOnly((v) => !v)} style={chip(favOnly, "#CB9146", "rgba(203,145,70,0.15)")}>
          ★ {t("Αγαπημένα", "Favorites")} ({favCount})
        </button>
        {queuedCount > 0 && (
          <button onClick={() => setQueuedView((v) => !v)} style={chip(queuedView, "#8B7BC7", "rgba(139,123,199,0.12)")}>
            📥 {t("Σε αναμονή", "Queued")} ({queuedCount})
          </button>
        )}
      </div>

      {levels.length > 2 && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto" }} className="ww-scrollbar-none">
          {levels.map((lvl) => (
            <button key={lvl} onClick={() => setFilterLevel(lvl)} style={{ ...chip(filterLevel === lvl, "#4FA091", "rgba(79,160,145,0.15)"), fontWeight: 600 }}>
              {lvl === "Alle" ? t("Alle", "All") : lvl}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#A79F8E", fontSize: 13, padding: "30px 0" }}>
            {t("Δεν βρέθηκαν λέξεις.", "No words found.")}
          </div>
        )}
        {filtered.slice(0, limit).map((w) => (
          <button
            key={w.id}
            onClick={() => setSelected(w)}
            className="ww-tag-card"
            style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left", width: "100%" }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                {w.word}
                {w.queued && <span style={{ marginLeft: 6, fontSize: 10.5, color: "#8B7BC7", fontWeight: 600 }}>{t("αναμονή", "queued")}</span>}
                {isPreviouslyKnown(w) && <span style={{ marginLeft: 6, fontSize: 10.5, color: "#2D6E62", fontWeight: 600 }}>{t("γνωστή", "known")}</span>}
              </div>
              <div style={{ fontSize: 12, color: "#8B8680", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {wordPrimaryMeanings(w, lang).join(", ")}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span role="button" aria-label={t("Αγαπημένο", "Favorite")} onClick={(e) => { e.stopPropagation(); ctx.toggleFav(w.id); }} style={{ display: "flex", padding: 2 }}>
                <Star size={16} fill={w.fav ? "#CB9146" : "none"} color={w.fav ? "#CB9146" : "#C4BCA9"} />
              </span>
              <ConfidenceBar confidence={(w.learning && w.learning.confidence) || 0} />
              <ChevronRight size={16} color="#C4BCA9" />
            </div>
          </button>
        ))}
        {filtered.length > limit && (
          <button onClick={() => setLimit((l) => l + 80)} style={{ padding: "12px 0", borderRadius: 12, background: "#FFFFFF", border: "1px solid #E8E0CE", color: "#8B8680", fontSize: 13, fontWeight: 600 }}>
            {t(`Φόρτωσε +80 (${filtered.length - limit} ακόμα)`, `Load +80 (${filtered.length - limit} more)`)}
          </button>
        )}
      </div>

      {selected && (
        <WordDetailSheet
          word={selected}
          onClose={() => setSelected(null)}
          onDelete={(w) => { ctx.deleteWord(w.id); setSelected(null); }}
          vocab={vocab}
          onOpenWord={(w) => setSelected(w)}
        />
      )}
      {addMode && <AddWordModal onClose={() => setAddMode(null)} initialMode={addMode} />}
      {showPreviouslyKnown && (
        <PreviouslyKnownModal
          vocab={vocab}
          onClose={() => setShowPreviouslyKnown(false)}
          onSave={(ids) => {
            updateVocab((prev) => applyPreviouslyKnownSelection(prev, ids));
            setShowPreviouslyKnown(false);
          }}
        />
      )}
    </div>
  );
}

/* ============================== GRAMMAR SCREEN ============================== */

function formatDuration(ms, lang = "el") {
  const totalMin = Math.round(ms / 60000);
  if (lang === "en") {
    if (totalMin < 1) return "<1 min";
    if (totalMin < 60) return `${totalMin} min`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (totalMin < 1) return "<1 λεπτό";
  if (totalMin < 60) return `${totalMin} λεπτά`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} ώρ. ${m} λεπ.` : `${h} ώρες`;
}

function StatsScreen({ vocab, meta, allVocab, onOpenB2Practice, initialScope = "all" }) {
  const { lang, t } = useAppLang();
  const ctx = useContext(AppCtx);
  const fileRef = useRef(null);
  const [restoreMsg, setRestoreMsg] = useState("");
  const [restoreReview, setRestoreReview] = useState(null);
  const [restorePayload, setRestorePayload] = useState(null);
  const [statsScope, setStatsScope] = useState(initialScope);
  useEffect(() => {
    setStatsScope(initialScope);
  }, [initialScope]);
  const [selectedXpDate, setSelectedXpDate] = useState(null);
  const [learningCriterion, setLearningCriterion] = useState("assimilated");
  const [selectedLearningDate, setSelectedLearningDate] = useState(null);
  const b2Vocab = useMemo(() => vocab.filter(isB2Word), [vocab]);
  const isB2View = statsScope === "b2";
  const statsVocab = isB2View ? b2Vocab : vocab;
  const statsVocabById = useMemo(
    () => new Map(statsVocab.map((w) => [String(w.id || w.word), w])),
    [statsVocab],
  );
  const progressStats = useMemo(() => vocabProgressStats(vocab, now()), [vocab]);
  const mastered = progressStats.mastered;
  const retained = progressStats.retained;
  const provisionallyMastered = progressStats.provisionallyMastered;
  const consolidating = progressStats.consolidating;
  const learning = progressStats.learning;
  const previouslyKnown = progressStats.previouslyKnown;
  const due = progressStats.due;
  const typedMastered = progressStats.typedVerified;
  const accuracy = progressStats.overallAccuracy;
  const activeRecallAccuracy = progressStats.activeRecallAccuracy;
  const testLogs = meta.testLogs || [];

  const xpTimeline = useMemo(() => weeklyXpTimeline(meta.sessionLogs || []), [meta.sessionLogs]);
  const weeklyXpTotal = useMemo(() => xpTimeline.reduce((s, d) => s + d.xp, 0), [xpTimeline]);
  const todayXp = xpTimeline[xpTimeline.length - 1]?.xp || 0;
  const activeXpPoint = xpTimeline.find((d) => d.date === selectedXpDate) || xpTimeline[xpTimeline.length - 1];

  const learningRate = useMemo(() => learningRate30d(statsVocab, now(), learningCriterion, 30), [statsVocab, learningCriterion]);
  const learningTrendDelta = learningRate.last7dCount - learningRate.prev7dCount;
  const latestActiveLearningPoint = [...learningRate.days].reverse().find((d) => d.count > 0) || null;
  const defaultLearningPoint = latestActiveLearningPoint || learningRate.days[learningRate.days.length - 1];
  const activeLearningPoint = learningRate.days.find((d) => d.date === selectedLearningDate) || defaultLearningPoint;
  const activeLearningIdx = Math.max(0, learningRate.days.findIndex((d) => d.date === activeLearningPoint?.date));
  const learningAccent = learningCriterion === "mastered" ? "#6FA96B" : learningCriterion === "started" ? "#4FA091" : "#CB9146";
  const learningCriterionMeta = {
    assimilated: {
      label: t("Αφομοίωση", "Assimilated"),
      hint: t("Λέξεις με 3+ ακριβείς ανακλήσεις σε διαφορετικά συμφραζόμενα", "Words with 3+ exact recalls in different contexts"),
    },
    mastered: {
      label: t("Κατάκτηση", "Mastered"),
      hint: t("Πλήρης τεκμηρίωση (4 συμφραζόμενα, 2+ ασκήσεις & έλεγχοι 1–2/3–5/7–14 ημ.)", "Full evidence (4 contexts, 2+ exercises & 1–2/3–5/7–14 day checks)"),
    },
    started: {
      label: t("Έναρξη", "Started"),
      hint: t("Λέξεις που μπήκαν σε μελέτη για πρώτη φορά", "Words studied for the first time"),
    },
  };

  const chartData = useMemo(() => {
    const byDate = {};
    (meta.sessionLogs || []).forEach((l) => {
      if (!byDate[l.date]) byDate[l.date] = { date: l.date, correct: 0, total: 0 };
      byDate[l.date].correct += l.correct;
      byDate[l.date].total += l.total;
    });
    return Object.values(byDate).filter((d) => d.total > 0).slice(-7).map((d) => ({
      day: d.date.slice(5),
      accuracy: Math.round((d.correct / d.total) * 100),
    }));
  }, [meta.sessionLogs]);

  const todayStr = dateStr(now());
  const timeToday = (meta.sessionLogs || []).filter((l) => l.date === todayStr).reduce((s, l) => s + (l.durationMs || 0), 0);
  const totalTime = meta.totalStudyTimeMs || 0;

  const cefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const cefrBreakdown = cefrLevels
    .map((lvl) => {
      const words = vocab.filter((w) => (lvl === "B2" ? isB2Word(w) : w.cefr === lvl));
      const mast = words.filter(isMasteredThroughWortwerk).length;
      const inWork = words.filter((w) => !isPreviouslyKnown(w) && mastery(w).level !== "New" && !mastery(w).mastered).length;
      return { level: lvl, total: words.length, mastered: mast, inWork };
    })
    .filter((row) => row.total > 0);

  function exportBackup(vocabularyOnly = false) {
    const payload = vocabularyOnly ? vocabularyBackup(allVocab || vocab) : ctx.getBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wortwerk-${vocabularyOnly ? "vocabulary" : "backup"}-${dateStr(now())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > MAX_JSON_BYTES) { setRestoreMsg(t("Το αρχείο υπερβαίνει το όριο 10 MiB.", "File exceeds the 10 MiB limit.")); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onerror = () => setRestoreMsg(t("Δεν διαβάστηκε το αρχείο.", "Could not read the file."));
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result).replace(/^\uFEFF/, ""));
        parseImport(String(reader.result));
        setRestorePayload(payload);
        setRestoreReview(reviewEntries(ctx.vocab, parseImport(String(reader.result)).vocab));
        setRestoreMsg("");
      } catch (err) {
        setRestoreMsg(err.message || t("Το αρχείο δεν είναι έγκυρο αντίγραφο ασφαλείας.", "The file is not a valid backup."));
      }
    };
    reader.readAsText(f, "UTF-8");
    e.target.value = "";
  }

  const sectionTitle = { fontSize: 12, color: "#A79F8E", marginTop: 22, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 };

  return (
    <div style={{ padding: "4px 20px 30px" }}>
      <TopBar
        title="Fortschritt"
        subtitle={
          isB2View
            ? t(`Δυναμική πρόοδος μόνο για B2 (${b2Vocab.length} λέξεις)`, `Dynamic B2-only progress (${b2Vocab.length} words)`)
            : t("Deine Werkstatt-Statistik", "Your workshop statistics")
        }
      />

      <div
        role="group"
        aria-label={t("Εύρος στατιστικών προόδου", "Progress statistics scope")}
        style={{
          display: "flex",
          gap: 6,
          padding: 4,
          marginBottom: 14,
          background: "#F4EFE4",
          border: "1px solid #E8E0CE",
          borderRadius: 12,
        }}
      >
        {[
          { key: "all", label: t("Όλα τα επίπεδα", "All levels"), count: vocab.length },
          { key: "b2", label: t("Μόνο B2", "B2 only"), count: b2Vocab.length },
        ].map((opt) => {
          const active = statsScope === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setStatsScope(opt.key);
                setSelectedLearningDate(null);
              }}
              style={{
                flex: 1,
                padding: "9px 10px",
                borderRadius: 9,
                border: active ? "1px solid rgba(203,145,70,0.38)" : "1px solid transparent",
                background: active ? "#FFFFFF" : "transparent",
                color: active ? "#211F1C" : "#6B645A",
                fontSize: 12.5,
                fontWeight: active ? 700 : 600,
                boxShadow: active ? "0 2px 6px rgba(33,31,28,0.07)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "background 160ms ease, color 160ms ease",
              }}
            >
              <span>{opt.label}</span>
              <span
                className="ww-mono"
                style={{
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 6,
                  background: active ? (opt.key === "b2" ? "rgba(203,145,70,0.16)" : "#F4EFE4") : "rgba(33,31,28,0.06)",
                  color: active && opt.key === "b2" ? "#9C6924" : "#6B645A",
                }}
              >
                {opt.count}
              </span>
            </button>
          );
        })}
      </div>

      {isB2View ? (
        <B2ProgressPanel
          vocab={vocab}
          testLogs={testLogs}
          onStartB2Practice={onOpenB2Practice}
        />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="ww-tag-card" style={{ padding: "16px" }}>
              <div className="ww-tag-hole" />
              <Flame size={18} color="#CB9146" />
              <div className="ww-display" style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{meta.streak || 0}</div>
              <div style={{ fontSize: 11.5, color: "#8B8680" }}>{t("Tage Serie", "Day streak")}</div>
            </div>
            <div className="ww-tag-card" style={{ padding: "16px" }}>
              <div className="ww-tag-hole" />
              <Trophy size={18} color="#CB9146" />
              <div className="ww-display" style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{mastered}</div>
              <div style={{ fontSize: 11.5, color: "#8B8680" }}>
                Mastered{retained > 0 ? ` (${retained} Retained)` : ""}
              </div>
            </div>
            <div className="ww-tag-card" style={{ padding: "16px" }}>
              <div className="ww-tag-hole" />
              <ListChecks size={18} color="#4FA091" />
              <div className="ww-display" style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>
                {accuracy != null ? `${accuracy}%` : "—"}
              </div>
              <div style={{ fontSize: 11.5, color: "#8B8680" }}>
                {t("Συνολική ακρίβεια · Ενεργή ανάκλ.:", "Overall accuracy · Active recall:")} {activeRecallAccuracy != null ? `${activeRecallAccuracy}%` : "—"}
              </div>
            </div>
            <div className="ww-tag-card" style={{ padding: "16px" }}>
              <div className="ww-tag-hole" />
              <Sparkles size={18} color="#8B7BC7" />
              <div className="ww-display" style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{formatDuration(timeToday, lang)}</div>
              <div style={{ fontSize: 11.5, color: "#8B8680" }}>{t("Χρόνος σήμερα", "Time today")}</div>
            </div>
          </div>
        </>
      )}

      <div style={sectionTitle}>
        {isB2View
          ? t("Learning Rate B2 · Τελευταίες 30 ημέρες", "Learning Rate B2 · Last 30 days")
          : t("Learning Rate · Τελευταίες 30 ημέρες", "Learning Rate · Last 30 days")}
      </div>
      <div className="ww-tag-card" style={{ padding: "16px 14px 14px" }}>
        <div className="ww-tag-hole" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="ww-display ww-mono" style={{ fontSize: 26, fontWeight: 700, color: "#211F1C", fontVariantNumeric: "tabular-nums" }}>
                {learningRate.ratePerDay.toFixed(2)}
              </span>
              <span style={{ fontSize: 12.5, color: "#8B8680" }}>{t("λέξεις / ημέρα", "words / day")}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "#8B8680", marginTop: 2 }}>
              {learningRate.totalWords}{" "}
              {learningRate.totalWords === 1 ? t("νέα λέξη", "new word") : t("νέες λέξεις", "new words")}{" "}
              {t("σε 30 ημ.", "in 30d")} · {learningRate.activeDays}{" "}
              {learningRate.activeDays === 1 ? t("ενεργή ημέρα", "active day") : t("ενεργές ημέρες", "active days")}
            </div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: learningTrendDelta > 0 ? "#3F8C5F" : learningTrendDelta < 0 ? "#CB9146" : "#8B8680", fontVariantNumeric: "tabular-nums" }}>
            {learningTrendDelta > 0 ? <TrendingUp size={14} /> : learningTrendDelta < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
            <span>
              {learningTrendDelta > 0
                ? t(`+${learningTrendDelta} vs προηγ. 7 ημ.`, `+${learningTrendDelta} vs prev 7d`)
                : learningTrendDelta < 0
                  ? t(`${learningTrendDelta} vs προηγ. 7 ημ.`, `${learningTrendDelta} vs prev 7d`)
                  : t(`${learningRate.last7dCount} τις τελευταίες 7 ημ.`, `${learningRate.last7dCount} in last 7d`)}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, padding: 3, background: "#FAF7F0", border: "1px solid #ECE4D3", borderRadius: 10, marginTop: 12 }} role="group" aria-label={t("Κριτήριο Learning Rate", "Learning Rate criterion")}>
          {["assimilated", "mastered", "started"].map((key) => {
            const active = learningCriterion === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setLearningCriterion(key); setSelectedLearningDate(null); }}
                style={{
                  flex: 1,
                  padding: "7px 8px",
                  borderRadius: 7,
                  fontSize: 11.5,
                  fontWeight: active ? 700 : 500,
                  whiteSpace: "nowrap",
                  background: active ? "#FFFFFF" : "transparent",
                  color: active ? "#211F1C" : "#8B8680",
                  boxShadow: active ? "0 1px 3px rgba(33,31,28,0.08)" : "none",
                  border: "none",
                }}
              >
                {learningCriterionMeta[key].label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: "#8B8680", marginTop: 6 }}>
          {learningCriterionMeta[learningCriterion].hint}
        </div>
        {learningRate.ratePerDay > 0 && (
          <div style={{ fontSize: 11, color: "#4A453D", marginTop: 8, paddingTop: 8, borderTop: "1px solid #ECE4D3", fontVariantNumeric: "tabular-nums" }}>
            {t("Μ.ό. ενεργών ημερών:", "Active-day avg:")} <strong>{learningRate.activeDayRate.toFixed(2)}</strong> {t("λέξεις/ημέρα", "words/day")}
            {learningRate.estimatedDaysRemaining != null
              ? t(
                  ` · Εκτίμηση: ~${learningRate.estimatedDaysRemaining} ημ. για τις υπόλοιπες ${learningRate.remainingWords}`,
                  ` · Est.: ~${learningRate.estimatedDaysRemaining}d for remaining ${learningRate.remainingWords}`,
                )
              : ""}
          </div>
        )}
      </div>

      <div style={sectionTitle}>
        {isB2View
          ? t("Χρονογραμμή εκμάθησης B2 · Τελευταίες 30 ημέρες", "B2 learning timeline · Last 30 days")
          : t("Χρονογραμμή εκμάθησης · Τελευταίες 30 ημέρες", "Learning timeline · Last 30 days")}
      </div>
      <div className="ww-tag-card" style={{ padding: "16px 14px 14px" }}>
        <div className="ww-tag-hole" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#211F1C" }}>
              {learningRate.totalWords}{" "}
              {learningCriterion === "mastered"
                ? t("κατακτημένες", "mastered")
                : learningCriterion === "started"
                  ? t("νέες σε μελέτη", "newly started")
                  : t("αφομοιωμένες", "assimilated")}{" "}
              {isB2View ? t("B2 λέξεις", "B2 words") : t("λέξεις", "words")}
            </div>
            <div style={{ fontSize: 11, color: "#8B8680", marginTop: 1 }}>
              {t("Ημερήσια πρόοδος & σωρευτική πορεία 30 ημερών", "Daily progress & 30-day cumulative curve")}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              aria-label={t("Προηγούμενη ημέρα", "Previous day")}
              disabled={activeLearningIdx <= 0}
              onClick={() => {
                const prev = learningRate.days[activeLearningIdx - 1];
                if (prev) setSelectedLearningDate(prev.date);
              }}
              style={{
                width: 30, height: 30, borderRadius: 8, border: "1px solid #E8E0CE",
                background: "#FAF7F0", color: activeLearningIdx <= 0 ? "#C9C1B2" : "#211F1C",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => setSelectedLearningDate(learningRate.days[learningRate.days.length - 1]?.date || null)}
              style={{
                padding: "5px 9px", borderRadius: 8, border: "1px solid #E8E0CE",
                background: activeLearningPoint?.isToday ? "#211F1C" : "#FAF7F0",
                color: activeLearningPoint?.isToday ? "#FAF7F0" : "#4A453D",
                fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
              }}
            >
              {t("Σήμερα", "Today")}
            </button>
            <button
              type="button"
              aria-label={t("Επόμενη ημέρα", "Next day")}
              disabled={activeLearningIdx >= learningRate.days.length - 1}
              onClick={() => {
                const next = learningRate.days[activeLearningIdx + 1];
                if (next) setSelectedLearningDate(next.date);
              }}
              style={{
                width: 30, height: 30, borderRadius: 8, border: "1px solid #E8E0CE",
                background: "#FAF7F0", color: activeLearningIdx >= learningRate.days.length - 1 ? "#C9C1B2" : "#211F1C",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div style={{ width: "100%", height: 145, marginTop: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={learningRate.days}
              margin={{ top: 8, right: 6, left: -24, bottom: 0 }}
              onClick={(state) => {
                const pt = state?.activePayload?.[0]?.payload;
                if (pt?.date) setSelectedLearningDate(pt.date);
              }}
            >
              <defs>
                <linearGradient id="wwLearningCumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={learningAccent} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={learningAccent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECE4D3" vertical={false} />
              <XAxis dataKey="day" interval={6} tick={{ fill: "#8B8680", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="daily" allowDecimals={false} tick={{ fill: "#A79F8E", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="cum" orientation="right" hide domain={[0, "dataMax + 1"]} />
              <Tooltip
                cursor={{ fill: "rgba(203,145,70,0.08)" }}
                content={({ active, payload }) => {
                  const pt = active && payload?.[0]?.payload;
                  if (!pt) return null;
                  return (
                    <div style={{ background: "#FFFFFF", border: "1px solid #E8E0CE", borderRadius: 10, padding: "8px 10px", fontSize: 12, boxShadow: "0 4px 12px rgba(33,31,28,0.08)", maxWidth: 220 }}>
                      <div style={{ fontWeight: 600, color: "#211F1C" }}>{pt.day}{pt.isToday ? t(" · Σήμερα", " · Today") : ""}</div>
                      <div style={{ color: learningAccent, fontWeight: 700, marginTop: 2 }}>
                        +{pt.count} {pt.count === 1 ? t("λέξη", "word") : t("λέξεις", "words")}
                        <span style={{ color: "#8B8680", fontWeight: 500, fontSize: 11 }}> · {t("σύνολο", "total")} {pt.cumulative}</span>
                      </div>
                      {pt.words.length > 0 && (
                        <div style={{ color: "#4A453D", fontSize: 11, marginTop: 3, lineHeight: 1.35 }}>
                          {pt.words.slice(0, 4).join(" · ")}{pt.words.length > 4 ? ` (+${pt.words.length - 4})` : ""}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                yAxisId="cum"
                type="monotone"
                dataKey="cumulative"
                stroke={learningAccent}
                strokeWidth={1.75}
                strokeOpacity={0.6}
                fill="url(#wwLearningCumGrad)"
                dot={false}
                activeDot={{ r: 4, fill: learningAccent, stroke: "#FFFFFF", strokeWidth: 1.5 }}
              />
              <Bar yAxisId="daily" dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={12}>
                {learningRate.days.map((pt) => {
                  const isSelected = activeLearningPoint?.date === pt.date;
                  const fill = pt.count === 0
                    ? "#ECE4D3"
                    : isSelected
                      ? learningAccent
                      : `${learningAccent}99`;
                  return <Cell key={pt.date} fill={fill} cursor="pointer" />;
                })}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div
          role="group"
          aria-label={t("Επιλογή ημέρας τελευταίων 30 ημερών", "Select day in last 30 days")}
          style={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))", gap: 4, marginTop: 10 }}
        >
          {learningRate.days.map((pt) => {
            const isSelected = activeLearningPoint?.date === pt.date;
            const hasActivity = pt.count > 0;
            const dayNum = pt.date.slice(8, 10);
            const dayWordLabel = pt.count === 1 ? t("λέξη", "word") : t("λέξεις", "words");
            return (
              <button
                key={pt.date}
                type="button"
                onClick={() => setSelectedLearningDate(pt.date)}
                aria-label={`${pt.day}: ${pt.count} ${dayWordLabel}`}
                aria-pressed={isSelected}
                title={`${pt.day}: ${pt.count} ${dayWordLabel}`}
                style={{
                  padding: "5px 2px",
                  borderRadius: 7,
                  border: isSelected ? `1.5px solid ${learningAccent}` : hasActivity ? `1px solid ${learningAccent}55` : "1px solid #ECE4D3",
                  background: isSelected
                    ? `${learningAccent}24`
                    : hasActivity
                      ? `${learningAccent}12`
                      : "#FAF7F0",
                  color: isSelected ? "#211F1C" : hasActivity ? "#211F1C" : "#A79F8E",
                  fontSize: 10.5,
                  fontWeight: isSelected || hasActivity ? 700 : 500,
                  lineHeight: 1.15,
                  textAlign: "center",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <div>{dayNum}</div>
                <div style={{ fontSize: 9.5, color: hasActivity ? learningAccent : "#C9C1B2", marginTop: 1 }}>
                  {hasActivity ? `+${pt.count}` : "·"}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #ECE4D3" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#211F1C" }}>
              {activeLearningPoint?.day}{activeLearningPoint?.isToday ? t(" · Σήμερα", " · Today") : ""}
            </span>
            <span className="ww-mono" style={{ fontSize: 12, color: activeLearningPoint?.count ? learningAccent : "#8B8680", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {activeLearningPoint?.count || 0} {activeLearningPoint?.count === 1 ? t("λέξη", "word") : t("λέξεις", "words")}
            </span>
          </div>

          {activeLearningPoint?.entries?.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              {activeLearningPoint.entries.map((entry, idx) => {
                const matchedWord = statsVocabById.get(entry.id);
                const entryMeaning = matchedWord
                  ? wordPrimaryMeanings(matchedWord, lang).slice(0, 2).join(", ")
                  : entry.greek;
                return (
                  <div
                    key={entry.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 10,
                      padding: "6px 0",
                      borderBottom: idx < activeLearningPoint.entries.length - 1 ? "1px solid #F1EBDF" : "none",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#211F1C" }}>{entry.word}</span>
                      {entryMeaning && (
                        <span style={{ fontSize: 11.5, color: "#4A453D", marginLeft: 8 }}>{entryMeaning}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#8B8680", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {[entry.cefr, entry.level].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: "#8B8680", lineHeight: 1.45 }}>
                {learningRate.totalWords === 0 && learningCriterion === "mastered"
                  ? t(
                      "Καμία πλήρης κατάκτηση τις τελευταίες 30 ημέρες (απαιτεί ελέγχους 1/3/7 ημερών).",
                      "No full mastery in the last 30 days (requires 1/3/7-day checks).",
                    )
                  : t(
                      `Καμία ${learningCriterion === "mastered" ? "κατακτημένη" : learningCriterion === "started" ? "νέα" : "αφομοιωμένη"} λέξη στις ${activeLearningPoint?.day}.`,
                      `No ${learningCriterion === "mastered" ? "mastered" : learningCriterion === "started" ? "started" : "assimilated"} words on ${activeLearningPoint?.day}.`,
                    )}
              </span>
              {latestActiveLearningPoint && latestActiveLearningPoint.date !== activeLearningPoint?.date && (
                <button
                  type="button"
                  onClick={() => setSelectedLearningDate(latestActiveLearningPoint.date)}
                  style={{ fontSize: 11.5, fontWeight: 600, color: learningAccent, background: "transparent", border: "none", padding: "3px 0", textDecoration: "underline" }}
                >
                  {t(`Τελευταία ενεργή (${latestActiveLearningPoint.day})`, `Latest active (${latestActiveLearningPoint.day})`)}
                </button>
              )}
              {learningRate.totalWords === 0 && learningCriterion === "mastered" && (
                <button
                  type="button"
                  onClick={() => { setLearningCriterion("assimilated"); setSelectedLearningDate(null); }}
                  style={{ fontSize: 11.5, fontWeight: 600, color: "#CB9146", background: "transparent", border: "none", padding: "3px 0", textDecoration: "underline" }}
                >
                  {t("Δες «Αφομοίωση»", 'View "Assimilated"')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {!isB2View && (
        <>
      <div style={sectionTitle}>{t("Χρονογραμμή XP · Τελευταίες 7 ημέρες", "XP Timeline · Last 7 days")}</div>
      <div className="ww-tag-card" style={{ padding: "16px 14px 12px" }}>
        <div className="ww-tag-hole" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
          <div>
            <span className="ww-display" style={{ fontSize: 22, fontWeight: 700, color: "#211F1C" }}>{weeklyXpTotal} XP</span>
            <span style={{ fontSize: 12, color: "#8B8680", marginLeft: 8 }}>{t("την τελευταία εβδομάδα", "in the last week")}</span>
          </div>
          <span className="ww-mono" style={{ fontSize: 11.5, color: "#CB9146", fontWeight: 600 }}>
            {t("Σήμερα:", "Today:")} +{todayXp} XP
          </span>
        </div>
        <div style={{ width: "100%", height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={xpTimeline}
              margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
              onClick={(state) => {
                const pt = state?.activePayload?.[0]?.payload;
                if (pt?.date) setSelectedXpDate(pt.date);
              }}
            >
              <defs>
                <linearGradient id="wwXpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#CB9146" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#CB9146" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECE4D3" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#8B8680", fontSize: 10.5 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#A79F8E", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ stroke: "#CB9146", strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  const pt = active && payload?.[0]?.payload;
                  if (!pt) return null;
                  return (
                    <div style={{ background: "#FFFFFF", border: "1px solid #E8E0CE", borderRadius: 10, padding: "8px 10px", fontSize: 12, boxShadow: "0 4px 12px rgba(33,31,28,0.08)" }}>
                      <div style={{ fontWeight: 600, color: "#211F1C" }}>{pt.day}{pt.isToday ? t(" · Σήμερα", " · Today") : ""}</div>
                      <div style={{ color: "#CB9146", fontWeight: 700, marginTop: 2 }}>+{pt.xp} XP</div>
                      <div style={{ color: "#8B8680", fontSize: 11 }}>{pt.sessions} {pt.sessions === 1 ? t("συνεδρία", "session") : t("συνεδρίες", "sessions")}</div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="xp"
                stroke="#CB9146"
                strokeWidth={2.5}
                fill="url(#wwXpGradient)"
                dot={{ r: 3.5, fill: "#FFFFFF", stroke: "#CB9146", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#CB9146", stroke: "#FFFFFF", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 10, justifyContent: "space-between" }}>
          {xpTimeline.map((pt) => {
            const active = activeXpPoint?.date === pt.date;
            return (
              <button
                key={pt.date}
                type="button"
                onClick={() => setSelectedXpDate(pt.date)}
                style={{
                  flex: 1, padding: "5px 2px", borderRadius: 8, fontSize: 10.5,
                  border: active ? "1px solid #CB9146" : "1px solid #ECE4D3",
                  background: active ? "rgba(203,145,70,0.14)" : "#FAF7F0",
                  color: active ? "#211F1C" : "#8B8680", fontWeight: active ? 700 : 500,
                }}
              >
                <div>{pt.isToday ? t("Σήμ.", "Today") : pt.day}</div>
                <div className="ww-mono" style={{ fontSize: 10, color: pt.xp > 0 ? "#B07A2A" : "#A79F8E" }}>{pt.xp}</div>
              </button>
            );
          })}
        </div>
        {activeXpPoint && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#4A453D", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #ECE4D3" }}>
            <span>{activeXpPoint.day}{activeXpPoint.isToday ? t(" (Σήμερα)", " (Today)") : ""}</span>
            <span>
              <strong style={{ color: "#CB9146" }}>+{activeXpPoint.xp} XP</strong> · {activeXpPoint.sessions} {activeXpPoint.sessions === 1 ? t("συνεδρία", "session") : t("συνεδρίες", "sessions")}
            </span>
          </div>
        )}
      </div>

      <div style={sectionTitle}>{t("Letzte Runden", "Recent rounds")}</div>
      <div className="ww-tag-card" style={{ padding: "16px 12px 8px", height: 160 }}>
        <div className="ww-tag-hole" />
        {chartData.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#A79F8E", fontSize: 12.5 }}>
            {t("Noch keine Runden gespielt", "No rounds played yet")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECE4D3" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#A79F8E", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#A79F8E", fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E8E0CE", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="accuracy" fill="#CB9146" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={sectionTitle}>{t("Wortschatz-Verteilung", "Vocabulary distribution")}</div>
      <div className="ww-tag-card" style={{ padding: "16px" }}>
        <div className="ww-tag-hole" />
        {[
          { label: t("Retained (Διατήρηση)", "Retained"), value: retained, color: "#3F8C5F" },
          { label: t("Mastered (Κατάκτηση)", "Mastered"), value: provisionallyMastered, color: "#6FA96B" },
          { label: t("Consolidating (Αφομοίωση)", "Consolidating"), value: consolidating, color: "#CB9146" },
          { label: t("Learning (Εκμάθηση)", "Learning"), value: learning, color: "#4FA091" },
          { label: t("Previously Known (Γνωρίζω ήδη)", "Previously Known"), value: previouslyKnown, color: "#2D6E62" },
          { label: t("Γραφή Recall χωρίς βοήθεια", "Typed recall without hint"), value: typedMastered, color: "#8B7BC7" },
          { label: t("Fällig (Οφειλόμενες)", "Due for review"), value: due, color: "#E0584A" },
        ].map((row) => (
          <div key={row.label} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "#4A453D" }}>{row.label}</span>
              <span className="ww-mono" style={{ color: row.color }}>{row.value}</span>
            </div>
            <div style={{ height: 6, background: "#ECE4D3", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${vocab.length ? (row.value / vocab.length) * 100 : 0}%`, background: row.color }} />
            </div>
          </div>
        ))}
      </div>

      {testLogs.length > 0 && (
        <>
          <div style={sectionTitle}>{t("Εβδομαδιαία τεστ", "Weekly tests")}</div>
          <div className="ww-tag-card" style={{ padding: "14px 16px" }}>
            <div className="ww-tag-hole" />
            {testLogs.slice(-5).reverse().map((tl, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "5px 0", borderBottom: i < Math.min(testLogs.length, 5) - 1 ? "1px solid #ECE4D3" : "none" }}>
                <span style={{ color: "#8B8680", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {tl.date}
                  {tl.scope === "b2" && (
                    <span className="ww-mono" style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(203,145,70,0.16)", color: "#9C6924" }}>
                      B2
                    </span>
                  )}
                </span>
                <span><strong>{Math.round(((tl.exact + tl.near) / tl.total) * 100)}%</strong> <span style={{ color: "#A79F8E" }}>({tl.exact}+{tl.near}/{tl.total}{tl.synonym ? t(` · ${tl.synonym} συν.`, ` · ${tl.synonym} syn.`) : ""})</span></span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={sectionTitle}>{t("Πρόοδος ανά επίπεδο", "Progress by CEFR level")}</div>
      <div className="ww-tag-card" style={{ padding: "16px" }}>
        <div className="ww-tag-hole" />
        {cefrBreakdown.length === 0 && <div style={{ fontSize: 12.5, color: "#A79F8E" }}>{t("Δεν υπάρχουν λέξεις με επίπεδο ακόμα.", "No words with CEFR levels yet.")}</div>}
        {cefrBreakdown.map((row) => {
          const pct = row.total ? Math.round((row.mastered / row.total) * 100) : 0;
          const workPct = row.total ? Math.round((row.inWork / row.total) * 100) : 0;
          return (
            <div key={row.level} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 4, gap: 8 }}>
                <span style={{ color: "#4A453D", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span>{row.level}</span>
                  {row.level === "B2" && (
                    <button
                      type="button"
                      onClick={() => { setStatsScope("b2"); setSelectedLearningDate(null); }}
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        border: "1px solid rgba(203,145,70,0.45)",
                        background: "rgba(203,145,70,0.12)",
                        color: "#9C6924",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {t("Αναλυτικά B2 →", "B2 details →")}
                    </button>
                  )}
                </span>
                <span className="ww-mono" style={{ color: "#CB9146" }}>
                  {pct}%{row.inWork > 0 ? t(` (+${row.inWork} σε εξέλιξη)`, ` (+${row.inWork} in progress)`) : ""}
                </span>
              </div>
              <div style={{ height: 6, background: "#ECE4D3", borderRadius: 999, overflow: "hidden", display: "flex" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "#6FA96B" }} />
                <div style={{ height: "100%", width: `${Math.min(100 - pct, workPct)}%`, background: "#CB9146", opacity: 0.7 }} />
              </div>
              <div style={{ fontSize: 11, color: "#8B8680", marginTop: 4 }}>
                {row.mastered} {t("γνωστές", "mastered")}
                {row.inWork > 0 ? t(` · ${row.inWork} σε εξέλιξη`, ` · ${row.inWork} in progress`) : ""} ·{" "}
                {row.total - row.mastered - row.inWork} {t("απομένουν", "remaining")} · {row.total} {t("σύνολο", "total")}
              </div>
            </div>
          );
        })}
      </div>

      <div style={sectionTitle}>{t("Σύνολο χρόνου εξάσκησης", "Total practice time")}</div>
      <div className="ww-tag-card" style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="ww-tag-hole" />
        <div>
          <div className="ww-display" style={{ fontSize: 22, fontWeight: 700 }}>{formatDuration(totalTime, lang)}</div>
          <div style={{ fontSize: 11.5, color: "#8B8680", marginTop: 2 }}>{t("από τότε που ξεκίνησες", "since you started")}</div>
        </div>
        <Trophy size={26} color="#CB9146" />
      </div>
        </>
      )}

      <button
        onClick={() => exportBackup(false)}
        style={{ marginTop: 24, width: "100%", padding: "14px 0", borderRadius: 12, background: "#FFFFFF", border: "1px solid #E8E0CE", color: "#211F1C", fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <RotateCcw size={15} /> {t(`Εξαγωγή αντιγράφου ασφαλείας (${(allVocab || vocab).length} λέξεις)`, `Export full backup (${(allVocab || vocab).length} words)`)}
      </button>
      <button
        onClick={() => fileRef.current && fileRef.current.click()}
        style={{ marginTop: 10, width: "100%", padding: "14px 0", borderRadius: 12, background: "#FFFFFF", border: "1px solid #E8E0CE", color: "#211F1C", fontWeight: 600, fontSize: 13.5 }}
      >
        {t("Επαναφορά / συγχώνευση από αντίγραφο", "Restore / merge from backup")}
      </button>
      <Button variant="outline" className="mt-3 w-full" onClick={() => exportBackup(true)}>
        {t("Εξαγωγή μόνο λεξιλογίου", "Export vocabulary only")}
      </Button>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <a href="/audit/quality_report.md" download>{t("Αναφορά ελέγχου", "Audit report")}</a>
        <a href="/audit/import_manifest.json" download>{t("Πηγές", "Sources")}</a>
        <a href="/audit/wortwerk_master.json" download>{t("Ενοποιημένο λεξιλόγιο", "Unified vocabulary")}</a>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
      {restoreReview && <ImportReview rows={restoreReview} onChange={setRestoreReview} onCancel={() => setRestoreReview(null)} onConfirm={() => {
        try {
          const r = ctx.restoreBackup(restorePayload, restoreReview);
          setRestoreMsg(
            t(
              `✓ ${r.added} νέες · ${r.updated} συγχωνεύσεις · ${r.skipped || 0} παραλείψεις`,
              `✓ ${r.added} new · ${r.updated} merged · ${r.skipped || 0} skipped`,
            ),
          );
          setRestoreReview(null);
        } catch (err) { setRestoreMsg(err.message); }
      }} />}
      {restoreMsg && <div className="ww-pop" style={{ marginTop: 10, fontSize: 12.5, color: restoreMsg.indexOf("✓") === 0 ? "#3F8C5F" : "#E0584A", lineHeight: 1.5 }}>{restoreMsg}</div>}
      <div style={{ fontSize: 11.5, color: "#A79F8E", marginTop: 8, lineHeight: 1.5 }}>
        {t(
          "Η επαναφορά δεν σβήνει τίποτα: προσθέτει ό,τι λείπει και κρατά την καλύτερη πρόοδο κάθε λέξης.",
          "Restore never deletes anything: it adds missing entries and keeps the best progress for each word.",
        )}
      </div>
    </div>
  );
}

/* ============================== APP ROOT ============================== */

function WortwerkAppContent() {
  const { lang, setLang, t } = useAppLang();
  const [activeModule, setActiveModule] = useState("woerter");
  const [tab, setTab] = useState("home");
  const [vocab, setVocab] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoStartDaily, setAutoStartDaily] = useState(false);
  const [practiceScope, setPracticeScope] = useState("all");
  const [statsInitialScope, setStatsInitialScope] = useState("all");
  const vocabRef = useRef(null);
  const metaRef = useRef(null);
  const backupExtrasRef = useRef({});
  const stateExtrasRef = useRef({});

  useEffect(() => {
    (async () => {
      let loadedVocab = null;
      let loadedMeta = null;
      try {
        const m = await storeGet("progress-meta");
        if (m) loadedMeta = { ...DEFAULT_META, ...JSON.parse(m) };
        const ext = await storeGet('backup-extras');
        if (ext) { const parsed = JSON.parse(ext); backupExtrasRef.current = parsed.extras || {}; stateExtrasRef.current = parsed.stateExtras || {}; }
      } catch (e) { loadedMeta = null; }
      const deletedSet = new Set((loadedMeta && loadedMeta.deletedKeys) || []);
      try {
        const v = await storeGet("vocab-list");
        if (v) {
          const stored = JSON.parse(v).map(fixArticleWord);
          const seedByKey = new Map(VOCAB_SEED.map((w) => [identity(normalizeEntry(w)), w]));
          const enriched = stored.map((w) => {
            const s = seedByKey.get(identity(normalizeEntry(w)));
            return s ? mergeSeedEnrichments(w, s) : w;
          });
          const enrichedChanged = JSON.stringify(enriched) !== JSON.stringify(stored);
          const known = new Set(enriched.map((w) => identity(normalizeEntry(w))));
          const missing = VOCAB_SEED.filter((w) => !known.has(identity(normalizeEntry(w))) && !deletedSet.has(wordKey(w.word)));
          loadedVocab = missing.length ? [...enriched, ...missing] : enriched;
          if (missing.length || enrichedChanged) storeSet("vocab-list", JSON.stringify(loadedVocab));
        }
      } catch (e) { loadedVocab = null; }
      loadedVocab = (loadedVocab || VOCAB_SEED).map(normalizeEntry);
      loadedMeta = loadedMeta || DEFAULT_META;
      // One-time fresh start: clear all learning progress, keep words and settings.
      if (!(await storeGet("progress-reset-v1"))) {
        loadedVocab = loadedVocab.map((w) => { const { evidence, ...rest } = w; return { ...rest, learning: { confidence: 0, timesSeen: 0, timesCorrect: 0, nextReview: 0 } }; });
        loadedMeta = { ...DEFAULT_META, newPerDay: loadedMeta.newPerDay ?? DEFAULT_META.newPerDay, deletedKeys: loadedMeta.deletedKeys || [] };
        await storeSet("vocab-list", JSON.stringify(loadedVocab));
        await storeSet("progress-meta", JSON.stringify(loadedMeta));
        await storeSet("progress-reset-v1", "1");
      }
      vocabRef.current = loadedVocab;
      metaRef.current = loadedMeta;
      setVocab(loadedVocab);
      setMeta(loadedMeta);
      setLoading(false);
    })();
  }, []);

  const persistVocab = useCallback((next) => { storeSet("vocab-list", JSON.stringify(next)); }, []);
  const updateVocab = useCallback((updater) => {
    const base = vocabRef.current || [];
    const next = typeof updater === "function" ? updater(base) : updater;
    vocabRef.current = next;
    setVocab(next);
    persistVocab(next);
  }, [persistVocab]);
  const updateMeta = useCallback((next) => {
    metaRef.current = next;
    setMeta(next);
    storeSet("progress-meta", JSON.stringify(next));
  }, []);

  const toggleFav = useCallback((wordName) => {
    updateVocab((prev) => prev.map((w) => (w.id === wordName ? { ...w, fav: !w.fav } : w)));
  }, [updateVocab]);

  const deleteWord = useCallback((name) => {
    const deletedName = (vocabRef.current || []).find(w => w.id === name)?.word || name;
    updateVocab((prev) => prev.filter((w) => w.id !== name));
    const m = metaRef.current || DEFAULT_META;
    updateMeta({ ...m, deletedKeys: Array.from(new Set([...(m.deletedKeys || []), wordKey(deletedName)])) });
  }, [updateVocab, updateMeta]);

  const importWords = useCallback((incoming, decisions) => {
    const res = mergeIncoming(vocabRef.current || [], incoming, decisions);
    let next = res.next;
    const today = dateStr(now());
    const m = metaRef.current || DEFAULT_META;
    let m2 = m;
    if (next.some((w) => w.queued) && m.lastActivation !== today) {
      next = activateQueued(next, m.newPerDay || 10, today).next;
      m2 = { ...m2, lastActivation: today };
    }
    if ((m.deletedKeys || []).length) {
      const inKeys = new Set(incoming.map((w) => wordKey(w.word)));
      const keep = m.deletedKeys.filter((k) => !inKeys.has(k));
      if (keep.length !== m.deletedKeys.length) m2 = { ...m2, deletedKeys: keep };
    }
    if (m2 !== m) updateMeta(m2);
    vocabRef.current = next;
    setVocab(next);
    persistVocab(next);
    return res;
  }, [persistVocab, updateMeta]);

  const activateMore = useCallback((n) => {
    const act = activateQueued(vocabRef.current || [], n || 10, dateStr(now()));
    vocabRef.current = act.next;
    setVocab(act.next);
    persistVocab(act.next);
    return act.activated;
  }, [persistVocab]);

  const restoreBackup = useCallback((payload, decisions) => {
    const parsed = parseImport(JSON.stringify(payload));
    const restored = restoreState({ vocab: vocabRef.current || [], meta: metaRef.current || {}, extras: backupExtrasRef.current, stateExtras: stateExtrasRef.current }, parsed, decisions);
    updateVocab(restored.vocab);
    updateMeta(restored.meta);
    backupExtrasRef.current = restored.extras;
    stateExtrasRef.current = restored.stateExtras;
    storeSet('backup-extras', JSON.stringify({ extras: restored.extras, stateExtras: restored.stateExtras }));
    return restored;
  }, [persistVocab, updateMeta]);

  // καθημερινή ενεργοποίηση λέξεων από την ουρά
  useEffect(() => {
    if (loading || !vocab || !meta) return;
    const today = dateStr(now());
    if (meta.lastActivation === today) return;
    if (!vocab.some((w) => w.queued)) return;
    const act = activateQueued(vocab, meta.newPerDay || 10, today);
    vocabRef.current = act.next;
    setVocab(act.next);
    persistVocab(act.next);
    updateMeta({ ...meta, lastActivation: today });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, vocab === null, meta === null]);

  const activeVocab = useMemo(() => (vocab || []).filter((w) => !w.queued), [vocab]);
  const queuedCount = (vocab || []).length - activeVocab.length;
  const ctxValue = useMemo(
    () => ({ vocab: vocab || [], toggleFav, importWords, activateMore, restoreBackup, deleteWord, queuedCount, getBackup: () => fullBackup(vocabRef.current || [], metaRef.current || {}, backupExtrasRef.current, stateExtrasRef.current) }),
    [vocab, toggleFav, importWords, activateMore, restoreBackup, deleteWord, queuedCount]
  );

  if (loading || vocab === null || meta === null) {
    return (
      <div className="ww-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <GlobalStyle />
        <Loader2 size={26} color="#CB9146" style={{ animation: "ww-spin 1s linear infinite" }} />
        <style>{`@keyframes ww-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const dueCount = activeVocab.filter(isDue).length;

  return (
    <AppCtx.Provider value={ctxValue}>
      <div className="ww-root">
        <GlobalStyle />
        <header
          style={{
            position: "sticky", top: 0, zIndex: 25,
            background: "rgba(253,250,243,0.94)", backdropFilter: "blur(10px)",
            borderBottom: "1px solid #ECE4D3",
            padding: "8px 12px",
          }}
        >
          <div
            style={{
              maxWidth: 768, margin: "0 auto",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <nav
              aria-label={t("Ενότητες WortWerk", "WortWerk modules")}
              style={{
                flex: 1, minWidth: 0,
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4,
                background: "#ECE4D3", padding: 3, borderRadius: 999,
              }}
            >
              <button
                type="button"
                aria-pressed={activeModule === "woerter"}
                onClick={() => setActiveModule("woerter")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "8px 10px", borderRadius: 999, border: "none",
                  fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
                  background: activeModule === "woerter" ? "#211F1C" : "transparent",
                  color: activeModule === "woerter" ? "#F5F0E6" : "#5E584F",
                  transition: "background 150ms ease, color 150ms ease",
                }}
              >
                <BookOpen size={14} />
                <span>Wörter</span>
              </button>
              <button
                type="button"
                aria-pressed={activeModule === "saetze"}
                onClick={() => setActiveModule("saetze")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "8px 10px", borderRadius: 999, border: "none",
                  fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
                  background: activeModule === "saetze" ? "#211F1C" : "transparent",
                  color: activeModule === "saetze" ? "#F5F0E6" : "#5E584F",
                  transition: "background 150ms ease, color 150ms ease",
                }}
              >
                <MessageSquareQuote size={14} />
                <span>Sätze &amp; Ausdrücke</span>
              </button>
            </nav>

            <div
              role="group"
              aria-label={t("Γλώσσα εφαρμογής", "App language")}
              style={{
                display: "inline-flex", alignItems: "center", flexShrink: 0,
                background: "#ECE4D3", padding: 3, borderRadius: 999, gap: 2,
              }}
            >
              <button
                type="button"
                aria-pressed={lang === "el"}
                onClick={() => setLang("el")}
                className="ww-mono"
                style={{
                  padding: "6px 9px", borderRadius: 999, border: "none",
                  fontSize: 11, fontWeight: 700,
                  background: lang === "el" ? "#211F1C" : "transparent",
                  color: lang === "el" ? "#F5F0E6" : "#5E584F",
                  transition: "background 150ms ease, color 150ms ease",
                }}
              >
                ΕΛ
              </button>
              <button
                type="button"
                aria-pressed={lang === "en"}
                onClick={() => setLang("en")}
                className="ww-mono"
                style={{
                  padding: "6px 9px", borderRadius: 999, border: "none",
                  fontSize: 11, fontWeight: 700,
                  background: lang === "en" ? "#211F1C" : "transparent",
                  color: lang === "en" ? "#F5F0E6" : "#5E584F",
                  transition: "background 150ms ease, color 150ms ease",
                }}
              >
                EN
              </button>
            </div>
          </div>
        </header>

        {activeModule === "saetze" ? (
          <SentencesModule />
        ) : (
          <>
            <div style={{ flex: 1, overflowY: "auto", paddingBottom: 6 }}>
              {tab === "home" && (
                <HomeScreen
                  vocab={activeVocab}
                  meta={meta}
                  goTo={setTab}
                  onStartDaily={() => { setAutoStartDaily(true); setTab("learn"); }}
                  onOpenB2Practice={() => { setPracticeScope("b2"); setAutoStartDaily(false); setTab("learn"); }}
                />
              )}
              {tab === "vocab" && <VocabScreen vocab={vocab} updateVocab={updateVocab} />}
              {tab === "families" && <FamiliesScreen vocab={vocab} />}
              {tab === "learn" && (
                <LearnScreen
                  vocab={activeVocab}
                  updateVocab={updateVocab}
                  meta={meta}
                  updateMeta={updateMeta}
                  autoStartDaily={autoStartDaily}
                  onAutoStartConsumed={() => setAutoStartDaily(false)}
                  practiceScope={practiceScope}
                  setPracticeScope={setPracticeScope}
                  onOpenB2Stats={() => { setStatsInitialScope("b2"); setTab("stats"); }}
                />
              )}
              {tab === "stats" && (
                <StatsScreen
                  vocab={activeVocab}
                  meta={meta}
                  allVocab={vocab}
                  initialScope={statsInitialScope}
                  onOpenB2Practice={() => { setPracticeScope("b2"); setAutoStartDaily(false); setTab("learn"); }}
                />
              )}
            </div>
            <BottomNav tab={tab} setTab={setTab} dueCount={dueCount} />
          </>
        )}
      </div>
    </AppCtx.Provider>
  );
}

export default function WortwerkApp() {
  return (
    <LanguageProvider>
      <WortwerkAppContent />
    </LanguageProvider>
  );
}

if (typeof window !== "undefined" && !(window as any).storage) {
  (window as any).storage = {
    get: async (k) => { const v = localStorage.getItem(k); return v == null ? null : { key: k, value: v }; },
    set: async (k, v) => { localStorage.setItem(k, v); return { key: k, value: v }; },
    delete: async (k) => { localStorage.removeItem(k); return { key: k, deleted: true }; },
  };
}
