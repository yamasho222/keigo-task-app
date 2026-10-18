# Task settings and skill fixes — 2026-10-18

## Publication authorization

After the local implementation below, the user explicitly approved committing, pushing and deploying these five fixes together with the battle progression, individual companion assists, revised HP and leftover-action carryover. Rechecked 811 tests / 47 files, production build, and exclusion of DEV-only hosts. Implementation-time statements below about not publishing describe that earlier state, not the subsequent authorized release.

## Scope and before / after

Local implementation on `codex/battle-effects-and-items`. No commit, push, merge, or production deployment in this task. Earlier uncommitted battle changes are preserved.

| Area | Before | After |
| --- | --- | --- |
| Night play lock | Starts at 21:00 | Starts at 20:30 inclusive. Unlock remains 06:30; bedtime declaration deadline remains 21:30. Parent setting label updated. |
| Task period editing | Changing a single task's selected period could update only the source row | One immutable placement transaction removes deselected rows, inserts selected destinations, and preserves done/skipped state and timing identities. Handles destination ID collisions and shared tasks. |
| Task order | Management screen had no reorder control | Explicit reorder mode with 44px up/down buttons. Swaps visible peers within the existing regular/today/special groups. Hidden weekday rows and game row remain intact. Swipe deletion/editing disabled while ordering. Existing task-array persistence saves the order locally and through normal app sync. |
| Light ultimate | Three timing inputs, divided total | One centered timing input, 0–100 score directly. One central light crystal. Feedback then auto-releases. Damage formula, recovery, and other minigames unchanged. |
| Blaze ultimate | Local water skill existed but command/help still looked like the old sword skill; production remained old | Initial water skill on standalone and integrated entry points. Single available skill glyph on command. Picture lesson uses water art and no longer falsely promises all counterattacks are cancelled. |

## Data safety

- Moving does not call the destructive task-delete handler.
- Non-shared rows are identified by source period + ID, not ID alone. Old per-period duplicate IDs are handled.
- Completion and skipped markers follow the moved row. Shared completion is not duplicated into every period.
- Best times and today's completion timestamps follow their stable shared key, or are remapped when a non-shared time key changes.
- Existing shared keys remain even if only one period is selected; a misleading single-period “shared” badge is suppressed.
- One-off special mission claimed/pending reward identities follow the move, including ID collisions and conversion to shared.
- Active task timer follows the new placement without resetting its elapsed duration. Archived day history is not rewritten.
- Newly added task IDs use the maximum across all periods to avoid recycling IDs that were moved elsewhere.
- Existing gameplay saves and equipment are not reset. Existing night-lock OFF setting remains respected.

## Verification

- Full Vitest suite: **811 / 811 passed, 47 files**.
- Production TypeScript / Vite / PWA build passed. Existing large-chunk warning remains.
- Scoped ESLint: no errors; one pre-existing missing-effect-dependency warning in BlazePrototype's document-title effect remains.
- Production bundle checked: no `task-settings` route or memory-host labels included.
- Boundary tests: 20:29:59.999 open, 20:30 locked, overnight same night key, 06:30 open. Existing bedtime bonus deadline tests still pass.
- Placement tests: simple move, collisions, done/skipped transfer, unrelated duplicate IDs, in-place edits, shared→single→move→shared, reward identity, time records, filtered ordering, category boundaries, save-shape roundtrip, immutability.
- Browser at 402px: moved “水筒を出す” from home to evening using the actual edit form. Existing evening ID1 remained; moved row became ID5 and retained completion and 12-second record. Ordered it above “明日の準備” and retained order after save-shape roundtrip. No horizontal document overflow (402 / 402px).
- Browser integrated Blaze: after three normal attacks, ultimate opened water's `うちかえす` minigame directly. Help lesson and command glyph match water.
- Browser light: `0/1` → single input scored **77** → `1/1` → auto-release without a second input. One ticket consumed for four actions, three actions remained after release. Light's existing recovery/barrier applied.
- No browser console errors in task editor and skill checks. Real child profiles/cloud were not mounted or edited during QA. Physical iPhone Safari testing has not been performed.

## Local confirmation URLs

- `http://127.0.0.1:5176/?task-settings=1` — actual task-list editor with disposable memory fixtures; page reload resets it.
- `http://127.0.0.1:5176/?adventure-release=1` — actual battle integration with disposable progression fixtures.
- `http://127.0.0.1:5176/?battle-effects=1` — direct skill/effect fixtures; choose light from the ultimate selector.

The original prototype at port 5175 and public production URL are not changed by this task.

## Rollback

Changes are not committed. Revert only the scoped hunks listed above; do not reset the working tree because earlier battle changes are mixed into shared files. To undo a task period/order edit after deployment, edit its periods or reorder it again; no saved data wipe is needed. Already moved rows and stable shared keys remain valid in the stored task schema. Battle rollback must retain support for new enemy HP and skill fields from the earlier battle work; do not blindly deploy an old reader over those saves.
