# End chapter announcements / recovery guidance

## Scope

- Existing debris owners see fortress catch-up news on the mining screen. A remembered debris discovery or already unlocked fortress also qualifies if the item was spent.
- The first craft-screen visit shows bread and shield, illustrated with short copy. No water / Eye of Ender solution is disclosed.
- Each acknowledgement is stored in that child's `MiningState.endChapterNotices`, separately from older mining announcements. Old saves default to unread. Reading news spends no resources.
- News waits while another mining overlay, chapter celebration, loot animation or battle is active. It is marked read only when dismissed, not merely mounted.
- In all three current battles, an empty bread inventory keeps the recovery button tappable and opens illustrated crafting help: wheat ×3 → bread ×1, bread heals 5 hearts (10 HP), at most twice per day.
- A full HP bar does not hide missing-bread help. Already spending both daily recoveries disables recovery instead; owning bread must not produce a misleading crafting hint.
- Help is local UI state, never a battle command: no ticket, action, food use, enemy movement, intent change or gauge increment. Existing healing and battle balance are unchanged.

## Verification

- `npm test -- --silent=true`: 44 files / 740 tests passed, including save normalization, independent read flags, stale-write merging, all three battle recovery buttons, full HP and daily-cap cases.
- `npm run build`: passed. Existing large-chunk warnings remain.
- Scoped ESLint for new notice code and integration helpers: passed.
- At 402 × 874, verified fortress and crafting announcements, acknowledgement round-trip, and recovery help in the isolated memory host. No real child save or cloud writes used.
- Verification host: `http://127.0.0.1:5176/?adventure-release=1`. Test controls can reset announcements or set bread to 0 / 8. Browser reload resets the fixture; “保存形式で読み直す” round-trips in memory only.

## Publication / rollback

Publication of this verified follow-up was authorized on 2026-10-18. Release through a dedicated branch and PR into `main`, then verify the production alias points to that commit's READY deployment. The original `app/` prototype is unchanged.

The previous production deployment at release preparation was `dpl_Ex67T5nRBs3NYzCnaopt3zCForqJ` (`app-ndnfkweyw-shota-yamadas-projects.vercel.app`). This identifies a build rollback target, not a backup of live child saves. Revert this follow-up's source changes to remove the UI and optional save flags; do not delete battle progress or inventory. Any stored acknowledgement flags can safely remain if reverting only the announcement UI.
