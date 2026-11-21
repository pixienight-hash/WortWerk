<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep import/backup/evidence rules in browser-safe pure functions in `src/lib/wortwerk-data.ts`; this allows isolated restoration tests without changing real browser data.
- Preserve existing browser storage and scheduling during this audit; mastery is derived only from evidence, never from legacy confidence counters.
- Keep source-audit artifacts in `public/audit` and distinguish verified available files from history-only references; missing corpora must never be invented.
- Resolve word-family membership from explicit existing family lists at display time, without mutating stored vocabulary; this makes family access bidirectional while preserving backups and learning state.
- The Families tab derives its catalogue from current vocabulary and reuses the existing family/member sheets; sorting remains view-only so stored learning data stays unchanged.
