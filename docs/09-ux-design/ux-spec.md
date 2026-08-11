# IronQuest — UX Specification

> **Note (2026-08-11):** some links below point at `04-pet-system/`, `05-battle-tower/`, or
> `06-game-systems/`, which were deleted with the game layer (ADR-0014). Those links are
> dead on purpose — the content is in git history. See `docs/INDEX.md`.


> **Version:** 1.0 | **Status:** Reference | **Scope:** Experiential layer — everything the player sees, feels, and emotionally responds to.

This document defines the UX patterns, animation timing, haptic feedback, color language, and accessibility requirements for IronQuest. It is the authoritative reference for any UI work.

---

## Core Design Principles

### 1. Tracker First, Game Second

The workout tracker must function perfectly standalone. Game elements are rewards layered on top, never blocking or slowing the logging flow. If a gamification element adds even 1 second of friction to set logging, it's wrong.

### 2. The 3-Second Rule

Logging a set must complete in ≤3 seconds: glance at reps → tap number → hit Log. Every screen, animation, and interaction in the session flow must be designed for one-handed, sweaty-finger operation. The FP accumulator and streak badges are glanceable, never modal.

### 3. No Punishment for Absence

The pet never dies, stats never degrade permanently, and missing days are met with warm welcome-back messaging. Vacation mode freezes all decay. Hunger is a gentle nudge. The tone is always: *"glad you're here"* — never *"where were you?"*

### 4. Earn Everywhere, Spend Intentionally

FP flows automatically from logged work. Spending requires deliberate choices in The Den. This asymmetry is critical: earning should feel effortless and rewarding; spending should feel strategic and meaningful.

### 5. Your Pet = Your Effort

The pet's shape, color, glow, and power are direct reflections of training history. No shortcuts, no purchases. A glance at someone's pet tells you what they train and how consistently.

---

## Session Lifecycle — Emotional Arc

Every workout session follows a designed emotional trajectory:

| Phase | Location | Emotional Target | UX Goal |
|-------|----------|-----------------|---------|
| **Pre-Session** | Quest Board → Loadout | Anticipation, strategy | Show FP forecast, radar chart, intent selection. Build excitement without friction |
| **In-Session** | Exercise logging | Flow state, momentum | Minimal chrome. Large tap targets. FP accumulator ticks up. Set completion feels snappy (haptic + brief animation) |
| **Set Completion** | Log Set tap | Micro-reward | Haptic pulse, FP counter increment animation, progress bar advance. Under 300ms total |
| **Exercise Transition** | Auto-advance | Smooth continuity | Rest timer with calm gradient. Equipment transition buffers explained visually |
| **PR Moment** | During set logging | Peak excitement | Gold flash, "NEW PR!" badge, haptic burst. Unmissable but non-blocking |
| **Post-Session** | Summary screen | Victory, satisfaction | "Quest Complete" banner, sequential FP line animations, radar chart fill, streak celebration. This is the boss-fight victory screen |
| **The Den** | Pet interaction | Care, attachment, strategy | Calm environment. Pet reacts to player presence. Spending feels consequential |

### Critical: The Post-Session Summary

This screen is the **single most important gamification moment**. It must:

- Require a deliberate tap to dismiss (prevent accidental skip)
- Animate each FP line item sequentially (base → volume → intent → streak → PR)
- Show the typed FP radar chart animating from empty → filled
- Celebrate PRs with gold flash and badge
- Display streak update with milestone animations (3, 7, 14, 30 days)
- Offer clear next action: "Head to The Den" or "Done" — no pressure

---

## Forge Points — UX Presentation

### FP Counter (In-Session)

- Top-zone element, always visible but never dominant
- Increments with a rolling-number animation on each logged set
- Color shifts subtly as total grows (cool → warm)
- Never shows negative numbers or penalties

### FP Breakdown (Post-Session)

Each source animates in sequence with escalating visual weight:

| Source | Visual Treatment |
|--------|-----------------|
| Base completion (100 FP) | Clean white text, fade in |
| Volume bonus | Slide in with rep count context |
| Intent bonuses | Intent badge icon + value |
| Streak multiplier | Multiplier text pulses, total recalculates visibly |
| PR bonus | Gold flash, "NEW PR!" stamp |
| **Grand total** | Number rolls up, larger font, satisfying settle |

### Typed FP Radar (Post-Session + Template Browser)

- 6-axis radar chart: Power, Guard, Speed, Vigor, Focus, Spirit
- Animates from center outward with slight overshoot + settle (spring physics)
- On templates: shows projected FP distribution to aid strategic program selection
- Color-coded by type (warm = Power, cool = Guard, etc.)

---

## Pet System — Interaction Design

### The Den

- Pet displayed in a responsive SVG environment that subtly shifts based on mood
- Idle animations: breathing, floating, particle effects (complexity scales with evolution stage)
- Pet reacts to tap with a small animation (bounce, sparkle)
- Hunger indicator: visual bar, not a number. Fills/depletes smoothly
- Mood affects ambient environment: bright/warm when happy, muted when neglected

### Feeding

- Selecting food item shows preview of effect before confirming
- Feeding animation: food particle dissolves into pet, hunger bar fills, mood shifts
- Auto-feed (when enabled) is visually distinct — shows as a small automated icon, not a celebration

### Stat Allocation

- Slider or tap interface per stat
- **Live visual preview**: as player adjusts stats, pet SVG morphs in real-time
  - More Power → spikier, larger core
  - More Guard → thicker, layered
  - More Speed → elongated, motion lines
  - More Vigor → symmetrical, stable base
  - More Focus → sharper points, eye details
  - More Spirit → glow intensity, particle density
- Cost shown per point with scaling tiers (5 → 8 → 12 FP)
- "Confirm" button locks changes. Undo available before confirm

### Evolution

- Full-screen morph animation when EvoXP threshold reached
- Old form dissolves, new form crystallizes from geometric particles
- Dramatic audio + haptic sequence
- New ability slot reveal after morph completes
- Screenshot/share prompt after settling
- This should feel like a **once-in-a-month event** — appropriately rare and impactful

---

## Battle Tower — UX Design

### Pre-Battle

- Enemy displayed with type badge (Ferro/Terra/Flux) and approximate power level
- Player sees their pet alongside for visual comparison
- **Priority weight sliders** for 4 abilities: easily adjustable, immediately understandable
- "Battle!" button with gravity — this consumes an attempt

### Auto-Battle Playback

- Turn-based animated sequence: attacks, dodges, ability activations
- Speed controls: 1x, 2x, skip-to-result
- Type advantage visualized (green/red multiplier flash on hits)
- Dramatic boss battles with special intro animation every 10th floor

### Victory/Defeat

- **Win**: FP reward rain, floor counter increment, potential cosmetic drop
- **Loss**: "Not quite. Train harder and try again." — encouraging, never punishing
- Failed attempts are free — tower attempts are only consumed on victory

---

## Progression Indicators

### Streak System

| Streak Length | Visual Treatment |
|--------------|-----------------|
| 1–2 days | Small flame icon, subtle |
| 3–6 days | Flame grows, warm color |
| 7–13 days | Bright flame + "7-day!" milestone badge |
| 14–29 days | Intense flame + glow effect |
| 30+ days | Legendary flame + particle trail |

- Streak break: flame dims but doesn't vanish dramatically. Warm message: "Let's rebuild"
- Spirit FP earned from streaks is called out distinctly (it's the rarest, most prestigious stat)

### Achievement Badges

- Unlocked with a "stamp" animation (badge slams down, dust particles)
- Visible in profile collection
- Hidden achievements revealed with extra fanfare
- Never interrupt mid-session — queue for post-session or next app open

### Tower Floor Progress

- Vertical tower visualization with current floor highlighted
- Scrollable to see upcoming floors + boss markers
- Completed floors show prestige badge if earned
- Seasonal reset visualized as "new tower rises" — previous badges preserved

---

## Spending Tension — The Core Game Decision

The tension between functional stats and cosmetics is IronQuest's central game design mechanic. UX must support this by:

1. **Making both options equally visible and attractive** in The Den
2. **Showing opportunity cost**: "Spending 200 FP on this particle effect = 40 stat points you won't have"
3. **Never moralizing**: Both choices are valid. Cosmetic players and stat-focused players are equally engaged
4. **Making cosmetic preview irresistible**: particle effects, color overlays, accessories shown on the live pet before purchase

### Price Calibration Feel

- Mid-tier cosmetic (100–200 FP) = ~1 workout of savings
- Evolution skin (500 FP) = ~3–4 weeks of dedicated earning → aspirational
- Stat allocation (5 FP/point) = accessible and constant
- Spirit (10 FP/point, streak-only) = rare and prestigious

---

## Rest Timer — Emotional Design

The rest timer is where most gym time is actually spent. It must feel calm, never stressful:

| State | Visual | Sound/Haptic | Player Feeling |
|-------|--------|-------------|----------------|
| **Counting Down (>10s)** | Calm blue gradient. Circular progress ring depleting | None | Relaxed, recovering |
| **Approaching Ready (10s–0s)** | Ring transitions blue → soft gold. Subtle pulse | Gentle haptic at 10s, soft chime at 0s | Aware rest is ending |
| **Ready (0s)** | Full gold ring. "Ready when you are" text | Single chime, then silence | Clear signal, zero urgency |
| **Overrun (past 0s)** | Muted gray count-up. Smaller font | Completely silent | Informational only |
| **Paused** | Frozen display. "Paused" badge. Muted colors | None | On hold, no judgment |
| **Transition Buffer** | Two-segment ring: blue (rest) + purple (setup) | Chime when full timer hits zero | App understands you're moving |

**Gym Rush Mode**: When active, shows compressed rest times + "+10 FP/exercise" badge. Can toggle mid-session.

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Wrong | IronQuest Alternative |
|-------------|----------------|----------------------|
| Aggressive notifications | Creates guilt, leads to uninstall | Gentle, infrequent nudges. "Your pet misses you" max 1x/day |
| Punishing missed days | Destroys casual players | No stat loss. Warm welcome back. Easy recovery |
| Dark patterns for engagement | Erodes trust | Honest FP economy. No loot boxes. No real-money FP |
| Information overload in-session | Breaks flow state | Minimal chrome during sets. Details saved for post-session |
| Forced game interaction | Violates "Tracker First" | Game layer is always optional. Tracker works alone |
| Slow/heavy animations during logging | Violates 3-Second Rule | Animations are decorative, never blocking |
| Shame-based motivation | Toxic, causes avoidance | Celebration-based. Every workout is a win |
| Generic "Great job!" praise | Feels hollow, loses impact | Specific callouts: "New bench PR!", "5-day streak!" |
| Showing all stats at once | Cognitive overload | Progressive disclosure by context and screen |

---

## Animation & Haptic Guidelines

### Animation Timing

| Context | Duration | Easing |
|---------|----------|--------|
| Set logged (FP tick) | 200–300ms | Spring (slight overshoot) |
| Exercise transition | 300–400ms | Ease-in-out |
| PR callout | 500ms flash + 300ms settle | Sharp ease-out |
| Post-session FP line | 400ms per line, 200ms stagger | Ease-out with deceleration |
| Radar chart fill | 800ms | Spring (overshoot + settle) |
| Evolution morph | 3–5 seconds | Custom bezier, multi-stage |
| Pet idle breathing | 2–3s loop | Sine wave |
| Feeding animation | 600–800ms | Ease-out with dissolve |
| Achievement stamp | 400ms slam + 200ms settle | Ease-out with bounce |

### Haptic Patterns

| Event | Haptic Type | Intensity |
|-------|------------|-----------|
| Log Set tap | Impact (medium) | Standard |
| PR achieved | Notification (success) | Strong |
| Evolution triggered | Custom sequence | Heavy + pattern |
| Rest timer zero | Impact (light) | Gentle |
| Battle hit lands | Impact (medium) | Varies by damage |
| Achievement unlock | Notification (success) | Standard |
| Feeding complete | Impact (light) | Soft |
| Streak milestone | Notification (success) | Strong |

### Technology

- **Reanimated v3** for all standard animations (60fps on UI thread)
- **React Native SVG** for pet geometry rendering
- **Skia** (Phase 2+) for Apex-stage particles and fractal effects
- **Rive** (Phase 3+) for evolution sequences and battle celebrations

---

## Color Language

| Semantic | Color Direction | Usage |
|----------|----------|-------|
| FP / Reward | Gold / Amber | FP counters, reward moments, PR callouts |
| Power stat | Warm red-orange | Stat allocation, radar chart axis |
| Guard stat | Steel blue | Stat allocation, radar chart axis |
| Speed stat | Electric green | Stat allocation, radar chart axis |
| Vigor stat | Earth brown | Stat allocation, radar chart axis |
| Focus stat | Sharp violet | Stat allocation, radar chart axis |
| Spirit stat | White-gold glow | Stat allocation, radar chart axis, streak milestones |
| Rest / calm | Cool blue gradient | Rest timer, idle states |
| Ready state | Soft gold | Timer at zero, "ready when you are" |
| Danger / boss | Deep red accent | Boss floors, low hunger |
| Ferro type | Chrome / metallic | Type badge, pet theme |
| Terra type | Forest / earth | Type badge, pet theme |
| Flux type | Neon / electric | Type badge, pet theme |

---

## Accessibility Requirements

| Feature | Requirement |
|---------|---------|
| Screen Reader | All FP values, stats, pet mood, hunger announced. Battle results narrated |
| Color Blindness | FP types differentiated by icon + shape + color (never color alone) |
| Motor Impairment | Min 44pt touch targets. Gesture alternatives for all swipes. No time-pressure inputs |
| Reduced Motion | `prefers-reduced-motion` respected. Disable particles, shorten transitions to crossfades |
| High Contrast | Optional theme where stat colors and backgrounds meet WCAG AA |

---

## Design References

| Reference | What It Inspires |
|-----------|-----------------|
| **VoidPets** | Aesthetic, creature attachment, clean mobile UX |
| **Tamagotchi** | Care/feeding loop simplicity, emotional bond |
| **Duolingo** | Streak visualization, celebration without guilt |
| **Pokemon** | Evolution excitement, type system clarity |
| **Undertale** | Geometric character design conveying personality |
| **Strong App** | Workout logging speed, minimal friction |

---

## Related Documentation

| Topic | Doc |
|-------|-----|
| Core loop & design pillars | [`../01-product-overview/product-overview.md`](../01-product-overview/product-overview.md) |
| FP economy & earning | [`../02-forge-points/fp-economy.md`](../02-forge-points/fp-economy.md) |
| Session flow & in-gym UX | [`../03-workout-tracker/session-flow.md`](../03-workout-tracker/session-flow.md) |
| Rest timer design | [`../03-workout-tracker/rest-timer.md`](../03-workout-tracker/rest-timer.md) |
| Cardio UX | [`../03-workout-tracker/cardio.md`](../03-workout-tracker/cardio.md) |
| Pet care & feeding | [`../04-pet-system/pet-care.md`](../04-pet-system/pet-care.md) |
| Evolution & rendering | [`../04-pet-system/evolution-and-rendering.md`](../04-pet-system/evolution-and-rendering.md) |
| Pet types & matchups | [`../04-pet-system/pet-types.md`](../04-pet-system/pet-types.md) |
| Battle tower UX | [`../05-battle-tower/tower.md`](../05-battle-tower/tower.md) |
| Cosmetics, achievements, quests | [`../06-game-systems/cosmetics-achievements-quests.md`](../06-game-systems/cosmetics-achievements-quests.md) |
| Implementation priority | [`../07-technical/implementation-priority.md`](../07-technical/implementation-priority.md) |

---

## Appendix A: Color Hex Codes

| Semantic | Hex |
|----------|-----|
| FP / Reward (Gold/Amber) | `#F59E0B` |
| Power (Warm red-orange) | `#EF4444` |
| Guard (Steel blue) | `#3B82F6` |
| Speed (Electric green) | `#22C55E` |
| Vigor (Earth brown) | `#A16207` |
| Focus (Sharp violet) | `#8B5CF6` |
| Spirit (White-gold glow) | `#FEF08A` |
| Rest / calm (Cool blue) | `#60A5FA` |
| Ready (Soft gold) | `#FBBF24` |
| Ferro type (Chrome/metallic) | `#94A3B8` |
| Terra type (Forest/earth) | `#22C55E` |
| Flux type (Neon/electric) | `#A855F7` |

---

## Appendix B: Suggested Component File Structure

```
src/components/
├── feedback/
│   ├── CelebrationModal.tsx
│   ├── FPPopup.tsx
│   ├── AchievementStamp.tsx
│   └── EvolutionSequence.tsx
├── progress/
│   ├── XPBar.tsx
│   ├── StreakFlame.tsx
│   ├── FloorIndicator.tsx
│   └── RadarChart.tsx
├── pet/
│   ├── PetDisplay.tsx
│   ├── FeedingUI.tsx
│   ├── MoodIndicator.tsx
│   └── StatAllocator.tsx
├── workout/
│   ├── ExerciseCard.tsx
│   ├── SetLogger.tsx
│   ├── RestTimer.tsx
│   └── SessionSummary.tsx
└── theme/
    ├── colors.ts
    ├── spacing.ts
    └── typography.ts
```

> Suggested layout only — actual locations may shift with Expo Router conventions. The grouping (feedback/progress/pet/workout/theme) is the load-bearing part.
