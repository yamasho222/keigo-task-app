# Attack enchant workshop

Attack enchantment mechanics and UI introduced on `codex/attack-enchant-ux`.

## Player flow

The production enchantment screen now uses a pictorial workshop: select a card, try it for free, then apply it. Card selection alone never changes the saved enchantment. The practice target uses the strongest crafted sword, matching combat. Detailed numbers stay in a disclosure panel.

| Card | Star 1 / 2 / 3 | Tradeoff |
| --- | --- | --- |
| つよく (`power`) | Normal attack +1 / +2 / +3 | No special bonus |
| ひっさつ (`ultimate`) | Special +4 / +8 / +12 | No normal bonus |
| こわす (`break`) | Normal against parts +2 / +4 / +6; special +4 / +8 / +12 | Only crystals, wings and orb; no bonus against body or other enemies |

Previously `break` had +1/+2/+3 normal and +2/+4/+6 special against parts, making it weaker than a general alternative. Its new selection requires End access. A currently saved `break` is retained and can still be upgraded before End access; switching away does not unlock it for reselection before the End.

One enchantment is active. Attack stars are shared across types. Switching is free. The first application selects the type and purchases star 1 atomically; no ineffective rank-zero selection is presented as completed. Existing table/sword prerequisites and unsafe-dragon/pending-skill restrictions remain enforced.

## Materials and compatibility

- First star: 6 lapis + 1 book.
- Star 2: 10 lapis + 4 quartz.
- Star 3: 14 lapis + 8 quartz.
- Material purchases show a confirmation with held/required amounts; cancellation is free.
- Engine checks revision, expected rank, prerequisites and funds. Replayed/stale commands cannot charge twice.
- Saved enum values and rank fields are unchanged. Existing materials, stars, HP, tickets and battle progress are preserved.
- Defense functionality remains available in a collapsed section; formulas/costs are unchanged.

## Practice calculation

Practice shares `attackDamage`, `skillBonus` and `smallSkillBonus` with combat. Specials use score 50. It deliberately excludes allies, water, critical hits, weakness, barrier and remaining-HP caps. Before End access it shows the smaller battles' basic special damage; after access it shows the dragon's basic special damage. The disclosure identifies this context. Selecting `break` previews a crystal.

## Preview and verification

`npm run dev -- --host 127.0.0.1 --port 5176 --strictPort`, then `/?attack-enchant=1`.

This DEV-only host uses memory fixtures and the real production component/session engine. It never mounts profiles or cloud persistence. Settings allow resetting progression/materials, sword switching, save normalization and opening real battle components.

Verification: 74 added rule tests; existing suite passed (995 total), production build and changed-file lint passed. Browser checks covered 320/402px widths, image loading, free practice, cancel/Escape, first application, upgrade, free switching, locked selection, insufficient materials and a competing resource update during purchase. That final case leaves the book, stars and tickets unchanged and displays the actual rejection reason. Physical iPhone/Safari and child playtesting remain unverified.

Rollback: revert the workshop release in Git. Existing enchantment types and ranks are compatible with the previous release.
