# Avatar Design Brief — Making a Pet Worth Caring About

> **Status:** Living doc, co-authored. Phase 2 item 9 (avatar identity pass).
> **Maturity legend:** ✅ AFFIRMED (Adrian confirmed) · 🟡 DRAFT (my hypothesis, react to it) · 🔴 OPEN (needs Adrian's input)
> **Origin:** Born from the 2026-07-04 design deep-dive. Supersedes the procedural-only framing of Phase 1; operationalizes ADR-0006 (hybrid rendering).

---

## 0. How to use this doc

This is the source of truth for the pet's **art direction and emotional intent**. Visual choices (silhouette, color, face, motion) get evaluated against the principles here — not against "looks cool." If a proposed visual serves Sections 3-5, it's in. If it doesn't, it's out, no matter how polished.

Sections 3 and 4 are settled (✅). Everything else is draft (🟡) or open (🔴) — Adrian reacts, I revise. When a section stabilizes, it graduates to ✅ and becomes a hard constraint on Higgsfield prompts and overlay code.

---

## 1. Why this is the make-or-break decision

The 2026-07 audit put it plainly: *"the result reads as clipart, not creature."* Phase 1's procedural renderer works technically but failed the art-direction bar — exactly the risk the docs' own register predicted. **IronQuest's defensibility depends on the pet earning attachment.** A tracker with a clipart pet is just Strong/Hevy with a coat of paint, and lifters won't switch.

The market research is clear on the niche: no shipping app makes a creature whose *body* is a function of your training. The wedge is open. Capturing it requires a pet that's (a) worth caring about and (b) visibly yours. This brief is about (a); item 12 (typed-FP recalibration, PR #43) is about (b).

---

## 2. Target user 🟡

**Not a beginner needing motivation to start.** IronQuest's persona is the 4–6 day/week intermediate lifter who *already trains*. Their problem isn't initiation — it's that their meticulously-tracked data (Strong/Hevy refugees) is emotionally flat. They have a spreadsheet's worth of progress; it doesn't *feel* like anything.

The pet's job is to give that data a **body** — make the invisible accumulation of work visible and self-relevant. The user's current relationship to their data is *"I have it, but it doesn't mean anything to look at."*

**🔴 Open for Adrian:** Does this persona match the user you're building for? Specifically — are you building for the intermediate who already tracks, or also for the newer lifter who needs the pet to motivate consistency? The answer changes the emotional register.

---

## 3. Emotional goal — ✅ AFFIRMED

**The target emotion is pride and recognition.** Not "fun." Not "delight." Not "cute companion."

The user should look at their pet and feel: *"I built this. I earned this. This is a reflection of me."* The pet is a **mirror** that reflects accumulated effort back, made visible. Every visual element should serve that recognition — when you see the pet, you see your own work staring back.

This is why "fun/cute" is the wrong axis: it's the casual-gamification register (Wokamon, GymPet, Habitica pets) and it's why those feel infantilizing to a serious lifter. Pride is a heavier, more durable emotion — and it's the one that survives the 6-month novelty cliff.

**Care (feeding, mood) is in service of pride, not separate from it.** Tending the pet is *tending to the self* — investing surplus effort into a visible representation of yourself. Not a chore cycle.

---

## 4. The "not a chore" principle — ✅ AFFIRMED

> *"I don't want it to feel like a considerable chore — like I'm managing myself AND my avatar. But I want it to feel rewarding."* — Adrian, 2026-07-04

This is a **hard constraint**, equal in weight to the Core Design Rule "No Punishment for Absence." It reshapes every mechanic:

| Chore pattern (reject) | Rewarding pattern (keep) |
|---|---|
| Pet decays / looks pathetic if you don't log in | Pet reflects what you've *done*, never what you *owe* |
| Feeding is an obligation (pet is starving) | Feeding is an *investment* of surplus FP into visible growth |
| Guilt-tripping copy ("your pet missed you") | Honest mirror with no judgment tone |
| Maintenance without payoff | Every care action has visible stat→visual impact |
| Penalty for absence | Vacation mode freezes the mirror; absence never costs |

**Implication for the visual:** the pet must never look **needy, starving, or pleading**. Its resting state is *earned composure* — confident, not demanding. Hunger/mood are honest signals of recent training, not guilt levers. A hungry pet isn't sad; it's just *underfed right now*, and the fix feels like growth, not rescue.

**🔴 Open for Adrian:** Does hunger/mood even belong in v1? Given "not a chore," the safest MLV might be a pet whose state changes *only* from workouts (passive), with feeding as an opt-in FP sink — not a survival mechanic. The pet-care ticket (#41) assumes mood+feeding; this principle might shrink that scope.

---

## 5. Psychological levers 🟡

Three mechanisms, in priority order. Visual decisions should exploit these deliberately.

1. **The IKEA effect** (primary) — humans overvalue what they helped build. Every workout *builds* the pet. The pet must feel *constructed by effort*, not gifted. This is why stat-driven visual changes at the moment of spend (audit §5.3) mattered — even though ADR-0006 walked back smooth geometric mutation, the *legibility* of "this changed because I trained" must survive in overlay form (tier swap, tint, growth).

2. **Endowment / ownership** — we overvalue things once they're "ours." The pet must feel *unique to me*, not the same creature every user has. This is the typed-FP calibration's whole point (#39/#43): if every pet converges to Focus-heavy, ownership breaks because my pet looks like your pet.

3. **Mirror / identity** — we bond with representations of self. The pet is an externalized self-portrait. Heavy leg days → visibly leg-developed creature. The mirroring makes the data self-relevant in a way no chart achieves.

**Lever we explicitly refuse:** the Tamagotchi/Neopets guilt-and-decay loop. It drives engagement via anxiety, not pride. Incompatible with Section 4.

---

## 6. Reference triangulation — 🔴 OPEN

We need 3–5 existing properties that hit adjacent emotional notes — to learn from, not copy. My initial candidates (Adrian, react / add / subtract):

| Property | What's worth studying | Risk |
|---|---|---|
| **Spiritfarer** | Warm emotional bond with creatures, hand-drawn, *not* saccharine | Tone is gentle; might conflict with "serious lifter" pride |
| **Undertale** | Geometric characters earning personality via face + timing (audit's own ref) | Indie-game quirky; might read as jokey |
| **Monster Hunter** | Gear = visible effort. Progression is *worn*. | Human avatar, not creature — but the "effort made visible" pattern |
| **Hades** | Mirror of Night: your build choices made visible on a persistent surface | No creature, but the self-portrait-via-choices pattern |
| **Pokémon** | Evolution as celebration; beloved at scale | Corporate-cute; risks infantilizing |
| **Animal Crossing** | Zero-punishment daily companionship | Too low-stakes for a "serious lifter" |

**🔴 Open for Adrian:** Which 3–5 of these (or others) resonate? What characters from games/shows/anime have *you* felt proud of or attached to? Your references matter more than my guesses here.

---

## 7. Evolution arc 🟡

Stages 1→4 (Shard → Form → Prime → Apex) should tell an emotional story, not just a size-scaling story. 🟡 My draft:

- **Stage 1 — Shard:** nascent. Small, minimal, full of potential. The "you started" state.
- **Stage 2 — Form:** defined. The creature's identity (type + build) becomes legible. "Your training is shaping this."
- **Stage 3 — Prime:** peak development. Stats visibly maxed in places. "You've built something formidable."
- **Stage 4 — Apex:** mastery. A creature that could only exist from years of specific training. "This is unmistakably *yours*."

The arc is **becoming-more-you**, not becoming-more-powerful. Stage 4 shouldn't look like a generic "max level" creature — it should look like *the specific creature that only your specific training history could produce*.

**🔴 Open:** Is "becoming-more-you" the right arc, or should it be "becoming-more-formidable" (power fantasy)? They're different. Pride-in-identity vs pride-in-strength.

---

## 8. Visual principles 🟡 (downstream of 3–5)

These follow *from* the intent. Each principle should trace back to Section 3 (pride) or 4 (not a chore).

- **Silhouette before detail.** Recognition comes from silhouette; personalization from deformation (audit §5.1). One base body shape per type, deformed by stats.
- **Face is the leverage.** ~90% of geometric-character charm is eyes + timing (audit §5.2). The face conveys *quiet composure*, not pleading. Eyes that follow a tap, squint on a PR, sparkle after a streak milestone — never "sad puppy eyes" begging for food.
- **Color = stat language.** Stat colors already exist in `colors.stats.*`. Carry them onto the pet so radar, stat rows, and creature speak one language (audit §5.5). Power → warm intensity, Spirit → glow, etc.
- **Stat changes are legible at the moment of spend.** ADR-0006 keeps this via overlays (tier swap, tint growth) even though base geometry is fixed.
- **No pathetic resting state.** The pet's default expression is composed, never needy (Section 4).
- **Training résumé markings.** Subtle accumulation marks (rings, notches, glow intensity) for streaks/milestones — the pet as readable training history (audit §5.4).

---

## 9. The glance test 🟡

The UX spec's promise: *a training partner can glance at your pet and read "high-volume leg-day consistency freak."* The pet must be a **readable training résumé** at a look.

| Signal | What it conveys |
|---|---|
| Silhouette proportions | Which body region is developed (legs vs upper vs core) |
| Color distribution | Which stats dominate (warm = power, cool = speed/control) |
| Streak markings (rings/glow) | Consistency over weeks |
| Size / evolution stage | Total accumulated effort |
| Type (Ferro/Flux/Terra) | Training *character* — explosive vs endurance vs control |

This is what no competitor offers. It's the differentiator made visible. Every visual decision should be auditable against: *"can someone read this off the pet in 2 seconds?"*

---

## 10. Anti-patterns 🔴

What we explicitly refuse. 🟡 Initial list — Adrian, add yours:

- **Generic AI mascot** — the smoke-test result. Warm starburst with dot eyes, indistinguishable from any icon pack.
- **Needy / pleading expression** — Tamagotchi guilt-bait. Violates Section 4.
- **Too juvenile** — Pokémon-tier cute may conflict with "serious lifter" pride.
- **Too dark/edgy** — not a horror aesthetic; pride isn't grimness.
- **Uncanny realism** — stylized/geometric is the lane, not photoreal.
- **Static** — a pet that doesn't visibly change with stats is a sticker, not a mirror.
- **Identical across users** — if my pet can look like yours, the mirror/ownership levers break.

---

## 11. Open questions for Adrian

Carry these into the next pass:

1. **Persona confirm (Section 2):** intermediate-only, or also newer lifters who need motivation? newer lifters who need motivation
2. **Hunger/mood in v1 (Section 4):** keep as opt-in, or drop entirely until we know if it reads as a chore? drop entirely
3. **References (Section 6):** which 3–5 properties resonate with you? What characters have you felt proud of? Pokemon, World of Warcraft gear acquisition, Undertale
4. **Evolution arc (Section 7):** "becoming-more-you" (identity) or "becoming-more-formidable" (power)? why not both? it is a reflection of me in a sense, but we want it to be formidable when we scale the battletower. People should not be able to evolve quickly. It has to be earned considerably. 
5. **Anti-patterns (Section 10):** what else do you reflexively not want this to feel like? i do not want generic AI mascots, some people might be hyper sensitive to their mascot be too feminine if their workout split and decisions end up generating a feminine looking pet, we will need to figure out a way for a character to manage this so theyre not at the whims of the designs of the system. We do not need realism. The pet has to have animations, no static pets.

---

## 12. What this doc governs downstream

Once sections stabilize, they constrain:
- **Higgsfield prompts** for the 12 base illustrations (ADR-0006) — vibe language comes from §3/§6/§8
- **Overlay system** (procedural, on top of base sprites) — what overlays exist comes from §5/§8/§9
- **Pet-care ticket (#41) scope** — Section 4 may shrink mood/feeding scope
- **Celebration layer (#40) animation vocabulary** — face/eye reactions come from §8

No Higgsfield generation until §3, §4, §6, §7 are stable. Prompts without intent produce clipart (the smoke test proved this).
