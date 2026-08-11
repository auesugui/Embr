# Decisions Log

> **Note (2026-08-11):** some links below point at `04-pet-system/`, `05-battle-tower/`, or
> `06-game-systems/`, which were deleted with the game layer (ADR-0014). Those links are
> dead on purpose — the content is in git history. See `docs/INDEX.md`.


> Sources: Addendum v2.1 §§A, D · PRD v2.0 §12 · Timer Amendment

---

## Resolved Decisions (from PRD v2.0 Open Questions)

| ID | Decision | Rationale | Detail Doc |
|----|----------|-----------|-----------|
| **A1** | **Auto-feed available.** Emotional bond comes from cosmetic customization, not feeding rituals | Manual feeding = friction without meaningful choice. Cosmetic shop = personal expression | [Pet Care](../04-pet-system/pet-care.md) |
| **A2** | **Quarterly prestige resets.** Tower resets every 3 months. Permanent badges for highest floor | CoD prestige model — reset feels like promotion, not loss. Prevents stagnation | [Battle Tower](../05-battle-tower/tower.md) |
| **A3** | **3 pet types** (Ferro/Terra/Flux) with elemental affinities. Chosen at game start | Identity + strategic layer. Disadvantages = challenge, not wall | [Pet Types](../04-pet-system/pet-types.md) |
| **A4** | **Self-contained tracker.** No external app integration | Data integrity essential for FP economy. Owns full data pipeline | [FP Economy](../02-forge-points/fp-economy.md) |
| **A5** | **No punishment for inactivity.** Gentle opt-in vacation mode | Life happens. Punishing absence = permanent churn | [Pet Care](../04-pet-system/pet-care.md) |
| **A6** | **FP buys both stats and cosmetics.** Two shops, one shared currency | Cosmetics extend engagement + personalization. Creates spending tension | [Cosmetics](../06-game-systems/cosmetics-achievements-quests.md) |
| **A7** | **AI integration deferred to Phase 4+.** Battle Advisor + Workout Coach | Requires stable economy + sufficient training data first | [Roadmap](../07-technical/architecture-and-roadmap.md) |

---

## Amendments Applied

| Amendment | What Changed | Affected Docs |
|-----------|-------------|--------------|
| **Spirit FP Exclusivity** | Removed Spirit from all cardio FP generation. Spirit earned only through streak system | Tracker Spec §4.1, §6.3. Addendum §B |
| **Smart Rest Timer** | Replaced simple countdown with 3-mode timer system: Active Rest, Pause, Extend. Added Equipment Transition Detection, Overrun Handling, Gym Rush Mode | Tracker Spec §3.1. Addendum §B.3 |
| **Cardio FP Correction** | LISS secondary: Spirit → Focus. Sport secondary: Spirit → Focus | Tracker Spec §4.1 |
| **Reduced Rest FP Bonus** | Explicitly tied to Gym Rush Mode toggle (opt-in) rather than passive detection | Addendum §B.3 |

---

## Remaining Open Questions (from PRD v2.0 §12)

All original open questions have been resolved in Addendum v2.1. No remaining open questions at this time.

The following are **future expansion ideas** noted in the docs (not blocking decisions):

| Topic | Status | Notes |
|-------|--------|-------|
| Second pet of different type | Phase 4+ | Double workout investment for matchup coverage |
| PvP async matchmaking | Phase 4+ | Requires Supabase + stable meta |
| Apple Health / Google Fit integration | Phase 4+ | Passive activity bonuses |
| Seasonal tower events | Phase 4+ | Time-limited rewards + themed enemies |
| AI Battle Advisor | Phase 4+ | Post-battle analysis + tips |

---

## Impact on Estimates (from Addendum v2.1 §D1)

Resolved decisions add ~30–45 hours to total scope:

| Addition | Hours | Phase |
|----------|-------|-------|
| Pet type system (3 types, selection UI, rendering) | +15–20h | Phases 1–2 |
| Relative effort scaling + baseline engine | +8–12h | Phase 1 |
| Cosmetic shop UI + item system | +10–15h | Phase 2 |
| Prestige system + seasonal logic | +5–8h | Phase 2 |
| Vacation mode | +3–5h | Phase 1 |
