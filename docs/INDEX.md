# Embr — Documentation Index

> **Status:** partially historical. **Updated:** 2026-08-11

> **Read this first.** These docs were written for **IronQuest**, a gamified tracker where
> reps earned Forge Points to raise a pet that battled up a tower. That game layer was
> deleted (ADR-0014) and the app was redesigned and renamed to **Embr** (ADR-0013).
>
> The pet, tower, and game-systems specs have been removed outright. What remains is a mix:
> the tracker and technical docs still broadly describe real code, while the product
> overview and the FP economy describe a product that no longer exists.
>
> **The ADRs are the current truth**, not this tree:
> - `~/.claude/context/decisions/0013-embr-rebrand-and-visual-redesign.md`
> - `~/.claude/context/decisions/0014-remove-the-game-layer.md`
> - `~/.claude/context/active/Embr.md` — live state
> - the repo `CLAUDE.md`

---

## Quick Navigation

| Section | Doc | Key Contents |
|---------|-----|-------------|
| Product Overview | [01 — Product Overview](01-product-overview/product-overview.md) | ⚠️ **HISTORICAL** — pitches the pet/tower product |
| Forge Points | [02 — FP Economy](02-forge-points/fp-economy.md) | ⚠️ **HISTORICAL** — FP is still computed and stamped on logs but nothing reads it (ADR-0014) |
| Workout Tracker | [03 — Session Flow](03-workout-tracker/session-flow.md) | Templates, loadout, in-session UX, post-session summary |
| | [03 — Rest Timer](03-workout-tracker/rest-timer.md) | 3 timer modes, equipment transitions, overrun handling, Gym Rush |
| | [03 — Cardio](03-workout-tracker/cardio.md) | Cardio types, FP mapping, session screens, calculation |
| | [03 — Exercise Database](03-workout-tracker/exercise-database.md) | Muscle group → FP type mapping, auto-tagging |
| UX Design | [09 — UX Specification](09-ux-design/ux-spec.md) | Emotional arc, animation timing, haptics, color language, accessibility, anti-patterns |
| Technical | [07 — Architecture & Roadmap](07-technical/architecture-and-roadmap.md) | Tech stack, data model, phases, estimates, risks |
| | [07 — Implementation Priority](07-technical/implementation-priority.md) | P0/P1/P2 build order by phase |
| | [07 — State Architecture](07-technical/state-architecture.md) | Zustand stores, TypeScript interfaces, selector patterns, persistence |
| | [07 — Local Schema](07-technical/local-schema.md) | Entity schemas, AsyncStorage keys, offline-first rules, migrations |
| | [07 — Dev Panel Spec](07-technical/dev-panel-spec.md) | `__DEV__`-gated test panel — seed pet/player/PR/history state without grinding (build map) |
| Decisions | [08 — Decisions Log](08-decisions/decisions-log.md) | 7 resolved decisions, amendments, future ideas |

---

## Quick-Reference: Core Design Rules

| Rule | Detail | Source |
|------|--------|--------|
| ~~Tracker First, Game Second~~ | Moot — there is no game layer (ADR-0014) | — |
| **3-Second Rule** | Logging a set must be completable in 3 seconds | Tracker Spec §3.1 |
| **No FP from Money** | FP earned exclusively through logged workouts. Cannot be purchased | PRD §3.2 |
| **Rest Time ≠ FP** | Rest and pause time have zero impact on FP calculations | Timer Amendment §2.6 |
| **Spirit = Streak Only** | Spirit FP earned only through streak system — no exercise or cardio | Timer Amendment §1.2 |
| **No Punishment for Absence** | Pet never dies or loses stats permanently. Vacation mode freezes decay | Addendum §A5 |
| **Self-Contained** | No integration with external workout apps. Owns the full data pipeline | Addendum §A4 |

---

## Quick-Reference: FP Earning Summary

| Source | FP Amount | Type |
|--------|-----------|------|
| Base completion | 100 FP flat | Generic |
| Volume bonus | 1 FP per 10 reps | Generic |
| Personal record | 50 FP | Generic |
| Rep PR (same weight) | 25 FP | Generic |
| Streak multiplier | 1.0x + 0.1x/day, max 2.0x | Multiplier |
| Training variable (tempo, pause, etc.) | 10–20 FP per exercise/set | Generic |
| Deload session | Flat 80 FP (no volume calc) | Generic |
| Quest bonus | 25 FP | Generic |
| Gym Rush Mode | +10 FP/exercise | Generic |

---

## Quick-Reference: Pet Stats

| Stat | Source Workout | Battle Effect | FP Cost | Visual |
|------|---------------|---------------|---------|--------|
| **Power** | Push (Chest/Shoulders) | Attack damage | 5 FP/pt | Spikier, larger core |
| **Guard** | Pull (Back/Traps) | Damage reduction | 5 FP/pt | Thicker, layered |
| **Speed** | Legs (Quads/Hams) | Turn order, dodge | 5 FP/pt | Elongated, motion lines |
| **Vigor** | Legs (Core/Calves) | Max HP, regen | 5 FP/pt | Symmetrical, stable |
| **Focus** | Arms (Biceps/Triceps) | Crit rate, accuracy | 5 FP/pt | Sharp points, eye detail |
| **Spirit** | Streak only | Special ability, buffs | **10 FP/pt** | Glow, particles |

Stat costs scale: 5 FP (1–10) → 8 FP (11–25) → 12 FP (26–50)

---

## Quick-Reference: Evolution Stages

| Stage | Name | EvoXP | Timeline | Shapes | Ability Slots |
|-------|------|-------|----------|--------|-------------|
| 1 | Shard | 0 | Day 1 | 3–4 polygons | 1 |
| 2 | Form | 500 | ~2–3 weeks | 6–8 shapes + gradients | 2 |
| 3 | Prime | 2,000 | ~6–8 weeks | Multi-shape + inner detail | 3 |
| 4 | Apex | 5,000 | ~16–20 weeks | Fractal recursion | 4 |

---

## Quick-Reference: Type Triangle

```
Ferro (Metal) → beats Flux → beats Terra → beats Ferro
```

| Matchup | Damage Dealt | Damage Taken |
|---------|-------------|-------------|
| Advantage | 1.3x | 0.8x |
| Disadvantage | 0.8x | 1.3x |
| Neutral | 1.0x | 1.0x |

---

## Quick-Reference: Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React Native + Expo (Managed) |
| Language | TypeScript |
| Engine | Hermes |
| Pet Rendering | React Native SVG |
| Animations | Reanimated v3 (+ Skia Phase 2+, Rive Phase 3+) |
| State | Zustand |
| Storage | AsyncStorage |
| Backend | Supabase (Phase 3) |
| Notifications | Expo Notifications |

---

## Quick-Reference: Phase Timeline

| Phase | Scope | Status |
|-------|-------|--------|
| **1** | Tracker + Pet (workout logging, FP engine, pet care, SVG renderer, evolution 1–2) | ✅ Shipped July 2026 |
| **2** | Pet Attachment — onboarding, pet types 5→3 (Ferro/Flux/Terra), avatar identity pass, celebration layer, pet-care depth, typed-FP recalibration, share cards, kg support | In progress — nearly code-complete (Ferro/Terra art pass remaining) |
| **3** | Battle Tower + Polish — auto-battle engine, tower progression, ability system, evolution 3–4, Supabase, leaderboards, push notifications | Planned |
| **4** | Expansion — multiple pets, PvP, custom builders, health integrations, seasonal events | Post-launch |

> **Re-sequenced July 2026** (see [`AUDIT-AND-ROADMAP-2026-07.md`](../AUDIT-AND-ROADMAP-2026-07.md) §4):
> pet attachment now precedes the Tower — *"don't build the Tower on an exploitable economy
> and an unloved pet."* Original docs called Phase 2 = Battle Tower. Detailed scope/estimates
> live in the audit/roadmap doc, not here.

---

## Source Documents (Originals)

| Document | Location | Purpose |
|----------|----------|---------|
| PRD v2.0 | [iron_quest_prd_v2.md](../iron_quest_prd_v2.md) | Master product requirements |
| Addendum v2.1 | [iron_quest_addendum_v2_1.md](../iron_quest_addendum_v2_1.md) | Resolved decisions, relative scaling, cosmetics |
| Tracker Spec | [iron_quest_tracker_spec.md](../iron_quest_tracker_spec.md) | Templates, session flow, cardio, exercise DB |
| Timer Amendment | [iron_quest_timer_amendment.md](../iron_quest_timer_amendment.md) | Spirit FP correction, smart rest timer system |
