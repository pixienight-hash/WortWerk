# WortWerk roadmap

- [x] Add Families tab with search, alphabetical/member-count sorting and full family/member navigation; verified 22 families on mobile and desktop, 35 tests passed.

- [x] Clean word cards: move detailed learning information to Progress; make existing families accessible from every member; verify mobile and desktop.

- [x] Fill missing memory hooks / fun facts (154/297 done; rest blocked on AI credits)
- [x] Sources audit: import_manifest.json, wortwerk_master.json, quality report; five available uploads contain no additional entries
- [x] Duplicate detection (exact / near / mergeable) before JSON import, manual add, bulk import and restore; reviewed skip/merge/add distinct
- [x] Versioned full backup + vocabulary-only export; aliases, legacy schemas and unknown fields preserved
- [x] Evidence ledger per attempt, separated recognition/exposure/recall, included in backup
- [x] Evidence-based levels and mastery explanation; scheduling unchanged
- [x] 25 passing unit tests + isolated browser QA: 297→299, duplicate skipped, restore equality, old records unchanged, typed ledger verified
- [ ] Recover Goethe B1 001–100, ZIP A001, derivative CSV/XLSX and older 78-word source: blocked on unavailable original files

- [x] One-time progress reset (all words, XP, streak, logs to zero; words and settings kept)
- [ ] Lexical explanation audit of 297 entries: not yet done
