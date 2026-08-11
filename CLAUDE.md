# Embr — Project Instructions

> **Version:** 2.0 | **Status:** redesigned + de-gamified, Aug 2026 | **Updated:** 2026-08-11

---

## Project Overview

**Embr** is a workout tracker. Log sets, track PRs, keep a streak. That's the whole product.

It used to be **IronQuest** — a gamified tracker where every rep earned Forge Points to raise
a digital pet that battled up an endless tower. That game layer was built, never used, and
removed (ADR-0014). Large parts of `docs/` still describe it; treat anything in
`docs/04-pet-system/`, `docs/05-battle-tower/`, and `docs/06-game-systems/` as **historical**.

**Read the ADRs before the docs.** They're the current truth:

| ADR | What |
|---|---|
| `~/.claude/context/decisions/0013-embr-rebrand-and-visual-redesign.md` | The rebrand + the whole visual system |
| `~/.claude/context/decisions/0014-*` | Removing the game layer |
| `~/.claude/context/active/Embr.md` | Live project state — start here |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React Native + Expo (Managed) |
| **Language** | TypeScript (end-to-end) |
| **Delivery** | **PWA on Vercel.** Not native — the $99/yr Apple fee was declined |
| **Animations** | Reanimated v3 |
| **State** | Zustand |
| **Local Persistence** | AsyncStorage (MMKV removed for Expo Go compatibility) |
| **Icons** | Lucide (`lucide-react-native`) |
| **Type** | Plus Jakarta Sans (UI) + Fraunces (display), via `expo-font` |

There is **no backend and no sync.** Everything lives on-device. On web that's
`localStorage`, which the browser can evict — `src/lib/backup.ts` (Profile → Export) is the
only thing between a storage sweep and losing every logged workout. Treat it as critical.

---

## Design System

All of it lives in `src/theme/`. **`roles` is the API** — semantic tokens (`surface`,
`surfaceRaised`, `textPrimary`, `accent`, `border`, …), not raw hex.

- **One accent.** Ember orange. If something needs a second accent color, it almost
  certainly doesn't — the old six-color RPG palette is exactly what made this look amateur.
- **`colors.*` is deprecated.** It's a legacy alias mapped onto the active palette so
  pre-redesign screens still render. Don't add new call sites; migrate ones you touch.
- **Light and dark both ship.** The palette is resolved *before* the bundle initializes
  (`src/theme/theme-boot.ts`) because styles bake colors at module scope. Consequence:
  changing the appearance setting restarts the app. Don't "fix" this without reading that
  file's header.
- **Register split.** Hevy where you're working (session, template edit, history): dense,
  tabular, undecorated. Finch where you're arriving (home, summary, profile): breathing
  room, the display serif, warmth. Don't mix them.
- **Reserved zones.** The home hero card and the profile avatar circle are deliberately
  under-filled, held for a possible care-companion. Don't fill them with layout.

**No emoji as UI. No Unicode glyphs as icons.** Both were removed on purpose; reintroducing
either undoes the redesign.

---

## Core Design Rules

| Rule | Detail |
|------|--------|
| **3-Second Rule** | Logging a set must be completable in 3 seconds |
| **Offline-first** | Local persistence only. No cloud, no accounts, no sync |
| **Export or it's gone** | Any change touching persisted shapes must keep `backup.ts` round-tripping old files |
| **Self-Contained** | No integration with external workout apps |
| **Motion is shared** | One vocabulary (`src/components/celebration/vocabulary.ts`). A button press and a celebration use the same `settle` spring |

---

## Things That Look Removable But Aren't

- **`WorkoutLog.claimedAt`** — named for the deleted "claim rewards" flow, but it's the
  save-once idempotency key (issue #16 / audit C1). Removing it reintroduces double-save.
- **`WorkoutLog.totalFP` / `fpEarned`** — dead metadata, still populated, still persisted.
  Kept deliberately so existing backups round-trip without a migration (ADR-0014).
- **The hydration gate in `app/_layout.tsx`** — prevents React #418 on the static web
  export. The pre-hydration shell is transparent on web for the same reason.

---

## Verification

Chrome DevTools MCP against the web build is the primary in-loop check. Playwright is frozen
at the golden-path specs and runs in CI.

Before calling anything done: `npm run typecheck`, `npm test`, and actually look at the app.

---

*For live project state, read `~/.claude/context/active/Embr.md` first.*
